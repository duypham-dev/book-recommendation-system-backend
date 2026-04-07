import express from 'express';
import { authenticateToken } from '#middlewares/authenticateToken.js';
import {
  getUserProfile,
  updateUserProfile,
  updateUserAvatar,
  changeUserPassword,
  getUserFavorites,
  addFavorite,
  removeFavorite,
  getUserHistory,
  recordHistory,
  getBookRatings,
  createOrUpdateRating,
  deleteRating,
  getAverageRating,
  banUser,
  unbanUser,
  banUsersBulk,
} from '#controllers/users/UserController.js';

import { uploadAvatarFile } from '#middlewares/upload.middleware.js';

const router = express.Router();

// ============================================
// PUBLIC ROUTES (for ratings, can be viewed without auth)
// ============================================

// Get ratings for a book (userId='0' returns all ratings)
router.get('/users/:userId/books/:bookId/ratings', getBookRatings);

// Get average rating for a book
router.get('/users/:userId/books/:bookId/average-rating', getAverageRating);

// ============================================
// PROTECTED ROUTES (authentication required)
// ============================================

// Profile routes
router.get('/users/profile', authenticateToken, getUserProfile);
router.put('/users/profile', authenticateToken, updateUserProfile);
router.patch('/users/avatar', authenticateToken, uploadAvatarFile, updateUserAvatar);
router.patch('/users/change-password', authenticateToken, changeUserPassword);

// Favorites routes
router.get('/users/favorites', authenticateToken, getUserFavorites);
router.post('/users/favorites/:bookId', authenticateToken, addFavorite);
router.delete('/users/favorites/:bookId', authenticateToken, removeFavorite);

// History routes
router.get('/users/history', authenticateToken, getUserHistory);
router.post('/users/books/:bookId/history', authenticateToken, recordHistory);

// Ratings routes (create/update/delete require auth)
router.post('/users/:userId/books/:bookId/ratings', authenticateToken, createOrUpdateRating);
router.delete('/users/:userId/books/:bookId/ratings', authenticateToken, deleteRating);

// User management (admin actions but can be user-initiated)
router.patch('/users/:userId/ban', authenticateToken, banUser);
router.patch('/users/:userId/unban', authenticateToken, unbanUser);
router.patch('/users/ban', authenticateToken, banUsersBulk);

export { router as UserRouter };
