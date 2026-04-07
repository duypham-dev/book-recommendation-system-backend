import express from 'express';
import { authenticateToken } from '#middlewares/authenticateToken.js';
import { authorizeRole } from '#middlewares/authorize.middleware.js';
import {ROLES} from '#constants/roles.js';

// Dashboard Controllers
import { getTopFavoritedBooks, getTopRatedBooks, getStats, getNewUsers } from '#controllers/admin/dashboard.controller.js';

const router = express.Router();

// ============================================
// ADMIN DASHBOARD
// ============================================
router.get('/admin/dashboard/top-rated-books', authenticateToken, authorizeRole(ROLES.ADMIN), getTopRatedBooks);
router.get('/admin/dashboard/top-favorited-books', authenticateToken, authorizeRole(ROLES.ADMIN), getTopFavoritedBooks);
router.get('/admin/dashboard/stats', authenticateToken, authorizeRole(ROLES.ADMIN), getStats);
router.get('/admin/dashboard/new-users', authenticateToken, authorizeRole(ROLES.ADMIN), getNewUsers);

export { router as dashboardRouter };
