const express = require("express");
const router = express.Router();

const usersRouter = require("./users");

// health API root
router.get("/", (req, res) => {
  res.json({ message: "API root" });
});

// mount users routes
router.use("/users", usersRouter);

module.exports = router;
