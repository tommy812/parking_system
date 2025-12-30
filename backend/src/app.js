const express = require("express");
const apiRouter = require("./routes");

const app = express();

app.use(express.json());
app.use(logger);

app.get("/", (req, res) => res.send("Hello World"));
app.use("/api", apiRouter);

function logger(req, res, next) {
  console.log(`${req.protocol}://${req.get("host")}${req.originalUrl}`);
  next();
}

module.exports = app;