# RabbitMQ Integration for the Recommendation Engine — Architectural Analysis & Refactoring Roadmap

## 1. Current Architecture & Coupling Analysis

The system is a three-tier application with significant synchronous coupling:

```mermaid
graph LR
    subgraph "Frontend (React/Vite)"
        FE_Hooks["useRecommendedBooks / useSimilarBooks"]
        FE_Feedback["feedbackHelper.js"]
    end

    subgraph "Node.js Backend (Express)"
        BE_RecCtrl["recommendation.controller"]
        BE_RecSvc["recommendation.service"]
        BE_RatCtrl["rating.controller"]
        BE_FavCtrl["favorite.controller"]
        BE_HistCtrl["history.controller"]
    end

    subgraph "Python RS (FastAPI :8003)"
        RS_Routes["routes.py"]
        RS_Hybrid["HybridRecommender"]
        RS_Callback["callback.py"]
    end

    FE_Hooks -->|"HTTP GET /recommendations"| BE_RecCtrl
    FE_Hooks -->|"HTTP GET /similar-books"| BE_RecCtrl
    FE_Feedback -->|"HTTP POST /feedback (DIRECT to RS!)"| RS_Routes

    BE_RecCtrl --> BE_RecSvc
    BE_RecSvc -->|"sync fetch()"| RS_Routes

    RS_Callback -->|"sync httpx POST"| BE_RecCtrl

    style FE_Feedback fill:#f99,stroke:#c00,stroke-width:2px
    style BE_RecSvc fill:#ff9,stroke:#c90,stroke-width:2px
    style RS_Callback fill:#ff9,stroke:#c90,stroke-width:2px
```

### Identified Coupling Points

| # | Coupling Point | Current Mechanism | Risk |
|---|---------------|-------------------|------|
| **C1** | Frontend → RS feedback | `feedbackHelper.js` calls RS `:8003` **directly** via `rsApi` axios instance, bypassing the Node backend entirely | Exposes internal service URL to browser; no auth on RS side |
| **C2** | Node Backend → RS queries | `recommendation.service.js` uses synchronous `fetch()` to RS for recommendations, similar, diverse | Request latency chains; RS downtime = backend 500s |
| **C3** | RS → Node callbacks | `callback.py` makes synchronous HTTP POST to Node backend for cache invalidation | Tight reverse coupling; failures silently swallowed |
| **C4** | Frontend → RS read path | `getRecommendations` / `getSimilarBooks` in `recommendationService.js` use `callRecsys()` which hits RS directly for reads | Same exposure issue as C1 |

---

## 2. Architectural Benefits of Introducing RabbitMQ

### 2.1 What RabbitMQ Solves

| Benefit | Explanation |
|---------|-------------|
| **Temporal Decoupling** | Publishers (Node backend) and consumers (Python RS) don't need to be alive simultaneously. Feedback events survive RS restarts. |
| **Fire-and-Forget Writes** | Rating, favorite, and history events become non-blocking publishes (~1ms) instead of synchronous HTTP round-trips (~50-200ms). |
| **Backpressure & Buffering** | RabbitMQ absorbs traffic spikes. The RS processes events at its own pace via `prefetch(1)`. |
| **Operational Independence** | RS can be redeployed, retrained, or scaled without affecting user-facing latency. |
| **Existing Infrastructure** | RabbitMQ is already deployed and the `RabbitMQClient` singleton + email worker pattern is production-proven. |

### 2.2 What RabbitMQ Should NOT Replace

> [!IMPORTANT]
> **Read-path queries (recommendations, similar books) must remain synchronous HTTP** (via the Node backend proxy). RabbitMQ is a message broker, not a request-reply transport. The user expects an immediate list of books — this is inherently a synchronous operation.

The target architecture uses RabbitMQ exclusively for the **write path** (events/signals flowing *into* the RS) and **callback signals** (flowing *out* of the RS).

---

## 3. Target Architecture

