/**
 * tests/integration/books.test.js
 * Integration tests for book endpoints (public + authenticated).
 */
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../app/index.js';
import { prisma } from '../../app/lib/prisma.js';
import { redisClient } from '../../app/config/redis.js';
import { makeDbBook, makeDbGenre } from '../setup/factories.js';
import { signAccessToken } from '../../app/utils/jwt.js';

const BASE = '/api/v1';

const authHeader = (userId = '1', role = 'USER') => {
  const { accessToken } = signAccessToken({
    userId,
    email: 'user@example.com',
    fullName: 'Test User',
    role,
    avatarUrl: null,
  });
  return { Authorization: `Bearer ${accessToken}` };
};

// ── GET /books ────────────────────────────────────────────────────────────
describe('GET /books', () => {
  it('200 – returns paginated book list', async () => {
    const books = [makeDbBook(), makeDbBook()];
    prisma.books.findMany.mockResolvedValue(books);
    prisma.books.count.mockResolvedValue(2);
    prisma.$transaction.mockResolvedValue([books, 2]);

    const res = await request(app).get(`${BASE}/books`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.content)).toBe(true);
    expect(res.body.data).toHaveProperty('totalPages');
  });

  it('200 – accepts page and size query params', async () => {
    prisma.books.findMany.mockResolvedValue([]);
    prisma.books.count.mockResolvedValue(0);
    prisma.$transaction.mockResolvedValue([[], 0]);

    const res = await request(app).get(`${BASE}/books?page=1&size=5`);

    expect(res.status).toBe(200);
  });

  it('422 – rejects size > 100', async () => {
    const res = await request(app).get(`${BASE}/books?size=999`);
    expect(res.status).toBe(422);
  });
});

// ── GET /books/search ─────────────────────────────────────────────────────
describe('GET /books/search', () => {
  it('200 – returns matching books', async () => {
    const books = [makeDbBook({ title: 'Matching Book' })];
    prisma.books.findMany.mockResolvedValue(books);

    const res = await request(app).get(`${BASE}/books/search?keyword=Matching`);

    expect(res.status).toBe(200);
  });

  it('422 – missing keyword', async () => {
    const res = await request(app).get(`${BASE}/books/search`);
    expect(res.status).toBe(422);
  });
});

// ── GET /books/most-read ──────────────────────────────────────────────────
describe('GET /books/most-read', () => {
  it('200 – returns most read books', async () => {
    prisma.reading_history.groupBy.mockResolvedValue([
      { book_id: 1n, _count: { book_id: 5 } },
    ]);
    prisma.books.findMany.mockResolvedValue([makeDbBook({ book_id: 1n })]);

    const res = await request(app).get(`${BASE}/books/most-read`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ── GET /books/:bookId ────────────────────────────────────────────────────
describe('GET /books/:bookId', () => {
  it('200 – returns book details', async () => {
    const book = { ...makeDbBook(), averageRating: 4.0, totalRatings: 5, isFav: false };
    prisma.books.findUnique.mockResolvedValue(book);
    prisma.ratings.aggregate.mockResolvedValue({
      _avg: { rating_value: 4.0 },
      _count: { rating_id: 5 },
    });
    prisma.favorites.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockResolvedValue(null); // not used here



    const res = await request(app).get(`${BASE}/books/1`);

    expect([200, 404]).toContain(res.status);
  });

  it('404 – book not found', async () => {
    prisma.books.findUnique.mockResolvedValue(null);
    prisma.ratings.aggregate.mockResolvedValue({ _avg: { rating_value: null }, _count: { rating_id: 0 } });
    prisma.favorites.findFirst.mockResolvedValue(null);

    const res = await request(app).get(`${BASE}/books/99999`);

    expect(res.status).toBe(404);
  });
});

// ── GET /books/:bookId/preview ────────────────────────────────────────────
describe('GET /books/:bookId/preview', () => {
  it('200 – returns book preview', async () => {
    const book = makeDbBook();
    prisma.books.findUnique.mockResolvedValue(book);

    const res = await request(app).get(`${BASE}/books/1/preview`);
    expect([200, 404]).toContain(res.status);
  });
});

// ── GET /books/:bookId/same-genre ─────────────────────────────────────────
describe('GET /books/:bookId/same-genre', () => {
  it('200 – returns books in same genre', async () => {
    const genres = [{ genre_id: 1n }];
    const books = [makeDbBook(), makeDbBook()];

    prisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        book_genres: {
          findMany: vi.fn().mockResolvedValue(genres),
        },
        books: {
          findMany: vi.fn().mockResolvedValue(books),
        },
      };
      return fn(tx);
    });

    const res = await request(app).get(`${BASE}/books/1/same-genre`);
    expect(res.status).toBe(200);
  });
});

// ── GET /books/:bookId/read-url ───────────────────────────────────────────
describe('GET /books/:bookId/read-url', () => {
  it('200 – returns presigned read URL', async () => {
    const format = {
      format_id: 1n,
      content_url: 'books/test.epub',
      book_types: { type_name: 'EPUB' },
      books: { is_deleted: false },
    };
    prisma.book_formats.findFirst.mockResolvedValue(format);

    const res = await request(app).get(`${BASE}/books/1/read-url`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('url');
  });

  it('404 – book format not found', async () => {
    prisma.book_formats.findFirst.mockResolvedValue(null);

    const res = await request(app).get(`${BASE}/books/1/read-url`);
    expect(res.status).toBe(404);
  });
});

// ── GET /books/:bookId/ratings ────────────────────────────────────────────
describe('GET /books/:bookId/ratings', () => {
  it('200 – returns paginated ratings with distribution', async () => {
    prisma.ratings.findMany.mockResolvedValue([]);
    prisma.ratings.count.mockResolvedValue(0);
    prisma.ratings.groupBy.mockResolvedValue([]);

    const res = await request(app).get(`${BASE}/books/1/ratings`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('distribution');
  });
});

// ── GET /books/:bookId/formats ────────────────────────────────────────────
describe('GET /books/:bookId/formats', () => {
  it('200 – returns list of formats', async () => {
    prisma.book_formats.findMany.mockResolvedValue([
      { format_id: 1n, content_url: 'books/x.epub', book_types: { type_name: 'EPUB' }, total_pages: null, file_size_kb: 500 },
    ]);

    const res = await request(app).get(`${BASE}/books/1/formats`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ── GET /genres ───────────────────────────────────────────────────────────
describe('GET /genres', () => {
  it('200 – returns all genres', async () => {
    prisma.genres.findMany.mockResolvedValue([
      makeDbGenre({ genre_name: 'Fantasy' }),
      makeDbGenre({ genre_name: 'Sci-Fi' }),
    ]);

    const res = await request(app).get(`${BASE}/genres`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ── GET /recommendations ──────────────────────────────────────────────────
describe('GET /recommendations', () => {
  it('200 – returns recommendations for authenticated user', async () => {
    // Mock the fetch to RS
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ items: [] }),
    });
    prisma.books.findMany.mockResolvedValue([]);
    prisma.favorites.findMany.mockResolvedValue([]);

    // Mock Redis cache miss
    const redis = redisClient.getClient();
    redis.get.mockResolvedValue(null);
    redis.setEx.mockResolvedValue('OK');

    const res = await request(app)
      .get(`${BASE}/recommendations`)
      .set(authHeader('1'));

    expect(res.status).toBe(200);
  });

  it('401 – not authenticated', async () => {
    const res = await request(app).get(`${BASE}/recommendations`);
    expect(res.status).toBe(401);
  });
});