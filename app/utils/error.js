//Define AppError class to handle errors
export class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Bad Request Error (400)
 * Malformed request syntax, invalid parameters, missing required fields.
 */
export class BadRequestError extends AppError {
  constructor(message = 'Bad Request') {
    super(message, 400);
    this.code = 'BAD_REQUEST';
  }
}

/**
 * Unauthorized Error (401)
 * Missing or invalid authentication credentials.
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
    this.code = 'UNAUTHORIZED';
  }
}

/**
 * Forbidden Error (403)
 * Authenticated but lacking permission to access the resource.
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
    this.code = 'FORBIDDEN';
  }
}

/**
 * Not Found Error (404)
 * Requested resource does not exist.
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
    this.code = 'NOT_FOUND';
  }
}

/**
 * Conflict Error (409)
 * Request conflicts with current state (e.g. duplicate unique field).
 */
export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409);
    this.code = 'CONFLICT';
  }
}

/**
 * Validation Error (422)
 * Request body failed schema / business-rule validation.
 * The `errors` array carries field-level detail for the client.
 */
export class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = []) {
    super(message, 422);
    this.code = 'VALIDATION_ERROR';
    this.errors = errors;
  }
}

/**
 * Too Many Requests Error (429)
 * Client has exceeded the allowed rate limit.
 */
export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests. Please try again later.') {
    super(message, 429);
    this.code = 'TOO_MANY_REQUESTS';
  }
}

/**
 * Internal Server Error (500)
 * Generic server-side error when no more specific class applies.
 */
export class InternalServerError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 500);
    this.code = 'INTERNAL_SERVER_ERROR';
  }
}

/**
 * Database Error
 * Wraps Prisma / ORM errors and maps them to the appropriate HTTP status.
 * Keeps the original error attached for server-side logging.
 */
export class DatabaseError extends AppError {
  constructor(error) {
    let message = 'Database operation failed';
    let statusCode = 500;

    // Prisma-specific error codes
    if (error.code === 'P2002') {
      // Unique constraint violation
      const field = error.meta?.target?.[0] || 'field';
      message = `${field} already exists`;
      statusCode = 409;
    } else if (error.code === 'P2025') {
      // Record not found
      message = 'Record not found';
      statusCode = 404;
    } else if (error.code === 'P2003') {
      // Foreign key constraint failed
      message = 'Related record not found';
      statusCode = 400;
    } else if (error.code === 'P2014') {
      // Required relation violation
      message = 'Invalid relationship';
      statusCode = 400;
    }

    super(message, statusCode);
    this.code = 'DATABASE_ERROR';
    this.originalError = error;
  }
}

/**
 * Handle Prisma Errors
 * Converts a raw Prisma error into a DatabaseError (AppError subclass)
 * so the global handler can treat it uniformly.
 */
export function handlePrismaError(error) {
  if (error.code && error.code.startsWith('P')) {
    return new DatabaseError(error);
  }
  return error;
}

/**
 * isAppError
 * Type-guard helper — returns true when the value is an instance of AppError.
 * Use this in the global handler to distinguish operational errors from bugs.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export function isAppError(error) {
  return error instanceof AppError;
}
