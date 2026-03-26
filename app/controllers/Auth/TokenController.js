/**
 * Token Controller
 * Handles refresh token rotation with Redis-backed sessions
 */
import { ApiResponse, logger } from '#utils/index.js';
import "dotenv/config";
import { 
  signAccessToken, 
  signRefreshToken, 
  refreshCookieOptions,
  verifyRefreshToken,
  TOKEN_EXPIRY 
} from '#utils/jwt.js';
import { authService } from "#services/authService.js";
import { sessionStore } from "#services/sessionStore.js";

/**
 * Extract client metadata for session tracking
 */
function getClientMetadata(req) {
  return {
    userAgent: req.headers['user-agent'] || 'unknown',
    ip: req.ip || req.connection?.remoteAddress || 'unknown',
  };
}

/**
 * POST /auth/refresh - Refresh access token
 * Implements token rotation: old token revoked, new token issued
 */
export async function refreshTokenHandler(req, res) {
  const token = req.cookies?.refreshToken;
  
  if (!token) {
    return ApiResponse.error(res, 'Refresh token missing', 401);
  }
  
  try {
    // Verify JWT signature and expiry
    const decoded = verifyRefreshToken(token);
    const userId = decoded.sub;
    const oldJti = decoded.jti;
    
    // Validate session exists in Redis (and token matches hash)
    const session = await sessionStore.validateSession(userId, oldJti, token);
    
    if (!session) {
      // Session revoked or token mismatch (potential theft detected)
      return ApiResponse.error(res, 'Session invalid or expired', 401);
    }
    
    // Fetch fresh user data from database
    const user = await authService.getUserById(userId);
    
    if (!user) {
      logger.warn('Refresh: User not found', { userId });
      await sessionStore.revokeSession(userId, oldJti);
      return ApiResponse.error(res, 'User not found', 404);
    }
    
    // Check if user is banned
    if (user.isBan) {
      logger.warn('Refresh: User banned', { userId });
      await sessionStore.revokeAllSessions(userId);
      return ApiResponse.error(res, 'Account suspended', 403);
    }
    
    // Build payload for new tokens
    const userPayload = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role || 'user',
      avatarUrl: user.avatarUrl || null,
    };
    
    // Generate new tokens
    const { refreshToken: newRefreshToken, refreshTokenId: newJti } = signRefreshToken(userId);
    const { accessToken } = signAccessToken(userPayload);
    
    // Rotate session: revoke old, create new (atomic operation)
    const metadata = getClientMetadata(req);
    await sessionStore.rotateSession(userId, oldJti, newJti, newRefreshToken, metadata);
    
    // Set new refresh token cookie
    res.cookie("refreshToken", newRefreshToken, refreshCookieOptions());
    
    logger.info('Token refreshed', { userId, oldJti, newJti });
    logger.debug('New access token issued', { userId, expiresIn: TOKEN_EXPIRY.ACCESS });
    return ApiResponse.success(res, { 
      accessToken,
      expiresIn: TOKEN_EXPIRY.ACCESS,
    }, 'Token refreshed successfully');
    
  } catch (err) {
    // JWT verification failed (expired, invalid signature, etc.)
    logger.warn('Refresh token invalid', { error: err.message });
    return ApiResponse.error(res, 'Invalid or expired refresh token', 401);
  }
}