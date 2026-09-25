import { query } from "../config/db.js";
import asyncHandler from "../utils/asyncHandler.js";

/*
  Search for users by name or email.
  If boardId is provided in the query string, it limits the search to members of that specific board.
  This is useful for dropdowns when assigning tasks or inviting members.
*/
export const searchUsers = asyncHandler(async (req, res) => {
  const searchTerm = (req.query.q || "").trim();
  const boardId = req.query.boardId;

  // If the search term is empty or too short, return an empty array to save database resources
  if (searchTerm.length < 2) {
    return res.json({ users: [] });
  }

  const queryParams = [`%${searchTerm}%`];

  let sql = `
    SELECT id, name, email, avatar_url 
    FROM users 
    WHERE (name ILIKE $1 OR email ILIKE $1)
  `;

  // If we are searching for someone to assign to a task, we only want existing board members
  if (boardId) {
    sql = `
      SELECT u.id, u.name, u.email, u.avatar_url 
      FROM users u
      JOIN board_members bm ON u.id = bm.user_id
      WHERE bm.board_id = $2 AND (u.name ILIKE $1 OR u.email ILIKE $1)
    `;
    queryParams.push(boardId);
  }

  // Limit results so we don't overwhelm the frontend with thousands of users
  sql += ` ORDER BY name ASC LIMIT 10`;

  const { rows } = await query(sql, queryParams);

  res.json({ users: rows });
});

/*
  Get all members across all boards the logged-in user belongs to.
  Aggregates unique members and lists the boards they share with the current user.
*/
export const getWorkspaceMembers = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT DISTINCT u.id, u.name, u.email, u.avatar_url, bm.role, b.title AS board_title
     FROM users u
     JOIN board_members bm ON bm.user_id = u.id
     JOIN boards b ON b.id = bm.board_id
     WHERE b.id IN (
       SELECT board_id FROM board_members WHERE user_id = $1
       UNION
       SELECT id FROM boards WHERE owner_id = $1
     )
     ORDER BY u.name ASC`,
    [req.user.id],
  );

  // Group by user id and aggregate board titles
  const memberMap = new Map();
  for (const row of rows) {
    if (!memberMap.has(row.id)) {
      memberMap.set(row.id, {
        id: row.id,
        name: row.name,
        email: row.email,
        avatar_url: row.avatar_url,
        role: row.role,
        boards: [row.board_title],
      });
    } else {
      const existing = memberMap.get(row.id);
      if (!existing.boards.includes(row.board_title)) {
        existing.boards.push(row.board_title);
      }
    }
  }

  res.json({ members: Array.from(memberMap.values()) });
});
