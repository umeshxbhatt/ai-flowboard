import { query } from "../config/db.js";
import { emitToBoard } from "../realtime/index.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

export const createColumn = asyncHandler(async (req, res) => {
  const title = (req.body.title || "").trim();
  if (!title) throw ApiError.badRequest("Column title is required");

  const posRes = await query(
    "SELECT COALESCE(MAX(position), 0) + 1000 AS pos FROM columns WHERE board_id = $1",
    [req.board.id],
  );

  const { rows } = await query(
    `INSERT INTO columns (board_id, title, position)
    VALUES ($1, $2, $3) RETURNING *`,
    [req.board.id, title, posRes.rows[0].pos],
  );

  emitToBoard(req.board.id, "column_created", rows[0]);
  res.status(201).json({ column: rows[0] });
});

export const updateColumn = asyncHandler(async (req, res) => {
  const { title, position } = req.body;
  const { rows } = await query(
    `UPDATE columns 
      SET title = COALESCE($3, title), 
      position = COALESCE($4, position)
      WHERE id = $1 AND board_id = $2
      RETURNING *`,
    [req.params.columnId, req.board.id, title ?? null, position ?? null],
  );
  if (!rows.length) throw ApiError.notFound("Column not found");
  emitToBoard(req.board.id, "column:updated", rows[0]);
  res.json({ column: rows[0] });
});

export const deleteColumn = asyncHandler(async (req, res) => {
  const result = await query(
    `DELETE FROM columns WHERE id = $1 AND board_id = $2`,
    [req.params.columnId, req.board.id],
  );
  if (!result.rowCount) throw ApiError.notFound("Column not found");
  emitToBoard(req.board.id, "column:deleted", { id: req.params.columnId });
  res.json({ success: true });
});
