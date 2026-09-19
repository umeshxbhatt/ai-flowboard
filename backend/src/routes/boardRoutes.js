import express from "express";
import requireAuth from "../middleware/auth.js";
import requireBoardAccess from "../middleware/boardAccess.js";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import rateLimit from "express-rate-limit";

const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 AI requests per window
  message: { success: false, message: "Too many AI requests, please try again later." }
});

const createBoardSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Title is required").max(100),
    description: z.string().optional(),
    color: z.string().regex(/^#([0-9a-f]{3}){1,2}$/i, "Invalid hex color").optional()
  })
});
import * as boardController from "../controllers/boardController.js";
import * as columnController from "../controllers/columnController.js";
import * as taskController from "../controllers/taskController.js";
import * as aiController from "../controllers/aiController.js";

const router = express.Router();

// Require user to be logged in for all board routes
router.use(requireAuth);

// Basic Board Operations (No specific board ID yet)
router.get("/", boardController.listBoards);
router.post("/", validate(createBoardSchema), boardController.createBoard);

// Operations on a specific board (Require Board Access middleware)
router.get("/:boardId", requireBoardAccess, boardController.getBoard);
router.patch("/:boardId", requireBoardAccess, boardController.updateBoard);
router.delete("/:boardId", requireBoardAccess, boardController.deleteBoard);

// Board Sub-resources (Activity & Members)
router.get("/:boardId/activity", requireBoardAccess, boardController.getActivity);
router.post("/:boardId/members", requireBoardAccess, boardController.addMember);
router.delete("/:boardId/members/:userId", requireBoardAccess, boardController.removeMember);

// Columns
router.post("/:boardId/columns", requireBoardAccess, columnController.createColumn);
router.patch("/:boardId/columns/:columnId", requireBoardAccess, columnController.updateColumn);
router.delete("/:boardId/columns/:columnId", requireBoardAccess, columnController.deleteColumn);

// Tasks
router.get("/:boardId/tasks", requireBoardAccess, taskController.listTasks);
router.post("/:boardId/tasks", requireBoardAccess, taskController.createTask);
router.patch("/:boardId/tasks/:taskId", requireBoardAccess, taskController.updateTask);
router.patch("/:boardId/tasks/:taskId/move", requireBoardAccess, taskController.moveTask);
router.delete("/:boardId/tasks/:taskId", requireBoardAccess, taskController.deleteTask);

// AI Features
router.post("/:boardId/ai/generate-tasks", requireBoardAccess, aiRateLimiter, aiController.generateTasks);
router.post("/:boardId/ai/breakdown", requireBoardAccess, aiRateLimiter, aiController.breakdownTask);
router.post("/:boardId/ai/summary", requireBoardAccess, aiRateLimiter, aiController.summarizeBoard);

export default router;