```mermaid
graph TB
    subgraph "Frontend (React)"
        FE["All hooks & services"]
    end

    subgraph "Node.js Backend"
        API["Express API"]
        PUB["RabbitMQ Publisher"]
        REC_PROXY["Recommendation Proxy (HTTP)"]
        CACHE_LISTENER["Cache-Invalidation Consumer"]
    end

    subgraph "RabbitMQ"
        Q_FEED["rs_feedback_queue"]
        Q_RETRAIN["rs_retrain_queue"]
        Q_CACHE["cache_invalidation_queue"]
    end

    subgraph "Python RS"
        RS_CONSUMER["Feedback Consumer"]
        RS_PUB["Cache-Invalidation Publisher"]
        RS_API["FastAPI (read-only queries)"]
        RS_ENGINE["HybridRecommender"]
    end

    FE -->|"ALL requests via Node"| API
    API -->|"rating/fav/history events"| PUB
    PUB --> Q_FEED
    PUB --> Q_RETRAIN
    Q_FEED --> RS_CONSUMER
    Q_RETRAIN --> RS_CONSUMER
    RS_CONSUMER --> RS_ENGINE

    API -->|"GET /recommendations"| REC_PROXY
    REC_PROXY -->|"sync HTTP"| RS_API
    RS_API --> RS_ENGINE

    RS_ENGINE -->|"after update"| RS_PUB
    RS_PUB --> Q_CACHE
    Q_CACHE --> CACHE_LISTENER

    style Q_FEED fill:#e6f3ff,stroke:#0066cc
    style Q_RETRAIN fill:#e6f3ff,stroke:#0066cc
    style Q_CACHE fill:#e6f3ff,stroke:#0066cc
```

### 3.1 New Queue Definitions

| Queue Name | Direction | Publisher | Consumer | Payload |
|------------|-----------|-----------|----------|---------|
| `rs_feedback_queue` | Node → RS | Node backend | Python RS worker | `{type, userId, bookId, event, ratingValue, progress, timestamp}` |
| `rs_retrain_queue` | Node → RS | Node backend (admin) | Python RS worker | `{type: "FULL_RETRAIN", requestedBy, timestamp}` |
| `cache_invalidation_queue` | RS → Node | Python RS | Node backend consumer | `{type, userIds?, modelKey?, timestamp}` |

---

## 4. Refactoring Guidelines by Service

### 4.1 Node.js Backend — Publisher Side

#### A. Extend `rabbitmq.js` Queue Registry

```javascript
// app/config/rabbitmq.js — Add new queues
export const QUEUES = {
  EMAIL: 'email_queue',
  RS_FEEDBACK: 'rs_feedback_queue',          // NEW
  RS_RETRAIN: 'rs_retrain_queue',            // NEW  
  CACHE_INVALIDATION: 'cache_invalidation_queue', // NEW
};
```

#### B. Create `recommendation.publisher.js`

A thin publisher module (mirrors the email pattern) that the controllers call instead of `recommendation.service.sendFeedback()`:

```javascript
// app/publishers/recommendation.publisher.js
import { rabbitmq, QUEUES } from '#config/rabbitmq.js';
import { logger } from '#utils/logger.js';
import crypto from 'crypto';

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

export const publishRetrain = (requestedBy) => {
  return rabbitmq.publish(QUEUES.RS_RETRAIN, {
    type: 'FULL_RETRAIN',
    jobId: crypto.randomUUID(),
    requestedBy,
    enqueuedAt: new Date().toISOString(),
  });
};
```

#### C. Refactor Controllers to Publish Instead of HTTP

**`rating.controller.js`** — After saving a rating to the DB, publish a feedback event:

```javascript
// After: const result = await ratingService.createOrUpdateRating(...)
publishFeedback(userId, { bookId, event: 'rating', ratingValue: value });
```

**`favorite.controller.js`** — After adding/removing a favorite:

```javascript
// addFavorite: publish strength=5
publishFeedback(userId, { bookId, event: 'favorite', ratingValue: 5 });
// removeFavorite: publish strength=0
publishFeedback(userId, { bookId, event: 'favorite', ratingValue: 0 });
```

**`history.controller.js`** — After recording reading progress:

