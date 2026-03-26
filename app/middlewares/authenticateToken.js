/**
 * Authentication Middleware
 * Verifies JWT access tokens from Authorization header
 */
import { ApiResponse } from "#utils/index.js";
import { verifyAccessToken } from "#utils/jwt.js";

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>
  
  if (!token) {
    return ApiResponse.error(res, 'Access token is missing', 401);
  }

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("authenticateToken error:", err.message);
    // Token expired or invalid
    return ApiResponse.error(res, 'Invalid or expired access token authenticateToken', 401);
  }
};
