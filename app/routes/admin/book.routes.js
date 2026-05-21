import express from 'express';
import { authenticateToken } from '#middlewares/authenticateToken.js';
import { authorizeRole } from '#middlewares/authorize.middleware.js';
import { ROLES } from '#constants/roles.js';
import { validate } from '#middlewares/validation.middleware.js';
import {
  adminListQuerySchema,
  bookIdParamsSchema,
  bulkIdsBodySchema,
} from '#validators/admin.validator.js';
import { uploadBookFiles } from '#middlewares/upload.middleware.js';

import {
  getBooks,
  createBookHandler,
  updateBookHandler,
  deleteBookHandler,
  deleteBooksBulkHandler,
  getBookFormatsHandler,
  getDeletedBooksHandler,
  restoreBookHandler,
  hardDeleteBookHandler,
} from '#controllers/admin/book.controller.js';

const router = express.Router();

const adminGuard = [authenticateToken, authorizeRole(ROLES.ADMIN)];

router.get('/admin/books/deleted',
  ...adminGuard,
  validate(adminListQuerySchema, 'query'),
  getDeletedBooksHandler
);

router.get('/admin/books',
  ...adminGuard,
  validate(adminListQuerySchema, 'query'),
  getBooks
);

router.post('/admin/books/create',
  ...adminGuard,
  uploadBookFiles,          // multer must run before body validation
  createBookHandler
);

router.put('/admin/books/update/:bookId',
  ...adminGuard,
  validate(bookIdParamsSchema, 'params'),
  uploadBookFiles,
  updateBookHandler
);

router.patch('/admin/books/restore/:bookId',
  ...adminGuard,
  validate(bookIdParamsSchema, 'params'),
  restoreBookHandler
);

router.delete('/admin/books/hard-delete/:bookId',
  ...adminGuard,
  validate(bookIdParamsSchema, 'params'),
  hardDeleteBookHandler
);

router.delete('/admin/books/delete/:bookId',
  ...adminGuard,
  validate(bookIdParamsSchema, 'params'),
  deleteBookHandler
);

router.delete('/admin/books',
  ...adminGuard,
  validate(bulkIdsBodySchema, 'body'),
  deleteBooksBulkHandler
);

// Public route — for the reader
router.get('/books/:bookId/formats',
  validate(bookIdParamsSchema, 'params'),
  getBookFormatsHandler
);

export { router as adminBookRouter };
