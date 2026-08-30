import { query, withTransaction } from "../config/db.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { emitToBoard, logActivity } from "../realtime";

const DEFAULT_COLUMNS = ["Todo", "In Progress", "Review", "Done"];

const listBoards = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT b.*,
    (b.owner_id = $1) AS is_owner,
    (SELECT COUNT(*) FROM tasks t WHERE t.board_id = b.id) AS task_count,
    (SELECT COUNT(*) FROM board_members m WHERE m.board_id = b.id) AS member_count
    FROM boards b
    LEFT JOIN board_members mm ON mm.board_id = bid AND mm.user_id = $1
    WHERE b.owner_id = $1 OR mm.user_id = $1
    ORDER BY b.updated_at DESC`,
    [req.user.id],
  );
  res.json({ boards: rows });
});

const createBoard = asyncHandler(async (req, res) => {
  const title = (req.body.title || "").trim();
  const description = (req.body.description || "").trim() || null;
  const color = req.body.color || "#6366f1";
  if (!title) throw ApiError.badRequest("Board title is required");

  const board = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO boards (title, description, color, owner_id)
      VALUES ($1, $2, $3, $4) RETURNING *`,
      [title, description, color, req.user.id],
    );

    const b = rows[0];

    await client.query(
      `INSERT INTO board_memebers (board_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [b.id, req.user.id],
    );

    for (let i = 0; i < DEFAULT_COLUMNS.length; i++) {
      await client.query(
        `INSERT INTO columns (board_id, title, position) VALUES ($1, $2, $3)`,
        [b.id, DEFAULT_COLUMNS[i], (i + 1) * 1000],
      );
    }
    return b;
  });

  res.status(201).json({ board });
});

const getBoard = asyncHandler(async (req, res) => {
  const boardId = req.body.id;

  const [boardRes, columnsRes, tasksRes, membersRes] = await Promise.all([
    query("SELECT * FROM boards WHERE id = $1", [boardId]),
    query("SELECT * FROM columns WHERE board_id = $1 ORDER BY position ASC", [
      boardId,
    ]),
    query(
      `SELECT t.*,
      a.name AS assignee_name, a.email AS assignee_email, a.avatar_url AS assignee_avatar
      FROM tasks t
      LEFT JOIN users a ON a.id = t.assignee_id
      WHERE t.board_id = $1
      ORDER BY t.position ASC`,
      [boardId],
    ),
    query(
      `SELECT u.id, u.name, u.email, u.avatar_url, m.role, m.joined_at
      FROM board_members m
      JOIN users u ON u.id = m.user_id
      WHERE m.board_id = $1
      ORDER BY m.joined_at ASC`,
      [boardId],
    ),
  ]);
  res.json({
    board: boardRes.rows[0],
    columns: columnsRes.rows,
    tasks: tasksRes.rows,
    members: membersRes.rows,
    role: req.board.role,
  });
});

// Update Board - edits the title, description & color
const updateBoard = asyncHandler(async (req, res) => {
  const { title, description, color } = req.body;
  const { rows } = await query(
    `UPDATE boards
      SET title = COALESCE($2, title),
          description = COALESCE($3, description),
          color = COALESCE($4, color),
          updated_at = now()
    WHERE id = $1
    RETURNING *`,
    [req.board.id, title ?? null, description ?? null, color ?? null],
  );
  emitToBoard(req.board.id, "board:updated", rows[0]);
  res.json({ board: rows[0] });
});

// Dlete Board - only if you are owner, delete board removes the board
