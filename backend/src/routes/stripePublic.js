const express = require("express");
const router = express.Router();
const { env } = require("../config/env");

router.get("/config", (req, res) => {
  res.json({ publishableKey: env.STRIPE_PUBLISHABLE_KEY });
});

module.exports = router;
