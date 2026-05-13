import express from 'express';
import { authenticateToken } from '#middlewares/authenticateToken.js';
import { authorizeRole } from '#middlewares/authorize.middleware.js';
import { ROLES } from '#constants/roles.js';
import { validate } from '#middlewares/validation.middleware.js';
import {
  adminListQuerySchema,
  userIdParamsSchema,
  bulkIdsBodySchema,
} from '#validators/admin.validator.js';

import { getAllUsers, banUser, unbanUser, banUsersBulk } from '#controllers/admin/user.controller.js';

const router = express.Router();

const adminGuard = [authenticateToken, authorizeRole(ROLES.ADMIN)];

router.get('/admin/users',
  ...adminGuard,
  validate(adminListQuerySchema, 'query'),
  getAllUsers
);

router.patch('/users/:userId/ban',
  ...adminGuard,
  validate(userIdParamsSchema, 'params'),
  banUser
);

router.patch('/users/:userId/unban',
  ...adminGuard,
  validate(userIdParamsSchema, 'params'),
  unbanUser
);

router.patch('/users/ban',
  ...adminGuard,
  validate(bulkIdsBodySchema, 'body'),
  banUsersBulk
);

export { router as userManagementRouter };