```javascript
// After: const result = await historyService.recordHistory(...)
publishFeedback(userId, { bookId, event: 'history', progress });
```

#### D. Create `cache-invalidation.worker.js`

A new Node worker process that consumes `cache_invalidation_queue` messages from the RS:

```javascript
// workers/cache-invalidation.worker.js
import { rabbitmq, QUEUES } from '../app/config/rabbitmq.js';
import { redisClient } from '../app/config/redis.js';

const HANDLERS = {
  RETRAIN_COMPLETE: async ({ modelKey }) => {
    // Flush all recommendation caches
    await redisClient.flushPattern('rec:*');
  },
  INCREMENTAL_UPDATE: async ({ userIds }) => {
    // Invalidate only affected users
    for (const uid of userIds) {
      await redisClient.del(`rec:user:${uid}`);
    }
  },
};

async function handleMessage(payload) {
  const handler = HANDLERS[payload.type];
  if (!handler) throw new Error(`Unknown type: ${payload.type}`);
  await handler(payload);
}
```

Add a `package.json` script: `"worker:cache": "node workers/cache-invalidation.worker.js"`

---

### 4.2 Python RS — Consumer Side

#### A. Add `pika` Dependency

```
pip install pika
```

#### B. Create `src/messaging/consumer.py`

```python
# src/messaging/consumer.py
import pika, json, os, threading
from src.utils.logging_config import logger

class RSConsumer:
    def __init__(self, recommender, on_retrain_request):
        self.recommender = recommender
        self.on_retrain_request = on_retrain_request
        self.url = os.getenv('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672')

    def start(self):
        """Run consumer in a background daemon thread."""
        thread = threading.Thread(target=self._consume, daemon=True)
        thread.start()

    def _consume(self):
        params = pika.URLParameters(self.url)
        connection = pika.BlockingConnection(params)
        channel = connection.channel()
        channel.queue_declare(queue='rs_feedback_queue', durable=True)
        channel.queue_declare(queue='rs_retrain_queue', durable=True)
        channel.basic_qos(prefetch_count=1)

        channel.basic_consume('rs_feedback_queue', self._handle_feedback)
        channel.basic_consume('rs_retrain_queue', self._handle_retrain)
        logger.info("RS Consumer: Listening on rs_feedback_queue, rs_retrain_queue")
        channel.start_consuming()

    def _handle_feedback(self, ch, method, props, body):
        try:
            msg = json.loads(body)
            # Map to existing recommender.add_interaction()
            strength = self._compute_strength(msg)
            self.recommender.add_interaction(
                user_id=msg['userId'],
                book_id=msg['bookId'],
                strength=strength,
                interaction_type=msg['event']
            )
            ch.basic_ack(delivery_tag=method.delivery_tag)
        except Exception as e:
            logger.error(f"Feedback handler error: {e}")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

    def _handle_retrain(self, ch, method, props, body):
        try:
            self.on_retrain_request()
            ch.basic_ack(delivery_tag=method.delivery_tag)
        except Exception as e:
            logger.error(f"Retrain handler error: {e}")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

    def _compute_strength(self, msg):
        event = msg.get('event')
        if event == 'rating':
            return float(msg.get('ratingValue', 1))
        elif event == 'favorite':
            return 5.0 if msg.get('ratingValue', 5) > 0 else 0.0
        elif event == 'history':
            progress = msg.get('progress', 0) or 0
            return max(0.5, (progress / 100.0) * 5.0)
        return 1.0
```

#### C. Create `src/messaging/publisher.py`

Replace `callback.py` HTTP calls with RabbitMQ publishes:

