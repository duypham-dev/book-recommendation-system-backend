import express from 'express';
import { authenticateToken } from '#middlewares/authenticateToken.js';
import { authorizeRole } from '#middlewares/authorize.middleware.js';
import {ROLES} from '#constants/roles.js';
import { uploadBookFiles } from '#middlewares/upload.middleware.js';

// Dashboard Controllers
import { getTopFavoritedBooks, getTopRatedBooks, getStats, getNewUsers } from '#controllers/admin/dashboard.controller.js';

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

// Genre management Controllers
import { 
  getGenresWithPagination, 
  createGenre, 
  updateGenre, 
  deleteGenre
} from '#controllers/admin/genre.controller.js';

// User management Controllers
import { getAllUsers } from '#controllers/users/UserController.js';


const router = express.Router();

// ============================================
// ADMIN DASHBOARD
// ============================================
router.get('/admin/dashboard/top-rated-books', authenticateToken, authorizeRole(ROLES.ADMIN), getTopRatedBooks);
router.get('/admin/dashboard/top-favorited-books', authenticateToken, authorizeRole(ROLES.ADMIN), getTopFavoritedBooks);
router.get('/admin/dashboard/stats', authenticateToken, authorizeRole(ROLES.ADMIN), getStats);
router.get('/admin/dashboard/new-users', authenticateToken, authorizeRole(ROLES.ADMIN), getNewUsers);
// ============================================
// ADMIN BOOK MANAGEMENT
// ============================================
router.get('/admin/books/deleted',
  authenticateToken, 
  authorizeRole(ROLES.ADMIN), 
  getDeletedBooksHandler
);

router.patch('/admin/books/restore/:bookId', authenticateToken, authorizeRole(ROLES.ADMIN), restoreBookHandler);
router.get('/admin/books', authenticateToken, authorizeRole(ROLES.ADMIN), getBooks);
router.post('/admin/books/create', authenticateToken,  authorizeRole(ROLES.ADMIN), uploadBookFiles, createBookHandler);
router.put('/admin/books/update/:bookId', authenticateToken, authorizeRole(ROLES.ADMIN), uploadBookFiles,  updateBookHandler);
router.delete('/admin/books/hard-delete/:bookId', authenticateToken, authorizeRole(ROLES.ADMIN), hardDeleteBookHandler);
router.delete('/admin/books/delete/:bookId', authenticateToken, authorizeRole(ROLES.ADMIN), deleteBookHandler);
router.delete('/admin/books', authenticateToken, authorizeRole(ROLES.ADMIN), deleteBooksBulkHandler);

// Book formats (public - for reader)
router.get('/books/:bookId/formats', getBookFormatsHandler);

// ============================================
// ADMIN GENRE MANAGEMENT
// ============================================
router.get('/admin/books/genres', getGenresWithPagination);
router.post('/admin/genres/create', authenticateToken, authorizeRole(ROLES.ADMIN), createGenre);
router.put('/admin/genres/update/:genreId', authenticateToken, authorizeRole(ROLES.ADMIN), updateGenre);
router.delete('/admin/genres/delete/:genreId', authenticateToken, authorizeRole(ROLES.ADMIN), deleteGenre);

// ============================================
// ADMIN USER MANAGEMENT
// ============================================
router.get('/admin/users', authenticateToken, authorizeRole(ROLES.ADMIN), getAllUsers);

export { router as adminRouter };
