/**
 * Recommendation Publisher — RabbitMQ
 *
 * Thin publisher for recommendation-engine events.
 * Controllers call these helpers instead of making synchronous HTTP calls
 * to the Python RS.
 *
 * Pattern mirrors the existing email publisher in the codebase.
 */
import { rabbitmq, QUEUES } from '#config/rabbitmq.js';
import { logger } from '#utils/logger.js';
import crypto from 'crypto';

/**
 * Publish a user-interaction feedback event to the RS feedback queue.
 *
 * Fire-and-forget: the call returns immediately (~1 ms) and the Python RS
 * consumer will process the event asynchronously.
 *
 * @param {string|number} userId
 * @param {object}        data
 * @param {number}        data.bookId
 * @param {string}        data.event      - 'rating' | 'favorite' | 'history'
 * @param {number|null}   [data.ratingValue]
 * @param {number|null}   [data.progress]
 * @returns {boolean} true if the message was buffered by the broker
 */
export const publishFeedback = (userId, { bookId, event, ratingValue, progress }) => {
  return rabbitmq.publish(QUEUES.RS_FEEDBACK, {
    type: 'FEEDBACK',
    jobId: crypto.randomUUID(),
    userId: Number(userId),
    bookId: Number(bookId),
    event,          // 'rating' | 'favorite' | 'history'
    ratingValue: ratingValue ?? null,
    progress: progress ?? null,
    enqueuedAt: new Date().toISOString(),
  });
};

/**
 * Publish a full-retrain request to the RS retrain queue.
 *
 * @param {string} requestedBy - Identifier of the admin or system that triggered the retrain
 * @returns {boolean}
 */
export const publishRetrain = (requestedBy) => {
  return rabbitmq.publish(QUEUES.RS_RETRAIN, {
    type: 'FULL_RETRAIN',
    jobId: crypto.randomUUID(),
    requestedBy,
    enqueuedAt: new Date().toISOString(),
  });
};
