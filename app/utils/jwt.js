/**
 * JWT Utilities
 * Production-grade token signing with proper TTLs and security settings
 */
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import "dotenv/config";

// Token expiration times
// IMPORTANT: Use string format with explicit unit suffix so the `ms` library
// inside jsonwebtoken never misinterprets a bare number-string as milliseconds.
// e.g. "60" (string) → 60 ms !!  vs  "2m" → 2 minutes  vs  120 (number) → 120 s
export const TOKEN_EXPIRY = {
  ACCESS: "2m",                // 2 minutes  (string with unit → ms library parses correctly)
  REFRESH: "7d",               // 7 days
  ACCESS_SECONDS: 2 * 60,     // numeric form for non-jwt uses (cookie maxAge, frontend hint)
  REFRESH_SECONDS: 7 * 24 * 60 * 60,
};

/**
 * Generate a cryptographically secure random ID
 */
export function generateJti() {
  return crypto.randomUUID();
}

/**
 * Sign an access token (short-lived, contains user claims)
 */
export function signAccessToken(user) {
  const jti = generateJti();

  // const payload = {
  //   userId: user.userId,
  //   email: user.email,
  //   fullName: user.fullName,
  //   role: user.role,
  // };

  const accessToken = jwt.sign(
    user,
    process.env.JWT_ACCESS_SECRECT,
    {
      expiresIn: TOKEN_EXPIRY.ACCESS, // "2m" string with unit — safe from ms() misparse
      subject: String(user.userId),
      issuer: "tekbook-api",
      audience: "tekbook-client",
      jwtid: jti,
    }
  );

  return { accessToken, accessTokenId: jti };
}

/**
 * Sign a refresh token (long-lived, minimal payload)
 * Only contains type claim; user info retrieved from Redis session
 */
export function signRefreshToken(userId) {
  const jti = generateJti();

  const refreshToken = jwt.sign(
    { type: 'refresh' },
    process.env.JWT_REFRESH_SECRECT,
    {
      expiresIn: TOKEN_EXPIRY.REFRESH, // "7d" string with unit
      subject: String(userId),
      issuer: "tekbook-api",
      audience: "tekbook-client",
      jwtid: jti,
    }
  );

  return { refreshToken, refreshTokenId: jti };
}

/**
 * Verify and decode a refresh token
 * Returns decoded payload or throws error
 */
export function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRECT, {
    issuer: "tekbook-api",
    audience: "tekbook-client",
  });
}

/**
 * Verify and decode an access token
 * Returns decoded payload or throws error
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRECT, {
    issuer: "tekbook-api",
    audience: "tekbook-client",
  });
}

/**
 * Cookie options for refresh token
 * HttpOnly prevents XSS, Secure ensures HTTPS in production
 */
export function refreshCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,                    // Not accessible via JavaScript
    secure: isProd,                    // HTTPS only in production
    sameSite: isProd ? "none" : "lax", // CSRF protection
    path: "/api/v1/auth",              // Only sent to auth endpoints
    maxAge: TOKEN_EXPIRY.REFRESH_SECONDS * 1000, // Match token expiry (in ms)
  };
}

/**
 * Options to clear refresh token cookie on logout
 */
export function clearRefreshCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/api/v1/auth",
  };
}
