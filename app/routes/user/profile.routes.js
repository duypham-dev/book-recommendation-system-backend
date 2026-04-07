import express from 'express';
import { authenticateToken } from '#middlewares/authenticateToken.js';
import {
  getUserProfile,
  updateUserProfile,
  updateUserAvatar,
  changeUserPassword,
} from '#controllers/user/profile.controller.js';

import { uploadAvatarFile } from '#middlewares/upload.middleware.js';

const router = express.Router();

router.get('/users/profile', authenticateToken, getUserProfile);
router.put('/users/profile', authenticateToken, updateUserProfile);
router.patch('/users/avatar', authenticateToken, uploadAvatarFile, updateUserAvatar);
router.patch('/users/change-password', authenticateToken, changeUserPassword);

export { router as profileRouter };
