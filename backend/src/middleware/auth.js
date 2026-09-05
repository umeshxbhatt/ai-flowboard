import { verifyToken } from "../utils/jwt.js";
import ApiError from "../utils/ApiError.js";

// Express middleware function.
// Check authentication before allowing the request to reach the controller.

const requireAuth = (req, _res, next) => {
  try {
    // get the authorization header from the request
    const header = req.headers.authorization || "";

    // check if header starts with "Bearer " and extract the token
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw ApiError.unauthorized("Missing authentication token");

    // verify the token and extract the payload in decoded
    const decoded = verifyToken(token);

    // store user info in req.user so that the controller can access it
    req.user = { id: decoded.id, email: decoded.email, name: decoded.name };

    next(); // Authentication succeeded. Let the request continue to the next middleware/controller.
  } catch (err) {
    if (err.isApiError) return next(err); // checks: Is this already one of my custom API errors? If yes, pass the same error to Express

    // Handle invalid/expired JWT
    next(ApiError.unauthorized("Invalid or expired token"));
  }
};

export default requireAuth;
