/**
 * Cache-Invalidation Worker — RabbitMQ Consumer
 *
 * Consumes messages from `cache_invalidation_queue` published by the Python
 * Recommendation System after model updates (full retrain or incremental).
 *
 * Supported message types:
 *   - RETRAIN_COMPLETE   → flush all recommendation caches
 *   - INCREMENTAL_UPDATE → invalidate caches for specific user IDs
 *
 * Pattern mirrors the existing email.worker.js.
 */
import 'dotenv/config';
import { rabbitmq, QUEUES } from '../app/config/rabbitmq.js';
import { redisClient } from '../app/config/redis.js';
import { logger } from '../app/utils/logger.js';

// ---------------------------------------------------------------------------
// Job Type Registry
// ---------------------------------------------------------------------------

const JOB_HANDLERS = {
  /**
   * Full retrain completed — flush every recommendation-related cache key.
   */
  RETRAIN_COMPLETE: async ({ modelKey }) => {
    logger.info(`Cache worker: RETRAIN_COMPLETE — flushing rec:* caches (model: ${modelKey ?? 'all'})`);

    const client = redisClient.getClient();
    const keys = await scanKeys(client, 'rec:*');

    if (keys.length === 0) {
      logger.info('Cache worker: No rec:* keys to flush');
      return;
    }

    await client.del(keys);
    logger.info(`Cache worker: Flushed ${keys.length} rec:* cache keys`);
  },

  /**
   * Incremental update — invalidate only affected users' caches.
   */
  INCREMENTAL_UPDATE: async ({ userIds }) => {
    if (!userIds || userIds.length === 0) {
      logger.info('Cache worker: INCREMENTAL_UPDATE — no user IDs provided');
      return;
    }

    logger.info(`Cache worker: INCREMENTAL_UPDATE — invalidating caches for ${userIds.length} users`);

    const client = redisClient.getClient();
    const keysToDelete = userIds.map((uid) => `rec:user:${uid}`);

    // Also scan for any pattern-based keys like rec:user:42:* 
    for (const uid of userIds) {
      const extraKeys = await scanKeys(client, `rec:user:${uid}:*`);
      keysToDelete.push(...extraKeys);
    }

    const uniqueKeys = [...new Set(keysToDelete)];

    if (uniqueKeys.length === 0) {
      logger.info('Cache worker: No matching cache keys found');
      return;
    }

    await client.del(uniqueKeys);
    logger.info(`Cache worker: Deleted ${uniqueKeys.length} cache keys for ${userIds.length} users`);
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * SCAN-based key lookup (safe for production — never uses KEYS).
 * @param {import('redis').RedisClientType} client
 * @param {string} pattern
 * @returns {Promise<string[]>}
 */
async function scanKeys(client, pattern) {
  const found = [];
  let cursor = '0';
  do {
    const result = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
    cursor = result.cursor;
    found.push(...result.keys);
  } while (cursor !== '0');
  return found;
}

// ---------------------------------------------------------------------------
// Message Handler
// ---------------------------------------------------------------------------

async function handleCacheJob(payload) {
  const { type } = payload;

  logger.info('Cache worker: Processing job', { type });

  const handler = JOB_HANDLERS[type];

  if (!handler) {
    logger.error('Cache worker: Unknown job type — discarding', { type });
    throw new Error(`Unknown cache job type: ${type}`);
  }

  await handler(payload);

  logger.info('Cache worker: Job completed', { type });
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function start() {
  logger.info('Cache worker: Starting…');

  // Connect to Redis first (needed for cache ops)
  await redisClient.connect();

  // Connect to RabbitMQ
  await rabbitmq.connect();

  // Register the consumer
  await rabbitmq.consume(QUEUES.CACHE_INVALIDATION, handleCacheJob);

  logger.info(`Cache worker: Listening on queue → ${QUEUES.CACHE_INVALIDATION}`);
  logger.info('Cache worker: Ready. Waiting for messages…');
}

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal) {
  logger.info(`Cache worker: Received ${signal}, shutting down…`);
  await rabbitmq.disconnect();
  await redisClient.disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch unhandled rejections so the worker doesn't silently die.
process.on('unhandledRejection', (reason) => {
  logger.error('Cache worker: Unhandled rejection', { reason: String(reason) });
});

start().catch((err) => {
  logger.error('Cache worker: Fatal startup error', { message: err.message });
  process.exit(1);
});
