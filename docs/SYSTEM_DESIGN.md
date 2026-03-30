# SYSTEM DESIGN DOCUMENT — TekBook Backend

> **Purpose**: Core context document for AI agents performing feature implementation, bug fixes, and refactoring.

---

## 1. Project Overview

### 1.1 What It Does

TekBook is a **book management and recommendation system backend**. It provides a REST API for:

- **User authentication** (email/password + Google OAuth) with session management.
- **Book catalog** browsing, searching, filtering by genre, and reading/downloading via presigned URLs.
- **User interactions** with books: favorites, bookmarks, reading history tracking, and ratings/reviews.
- **Admin dashboard** for managing books (CRUD, soft-delete/restore, hard-delete), genres, authors, users (ban/unban), and viewing aggregated statistics (top-rated, top-favorited, new user trends).
- **Account lifecycle**: registration with email verification, password reset via email tokens, account activation.

### 1.2 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ES Modules) |
| Framework | Express 5 |
| Language | JavaScript (ESM, `"type": "module"`) |
| Database | PostgreSQL |
| ORM | Prisma 7 (with `@prisma/adapter-pg` driver adapter) |
| Cache / Sessions | Redis (via `redis` npm package) |
| Image Storage | Cloudinary (covers, avatars) |
| File Storage | MinIO (S3-compatible, for PDF/EPUB book files) |
| Authentication | JWT (access + refresh tokens), Google OAuth2 |
| Validation | Joi |
| Email | Nodemailer (SMTP) |
| File Upload | Multer (memory storage) |
| Security | Helmet, CORS, express-rate-limit, bcrypt |
| Linting | ESLint 9 (flat config) |

---

## 2. System Architecture & Patterns

### 2.1 Architectural Pattern

**Layered (Service-Oriented) MVC** — a three-tier pattern where:

```
Route → Middleware → Controller → Service → Prisma (Database)
                                     ↓
                                   Mapper → API Response
```

- **Routes** define endpoints and compose middleware chains.
- **Controllers** handle HTTP request/response; extract params, call services, invoke mappers, return `ApiResponse`.
- **Services** contain business logic and all Prisma queries; return raw Prisma entities.
- **Mappers** transform raw Prisma entities (snake_case, BigInt) into API response format (camelCase, string IDs).

### 2.2 Key Design Patterns

| Pattern | Where Used |
|---|---|
| **Service Layer** | All business logic isolated in `services/`. Controllers never call Prisma directly. |
| **Mapper / DTO** | `mappers/` directory transforms DB entities to response format. Controllers call mappers after services. |
| **Singleton** | `RedisClient` class (`config/redis.js`), `prisma` instance (`lib/prisma.js`). |
| **Repository-like** | Services act as repository wrappers around Prisma queries. |
| **Middleware Chain** | Authentication, validation, rate limiting, file upload — all composed as Express middleware per route. |
| **Token Rotation** | Refresh tokens are rotated on every `/auth/refresh` call; old session revoked, new one created atomically. |
| **Soft Delete** | Books use `is_deleted` flag; hard delete is a separate admin-only operation. |
| **Standardized Response** | `ApiResponse` class provides uniform `{ success, message, data }` envelope for all endpoints. |

---

## 3. Directory Structure

