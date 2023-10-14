import { readFileSync } from 'fs';
import { parse } from 'yaml';
import axios from 'axios';
import { sendNotification } from "./notify.mjs";

const config = parse(readFileSync('./config.yml', 'utf8'));

const checkAvailability = async () => {
  const partParams = config.parts.reduce(
    (acc, val, idx) => {
      acc[`parts.${idx}`] = val;
      return acc;
    }, {}
  );

  const { data } = await axios.get(`https://www.apple.com/de/shop/fulfillment-messages`, {
    params: {
      location: config.location,
      pl: true,
      "mts.0": "compact",
      ...partParams
    }
  });


  const stores = data.body.content.pickupMessage.stores;

  const res = [];
  for (const storeNumber of config.stores) {
    const store = stores.find(s => s.storeNumber === storeNumber);
    if (!store) continue;
    for (const part of Object.keys(store.partsAvailability)) {
      const availability = {
        ...store.partsAvailability[part],
        ...store.partsAvailability[part].messageTypes.compact
      };

      const available = availability.storeSelectionEnabled;
      res.push({ part, store: { number: store.storeNumber, name: store.storeName }, available, data: availability });
    }
  }

  return res;
}

const availabilityMap = {};

const getAvailabilityKey = (store, part) => {
  return `${store}-${part}`;
}

const loop = async () => {
  console.log(`👀 Checking availability at ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}...`);

  const availabilityList = await checkAvailability();
  for (const { part, store, available, data } of availabilityList) {

    const availabilityKey = getAvailabilityKey(store.number, part);
    let wasAvailable = availabilityMap[availabilityKey];

    const icon = available ? "✅" : "❌";
    if (available && !wasAvailable) {
      console.log(`${icon} (${part}) [${store.name}] ${data.storePickupProductTitle} ${data.pickupDisplay}`);
      console.log("Notifying due to availability change");
      await sendNotification({
        title: "Available for pickup",
        body: `${data.storePickupQuote} at ${store.name}: ${data.storePickupProductTitle}`,
      });
    }

    if (wasAvailable && !available) {
      console.log(`${icon} (${part}) [${store.name}] ${data.storePickupProductTitle} ${data.pickupDisplay} no longer available`);
    }

    availabilityMap[availabilityKey] = available;
  }
}

setInterval(loop, config.interval);
loop();
