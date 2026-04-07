# TekBook Backend -- Comprehensive Refactoring Plan

---

## 1. Executive Summary

The TekBook backend is a **Node.js/Express 5 API** for a book recommendation system using Prisma (PostgreSQL), Redis sessions, Cloudinary (images), and MinIO (book files). The overall architecture follows a recognizable **Controller-Service-Mapper** layered pattern, which is a strong foundation. However, the codebase has accumulated several structural inconsistencies, security gaps, DRY violations, and missing safeguards that will become increasingly painful as the project scales.

**Key Architectural Strengths:**
- Clear separation of concerns (controllers, services, mappers, validators, middlewares)
- Proper JWT access/refresh token rotation with Redis-backed sessions
- Standardized API response format (`ApiResponse`)
- Path aliases (`#imports`) for clean internal imports

**Key Architectural Weaknesses:**
- No global error-handling middleware -- every controller has its own try/catch with duplicated logic
- `authService.js` doubles as both a service AND a mapper (violating its own convention)
- Inconsistent export patterns (mixed named exports + default object exports on the same module)
- Missing authorization checks on critical admin routes (author CRUD)
- `console.log` statements scattered throughout production code
- `bookService.js` is a 600-line monolith mixing admin and user concerns
- No input validation on most non-auth endpoints
- Unused dependencies in `package.json` (`@google-cloud/storage`)

---

## 2. Key Findings

### 2.1 Architecture & Design

| # | File(s) | Finding | Severity |
|---|---------|---------|----------|
| A1 | `app/index.js` | **No global error handler.** Express 5 supports async error propagation, but there is no `app.use((err, req, res, next) => ...)` middleware. Every controller manually wraps logic in try/catch and calls `ApiResponse.error()`. This is the single biggest source of code duplication. | **Critical** |
| A2 | `services/authService.js` | Contains its own `transformUser()` mapper AND `USER_SELECT_FIELDS` duplicated from `services/userService.js`. Violates the project's own convention where services return raw Prisma entities and mappers do the transformation. | High |
| A3 | `services/bookService.js` | **600+ line monolith** mixing admin CRUD (create, update, hard-delete) with user-facing reads (getAllBooks, getBooksByGenre). Should be split into `bookService.js` (user reads) and `adminBookService.js` (admin mutations). | High |
| A4 | `controllers/Users/UserController.js` | **God controller** -- 450+ lines handling profiles, favorites, history, ratings, AND admin user management (ban/unban). Violates Single Responsibility. | High |
| A5 | `routes/Users/authorRoute.js` | Admin author routes (`/admin/authors/*`) are registered inside a User-domain route file. They also **lack `authorizeRole(ROLES.ADMIN)`** middleware -- any authenticated user can create/update/delete authors. | **Critical** |
| A6 | `routes/Admin/AdminRoute.js` | `GET /admin/books/genres` lacks `authenticateToken` and `authorizeRole` -- genres admin listing is publicly accessible. | High |
| A7 | `routes/index.js` | No route-level prefix structure. All routers are mounted at the same level, relying on each route file to repeat `/admin/`, `/users/`, `/books/` prefixes. Should use `router.use('/admin', AdminRouter)` etc. | Medium |
| A8 | Multiple services | Dual export pattern: both individual named exports AND a service object are exported from the same module. Controllers import sometimes from the named exports, sometimes from the object. Pick one. | Medium |

### 2.2 Code Quality & Principles

