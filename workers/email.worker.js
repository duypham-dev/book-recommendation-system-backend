//Email Worker — RabbitMQ Consumer
import 'dotenv/config';
import { rabbitmq, QUEUES } from '../app/config/rabbitmq.js';
import {
  sendAccountActivationEmail,
  sendPasswordResetEmail,
} from '../app/services/email.service.js';
import { logger } from '../app/utils/logger.js';

// ---------------------------------------------------------------------------
// Job Type Registry
// ---------------------------------------------------------------------------

/**
 * Maps each job type string to the correct email-sending function.
 * Add new email types here without touching the handler logic below.
 */
const JOB_HANDLERS = {
  ACCOUNT_ACTIVATION: async ({ to, url }) => {
    await sendAccountActivationEmail(to, url);
  },
  PASSWORD_RESET: async ({ to, url }) => {
    await sendPasswordResetEmail(to, url);
  },
};

// ---------------------------------------------------------------------------
// Message Handler
// ---------------------------------------------------------------------------

/**
 * Core handler invoked by the RabbitMQ consumer for every message.
 * @param {object} payload - Parsed JSON from the queue
 */
async function handleEmailJob(payload) {
  const { type, to, url, jobId, enqueuedAt } = payload;

  logger.info('Email worker: Processing job', { jobId, type, to, enqueuedAt });

  const handler = JOB_HANDLERS[type];

  if (!handler) {
    // Unknown type — log and let the client nack it (no retry).
    logger.error('Email worker: Unknown job type — discarding', { type, jobId });
    throw new Error(`Unknown email job type: ${type}`);
  }

  if (!to || !url) {
    logger.error('Email worker: Missing required fields (to, url) — discarding', { jobId, payload });
    throw new Error('Email job payload missing required fields: to, url');
  }

  await handler({ to, url });

  logger.info('Email worker: Job completed', { jobId, type, to });
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function start() {
  logger.info('Email worker: Starting…');

  // Connect to RabbitMQ (uses RABBITMQ_URL from .env)
  await rabbitmq.connect();

  // Register the consumer — rabbitmq.consume() handles ack/nack automatically.
  await rabbitmq.consume(QUEUES.EMAIL, handleEmailJob);

  logger.info(`Email worker: Listening on queue → ${QUEUES.EMAIL}`);
  logger.info('Email worker: Ready. Waiting for messages…');
}

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal) {
  logger.info(`Email worker: Received ${signal}, shutting down…`);
  await rabbitmq.disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// Catch unhandled rejections so the worker doesn't silently die.
process.on('unhandledRejection', (reason) => {
  logger.error('Email worker: Unhandled rejection', { reason: String(reason) });
});

start().catch((err) => {
  logger.error('Email worker: Fatal startup error', { message: err.message });
  process.exit(1);
});
