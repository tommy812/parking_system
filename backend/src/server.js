const app = require("./app");
const { env } = require("./config/env");
const { startExpireJob } = require("./jobs/expPendingBookings");


app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});

startExpireJob();