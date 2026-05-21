/**
 * tests/setup/global.js
 * Runs once before all test files.
 * Sets up environment variables and global mocks for external dependencies.
 */
import { vi, afterEach } from 'vitest';

// ── Environment variables ─────────────────────────────────────────────────
process.env.NODE_ENV           = 'test';
process.env.PORT               = '8080';
process.env.BASE_URL           = '/api/v1';
process.env.JWT_ACCESS_SECRECT  = 'test-access-secret-at-least-32-characters-long';
process.env.JWT_REFRESH_SECRECT = 'test-refresh-secret-at-least-32-characters-long';
process.env.FRONTEND_URL        = 'http://localhost:5173';
process.env.REDIS_HOST          = 'localhost';
process.env.REDIS_PORT          = '6379';
process.env.REDIS_PASSWORD      = 'test-redis-pass';
process.env.RABBITMQ_URL        = 'amqp://guest:guest@localhost:5672';
process.env.RABBITMQ_USER       = 'guest';
process.env.RABBITMQ_PASSWORD   = 'guest';
process.env.DATABASE_URL        = 'postgresql://test:test@localhost:5432/testdb';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY    = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-secret';
process.env.MINIO_ENDPOINT   = 'http://localhost:9000';
process.env.MINIO_ACCESS_KEY = 'minioadmin';
process.env.MINIO_SECRET_KEY = 'minioadmin';
process.env.MINIO_BUCKET     = 'test-bucket';
process.env.RECOMMENDATION_SERVICE_URL = 'http://localhost:8003';
process.env.RESEND_API_KEY   = 'test-resend-key';

// ── Mock: Prisma client ────────────────────────────────────────────────────
vi.mock('../../app/lib/prisma.js', () => ({
  prisma: {
    users: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    books: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    roles: {
      findUnique: vi.fn(),
    },
    ratings: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
    },
    favorites: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    bookmarks: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    reading_history: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    genres: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    authors: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    book_genres: {
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    book_authors: {
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    book_formats: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    book_types: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    user_tokens: {
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((ops) =>
      Array.isArray(ops) ? Promise.all(ops) : ops({ 
        users: { findUnique: vi.fn(), update: vi.fn() },
        user_tokens: { create: vi.fn(), delete: vi.fn() },
        book_authors: { deleteMany: vi.fn() },
        book_genres: { deleteMany: vi.fn() },
        book_formats: { deleteMany: vi.fn() },
        bookmarks: { deleteMany: vi.fn() },
        favorites: { deleteMany: vi.fn() },
        ratings: { deleteMany: vi.fn() },
        reading_history: { deleteMany: vi.fn() },
        books: { delete: vi.fn() },
      })
    ),
  },
  PrismaClient: vi.fn(),
}));

// ── Mock: Redis client ─────────────────────────────────────────────────────
const redisMock = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  setEx: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  hSet: vi.fn().mockResolvedValue(1),
  hGetAll: vi.fn().mockResolvedValue({}),
  expire: vi.fn().mockResolvedValue(1),
  sAdd: vi.fn().mockResolvedValue(1),
  sRem: vi.fn().mockResolvedValue(1),
  sMembers: vi.fn().mockResolvedValue([]),
  type: vi.fn().mockResolvedValue('string'),
  ttl: vi.fn().mockResolvedValue(3600),
  multi: vi.fn(() => ({
    del: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  })),
  scan: vi.fn().mockResolvedValue({ cursor: '0', keys: [] }),
  scanIterator: vi.fn().mockReturnValue((async function* () {}())),
  quit: vi.fn().mockResolvedValue('OK'),
};

vi.mock('../../app/config/redis.js', () => ({
  redisClient: {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    getClient: vi.fn().mockReturnValue(redisMock),
    isConnected: true,
    client: redisMock,
  },
}));

// ── Mock: RabbitMQ client ──────────────────────────────────────────────────
vi.mock('../../app/config/rabbitmq.js', () => ({
  rabbitmq: {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockReturnValue(true),
    consume: vi.fn().mockResolvedValue(undefined),
    isConnected: true,
  },
  QUEUES: {
    EMAIL: 'email_queue',
    RS_FEEDBACK: 'rs_feedback_queue',
    RS_RETRAIN: 'rs_retrain_queue',
    CACHE_INVALIDATION: 'cache_invalidation_queue',
  },
}));

// ── Mock: Cloudinary ────────────────────────────────────────────────────────
vi.mock('../../app/config/cloudinary.config.js', () => ({
  default: {
    uploader: {
      upload_stream: vi.fn((_opts, cb) => {
        const stream = { end: vi.fn() };
        setTimeout(() => cb(null, { secure_url: 'https://res.cloudinary.com/test/image/upload/test.jpg', public_id: 'test/test' }), 0);
        return stream;
      }),
      destroy: vi.fn().mockResolvedValue({ result: 'ok' }),
    },
  },
  CLOUDINARY_FOLDERS: {
    COVERS: 'book-covers',
    AVATARS: 'avatars',
  },
}));

// ── Mock: MinIO / S3 ────────────────────────────────────────────────────────
vi.mock('../../app/config/storageConfig.js', () => ({
  generatePresignedUrl: vi.fn().mockResolvedValue('https://minio.example.com/test-bucket/test-key?signature=xxx'),
  uploadToMinio: vi.fn().mockResolvedValue({ key: 'books/test-uuid.pdf' }),
  deleteFromMinio: vi.fn().mockResolvedValue(undefined),
  normalizeKey: vi.fn((key) => key),
  MINIO_BUCKET: 'test-bucket',
}));

// ── Mock: Resend email ──────────────────────────────────────────────────────
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'mock-email-id' }, error: null }),
    },
  })),
}));

// ── Mock: Google Auth Library ───────────────────────────────────────────────
vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(function () {
    return {
      verifyIdToken: vi.fn().mockResolvedValue({
        getPayload: vi.fn().mockReturnValue({
          email: 'oauth@google.com',
          name: 'OAuth User',
          picture: 'https://example.com/avatar.jpg',
        }),
      }),
    };
  }),
}));

// ── Global cleanup ─────────────────────────────────────────────────────────
afterEach(() => {
  vi.clearAllMocks();
});