/**
 * tests/unit/mappers.test.js
 * Unit tests for entity → API response mappers.
 */
import { describe, it, expect } from 'vitest';
import { toBookListResponse, toBookDetailResponse, toBookSearchResponse } from '../../app/mappers/book.mapper.js';
import { toGenreResponse, toGenreListResponse, toGenrePaginatedResponse } from '../../app/mappers/genre.mapper.js';
import { toUserResponse, toUserListResponse, toUserPaginatedResponse } from '../../app/mappers/user.mapper.js';
import { toRatingResponse, toRatingCreateResponse, toAverageRatingResponse, toPaginatedRatingResponse } from '../../app/mappers/rating.mapper.js';
import { toFavoriteResponse, toFavoritePaginatedResponse } from '../../app/mappers/favorite.mapper.js';
import { toBookmarkResponse, toBookmarkListResponse } from '../../app/mappers/bookmark.mapper.js';
import { toHistoryResponse, toHistoryPaginatedResponse } from '../../app/mappers/history.mapper.js';
import {
  makeDbBook,
  makeDbGenre,
  makeDbUser,
  makeDbRating,
  makeDbFavorite,
  makeDbBookmark,
  makeDbHistory,
} from '../setup/factories.js';

// ── Book Mapper ───────────────────────────────────────────────────────────
describe('book.mapper', () => {
  it('toBookListResponse maps array of books', () => {
    const books = [makeDbBook(), makeDbBook()];
    const result = toBookListResponse(books);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty('bookId');
    expect(result[0]).toHaveProperty('title');
    expect(result[0]).toHaveProperty('coverImageUrl');
    expect(result[0]).toHaveProperty('authors');
  });

  it('toBookListResponse returns null for null input', () => {
    expect(toBookListResponse(null)).toBeNull();
  });

  it('toBookListResponse handles single book (non-array)', () => {
    const book = makeDbBook();
    const result = toBookListResponse(book);
    expect(result).toHaveProperty('bookId');
  });

  it('toBookDetailResponse includes genres, formats, averageRating', () => {
    const book = { ...makeDbBook(), averageRating: 4.2, totalRatings: 10, isFav: true };
    const result = toBookDetailResponse(book);
    expect(result.averageRating).toBe(4.2);
    expect(result.totalReviews).toBe(10);
    expect(result.isFav).toBe(true);
    expect(Array.isArray(result.genres)).toBe(true);
    expect(Array.isArray(result.formats)).toBe(true);
  });

  it('toBookSearchResponse maps only bookId, title, coverImageUrl, authors', () => {
    const book = makeDbBook();
    const result = toBookSearchResponse(book);
    expect(result).toHaveProperty('bookId');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('authors');
    expect(result).not.toHaveProperty('description');
  });

  it('filters out null entries in array', () => {
    const result = toBookListResponse([null, makeDbBook(), null]);
    expect(result).toHaveLength(1);
  });
});

// ── Genre Mapper ──────────────────────────────────────────────────────────
describe('genre.mapper', () => {
  it('toGenreResponse maps genre_id to genreId', () => {
    const genre = makeDbGenre();
    const result = toGenreResponse(genre);
    expect(result.genreId).toBe(genre.genre_id.toString());
    expect(result.genreName).toBe(genre.genre_name);
  });

  it('toGenreListResponse returns [] for null', () => {
    expect(toGenreListResponse(null)).toEqual([]);
  });

  it('toGenrePaginatedResponse shapes content + pagination', () => {
    const genres = [makeDbGenre(), makeDbGenre()];
    const result = toGenrePaginatedResponse({
      data: genres,
      pagination: { page: 0, size: 10, totalElements: 2, totalPages: 1 },
    });
    expect(result.content).toHaveLength(2);
    expect(result.totalElements).toBe(2);
    expect(result.page).toBe(0);
  });
});

