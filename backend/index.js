import "dotenv/config";
import express from "express";
import cors from "cors";
import apiRoutes from "./src/routes/index.js";
import {
  errorHandler,
  notFoundHandler,
} from "./src/middleware/errorHandler.js";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) =>
  res.json({ name: "AI Kanban Board API", status: "running" }),
);

app.use("/api", apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`API listening on PORT : ${PORT}`);
});

export default app;