| # | File(s) | Finding | Severity |
|---|---------|---------|----------|
| Q1 | All controllers | **DRY violation**: Identical `try { ... } catch (error) { logger.error(...); return ApiResponse.error(..., 500); }` pattern repeated 40+ times. Should be replaced by a global error handler + `asyncHandler` wrapper. | **Critical** |
| Q2 | `controllers/Auth/AuthController.js`, `controllers/Auth/TokenController.js` | `getClientMetadata()` and `buildUserPayload()` are duplicated across both files. | Medium |
| Q3 | `controllers/Users/UserController.js` | Authorization check `if (req.user.userId !== userId)` is repeated **8 times** across favorites, history, ratings, password, avatar endpoints. Should be extracted to a reusable middleware like `authorizeOwner`. | High |
| Q4 | `services/authService.js`, `services/userService.js` | `USER_SELECT_FIELDS` is defined identically in both files. | Medium |
| Q5 | `utils/jwt.js` | Environment variable names have typos: `JWT_ACCESS_SECRECT` and `JWT_REFRESH_SECRECT` (should be `SECRET`). This will cause confusion and is a deployment risk. | Medium |
| Q6 | Multiple files | `console.log()` used in production code: `BookController.js` (Users), `DashboardController.js`, `bookService.js`, `storage.service.js`, `AuthController.js`. Should use `logger` exclusively. | Medium |
| Q7 | `services/bookService.js` | `getAdminBooks` and `getDeletedBooks` contain inline response mapping (snake_case to camelCase) inside the service. This should be in a mapper, consistent with the rest of the codebase. | Medium |
| Q8 | `utils/error.js` | Custom error classes (`AppError`, `NotFoundError`, etc.) and `handlePrismaError()` are defined but **never used anywhere** in the codebase. All error handling is manual `ApiResponse.error()`. | High |

### 2.3 Security

| # | File(s) | Finding | Severity |
|---|---------|---------|----------|
| S1 | `routes/Users/authorRoute.js` | **Missing `authorizeRole` on admin author routes.** Any authenticated user can create, update, or delete authors. | **Critical** |
| S2 | `routes/Admin/AdminRoute.js` | `GET /admin/books/genres` is public (no auth middleware). Admin data exposed. | High |
| S3 | `routes/Users/userRoute.js` | `PATCH /users/:userId/ban` and `/unban` only require `authenticateToken` but **not `authorizeRole(ROLES.ADMIN)`**. Any logged-in user can ban any other user. | **Critical** |
| S4 | `controllers/Auth/AuthController.js` | Google OAuth passes access token via URL query string in redirect (`?token=${accessToken}`). This is logged in browser history and server access logs. Should use a short-lived authorization code or set it in an HttpOnly cookie. | Medium |
| S5 | `controllers/Users/UserController.js` | `updateUserProfile` logs the **full request body** including potentially sensitive data: `logger.info('Updating profile ... ${JSON.stringify(req.body)}')`. | Medium |
| S6 | `services/authService.js` | OAuth users get a `crypto.randomBytes(32).toString('hex')` password stored **unhashed** in the DB. If the DB is compromised, these are plaintext tokens. Should be bcrypt-hashed like regular passwords. | Medium |
| S7 | `controllers/Users/BookMarkController.js` | Bookmark operations validate `req.user.userId !== userId` for ownership, but `getBookmarks` does **not** check ownership -- any authenticated user can read another user's bookmarks by passing a different `userId` in the URL. | Medium |

### 2.4 Performance

| # | File(s) | Finding | Severity |
|---|---------|---------|----------|
| P1 | `services/bookService.js` `createBook/updateBook` | Author find-or-create runs **sequential** `findFirst` + `create` queries in a loop (N+1). Should use `createMany` with conflict handling or at least batch the lookups. | Medium |
| P2 | `services/dashboardService.js` | `getTopRatedBooks` and `getTopFavoritedBooks` perform an **extra** `groupBy` query just to get the total count for pagination. The first `groupBy` already returns all groups -- just count the array length or use a separate `count` approach. | Low |
| P3 | `services/bookService.js` | `getMostReadBooks` performs two sequential queries (groupBy + findMany). The second query doesn't filter `is_deleted: false`, so soft-deleted books appear in "most read". | Medium |
| P4 | `services/sessionStore.js` `getUserSessions` | Fetches session data with individual `hGetAll` calls in a loop. Should use Redis pipeline. | Low |
| P5 | `services/bookService.js` | `getAllBooks` hardcodes `limit = 12` inside the service. Should accept it as a parameter. | Low |

### 2.5 Maintainability

