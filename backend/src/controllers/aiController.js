import { query } from "../config/db.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { emitToBoard, logActivity } from "../realtime/index.js";
import * as aiService from "../services/aiService.js";

/*
  Generate tasks from a goal.
  If no 'col' is provided, returns suggestions as a preview.
  If 'col' is provided, inserts tasks into that column and broadcasts.
*/
export const generateTasks = asyncHandler(async (req, res) => {
  const goal = (req.body.goal || "").trim();
  if (!goal) throw ApiError.badRequest("A project goal is required");

  const count = Math.min(Math.max(parseInt(req.body.count, 10) || 6, 1), 15);

  // Always get suggestions from AI first
  const suggestions = await aiService.generateTasks(goal, count);

  // Preview mode (no column specified)
  if (!req.body.column_id) {
    return res.json({ tasks: suggestions, persisted: false });
  }

  // Save mode (column specified)
  const boardId = req.board?.id || req.body.boardId;
  if (!boardId) {
    throw ApiError.badRequest("Board context is required when a column is provided");
  }

  // Confirm column belongs to the board
  const colRes = await query(
    "SELECT id FROM columns WHERE id = $1 AND board_id = $2",
    [req.body.column_id, boardId]
  );
  if (!colRes.rows.length) {
    throw ApiError.badRequest("column_id does not belong to this board");
  }

  // Find max position
  const baseRes = await query(
    "SELECT COALESCE(MAX(position), 0) AS pos FROM tasks WHERE column_id = $1",
    [req.body.column_id]
  );
  let currentPos = Number(baseRes.rows[0].pos);

  const createdTasks = [];

  // Insert each suggestion as a real task
  for (const task of suggestions) {
    currentPos += 1000;

    const { rows } = await query(
      `INSERT INTO tasks (
         board_id,
         column_id,
         title,
         description,
         priority,
         position,
         created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        boardId,
        req.body.column_id,
        task.title,
        task.description,
        task.priority,
        currentPos,
        req.user?.id || null,
      ]
    );

    // Using fetchTask pattern if needed, but since we just inserted, 
    // returning the raw row is usually fine unless we need assignee joins.
    createdTasks.push(rows[0]);

    // Broadcast event
    emitToBoard(boardId, "tasks:created", rows[0]);
  }

  // Log activity
  if (req.user) {
    await logActivity({
      boardId,
      userId: req.user.id,
      action: "ai.tasks_generated",
      message: `${req.user.name || "A user"} used AI to generate ${createdTasks.length} tasks in "${colRes.rows[0].title}"`,
      metadata: { goal, generatedCount: createdTasks.length },
    });
  }

  res.status(201).json({ tasks: createdTasks, persisted: true });
});

/*
  Breakdown a task into smaller subtasks.
  Accepts title & description directly, or a taskId.
*/
export const breakdownTask = asyncHandler(async (req, res) => {
  let { title, description, taskId } = req.body;

  const count = Math.min(Math.max(parseInt(req.body.count, 10) || 5, 1), 12);

  // If a taskId is provided, fetch title and description from the DB
  if (taskId) {
    // Assuming the task must belong to the current board
    const boardId = req.board?.id || req.body.boardId;
    const { rows } = await query(
      "SELECT title, description FROM tasks WHERE id = $1 AND board_id = $2",
      [taskId, boardId]
    );
    if (!rows.length) throw ApiError.notFound("Task not found");

    title = rows[0].title;
    description = rows[0].description;
  }

  if (!title) throw ApiError.badRequest("Task title or taskId is required");

  const subtasks = await aiService.breakdownTask(title, description, count);

  res.json({ subtasks });
});

/*
  Summarize the entire board state.
*/
export const summarizeBoard = asyncHandler(async (req, res) => {
  const boardId = req.board?.id || req.params.boardId;
  if (!boardId) throw ApiError.badRequest("Board ID is required");

  const [boardRes, colsRes, tasksRes] = await Promise.all([
    query("SELECT title FROM boards WHERE id = $1", [boardId]),
    query("SELECT id, title FROM columns WHERE board_id = $1 ORDER BY position ASC", [boardId]),
    query("SELECT column_id, title, priority FROM tasks WHERE board_id = $1", [boardId]),
  ]);

  const columns = colsRes.rows.map((c) => ({
    title: c.title,
    tasks: tasksRes.rows.filter((t) => t.column_id === c.id),
  }));

  const boardTitle = boardRes.rows[0]?.title || "Board";

  const summary = await aiService.summarizeBoard({
    boardTitle,
    columns,
  });

  res.json({ summary });
});
