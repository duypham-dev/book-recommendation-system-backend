import { prisma } from '#lib/prisma.js';
import { hashPassword } from '#utils/hashPassword.js';
import { logger } from '#utils/index.js';
import { sendPasswordResetEmail } from './email.service.js';
import { TOKEN_TYPES, TOKEN_BYTES, RESET_TOKEN_EXPIRY_MINUTES } from '../constants/tokenTypes.js';
import { generateToken, hashToken } from '../utils/token.util.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Request a password reset for the given email.
 *
 * Always resolves successfully — never reveals whether the email exists.
 * If the email is found, a reset token is generated, its SHA-256 hash is
 * stored in the database, and a reset link is sent via email.
 *
 * @param {string} email
 */
export async function requestPasswordReset(email) {
  const user = await prisma.users.findUnique({ where: { email }, select: { user_id: true, is_ban: true, is_activate: true } });

  if (!user) {
    // Silently return — no email enumeration
    logger.info('Password reset requested for non-existent email', { email });
    return;
  }

  if (user.is_ban) {
    logger.warn('Password reset requested for banned account', { email });
    return;
  }

  if (!user.is_activate) {
    logger.warn('Password reset requested for inactive account', { email });
    return;
  }

  const plainToken = generateToken(TOKEN_BYTES);
  const hashedToken = hashToken(plainToken);
  const createdAt = new Date();
  const expiry = new Date(createdAt.getTime() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);


  // Delete any existing reset tokens for this user before creating a new one
  await prisma.user_tokens.deleteMany({
    where: {
      user_id: user.user_id,
      type: TOKEN_TYPES.RESET_PASSWORD,
    }
  });

  // Create a new reset token record
  await prisma.user_tokens.create({
    data: {
      user_id: user.user_id,
      token: hashedToken,
      type: TOKEN_TYPES.RESET_PASSWORD,
      expires_at: expiry,
      created_at: createdAt,
    }
  });

  const resetUrl = `${FRONTEND_URL}/reset-password?token=${plainToken}`;

  await sendPasswordResetEmail(email, resetUrl);

  logger.info('Password reset token generated', { email, expiresAt: expiry.toISOString() });
}

/**
 * Verify a reset token and update the user's password.
 *
 * @param {string} plainToken  - Raw token from the reset link
 * @param {string} newPassword - New plaintext password (will be bcrypt-hashed)
 * @throws {Error} If the token is invalid or expired
 */
export async function resetPassword(plainToken, newPassword) {
  const hashedToken = hashToken(plainToken);

  const validToken = await prisma.user_tokens.findFirst({
    where: {
      token: hashedToken,
      type: TOKEN_TYPES.RESET_PASSWORD,
      expires_at: { gt: new Date() },
    },
  });

  if (!validToken) {
    throw new Error('Token không hợp lệ hoặc đã hết hạn');
  }

  const hashedPassword = await hashPassword(newPassword);

  // Use a transaction to ensure both operations succeed or fail together
  await prisma.$transaction(async (tx) => {
    // Update the user's password
    await tx.users.update({
      where: { user_id: validToken.user_id },
      data: {
        password: hashedPassword,
      },
    });
    // Invalidate the token after successful password reset
    await tx.user_tokens.delete({
      where: { token_id: validToken.token_id }
    });
  });
  logger.info('Password reset successful', { userId: validToken.user_id.toString() });
}
