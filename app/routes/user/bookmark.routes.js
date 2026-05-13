import express from 'express';
import { authenticateToken } from '#middlewares/authenticateToken.js';
import { validate, validateMultiple } from '#middlewares/validation.middleware.js';

import {
  bookmarkParamsSchema,
  bookmarkIdParamsSchema,
  bookmarkBodySchema,
} from '#validators/bookmark.validator.js';

import {
  getBookmarks,
  createBookmark,
  updateBookmark,
  deleteBookmark,
} from '#controllers/user/bookmark.controller.js';

const router = express.Router();

router.get('/books/:bookId/bookmarks',
  authenticateToken,
  validate(bookmarkParamsSchema, 'params'),
  getBookmarks
);

router.post('/books/:bookId/bookmarks',
  authenticateToken,
  validateMultiple({ params: bookmarkParamsSchema, body: bookmarkBodySchema }),
  createBookmark
);

router.put('/bookmarks/:bookmarkId',
  authenticateToken,
  validateMultiple({ params: bookmarkIdParamsSchema, body: bookmarkBodySchema }),
  updateBookmark
);

router.delete('/bookmarks/:bookmarkId',
  authenticateToken,
  validate(bookmarkIdParamsSchema, 'params'),
  deleteBookmark
);

export { router as bookmarkRouter };
