import { ApiResponse, logger } from "#utils/index.js";
import { ratingService } from "#services/rating.service.js";

// Import mappers
import { toRatingListResponse, toRatingCreateResponse, toAverageRatingResponse } from "#mappers/rating.mapper.js";


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
