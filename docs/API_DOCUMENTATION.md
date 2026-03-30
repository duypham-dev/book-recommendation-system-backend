# Book Recommendation System - API Documentation

## Overview

This document provides a comprehensive overview of all API endpoints available in the Book Recommendation System backend.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Most endpoints require authentication via JWT tokens. Include the access token in cookies (automatically handled by the frontend).

### Auth Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register a new user | No |
| POST | `/auth/login` | Login user | No |
| POST | `/auth/logout` | Logout user | Yes |
| POST | `/auth/refresh` | Refresh access token | No (requires refresh token cookie) |
| GET | `/auth/profile` | Get current user profile | Yes |
| POST | `/auth/forgot-password` | Request password reset | No |
| POST | `/auth/reset-password` | Reset password with token | No |

---

## User Endpoints

### Profile & Account

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/users/profile` | Get user profile | Yes |
| PUT | `/users/profile` | Update user profile | Yes |
| PUT | `/users/password` | Change password | Yes |

### Favorites

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/users/favorites` | Get user's favorite books | Yes |
| POST | `/users/favorites/:bookId` | Add book to favorites | Yes |
| DELETE | `/users/favorites/:bookId` | Remove book from favorites | Yes |
| GET | `/users/favorites/:bookId/check` | Check if book is favorited | Yes |

### Reading History

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/users/history` | Get reading history | Yes |
| POST | `/users/history` | Record reading progress | Yes |
| GET | `/users/history/:bookId/progress` | Get reading progress for a book | Yes |
| DELETE | `/users/history/:historyId` | Delete history entry | Yes |

### Ratings

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/users/ratings` | Get user's ratings | Yes |
| POST | `/users/ratings` | Create or update rating | Yes |
| DELETE | `/users/ratings/:ratingId` | Delete rating | Yes |
| GET | `/users/ratings/book/:bookId` | Get user's rating for a book | Yes |

### Bookmarks

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/users/bookmarks` | Get user's bookmarks | Yes |
| POST | `/users/bookmarks` | Create bookmark | Yes |
| PUT | `/users/bookmarks/:bookmarkId` | Update bookmark | Yes |
| DELETE | `/users/bookmarks/:bookmarkId` | Delete bookmark | Yes |
| GET | `/users/bookmarks/book/:bookId` | Get bookmarks for a book | Yes |

---

## Book Endpoints (Public)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/books` | Get paginated books | No |
| GET | `/books/search` | Search books by keyword | No |
| GET | `/books/:id` | Get book details | No |
| GET | `/books/:id/preview` | Get book preview | No |
| GET | `/books/:id/formats` | Get available book formats | No |
| GET | `/books/genre/:genreId` | Get books by genre | No |
| GET | `/books/most-read` | Get most read books | No |
| GET | `/books/:id/ratings` | Get book ratings | No |

---

## Genre Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/genres` | Get all genres | No |
| GET | `/genres/:id` | Get genre by ID | No |
| GET | `/genres/:id/books` | Get books in genre | No |

---

## Author Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/authors` | Get all authors | No |
| GET | `/authors/:id` | Get author by ID | No |
| GET | `/authors/:id/books` | Get books by author | No |

---

## Admin Endpoints

All admin endpoints require authentication with admin role.

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/dashboard` | Get dashboard statistics |

### Book Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/books` | Get books with filters |
| POST | `/admin/books/create` | Create new book |
| PUT | `/admin/books/update/:id` | Update book |
| DELETE | `/admin/books/delete/:id` | Delete book |
| DELETE | `/admin/books` | Bulk delete books |

### Genre Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/genres` | Get genres with pagination |
| POST | `/admin/genres` | Create genre |
| PUT | `/admin/genres/:id` | Update genre |
| DELETE | `/admin/genres/:id` | Delete genre |

### Author Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/authors` | Get authors with pagination |
| POST | `/admin/authors` | Create author |
| PUT | `/admin/authors/:id` | Update author |
| DELETE | `/admin/authors/:id` | Delete author |

### User Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/users` | Get all users with pagination |
| GET | `/admin/users/:id` | Get user by ID |
| PUT | `/admin/users/:id/ban` | Ban user |
| PUT | `/admin/users/:id/unban` | Unban user |
| DELETE | `/admin/users/:id` | Delete user |

---

## Recommendation Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/recommendations` | Get personalized recommendations | Yes |
| GET | `/similar-books` | Get similar books | No |
| GET | `/diversity-books` | Get diverse book recommendations | No |
| GET | `/recommendation/active-model` | Get active recommendation model info | No |

### Admin Recommendation Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/recommendation/models` | Get available models |
| PUT | `/admin/recommendation/models/:key` | Set active model |
| GET | `/admin/recommendation/health` | Get system health |
| GET | `/admin/recommendation/model-info` | Get model information |
| POST | `/admin/recommendation/retrain` | Trigger model retraining |
| GET | `/admin/recommendation/cache/stats` | Get cache statistics |
| DELETE | `/admin/recommendation/cache` | Clear recommendation cache |

### Online Learning

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/recommendation/online-learning/status` | Get online learning status |
| POST | `/admin/recommendation/online-learning/enable` | Enable online learning |
| POST | `/admin/recommendation/online-learning/disable` | Disable online learning |
| POST | `/admin/recommendation/online-learning/update` | Trigger incremental update |

### Redis Cache Inspector

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/redis/summary` | Get Redis summary |
| GET | `/admin/redis/caches` | Get all cache entries |
| GET | `/admin/redis/keys` | Search keys by pattern |
| GET | `/admin/redis/key` | Get key info |
| GET | `/admin/redis/value` | Get key value |
| POST | `/admin/redis/log-all` | Log all caches to console |

---

## Request/Response Format

### Standard Success Response

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Standard Error Response

```json
{
  "success": false,
  "message": "Error description",
  "errors": [ ... ] // Optional validation errors
}
```

### Paginated Response

```json
{
  "success": true,
  "message": "Data retrieved successfully",
  "data": {
    "content": [ ... ],
    "page": 0,
    "size": 10,
    "totalElements": 100,
    "totalPages": 10,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

---

## Environment Variables

Create a `.env` file in the backend root with the following variables:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/book_recommendation"

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Redis
REDIS_URL=redis://localhost:6379

# Cloudflare R2 (for file uploads)
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=book-files
R2_PUBLIC_URL=https://your-public-url.com

# Recommendation System
RECSYS_BASE_URL=http://localhost:8003/api/v1
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed the database (optional)
npm run seed

# Start the server
npm run dev
```

### Database Schema

The system uses Prisma ORM with the following main models:

- **User**: User accounts with authentication
- **Book**: Book information and metadata
- **Genre**: Book categories/genres
- **Author**: Book authors
- **Favorite**: User's favorite books
- **ReadingHistory**: User's reading progress
- **Rating**: User ratings for books
- **Bookmark**: Reading bookmarks
- **BookFormat**: Available book formats (EPUB, PDF, etc.)

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input data |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists |
| 422 | Unprocessable Entity - Validation failed |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

---

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Default**: 100 requests per 15 minutes
- **Auth endpoints**: 10 requests per 15 minutes
- **Admin endpoints**: 50 requests per 15 minutes

Exceeded limits return a 429 status code with a `Retry-After` header.
