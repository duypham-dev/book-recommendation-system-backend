import express from 'express';
import { authenticateToken } from '#middlewares/authenticateToken.js';
import {
  getUserFavorites,
  addFavorite,
  removeFavorite,
} from '#controllers/user/favorite.controller.js';


const router = express.Router();

// Favorites routes
router.get('/users/favorites', authenticateToken, getUserFavorites);
router.post('/users/favorites/:bookId', authenticateToken, addFavorite);
router.delete('/users/favorites/:bookId', authenticateToken, removeFavorite);

export { router as favoriteRouter };
