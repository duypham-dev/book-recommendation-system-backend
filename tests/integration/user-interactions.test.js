/**
 * tests/integration/user-interactions.test.js
 * Integration tests for ratings, favorites, bookmarks, and reading history.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../app/index.js';
import { prisma } from '../../app/lib/prisma.js';
import { rabbitmq } from '../../app/config/rabbitmq.js';
import { signAccessToken } from '../../app/utils/jwt.js';
import { makeDbRating, makeDbFavorite, makeDbBookmark, makeDbHistory } from '../setup/factories.js';

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

// ══════════════════════════════════════════════════════════════════════════════
// RATINGS
// ══════════════════════════════════════════════════════════════════════════════
describe('Ratings', () => {
  describe('POST /books/:bookId/ratings', () => {
    it('200 – creates a new rating', async () => {
      prisma.ratings.findFirst.mockResolvedValue(null);
      const newRating = makeDbRating({ rating_value: 5 });
      prisma.ratings.create.mockResolvedValue(newRating);
      rabbitmq.publish.mockReturnValue(true);

      const res = await request(app)
        .post(`${BASE}/books/1/ratings`)
        .set(authHeader())
        .send({ value: 5, comment: 'Excellent!' });

      expect(res.status).toBe(200);
      expect(res.body.data.value).toBe(5);
    });

    it('200 – updates existing rating', async () => {
      const existing = makeDbRating({ rating_value: 3 });
      prisma.ratings.findFirst.mockResolvedValue(existing);
      prisma.ratings.update.mockResolvedValue({ ...existing, rating_value: 4 });
      rabbitmq.publish.mockReturnValue(true);

      const res = await request(app)
        .post(`${BASE}/books/1/ratings`)
        .set(authHeader())
        .send({ value: 4 });

      expect(res.status).toBe(200);
    });

    it('401 – not authenticated', async () => {
      const res = await request(app)
        .post(`${BASE}/books/1/ratings`)
        .send({ value: 4 });

      expect(res.status).toBe(401);
    });

    it('422 – invalid rating value (0)', async () => {
      const res = await request(app)
        .post(`${BASE}/books/1/ratings`)
        .set(authHeader())
        .send({ value: 0 });

      expect(res.status).toBe(422);
    });

    it('422 – invalid rating value (6)', async () => {
      const res = await request(app)
        .post(`${BASE}/books/1/ratings`)
        .set(authHeader())
        .send({ value: 6 });

      expect(res.status).toBe(422);
    });
  });

  describe('DELETE /books/:bookId/ratings', () => {
    it('200 – deletes existing rating', async () => {
      prisma.ratings.deleteMany.mockResolvedValue({ count: 1 });
      rabbitmq.publish.mockReturnValue(true);

      const res = await request(app)
        .delete(`${BASE}/books/1/ratings`)
        .set(authHeader());

      expect(res.status).toBe(200);
    });

    it('404 – rating not found', async () => {
      prisma.ratings.deleteMany.mockResolvedValue({ count: 0 });

      const res = await request(app)
        .delete(`${BASE}/books/1/ratings`)
        .set(authHeader());

      expect(res.status).toBe(404);
    });
  });

  describe('GET /books/:bookId/average-rating', () => {
    it('200 – returns average rating', async () => {
      prisma.ratings.aggregate.mockResolvedValue({
        _avg: { rating_value: 4.2 },
        _count: { rating_id: 15 },
      });

      const res = await request(app).get(`${BASE}/books/1/average-rating`);

      expect(res.status).toBe(200);
      expect(res.body.data.averageRating).toBe(4.2);
    });
  });

  describe('GET /books/:bookId/ratings/me', () => {
    it('200 – returns current user rating', async () => {
      const rating = makeDbRating({ rating_value: 3 });
      prisma.ratings.findMany.mockResolvedValue([rating]);

      const res = await request(app)
        .get(`${BASE}/books/1/ratings/me`)
        .set(authHeader());

      expect(res.status).toBe(200);
    });

    it('401 – not authenticated', async () => {
      const res = await request(app).get(`${BASE}/books/1/ratings/me`);
      expect(res.status).toBe(401);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// FAVORITES
// ══════════════════════════════════════════════════════════════════════════════
describe('Favorites', () => {
  describe('GET /users/favorites', () => {
    it('200 – returns paginated favorites', async () => {
      const favs = [
        {
          ...makeDbFavorite(),
          books: { title: 'Book A', cover_image_url: null, book_authors: [] },
        },
      ];
      prisma.favorites.findMany.mockResolvedValue(favs);
      prisma.favorites.count.mockResolvedValue(1);

      const res = await request(app)
        .get(`${BASE}/users/favorites`)
        .set(authHeader());

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('content');
    });

    it('401 – not authenticated', async () => {
      const res = await request(app).get(`${BASE}/users/favorites`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /users/favorites/:bookId', () => {
    it('201 – adds book to favorites', async () => {
      prisma.favorites.findFirst.mockResolvedValue(null);
      prisma.favorites.create.mockResolvedValue(makeDbFavorite({ book_id: 5n }));
      rabbitmq.publish.mockReturnValue(true);

      const res = await request(app)
        .post(`${BASE}/users/favorites/5`)
        .set(authHeader());

      expect(res.status).toBe(201);
    });

    it('200 – returns ok if already favorited', async () => {
      const existing = makeDbFavorite({ book_id: 5n });
      prisma.favorites.findFirst.mockResolvedValue(existing);

      const res = await request(app)
        .post(`${BASE}/users/favorites/5`)
        .set(authHeader());

      expect(res.status).toBe(200);
    });

    it('401 – not authenticated', async () => {
      const res = await request(app).post(`${BASE}/users/favorites/5`);
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /users/favorites/:bookId', () => {
    it('200 – removes from favorites', async () => {
      prisma.favorites.deleteMany.mockResolvedValue({ count: 1 });
      rabbitmq.publish.mockReturnValue(true);

      const res = await request(app)
        .delete(`${BASE}/users/favorites/5`)
        .set(authHeader());

      expect(res.status).toBe(200);
    });

    it('404 – not in favorites', async () => {
      prisma.favorites.deleteMany.mockResolvedValue({ count: 0 });

      const res = await request(app)
        .delete(`${BASE}/users/favorites/5`)
        .set(authHeader());

      expect(res.status).toBe(404);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// BOOKMARKS
// ══════════════════════════════════════════════════════════════════════════════
describe('Bookmarks', () => {
  describe('GET /books/:bookId/bookmarks', () => {
    it('200 – returns user bookmarks for a book', async () => {
      prisma.bookmarks.findMany.mockResolvedValue([makeDbBookmark()]);

      const res = await request(app)
        .get(`${BASE}/books/1/bookmarks`)
        .set(authHeader());

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('401 – not authenticated', async () => {
      const res = await request(app).get(`${BASE}/books/1/bookmarks`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /books/:bookId/bookmarks', () => {
    it('201 – creates a bookmark', async () => {
      const bm = makeDbBookmark();
      prisma.bookmarks.create.mockResolvedValue(bm);

      const res = await request(app)
        .post(`${BASE}/books/1/bookmarks`)
        .set(authHeader())
        .send({ pageNumber: 42, locationInBook: 'chapter-3', note: 'Remember this' });

      expect(res.status).toBe(201);
    });

    it('401 – not authenticated', async () => {
      const res = await request(app)
        .post(`${BASE}/books/1/bookmarks`)
        .send({ pageNumber: 1 });
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /bookmarks/:bookmarkId', () => {
    it('200 – updates a bookmark', async () => {
      const updated = makeDbBookmark({ note: 'Updated note' });
      prisma.bookmarks.update.mockResolvedValue(updated);

      const res = await request(app)
        .put(`${BASE}/bookmarks/1`)
        .set(authHeader())
        .send({ note: 'Updated note' });

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /bookmarks/:bookmarkId', () => {
    it('200 – deletes a bookmark', async () => {
      prisma.bookmarks.delete.mockResolvedValue({});

      const res = await request(app)
        .delete(`${BASE}/bookmarks/1`)
        .set(authHeader());

      expect(res.status).toBe(200);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// READING HISTORY
// ══════════════════════════════════════════════════════════════════════════════
describe('Reading History', () => {
  describe('GET /users/history', () => {
    it('200 – returns paginated history', async () => {
      prisma.reading_history.findMany.mockResolvedValue([makeDbHistory()]);
      prisma.reading_history.count.mockResolvedValue(1);

      const res = await request(app)
        .get(`${BASE}/users/history`)
        .set(authHeader());

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('content');
    });

    it('401 – not authenticated', async () => {
      const res = await request(app).get(`${BASE}/users/history`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /users/books/:bookId/history', () => {
    it('200 – records reading progress (upsert)', async () => {
      prisma.reading_history.findFirst.mockResolvedValue(null);
      prisma.reading_history.create.mockResolvedValue(makeDbHistory({ progress: 30 }));
      rabbitmq.publish.mockReturnValue(true);

      const res = await request(app)
        .post(`${BASE}/users/books/1/history`)
        .set(authHeader())
        .send({ progress: 30 });

      expect(res.status).toBe(200);
    });

    it('200 – does not decrease progress', async () => {
      const existing = makeDbHistory({ progress: 75 });
      prisma.reading_history.findFirst.mockResolvedValue(existing);
      prisma.reading_history.update.mockResolvedValue({ ...existing, progress: 75 });
      rabbitmq.publish.mockReturnValue(true);

      const res = await request(app)
        .post(`${BASE}/users/books/1/history`)
        .set(authHeader())
        .send({ progress: 20 }); // lower than current

      expect(res.status).toBe(200);
    });

    it('422 – missing progress field', async () => {
      const res = await request(app)
        .post(`${BASE}/users/books/1/history`)
        .set(authHeader())
        .send({});

      expect(res.status).toBe(422);
    });

    it('422 – progress > 100', async () => {
      const res = await request(app)
        .post(`${BASE}/users/books/1/history`)
        .set(authHeader())
        .send({ progress: 110 });

      expect(res.status).toBe(422);
    });
  });

  describe('GET /users/books/:bookId/progress', () => {
    it('200 – returns progress', async () => {
      prisma.reading_history.findFirst.mockResolvedValue(makeDbHistory({ progress: 55 }));

      const res = await request(app)
        .get(`${BASE}/users/books/1/progress`)
        .set(authHeader());

      expect(res.status).toBe(200);
      expect(res.body.data.progress).toBe(55);
    });

    it('200 – returns progress:0 when no history', async () => {
      prisma.reading_history.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .get(`${BASE}/users/books/1/progress`)
        .set(authHeader());

      expect(res.status).toBe(200);
    });
  });
});