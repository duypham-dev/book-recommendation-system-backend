import express from 'express';
import { authenticateToken } from '#middlewares/authenticateToken.js';
import { authorizeRole } from '#middlewares/authorize.middleware.js';
import {ROLES} from '#constants/roles.js';

// Genre management Controllers
import { 
  getGenresWithPagination, 
  createGenre, 
  updateGenre, 
  deleteGenre
} from '#controllers/admin/genre.controller.js';

const router = express.Router();

// ============================================
// ADMIN GENRE MANAGEMENT
// ============================================
router.get('/admin/books/genres', getGenresWithPagination);
router.post('/admin/genres/create', authenticateToken, authorizeRole(ROLES.ADMIN), createGenre);
router.put('/admin/genres/update/:genreId', authenticateToken, authorizeRole(ROLES.ADMIN), updateGenre);
router.delete('/admin/genres/delete/:genreId', authenticateToken, authorizeRole(ROLES.ADMIN), deleteGenre);

export { router as adminGenreRouter };
