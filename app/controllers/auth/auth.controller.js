/**
 * Authentication Controller
 * Handles login, registration, logout with Redis-backed sessions
 * Supports email/password and OAuth (Google) authentication
 */
import { ApiResponse, logger } from "#utils/index.js";
  import { OAuth2Client } from 'google-auth-library';
import {
  signAccessToken,
  signRefreshToken,
  refreshCookieOptions,
  clearRefreshCookieOptions,
  verifyRefreshToken,
  TOKEN_EXPIRY
} from "#utils/jwt.js";
import { authService } from "#services/auth.service.js";
import { sessionStore } from "#services/session-store.service.js";
import {sendActivationLink} from "#services/activate-account.service.js";
import { hashPassword, comparePassword } from "#utils/hashPassword.js";

// =============================================================================
// GOOGLE OAUTH CONFIGURATION
// =============================================================================

/**
 * Initialize Google OAuth2 client
 * Client ID and Secret should be set via environment variables
 */
const googleOAuthClient = new OAuth2Client({
  clientId: process.env.GOOGLE_WEB_CLIENT_ID,
  clientSecret: process.env.GOOGLE_WEB_SECRET,
});

  /** Frontend URL for OAuth redirects */
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract client metadata from request for session tracking
 * Used for security auditing and multi-device session management
 * 
 * @param {Request} req - Express request object
 * @returns {Object} Client metadata (userAgent, ip)
 */
function getClientMetadata(req) {
  return {
    userAgent: req.headers['user-agent'] || 'unknown',
    ip: req.ip || req.connection?.remoteAddress || 'unknown',
  };
}

/**
 * Build user payload for JWT tokens
 * Only include necessary claims to minimize token size
 * 
 * @param {Object} user - User object from database
 * @returns {Object} User payload for tokens
 */
function buildUserPayload(user) {
  return {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role || 'user',
    avatarUrl: user.avatarUrl || null,
  };
}

/**
 * Create session and set refresh token cookie
 * Common logic used by all authentication methods
 * 
 * @param {Response} res - Express response object
 * @param {string} userId - User's database ID
 * @param {Object} metadata - Client metadata
 * @returns {Object} Generated tokens
 */
async function createSessionAndSetCookie(res, userId, metadata) {
  const { refreshToken, refreshTokenId } = signRefreshToken(userId);

  // Store session in Redis with hashed token
  await sessionStore.createSession(userId, refreshTokenId, refreshToken, metadata);

  // Set HttpOnly cookie for refresh token
  res.cookie("refreshToken", refreshToken, refreshCookieOptions());

  return { refreshToken, refreshTokenId };
}

// =============================================================================
// GOOGLE OAUTH HANDLER
// =============================================================================

/**
 * POST /auth/google - Google OAuth Sign-In
 */
export const googleLogin = async (req, res) => {
  try {
    const { credential: idToken, g_csrf_token } = req.body;
    const csrfCookie = req.cookies?.g_csrf_token;

    // Validate required fields
    if (!idToken) {
      logger.warn('Google login: Missing ID token');
      return res.redirect(`${FRONTEND_URL}/oauth/callback?oauth=error&message=missing_token`);
    }

    // Verify CSRF token to prevent cross-site request forgery
    if (!g_csrf_token || g_csrf_token !== csrfCookie) {
      logger.warn('Google login: CSRF token mismatch');
      return res.redirect(`${FRONTEND_URL}/oauth/callback?oauth=error&message=csrf_invalid`);
    }

    // Verify the ID token with Google
    const ticket = await googleOAuthClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_WEB_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    // Extract user info from Google token
    const googleProfile = {
      email: payload.email,
      fullName: payload.name,
      avatarUrl: payload.picture,
    };

    logger.info('Google token verified', { email: googleProfile.email });

    // Find existing user or create new account
    const user = await authService.findOrCreateOAuthUser(googleProfile);

    // Check if account is banned
    if (user.isBan) {
      logger.warn('Google login: Account banned', {
        email: user.email,
        userId: user.id
      });
      return res.redirect(`${FRONTEND_URL}/oauth/callback?oauth=error&message=account_banned`);
    }

    // Build token payload using database user ID (not Google ID!)
    const userPayload = buildUserPayload(user);
    const { accessToken } = signAccessToken(userPayload);

    // Create session and set refresh token cookie
    const metadata = getClientMetadata(req);
    const { refreshTokenId } = await createSessionAndSetCookie(res, user.id, metadata);

    logger.info('Google login successful', {
      email: user.email,
      userId: user.id,
      isNewUser: user.isNewUser,
      jti: refreshTokenId
    });

    // Redirect to frontend OAuth callback page
    // Access token passed via URL (short-lived, acceptable for redirect)
    // Refresh token is in HttpOnly cookie
    return res.redirect(`${FRONTEND_URL}/oauth/callback?oauth=success&token=${accessToken}`);

  } catch (error) {
    logger.error('Google login error', { error: error.message, stack: error.stack });

    // Determine error type for user-friendly message
    const errorMessage = error.message?.includes('Token used too late')
      ? 'token_expired'
      : 'server_error';

    return res.redirect(`${FRONTEND_URL}/oauth/callback?oauth=error&message=${errorMessage}`);
  }
};

