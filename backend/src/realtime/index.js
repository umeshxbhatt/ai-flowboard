// 1. Keeps access to Socket.IO (`io`)
// 2. Saves board activities to PostgreSQL and broadcasts them to everyone on that board

import { query } from "../config/db.js";

let io = null;

// this function receives a Socket.Io instance and stores it in io
export const setIo = (instance) => {
  io = instance;
};

// this creates a room name from a board ID, so we can emit events to all users on that board
export const boardRoom = (boardId) => `board:${boardId}`;

// this function sends a Socket.Io event to everyone in a particlar board room
// event : what event name, payload : what data to send
export const emitToBoard = (boardId, event, payload) => {
  if (io) io.to(boardRoom(boardId)).emit(event, payload);
};

// Save an activity in the database and then tell connected users about it in real time
export const logActivity = async ({
  boardId,
  userId,
  action,
  message,
  metadata,
}) => {
  const { rows } = await query(
    `INSERT INTO activities (board_id, user_id, action, message, metadata) 
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
