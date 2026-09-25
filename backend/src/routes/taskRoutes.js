import express from "express";
import requireAuth from "../middleware/auth.js";
import { getMyTasks } from "../controllers/taskController.js";

const router = express.Router();

// Require authentication for task routes
router.use(requireAuth);

// GET /api/tasks/my - all tasks assigned to the current user
router.get("/my", getMyTasks);

export default router;
