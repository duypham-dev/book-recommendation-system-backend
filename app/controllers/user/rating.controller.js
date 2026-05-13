import { ApiResponse, logger } from "#utils/index.js";
import { ratingService } from "#services/rating.service.js";
import { publishFeedback } from '../../publishers/recommendation.publisher.js';

// Import mappers
import { toRatingListResponse, toRatingCreateResponse, toAverageRatingResponse } from "#mappers/rating.mapper.js";

// RATINGS ENDPOINTS

/**
 * GET /books/:bookId/ratings - Get ratings
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
 * POST /books/:bookId/ratings - Create or update rating
 */
export const createOrUpdateRating = async (req, res, next) => {
  try {
    const { bookId } = req.params;
    const userId = req.user.userId;
    const { value, comment } = req.body; // ratingBodySchema validates value 1–5

    const result = await ratingService.createOrUpdateRating(userId, bookId, value, comment);
    publishFeedback(userId, { bookId, event: 'rating', ratingValue: value });
    const response = toRatingCreateResponse(result.entity, result.isNew);

    return ApiResponse.success(res, response, result.isNew ? 'Rating created' : 'Rating updated');
  } catch (error) {
    logger.error('Create/update rating error:', error);
    next(error);
  }
};

/**
 * DELETE /books/:bookId/ratings - Delete rating
 */
export const deleteRating = async (req, res, next) => {
  try {
    const { bookId } = req.params;
    const userId = req.user.userId; // from JWT — no userId in URL path

    const deleted = await ratingService.deleteRating(userId, bookId);

    if (!deleted) {
      return ApiResponse.error(res, 'Rating not found', 404);
    }

    publishFeedback(userId, { bookId, event: 'rating', ratingValue: 0 });
    return ApiResponse.success(res, null, 'Rating deleted');
  } catch (error) {
    logger.error('Delete rating error:', error);
    next(error);
  }
};

/**
 * GET /books/:bookId/average-rating - Get average rating
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
