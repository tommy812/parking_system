const express = require("express");
const apiRouter = require("./routes");
const cors = require("cors");
const app = express();

const stripeWebhookRouter = require("./routes/stripeWebhook");
app.use("/api/webhooks/stripe", stripeWebhookRouter); // raw body route first

const { notFound, errorHandler } = require("./middleware/errorHandler");


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
app.use(notFound);
app.use(errorHandler);

function logger(req, res, next) {
  console.log(`${req.protocol}://${req.get("host")}${req.originalUrl}`);
  next();
}

module.exports = app;