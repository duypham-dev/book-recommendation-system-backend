import { ApiResponse, logger } from "#utils/index.js";
import { ratingService } from "#services/rating.service.js";
import { publishFeedback } from '../../publishers/recommendation.publisher.js';

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
    const { bookId } = req.params;
    
    // 1. Call service to get raw entities
    const ratings = await ratingService.getBookRatings(null, bookId);
    
    // 2. Transform via mapper
    const response = toRatingListResponse(ratings);
    
    return ApiResponse.success(res, response, 'Ratings fetched successfully');
  } catch (error) {
    logger.error('Get ratings error:', error);
    return ApiResponse.error(res, 'Failed to fetch ratings', 500);
  }
};

/**
 * GET /books/:bookId/ratings/me - Get user's rating for a book
 */
export const getMyRating = async (req, res) => {
  try {
    const { bookId } = req.params;
    const userId = req.user.userId; // Lấy từ Token
    
    const ratings = await ratingService.getBookRatings(userId, bookId);
    // Giả sử service trả về mảng, lấy phần tử đầu tiên
    const myRating = ratings.length > 0 ? ratings[0] : null; 
    
    return ApiResponse.success(res, myRating, 'User rating fetched successfully');
  } catch (error) {
    logger.error('Get my rating error:', error);
    return ApiResponse.error(res, 'Failed to fetch user rating', 500);
  }
};


/**
 * POST /users/:userId/books/:bookId/ratings - Create or update rating
 */
export const createOrUpdateRating = async (req, res) => {
  try {
    const { bookId } = req.params;
    const userId = req.user.userId;
    const { value, comment } = req.body;

    if (!value || value < 1 || value > 5) {
      return ApiResponse.error(res, 'Rating value must be between 1 and 5', 400);
    }
    
    // 1. Call service
    const result = await ratingService.createOrUpdateRating(userId, bookId, value, comment);
    
    // 2. Publish feedback event to RS (fire-and-forget)
    publishFeedback(userId, { bookId, event: 'rating', ratingValue: value });
    
    // 3. Transform via mapper
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
    
    // Publish rating removal event to RS (strength 0 signals deletion)
    publishFeedback(userId, { bookId, event: 'rating', ratingValue: 0 });
    
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
