import ApiError from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";

const createColumn = asyncHandler(async (req, res) => {
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

  emittoBoard(req.board.id, "column_created", rows[0]);
  res.status(201).json({ column: rows[0] });
});
