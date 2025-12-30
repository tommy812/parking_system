const express = require("express");
const router = express.Router();

const users = [
  { name: "John Doe" },
  { name: "Jane Doe" },
  { name: "John Smith" },
];

router.get("/", (req, res) => {
  res.send("Users list");
});

router.post("/new", (req, res) => {
  res.send("New user created");
});

router
  .route("/:id")
  .get((req, res) => {
    res.json({ user: req.user });
  })
  .put((req, res) => {
    res.send(`User updated: ${req.params.id}`);
  })
  .delete((req, res) => {
    res.send(`User deleted: ${req.params.id}`);
  });

router.param("id", (req, res, next, id) => {
  const user = users[id];
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  req.user = user;
  next();
});

module.exports = router;
