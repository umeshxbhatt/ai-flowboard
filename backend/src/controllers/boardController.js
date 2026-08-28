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
