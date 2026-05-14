import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { ApiResponse, logger } from "#utils/index.js";

/**
 * Rate limiting for login attempts
 */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Maximum 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many failed login attempts. Please try again after 15 minutes.',
    statusCode: 429
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Rate limit by IP and identifier if available
    const identifier = req.body?.identifier; // Can be email or username
    const ip = ipKeyGenerator(req);          // Use proper IPv6 handling
    // return email ? `login_${email}_${ip}` : `login_${ip}`;
    return identifier ? `login_${identifier}` : `login_${ip}`;
  },
  handler: (req, res) => {
    logger.warn('Login rate limit exceeded', {
      ip: req.ip,
      identifier: req.body?.identifier,
      userAgent: req.get('User-Agent')
    });
    
    return ApiResponse.error(res, 'Too many failed login attempts. Please try again after 15 minutes.', 429);
  },
  // Skip successful requests
  skipSuccessfulRequests: true,
  // Skip when response status < 400
  skipFailedRequests: false
});

/**
 * Rate limiting for registration
 */
export const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Maximum 10 registrations per hour per IP
  message: {
    success: false,
    message: 'Too many registration attempts. Please try again after 1 hour.',
    statusCode: 429
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req); // Use proper IPv6 handling
    return `register_${ip}`;
  },
  handler: (req, res) => {
    logger.warn('Registration rate limit exceeded', {
      ip: req.ip,
      email: req.body?.email,
      userAgent: req.get('User-Agent')
    });
    
    return ApiResponse.error(res, 'Too many registration attempts. Please try again after 1 hour.', 429);
  }
});

/**
 * Rate limiting for forgot-password requests
 */
export const forgotPasswordRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Maximum 3 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req);
    return `forgot_${ip}`;
  },
  handler: (req, res) => {
    logger.warn('Forgot password rate limit exceeded', {
      ip: req.ip,
      email: req.body?.email,
      userAgent: req.get('User-Agent')
    });

    return ApiResponse.error(res, 'Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.', 429);
  }
});

/**
 * General rate limiting for API
 */
export const apiRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // Maximum 100 requests per 5 minutes
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    statusCode: 429
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('API rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    
    return ApiResponse.error(res, 'Too many requests. Please try again later.', 429);
  }
});