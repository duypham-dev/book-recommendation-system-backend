/**
 * tests/integration/profile.test.js
 * Integration tests for user profile, avatar, and password change endpoints.
 */
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../app/index.js';
import { prisma } from '../../app/lib/prisma.js';
import { makeDbUser } from '../setup/factories.js';
import { signAccessToken } from '../../app/utils/jwt.js';
import bcrypt from 'bcrypt';

const BASE = '/api/v1';

const authHeader = (userId = '1', role = 'USER', extra = {}) => {
  const { accessToken } = signAccessToken({
    userId,
    email: 'user@example.com',
    fullName: 'Test User',
    role,
    avatarUrl: null,
    ...extra,
  });
  return { Authorization: `Bearer ${accessToken}` };
};

// ── GET /users/profile ────────────────────────────────────────────────────
describe('GET /users/profile', () => {
  it('200 – returns user profile', async () => {
    const user = makeDbUser();
    prisma.users.findUnique.mockResolvedValue(user);

    const res = await request(app)
      .get(`${BASE}/users/profile`)
      .set(authHeader(user.user_id.toString()));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('email');
    expect(res.body.data).toHaveProperty('username');
  });

  it('401 – not authenticated', async () => {
    const res = await request(app).get(`${BASE}/users/profile`);
    expect(res.status).toBe(401);
  });

  it('404 – user not found in DB', async () => {
    prisma.users.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get(`${BASE}/users/profile`)
      .set(authHeader('99999'));

    expect(res.status).toBe(404);
  });
});

// ── PUT /users/profile ────────────────────────────────────────────────────
describe('PUT /users/profile', () => {
  it('200 – updates profile fields', async () => {
    const user = makeDbUser();
    // No duplicate username/phone
    prisma.users.findMany.mockResolvedValue([]);
    prisma.users.update.mockResolvedValue({ ...user, full_name: 'Updated Name' });

    const res = await request(app)
      .put(`${BASE}/users/profile`)
      .set(authHeader(user.user_id.toString()))
      .send({ fullName: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken'); // new token issued
  });

  it('400 – duplicate username', async () => {
    const other = makeDbUser({ username: 'takenuser' });
    prisma.users.findMany.mockResolvedValue([other]);

    const res = await request(app)
      .put(`${BASE}/users/profile`)
      .set(authHeader('1'))
      .send({ username: 'takenuser' });

    expect(res.status).toBe(400);
  });

  it('401 – not authenticated', async () => {
    const res = await request(app)
      .put(`${BASE}/users/profile`)
      .send({ fullName: 'New Name' });
    expect(res.status).toBe(401);
  });
});

// ── PATCH /users/change-password ──────────────────────────────────────────
describe('PATCH /users/change-password', () => {
  it('200 – changes password with correct current password', async () => {
    const hashedCurrent = await bcrypt.hash('OldPass123', 1);
    prisma.users.findUnique.mockResolvedValue({ password: hashedCurrent });
    prisma.users.update.mockResolvedValue({});

    const res = await request(app)
      .patch(`${BASE}/users/change-password`)
      .set(authHeader('1'))
      .send({
        currentPassword: 'OldPass123',
        newPassword: 'NewPass1',
      });

    expect(res.status).toBe(200);
  });

  it('401 – wrong current password', async () => {
    const hashedCurrent = await bcrypt.hash('OldPass123', 1);
    prisma.users.findUnique.mockResolvedValue({ password: hashedCurrent });

    const res = await request(app)
      .patch(`${BASE}/users/change-password`)
      .set(authHeader('1'))
      .send({
        currentPassword: 'WrongPass1',
        newPassword: 'NewPass1',
      });

    expect(res.status).toBe(401);
  });

  it('422 – new password too weak', async () => {
    const res = await request(app)
      .patch(`${BASE}/users/change-password`)
      .set(authHeader('1'))
      .send({
        currentPassword: 'OldPass123',
        newPassword: 'weak',
      });

    expect(res.status).toBe(422);
  });
});

// ── GET /auth/sessions ────────────────────────────────────────────────────
describe('GET /auth/sessions', () => {
  it('200 – returns active sessions', async () => {
    const redis = (await import('../../app/config/redis.js')).redisClient.getClient();
    redis.sMembers.mockResolvedValue(['jti-1']);
    redis.hGetAll.mockResolvedValue({
      createdAt: Date.now().toString(),
      userAgent: 'Test Browser',
      ip: '127.0.0.1',
    });

    const res = await request(app)
      .get(`${BASE}/auth/sessions`)
      .set(authHeader('1'));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('sessions');
  });

  it('401 – not authenticated', async () => {
    const res = await request(app).get(`${BASE}/auth/sessions`);
    expect(res.status).toBe(401);
  });
});

// ── POST /auth/logout-all ─────────────────────────────────────────────────
describe('POST /auth/logout-all', () => {
  it('200 – revokes all sessions', async () => {
    const redis = (await import('../../app/config/redis.js')).redisClient.getClient();
    redis.sMembers.mockResolvedValue(['jti-1', 'jti-2']);
    redis.multi.mockReturnValue({
      del: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    });

    const res = await request(app)
      .post(`${BASE}/auth/logout-all`)
      .set(authHeader('1'));

    expect(res.status).toBe(200);
  });

  it('401 – not authenticated', async () => {
    const res = await request(app).post(`${BASE}/auth/logout-all`);
    expect(res.status).toBe(401);
  });
});