```python
# src/messaging/publisher.py
import pika, json, os
from src.utils.logging_config import logger

class RSPublisher:
    def __init__(self):
        self.url = os.getenv('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672')
        self._connection = None
        self._channel = None

    def connect(self):
        params = pika.URLParameters(self.url)
        self._connection = pika.BlockingConnection(params)
        self._channel = self._connection.channel()
        self._channel.queue_declare(queue='cache_invalidation_queue', durable=True)

    def publish_retrain_complete(self, model_key):
        self._publish('cache_invalidation_queue', {
            'type': 'RETRAIN_COMPLETE',
            'modelKey': model_key,
        })

    def publish_incremental_update(self, user_ids):
        self._publish('cache_invalidation_queue', {
            'type': 'INCREMENTAL_UPDATE',
            'userIds': user_ids,
        })

    def _publish(self, queue, payload):
        if not self._channel:
            logger.warn("RSPublisher not connected, skipping publish")
            return
        self._channel.basic_publish(
            exchange='',
            routing_key=queue,
            body=json.dumps(payload),
            properties=pika.BasicProperties(delivery_mode=2),
        )
```

#### D. Wire into `server.py` Startup

```python
# In server.py startup_event():
from src.messaging.consumer import RSConsumer
from src.messaging.publisher import RSPublisher

rs_publisher = RSPublisher()
rs_publisher.connect()

consumer = RSConsumer(
    recommender=routes.recommender,
    on_retrain_request=lambda: retrain_models()
)
consumer.start()  # Background daemon thread
```

---

### 4.3 Frontend — Remove Direct RS Access

#### A. Route ALL Feedback Through Node Backend

The `feedbackHelper.js` currently imports `recordFeedback` from `recommendationService.js` which calls RS directly. **Refactor to call the Node backend instead:**

```javascript
// feedbackHelper.js — Change import
import api from '../config/ApiConfig.js';  // Use Node backend API

const sendFeedbackToBackend = async (userId, bookId, event, ratingValue) => {
  // This hits Node's /feedback endpoint, which publishes to RabbitMQ
  return api.post('/recommendation/feedback', {
    book_id: bookId, event, rating_value: ratingValue
  });
};
```

#### B. Verify Read-Path Already Proxies Through Node

`useRecommendedBooks` calls `getRecommendedBooks()` from `bookService.js` → Node backend → RS. **This path is correct and stays as HTTP.**

`useSimilarBooks` calls `getSimilarBooks()` from `bookService.js` → Node backend → RS. **This path is also correct.**

#### C. Remove `rsApi` Direct Connection

The `callRecsys()` pattern in `recommendationService.js` that creates a direct axios instance to RS `:8003` should be removed for all non-admin operations. Admin dashboard operations (health, model info) can remain as backend-proxied calls.

---

## 5. Refactoring Roadmap

### Phase 1: Infrastructure (No Breaking Changes)

