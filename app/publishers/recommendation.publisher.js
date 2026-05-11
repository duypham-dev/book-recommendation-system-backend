/**
 * Recommendation Publisher — RabbitMQ
 * Pattern mirrors the existing email publisher in the codebase.
 */
import { rabbitmq, QUEUES } from '#config/rabbitmq.js';
import crypto from 'crypto';

/**
 * Publish a user-interaction feedback event to the RS feedback queue.
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
 */
export const publishRetrain = (requestedBy) => {
  return rabbitmq.publish(QUEUES.RS_RETRAIN, {
    type: 'FULL_RETRAIN',
    jobId: crypto.randomUUID(),
    requestedBy,
    enqueuedAt: new Date().toISOString(),
  });
};
