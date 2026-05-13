import express from 'express';
import { authenticateToken } from '#middlewares/authenticateToken.js';
import { validate, validateMultiple } from '#middlewares/validation.middleware.js';
import {
  updateProfileBodySchema,
  changePasswordBodySchema,
} from '#validators/user.validator.js';

import {
  getUserProfile,
  updateUserProfile,
  updateUserAvatar,
  changeUserPassword,
} from '#controllers/user/profile.controller.js';

import { uploadAvatarFile } from '#middlewares/upload.middleware.js';

const router = express.Router();

router.get('/users/profile', authenticateToken, getUserProfile);

router.put('/users/profile',
  authenticateToken,
  validate(updateProfileBodySchema, 'body'),
  updateUserProfile
);

router.patch('/users/avatar',
  authenticateToken,
  uploadAvatarFile,       // multer runs before validation (file must exist first)
  updateUserAvatar
);

router.patch('/users/change-password',
  authenticateToken,
  validate(changePasswordBodySchema, 'body'),
  changeUserPassword
);

export { router as profileRouter };
