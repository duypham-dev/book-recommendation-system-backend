/**
 * tests/setup/factories.js
 * Mock data factories for all entity types.
 */

let idCounter = 1;
const nextId = () => BigInt(idCounter++);

// ── User ──────────────────────────────────────────────────────────────────
export const makeDbUser = (overrides = {}) => ({
  user_id: nextId(),
  role_id: 2n,
  username: `user_${Date.now()}`,
  email: `user${Date.now()}@example.com`,
  password: '$2b$12$hashedpassword',
  full_name: 'Test User',
  phone_number: '0912345678',
  avatar_url: null,
  is_activate: true,
  is_ban: false,
  created_at: new Date('2024-01-01'),
  updated_at: null,
  roles: { role_id: 2n, role_name: 'USER' },
  ...overrides,
});

export const makeDbAdmin = (overrides = {}) =>
  makeDbUser({ role_id: 1n, roles: { role_id: 1n, role_name: 'ADMIN' }, ...overrides });

// ── Book ──────────────────────────────────────────────────────────────────
export const makeDbBook = (overrides = {}) => ({
  book_id: nextId(),
  title: 'Test Book Title',
  description: 'A test book description.',
  cover_image_url: 'https://res.cloudinary.com/test/image/upload/cover.jpg',
  publication_year: 2023,
  publisher: 'Test Publisher',
  created_at: new Date('2024-01-01'),
  updated_at: null,
  is_deleted: false,
  book_authors: [
    {
      authors: {
        author_id: 1n,
        author_name: 'Test Author',
      },
    },
  ],
  book_genres: [
    {
      genres: {
        genre_id: 1n,
        genre_name: 'Fiction',
      },
    },
  ],
  book_formats: [
    {
      format_id: 1n,
      content_url: 'books/test-uuid.epub',
      book_types: { type_name: 'EPUB' },
    },
  ],
  ...overrides,
});

// ── Genre ─────────────────────────────────────────────────────────────────
export const makeDbGenre = (overrides = {}) => ({
  genre_id: nextId(),
  genre_name: `Genre ${Date.now()}`,
  description: 'A test genre description',
  ...overrides,
});

// ── Author ────────────────────────────────────────────────────────────────
export const makeDbAuthor = (overrides = {}) => ({
  author_id: nextId(),
  author_name: 'Test Author',
  biography: 'A test biography',
  ...overrides,
});

// ── Rating ────────────────────────────────────────────────────────────────
export const makeDbRating = (overrides = {}) => ({
  rating_id: nextId(),
  user_id: 1n,
  book_id: 1n,
  rating_value: 4,
  comment: 'Great book!',
  created_at: new Date('2024-01-01'),
  users: {
    user_id: 1n,
    username: 'testuser',
    full_name: 'Test User',
    avatar_url: null,
  },
  ...overrides,
});

// ── Favorite ──────────────────────────────────────────────────────────────
export const makeDbFavorite = (overrides = {}) => ({
  favorite_id: nextId(),
  user_id: 1n,
  book_id: 1n,
  added_at: new Date('2024-01-01'),
  ...overrides,
});

// ── Bookmark ──────────────────────────────────────────────────────────────
export const makeDbBookmark = (overrides = {}) => ({
  bookmark_id: nextId(),
  user_id: 1n,
  book_id: 1n,
  page_number: 42,
  location_in_book: 'chapter-3',
  note: 'Important passage',
  created_at: new Date('2024-01-01'),
  ...overrides,
});

// ── Reading History ───────────────────────────────────────────────────────
export const makeDbHistory = (overrides = {}) => ({
  history_id: nextId(),
  user_id: 1n,
  book_id: 1n,
  last_read_at: new Date('2024-01-01'),
  progress: 45.5,
  books: {
    book_id: 1n,
    title: 'Test Book',
    cover_image_url: 'https://example.com/cover.jpg',
    book_authors: [],
  },
  ...overrides,
});

// ── Token Record ──────────────────────────────────────────────────────────
export const makeDbToken = (overrides = {}) => ({
  token_id: nextId(),
  user_id: 1n,
  token: 'hashed_token_value',
  type: 'RESET_PASSWORD',
  expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 mins from now
  created_at: new Date(),
  ...overrides,
});

// ── Pagination wrapper ────────────────────────────────────────────────────
export const makePaginated = (data, overrides = {}) => ({
  data,
  pagination: {
    page: 0,
    size: 10,
    totalElements: data.length,
    totalPages: Math.ceil(data.length / 10),
    ...overrides,
  },
});