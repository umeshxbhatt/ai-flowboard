import express from "express";
import requireAuth from "../middleware/auth.js";
import { searchUsers, getWorkspaceMembers } from "../controllers/usersController.js";

const router = express.Router();

// Protect all user routes with authentication
router.use(requireAuth);

// GET /api/users/search
router.get("/search", searchUsers);

// GET /api/users/workspace - team members across all boards
router.get("/workspace", getWorkspaceMembers);

export default router;
