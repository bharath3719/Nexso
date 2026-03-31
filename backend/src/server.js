import express from "express";
import cors from "cors";
import morgan from "morgan";

import webhookRouter from "./routes/webhook.js";
import vendorRouter from "./routes/vendor.js";
import ticketsRouter from "./routes/tickets.js";
import usersRouter from "./routes/users.js";
import societiesRouter from "./routes/societies.js";

const app = express();

app.use(cors());
// Capture raw body for signature verification while still parsing JSON
app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(morgan("dev"));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/webhook", webhookRouter);
app.use("/api/vendors", vendorRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/users", usersRouter);
app.use("/api/societies", societiesRouter);

export default app;
