import app from './app/index.js';
import { redisClient } from './app/config/redis.js';
import { rabbitmq } from './app/config/rabbitmq.js';

const port = process.env.PORT || 8080;

// Initialize services and start server
async function startServer() {
  try {
    // 1. Connect to Redis
    await redisClient.connect();
    console.log('✓ Redis connected');

    // 2. Connect to RabbitMQ (publisher only — workers run as separate processes)
    await rabbitmq.connect();
    console.log('✓ RabbitMQ connected');

    // 3. Start Express server
    app.listen(port, '0.0.0.0', () => {
      console.log(`✓ Server running at http://0.0.0.0:${port}`);
    });
  } catch (error) {
    console.error('✗ Failed to start server:', error.message);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal) {
  console.log(`\n${signal} received, shutting down gracefully…`);
  await rabbitmq.disconnect();
  await redisClient.disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

startServer();