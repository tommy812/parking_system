require("dotenv").config();

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 3001),
  DATABASE_URL: process.env.DATABASE_URL || "",
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || "",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
  JWT_SECRET: process.env.JWT_SECRET || "dev-only-change-me",
  BOOKING_HOLD_MINUTES: Number(process.env.BOOKING_HOLD_MINUTES || 15),
};

module.exports = { env };