// =============================================================================
// EMAIL/PASSWORD AUTHENTICATION
// =============================================================================

/**
 * POST /auth/login - Email/Password login
 * 
 * Flow:
 * 1. Validate email and password
 * 2. Find user by email
 * 3. Verify password hash
 * 4. Create session and return tokens
 * 
 * @param {Request} req - Express request with email and password
 * @param {Response} res - Express response with user data and tokens
 */
export const loginWithIdentifierAndPassword = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    logger.info('Login attempt', { identifier });

    // Find user by email (includes password hash)
    const user = await authService.findUserByIdentifier(identifier);

    if (!user) {
      logger.warn('Login failed: User not found', { identifier });
      return ApiResponse.error(res, 'Thông tin đăng nhập hoặc mật khẩu không đúng', 401);
    }

    // Check if account is banned
    if (user.isBan) {
      logger.warn('Login failed: Account banned', { identifier, userId: user.id });
      return ApiResponse.error(res, 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên', 403);
    }

    // Check if account is not activated
    if (!user.isActivate) {
      logger.warn('Login failed: Account not activated', { identifier, userId: user.id });
      return ApiResponse.error(res, 'Tài khoản chưa được kích hoạt. Vui lòng kiểm tra email để kích hoạt tài khoản', 403);
    }

    // Verify password using bcrypt
    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      logger.warn('Login failed: Invalid password', { identifier, userId: user.id });
      return ApiResponse.error(res, 'Thông tin đăng nhập hoặc mật khẩu không đúng', 401);
    }

    // Build token payload and generate access token
    const userPayload = buildUserPayload(user);
    console.log('User payload for token:', userPayload);
    const { accessToken } = signAccessToken(userPayload);

    // Create session and set refresh token cookie
    const metadata = getClientMetadata(req);
    const { refreshTokenId } = await createSessionAndSetCookie(res, user.id, metadata);

    logger.info('Login successful', { identifier, userId: user.id, jti: refreshTokenId });
    
    return ApiResponse.success(res, {
      user: userPayload,
      accessToken,
      expiresIn: TOKEN_EXPIRY.ACCESS_SECONDS,
    }, 'Đăng nhập thành công');

  } catch (error) {
    logger.error('Login error', { error: error.message, stack: error.stack });
    return ApiResponse.error(res, 'Lỗi hệ thống. Vui lòng thử lại sau', 500);
  }
};

/**
 * POST /auth/register - New user registration
 * 
 * Flow:
 * 1. Check if email already exists
 * 2. Hash password with bcrypt
 * 3. Create user in database
 * 4. Create session and return tokens
 * 
 * @param {Request} req - Express request with email, password, fullName
 * @param {Response} res - Express response with user data and tokens
 */
