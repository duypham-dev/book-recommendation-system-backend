import express from 'express';
import { authenticateToken } from '#middlewares/authenticateToken.js';
import { authorizeRole } from '#middlewares/authorize.middleware.js';
import {ROLES} from '#constants/roles.js';
import { uploadBookFiles } from '#middlewares/upload.middleware.js';

// Book management Controllers
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

// ============================================
// ADMIN BOOK MANAGEMENT
// ============================================
router.get('/admin/books/deleted', authenticateToken, authorizeRole(ROLES.ADMIN), getDeletedBooksHandler );
router.patch('/admin/books/restore/:bookId', authenticateToken, authorizeRole(ROLES.ADMIN), restoreBookHandler);
router.get('/admin/books', authenticateToken, authorizeRole(ROLES.ADMIN), getBooks);
router.post('/admin/books/create', authenticateToken,  authorizeRole(ROLES.ADMIN), uploadBookFiles, createBookHandler);
router.put('/admin/books/update/:bookId', authenticateToken, authorizeRole(ROLES.ADMIN), uploadBookFiles,  updateBookHandler);
router.delete('/admin/books/hard-delete/:bookId', authenticateToken, authorizeRole(ROLES.ADMIN), hardDeleteBookHandler);
router.delete('/admin/books/delete/:bookId', authenticateToken, authorizeRole(ROLES.ADMIN), deleteBookHandler);
router.delete('/admin/books', authenticateToken, authorizeRole(ROLES.ADMIN), deleteBooksBulkHandler);

// Book formats (public - for reader)
router.get('/books/:bookId/formats', getBookFormatsHandler);

export { router as adminBookRouter };
