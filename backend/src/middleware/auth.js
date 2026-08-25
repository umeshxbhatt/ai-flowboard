import { verifyToken } from "../utils/jwt.js";
import ApiError from "../utils/ApiError.js";

const requireAuth = (req, _res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw ApiError.unauthorized("Missing authentication token");

    const decoded = verifyToken(token);
    req.user = { id: decoded.id, email: decoded.email, name: decoded.name };
    next();
  } catch (err) {
    if (err.isApiError) return next(err);
    next(ApiError.unauthorized("Invalid or expired token"));
  }
};

export default requireAuth;