```
book-recommendation-system-backend/
├── server.js                    # Entry point: connects Redis, starts Express
├── package.json                 # Dependencies, scripts, path aliases (#imports)
├── prisma.config.js             # Prisma CLI config (schema/migrations path)
├── eslint.config.mjs            # ESLint flat config
├── .env                         # Environment variables (NOT committed)
│
├── app/
│   ├── index.js                 # Express app setup (helmet, cors, morgan, routes)
│   │
│   ├── config/                  # External service configurations
│   │   ├── redis.js             # Redis client (singleton, auto-reconnect)
│   │   ├── cloudinary.config.js # Cloudinary SDK init + folder constants
│   │   └── storageConfig.js     # MinIO S3 client, presigned URL generation, upload/delete
│   │
│   ├── constants/               # Shared constants
│   │   └── tokenTypes.js        # Token type enums, byte sizes, expiry durations
│   │
│   ├── controllers/             # HTTP request handlers (grouped by domain)
│   │   ├── Auth/                # AuthController, TokenController, PasswordResetController, ActivateAccountController
│   │   ├── Users/               # UserController, BookController, GenreController, AuthorController
│   │   └── Admin/               # BookController, DashboardController, GenreController
│   │
│   ├── generated/               # Prisma generated client (auto-generated, do NOT edit)
│   │
│   ├── lib/                     # Core library initialization
│   │   └── prisma.js            # PrismaClient singleton with pg adapter
│   │
│   ├── mappers/                 # Entity → API response transformers
│   │   ├── book.mapper.js       # Book list/detail/preview/search mappers
│   │   ├── user.mapper.js       # User profile/list/paginated mappers
│   │   ├── favorite.mapper.js   # Favorite action/list/paginated mappers
│   │   ├── genre.mapper.js      # Genre response/list/paginated mappers
│   │   ├── rating.mapper.js     # Rating response/average/list mappers
│   │   ├── bookmark.mapper.js   # Bookmark response/list/paginated mappers
│   │   └── history.mapper.js    # History response/list/paginated mappers
│   │
│   ├── middlewares/             # Express middleware
│   │   ├── authenticateToken.js # JWT access token verification → sets req.user
│   │   ├── validation.middleware.js # Joi schema validation (body/query/params)
│   │   ├── upload.middleware.js # Multer config for book files + avatar uploads
│   │   └── rateLimit.middleware.js # Per-endpoint rate limiters (login, register, forgot-password, API)
│   │
│   ├── prisma/                  # Prisma schema and migrations
│   │   ├── schema.prisma        # Database schema definition
│   │   └── migrations/          # SQL migration files
│   │
│   ├── routes/                  # Express route definitions
│   │   ├── index.js             # Root router: mounts all sub-routers + health check
│   │   ├── authRoute.js         # /auth/* endpoints
│   │   ├── Users/               # User-facing routes (books, genres, authors, user profile)
│   │   └── Admin/               # Admin routes (dashboard, book/genre/user management)
│   │
│   ├── services/                # Business logic layer
│   │   ├── authService.js       # User retrieval, creation, OAuth, duplicate checks
│   │   ├── sessionStore.js      # Redis session CRUD (create, validate, rotate, revoke)
│   │   ├── bookService.js       # Book CRUD, search, pagination, presigned URLs, soft/hard delete
│   │   ├── userService.js       # User profile CRUD, admin user management
│   │   ├── favoriteService.js   # Favorite add/remove/list
│   │   ├── historyService.js    # Reading history record/retrieve
│   │   ├── ratingService.js     # Rating CRUD, average calculation, paginated ratings
│   │   ├── bookmarkService.js   # Bookmark CRUD
│   │   ├── genreService.js      # Genre CRUD with pagination
│   │   ├── authorService.js     # Author CRUD with find-or-create
│   │   ├── dashboardService.js  # Aggregated stats (top-rated, top-favorited, new users)
│   │   ├── storage.service.js   # Cloudinary upload/delete wrapper
│   │   ├── emailService.js      # SMTP email sending (password reset, account activation)
│   │   ├── passwordResetService.js # Password reset token flow
│   │   └── activateAccountService.js # Account activation token flow
│   │
│   ├── utils/                   # Shared utilities
│   │   ├── index.js             # Barrel re-export (logger, response, error, jwt)
│   │   ├── response.js          # ApiResponse class (success, error, created, paginated)
│   │   ├── jwt.js               # JWT sign/verify, cookie options, token expiry constants
│   │   ├── hashPassword.js      # bcrypt hash/compare
│   │   ├── logger.js            # Simple console logger (info, error, warn, debug)
│   │   ├── error.js             # AppError hierarchy + Prisma error handler
│   │   ├── token.util.js        # Crypto token generation + SHA-256 hashing
│   │   └── file.utils.js        # Content-type resolution from extension
│   │
│   └── validators/              # Joi validation schemas
│       └── auth.validator.js    # Login, register, forgot-password, reset-password schemas
│
├── tests/                       # Test directory (test infrastructure present but tests not implemented)
├── scripts/                     # Utility scripts
└── docs/                        # Documentation files
```

---

## 4. Core Modules & Components

### 4.1 Module Map

