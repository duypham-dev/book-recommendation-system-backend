import express from 'express';
import { authenticateToken } from '#middlewares/authenticateToken.js';
import { authorizeRole } from '#middlewares/authorize.middleware.js';
import { ROLES } from '#constants/roles.js';
import { validate, validateMultiple } from '#middlewares/validation.middleware.js';
import {
  adminListQuerySchema,
  genreIdParamsSchema,
  genreBodySchema,
} from '#validators/admin.validator.js';

import {
  getGenresWithPagination,
  createGenre,
  updateGenre,
  deleteGenre,
} from '#controllers/admin/genre.controller.js';

const router = express.Router();

const adminGuard = [authenticateToken, authorizeRole(ROLES.ADMIN)];

router.get('/admin/books/genres',
  validate(adminListQuerySchema, 'query'),
  getGenresWithPagination
);

router.post('/admin/genres/create',
  ...adminGuard,
  validate(genreBodySchema, 'body'),
  createGenre
);

router.put('/admin/genres/update/:genreId',
  ...adminGuard,
  validateMultiple({ params: genreIdParamsSchema, body: genreBodySchema }),
  updateGenre
);

router.delete('/admin/genres/delete/:genreId',
  ...adminGuard,
  validate(genreIdParamsSchema, 'params'),
  deleteGenre
);

export { router as adminGenreRouter };
