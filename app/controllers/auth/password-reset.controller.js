import { ApiResponse, logger } from '#utils/index.js';
import {
  requestPasswordReset,
  resetPassword as resetPasswordService,
} from '#services/passwordResetService.js';

// =============================================================================
// FORGOT PASSWORD
// =============================================================================

/**
 * POST /auth/forgot-password
 *
 * Accepts an email and triggers a password-reset email.
 * Always returns 200 with the same message regardless of whether the
 * email exists — this prevents email-enumeration attacks.
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    logger.info('Forgot password request', { email });

    // Fire-and-forget style: errors inside are logged but do not change the response
    await requestPasswordReset(email);

    return ApiResponse.success(
      res,
      null,
      'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu',
    );
  } catch (error) {
    logger.error('Forgot password error', { error: error.message });
    // Still return the same generic message so attackers can't distinguish errors
    return ApiResponse.success(
      res,
      null,
      'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu',
    );
  }
};

// =============================================================================
// RESET PASSWORD
// =============================================================================

/**
 * POST /auth/reset-password
 *
 * Verifies the reset token and updates the user's password.
 * Body: { token, newPassword, confirmPassword }
 * (confirmPassword is validated by Joi schema before reaching this handler)
 */
export const resetPasswordHandler = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    await resetPasswordService(token, newPassword);

    logger.info('Password reset completed via token');

    return ApiResponse.success(res, null, 'Mật khẩu đã được đặt lại thành công');
  } catch (error) {
    logger.warn('Password reset failed', { error: error.message });
    return ApiResponse.error(res, error.message || 'Token không hợp lệ hoặc đã hết hạn', 400);
  }
};
