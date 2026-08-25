import express from "express";
import authRoutes from "./authRoutes.js";

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.use("/auth", authRoutes);

export default router;
