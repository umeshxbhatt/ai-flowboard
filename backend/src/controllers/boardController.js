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
