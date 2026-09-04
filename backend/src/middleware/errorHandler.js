/* 
This file contains two middleware functions:

errorHandler
→ handles errors thrown by the application

notFoundHandler
→ handles requests for routes that don't exist
*/

export const errorHandler = (err, _req, res, _next) => { // _req and _next mean those values are not being used
  const status = err.statusCode || 500;

  if (status >= 500) {
    console.error("Server error: ", err);
  }

  if (err.code === "23505") { // 23505 means a unique constraint violation, specific PostgreSQL error code
    return res.status(409).json({ error: "Resource already exists" });
  }

  res.status(status).json({
    error: status >= 500 ? "Internal server error" : err.message,
  });
};

export const notFoundHandler = (_req, res) => {
  res.status(404).json({ error: "Route not found" });
};
