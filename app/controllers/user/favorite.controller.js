import { ApiResponse, logger } from "#utils/index.js";
import { favoriteService } from "#services/favorite.service.js";

// Import mappers
import { toFavoriteActionResponse, toFavoritePaginatedResponse } from "#mappers/favorite.mapper.js";

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