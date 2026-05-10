import express from 'express';
import { authenticateToken } from '#middlewares/authenticateToken.js';
import {
  getUserHistory,
  getBookProgress,
  recordHistory,
} from '#controllers/user/history.controller.js';
const router = express.Router();

// History routes
router.get('/users/history', authenticateToken, getUserHistory);
router.get('/users/books/:bookId/progress', authenticateToken, getBookProgress);
router.post('/users/books/:bookId/history', authenticateToken, recordHistory);

export { router as historyRouter };