| Module | Responsibility | Key Files |
|---|---|---|
| **Auth** | Registration, login (email + Google OAuth), token refresh, logout, session management, account activation, password reset | `controllers/Auth/*`, `services/authService.js`, `services/sessionStore.js`, `services/passwordResetService.js`, `services/activateAccountService.js`, `services/emailService.js` |
| **Book** | Book catalog (CRUD, search, pagination, presigned read/download URLs), soft-delete/restore, hard-delete | `controllers/Users/BookController.js`, `controllers/Admin/BookController.js`, `services/bookService.js` |
| **User** | Profile management (view, update, avatar, password change), favorites, bookmarks, reading history, ratings | `controllers/Users/UserController.js`, `services/userService.js`, `services/favoriteService.js`, `services/bookmarkService.js`, `services/historyService.js`, `services/ratingService.js` |
| **Genre** | Genre listing, CRUD (admin), pagination with search | `controllers/Users/GenreController.js`, `controllers/Admin/GenreController.js`, `services/genreService.js` |
| **Author** | Author listing, CRUD (admin), find-or-create by name | `controllers/Users/AuthorController.js`, `services/authorService.js` |
| **Admin Dashboard** | Aggregated statistics: total counts, top-rated books, top-favorited books, new user trends | `controllers/Admin/DashboardController.js`, `services/dashboardService.js` |
| **Storage** | Cloudinary (images), MinIO (book files: PDF/EPUB) | `services/storage.service.js`, `config/storageConfig.js`, `config/cloudinary.config.js` |
| **Email** | SMTP-based transactional emails (password reset, account activation) with HTML templates | `services/emailService.js` |

### 4.2 Inter-Module Dependencies

```
Controllers
  ├── import Services (business logic)
  ├── import Mappers (response transformation)
  ├── import Utils (ApiResponse, logger, jwt, hashPassword)
  └── import Storage Service (for file operations in Admin BookController)

Services
  ├── import prisma (from lib/prisma.js)
  ├── import other services (e.g., passwordResetService → emailService)
  └── import utils (token.util, hashPassword)

Middlewares
  ├── authenticateToken → utils/jwt.js (verifyAccessToken)
  ├── validation.middleware → Joi schemas from validators/
  ├── upload.middleware → multer
  └── rateLimit.middleware → express-rate-limit, utils/response.js

Config
  ├── redis.js → standalone Redis singleton
  ├── storageConfig.js → AWS S3 SDK (MinIO)
  └── cloudinary.config.js → Cloudinary SDK
```

---

## 5. Data Flow & State Management

### 5.1 Request Lifecycle (Typical Authenticated Request)

```
1. Client sends HTTP request with Authorization: Bearer <accessToken>
       ↓
2. Express middleware chain:
   a. helmet() — security headers
   b. morgan() — request logging
   c. cookieParser() — parse cookies
   d. express.json() — parse JSON body
   e. cors() — CORS validation
       ↓
3. Route matching → route-specific middleware:
   a. rateLimit (if applicable)
   b. validate(joiSchema) (if applicable)
   c. authenticateToken → verifies JWT, sets req.user = decoded payload
   d. uploadFiles (if multipart)
       ↓
4. Controller:
   a. Extract params/body from req
   b. Authorization check (req.user.userId === params.userId or role === 'ADMIN')
   c. Call Service method(s)
   d. Transform result via Mapper
   e. Return ApiResponse.success(res, data, message)
       ↓
5. Service:
   a. Execute Prisma query (with BigInt conversion for IDs)
   b. Return raw Prisma entity or aggregation result
       ↓
6. Mapper:
   a. Convert snake_case → camelCase
   b. Convert BigInt → string (for JSON serialization)
   c. Shape response object
       ↓
7. ApiResponse sends JSON: { success: true, message: "...", data: {...} }
```

### 5.2 Authentication Flow

```
Registration:
  POST /auth/register → validate → create user (is_activate=false)
    → generate activation token → hash with SHA-256 → store in user_tokens table
    → send email with plain token link → user clicks link
    → POST /auth/activate → verify hashed token → set is_activate=true

Login:
  POST /auth/login → validate → find user by email/username
    → verify bcrypt password → sign accessToken (JWT, 2min)
    → sign refreshToken (JWT, 7d) → create Redis session (hashed token)
    → set refreshToken as HttpOnly cookie → return accessToken + user payload

Token Refresh:
  POST /auth/refresh → read refreshToken from cookie
    → verify JWT → validate session in Redis (hash comparison)
    → if mismatch: revoke ALL sessions (theft detection)
    → generate new tokens → rotate Redis session (revoke old, create new)
    → set new cookie → return new accessToken

Logout:
  POST /auth/logout → decode refreshToken → revoke Redis session → clear cookie
  POST /auth/logout-all → revoke ALL Redis sessions for user → clear cookie
```

### 5.3 File Upload Flow

```
Book Creation (Admin):
  POST /admin/books/create (multipart/form-data)
    → multer middleware (memory storage) parses fields: cover, pdfFile, epubFile
    → Controller:
      a. Upload cover image buffer → Cloudinary (folder: "book-covers") → get URL
      b. Upload PDF buffer → MinIO (folder: "books/{uuid}.pdf") → get object key
      c. Upload EPUB buffer → MinIO (folder: "books/{uuid}.epub") → get object key
      d. Create book record in DB with coverImageUrl, create book_formats with content_url (MinIO key)

Book Reading:
  GET /books/:bookId/read-url?format=EPUB
    → Service finds book_format record → generates presigned URL from MinIO key
    → Returns presigned URL (expires in 1h)
```

