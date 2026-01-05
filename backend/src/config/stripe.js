const Stripe = require("stripe");
const { env } = require("./env");

if (!env.STRIPE_SECRET_KEY) {
  console.warn("⚠️ STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

module.exports = { stripe };
