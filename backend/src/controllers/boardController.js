import { query, withTransaction } from "../config/db.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { emitToBoard, logActivity } from "../realtime";
import { use } from "react";

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
const deleteBoard = asyncHandler(async (req, res) => {
  if (req.board.role !== "owner")
    throw ApiError.forbidden("Only the owner can delete this baord");
  await query("DELETE FROM boards WHERE id = $1", [req.board.id]);
  emitToBoard(req.board.id, "board:deleted", { id: req.board.id });
  res.json({ success: true });
});

const getActivity = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
  const { rows } = await query(
    `SELECT act.*, u.name AS user_name, u.avatar_url AS user_avatar
    FROM activities act
    LEFT JOIN users u ON u.id = act.user_id
    WHERE act.board_id = $1
    ORDER BY act.created_at DESC
    LIMIT $2`,
    [req.board.id, limit],
  );
  res.json({ activities: rows });
});

const addMember = asyncHandler(async (req, res) => {
  if (req.board.role !== "owner" && req.board.role !== "admin")
    throw ApiError.forbidden("Only the owners or admins can add members");

  const email = (req.body.email || "").trim().toLowerCase();
  if (!email) throw ApiError.badRequest("Member email is required");

  const role = req.body.role === "admin" ? "admin" : "member";

  const userRes = await query(
    "SELECT id, name, email, avatar_url FROM users WHERE email = $1",
    [email],
  );
  const user = userRes.rows[0];
  if (!user) throw ApiError.notFound("No user found with that email");

  await query(
    `INSERT INTO board_members (board_id, user_id, role) 
    VALUES ($1, $2, $3) 
    ON CONFLICT (board_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [req.board.id, user.id, role],
  );

  await logActivity({
    boardId: req.board.id,
    userId: req.user.id,
    action: "member.added",
    message: `${req.user.name} added ${user.name} to the board`,
    metadata: { memberId: user.id },
  });

  res.status(201).json({ member: { ...user, role } });
});

const removeMember = asyncHandler(async (req, res) => {
  if (req.board.role !== "owner" && req.board.role !== "admin")
    throw ApiError.forbidden("Only owners or admins can remove members");

  const { userId } = req.params;
  if (userId === req.board.owner_id)
    throw ApiError.badRequest("Board owner cannot be removed");

  await query(
    "DELETE FROM board_members WHERE board_id = $1 AND user_id = $2",
    [boardId, userId],
  );

  res.json({ success: true });
});