### 5.4 Session State in Redis

```
Key Structure:
  session:{userId}:{jti}    → Hash { hashedToken, userId, createdAt, userAgent, ip }
  sessions:{userId}          → Set of all jti values (for logout-all enumeration)

TTL: 7 days (matches refresh token expiry)
```

### 5.5 Database Token State

```
user_tokens table:
  - type: 'RESET_PASSWORD' or 'EMAIL_VERIFICATION'
  - token: SHA-256 hash of the plain token sent via email
  - expires_at: 10min (reset) or 15min (activation)
  - One active token per user per type (old tokens deleted before creating new)
```

---

## 6. Coding Conventions & Rules

### 6.1 Module System

- **ES Modules exclusively** (`"type": "module"` in package.json).
- Use **path aliases** defined in `package.json#imports`:
  ```js
  import { prisma } from '#lib/prisma.js';
  import { ApiResponse, logger } from '#utils/index.js';
  import { authenticateToken } from '#middlewares/authenticateToken.js';
  ```
- Always include `.js` extension in import paths.

### 6.2 Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Files | camelCase or PascalCase for controllers | `bookService.js`, `BookController.js` |
| Database columns | snake_case | `user_id`, `book_id`, `is_deleted` |
| API response fields | camelCase | `userId`, `bookId`, `coverImageUrl` |
| Route paths | kebab-case | `/auth/forgot-password`, `/admin/books/hard-delete/:bookId` |
| Constants | UPPER_SNAKE_CASE | `TOKEN_TYPES`, `CLOUDINARY_FOLDERS`, `SESSION_TTL` |
| Service exports | Named exports + namespace object | `export const getUserById = ...` + `export const userService = { getUserById, ... }` |

### 6.3 ID Handling (CRITICAL)

- Database IDs are `BigInt` (PostgreSQL `BIGINT`).
- **All Prisma queries must wrap IDs**: `BigInt(userId)`, `BigInt(bookId)`.
- **All responses must convert IDs to strings**: `user.user_id.toString()` or via mapper.
- Express `app.set("json replacer", ...)` handles BigInt serialization as a safety net.

### 6.4 Error Handling Pattern

Controllers use **try/catch** with `ApiResponse`:
```js
export const handler = async (req, res) => {
  try {
    // ... business logic ...
    return ApiResponse.success(res, data, 'Message');
  } catch (error) {
    logger.error('Context:', error);
    return ApiResponse.error(res, 'User-facing message', 500);
  }
};
```
- **Do NOT throw from controllers** — always return `ApiResponse.error()`.
- Services MAY throw (e.g., password reset with invalid token).
- An `AppError` hierarchy exists in `utils/error.js` but is **not consistently used** across the codebase; most controllers handle errors inline.

### 6.5 API Response Envelope

All endpoints return:
```json
{
  "success": true | false,
  "message": "Human-readable message",
  "data": { ... } | null
}
```
Error responses may include `"errors"` array (for validation).

### 6.6 Pagination Convention

Paginated endpoints use query params `page` (0-based) and `size`. Response shape:
```json
{
  "content": [...],
  "page": 0,
  "size": 10,
  "totalElements": 100,
  "totalPages": 10
}
```
Exception: `GET /books` uses **cursor-based pagination** (`cursor` query param → `nextCursor` in response).

### 6.7 Authentication & Authorization

- **Access Token**: JWT, 2-minute TTL, stored in frontend memory. Contains user claims: `{ userId, email, fullName, role, avatarUrl }`.
- **Refresh Token**: JWT, 7-day TTL, stored in HttpOnly cookie (path: `/api/v1/auth`).
- `authenticateToken` middleware sets `req.user` from decoded access token.
- Authorization is **inline in controllers**: `if (req.user.userId !== userId && req.user.role !== 'ADMIN')`.
- There is **no dedicated role-checking middleware**; admin role checks are done within controller logic or implicitly by route placement under `/admin/*`.

### 6.8 Validation

- Input validation uses **Joi schemas** in `validators/`.
- Applied via `validate(schema)` middleware in route definitions.
- Options: `abortEarly: false`, `stripUnknown: true`, `convert: true`.
- Validated/cleaned data replaces `req.body` (or `req.query`/`req.params`).

### 6.9 Service-Mapper Separation Rule