| # | File(s) | Finding | Severity |
|---|---------|---------|----------|
| M1 | `routes/Users/genreRoute.js` | Route `GET /genres/limit` is registered **after** `GET /genres/:genreId`, so `/genres/limit` will be caught by the `:genreId` param route and "limit" will be treated as a genre ID. Route ordering bug. | **Critical** |
| M2 | `package.json` | `@google-cloud/storage` (7.18.0) is listed as a dependency but never imported anywhere. Dead dependency. | Low |
| M3 | `package.json` | `main` is set to `index.js` but the actual entry point is `server.js`. Misleading for tooling. | Low |
| M4 | `controllers/Users/UserController.js` | `getBookRatings` uses `userId` from `req.params`, while most other user endpoints extract it from `req.user`. Inconsistent pattern. | Low |
| M5 | `controllers/Users/UserController.js` | `createOrUpdateRating` takes `userId` from `req.params` but the ownership check compares `req.user.userId !== userId` -- where `userId` is a string from params and `req.user.userId` is from JWT (also string, but prone to type mismatch with BigInt). | Medium |

---

## 3. Proposed Architecture / Folder Structure

The current structure is mostly sound. The recommended changes are **targeted improvements**, not a wholesale rewrite:

```
app/
├── config/                         # (unchanged)
│   ├── cloudinary.config.js
│   ├── redis.js
│   └── storageConfig.js
├── constants/                      # (unchanged)
│   ├── roles.js
│   └── tokenTypes.js
├── controllers/
│   ├── admin/                      # Rename: consistent lowercase
│   │   ├── book.controller.js      # Rename: consistent kebab-case
│   │   ├── dashboard.controller.js
│   │   ├── genre.controller.js
│   │   ├── author.controller.js    # NEW: Move admin author logic here
│   │   └── user.controller.js      # NEW: Extract ban/unban/getAllUsers
│   ├── auth/                       # Rename: lowercase
│   │   ├── auth.controller.js
│   │   ├── token.controller.js
│   │   ├── password-reset.controller.js
│   │   └── activate-account.controller.js
│   └── user/                       # Rename: singular, lowercase
│       ├── profile.controller.js   # NEW: Split from UserController
│       ├── favorite.controller.js  # NEW: Split from UserController
│       ├── history.controller.js   # NEW: Split from UserController
│       ├── rating.controller.js    # NEW: Split from UserController
│       ├── bookmark.controller.js
│       ├── book.controller.js
│       └── genre.controller.js
├── generated/                      # (unchanged -- Prisma generated)
├── lib/
│   └── prisma.js
├── mappers/                        # (unchanged)
├── middlewares/
│   ├── authenticateToken.js
│   ├── authorize.middleware.js
│   ├── authorizeOwner.middleware.js # NEW: Extract repeated ownership checks
│   ├── asyncHandler.js             # NEW: Wraps async route handlers
│   ├── errorHandler.js             # NEW: Global error handler
│   ├── rateLimit.middleware.js
│   ├── upload.middleware.js
│   └── validation.middleware.js
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── routes/
│   ├── index.js                    # Use router.use('/admin', adminRouter) prefixes
│   ├── auth.routes.js
│   ├── admin/                      # Lowercase
│   │   ├── index.js                # Aggregates all admin sub-routers
│   │   ├── book.routes.js
│   │   ├── genre.routes.js
│   │   ├── author.routes.js
│   │   ├── user.routes.js
│   │   └── dashboard.routes.js
│   └── user/                       # Lowercase, singular
│       ├── index.js
│       ├── book.routes.js
│       ├── genre.routes.js
│       ├── profile.routes.js
│       ├── favorite.routes.js
│       ├── history.routes.js
│       ├── rating.routes.js
│       └── bookmark.routes.js
├── services/
│   ├── auth.service.js             # Rename: remove internal mapper
│   ├── book.service.js             # User-facing reads only
│   ├── admin-book.service.js       # NEW: Admin CRUD operations
│   ├── user.service.js
│   ├── session-store.service.js
│   ├── email.service.js
│   ├── activate-account.service.js
│   ├── password-reset.service.js
│   ├── bookmark.service.js
│   ├── favorite.service.js
│   ├── genre.service.js
│   ├── history.service.js
│   ├── rating.service.js
│   ├── dashboard.service.js
│   ├── author.service.js
│   └── storage.service.js
├── utils/                          # (unchanged)
│   ├── error.js
│   ├── file.utils.js
│   ├── hashPassword.js
│   ├── index.js
│   ├── jwt.js
│   ├── logger.js
│   ├── response.js
│   └── token.util.js
└── validators/
    ├── auth.validator.js
    ├── book.validator.js           # NEW
    ├── user.validator.js           # NEW
    └── genre.validator.js          # NEW
```

