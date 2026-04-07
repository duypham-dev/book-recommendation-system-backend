import express from 'express';
import { authenticateToken } from '#middlewares/authenticateToken.js';
import {
  getBookRatings,
  createOrUpdateRating,
  deleteRating,
  getAverageRating,
} from '#controllers/user/rating.controller.js';


const router = express.Router();

// Get ratings for a book (userId='0' returns all ratings)
router.get('/users/:userId/books/:bookId/ratings', getBookRatings);

// Get average rating for a book
router.get('/users/:userId/books/:bookId/average-rating', getAverageRating);

// Ratings routes (create/update/delete require auth)
router.post('/users/:userId/books/:bookId/ratings', authenticateToken, createOrUpdateRating);
router.delete('/users/:userId/books/:bookId/ratings', authenticateToken, deleteRating);


export { router as ratingRouter };
