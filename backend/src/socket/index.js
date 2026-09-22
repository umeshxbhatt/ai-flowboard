import { Server } from "socket.io";
import { verifyToken } from "../utils/jwt.js";
import { query } from "../config/db.js";
import { setIo, boardRoom } from "../realtime/index.js";

// import redis and adapter
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";

// Create two Redis clients (one for publishing messages, one for subscribing)
export const pubClient = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
const subClient = pubClient.duplicate();

// Connect the clients
Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  console.log("🚀 Redis adapter connected to Socket.io")
}).catch((err) => {
  console.log("Redis connection failed:", err);
})

// Helper function to check if a user has access to a board
// (Mimics the logic from src/middleware/boardAccess.js)
const userCanAccessBoard = async (boardId, userId) => {
  try {
    const { rows } = await query(
      `SELECT b.id, b.owner_id, m.role
       FROM boards b
       LEFT JOIN board_members m
        ON m.board_id = b.id AND m.user_id = $2
       WHERE b.id = $1`,
      [boardId, userId],
    );
    const board = rows[0];
    if (!board) return false;
    const isOwner = board.owner_id === userId;
    if (!isOwner && !board.role) {
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error checking board access:", error);
    return false;
  }
};

export const initSocket = (server) => {
  // 1. Initialize the WebSocket Server
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
    // add redis adapter
    adapter: createAdapter(pubClient, subClient),
  });

  // 2. Socket Authentication (Middleware)
  io.use((socket, next) => {
    try {
      // The token should be sent by the client in auth.token
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication error: Token missing"));

      const decoded = verifyToken(token);
      if (!decoded) return next(new Error("Authentication error: Invalid token"));

      // Attach user info to socket for use in event listeners
      socket.user = { id: decoded.id, email: decoded.email, name: decoded.name };
      socket.data.user = socket.user;
      next();
    } catch (err) {
      console.error("Socket auth error:", err.message);
      next(new Error("Authentication error"));
    }
  });

  // 3. Connection Event Listener
  io.on("connection", (socket) => {
    const { user } = socket;

    socket.on("board:join", async (boardId, ack) => {
      try {
        // Check access
        if (!(await userCanAccessBoard(boardId, user.id))) {
          if (ack) ack({ ok: false, error: "Access denied to this board" });
          return;
        }

        const room = boardRoom(boardId);
        socket.join(room);

        socket.to(room).emit('presence:join', {
          user: { id: user.id, name: user.name },
          boardId,
        })

        const sockets = await io.in(room).fetchSockets();
        const seen = new Set([user.id]);
        const viewes = [];
        for (const s of sockets) {
          const u = s.data?.user;
          if (!u || seen.has(u.id)) continue;
          seen.add(u.id);
          viewes.push({ id: u.id, name: u.name });
        }
        socket.emit('presence:sync', { boardId, users: viewes });

        if (ack) ack({ ok: true });
      } catch (error) {
        console.error("Error joining board:", error);
        if (ack) ack({ ok: false, error: "Failed to join board" });
      }
    });

    socket.on("board:leave", (boardId) => {
      socket.leave(boardRoom(boardId));
      socket.to(boardRoom(boardId)).emit('presence:leave', {
        user: { id: user.id, name: user.name },
        boardId
      });
    });

    socket.on("presence_cursor", ({ boardId, x, y }) => {
      socket.to(boardRoom(boardId)).emit("presence_cursor_update", {
        user: { id: user.id, name: user.name },
        x,
        y,
      });
    });

    socket.on("disconnect", () => {
      for (const room of socket.rooms) {
        if (room === socket.id) continue;
        socket.to(room).emit('presence:leave', {
          user: { id: user.id, name: user.name },
        });
      }
    });
  });

  setIo(io);
  return io;
}; 
