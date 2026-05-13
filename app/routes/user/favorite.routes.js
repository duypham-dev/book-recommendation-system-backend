import express from 'express';
import { authenticateToken } from '#middlewares/authenticateToken.js';
import { validate } from '#middlewares/validation.middleware.js';
import {
  favoriteParamsSchema,
  favoritesQuerySchema,
} from '#validators/interaction.validator.js';

import {
  getUserFavorites,
  addFavorite,
  removeFavorite,
} from '#controllers/user/favorite.controller.js';

const router = express.Router();

router.get('/users/favorites',
  authenticateToken,
  validate(favoritesQuerySchema, 'query'),
  getUserFavorites
);

router.post('/users/favorites/:bookId',
  authenticateToken,
  validate(favoriteParamsSchema, 'params'),
  addFavorite
);

router.delete('/users/favorites/:bookId',
  authenticateToken,
  validate(favoriteParamsSchema, 'params'),
  removeFavorite
);

export { router as favoriteRouter };
