import express from 'express';
import { authenticateToken } from '#middlewares/authenticateToken.js';
import { validate, validateMultiple } from '#middlewares/validation.middleware.js';
import {
  bookIdParamsSchema,
  ratingBodySchema,
} from '#validators/interaction.validator.js';

import {
  getBookRatings,
  createOrUpdateRating,
  deleteRating,
  getAverageRating,
  getMyRating,
} from '#controllers/user/rating.controller.js';

const router = express.Router();

// Public — no auth required
router.get('/books/:bookId/ratings',      validate(bookIdParamsSchema, 'params'), getBookRatings);
router.get('/books/:bookId/average-rating', validate(bookIdParamsSchema, 'params'), getAverageRating);

// Authenticated
router.get('/books/:bookId/ratings/me',
  authenticateToken,
  validate(bookIdParamsSchema, 'params'),
  getMyRating
);

router.post('/books/:bookId/ratings',
  authenticateToken,
  validateMultiple({ params: bookIdParamsSchema, body: ratingBodySchema }),
  createOrUpdateRating
);

router.delete('/books/:bookId/ratings',
  authenticateToken,
  validate(bookIdParamsSchema, 'params'),
  deleteRating
);

export { router as ratingRouter };
