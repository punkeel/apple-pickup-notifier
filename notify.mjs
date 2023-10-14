import axios from 'axios';


export const sendNotification = async ({ title, body }) => {
  await axios.post(`https://push.techulus.com/api/v1/notify/xxx`, {
    title,
    body
  })
}
