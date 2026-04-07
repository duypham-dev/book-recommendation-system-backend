import express from 'express';
import { authenticateToken } from '#middlewares/authenticateToken.js';
import { authorizeRole } from '#middlewares/authorize.middleware.js';
import {ROLES} from '#constants/roles.js';
import {getAllUsers, banUser, unbanUser, banUsersBulk } from '#controllers/admin/user.controller.js';

const router = express.Router();

// ============================================
// ADMIN USER MANAGEMENT
// ============================================
router.get('/admin/users', authenticateToken, authorizeRole(ROLES.ADMIN), getAllUsers);

router.patch('/users/:userId/ban', authenticateToken, banUser);
router.patch('/users/:userId/unban', authenticateToken, unbanUser);
router.patch('/users/ban', authenticateToken, banUsersBulk);

export { router as userManagementRouter };
