// Before a user is allowed to work with a board, check that the board exists and that the logged-in user has access to it.

import { query } from "../config/db.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

// This middleware checks that the logged-in user can access the requested board.
const requireBoardAccess = asyncHandler(async (req, _res, next) => {
  const boardId =
    req.params.boardId ||
    req.params.id ||
    req.body.board_id ||
    req.query.board_id;

  if (!boardId) throw ApiError.badRequest("board id is required");

  // Check if the board exists and if the logged-in user has access to it
  const { rows } = await query(
    `SELECT b.id, b.owner_id, m.role
     FROM boards b
     LEFT JOIN board_members m
      ON m.board_id = b.id AND m.user_id =$2
     WHERE b.id = $1`,
    [boardId, req.user.id],
  );
  /*
  Get data from the boards table and temporarily call it b
  Get data from the board_members table and temporarily call it m
  b and m is called a table alias
  */

  const board = rows[0];
  if (!board) throw ApiError.notFound("Board not found"); // if board does not exist, throw error

  // check if user is the owner of the board
  const isOwner = board.owner_id === req.user.id;

  // If the user is NOT the owner AND also doesn't have a membership role, deny access.
  if (!isOwner && !board.role) {
    throw ApiError.forbidden("You do not have access to this board");
  }

  // store the board info in req.board so that other middleware and route handlers can use it
  req.board = {
    id: board.id,
    owner_id: board.owner_id,
    role: isOwner ? "owner" : board.role,
  };

  // If we reach this point, the user has access to the board, so we can call next() to continue to next middleware/controller
  next();
});

export default requireBoardAccess;
