/**
 * Session Store Service
 * Redis-backed session management with hashed tokens and multi-device support
 * 
 * Key structure:
 *   - session:{userId}:{jti} → hashed refresh token + metadata
 *   - sessions:{userId} → SET of all jti's for this user (for logout-all)
 */
import crypto from 'crypto';
import { redisClient } from '#config/redis.js';
import { logger } from '#utils/logger.js';

import { TOKEN_EXPIRY } from '#utils/jwt.js';

// Session TTL in seconds (matches refresh token expiry)
const SESSION_TTL = TOKEN_EXPIRY.REFRESH_SECONDS;

/**
 * Hash a token using SHA-256 (one-way, for storage)
 * Never store raw refresh tokens
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a new session for a user
 * Supports multi-device: each login creates a new session with unique jti
 */
export async function createSession(userId, jti, refreshToken, metadata = {}) {
  const redis = redisClient.getClient();
  const hashedToken = hashToken(refreshToken);
  const sessionKey = `session:${userId}:${jti}`;
  const userSessionsKey = `sessions:${userId}`;

  const sessionData = {
    hashedToken,
    userId: String(userId),
    createdAt: Date.now(),
    userAgent: metadata.userAgent || 'unknown',
    ip: metadata.ip || 'unknown',
  };

  // Store session with TTL
  await redis.hSet(sessionKey, sessionData);
  await redis.expire(sessionKey, SESSION_TTL);

  // Track all sessions for this user (for logout-all)
  await redis.sAdd(userSessionsKey, jti);
  await redis.expire(userSessionsKey, SESSION_TTL);

  logger.info('Session created', { userId, jti });
  return sessionData;
}

/**
 * Validate a refresh token
 * Returns session data if valid, null if invalid/expired
 */
export async function validateSession(userId, jti, refreshToken) {
  const redis = redisClient.getClient();
  const sessionKey = `session:${userId}:${jti}`;

  const session = await redis.hGetAll(sessionKey);
  
  if (!session || !session.hashedToken) {
    logger.warn('Session not found', { userId, jti });
    return null;
  }

  // Compare hashed tokens
  const hashedToken = hashToken(refreshToken);
  if (session.hashedToken !== hashedToken) {
    logger.warn('Token mismatch - possible token theft', { userId, jti });
    // Security: Revoke all sessions on token mismatch (potential theft)
    await revokeAllSessions(userId);
    return null;
  }

  return session;
}

/**
 * Rotate refresh token (revoke old, create new)
 * Essential for security: prevents token reuse
 */
export async function rotateSession(userId, oldJti, newJti, newRefreshToken, metadata = {}) {
  // Revoke old session
  await revokeSession(userId, oldJti);
  
  // Create new session
  await createSession(userId, newJti, newRefreshToken, metadata);
  
  logger.info('Session rotated', { userId, oldJti, newJti });
}

/**
 * Revoke a single session (logout single device)
 */
export async function revokeSession(userId, jti) {
  const redis = redisClient.getClient();
  const sessionKey = `session:${userId}:${jti}`;
  const userSessionsKey = `sessions:${userId}`;

  await redis.del(sessionKey);
  await redis.sRem(userSessionsKey, jti);

  logger.info('Session revoked', { userId, jti });
}

/**
 * Revoke all sessions for a user (logout all devices)
 */
export async function revokeAllSessions(userId) {
  const redis = redisClient.getClient();
  const userSessionsKey = `sessions:${userId}`;

  // Get all session JTIs for this user
  const jtis = await redis.sMembers(userSessionsKey);

  // Delete all individual sessions
  const pipeline = redis.multi();
  for (const jti of jtis) {
    pipeline.del(`session:${userId}:${jti}`);
  }
  pipeline.del(userSessionsKey);
  await pipeline.exec();

  logger.info('All sessions revoked', { userId, count: jtis.length });
  return jtis.length;
}

/**
 * Get all active sessions for a user (for account management UI)
 */
export async function getUserSessions(userId) {
  const redis = redisClient.getClient();
  const userSessionsKey = `sessions:${userId}`;

  const jtis = await redis.sMembers(userSessionsKey);
  const sessions = [];

  for (const jti of jtis) {
    const session = await redis.hGetAll(`session:${userId}:${jti}`);
    if (session && session.createdAt) {
      sessions.push({
        jti,
        createdAt: parseInt(session.createdAt),
        userAgent: session.userAgent,
        ip: session.ip,
      });
    }
  }

  return sessions;
}

export const sessionStore = {
  hashToken,
  createSession,
  validateSession,
  rotateSession,
  revokeSession,
  revokeAllSessions,
  getUserSessions,
  SESSION_TTL,
};