export const registerWithEmailAndPassword = async (req, res) => {
  try {
    const { email, password, username, fullName, phoneNumber } = req.body;

    logger.info('Registration attempt', { email, username, phoneNumber, fullName });

    // Check if email, username, or phone number is already registered
    const existingUser = await authService.checkExistingUser(email, username, phoneNumber);

    if (existingUser.emailExist) {
      logger.warn('Registration failed: Email exists', { email });
      return ApiResponse.error(res, 'Email đã được sử dụng', 409);
    }

    if (existingUser.usernameExist) {
      logger.warn('Registration failed: Username exists', { username });
      return ApiResponse.error(res, 'Username đã được sử dụng', 409);
    }

    if (existingUser.phoneNumberExist) {
      logger.warn('Registration failed: Phone number exists', { phoneNumber });
      return ApiResponse.error(res, 'Số điện thoại đã được sử dụng', 409);
    }

    // Hash password with bcrypt (cost factor from env or default 12)
    const hashedPassword = await hashPassword(password);

    // Only create user account - do not log in immediately (requires email verification)
    await authService.createUser({
      email,
      password: hashedPassword,
      username: username,
      fullName: fullName,
      phoneNumber: phoneNumber,
      role: 'USER',
      isActivate: false, // Requires email verification
    });

    // Send activation email (fire-and-forget)
    await sendActivationLink(email);

    return ApiResponse.success(res, {}, 'Đăng ký thành công', 201);
  } catch (error) {
    logger.error('Registration error', { error: error.message, stack: error.stack });
    return ApiResponse.error(res, 'Lỗi hệ thống. Vui lòng thử lại sau', 500);
  }
};

// =============================================================================
// LOGOUT HANDLERS
// =============================================================================

/**
 * POST /auth/logout - Logout current device
 * 
 * Revokes the current refresh token from Redis.
 * Public endpoint - works even with invalid/expired tokens.
 * 
 * @param {Request} req - Express request with refreshToken cookie
 * @param {Response} res - Express response
 */
export const logout = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;

    if (!token) {
      // No token present - user already logged out, just clear cookie
      res.clearCookie("refreshToken", clearRefreshCookieOptions());
      return ApiResponse.success(res, null, 'Đăng xuất thành công');
    }

    try {
      // Attempt to decode token and revoke session
      const decoded = verifyRefreshToken(token);
      const { sub: userId, jti } = decoded;

      // Revoke session from Redis
      await sessionStore.revokeSession(userId, jti);

      logger.info('Logout successful', { userId, jti });
    } catch (err) {
      // Token invalid/expired - log and continue (still clear cookie)
      logger.warn('Logout with invalid token', { error: err.message });
    }

    // Always clear the cookie, regardless of token validity
    res.clearCookie("refreshToken", clearRefreshCookieOptions());

    return ApiResponse.success(res, null, 'Đăng xuất thành công');

  } catch (error) {
    logger.error('Logout error', { error: error.message });
    return ApiResponse.error(res, 'Lỗi hệ thống', 500);
  }
};

/**
 * POST /auth/logout-all - Logout all devices
 * 
 * Revokes all refresh tokens for the authenticated user.
 * Requires valid access token (protected route).
 * 
 * @param {Request} req - Express request with authenticated user
 * @param {Response} res - Express response with revoked count
 */
export const logoutAll = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return ApiResponse.error(res, 'Không có quyền truy cập', 401);
    }

    // Revoke all sessions for this user
    const revokedCount = await sessionStore.revokeAllSessions(userId);

    // Clear current device's cookie
    res.clearCookie("refreshToken", clearRefreshCookieOptions());

    logger.info('Logout all successful', { userId, revokedCount });

    return ApiResponse.success(res, {
      revokedSessions: revokedCount
    }, 'Đã đăng xuất khỏi tất cả thiết bị');

  } catch (error) {
    logger.error('Logout all error', { error: error.message });
    return ApiResponse.error(res, 'Lỗi hệ thống', 500);
  }
};

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

/**
 * GET /auth/sessions - Get all active sessions
 * 
 * Returns list of active sessions for account management UI.
 * Allows users to see where they're logged in.
 * 
 * @param {Request} req - Express request with authenticated user
 * @param {Response} res - Express response with sessions list
 */
export const getSessions = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return ApiResponse.error(res, 'Không có quyền truy cập', 401);
    }

    const sessions = await sessionStore.getUserSessions(userId);

    return ApiResponse.success(res, { sessions }, 'Danh sách phiên đăng nhập');

  } catch (error) {
    logger.error('Get sessions error', { error: error.message });
    return ApiResponse.error(res, 'Lỗi hệ thống', 500);
  }
};

/**
 * GET /auth/profile - Get current user profile
 *
 * Stateless: reads claims directly from the verified access token.
 * Token is always kept up-to-date because update endpoints issue a new
 * access token on every profile/avatar change.
 */
export const getAuthprofile = (req, res) => {
  const { userId, email, fullName, role, avatarUrl } = req.user;
  return ApiResponse.success(
    res,
    { userId, email, fullName, role, avatarUrl: avatarUrl || null },
    'Thông tin hồ sơ',
  );
};