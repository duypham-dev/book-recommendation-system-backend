/**
 * User Controller
 * Handles user profile, favorites, bookmarks, history, ratings
 * 
 * Best Practice Architecture:
 * - Controller handles HTTP request/response
 * - Service handles business logic, returns raw entities
 * - Mapper transforms entities to API response format
 */

import { userService } from "#services/user.service.js";
import { checkExistingUser } from "#services/auth.service.js";

import { ApiResponse, logger } from "#utils/index.js";
import { hashPassword, comparePassword } from "#utils/hashPassword.js";
import { signAccessToken } from "#utils/jwt.js";

// Import mappers
import { toUserResponse, toUserProfileResponse, toUserAvatarResponse } from "#mappers/user.mapper.js";

//Import storage service for avatar uploads
import { uploadToCloudinary, deleteFromCloudinary, CLOUDINARY_FOLDERS } from "#services/storage.service.js";

// ============================================
// PROFILE ENDPOINTS
// ============================================

/**
 * GET /users/:userId - Get user profile
 */
export const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.user;
    logger.info(`Fetching profile for user ${userId}`);
    // 1. Call service to get raw entity
    const user = await userService.getUserById(userId);
    
    if (!user) {
      return ApiResponse.error(res, 'User not found', 404);
    }
    
    // 2. Transform via mapper
    const response = toUserResponse(user);

    return ApiResponse.success(res, response, 'User profile fetched successfully');
  } catch (error) {
    logger.error('Get user profile error:', error);
    return ApiResponse.error(res, 'Failed to fetch user profile', 500);
  }
};

/**
 * PUT /users/:userId/update - Update user profile
 */
export const updateUserProfile = async (req, res) => {
  try {
    const { userId } = req.user;
    const { username, fullName, phoneNumber, avatarUrl } = req.body;

    logger.info(`Updating profile for user ${userId} with data: ${JSON.stringify(req.body)}`);

    // Verify user owns this profile or is admin
    if (req.user.userId !== userId && req.user.role !== 'ADMIN') {
      return ApiResponse.error(res, 'Unauthorized', 403);
    }

    //Check new username doesn't conflict with another user (if username is being updated)
    const duplicateInfo = await checkExistingUser(null, username, phoneNumber, userId);
    if (duplicateInfo) {
      if (duplicateInfo.usernameExist) {
        return ApiResponse.error(res, 'Username already taken', 400);
      }
      if (duplicateInfo.phoneNumberExist) {
        return ApiResponse.error(res, 'Phone number already in use', 400);
      }
    }

    logger.info(`Updating profile for user ${userId} with data: ${JSON.stringify(req.body)}`);
    // If no conflicts, call service to update
    const user = await userService.updateUserProfile(userId, {
      username,
      fullName,
      phoneNumber,
      avatarUrl,
    });

    //Transform via mapper
    const userProfile = toUserProfileResponse(user);

    //Issue a new access token with updated claims so frontend stays in sync
    //    without needing an extra round-trip to /auth/profile
    const { accessToken } = signAccessToken({
      userId: userProfile.id,
      email: userProfile.email,
      fullName: userProfile.fullName,
      role: 'USER',
      avatarUrl: userProfile.avatarUrl || null,
    });

    return ApiResponse.success(res, { user: userProfile, accessToken }, 'Profile updated successfully');
  } catch (error) {
    logger.error('Update user profile error:', error);
    return ApiResponse.error(res, 'Failed to update profile', 500);
  }
};

/**
 * PATCH /users/:userId/avatar - Update user avatar
 */
export const updateUserAvatar = async (req, res) => {
  try {
    const { userId } = req.user;

    // Verify user owns this profile
    if (!userId || req.user.userId !== userId) {
      return ApiResponse.error(res, 'Unauthorized', 403);
    }

    // Handle file upload to Cloudinary
    let avatarUrl = '';
    const avatarFile = req.files?.avatar?.[0];

    if (avatarFile) {
      // Upload file to Cloudinary and get URL
      const result = await uploadToCloudinary(avatarFile.buffer, CLOUDINARY_FOLDERS.AVATARS);
      if (!result.success) {
        return ApiResponse.error(res, 'Failed to upload avatar', 500);
      }
      avatarUrl = result.url;
    }

    if (!avatarUrl) {
      return ApiResponse.error(res, 'Cannot get avatar url from uploaded file', 400);
    }

    //1. Get current avatar URL to delete old one if exists
    const currentAvatarUrl = await userService.getAvatarUrl(userId);

    //2. Delete old avatar from Cloudinary if exists
    if (currentAvatarUrl) {
      await deleteFromCloudinary(currentAvatarUrl);
    }

    // 3. Call service to update
    const user = await userService.updateUserAvatar(userId, avatarUrl);

    // 4. Transform via mapper
    const avatarResponse = toUserAvatarResponse(user);

    // 5. Issue a new access token so avatarUrl claim is immediately up to date
    const { accessToken } = signAccessToken({
      userId: req.user.userId,
      email: req.user.email,
      fullName: req.user.fullName,
      role: req.user.role,
      avatarUrl: avatarResponse.avatarUrl,
    });

    return ApiResponse.success(res, { user: avatarResponse, accessToken }, 'Avatar updated successfully');
  } catch (error) {
    logger.error('Update avatar error:', error);
    return ApiResponse.error(res, 'Failed to update avatar', 500);
  }
};

/**
 * PATCH /users/:userId/change-password - Change password
 */
export const changeUserPassword = async (req, res) => {
  try {
    const { userId } = req.user;
    const { currentPassword, newPassword } = req.body;
    
    // Verify user owns this profile
    if (req.user.userId !== userId) {
      return ApiResponse.error(res, 'Unauthorized', 403);
    }
    
    if (!currentPassword || !newPassword) {
      return ApiResponse.error(res, 'Current and new password are required', 400);
    }
    
    if (newPassword.length < 6) {
      return ApiResponse.error(res, 'Password must be at least 6 characters', 400);
    }
    
    // Verify current password
    const currentHash = await userService.getUserPasswordHash(userId);
    const isValid = await comparePassword(currentPassword, currentHash);
    
    if (!isValid) {
      return ApiResponse.error(res, 'Current password is incorrect', 401);
    }
    
    // Hash and update new password
    const newHash = await hashPassword(newPassword);
    await userService.changeUserPassword(userId, newHash);
    
    return ApiResponse.success(res, null, 'Password changed successfully');
  } catch (error) {
    logger.error('Change password error:', error);
    return ApiResponse.error(res, 'Failed to change password', 500);
  }
};