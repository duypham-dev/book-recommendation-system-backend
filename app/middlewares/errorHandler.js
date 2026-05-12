/**
 * Global Error Handler Middleware
 * Every response follows the ApiResponse shape:
 *   { success, message, code, errors? }
 */

import { isAppError } from '#utils/error.js';

const isDev = process.env.NODE_ENV !== 'production';

// Not-Found Handler
/**
 * notFoundHandler — returns 404 for any route that didn't match.
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
export const notFoundHandler = (req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`,
    code: 'NOT_FOUND',
  });
};

// Global Error Handler
/**
 * errorHandler — central error-handling middleware for Express.
 *
 * @param {Error}                       err
 * @param {import('express').Request}   req
 * @param {import('express').Response}  res
 * @param {import('express').NextFunction} next
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  console.log("ERROR HANDLER: ", err);
  
  if (isAppError(err)) {
    const body = {
      success: false,
      message: err.message,
      code: err.code || 'APP_ERROR',
    };

    // ValidationError and some others carry an `errors` / `details` array
    const detail = err.errors ?? err.details;
    if (Array.isArray(detail) && detail.length > 0) {
      body.errors = detail;
    }

    return res.status(err.statusCode).json(body);
  }

  // JWT errors
  // jsonwebtoken throws named errors — map them all to 401 Unauthorized.
  const jwtErrors = ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'];
  if (jwtErrors.includes(err.name)) {
    const messages = {
      TokenExpiredError: 'Token has expired. Please log in again.',
      NotBeforeError: 'Token is not yet active.',
      JsonWebTokenError: 'Invalid token. Please log in again.',
    };

    return res.status(401).json({
      success: false,
      message: messages[err.name] ?? 'Authentication error.',
      code: 'UNAUTHORIZED',
    });
  }

  // Prisma errors
  // Prisma error codes begin with "P". We map the most common ones;
  // everything else falls through to the 500 fallback below.
  if (err.code && typeof err.code === 'string' && err.code.startsWith('P')) {
    const prismaMap = {
      P2002: { status: 409, message: 'Data already exists.',            code: 'CONFLICT' },
      P2025: { status: 404, message: 'Record not found.',               code: 'NOT_FOUND' },
      P2003: { status: 400, message: 'Foreign key constraint violation.', code: 'BAD_REQUEST' },
      P2014: { status: 400, message: 'Invalid relationship.',           code: 'BAD_REQUEST' },
    };

    const mapped = prismaMap[err.code];
    if (mapped) {
      return res.status(mapped.status).json({
        success: false,
        message: mapped.message,
        code: mapped.code,
      });
    }
  }

  // Multer errors
  // Multer throws MulterError for file-size / file-type / field-name issues.
  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload error.',
      code: 'BAD_REQUEST',
    });
  }

  // Unknown or programmer errors.
  return res.status(500).json({
    success: false,
    message: isDev
      ? err.message || 'An unexpected error occurred.'
      : 'An unexpected error occurred. Please try again later.',
    code: 'INTERNAL_SERVER_ERROR',
    ...(isDev && { stack: err.stack }),
  });
};
