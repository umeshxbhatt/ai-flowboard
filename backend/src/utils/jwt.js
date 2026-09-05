import jwt from "jsonwebtoken";

// Create token
export const signToken = (payload) => {
  // payload is the data we want to put inside the token

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

  // jwt.sign(payload, secret, options)
  // Create a JWT using this payload, sign it with my secret, and make it expire after the configured amount of time (or 7 days by default).
};

// Checks token
export const verifyToken = (token) => jwt.verify(token, process.env.JWT_SECRET);
