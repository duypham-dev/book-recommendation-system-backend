import express from 'express';
import { authenticateToken } from '#middlewares/authenticateToken.js';
import {
  getBookRatings,
  createOrUpdateRating,
  deleteRating,
  getAverageRating,
  getMyRating
} from '#controllers/user/rating.controller.js';


const router = express.Router();

// Get ratings for a book
router.get('/books/:bookId/ratings', getBookRatings);

// Get average rating for a book
router.get('/books/:bookId/average-rating', getAverageRating);

// AUTHENTICATED ROUTES
// Get user's own rating for a book
router.get('/books/:bookId/ratings/me', authenticateToken, getMyRating);

//Create new or update user's rating for a book
router.post('/books/:bookId/ratings', authenticateToken, createOrUpdateRating)
      .delete('/books/:bookId/ratings', authenticateToken, deleteRating);


export { router as ratingRouter };
