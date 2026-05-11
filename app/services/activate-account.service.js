import { prisma } from '#lib/prisma.js';
import { logger } from '#utils/index.js';
import { rabbitmq, QUEUES } from '#config/rabbitmq.js';
import { TOKEN_TYPES, TOKEN_BYTES, ACTIVATE_TOKEN_EXPIRY_MINUTES } from '../constants/tokenTypes.js';
import { generateToken, hashToken } from '../utils/token.util.js';
import { randomUUID } from 'crypto';


const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export async function sendActivationLink(email) {
    const user = await prisma.users.findUnique({ where: { email }, select: { user_id: true, is_ban: true, is_activate: true } });

    if (!user) {
        logger.info('Activation requested for non-existent email', { email });
        return;
    }
    if (user.is_ban) {
        logger.warn('Activation requested for banned account', { email });
        return;
    }
    if (user.is_activate) {
        logger.info('Activation requested for already activated account', { email });
        return;
    }

    const plainToken = generateToken(TOKEN_BYTES);
    const hashedToken = hashToken(plainToken);
    const createdAt = new Date();
    const expiry = new Date(createdAt.getTime() + ACTIVATE_TOKEN_EXPIRY_MINUTES * 60 * 1000);

    // Delete any existing activation tokens for this user before creating a new one
    await prisma.user_tokens.deleteMany({
        where: {
            user_id: user.user_id,
            type: TOKEN_TYPES.EMAIL_VERIFICATION,
        }
    });
    // Create a new activation token record
    await prisma.user_tokens.create({
        data: {
            user_id: user.user_id,
            token: hashedToken,
            type: TOKEN_TYPES.EMAIL_VERIFICATION,
            expires_at: expiry,
            created_at: createdAt,
        }
    });

    const activationLink = `${FRONTEND_URL}/activate-account?token=${plainToken}`;

    // Publish to RabbitMQ — the email.worker.js process will pick this up
    // and call sendAccountActivationEmail() asynchronously.
    rabbitmq.publish(QUEUES.EMAIL, {
      type: 'ACCOUNT_ACTIVATION',
      to: email,
      url: activationLink,
      jobId: randomUUID(),
      enqueuedAt: new Date().toISOString(),
    });

    logger.info('Account activation email job enqueued', { to: email });
}

/**
 * Activate a user's account using the provided activation token.
 *
 * @param {string} token - The activation token
 * @returns {Promise<void>}
 */
export async function activateAccount(token) {
    const hashedToken = hashToken(token);
    const tokenRecord = await prisma.user_tokens.findFirst({
        where: {
            token: hashedToken,
            type: TOKEN_TYPES.EMAIL_VERIFICATION,
            expires_at: { gt: new Date() },
        }
    });

    if (!tokenRecord) {
        logger.warn('Invalid or expired activation token used', { token });
        throw new Error('Token kích hoạt không hợp lệ hoặc đã hết hạn');
    }

    await prisma.$transaction(async (tx) => {
        await tx.users.update({
            where: { user_id: tokenRecord.user_id },
            data: { is_activate: true }
        });
        await tx.user_tokens.delete({
            where: { token_id: tokenRecord.token_id }
        });
    });
    logger.info('Account activated successfully', { user_id: tokenRecord.user_id });
}