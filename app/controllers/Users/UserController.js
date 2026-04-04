/**
 * User Controller
 * Handles user profile, favorites, bookmarks, history, ratings
 * 
 * Best Practice Architecture:
 * - Controller handles HTTP request/response
 * - Service handles business logic, returns raw entities
 * - Mapper transforms entities to API response format
 */
import { ApiResponse, logger } from "#utils/index.js";
import { userService } from "#services/userService.js";
import { checkExistingUser } from "#services/authService.js";
import { favoriteService } from "#services/favoriteService.js";
import { historyService } from "#services/historyService.js";
import { ratingService } from "#services/ratingService.js";

import { hashPassword, comparePassword } from "#utils/hashPassword.js";
import { signAccessToken } from "#utils/jwt.js";

// Import mappers
import { toUserResponse, toUserProfileResponse, toUserAvatarResponse, toUserPaginatedResponse } from "#mappers/user.mapper.js";
import { toFavoriteActionResponse, toFavoritePaginatedResponse } from "#mappers/favorite.mapper.js";
import { toHistoryPaginatedResponse, toHistoryActionResponse } from "#mappers/history.mapper.js";
import { toRatingListResponse, toRatingCreateResponse, toAverageRatingResponse } from "#mappers/rating.mapper.js";


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

// ============================================
// FAVORITES ENDPOINTS
// ============================================

/**
 * GET /users/:userId/favorites - Get user's favorites (paginated)
 */
export const getUserFavorites = async (req, res) => {
  try {
    const { userId }  = req.user;
    logger.info(`Fetching favorites for user ${userId}`);
    const { page = 0, size = 12 } = req.query;
    
    // 1. Call service to get raw entities with pagination
    const result = await favoriteService.getUserFavorites(userId, parseInt(page), parseInt(size));
    
    // 2. Transform via mapper
    const response = toFavoritePaginatedResponse(result);
    
    return ApiResponse.success(res, response, 'Favorites fetched successfully');
  } catch (error) {
    logger.error('Get favorites error:', error);
    return ApiResponse.error(res, 'Failed to fetch favorites', 500);
  }
};

/**
 * POST /users/:userId/favorites/:bookId - Add to favorites
 */
export const addFavorite = async (req, res) => {
  try {
    const { userId } = req.user;
    const { bookId } = req.params;
    
    // Verify user owns this action
    if (req.user.userId !== userId) {
      return ApiResponse.error(res, 'Unauthorized', 403);
    }
    
    // 1. Call service
    const result = await favoriteService.addFavorite(userId, bookId);
    
    // 2. Transform via mapper
    const response = toFavoriteActionResponse(result.entity, result.alreadyExists);
    
    if (result.alreadyExists) {
      return ApiResponse.success(res, response, 'Book already in favorites');
    }
    
    return ApiResponse.created(res, response, 'Added to favorites');
  } catch (error) {
    logger.error('Add favorite error:', error);
    return ApiResponse.error(res, 'Failed to add to favorites', 500);
  }
};

/**
 * DELETE /users/:userId/favorites/:bookId - Remove from favorites
 */
export const removeFavorite = async (req, res) => {
  try {
    const { userId } = req.user;
    const { bookId } = req.params;
    
    // Verify user owns this action
    if (req.user.userId !== userId) {
      return ApiResponse.error(res, 'Unauthorized', 403);
    }
    
    const removed = await favoriteService.removeFavorite(userId, bookId);
    
    if (!removed) {
      return ApiResponse.error(res, 'Favorite not found', 404);
    }
    
    return ApiResponse.success(res, null, 'Removed from favorites');
  } catch (error) {
    logger.error('Remove favorite error:', error);
    return ApiResponse.error(res, 'Failed to remove from favorites', 500);
  }
};

// ============================================
// HISTORY ENDPOINTS
// ============================================

/**
 * GET /users/:userId/history - Get reading history
 */
export const getUserHistory = async (req, res) => {
  try {
    const { userId } = req.user;
    const { page = 0, size = 10 } = req.query;
    
    // 1. Call service to get raw data
    const result = await historyService.getUserHistory(userId, parseInt(page), parseInt(size));
    
    // 2. Transform via mapper
    const response = toHistoryPaginatedResponse(result);
    
    return ApiResponse.success(res, response, 'History fetched successfully');
  } catch (error) {
    logger.error('Get history error:', error);
    return ApiResponse.error(res, 'Failed to fetch history', 500);
  }
};

/**
 * POST /users/:userId/books/:bookId/history - Record reading progress
 */
export const recordHistory = async (req, res) => {
  try {
    const { userId } = req.user;

    const { bookId } = req.params;
    const { progress } = req.body;
    
    // Verify user owns this action
    if (req.user.userId !== userId) {
      return ApiResponse.error(res, 'Unauthorized', 403);
    }
    
    // 1. Call service
    const result = await historyService.recordHistory(userId, bookId, progress);
    
    // 2. Transform via mapper
    const response = toHistoryActionResponse(result.entity, result.isNew);
    
    return ApiResponse.success(res, response, 'Reading progress recorded');
  } catch (error) {
    logger.error('Record history error:', error);
    return ApiResponse.error(res, 'Failed to record history', 500);
  }
};

