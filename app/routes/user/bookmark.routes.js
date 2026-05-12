import express from 'express';
import { authenticateToken } from '#middlewares/authenticateToken.js';
import {
  getBookmarks,
  createBookmark,
  updateBookmark,
  deleteBookmark,
} from '#controllers/user/bookmark.controller.js';

const router = express.Router();

// ============================================
// BOOKMARK ROUTES (authentication required)
// ============================================

router.get('/books/:bookId/bookmarks', authenticateToken, getBookmarks);
router.post('/books/:bookId/bookmarks', authenticateToken, createBookmark);
router.put('/bookmarks/:bookmarkId', authenticateToken, updateBookmark);
router.delete('/bookmarks/:bookmarkId', authenticateToken, deleteBookmark);

export { router as bookmarkRouter };
