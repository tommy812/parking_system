require("dotenv").config();

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 3001),
  DATABASE_URL: process.env.DATABASE_URL || "",
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || "",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
  JWT_SECRET: process.env.JWT_SECRET || "dev-only-change-me",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  BCRYPT_ROUNDS: Number(process.env.BCRYPT_ROUNDS || 10),
  BOOKING_HOLD_MINUTES: Number(process.env.BOOKING_HOLD_MINUTES || 15),
  MAX_BOOKING_DAYS_AHEAD: Number(process.env.MAX_BOOKING_DAYS_AHEAD || 30),
};

module.exports = { env };