// ============================================
// RATINGS ENDPOINTS
// ============================================

/**
 * GET /users/:userId/books/:bookId/ratings - Get ratings
 */
export const getBookRatings = async (req, res) => {
  try {
    const { userId, bookId } = req.params;
    
    // 1. Call service to get raw entities
    const ratings = await ratingService.getBookRatings(userId, bookId);
    
    // 2. Transform via mapper
    const response = toRatingListResponse(ratings);
    
    return ApiResponse.success(res, response, 'Ratings fetched successfully');
  } catch (error) {
    logger.error('Get ratings error:', error);
    return ApiResponse.error(res, 'Failed to fetch ratings', 500);
  }
};

/**
 * POST /users/:userId/books/:bookId/ratings - Create or update rating
 */
export const createOrUpdateRating = async (req, res) => {
  try {
    const { userId, bookId } = req.params;
    const { value, comment } = req.body;
    
    // Verify user owns this action
    if (req.user.userId !== userId) {
      return ApiResponse.error(res, 'Unauthorized', 403);
    }
    
    if (!value || value < 1 || value > 5) {
      return ApiResponse.error(res, 'Rating value must be between 1 and 5', 400);
    }
    
    // 1. Call service
    const result = await ratingService.createOrUpdateRating(userId, bookId, value, comment);
    
    // 2. Transform via mapper
    const response = toRatingCreateResponse(result.entity, result.isNew);
    
    return ApiResponse.success(res, response, result.isNew ? 'Rating created' : 'Rating updated');
  } catch (error) {
    logger.error('Create/update rating error:', error);
    return ApiResponse.error(res, 'Failed to save rating', 500);
  }
};

/**
 * DELETE /users/:userId/books/:bookId/ratings - Delete rating
 */
export const deleteRating = async (req, res) => {
  try {
    const { userId, bookId } = req.params;
    
    // Verify user owns this action
    if (req.user.userId !== userId) {
      return ApiResponse.error(res, 'Unauthorized', 403);
    }
    
    const deleted = await ratingService.deleteRating(userId, bookId);
    
    if (!deleted) {
      return ApiResponse.error(res, 'Rating not found', 404);
    }
    
    return ApiResponse.success(res, null, 'Rating deleted');
  } catch (error) {
    logger.error('Delete rating error:', error);
    return ApiResponse.error(res, 'Failed to delete rating', 500);
  }
};

/**
 * GET /users/:userId/books/:bookId/average-rating - Get average rating
 */
export const getAverageRating = async (req, res) => {
  try {
    const { bookId } = req.params;
    
    // 1. Call service to get raw aggregation
    const result = await ratingService.getAverageRating(bookId);
    
    // 2. Transform via mapper
    const response = toAverageRatingResponse(result);
    
    return ApiResponse.success(res, response, 'Average rating fetched');
  } catch (error) {
    logger.error('Get average rating error:', error);
    return ApiResponse.error(res, 'Failed to fetch average rating', 500);
  }
};

// ============================================
// ADMIN USER MANAGEMENT
// ============================================

/**
 * GET /admin/users - Get all users (Admin)
 */
export const getAllUsers = async (req, res) => {
  try {
    const { page = 0, size = 10, keyword = '', status = '', sort = '' } = req.query;
    
    // 1. Call service to get raw data
    const result = await userService.getAllUsers(
      parseInt(page), 
      parseInt(size), 
      keyword, 
      status, 
      sort
    );
    
    // 2. Transform via mapper
    const response = toUserPaginatedResponse(result);
    
    return ApiResponse.success(res, response, 'Users fetched successfully');
  } catch (error) {
    logger.error('Get all users error:', error);
    return ApiResponse.error(res, 'Failed to fetch users', 500);
  }
};

/**
 * PATCH /users/:userId/ban - Ban user (Admin)
 */
export const banUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    await userService.banUser(userId);
    
    logger.info(`User ${userId} banned by admin ${req.user.userId}`);
    
    return ApiResponse.success(res, null, 'User banned successfully');
  } catch (error) {
    logger.error('Ban user error:', error);
    return ApiResponse.error(res, 'Failed to ban user', 500);
  }
};

/**
 * PATCH /users/:userId/unban - Unban user (Admin)
 */
export const unbanUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    await userService.unbanUser(userId);
    
    logger.info(`User ${userId} unbanned by admin ${req.user.userId}`);
    
    return ApiResponse.success(res, null, 'User unbanned successfully');
  } catch (error) {
    logger.error('Unban user error:', error);
    return ApiResponse.error(res, 'Failed to unban user', 500);
  }
};

/**
 * PATCH /users/ban - Bulk ban users (Admin)
 */
export const banUsersBulk = async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return ApiResponse.error(res, 'User IDs are required', 400);
    }
    
    await userService.banUsersBulk(ids);
    
    logger.info(`${ids.length} users banned by admin ${req.user.userId}`);
    
    return ApiResponse.success(res, null, `${ids.length} users banned successfully`);
  } catch (error) {
    logger.error('Bulk ban users error:', error);
    return ApiResponse.error(res, 'Failed to ban users', 500);
  }
};
