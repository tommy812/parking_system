const express = require("express");
const apiRouter = require("./routes");
const cors = require("cors");

const app = express();

const stripeWebhookRouter = require("./routes/stripeWebhook");
app.use("/api/webhooks/stripe", stripeWebhookRouter); // raw body route first

// DEV CORS (ok for localhost development)
app.use(
  cors({
    origin: true, // reflect request origin (works for file:// as well)
    credentials: true,
  })
);


app.use(express.json());
app.use(logger);

app.get("/", (req, res) => res.send("Hello World"));
app.use("/api", apiRouter);

function logger(req, res, next) {
  console.log(`${req.protocol}://${req.get("host")}${req.originalUrl}`);
  next();
}

module.exports = app;