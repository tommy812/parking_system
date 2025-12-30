require("dotenv").config();

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 3001),
  DATABASE_URL: process.env.DATABASE_URL || "",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
  JWT_SECRET: process.env.JWT_SECRET || "dev-only-change-me",
};

module.exports = { env };
