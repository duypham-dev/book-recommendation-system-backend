# Book Recommendation System - Backend Documentation

Tài liệu này chứa tất cả thông tin cần thiết để viết lại backend bằng JavaScript/Express.js.

---

## 📋 Mục lục

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Database Schema](#2-database-schema)
3. [Models/Entities](#3-modelsentities)
4. [API Endpoints](#4-api-endpoints)
5. [Authentication & Security](#5-authentication--security)
6. [Request/Response DTOs](#6-requestresponse-dtos)
7. [Services Logic](#7-services-logic)
8. [External Services Integration](#8-external-services-integration)
9. [Environment Variables](#9-environment-variables)
10. [Gợi ý triển khai Express.js](#10-gợi-ý-triển-khai-expressjs)

---

## 1. Tổng quan hệ thống

### Công nghệ gốc (Java)
- **Framework**: Spring Boot 3.5.6
- **Java Version**: 21
- **Database**: PostgreSQL
- **Cache**: Redis
- **Authentication**: JWT + OAuth2 (Google, Facebook)
- **File Storage**: Cloudinary (images) + MinIO (book files)
- **Email**: SMTP (Gmail)

### Chức năng chính
- Quản lý sách (CRUD, tìm kiếm, phân trang)
- Quản lý người dùng (đăng ký, đăng nhập, OAuth2)
- Đánh giá sách (ratings)
- Yêu thích sách (favorites)
- Bookmark sách
- Lịch sử đọc (reading history)
- Hệ thống gợi ý sách (recommendation - gọi external Python service)
- Admin dashboard

---

## 2. Database Schema

### Schema: `book_recommendation_system`

```sql
-- User roles
CREATE TABLE roles (
    role_id   BIGSERIAL PRIMARY KEY,
    role_name VARCHAR(20) UNIQUE NOT NULL
);

-- Users
CREATE TABLE users (
    user_id                         BIGSERIAL PRIMARY KEY,
    role_id                         BIGINT NOT NULL REFERENCES roles(role_id),
    username                        VARCHAR(50) UNIQUE NOT NULL,
    password                        VARCHAR(255) NOT NULL,
    email                           VARCHAR(100) UNIQUE NOT NULL,
    phone_number                    VARCHAR(15) UNIQUE,
    avatar_url                      VARCHAR(512),
    is_activate                     BOOLEAN NOT NULL DEFAULT false,
    email_verification_token        VARCHAR(255),
    email_verification_token_expiry TIMESTAMP,
    reset_password_token            VARCHAR(255),
    reset_password_token_expiry     TIMESTAMP,
    full_name                       VARCHAR(100),
    is_ban                          BOOLEAN NOT NULL DEFAULT false,
    created_at                      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at                      TIMESTAMP
);

-- Books
CREATE TABLE books (
    book_id          BIGSERIAL PRIMARY KEY,
    title            VARCHAR(255) NOT NULL,
    description      TEXT NOT NULL,
    cover_image_url  VARCHAR(255) NOT NULL,
    publication_year INT,
    publisher        VARCHAR(100),
    is_deleted       BOOLEAN NOT NULL DEFAULT false,
    created_at       TIMESTAMP NOT NULL DEFAULT now(),
    updated_at       TIMESTAMP
);

-- Book types (PDF, EPUB, etc.)
CREATE TABLE book_types (
    type_id   BIGSERIAL PRIMARY KEY,
    type_name VARCHAR(30) UNIQUE NOT NULL
);

-- Book formats (nhiều định dạng cho mỗi sách)
CREATE TABLE book_formats (
    format_id    BIGSERIAL PRIMARY KEY,
    book_id      BIGINT NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
    type_id      BIGINT NOT NULL REFERENCES book_types(type_id),
    content_url  VARCHAR(255) NOT NULL,
    total_pages  INT,
    file_size_kb INT,
    UNIQUE (book_id, type_id)
);

-- Authors
CREATE TABLE authors (
    author_id   BIGSERIAL PRIMARY KEY,
    author_name VARCHAR(100) NOT NULL,
    biography   TEXT
);

-- Genres
CREATE TABLE genres (
    genre_id    BIGSERIAL PRIMARY KEY,
    genre_name  VARCHAR(50) UNIQUE NOT NULL,
    description TEXT
);

-- Book-Author relationship (Many-to-Many)
CREATE TABLE book_authors (
    book_id   BIGINT NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
    author_id BIGINT NOT NULL REFERENCES authors(author_id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, author_id)
);

-- Book-Genre relationship (Many-to-Many)
CREATE TABLE book_genres (
    book_id  BIGINT NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
    genre_id BIGINT NOT NULL REFERENCES genres(genre_id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, genre_id)
);

-- Ratings (1 user - 1 book = 1 rating)
CREATE TABLE ratings (
    rating_id    BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    book_id      BIGINT NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
    rating_value INT NOT NULL CHECK (rating_value BETWEEN 1 AND 5),
    comment      TEXT,
    created_at   TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (user_id, book_id)
);

-- Reading history
CREATE TABLE reading_history (
    history_id   BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    book_id      BIGINT NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
    last_read_at TIMESTAMP NOT NULL DEFAULT now(),
    progress     DOUBLE PRECISION, -- 0.0 to 100.0
    UNIQUE (user_id, book_id)
);

-- Favorites (1 user - 1 book = 1 favorite)
CREATE TABLE favorites (
    favorite_id BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    book_id     BIGINT NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
    added_at    TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (user_id, book_id)
);

-- Bookmarks (1 user có thể bookmark nhiều vị trí trong 1 sách)
CREATE TABLE bookmarks (
    bookmark_id      BIGSERIAL PRIMARY KEY,
    user_id          BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    book_id          BIGINT NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
    page_number      INT,
    location_in_book VARCHAR(255),
    note             VARCHAR(255),
    created_at       TIMESTAMP NOT NULL DEFAULT now()
);
```

### Seed Data
```sql
-- Roles
INSERT INTO roles (role_name) VALUES ('ADMIN'), ('USER');

-- Book Types
INSERT INTO book_types (type_name) VALUES ('PDF'), ('EPUB');

-- Sample Genres
INSERT INTO genres (genre_name, description) VALUES 
('Chưa phân loại', 'Thể loại sách chưa phân loại'),
('Công nghệ thông tin', 'Thể loại sách công nghệ thông tin'),
('Khoa học', 'Thể loại sách khoa học'),
-- ... more genres
```

---

## 3. Models/Entities

### User
```javascript
{
  id: Long,
  role: Role,           // FK to roles
  username: String(50), // unique, required
  password: String(255), // hashed, required
  email: String(100),   // unique, required
  phoneNumber: String(15), // unique, optional
  avatarUrl: String(512),
  isActivate: Boolean,  // default: false
  emailVerificationToken: String(255),
  emailVerificationTokenExpiry: Timestamp,
  resetPasswordToken: String(255),
  resetPasswordTokenExpiry: Timestamp,
  fullName: String(100),
  isBan: Boolean,       // default: false
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Role
```javascript
{
  id: Long,
  name: String(20)  // "ADMIN" or "USER"
}
```

### Book
```javascript
{
  id: Long,
  title: String(255),       // required
  description: Text,        // required
  coverImageUrl: String(255), // required
  publicationYear: Integer,
  publisher: String(100),
  isDeleted: Boolean,       // soft delete
  createdAt: Timestamp,
  updatedAt: Timestamp,
  // Relations
  authors: Set<Author>,     // Many-to-Many
  genres: Set<Genre>,       // Many-to-Many
  formats: List<BookFormat> // One-to-Many
}
```

### Author
```javascript
{
  id: Long,
  name: String(100),  // required
  biography: Text
}
```

### Genre
```javascript
{
  id: Long,
  name: String(50),   // unique, required
  description: Text
}
```

### BookType
```javascript
{
  id: Long,
  name: String(30)    // "PDF", "EPUB", etc.
}
```

### BookFormat
```javascript
{
  id: Long,
  book: Book,         // FK
  type: BookType,     // FK
  contentUrl: String(255), // URL to file
  totalPages: Integer,
  fileSizeKb: Integer
}
```

### Rating
```javascript
{
  id: Long,
  user: User,         // FK
  book: Book,         // FK
  value: Integer,     // 1-5
  comment: Text,
  createdAt: Timestamp
}
// Constraint: UNIQUE(user_id, book_id)
```

### Favorite
```javascript
{
  id: Long,
  user: User,         // FK
  book: Book,         // FK
  addedAt: Timestamp
}
// Constraint: UNIQUE(user_id, book_id)
```

### Bookmark
```javascript
{
  id: Long,
  user: User,         // FK
  book: Book,         // FK
  pageNumber: Integer,
  locationInBook: String(255),
  note: String(255),
  createdAt: Timestamp
}
```

### ReadingHistory
```javascript
{
  id: Long,
  user: User,         // FK
  book: Book,         // FK
  lastReadAt: Timestamp,
  progress: Double    // 0.0 - 100.0
}
// Constraint: UNIQUE(user_id, book_id)
```

---

## 4. API Endpoints

### Base URL: `/api/v1`

### 4.1. Authentication (`/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/login` | Đăng nhập | No |
| POST | `/auth/register` | Đăng ký | No |
| GET | `/auth/verify-email?token=` | Xác thực email | No |
| POST | `/auth/forgot-password` | Quên mật khẩu | No |
| POST | `/auth/reset-password` | Reset mật khẩu | No |

**OAuth2 Endpoints** (handled by Spring Security):
- `GET /login/oauth2/code/google` - Google OAuth callback
- `GET /login/oauth2/code/facebook` - Facebook OAuth callback

### 4.2. Books

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/books` | Lấy danh sách sách (phân trang) | No |
| GET | `/books/newest` | Sách mới nhất | No |
| GET | `/books/most-read` | Sách được đọc nhiều nhất | No |
| GET | `/books/genre/{genreId}` | Sách theo thể loại | No |
| GET | `/books/search?keyword=` | Tìm kiếm sách | No |
| GET | `/books/{id}` | Chi tiết sách | No |
| GET | `/books/{bookId}/download/{formatId}` | Download file sách | Yes |

**Admin Book Management:**

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/admin/books` | Danh sách sách (admin) | ADMIN |
| POST | `/admin/books/create` | Tạo sách mới (multipart) | ADMIN |
| PUT | `/admin/books/update/{id}` | Cập nhật sách (multipart) | ADMIN |
| DELETE | `/admin/books/delete/{id}` | Xóa sách | ADMIN |
| DELETE | `/admin/books` | Xóa nhiều sách (bulk) | ADMIN |

### 4.3. Genres

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/books/genres` | Lấy danh sách thể loại | No |

**Admin Genre Management:**

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/admin/genres/create` | Tạo thể loại | ADMIN |
| PUT | `/admin/genres/update/{id}` | Cập nhật thể loại | ADMIN |
| DELETE | `/admin/genres/delete/{id}` | Xóa thể loại | ADMIN |

### 4.4. Users

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/users/profile` | Lấy profile user hiện tại | Yes |
| PUT | `/users/{id}/update` | Cập nhật thông tin user | Yes |
| PATCH | `/users/{id}/avatar` | Cập nhật avatar (multipart) | Yes |
| PATCH | `/users/{id}/change-password` | Đổi mật khẩu | Yes |

**Admin User Management:**

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/admin/users` | Danh sách users (phân trang) | ADMIN |
| PATCH | `/users/{id}/ban` | Ban user | ADMIN |
| PATCH | `/users/ban` | Ban nhiều users (bulk) | ADMIN |
| PATCH | `/users/{id}/unban` | Unban user | ADMIN |

### 4.5. Ratings (`/users/{userId}`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/users/{userId}/books/{bookId}/ratings` | Đánh giá sách | Yes |
| DELETE | `/users/{userId}/books/{bookId}/ratings` | Xóa đánh giá | Yes |
| GET | `/users/{userId}/ratings` | Lấy đánh giá của user | Yes |
| GET | `/users/{userId}/books/{bookId}/ratings` | Lấy đánh giá của sách | No |
| GET | `/users/{userId}/books/{bookId}/average-rating` | Điểm trung bình | No |

### 4.6. Favorites (`/users/{userId}`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/users/{userId}/favorites/{bookId}` | Thêm yêu thích | Yes |
| DELETE | `/users/{userId}/favorites/{bookId}` | Xóa yêu thích | Yes |
| GET | `/users/{userId}/favorites` | Lấy danh sách yêu thích | No |

### 4.7. Bookmarks (`/users/{userId}`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/users/{userId}/books/{bookId}/bookmarks` | Tạo bookmark | Yes |
| PUT | `/users/{userId}/bookmarks/{bookmarkId}` | Cập nhật bookmark | Yes |
| DELETE | `/users/{userId}/bookmarks/{bookmarkId}` | Xóa bookmark | Yes |
| GET | `/users/{userId}/books/{bookId}/bookmarks` | Lấy bookmarks của sách | Yes |

### 4.8. Reading History (`/users/{userId}`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/users/{userId}/books/{bookId}/history` | Cập nhật lịch sử đọc | Yes |
| GET | `/users/{userId}/history` | Lấy lịch sử đọc (phân trang) | Yes |

### 4.9. Recommendations

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/recommendations?userId=&limit=` | Gợi ý sách cho user | No |
| GET | `/similar-books?bookId=&limit=` | Sách tương tự | No |
| GET | `/diversity-books?bookId=&limit=` | Sách đa dạng | No |
| GET | `/recommendation/active-model` | Model đang active | No |
| DELETE | `/recommendation/cache` | Xóa cache gợi ý | Yes |

**Admin Recommendation Management:**

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/admin/recommendation/models` | Danh sách models | ADMIN |
| PUT | `/admin/recommendation/models/{modelKey}` | Chuyển model | ADMIN |
| POST | `/admin/recommendation/retrain` | Trigger retrain | ADMIN |
| GET | `/admin/recommendation/health` | Health status | ADMIN |
| GET | `/admin/recommendation/model-info` | Thông tin model | ADMIN |
| GET | `/admin/recommendation/online-learning/status` | Online learning status | ADMIN |

### 4.10. Admin Dashboard

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/admin/dashboard` | Dashboard data | ADMIN |

### 4.11. Admin Redis (Debug)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/admin/redis/summary` | Cache summary | ADMIN |
| GET | `/admin/redis/caches` | All cache entries | ADMIN |
| GET | `/admin/redis/keys?pattern=` | Search keys | ADMIN |
| GET | `/admin/redis/key?key=` | Key info | ADMIN |
| GET | `/admin/redis/value?key=` | Key value | ADMIN |
| POST | `/admin/redis/log-all` | Log all keys | ADMIN |

### 4.12. Internal Callbacks (cho Python RS Service)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/internal/recsys/callback/retrain-complete` | Callback sau retrain | No |
| POST | `/internal/recsys/callback/incremental-update` | Callback sau update | No |
| GET | `/internal/recsys/callback/health` | Health check | No |

---

## 5. Authentication & Security

### 5.1. JWT Configuration

```javascript
// JWT Token Structure
{
  sub: "user@email.com",    // subject = email
  id: 123,                   // user ID
  roles: ["USER"],           // or ["ADMIN"]
  iat: 1234567890,           // issued at
  exp: 1234567890,           // expiration
  jti: "uuid"                // JWT ID
}

// Token settings
jwtSecret: "base64-encoded-secret",
accessExpirationInMils: 7200000  // 2 hours
```

### 5.2. Password Hashing
- Algorithm: BCrypt
- Spring Security default cost factor

### 5.3. Authorization Rules

```javascript
// Public endpoints (không cần auth)
"/api/v1/auth/**"
"/api/v1/internal/recsys/**"
"GET /api/v1/books"
"GET /api/v1/books/newest"
"GET /api/v1/books/most-read"
"GET /api/v1/books/genre/**"
"GET /api/v1/books/search"
"GET /api/v1/books/{bookId}"
"GET /api/v1/books/{bookId}/ratings"
"GET /api/v1/books/{bookId}/average-rating"
"GET /api/v1/recommendation/active-model"
"GET /api/v1/similar-books"
"GET /api/v1/diversity-books"
"GET /api/v1/users/*/favorites/**"
"GET /api/v1/users/*/books/*/ratings"
"GET /api/v1/users/*/books/*/average-rating"

// Admin only
"/api/v1/admin/**"
"POST /api/v1/books/create-with-files"
"PUT /api/v1/books/update-with-files/**"
"POST /api/v1/books/add"
"PUT /api/v1/books/update/**"
"DELETE /api/v1/books/delete/**"

// Authenticated (bất kỳ user đăng nhập)
"All other endpoints"
```

### 5.4. OAuth2 Configuration

**Google OAuth2:**
```yaml
client-id: ${GOOGLE_CLIENT_ID}
client-secret: ${GOOGLE_CLIENT_SECRET}
scope: profile, email
redirect-uri: "{baseUrl}/login/oauth2/code/google"
```

**Facebook OAuth2:**
```yaml
client-id: ${FACEBOOK_CLIENT_ID}
client-secret: ${FACEBOOK_CLIENT_SECRET}
scope: public_profile, email
redirect-uri: "{baseUrl}/login/oauth2/code/facebook"
authorization-uri: https://www.facebook.com/v20.0/dialog/oauth
token-uri: https://graph.facebook.com/v20.0/oauth/access_token
user-info-uri: https://graph.facebook.com/me?fields=id,name,email,picture
```

**OAuth2 Success Flow:**
1. User xác thực qua Google/Facebook
2. Callback URL nhận thông tin user
3. Tạo/update user trong DB
4. Generate JWT token
5. Redirect về frontend với token: `{redirectUri}?token={jwt}`

---

## 6. Request/Response DTOs

### 6.1. Request DTOs

#### LoginRequest
```javascript
{
  email: String,     // required, email format
  password: String   // required
}
```

#### RegisterRequest
```javascript
{
  username: String,  // required, max 50 chars
  email: String,     // required, email format, max 100 chars
  password: String   // required, min 6, max 255 chars
}
```

#### BookRequest (multipart/form-data)
```javascript
{
  title: String,        // required, max 255
  description: String,  // required
  publicationYear: Integer,
  publisher: String,    // max 100
  authorNames: String[], // required, at least 1
  genreIds: Long[],     // required, at least 1
  cover: File,          // image file
  pdfFile: File,        // PDF file
  epubFile: File        // EPUB file
}
```

#### RatingRequest
```javascript
{
  value: Integer,    // required, 1-5
  comment: String    // max 1000
}
```

#### BookmarkRequest
```javascript
{
  pageNumber: Integer,     // positive
  locationInBook: String,  // max 255
  note: String             // max 255
}
```

#### ReadingHistoryRequest
```javascript
{
  progress: Double  // required, 0.0-100.0
}
```

#### UpdateUserRequest
```javascript
{
  username: String,    // max 50
  phoneNumber: String, // max 15
  avatarUrl: String,   // max 255
  fullName: String     // max 100
}
```

#### ChangePasswordRequest
```javascript
{
  currentPassword: String,  // required
  newPassword: String       // required, min 6, max 255
}
```

#### GenreRequest
```javascript
{
  name: String,        // required, max 50
  description: String  // max 500
}
```

#### ForgotPasswordRequest
```javascript
{
  email: String  // required, email format, max 100
}
```

#### ResetPasswordRequest
```javascript
{
  token: String,      // required
  newPassword: String // required, min 6, max 255
}
```

#### BulkIdsRequest
```javascript
{
  ids: Long[]  // required, at least 1
}
```

### 6.2. Response DTOs

#### ApiResponse<T> (Standard wrapper)
```javascript
{
  data: T,         // nullable
  message: String
}
```

#### LoginResponse
```javascript
{
  jwt: String,
  id: Long,
  username: String,
  email: String,
  role: String
}
```

#### UserResponse
```javascript
{
  id: Long,
  username: String,
  email: String,
  phoneNumber: String,
  avatarUrl: String,
  fullName: String,
  status: "ACTIVE" | "INACTIVE" | "BANNED",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  roleName: String
}
```

#### BookResponse
```javascript
{
  id: Long,
  title: String,
  description: String,
  coverImageUrl: String,
  publicationYear: Integer,
  publisher: String,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  authors: [
    { id: Long, name: String }
  ],
  genres: [
    { id: Long, name: String }
  ],
  formats: [
    {
      id: Long,
      typeName: String,
      totalPages: Integer,
      fileSizeKb: Integer,
      contentUrl: String,
      downloadUrl: String
    }
  ]
}
```

#### GenreResponse
```javascript
{
  id: Long,
  name: String,
  description: String
}
```

#### RatingResponse
```javascript
{
  id: Long,
  userId: Long,
  userName: String,
  bookId: Long,
  value: Integer,
  comment: String,
  createdAt: Timestamp
}
```

#### FavoriteResponse
```javascript
{
  id: Long,
  userId: Long,
  bookId: Long,
  addedAt: Timestamp,
  book: {
    id: Long,
    title: String,
    description: String,
    coverImageUrl: String,
    publicationYear: Integer,
    publisher: String,
    authors: [{ id: Long, name: String }],
    genres: [{ id: Long, name: String }],
    formats: [{ id, typeName, totalPages, fileSizeKb, contentUrl }]
  }
}
```

#### BookmarkResponse
```javascript
{
  id: Long,
  userId: Long,
  bookId: Long,
  pageNumber: Integer,
  locationInBook: String,
  note: String,
  createdAt: Timestamp
}
```

#### ReadingHistoryResponse
```javascript
{
  id: Long,
  userId: Long,
  bookId: Long,
  progress: Double,
  lastReadAt: Timestamp,
  book: {
    id: Long,
    title: String,
    coverImageUrl: String,
    authors: [{ id: Long, name: String }]
  }
}
```

#### AdminDashboardResponse
```javascript
{
  totalUsers: Long,
  totalBooks: Long,
  totalGenres: Long,
  totalAuthors: Long,
  newUsersLast7Days: [
    { date: String, count: Long }
  ],
  topRatedBooks: Page<{
    bookId: Long,
    title: String,
    averageRating: Double,
    totalRatings: Long
  }>,
  topFavoritedBooks: Page<{
    bookId: Long,
    title: String,
    totalFavorites: Long
  }>
}
```

---

## 7. Services Logic

### 7.1. AuthService

**Login:**
1. Authenticate với email/password
2. Generate JWT token
3. Return LoginResponse

**Register:**
1. Check email/username/phone tồn tại
2. Hash password với BCrypt
3. Tạo user với role "USER", isActivate = false
4. Generate verification token (UUID)
5. Set expiry = now + 24 hours
6. Save user
7. Send verification email

**Verify Email:**
1. Find user by verification token
2. Check token chưa expired
3. Set isActivate = true
4. Clear token fields
5. Save

**Forgot Password:**
1. Find user by email
2. Generate reset token (UUID)
3. Set expiry = now + 1 hour
4. Save
5. Send reset password email

**Reset Password:**
1. Find user by reset token
2. Check token chưa expired
3. Hash new password
4. Clear token fields
5. Save

### 7.2. BookService

**Get Books (paginated):**
- Filter by: is_deleted = false
- Pagination: page, size
- Include: authors, genres, formats

**Search Books:**
- Search by title (LIKE %keyword%)
- Filter: is_deleted = false

**Get Books by Genre:**
- Join with book_genres
- Sort options: newest, most-read, etc.

**Create Book:**
1. Upload cover image → Cloudinary
2. Upload PDF/EPUB files → MinIO
3. Create authors nếu chưa tồn tại
4. Create book entity
5. Link authors, genres
6. Create book formats

**Update Book:**
1. Find existing book
2. Update fields if provided
3. Handle file uploads if any
4. Update relationships

**Delete Book (soft delete):**
- Set is_deleted = true

### 7.3. RatingService

**Rate Book:**
1. Find/create rating (upsert by user_id + book_id)
2. Update value, comment
3. Return all ratings for the book

**Get Average Rating:**
- AVG(rating_value) WHERE book_id = ?

### 7.4. RecommendationService

**Get Recommendations:**
1. Call Python RS API: `GET {recsysUrl}/recommendations?user_id={}&limit={}`
2. Parse response to get book_ids
3. Fetch full book details for each book_id
4. Cache result in Redis

**Get Similar Books:**
1. Call Python RS API: `GET {recsysUrl}/similar?book_id={}&limit={}`
2. Parse và fetch books

**Get Diversity Books:**
1. Call Python RS API: `GET {recsysUrl}/diversity?book_id={}&limit={}`
2. Parse và fetch books

### 7.5. FavoriteService

**Add Favorite:**
- Create new favorite (sẽ fail nếu duplicate do UNIQUE constraint)

**Remove Favorite:**
- Delete by user_id + book_id

**Get User Favorites:**
- Find all by user_id
- Include full book details

### 7.6. BookmarkService

**Create Bookmark:**
- Create new bookmark (1 user có thể có nhiều bookmarks cho 1 sách)

**Update Bookmark:**
- Find by bookmarkId, verify owner
- Update fields

**Delete Bookmark:**
- Find by bookmarkId, verify owner
- Delete

### 7.7. ReadingHistoryService

**Record History:**
- Upsert by user_id + book_id
- Update progress, last_read_at

**Get History:**
- Find by user_id
- Order by last_read_at DESC
- Paginate

---

## 8. External Services Integration

### 8.1. Cloudinary (Image Storage)

```javascript
// Config
{
  cloudName: "xxx",
  apiKey: "xxx",
  apiSecret: "xxx"
}

// Upload image
cloudinary.uploader.upload(file, {
  folder: "book-covers"
});
// Returns: { secure_url: "https://..." }
```

### 8.2. MinIO (File Storage)

```javascript
// Config
{
  endpoint: "http://localhost:9000",
  accessKey: "admin",
  secretKey: "12345678",
  bucketName: "book-files",
  presignedExpirySeconds: 3600
}

// Upload file
minioClient.putObject(bucketName, objectName, stream, size);

// Get download URL (presigned)
minioClient.presignedGetObject(bucketName, objectName, expirySeconds);
```

### 8.3. Recommendation System (Python Service)

```javascript
// Base URLs (configurable)
recsys: {
  default: "implicit",
  models: {
    implicit: {
      label: "Implicit ALS + SBERT",
      baseUrl: "http://localhost:8001/api/v1",
      supportsOnlineLearning: true
    },
    neural: {
      label: "Neural NCF + SBERT",
      baseUrl: "http://localhost:8001/api/v1",
      supportsOnlineLearning: true
    }
  }
}

// API Calls
GET {baseUrl}/recommendations?user_id={}&limit={}
GET {baseUrl}/similar?book_id={}&limit={}
GET {baseUrl}/diversity?book_id={}&limit={}
POST {baseUrl}/retrain
GET {baseUrl}/health
GET {baseUrl}/model-info
GET {baseUrl}/online-learning/status
```

### 8.4. Email Service (SMTP)

```javascript
// Config
{
  host: "smtp.gmail.com",
  port: 587,
  username: "xxx@gmail.com",
  password: "xxx"
}

// Templates
- email_verification.html
- email_reset_password.html
```

### 8.5. Redis (Caching)

```javascript
// Cache names
"recommendations"   // user recommendations
"similar_books"     // similar books
"diversity_books"   // diversity recommendations

// Cache key patterns
"recommendations::user:{userId}:limit:{limit}:model:{modelKey}"
"similar_books::book:{bookId}:limit:{limit}:model:{modelKey}"
"diversity_books::book:{bookId}:limit:{limit}:model:{modelKey}"
```

---

## 9. Environment Variables

```env
# Database
DB_URL=jdbc:postgresql://localhost:5432/book_recommendation
DB_USERNAME=postgres
DB_PASSWORD=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=base64-encoded-secret-key-at-least-256-bits
ACCESS_EXPIRATION_IN_MILS=7200000

# OAuth2
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
FACEBOOK_CLIENT_ID=xxx
FACEBOOK_CLIENT_SECRET=xxx
OAUTH2_REDIRECT_URI=http://localhost:5173/oauth2/success
OAUTH2_FAILURE_REDIRECT_URI=http://localhost:5173/oauth2/error

# Email
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=xxx@gmail.com
MAIL_PASSWORD=xxx

# App URLs
APP_AUTH_VERIFICATION_URL=http://localhost:8080/api/v1/auth/verify-email?token=
APP_AUTH_RESET_PASSWORD_URL=http://localhost:5173/reset-password?token=

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5173

# Recommendation System
RECSYS_IMPLICIT_URL=http://localhost:8001/api/v1
RECSYS_NEURAL_URL=http://localhost:8001/api/v1

# File Upload
FILE_UPLOAD_DIR=./book-recommendation-uploads/books

# Cloudinary
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx

# MinIO
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=12345678
MINIO_BUCKET_NAME=book-files
MINIO_PRESIGNED_EXPIRY_SECONDS=3600
```

---

## 10. Gợi ý triển khai Express.js

### 10.1. Project Structure

```
src/
├── config/
│   ├── database.js      # PostgreSQL connection (pg/knex/sequelize)
│   ├── redis.js         # Redis connection (ioredis)
│   ├── cloudinary.js
│   ├── minio.js
│   └── passport.js      # OAuth2 config
├── middleware/
│   ├── auth.js          # JWT verification
│   ├── admin.js         # Admin check
│   ├── errorHandler.js
│   └── validate.js      # Request validation
├── models/              # Sequelize/Prisma models
│   ├── User.js
│   ├── Book.js
│   ├── Author.js
│   └── ...
├── routes/
│   ├── auth.routes.js
│   ├── book.routes.js
│   ├── user.routes.js
│   └── ...
├── services/
│   ├── auth.service.js
│   ├── book.service.js
│   └── ...
├── controllers/
│   ├── auth.controller.js
│   ├── book.controller.js
│   └── ...
├── utils/
│   ├── jwt.js
│   ├── bcrypt.js
│   └── email.js
├── dto/                 # Request/Response schemas (Joi/Zod)
│   ├── request/
│   └── response/
└── app.js
```

### 10.2. Recommended Packages

```json
{
  "dependencies": {
    "express": "^4.18.x",
    "pg": "^8.x",           // PostgreSQL
    "sequelize": "^6.x",    // ORM (hoặc prisma, knex)
    "ioredis": "^5.x",      // Redis
    "jsonwebtoken": "^9.x", // JWT
    "bcryptjs": "^2.x",     // Password hashing
    "passport": "^0.7.x",   // OAuth2
    "passport-google-oauth20": "^2.x",
    "passport-facebook": "^3.x",
    "multer": "^1.x",       // File upload
    "cloudinary": "^1.x",   // Image storage
    "minio": "^7.x",        // File storage
    "nodemailer": "^6.x",   // Email
    "joi": "^17.x",         // Validation (hoặc zod)
    "cors": "^2.x",
    "helmet": "^7.x",
    "morgan": "^1.x",
    "dotenv": "^16.x"
  }
}
```

### 10.3. Key Implementation Notes

1. **JWT Middleware:**
```javascript
// Extract from Authorization: Bearer <token>
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};
```

2. **Response Format:**
```javascript
// Always use this format
res.json({
  data: result,
  message: "Success message"
});
```

3. **Pagination:**
```javascript
// Query params: page (0-based), size
const getBooks = async (req, res) => {
  const { page = 0, size = 10 } = req.query;
  const offset = page * size;
  
  const { rows, count } = await Book.findAndCountAll({
    limit: size,
    offset: offset,
    where: { isDeleted: false }
  });
  
  res.json({
    data: {
      content: rows,
      totalElements: count,
      totalPages: Math.ceil(count / size),
      number: parseInt(page),
      size: parseInt(size)
    },
    message: "Books retrieved successfully"
  });
};
```

4. **Soft Delete:**
```javascript
// Instead of DELETE, use UPDATE
await Book.update({ isDeleted: true }, { where: { id } });
```

5. **Caching with Redis:**
```javascript
const redis = require('ioredis');
const client = new redis(process.env.REDIS_URL);

const getRecommendations = async (userId, limit) => {
  const cacheKey = `recommendations::user:${userId}:limit:${limit}`;
  
  // Check cache
  const cached = await client.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  // Fetch from RS API
  const result = await fetchFromRecsysAPI(userId, limit);
  
  // Cache result
  await client.setex(cacheKey, 3600, JSON.stringify(result));
  
  return result;
};
```

---

## 📝 Notes

1. **Timestamps**: Sử dụng ISO 8601 format cho tất cả timestamps
2. **IDs**: Tất cả IDs là Long/BigInt
3. **Pagination**: Spring Page format với `content`, `totalElements`, `totalPages`, `number`, `size`
4. **Error Handling**: Trả về message trong response, không có field `success` hay `error`
5. **File Upload**: Sử dụng multipart/form-data
6. **CORS**: Cho phép localhost:5173, 5174 trong development

---

*Tài liệu được tạo tự động từ source code Java Spring Boot*
