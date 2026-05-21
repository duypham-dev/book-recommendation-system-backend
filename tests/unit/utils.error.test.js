/**
 * tests/unit/utils.error.test.js
 * Unit tests for AppError hierarchy and ApiResponse.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  TooManyRequestsError,
  InternalServerError,
  DatabaseError,
  isAppError,
} from '../../app/utils/error.js';
import { ApiResponse } from '../../app/utils/response.js';
import { generateToken, hashToken } from '../../app/utils/token.util.js';

// ── AppError hierarchy ────────────────────────────────────────────────────
describe('AppError hierarchy', () => {
  it('AppError stores statusCode and message', () => {
    const err = new AppError('Something went wrong', 503);
    expect(err.message).toBe('Something went wrong');
    expect(err.statusCode).toBe(503);
    expect(err.isOperational).toBe(true);
    expect(err).toBeInstanceOf(Error);
  });

  it('BadRequestError has statusCode 400 and code BAD_REQUEST', () => {
    const err = new BadRequestError('Invalid param');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
  });

  it('UnauthorizedError has statusCode 401', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('ForbiddenError has statusCode 403', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('NotFoundError has statusCode 404', () => {
    const err = new NotFoundError('Book not found');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Book not found');
  });

  it('ConflictError has statusCode 409', () => {
    const err = new ConflictError();
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
  });

  it('ValidationError stores errors array', () => {
    const errors = [{ field: 'email', message: 'Required' }];
    const err = new ValidationError('Validation failed', errors);
    expect(err.statusCode).toBe(422);
    expect(err.errors).toEqual(errors);
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  it('TooManyRequestsError has statusCode 429', () => {
    const err = new TooManyRequestsError();
    expect(err.statusCode).toBe(429);
  });

  it('InternalServerError has statusCode 500', () => {
    const err = new InternalServerError();
    expect(err.statusCode).toBe(500);
  });

  it('DatabaseError maps Prisma P2002 to 409', () => {
    const prismaErr = new Error('Unique constraint');
    prismaErr.code = 'P2002';
    prismaErr.meta = { target: ['email'] };
    const err = new DatabaseError(prismaErr);
    expect(err.statusCode).toBe(409);
  });

  it('DatabaseError maps Prisma P2025 to 404', () => {
    const prismaErr = new Error('Not found');
    prismaErr.code = 'P2025';
    const err = new DatabaseError(prismaErr);
    expect(err.statusCode).toBe(404);
  });
});

// ── isAppError ────────────────────────────────────────────────────────────
describe('isAppError()', () => {
  it('returns true for AppError instances', () => {
    expect(isAppError(new NotFoundError())).toBe(true);
    expect(isAppError(new ValidationError())).toBe(true);
  });

  it('returns false for plain Error', () => {
    expect(isAppError(new Error('oops'))).toBe(false);
  });

  it('returns false for null / undefined', () => {
    expect(isAppError(null)).toBe(false);
    expect(isAppError(undefined)).toBe(false);
  });
});

// ── ApiResponse ───────────────────────────────────────────────────────────
describe('ApiResponse', () => {
  const mockRes = () => {
    const res = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  };

  it('success() sends 200 with success:true', () => {
    const res = mockRes();
    ApiResponse.success(res, { id: 1 }, 'Done');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Done',
      data: { id: 1 },
    });
  });

  it('error() sends correct status and success:false', () => {
    const res = mockRes();
    ApiResponse.error(res, 'Not found', 404);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Not found',
    });
  });

  it('created() sends 201', () => {
    const res = mockRes();
    ApiResponse.created(res, { id: 2 }, 'Created');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('error() includes errors array when provided', () => {
    const res = mockRes();
    const errors = [{ field: 'name' }];
    ApiResponse.error(res, 'Bad input', 400, errors);
    const arg = res.json.mock.calls[0][0];
    expect(arg.errors).toEqual(errors);
  });
});

// ── token.util.js ─────────────────────────────────────────────────────────
describe('token.util.js', () => {
  it('generateToken(32) returns a 64-char hex string', () => {
    const token = generateToken(32);
    expect(typeof token).toBe('string');
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generateToken produces different values each call', () => {
    const t1 = generateToken(32);
    const t2 = generateToken(32);
    expect(t1).not.toBe(t2);
  });

  it('hashToken produces consistent SHA-256 hex', () => {
    const plain = 'my-test-token';
    const h1 = hashToken(plain);
    const h2 = hashToken(plain);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashToken of different inputs produces different hashes', () => {
    expect(hashToken('abc')).not.toBe(hashToken('xyz'));
  });
});