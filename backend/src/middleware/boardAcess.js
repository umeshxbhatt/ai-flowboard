import { query } from "../config/db.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

const requireBoardAccess = asyncHandler(async (req, _res, next) => {
  const boardId =
    req.params.boardId ||
    req.params.id ||
    req.body.board_id ||
    req.query.board_id;

  if (!boardId) throw ApiError.badRequest("board id is required");

  const { rows } = await query(
    `SELECT b.id, b.owner_id, m.role
     FROM boards b
     LEFT JOIN board_members m
      ON m.board_id = b.id AND m.user_id =$2
     WHERE b.id = $1`,
    [boardId, req.user.id],
  );

  const board = rows[0];
  if (!board) throw ApiError.notFound("Board not found");

  const isOwner = board.owner_id === req.user.id;
  if (!isOwner && !board.role) {
    throw ApiError.forbidden("You do not have access to this board");
  }

  req.board = {
    id: board.id,
    owner_id: board.owner_id,
    role: isOwner ? "owner" : board.role,
  };
  next();
});

export default requireBoardAccess;
