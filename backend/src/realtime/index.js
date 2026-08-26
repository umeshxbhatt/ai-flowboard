import { query } from "../config/db.js";

let io = null;

export const setIo = (instance) => {
  io = instance;
};

export const boardRoom = (boardId) => `board:${boardId}`;

export const emitToBoard = (boardId, event, payload) => {
  if (io) io.to(boardRoom(boardId)).emit(event, payload);
};

export const logActivity = async ({
  boardId,
  userId,
  action,
  message,
  metadata,
}) => {
  const { rows } = await query(
    `INSERT INTO activites (board_id, user_id, action, message, metadata) 
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, board_id, user_id, action, message, metadata, created_at`,
    [
      boardId,
      userId || null,
      action,
      message,
      metadata ? JSON.stringify(metadata) : null,
    ],
  );

  const activity = rows[0];
  emitToBoard(boardId, "activity:new", activity);
  return activity;
};
