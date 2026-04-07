import { ApiResponse, logger } from "#utils/index.js";
import { userService } from "#services/user.service.js";

// Import mappers
import { toUserPaginatedResponse } from "#mappers/user.mapper.js";

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