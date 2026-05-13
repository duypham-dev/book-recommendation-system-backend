import express from 'express';
import { authenticateToken } from '#middlewares/authenticateToken.js';
import { validate, validateMultiple } from '#middlewares/validation.middleware.js';
import {
  bookIdParamsSchema,
  historyBodySchema,
  historyQuerySchema,
} from '#validators/interaction.validator.js';

import {
  getUserHistory,
  getBookProgress,
  recordHistory,
} from '#controllers/user/history.controller.js';

const router = express.Router();

router.get('/users/history',
  authenticateToken,
  validate(historyQuerySchema, 'query'),
  getUserHistory
);

router.get('/users/books/:bookId/progress',
  authenticateToken,
  validate(bookIdParamsSchema, 'params'),
  getBookProgress
);

router.post('/users/books/:bookId/history',
  authenticateToken,
  validateMultiple({ params: bookIdParamsSchema, body: historyBodySchema }),
  recordHistory
);

export { router as historyRouter };
