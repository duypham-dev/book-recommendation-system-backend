import { ApiResponse, logger } from "#utils/index.js";
import { historyService } from "#services/history.service.js";

// Import mappers
import { toHistoryPaginatedResponse, toHistoryActionResponse } from "#mappers/history.mapper.js";


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