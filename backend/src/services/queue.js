import { Queue, Worker } from "bullmq";
import { query } from "../config/db.js";
import { emitToBoard, logActivity } from "../realtime/index.js";
import * as aiService from "./aiService.js";
import { safeDel } from "../utils/cache.js";

// Helper to construct connection config for BullMQ (requires maxRetriesPerRequest: null)
const getRedisConnection = () => {
  const urlStr = process.env.REDIS_URL || "redis://localhost:6379";
  try {
    const parsed = new URL(urlStr);
    return {
      host: parsed.hostname || "127.0.0.1",
      port: Number(parsed.port) || 6379,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      tls: parsed.protocol === "rediss:" ? {} : undefined,
      maxRetriesPerRequest: null,
    };
  } catch {
    return { host: "127.0.0.1", port: 6379, maxRetriesPerRequest: null };
  }
};

const connection = getRedisConnection();

export const aiQueue = new Queue("ai-generation", { connection });

// Background Worker to process AI generation jobs
export const aiWorker = new Worker(
  "ai-generation",
  async (job) => {
    const { goal, count, boardId, columnId, userId, userName } = job.data;
    console.log(`[BullMQ Worker] Processing AI job ${job.id} for board ${boardId}`);

    // Call Gemini AI service
    const suggestions = await aiService.generateTasks(goal, count);

    // If a column was specified, persist tasks to PostgreSQL and broadcast in real-time
    if (columnId && boardId) {
      const colRes = await query(
        "SELECT id, title FROM columns WHERE id = $1 AND board_id = $2",
        [columnId, boardId],
      );

      if (colRes.rows.length) {
        const baseRes = await query(
          "SELECT COALESCE(MAX(position), 0) AS pos FROM tasks WHERE column_id = $1",
          [columnId],
        );
        let currentPos = Number(baseRes.rows[0].pos);
        const createdTasks = [];

        for (const task of suggestions) {
          currentPos += 1000;
          const { rows } = await query(
            `INSERT INTO tasks (
               board_id,
               column_id,
               title,
               description,
               priority,
               position,
               created_by
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
              boardId,
              columnId,
              task.title,
              task.description,
              task.priority,
              currentPos,
              userId || null,
            ],
          );
          createdTasks.push(rows[0]);
          emitToBoard(boardId, "task:created", rows[0]);
        }

        // Invalidate board Redis cache
        await safeDel(`board:${boardId}`);

        // Log board activity
        if (userId) {
          await logActivity({
            boardId,
            userId,
            action: "ai.tasks_generated",
            message: `${userName || "A user"} used AI to generate ${createdTasks.length} tasks in "${colRes.rows[0].title}"`,
            metadata: { goal, generatedCount: createdTasks.length },
          });
        }

        emitToBoard(boardId, "ai:completed", {
          jobId: job.id,
          boardId,
          columnId,
          tasksCount: createdTasks.length,
        });

        return { tasks: createdTasks, persisted: true };
      }
    }

    // Preview mode
    emitToBoard(boardId, "ai:preview", {
      jobId: job.id,
      tasks: suggestions,
      persisted: false,
    });

    return { tasks: suggestions, persisted: false };
  },
  { connection },
);

aiWorker.on("completed", (job) => {
  console.log(`[BullMQ Worker] Job ${job.id} completed successfully`);
});

aiWorker.on("error", (err) => {
  console.warn(`[BullMQ Worker] Queue worker connection warning:`, err.message);
});

aiWorker.on("failed", (job, err) => {
  console.error(`[BullMQ Worker] Job ${job?.id} failed:`, err.message);
});
