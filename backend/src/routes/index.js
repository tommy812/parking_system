const express = require("express");
const router = express.Router();

const { pool } = require("../config/db"); 
const usersRouter = require("./users");
const parkingsRouter = require("./parkings");
const bookingsRouter = require("./bookings");
const paymentsRouter = require("./payments");

// health API root
router.get("/", (req, res) => {
  res.json({ message: "API root" });
});


router.get("/db-ping", async (req, res, next) => {
  try {
    const r = await pool.query("SELECT NOW() as now");
    res.json({ dbTime: r.rows[0].now });
  } catch (e) {
    next(e);
  }
});

module.exports = router;


// mount users routes
router.use("/users", usersRouter);
router.use("/parkings", parkingsRouter);
router.use("/bookings", bookingsRouter);
router.use("/payments", paymentsRouter);

module.exports = router;
