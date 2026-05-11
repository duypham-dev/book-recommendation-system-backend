/**
 * RabbitMQ Client Configuration
 *
 * Provides a singleton connection manager for the entire application.
 * Implements exponential backoff reconnection and a clean publisher API.
 *
 * Pattern mirrors the existing redis.js config for consistency.
 */
import amqplib from 'amqplib';
import { logger } from '#utils/logger.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of reconnection retries before giving up. */
const MAX_RETRIES = 10;

/** Base delay (ms) for exponential backoff: delay = BASE_DELAY * 2^retry */
const BASE_DELAY_MS = 500;

/** Maximum reconnection delay cap (ms). */
const MAX_DELAY_MS = 30_000;

// ---------------------------------------------------------------------------
// Queue / Exchange Definitions
// ---------------------------------------------------------------------------

/**
 * Central registry of all queue names used in this application.
 * Import this object everywhere instead of using raw strings to avoid typos.
 *
 * @example
 * import { QUEUES } from '#config/rabbitmq.js';
 * await rabbitmq.publish(QUEUES.EMAIL, payload);
 */
export const QUEUES = {
  EMAIL: 'email_queue',
};

// ---------------------------------------------------------------------------
// RabbitMQClient Class
// ---------------------------------------------------------------------------

class RabbitMQClient {
  constructor() {
    /** @type {import('amqplib').Connection | null} */
    this.connection = null;

    /** @type {import('amqplib').Channel | null} */
    this.channel = null;

    this.isConnected = false;
    this._retryCount = 0;
    this._reconnectTimer = null;
    this._isShuttingDown = false;
  }

  // -------------------------------------------------------------------------
  // Connection Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Establish a connection to RabbitMQ and create a channel.
   * Asserts all queues defined in QUEUES so they exist before publish/consume.
   *
   * Call this once at application startup (see server.js).
   */
  async connect() {
    if (this.isConnected) return;

    const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';

    try {
      this.connection = await amqplib.connect(url);
      this.channel = await this.connection.createChannel();

      // Ensure messages are not lost if the worker crashes mid-processing.
      // With prefetch(1) the broker won't dispatch a second message to a worker
      // until it has acknowledged the first.
      await this.channel.prefetch(1);

      // Assert durable queues so they survive broker restarts.
      for (const queueName of Object.values(QUEUES)) {
        await this.channel.assertQueue(queueName, { durable: true });
        logger.info(`RabbitMQ: Queue asserted → ${queueName}`);
      }

      this.isConnected = true;
      this._retryCount = 0;

      // Wire up connection-level error / close events for auto-reconnect.
      this.connection.on('error', (err) => {
        logger.error('RabbitMQ: Connection error', { message: err.message });
        this._handleDisconnect();
      });

      this.connection.on('close', () => {
        if (!this._isShuttingDown) {
          logger.warn('RabbitMQ: Connection closed unexpectedly');
          this._handleDisconnect();
        }
      });

      logger.info('RabbitMQ: Connected and ready');
    } catch (err) {
      logger.error('RabbitMQ: Failed to connect', { message: err.message });
      this._handleDisconnect();
    }
  }

  /**
   * Gracefully close the channel and connection.
   * Call this during SIGTERM / SIGINT shutdown.
   */
  async disconnect() {
    this._isShuttingDown = true;
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);

    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
      this.isConnected = false;
      logger.info('RabbitMQ: Disconnected gracefully');
    } catch (err) {
      logger.error('RabbitMQ: Error during disconnect', { message: err.message });
    }
  }

  // -------------------------------------------------------------------------
  // Internal Reconnect Logic
  // -------------------------------------------------------------------------

  _handleDisconnect() {
    this.isConnected = false;
    this.channel = null;
    this.connection = null;

    if (this._isShuttingDown) return;
    if (this._retryCount >= MAX_RETRIES) {
      logger.error('RabbitMQ: Max reconnection attempts reached. Giving up.');
      return;
    }

    // Exponential backoff with a cap.
    const delay = Math.min(BASE_DELAY_MS * 2 ** this._retryCount, MAX_DELAY_MS);
    this._retryCount += 1;

    logger.warn(`RabbitMQ: Reconnecting in ${delay}ms (attempt ${this._retryCount}/${MAX_RETRIES})…`);

    this._reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  // -------------------------------------------------------------------------
  // Publisher API
  // -------------------------------------------------------------------------

  /**
   * Publish a JSON payload to a named queue.
   *
   * Uses `persistent: true` so messages survive a broker restart.
   * Falls back to logging a warning if the connection is not yet ready.
   *
   * @param {string} queue  - Target queue name (use QUEUES constants)
   * @param {object} payload - Plain object; will be JSON-serialised
   * @returns {boolean} true if the message was buffered by the broker
   */
  publish(queue, payload) {
    if (!this.isConnected || !this.channel) {
      logger.warn('RabbitMQ: Cannot publish — not connected', { queue, payload });
      return false;
    }

    const buffer = Buffer.from(JSON.stringify(payload));

    // sendToQueue returns false when the write buffer is full (back-pressure).
    const ok = this.channel.sendToQueue(queue, buffer, { persistent: true });

    if (!ok) {
      logger.warn('RabbitMQ: Write buffer full — message may be delayed', { queue });
    } else {
      logger.debug('RabbitMQ: Message published', { queue, payload });
    }

    return ok;
  }

  // -------------------------------------------------------------------------
  // Consumer API
  // -------------------------------------------------------------------------

  /**
   * Register a consumer callback for a queue.
   *
   * The callback receives the parsed JSON payload.
   * On success: ack is sent automatically.
   * On failure: nack is sent with requeue=false (sends to dead-letter if configured).
   *
   * @param {string}   queue    - Queue name (use QUEUES constants)
   * @param {Function} handler  - async (payload) => void
   */
  async consume(queue, handler) {
    if (!this.isConnected || !this.channel) {
      throw new Error('RabbitMQ: Cannot consume — not connected. Call connect() first.');
    }

    await this.channel.consume(queue, async (msg) => {
      if (!msg) return; // Consumer was cancelled by the broker

      let payload;
      try {
        payload = JSON.parse(msg.content.toString());
      } catch (err) {
        logger.error('RabbitMQ: Failed to parse message — discarding', { error: err.message });
        // Malformed message: nack without requeue to avoid an infinite loop.
        this.channel.nack(msg, false, false);
        return;
      }

      try {
        await handler(payload);
        this.channel.ack(msg);
      } catch (err) {
        logger.error('RabbitMQ: Handler threw — nacking message', {
          queue,
          error: err.message,
          payload,
        });
        // nack with requeue=false — if a dead-letter exchange is configured,
        // the message will be routed there instead of being lost silently.
        this.channel.nack(msg, false, false);
      }
    });

    logger.info(`RabbitMQ: Consumer registered on queue → ${queue}`);
  }

  // -------------------------------------------------------------------------
  // Accessors
  // -------------------------------------------------------------------------

  /**
   * Returns the raw amqplib channel.
   * Prefer using publish() / consume() rather than accessing the channel directly.
   */
  getChannel() {
    if (!this.channel || !this.isConnected) {
      throw new Error('RabbitMQ: Channel not available. Call connect() first.');
    }
    return this.channel;
  }
}

// ---------------------------------------------------------------------------
// Singleton Export
// ---------------------------------------------------------------------------

/** Singleton RabbitMQ client — import this everywhere. */
const rabbitmq = new RabbitMQClient();

export { rabbitmq };
