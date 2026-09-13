import { query } from "../config/db.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { emitToBoard, logActivity } from "../realtime/index.js";

const PRIORITIES = ["low", "medium", "high", "urgent"];

/*
  Make sure the requested column belongs to the requested board.
  Returns the column if it exists.
*/
const ensureColumnInBoard = async (columnId, boardId) => {
  const { rows } = await query(
    `SELECT id
     FROM columns
     WHERE id = $1 AND board_id = $2`,
    [columnId, boardId],
  );

  if (!rows.length) {
    throw ApiError.badRequest("Column does not belong to this board");
  }
};

/*
  Fetch one task with assignee information.
*/
export const fetchTask = async (taskID) => {
  const { rows } = await query(
    `SELECT
       t.*,
       a.name AS assignee_name,
       a.email AS assignee_email,
       a.avatar_url AS assignee_avatar
     FROM tasks t
     LEFT JOIN users a ON a.id = t.assignee_id
     WHERE t.id = $1`,
    [taskId],
  );
  return rows[0];
};

/*
  List all tasks for the current board.
*/
export const listTasks = asyncHandler(async (req, res) => {
  const filters = ["t.board_id = $1"];
  const params = [req.board.id];

  if (req.query.priority) {
    params.push(req.query.priority);
    filters.push(`t.priority = $${params.length}`);
  }

  if (req.query.assignee) {
    params.push(req.query.assignee);
    filters.push(`t.assignee_id = $${params.length}`);
  }

  if (req.query.column) {
    params.push(req.query.column);
    filters.push(`t.column_id = $${params.length}`);
  }

  if (req.query.q) {
    params.push(`%${req.query.q}%`);
    filters.push(
      `(t.title ILIKE $${params.length} OR t.description ILIKE $${params.length})`,
    );
  }

  const { rows } = await query(
    `SELECT
       t.*,
       a.name AS assignee_name,
       a.email AS assignee_email,
       a.avatar_url AS assignee_avatar
     FROM tasks t
     LEFT JOIN users a ON a.id = t.assignee_id
     WHERE ${filters.join(" AND ")}
     ORDER BY t.position ASC`,
    params,
  );

  res.json({ tasks: rows });
});

/*
  Create a new task.
*/
export const createTask = asyncHandler(async (req, res) => {
  const {
    column_id,
    title: rawTitle,
    description,
    due_date,
    assignee_id,
  } = req.body;
  const title = (rawTitle || "").trim();
  const priority = PRIORITIES.includes(req.body.priority)
    ? req.body.priority
    : "medium";

  if (!title) throw ApiError.badRequest("Task title is required");
  if (!column_id) throw ApiError.badRequest("column_id is required");
  await ensureColumnInBoard(column_id, req.board.id);

  const posRes = await query(
    "SELECT COALESCE(MAX(position), 0) + 1000 AS pos FROM tasks WHERE column_id = $1",
    [column_id],
  );

  // Create task
  const { rows } = await query(
    `INSERT INTO tasks (
         board_id,
         column_id,
         title,
         description,
         priority,
         due_date,
         assignee_id,
         position,
         created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
    [
      req.board.id,
      column_id,
      title,
      description || null,
      priority,
      due_date || null,
      assignee_id || null,
      posRes.rows[0].pos,
      req.user.id,
    ],
  );

  const task = await fetchTask(rows[0].id);
  emitToBoard(req.board.id, "task:created", task);
  await logActivity({
    boardId: req.board.id,
    userId: req.user.id,
    action: "task.created",
    message: `${req.user.name} created "${task.title}"`,
    metadata: { taskId: task.id },
  });

  res.status(201).json({ task });
});

/*
  Update task details.
*/
export const updateTask = asyncHandler(async (req, res) => {
  const { title, description, priority, due_date, assignee_id } = req.body;

  if (priority !== undefined && !PRIORITIES.includes(priority)) {
    throw ApiError.badRequest("Priority must be low, medium, high, or urgent");
  }

  const { rows } = await query(
    `UPDATE tasks
     SET title = COALESCE($3, title),
         description = COALESCE($4, description),
         priority = COALESCE($5, priority),
         due_date = COALESCE($6, due_date),
         assignee_id = $7,
         updated_at = now()
     WHERE id = $1 AND board_id = $2
     RETURNING id`,
    [
      req.params.taskId,
      req.board.id,
      title ?? null,
      description ?? null,
      priority ?? null,
      due_date ?? null,
      assignee_id === undefined ? null : assignee_id,
    ],
  );
  if (!rows.length) throw ApiError.notFound("Task not found");

  const task = await fetchTask(rows[0].id);
  emitToBoard(req.board.id, "task:updated", task);
  res.json({ task });
});

/*
  Move a task to another column / position.
*/
export const moveTask = asyncHandler(async (req, res) => {
  const { column_id, position } = req.body;

  if (!column_id) throw ApiError.badRequest("Target column id is required");

  if (position === undefined || position === null)
    throw ApiError.badRequest("Task position is required");

  await ensureColumnInBoard(column_id, req.board.id);

  const prevRes = await query(
    "SELECT t.column_id, c.title FROM tasks t JOIN columns c ON c.id = t.column_id WHERE t.id = $1 AND t.board_id = $2",
    [req.params.taskId, req.board.id],
  );
  if (!prevRes.rows.length) throw ApiError.notFound("Task not found");
  const movedColumns = prevRes.rows[0].column_id !== column_id;

  /*
      The task is effectively leaving its old column
      and moving into the target column.
    */
  const { rows } = await client.query(
    `UPDATE tasks
       SET column_id = $3,
           position = $4,
           updated_at = now()
       WHERE id = $1 AND board_id = $2
       RETURNING id`,
    [req.params.taskId, req.board.id, column_id, position],
  );

  const task = await fetchTask(rows[0].id);
  emitToBoard(req.board.id, "task:moved", task);

  if (movedColumns) {
    const colRes = await query("SELECT title FROM columns WHERE id = $1", [
      column_id,
    ]);
    await logActivity({
      boardId: req.board.id,
      userId: req.user.id,
      action: "task.moved",
      message: `${req.user.name} moved "${task.title}" to ${colRes.rows[0].title}`,
      metadata: { taskId: task.id, columnId: task.column_id },
    });
  }
  res.json({ task });
});

/*
  Delete task.
*/
export const deleteTask = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `DELETE FROM tasks
     WHERE id = $1 AND board_id = $2
     RETURNING title`,
    [req.params.taskId, req.board.id],
  );

  if (!rows.length) throw ApiError.notFound("Task not found");

  emitToBoard(req.board.id, "task:deleted", { id: req.params.taskId });
  await logActivity({
    boardId: req.board.id,
    userId: req.user.id,
    action: "task.deleted",
    message: `${req.user.name} deleted "${rows[0].title}"`,
    metadata: { taskId: req.params.taskId },
  });
  res.json({ success: true });
});
