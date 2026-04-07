import express from 'express';

// CONTROLLERS
import {
  googleLogin,
  loginWithIdentifierAndPassword,
  registerWithEmailAndPassword,
  logout,
  logoutAll,
  getSessions,
  getAuthprofile
} from '../controllers/auth/auth.controller.js';
import { refreshTokenHandler } from '../controllers/auth/token.controller.js';
import { forgotPassword, resetPasswordHandler } from '../controllers/auth/password-reset.controller.js';
import {activateAccountHandler} from '../controllers/auth/activate-account.controller.js';

// MIDDLEWARES
import { authenticateToken } from '#middlewares/authenticateToken.js';
import { validate } from '#middlewares/validation.middleware.js';
import { loginRateLimit, registerRateLimit, forgotPasswordRateLimit } from '#middlewares/rateLimit.middleware.js';

// VALIDATORS
import {
  loginValidationSchema,
  registerValidationSchema,
  forgotPasswordValidationSchema,
  resetPasswordValidationSchema
} from '#validators/auth.validator.js';

const router = express.Router();

// ============================================
// PUBLIC ROUTES (no authentication required)
// ============================================

// Login with rate limiting and validation
router.post("/auth/login", 
  loginRateLimit, 
  validate(loginValidationSchema), 
  loginWithIdentifierAndPassword
);

// Register with rate limiting and validation
router.post("/auth/register", 
  registerRateLimit, 
  validate(registerValidationSchema), 
  registerWithEmailAndPassword
);

// Activation account with validation
router.post("/auth/activate",
  activateAccountHandler
);

// Google OAuth
router.post("/auth/google", googleLogin);

// Refresh token (uses HttpOnly cookie)
router.post("/auth/refresh", refreshTokenHandler);

// Logout current device (public - clears cookie even if token invalid)
router.post("/auth/logout", logout);

// Forgot password (rate limited + validated)
router.post("/auth/forgot-password",
  forgotPasswordRateLimit,
  validate(forgotPasswordValidationSchema),
  forgotPassword
);

// Reset password (validated)
router.post("/auth/reset-password",
  validate(resetPasswordValidationSchema),
  resetPasswordHandler
);

// ============================================
// PROTECTED ROUTES (authentication required)
// ============================================

// Logout all devices
router.post("/auth/logout-all", authenticateToken, logoutAll);

// Get all active sessions
router.get("/auth/sessions", authenticateToken, getSessions);

// Get current user profile
router.get("/auth/profile", authenticateToken, getAuthprofile);

export { router as AuthRouter };