**Key changes:**
1. Consistent lowercase directory names (no `Admin/`, `Users/`, `Auth/`)
2. Consistent file naming with kebab-case or dot-notation (`book.controller.js`)
3. Split the god `UserController` into domain-specific controllers
4. Move admin author routes/controller out of the user domain
5. Add missing middleware (`asyncHandler`, `errorHandler`, `authorizeOwner`)
6. Add validators for non-auth endpoints

---

## 4. Step-by-Step Refactoring Plan

### Phase 1: Critical Security Fixes (Do Immediately)

These are bugs that can be exploited in production right now.

#### Step 1.1: Fix Missing Authorization on Author Admin Routes
**What:** Add `authorizeRole(ROLES.ADMIN)` to author create/update/delete routes.
**Why:** Any authenticated user can currently modify authors.
**File:** `routes/Users/authorRoute.js`

```js
// BEFORE (insecure):
router.post('/admin/authors/create', authenticateToken, createAuthor);

// AFTER:
router.post('/admin/authors/create', authenticateToken, authorizeRole(ROLES.ADMIN), createAuthor);
router.put('/admin/authors/update/:authorId', authenticateToken, authorizeRole(ROLES.ADMIN), updateAuthor);
router.delete('/admin/authors/delete/:authorId', authenticateToken, authorizeRole(ROLES.ADMIN), deleteAuthor);
```

#### Step 1.2: Fix Missing Authorization on User Ban/Unban Routes
**What:** Add `authorizeRole(ROLES.ADMIN)` to ban/unban/bulk-ban routes.
**Why:** Any logged-in user can ban other users.
**File:** `routes/Users/userRoute.js`

```js
// BEFORE (insecure):
router.patch('/users/:userId/ban', authenticateToken, banUser);
router.patch('/users/:userId/unban', authenticateToken, unbanUser);
router.patch('/users/ban', authenticateToken, banUsersBulk);

// AFTER:
router.patch('/users/:userId/ban', authenticateToken, authorizeRole(ROLES.ADMIN), banUser);
router.patch('/users/:userId/unban', authenticateToken, authorizeRole(ROLES.ADMIN), unbanUser);
router.patch('/users/ban', authenticateToken, authorizeRole(ROLES.ADMIN), banUsersBulk);
```

#### Step 1.3: Fix Public Admin Genre Listing
**What:** Add auth middleware to `GET /admin/books/genres`.
**File:** `routes/Admin/AdminRoute.js`

```js
// BEFORE:
router.get('/admin/books/genres', getGenresWithPagination);

// AFTER:
router.get('/admin/books/genres', authenticateToken, authorizeRole(ROLES.ADMIN), getGenresWithPagination);
```

#### Step 1.4: Fix Genre Route Ordering Bug
**What:** Move `/genres/limit` above `/genres/:genreId` or rename the endpoint.
**Why:** Express matches routes top-down. `GET /genres/limit` currently hits the `:genreId` handler with `genreId = "limit"`.
**File:** `routes/Users/genreRoute.js`

```js
// BEFORE:
router.get('/genres', getAllGenres);
router.get('/genres/:genreId', getGenreById);
router.get('/genres/limit', getGenresLimit);  // Never reached!

// AFTER:
router.get('/genres', getAllGenres);
router.get('/genres/limit', getGenresLimit);   // Static routes FIRST
router.get('/genres/:genreId', getGenreById);  // Parameterized routes LAST
```

#### Step 1.5: Remove Sensitive Data from Logs
**What:** Stop logging full request bodies.
**File:** `controllers/Users/UserController.js`

```js
// BEFORE:
logger.info(`Updating profile for user ${userId} with data: ${JSON.stringify(req.body)}`);

// AFTER:
logger.info(`Updating profile for user ${userId}`);
```

---

### Phase 2: Foundation & Infrastructure (High Impact)

