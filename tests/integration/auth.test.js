/**
 * tests/integration/auth.test.js
 * Integration tests for all /auth/* endpoints.
 * Prisma and Redis are mocked via tests/setup/global.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app/index.js';
import { prisma } from '../../app/lib/prisma.js';
import { redisClient } from '../../app/config/redis.js';
import { rabbitmq } from '../../app/config/rabbitmq.js';
import { makeDbUser } from '../setup/factories.js';
import { signAccessToken, signRefreshToken } from '../../app/utils/jwt.js';
import bcrypt from 'bcrypt';

const BASE = '/api/v1';

// ── Helpers ───────────────────────────────────────────────────────────────


// A pre-hashed password for 'Password1'
let hashedPassword;

beforeEach(async () => {
  hashedPassword = await bcrypt.hash('Password1', 1);
});

// ── POST /auth/login ──────────────────────────────────────────────────────
describe('POST /auth/login', () => {
  it('200 – logs in with valid email + password', async () => {
    const user = makeDbUser({ is_activate: true, is_ban: false });
    user.password = hashedPassword;

    prisma.users.findFirst.mockResolvedValue(user);
    redisClient.getClient().hSet.mockResolvedValue(1);
    redisClient.getClient().expire.mockResolvedValue(1);
    redisClient.getClient().sAdd.mockResolvedValue(1);

    const res = await request(app)
      .post(`${BASE}/auth/login`)
      .send({ identifier: user.email, password: 'Password1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
  });

  it('401 – wrong password', async () => {
    const user = makeDbUser({ is_activate: true, is_ban: false });
    user.password = hashedPassword;
    prisma.users.findFirst.mockResolvedValue(user);

    const res = await request(app)
      .post(`${BASE}/auth/login`)
      .send({ identifier: user.email, password: 'WrongPass1' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('401 – user not found', async () => {
    prisma.users.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post(`${BASE}/auth/login`)
      .send({ identifier: 'nobody@example.com', password: 'Password1' });

    expect(res.status).toBe(401);
  });

  it('403 – banned user cannot login', async () => {
    const user = makeDbUser({ is_ban: true, is_activate: true });
    user.password = hashedPassword;
    prisma.users.findFirst.mockResolvedValue(user);

    const res = await request(app)
      .post(`${BASE}/auth/login`)
      .send({ identifier: user.email, password: 'Password1' });

    expect(res.status).toBe(403);
  });

  it('403 – inactive account cannot login', async () => {
    const user = makeDbUser({ is_activate: false, is_ban: false });
    user.password = hashedPassword;
    prisma.users.findFirst.mockResolvedValue(user);

    const res = await request(app)
      .post(`${BASE}/auth/login`)
      .send({ identifier: user.email, password: 'Password1' });

    expect(res.status).toBe(403);
  });

  it('422 – missing identifier or password', async () => {
    const res = await request(app)
      .post(`${BASE}/auth/login`)
      .send({ password: 'Password1' });

    expect(res.status).toBe(422);
  });
});

// ── POST /auth/register ───────────────────────────────────────────────────
describe('POST /auth/register', () => {
  const validPayload = {
    email: 'new@example.com',
    password: 'Password1',
    confirmPassword: 'Password1',
    username: 'newuser01',
    fullName: 'New User',
    phoneNumber: '0912345678',
  };

  it('201 – registers a new user and enqueues activation email', async () => {
    prisma.users.findMany.mockResolvedValue([]);      // no existing users
    prisma.roles.findUnique.mockResolvedValue({ role_id: 2n, role_name: 'USER' });
    prisma.users.create.mockResolvedValue(makeDbUser({ email: validPayload.email }));
    prisma.users.findUnique.mockResolvedValue(null);  // no existing token user
    prisma.user_tokens.deleteMany.mockResolvedValue({ count: 0 });
    prisma.user_tokens.create.mockResolvedValue({});
    rabbitmq.publish.mockReturnValue(true);

    const res = await request(app)
      .post(`${BASE}/auth/register`)
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('409 – duplicate email', async () => {
    const existing = makeDbUser({ email: validPayload.email });
    prisma.users.findMany.mockResolvedValue([existing]);

    const res = await request(app)
      .post(`${BASE}/auth/register`)
      .send(validPayload);

    expect(res.status).toBe(409);
  });

  it('422 – invalid email format', async () => {
    const res = await request(app)
      .post(`${BASE}/auth/register`)
      .send({ ...validPayload, email: 'invalid-email' });

    expect(res.status).toBe(422);
  });

  it('422 – passwords do not match', async () => {
    const res = await request(app)
      .post(`${BASE}/auth/register`)
      .send({ ...validPayload, confirmPassword: 'Different1' });

    expect(res.status).toBe(422);
  });

  it('422 – missing required fields', async () => {
    const res = await request(app)
      .post(`${BASE}/auth/register`)
      .send({});

    expect(res.status).toBe(422);
  });
});

// ── POST /auth/refresh ────────────────────────────────────────────────────
describe('POST /auth/refresh', () => {
  it('200 – returns new accessToken with valid refresh cookie', async () => {
    const user = makeDbUser();
    const { refreshToken } = signRefreshToken(user.user_id.toString());

    // Mock Redis session lookup
    const redis = redisClient.getClient();
    redis.hGetAll.mockResolvedValue({
      hashedToken: require('crypto')
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex'),
      userId: user.user_id.toString(),
      createdAt: Date.now().toString(),
    });
    redis.sMembers.mockResolvedValue(['some-jti']);

    // Mock DB user lookup
    prisma.users.findUnique.mockResolvedValue(user);

    // Session rotation mocks
    redis.del.mockResolvedValue(1);
    redis.sRem.mockResolvedValue(1);
    redis.hSet.mockResolvedValue(1);
    redis.expire.mockResolvedValue(1);
    redis.sAdd.mockResolvedValue(1);

    const res = await request(app)
      .post(`${BASE}/auth/refresh`)
      .set('Cookie', `refreshToken=${refreshToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
  });

  it('401 – no refresh token cookie', async () => {
    const res = await request(app).post(`${BASE}/auth/refresh`);
    expect(res.status).toBe(401);
  });

  it('401 – invalid/tampered refresh token', async () => {
    const res = await request(app)
      .post(`${BASE}/auth/refresh`)
      .set('Cookie', 'refreshToken=bad.token.here');
    expect(res.status).toBe(401);
  });
});

// ── POST /auth/logout ─────────────────────────────────────────────────────
describe('POST /auth/logout', () => {
  it('200 – clears cookie even without token', async () => {
    const res = await request(app).post(`${BASE}/auth/logout`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('200 – revokes session when valid refresh token present', async () => {
    const user = makeDbUser();
    const { refreshToken } = signRefreshToken(user.user_id.toString());
    const redis = redisClient.getClient();
    redis.del.mockResolvedValue(1);
    redis.sRem.mockResolvedValue(1);

    const res = await request(app)
      .post(`${BASE}/auth/logout`)
      .set('Cookie', `refreshToken=${refreshToken}`);

    expect(res.status).toBe(200);
  });
});

// ── POST /auth/forgot-password ────────────────────────────────────────────
describe('POST /auth/forgot-password', () => {
  it('200 – always returns success (email enumeration prevention)', async () => {
    prisma.users.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post(`${BASE}/auth/forgot-password`)
      .send({ email: 'nobody@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('200 – enqueues reset email for existing active user', async () => {
    const user = makeDbUser({ is_activate: true, is_ban: false });
    prisma.users.findUnique.mockResolvedValue(user);
    prisma.user_tokens.deleteMany.mockResolvedValue({ count: 0 });
    prisma.user_tokens.create.mockResolvedValue({});
    rabbitmq.publish.mockReturnValue(true);

    const res = await request(app)
      .post(`${BASE}/auth/forgot-password`)
      .send({ email: user.email });

    expect(res.status).toBe(200);
  });

  it('422 – invalid email format', async () => {
    const res = await request(app)
      .post(`${BASE}/auth/forgot-password`)
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(422);
  });
});

// ── GET /auth/profile ─────────────────────────────────────────────────────
describe('GET /auth/profile', () => {
  it('200 – returns user from JWT claims', async () => {
    const user = makeDbUser();
    const { accessToken } = signAccessToken({
      userId: user.user_id.toString(),
      email: user.email,
      fullName: user.full_name,
      role: 'USER',
      avatarUrl: null,
    });

    const res = await request(app)
      .get(`${BASE}/auth/profile`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(user.email);
  });

  it('401 – no token', async () => {
    const res = await request(app).get(`${BASE}/auth/profile`);
    expect(res.status).toBe(401);
  });

  it('401 – invalid token', async () => {
    const res = await request(app)
      .get(`${BASE}/auth/profile`)
      .set('Authorization', 'Bearer bad.jwt.token');
    expect(res.status).toBe(401);
  });
});

// ── POST /auth/activate ───────────────────────────────────────────────────
describe('POST /auth/activate', () => {
  it('200 – activates account with valid token', async () => {
    const user = makeDbUser({ is_activate: false });
    const tokenRecord = {
      token_id: 1n,
      user_id: user.user_id,
      token: 'hashed',
      type: 'EMAIL_VERIFICATION',
      expires_at: new Date(Date.now() + 10 * 60 * 1000),
    };
    prisma.user_tokens.findFirst.mockResolvedValue(tokenRecord);
    prisma.$transaction.mockImplementation(async (fn) =>
      fn({
        users: { update: vi.fn().mockResolvedValue(user) },
        user_tokens: { delete: vi.fn().mockResolvedValue({}) },
      })
    );

    const res = await request(app)
      .post(`${BASE}/auth/activate`)
      .send({ token: 'some-plain-token' });

    expect(res.status).toBe(200);
  });

  it('400 – invalid or expired token', async () => {
    prisma.user_tokens.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post(`${BASE}/auth/activate`)
      .send({ token: 'expired-token' });

    expect(res.status).toBe(400);
  });
});