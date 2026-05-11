# RabbitMQ Email Queue — Implementation Guide

## What Was Built

Your email sending is now fully asynchronous. The API server publishes a JSON job to RabbitMQ and **immediately returns a response** to the client. A separate worker process picks up the job and handles the slow SMTP call.

```mermaid
sequenceDiagram
    participant Client
    participant API (server.js)
    participant RabbitMQ
    participant Worker (email.worker.js)
    participant SMTP (nodemailer)

    Client->>API (server.js): POST /auth/register
    API (server.js)->>API (server.js): Create user in DB
    API (server.js)->>RabbitMQ: publish(email_queue, {type, to, url, jobId})
    API (server.js)-->>Client: 201 Created (instant ✅)
    RabbitMQ-->>Worker (email.worker.js): Deliver message
    Worker (email.worker.js)->>SMTP (nodemailer): sendAccountActivationEmail()
    SMTP (nodemailer)-->>Worker (email.worker.js): OK
    Worker (email.worker.js)->>RabbitMQ: ack()
```

---

## Files Created / Modified

| File | Status | Role |
|---|---|---|
| `app/config/rabbitmq.js` | **NEW** | Singleton RabbitMQ client with auto-reconnect |
| `workers/email.worker.js` | **NEW** | Standalone consumer process |
| `app/services/activate-account.service.js` | **MODIFIED** | Publishes to queue instead of direct SMTP |
| `app/services/password-reset.service.js` | **MODIFIED** | Publishes to queue instead of direct SMTP |
| `server.js` | **MODIFIED** | Connects RabbitMQ on startup |
| `package.json` | **MODIFIED** | Added `worker:email` script + `amqplib` dep |

---

## Step 1 — Docker Compose

Add this service to your existing `docker-compose.yml`:

```yaml
services:
  # ... your existing postgres, redis services ...

  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    container_name: tekbook_rabbitmq
    ports:
      - "5672:5672"    # AMQP protocol port (application connects here)
      - "15672:15672"  # Management UI (browser: http://localhost:15672)
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER:-guest}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASS:-guest}
      RABBITMQ_DEFAULT_VHOST: /
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  rabbitmq_data:
```

---

## Step 2 — Environment Variables

Add to your `.env`:

```env
# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672
# For production, use: amqp://user:pass@rabbitmq-host:5672/vhost
```

---

## Step 3 — Run RabbitMQ

```bash
docker-compose up -d rabbitmq

# Verify it's healthy
docker-compose ps rabbitmq

# Access Management UI
open http://localhost:15672  # login: guest / guest
```

---

## Step 4 — How the Message Flow Works

### Publishing (in `activate-account.service.js`)

```js
rabbitmq.publish(QUEUES.EMAIL, {
  type: 'ACCOUNT_ACTIVATION',  // tells the worker which handler to use
  to: email,                   // recipient address
  url: activationLink,         // the clickable link in the email
  jobId: randomUUID(),         // for distributed tracing / dedup
  enqueuedAt: new Date().toISOString(),
});
```

The publisher is **fire-and-forget** from the API's perspective. The queue is declared as `durable: true` and messages are sent with `persistent: true`, so they survive a RabbitMQ restart.

### Consuming (in `workers/email.worker.js`)

The worker calls the exact same `sendAccountActivationEmail()` / `sendPasswordResetEmail()` functions from `email.service.js`. **No template duplication.**

Adding a new email type is as simple as:
```js
// In email.worker.js JOB_HANDLERS object:
WELCOME_EMAIL: async ({ to, url }) => {
  await sendWelcomeEmail(to, url);
},
```

---

## Step 5 — Running Everything

### Development (3 separate terminals)

```bash
# Terminal 1 — API server
npm run dev

# Terminal 2 — Email worker
npm run worker:email

# Terminal 3 — Docker services
docker-compose up rabbitmq redis postgres
```

### Production (PM2)

```bash
npm install -g pm2

# ecosystem.config.js
module.exports = {
  apps: [
    { name: 'api',          script: 'server.js' },
    { name: 'email-worker', script: 'workers/email.worker.js', instances: 2 },
  ]
};

pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Scaling the worker to 2 instances means 2 messages are processed in parallel — each worker competes for messages via the `prefetch(1)` setting.

---

## Architecture Decisions (for your CV/interview)

| Decision | Reason |
|---|---|
| **`durable: true` queue** | Messages survive a RabbitMQ broker restart |
| **`persistent: true` message** | Messages are written to disk, not only RAM |
| **`prefetch(1)`** | Fair dispatch — worker won't receive msg #2 until it acks msg #1; prevents one slow worker from hogging the queue |
| **`nack(msg, false, false)`** on error | Requeue=false avoids infinite retry loops; configure a Dead Letter Exchange (DLX) in production to capture failed messages |
| **Separate worker process** | Worker can be scaled independently of the API; a crash in the worker does not take down the API |
| **Singleton connection** | One TCP connection per process; channels are multiplexed over it (AMQP spec recommendation) |
| **Exponential backoff reconnect** | Prevents thundering-herd on broker restart |

---

## Production Enhancements (Next Steps)

> [!TIP]
> These are excellent additions to mention in interviews.

### Dead Letter Exchange (DLX) — catch permanently failing messages

```js
// In rabbitmq.js connect(), replace assertQueue with:
await this.channel.assertExchange('email_dlx', 'direct', { durable: true });
await this.channel.assertQueue('email_dead_letters', { durable: true });
await this.channel.bindQueue('email_dead_letters', 'email_dlx', 'email_queue');

await this.channel.assertQueue(QUEUES.EMAIL, {
  durable: true,
  arguments: {
    'x-dead-letter-exchange': 'email_dlx',
    'x-dead-letter-routing-key': 'email_queue',
    'x-message-ttl': 86400000, // 24 hours
  }
});
```

### Retry with exponential backoff

```js
// In email.worker.js handler, read the death count from headers:
const deathCount = msg.properties.headers?.['x-death']?.[0]?.count ?? 0;
if (deathCount >= 3) {
  logger.error('Email job exceeded max retries — discarding', { jobId: payload.jobId });
  this.channel.nack(msg, false, false); // send to DLX
  return;
}
// Otherwise nack with requeue to retry
this.channel.nack(msg, false, true);
```

### Message deduplication

Store processed `jobId` values in Redis with a short TTL (e.g., 1 hour) and skip if already seen. This prevents duplicate emails if the broker re-delivers a message after a worker crash.