#### Step 2.1: Create `asyncHandler` Wrapper
**What:** Create a utility that wraps async route handlers and forwards errors to Express's error handler.
**Why:** Eliminates 40+ identical try/catch blocks across all controllers.
**File:** `middlewares/asyncHandler.js`

```js
// BEFORE (every controller):
export const getBooks = async (req, res) => {
  try {
    const books = await bookService.getBooks();
    return ApiResponse.success(res, books, 'Books fetched');
  } catch (error) {
    logger.error('Get books error:', error);
    return ApiResponse.error(res, 'Failed to fetch books', 500);
  }
};

// AFTER:
// middlewares/asyncHandler.js
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// controller usage:
export const getBooks = asyncHandler(async (req, res) => {
  const books = await bookService.getBooks();
  return ApiResponse.success(res, books, 'Books fetched');
});
```

#### Step 2.2: Create Global Error Handler Middleware
**What:** Add a centralized error handler that catches all errors, including the custom `AppError` classes already defined in `utils/error.js`.
**Why:** The `AppError` hierarchy is defined but never used. This gives it a purpose and standardizes error responses.
**File:** `middlewares/errorHandler.js`

```js
import { AppError } from '#utils/error.js';
import { logger } from '#utils/logger.js';

export const errorHandler = (err, req, res, _next) => {
  // If it's an operational AppError, use its status code
  if (err instanceof AppError && err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.errors && { errors: err.errors }),
    });
  }

  // Prisma errors
  if (err.code?.startsWith('P')) {
    const dbErr = handlePrismaError(err);
    return res.status(dbErr.statusCode).json({
      success: false,
      message: dbErr.message,
    });
  }

  // Unexpected errors
  logger.error('Unhandled error:', err);
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
};
```

**Mount in `app/index.js`:**
```js
// After all routes
app.use(baseUrl, Route);
app.use(errorHandler); // Must be last
```

#### Step 2.3: Remove All `console.log` Statements
**What:** Replace every `console.log` with `logger.info` or `logger.debug`, or remove debug-only statements.
**Why:** `console.log` bypasses the logger's formatting and level control. Debug output should never reach production.

**Files to fix:**
- `controllers/Users/BookController.js` -- lines with `console.log('query params:'...)`
- `controllers/Admin/DashboardController.js` -- `console.log('querry params:'...)`
- `controllers/Auth/AuthController.js` -- `console.log('User payload for token:'...)`
- `services/bookService.js` -- `console.log("nextCursor:"...)`
- `services/storage.service.js` -- `console.log("Uploaded file..."...)` and `console.log("Deleted file..."...)`

---

### Phase 3: DRY & Deduplication

#### Step 3.1: Extract `authorizeOwner` Middleware
**What:** Create a reusable middleware that compares `req.user.userId` with a route param.
**Why:** The check `if (req.user.userId !== userId)` is repeated 8+ times.
**File:** `middlewares/authorizeOwner.middleware.js`

```js
/**
 * Middleware that ensures the authenticated user matches the :userId param.
 * Admins bypass the check.
 */
export const authorizeOwner = (paramName = 'userId') => (req, res, next) => {
  const paramId = req.params[paramName];
  const tokenId = String(req.user.userId);

  if (paramId && tokenId !== paramId && req.user.role !== 'ADMIN') {
    return ApiResponse.error(res, 'Unauthorized', 403);
  }
  next();
};
```

#### Step 3.2: Deduplicate `USER_SELECT_FIELDS`
**What:** Move `USER_SELECT_FIELDS` to a shared location (e.g., `constants/prismaSelects.js`) and import from both `authService.js` and `userService.js`.
**Why:** Currently defined identically in two files.

#### Step 3.3: Deduplicate `getClientMetadata` and `buildUserPayload`
**What:** Move these helpers from `AuthController.js` and `TokenController.js` to a shared utility (e.g., `utils/auth.helpers.js`).

#### Step 3.4: Remove Inline Mapping from `authService.js`
**What:** Make `authService` return raw Prisma entities (like all other services), and create/reuse the user mapper for transformation. Remove the internal `transformUser()` function.
**Why:** Aligns with the project's own architectural convention and eliminates dual-purpose service code.

---

### Phase 4: Code Organization & SRP