| # | Task | Files | Risk |
|---|------|-------|------|
| 1.1 | Add `RS_FEEDBACK`, `RS_RETRAIN`, `CACHE_INVALIDATION` to `QUEUES` in `rabbitmq.js` | [rabbitmq.js](file:///d:/Workspace/TekBook/book-recommendation-system-backend/app/config/rabbitmq.js) | None — additive |
| 1.2 | Create `recommendation.publisher.js` | NEW file | None |
| 1.3 | Add `pika` to RS `requirements.txt` | RS `requirements.txt` | None |
| 1.4 | Create `src/messaging/consumer.py` and `src/messaging/publisher.py` in RS | NEW files | None |
| 1.5 | Add `RABBITMQ_URL` to RS `.env` | RS `.env` | None |

### Phase 2: Dual-Write (Parallel Run for Validation)

| # | Task | Files |
|---|------|-------|
| 2.1 | In `rating.controller.js`, after DB write, also call `publishFeedback()` | [rating.controller.js](file:///d:/Workspace/TekBook/book-recommendation-system-backend/app/controllers/user/rating.controller.js) |
| 2.2 | In `favorite.controller.js`, after DB write, also call `publishFeedback()` | [favorite.controller.js](file:///d:/Workspace/TekBook/book-recommendation-system-backend/app/controllers/user/favorite.controller.js) |
| 2.3 | In `history.controller.js`, after DB write, also call `publishFeedback()` | history.controller.js |
| 2.4 | Wire RS consumer into `server.py` startup | [server.py](file:///d:/Workspace/book-recommendation-system/RS/server.py) |
| 2.5 | Replace `callback.py` HTTP calls with `RSPublisher` | [callback.py](file:///d:/Workspace/book-recommendation-system/RS/src/utils/callback.py) |
| 2.6 | Create `workers/cache-invalidation.worker.js` | NEW file |
| 2.7 | Add `"worker:cache"` script to `package.json` | package.json |

> [!TIP]
> During Phase 2, keep the existing direct HTTP `sendFeedback` path alive. Both the queue and the HTTP path write to the RS simultaneously. Monitor RS logs to confirm the queue consumer receives identical events.

### Phase 3: Cut-Over (Remove Direct Coupling)

| # | Task | Files |
|---|------|-------|
| 3.1 | Refactor `feedbackHelper.js` to call Node backend `/feedback` endpoint instead of RS directly | [feedbackHelper.js](file:///d:/Workspace/TekBook/book-recommendation-system-frontend/book-recommendation-system-frontend/src/utils/feedbackHelper.js) |
| 3.2 | Remove `callRecsys('post', '/feedback', ...)` from `recommendationService.js` | [recommendationService.js](file:///d:/Workspace/TekBook/book-recommendation-system-frontend/book-recommendation-system-frontend/src/services/recommendationService.js) |
| 3.3 | Remove `POST /feedback` route from Node's `recommendation.routes.js` (replaced by controller-level publishing) | [recommendation.routes.js](file:///d:/Workspace/TekBook/book-recommendation-system-backend/app/routes/user/recommendation.routes.js) |
| 3.4 | Remove HTTP-based `sendFeedback()` from `recommendation.service.js` | [recommendation.service.js](file:///d:/Workspace/TekBook/book-recommendation-system-backend/app/services/recommendation.service.js) |
| 3.5 | Delete `callback.py` sync HTTP functions; keep only RabbitMQ publisher | [callback.py](file:///d:/Workspace/book-recommendation-system/RS/src/utils/callback.py) |
| 3.6 | Optionally remove `POST /feedback` HTTP endpoint from RS `routes.py` (queue is now the only ingress) | [routes.py](file:///d:/Workspace/book-recommendation-system/RS/src/api/routes.py) |

### Phase 4: Hardening

| # | Task |
|---|------|
| 4.1 | Add dead-letter exchange (DLX) for `rs_feedback_queue` to capture failed messages |
| 4.2 | Add monitoring/alerting on queue depth for `rs_feedback_queue` |
| 4.3 | Implement idempotency keys (`jobId`) in RS consumer to handle redelivery |
| 4.4 | Load-test the feedback throughput: target sustained 500 msg/s |

---

## 6. Event Schema Reference

### Feedback Event (Node → RS)

```json
{
  "type": "FEEDBACK",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": 42,
  "bookId": 137,
  "event": "rating",
  "ratingValue": 4,
  "progress": null,
  "enqueuedAt": "2026-05-11T05:00:00.000Z"
}
```

### Cache Invalidation Event (RS → Node)

```json
{
  "type": "INCREMENTAL_UPDATE",
  "userIds": [42, 99, 201],
  "timestamp": "2026-05-11T05:01:00.000Z"
}
```

---

## Open Questions

> [!IMPORTANT]
> **Q1: Admin retrain trigger** — Should the admin `POST /retrain` endpoint remain as a synchronous HTTP proxy to the RS, or should it also go through `rs_retrain_queue`? Queue-based is cleaner, but the admin may want immediate status feedback.

> [!IMPORTANT]  
> **Q2: Frontend direct RS access for reads** — The `callRecsys()` pattern in `recommendationService.js` currently hits RS `:8003` directly for `GET /recommendations` and `GET /similar`. Should these also be forced through the Node backend proxy? The Node backend already has proxy endpoints. Routing everything through Node gives you auth, rate-limiting, and a single external surface.

> [!WARNING]
> **Q3: RS Consumer threading model** — The Python RS runs on uvicorn (async). The `pika` blocking consumer runs in a daemon thread. For production, consider using `aio-pika` for a fully async consumer, or running the consumer as a separate process (like the Node email worker pattern).
