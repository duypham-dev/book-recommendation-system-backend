import { ApiResponse, logger } from "#utils/index.js";
import { favoriteService } from "#services/favorite.service.js";
import { publishFeedback } from '../../publishers/recommendation.publisher.js';

// Import mappers
import { toFavoriteActionResponse, toFavoritePaginatedResponse } from "#mappers/favorite.mapper.js";

// FAVORITES ENDPOINTS
/**
 * GET /users/favorites - Get user's favorites (paginated)
 */
export const getUserFavorites = async (req, res) => {
  try {
    const { userId }  = req.user;
    const { page, size } = req.query;
    
    // 1. Call service to get raw entities with pagination
    const result = await favoriteService.getUserFavorites(userId, page, size);
    
    // 2. Transform via mapper
    const response = toFavoritePaginatedResponse(result);
    
    return ApiResponse.success(res, response, 'Favorites fetched successfully');
  } catch (error) {
    logger.error('Get favorites error:', error);
    return ApiResponse.error(res, 'Failed to fetch favorites', 500);
  }
};

/**
 * POST /users/favorites/:bookId - Add to favorites
 */
export const addFavorite = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { bookId } = req.params;

    const result = await favoriteService.addFavorite(userId, bookId);
    const response = toFavoriteActionResponse(result.entity, result.alreadyExists);

    if (result.alreadyExists) {
      return ApiResponse.success(res, response, 'Book already in favorites');
    }

    publishFeedback(userId, { bookId, event: 'favorite', ratingValue: 5 });
    return ApiResponse.created(res, response, 'Added to favorites');
  } catch (error) {
    logger.error('Add favorite error:', error);
    next(error);
  }
};

/**
 * DELETE /users/favorites/:bookId - Remove from favorites
 */
export const removeFavorite = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { bookId } = req.params;

    const removed = await favoriteService.removeFavorite(userId, bookId);

    if (!removed) {
      return ApiResponse.error(res, 'Favorite not found', 404);
    }

    publishFeedback(userId, { bookId, event: 'favorite', ratingValue: 0 });
    return ApiResponse.success(res, null, 'Removed from favorites');
  } catch (error) {
    logger.error('Remove favorite error:', error);
    next(error);
  }
};