#### Step 4.1: Split `UserController.js`
**What:** Break the 450-line god controller into focused controllers:
- `profile.controller.js` -- getUserProfile, updateUserProfile, updateUserAvatar, changeUserPassword
- `favorite.controller.js` -- getUserFavorites, addFavorite, removeFavorite
- `history.controller.js` -- getUserHistory, recordHistory
- `rating.controller.js` -- getBookRatings, createOrUpdateRating, deleteRating, getAverageRating
- `admin/user.controller.js` -- getAllUsers, banUser, unbanUser, banUsersBulk

**Why:** Single Responsibility Principle. Each controller should handle one domain concept.

#### Step 4.2: Split `bookService.js`
**What:** Extract admin-specific functions into `admin-book.service.js`:
- `getAdminBooks`, `getDeletedBooks`, `createBook`, `updateBook`, `deleteBook`, `deleteBooksBulk`, `restoreBook`, `hardDeleteBook`

Keep user-facing reads in `bookService.js`:
- `getAllBooks`, `getBooksByGenre`, `getBookById`, `getBookPreview`, `getMostReadBooks`, `getBookByKeyword`, `getBookReadUrl`, `getBookDownloadUrl`, `getSameGenreBooks`

**Why:** Separation of admin vs. user concerns reduces cognitive load and makes access control clearer.

#### Step 4.3: Move Admin Author Routes to Admin Domain
**What:** Move `createAuthor`, `updateAuthor`, `deleteAuthor` routes from `routes/Users/authorRoute.js` to `routes/Admin/AdminRoute.js` (or a new `routes/admin/author.routes.js`).
**Why:** Admin operations should not be in user route files.

#### Step 4.4: Standardize Export Patterns
**What:** Choose ONE export pattern for services and use it consistently. Recommended: **named exports only** (drop the redundant service object).
**Why:** The dual pattern (`export const fn` + `export const fooService = { fn }`) is confusing and leads to inconsistent imports.

```js
// BEFORE:
export const getAllGenres = async () => { ... };
export const genreService = { getAllGenres, ... };

// AFTER (pick one):
// Option A: Named exports (recommended for tree-shaking):
export const getAllGenres = async () => { ... };

// Option B: Service object (if you prefer OOP-style):
class GenreService { ... }
export const genreService = new GenreService();
```

---

### Phase 5: Input Validation

#### Step 5.1: Add Validators for Non-Auth Endpoints
**What:** Create Joi schemas for:
- Book mutations (title required, publicationYear is number, etc.)
- Genre mutations (name required)
- User profile updates (username length, phone format)
- Rating creation (value 1-5)
- Bookmark creation

**Why:** Currently only auth endpoints have validation. All other endpoints rely on manual `if (!title)` checks in controllers, which are inconsistent and incomplete.

**Files to create:**
- `validators/book.validator.js`
- `validators/user.validator.js`
- `validators/genre.validator.js`

#### Step 5.2: Validate Path Parameters
**What:** Add `parseInt` validation for route params like `:bookId`, `:genreId`, `:userId`. Currently, non-numeric values are passed directly to `BigInt()`, which throws an unhandled error.
**Why:** Prevents 500 errors from `BigInt("abc")`.

```js
// Example: validators/common.validator.js
export const idParamSchema = Joi.object({
  bookId: Joi.string().pattern(/^\d+$/).required().messages({
    'string.pattern.base': 'Invalid ID format',
  }),
});

// Usage in route:
router.get('/books/:bookId', validate(idParamSchema, 'params'), getBookById);
```

---

### Phase 6: Remaining Security Hardening

#### Step 6.1: Hash OAuth Random Passwords
**What:** In `authService.js` `findOrCreateOAuthUser`, bcrypt-hash the random password before storing.
**Why:** Plaintext random strings in the DB are a risk if the database is compromised.

```js
// BEFORE:
password: generateSecureRandomPassword(),

// AFTER:
password: await hashPassword(generateSecureRandomPassword()),
```

#### Step 6.2: Fix Google OAuth Token in URL
**What:** Instead of passing the access token in the redirect URL query string, set it in an HttpOnly cookie or use a short-lived authorization code that the frontend exchanges for tokens via a separate API call.
**Why:** URL tokens are logged in browser history, server logs, and referrer headers.

