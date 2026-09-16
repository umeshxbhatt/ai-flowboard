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
