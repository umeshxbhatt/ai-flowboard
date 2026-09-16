import express from "express";
import authRoutes from "./authRoutes.js";
import boardRoutes from "./boardRoutes.js";
import userRoutes from "./userRoutes.js";

const router = express.Router();

router.get("/health", (_req, res) => res.json({ status: "ok" }));

router.use("/auth", authRoutes);
router.use("/boards", boardRoutes);
router.use("/users", userRoutes);

export default router;