#### Step 6.3: Add Bookmark Ownership Check on Read
**What:** In `getBookmarks`, verify `req.user.userId` matches the `userId` param.
**Why:** Currently any authenticated user can read another user's bookmarks.

---

### Phase 7: Performance & Cleanup

#### Step 7.1: Fix `getMostReadBooks` Missing Soft-Delete Filter
**What:** Add `is_deleted: false` to the `findMany` query in `getMostReadBooks`.

```js
const books = await prisma.books.findMany({
  where: {
    book_id: { in: bookIds },
    is_deleted: false,  // ADD THIS
  },
  ...
});
```

#### Step 7.2: Fix Environment Variable Typos
**What:** Rename `JWT_ACCESS_SECRECT` to `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRECT` to `JWT_REFRESH_SECRET` across `.env`, `jwt.js`, and any deployment configs.
**Why:** Typos in env var names cause confusion and deployment bugs.

#### Step 7.3: Remove Unused Dependencies
**What:** Remove `@google-cloud/storage` from `package.json`. It's never imported.

#### Step 7.4: Fix `package.json` Entry Point
**What:** Change `"main": "index.js"` to `"main": "server.js"`.

#### Step 7.5: Parameterize Hardcoded Values
**What:** In `bookService.js`, `getAllBooks` hardcodes `limit = 12`. Accept it as a parameter with a default.

```js
// BEFORE:
const getAllBooks = async (cursorId) => {
  const limit = 12;

// AFTER:
const getAllBooks = async (cursorId, limit = 12) => {
```

#### Step 7.6: Batch Author Lookups in Book Create/Update
**What:** Instead of sequential `findFirst` + `create` in a loop for author names, batch the lookups.

```js
// BEFORE (N+1):
for (const name of authorNames) {
  let author = await prisma.authors.findFirst({ where: { author_name: trimmed } });
  if (!author) {
    author = await prisma.authors.create({ data: { author_name: trimmed } });
  }
  resolvedAuthorIds.push(author.author_id);
}

// AFTER (2 queries max):
const existingAuthors = await prisma.authors.findMany({
  where: { author_name: { in: authorNames.map(n => n.trim()).filter(Boolean) } },
});
const existingMap = new Map(existingAuthors.map(a => [a.author_name, a.author_id]));

const newNames = authorNames
  .map(n => n.trim())
  .filter(n => n && !existingMap.has(n));

if (newNames.length > 0) {
  await prisma.authors.createMany({
    data: newNames.map(name => ({ author_name: name })),
    skipDuplicates: true,
  });
  const newAuthors = await prisma.authors.findMany({
    where: { author_name: { in: newNames } },
  });
  newAuthors.forEach(a => existingMap.set(a.author_name, a.author_id));
}

const resolvedAuthorIds = authorNames
  .map(n => existingMap.get(n.trim()))
  .filter(Boolean);
```

---

### Phase 8: Testing & Observability

#### Step 8.1: Set Up a Real Test Framework
**What:** Replace the `"test": "echo \"Error: no test specified\" && exit 1"` script with a real test setup using Vitest or Jest.
**Why:** No tests means no safety net for all the refactoring above.

#### Step 8.2: Upgrade Logger for Production
**What:** Replace the custom `Logger` class with Pino or Winston. Add request ID tracking, structured JSON output, and log levels from environment.
**Why:** The current logger is console-only with no log levels in production, no structured format, and no request correlation.

---

## 5. Priority Summary

| Priority | Steps | Effort |
|----------|-------|--------|
| **P0 -- Do Now** | 1.1, 1.2, 1.3, 1.4, 1.5 | ~1 hour |
| **P1 -- This Sprint** | 2.1, 2.2, 2.3, 3.1, 6.3 | ~4 hours |
| **P2 -- Next Sprint** | 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2 | ~8 hours |
| **P3 -- Planned** | 6.1, 6.2, 7.1-7.6 | ~4 hours |
| **P4 -- Nice to Have** | 8.1, 8.2 | ~8 hours |

---

*Generated on 2026-04-07 for the TekBook Backend project.*