// ── User Mapper ───────────────────────────────────────────────────────────
describe('user.mapper', () => {
  it('toUserResponse includes status derived from is_ban / is_activate', () => {
    const activeUser = makeDbUser({ is_ban: false, is_activate: true });
    expect(toUserResponse(activeUser).status).toBe('ACTIVE');

    const bannedUser = makeDbUser({ is_ban: true });
    expect(toUserResponse(bannedUser).status).toBe('BANNED');

    const inactiveUser = makeDbUser({ is_ban: false, is_activate: false });
    expect(toUserResponse(inactiveUser).status).toBe('INACTIVE');
  });

  it('toUserResponse converts user_id to string', () => {
    const user = makeDbUser();
    const result = toUserResponse(user);
    expect(typeof result.id).toBe('string');
  });

  it('toUserListResponse returns [] for null', () => {
    expect(toUserListResponse(null)).toEqual([]);
  });

  it('toUserPaginatedResponse returns null for null input', () => {
    expect(toUserPaginatedResponse(null)).toBeNull();
  });
});

// ── Rating Mapper ─────────────────────────────────────────────────────────
describe('rating.mapper', () => {
  it('toRatingResponse maps rating_id, rating_value, user info', () => {
    const rating = makeDbRating();
    const result = toRatingResponse(rating);
    expect(typeof result.id).toBe('string');
    expect(result.value).toBe(rating.rating_value);
    expect(result.userName).toBe(rating.users.full_name);
  });

  it('toRatingCreateResponse includes isNew flag', () => {
    const rating = makeDbRating();
    expect(toRatingCreateResponse(rating, true).isNew).toBe(true);
    expect(toRatingCreateResponse(rating, false).isNew).toBe(false);
  });

  it('toAverageRatingResponse returns 0s for null input', () => {
    const result = toAverageRatingResponse(null);
    expect(result.averageRating).toBe(0);
    expect(result.totalRatings).toBe(0);
  });

  it('toPaginatedRatingResponse has distribution', () => {
    const mockResult = {
      ratings: [makeDbRating()],
      total: 1,
      hasMore: false,
      distribution: { 1: { count: 0, percent: 0 }, 5: { count: 1, percent: 100 } },
    };
    const result = toPaginatedRatingResponse(mockResult, 0, 5);
    expect(result).toHaveProperty('distribution');
    expect(result.total).toBe(1);
  });
});

// ── Favorite Mapper ───────────────────────────────────────────────────────
describe('favorite.mapper', () => {
  it('toFavoriteResponse maps book details', () => {
    const fav = {
      ...makeDbFavorite(),
      books: {
        title: 'My Book',
        cover_image_url: 'https://example.com/cover.jpg',
        book_authors: [],
      },
    };
    const result = toFavoriteResponse(fav);
    expect(result.title).toBe('My Book');
    expect(typeof result.id).toBe('string');
  });

  it('toFavoritePaginatedResponse returns null for null input', () => {
    expect(toFavoritePaginatedResponse(null)).toBeNull();
  });
});

// ── Bookmark Mapper ───────────────────────────────────────────────────────
describe('bookmark.mapper', () => {
  it('toBookmarkResponse maps fields correctly', () => {
    const bm = makeDbBookmark();
    const result = toBookmarkResponse(bm);
    expect(typeof result.id).toBe('string');
    expect(result.pageNumber).toBe(42);
    expect(result.note).toBe('Important passage');
  });

  it('toBookmarkListResponse returns [] for null', () => {
    expect(toBookmarkListResponse(null)).toEqual([]);
  });
});

// ── History Mapper ────────────────────────────────────────────────────────
describe('history.mapper', () => {
  it('toHistoryResponse maps progress and book info', () => {
    const history = makeDbHistory();
    const result = toHistoryResponse(history);
    expect(result.progress).toBe(45.5);
    expect(result.book).toHaveProperty('title');
  });

  it('toHistoryPaginatedResponse shapes content + pagination', () => {
    const histories = [makeDbHistory()];
    const result = toHistoryPaginatedResponse({
      data: histories,
      pagination: { page: 0, size: 10, totalElements: 1, totalPages: 1 },
    });
    expect(result.content).toHaveLength(1);
    expect(result.totalElements).toBe(1);
  });
});