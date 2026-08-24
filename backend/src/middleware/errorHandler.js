const errorHandler = (err, _req, res, _next) => {
  const status = err.statusCode || 500;

  if (status >= 500) {
    console.error("Server error: ", err);
  }

  if (err.code === "23505") {
    return res.status(400).json({ error: "Resource already exists" });
  }

  res.status(status).json({
    error: status >= 500 ? "Internal server error" : err.message,
  });
};

const notFoundHandler = (_req, res) => {
  res.status(404).json({ error: "Route not found" });
};

export { errorHandler, notFoundHandler };
