/**
 * tests/unit/utils.jwt.test.js
 * Unit tests for JWT sign / verify utilities.
 */
import { describe, it, expect } from 'vitest';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  refreshCookieOptions,
  clearRefreshCookieOptions,
  TOKEN_EXPIRY,
} from '../../app/utils/jwt.js';

const userPayload = {
  userId: '42',
  email: 'test@example.com',
  fullName: 'Test User',
  role: 'USER',
  avatarUrl: null,
};

describe('JWT Utilities', () => {
  // ── signAccessToken ──────────────────────────────────────────────────────
  describe('signAccessToken()', () => {
    it('returns an accessToken string', () => {
      const { accessToken } = signAccessToken(userPayload);
      expect(typeof accessToken).toBe('string');
      expect(accessToken.split('.')).toHaveLength(3); // header.payload.sig
    });

    it('returns an accessTokenId (jti uuid)', () => {
      const { accessTokenId } = signAccessToken(userPayload);
      expect(typeof accessTokenId).toBe('string');
      expect(accessTokenId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('generates unique jti on each call', () => {
      const { accessTokenId: jti1 } = signAccessToken(userPayload);
      const { accessTokenId: jti2 } = signAccessToken(userPayload);
      expect(jti1).not.toBe(jti2);
    });
  });

  // ── verifyAccessToken ────────────────────────────────────────────────────
  describe('verifyAccessToken()', () => {
    it('decodes a valid access token', () => {
      const { accessToken } = signAccessToken(userPayload);
      const decoded = verifyAccessToken(accessToken);

      expect(decoded.userId).toBe(userPayload.userId);
      expect(decoded.email).toBe(userPayload.email);
      expect(decoded.role).toBe(userPayload.role);
    });

    it('throws on invalid token', () => {
      expect(() => verifyAccessToken('not.a.token')).toThrow();
    });

    it('throws on token signed with wrong secret', async () => {
      const jwt = await import('jsonwebtoken');
      const bad = jwt.default.sign({ userId: '1' }, 'wrong-secret', { expiresIn: '1m' });
      expect(() => verifyAccessToken(bad)).toThrow();
    });

    it('throws JsonWebTokenError on malformed token', () => {
      try {
        verifyAccessToken('bad.token.here');
      } catch (err) {
        expect(['JsonWebTokenError', 'SyntaxError']).toContain(err.name);
      }
    });
  });

  // ── signRefreshToken ─────────────────────────────────────────────────────
  describe('signRefreshToken()', () => {
    it('returns a refreshToken string and refreshTokenId', () => {
      const { refreshToken, refreshTokenId } = signRefreshToken('42');
      expect(typeof refreshToken).toBe('string');
      expect(refreshToken.split('.')).toHaveLength(3);
      expect(typeof refreshTokenId).toBe('string');
    });

    it('refresh token payload contains type=refresh', () => {
      const { refreshToken } = signRefreshToken('42');
      const decoded = verifyRefreshToken(refreshToken);
      expect(decoded.type).toBe('refresh');
    });

    it('refresh token sub is the userId string', () => {
      const { refreshToken } = signRefreshToken('99');
      const decoded = verifyRefreshToken(refreshToken);
      expect(decoded.sub).toBe('99');
    });
  });

  // ── verifyRefreshToken ───────────────────────────────────────────────────
  describe('verifyRefreshToken()', () => {
    it('decodes a valid refresh token', () => {
      const { refreshToken } = signRefreshToken('42');
      const decoded = verifyRefreshToken(refreshToken);
      expect(decoded.sub).toBe('42');
      expect(decoded.iss).toBe('tekbook-api');
    });

    it('throws on tampered token', () => {
      const { refreshToken } = signRefreshToken('42');
      const tampered = refreshToken.slice(0, -3) + 'xxx';
      expect(() => verifyRefreshToken(tampered)).toThrow();
    });
  });

  // ── Token Expiry constants ────────────────────────────────────────────────
  describe('TOKEN_EXPIRY', () => {
    it('has ACCESS_SECONDS = 15 * 60', () => {
      expect(TOKEN_EXPIRY.ACCESS_SECONDS).toBe(15 * 60);
    });

    it('has REFRESH_SECONDS = 7 * 24 * 60 * 60', () => {
      expect(TOKEN_EXPIRY.REFRESH_SECONDS).toBe(7 * 24 * 60 * 60);
    });
  });

  // ── Cookie options ────────────────────────────────────────────────────────
  describe('refreshCookieOptions()', () => {
    it('sets httpOnly, secure, sameSite=none', () => {
      const opts = refreshCookieOptions();
      expect(opts.httpOnly).toBe(true);
      expect(opts.secure).toBe(true);
      expect(opts.sameSite).toBe('none');
    });

    it('maxAge matches REFRESH_SECONDS in ms', () => {
      const opts = refreshCookieOptions();
      expect(opts.maxAge).toBe(TOKEN_EXPIRY.REFRESH_SECONDS * 1000);
    });
  });

  describe('clearRefreshCookieOptions()', () => {
    it('returns httpOnly + secure options without maxAge', () => {
      const opts = clearRefreshCookieOptions();
      expect(opts.httpOnly).toBe(true);
      expect(opts.secure).toBe(true);
      expect(opts.maxAge).toBeUndefined();
    });
  });
});