- **Services** return raw Prisma entities. They do NOT transform field names or serialize IDs.
- **Mappers** transform Prisma entities to API format: snake_case → camelCase, BigInt → string.
- **Controllers** orchestrate: call service → call mapper → return ApiResponse.
- Exception: `authService.js` has its own internal `transformUser()` function that performs mapping within the service (legacy pattern).

### 6.10 Security Practices

- Passwords hashed with **bcrypt** (12 salt rounds).
- Refresh tokens stored as **SHA-256 hashes** in Redis (never raw).
- Email-based tokens (reset, activation) stored as **SHA-256 hashes** in database.
- **Token rotation** on every refresh; **token mismatch triggers full session revocation** (theft detection).
- Rate limiting: 5 login attempts/15min, 3 registrations/hour, 3 forgot-password/15min.
- CSRF protection for Google OAuth via `g_csrf_token` cookie comparison.
- Helmet for security headers; CORS restricted to `FRONTEND_URL`.
- Refresh token cookie: `HttpOnly`, `Secure` (prod), `SameSite`, scoped path.
- Password reset and account activation always return same message regardless of email existence (prevents enumeration).

---

## 7. External Services & Dependencies

### 7.1 PostgreSQL (via Prisma + pg adapter)

- **Connection**: `DATABASE_URL` env var → `@prisma/adapter-pg` driver adapter with native `pg` client.
- **Migrations**: managed by Prisma CLI, stored in `app/prisma/migrations/`.
- **Schema location**: `app/prisma/schema.prisma`.
- **Generated client**: `app/generated/` (output of `prisma generate`).

### 7.2 Redis

- **Purpose**: Session storage for refresh tokens (multi-device support).
- **Connection**: `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD` env vars.
- **Client**: `redis` npm package, singleton pattern with auto-reconnect (exponential backoff, max 10 retries).
- **Graceful shutdown**: SIGTERM/SIGINT handlers disconnect Redis.

### 7.3 Cloudinary

- **Purpose**: Image hosting for book cover images and user avatars.
- **Connection**: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` env vars.
- **Operations**: Upload (stream-based), delete (by public ID extracted from URL).
- **Folders**: `book-covers`, `avatars`.

### 7.4 MinIO (S3-Compatible)

- **Purpose**: Object storage for book files (PDF, EPUB).
- **Connection**: `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_REGION` env vars.
- **Client**: AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`).
- **Operations**: Upload (`PutObjectCommand`), delete (`DeleteObjectCommand`), presigned URL generation (`GetObjectCommand` + `getSignedUrl`).
- **Key format**: `books/{uuid}.{ext}`.

### 7.5 SMTP (Nodemailer)

- **Purpose**: Transactional emails — password reset and account activation.
- **Connection**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` env vars.
- **Templates**: Inline HTML templates in `emailService.js` (Vietnamese language).

### 7.6 Google OAuth2

- **Purpose**: Google Sign-In authentication.
- **Connection**: `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_WEB_SECRET` env vars.
- **Client**: `google-auth-library` (`OAuth2Client`).
- **Flow**: Frontend redirect mode → backend verifies ID token → find-or-create user → redirect with access token.

### 7.7 Key npm Dependencies

| Package | Purpose |
|---|---|
| `express@5` | HTTP framework |
| `@prisma/client@7` + `@prisma/adapter-pg` | ORM with PostgreSQL driver adapter |
| `redis` | Redis client |
| `jsonwebtoken` | JWT sign/verify |
| `bcrypt` | Password hashing |
| `joi` | Request validation |
| `multer@2` | Multipart file upload (memory storage) |
| `cloudinary` | Cloudinary SDK |
| `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` | MinIO/S3 operations |
| `nodemailer` | SMTP email sending |
| `helmet` | Security headers |
| `cors` | Cross-origin resource sharing |
| `express-rate-limit` | Request rate limiting |
| `cookie-parser` | Cookie parsing |
| `morgan` | HTTP request logging |
| `uuid` | UUID generation for storage keys |
| `dotenv` | Environment variable loading |

### 7.8 Required Environment Variables

```
# Database
DATABASE_URL=
DIRECT_URL=

# Redis
REDIS_HOST=
REDIS_PORT=
REDIS_USERNAME=
REDIS_PASSWORD=

# JWT
JWT_ACCESS_SECRECT=
JWT_REFRESH_SECRECT=

# Server
PORT=
BASE_URL=
FRONTEND_URL=
NODE_ENV=

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# MinIO
MINIO_ENDPOINT=
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_BUCKET=
MINIO_REGION=

# SMTP
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

# Google OAuth
GOOGLE_WEB_CLIENT_ID=
GOOGLE_WEB_SECRET=
```
