/**
 * Admin Dashboard Controller
 */
import { ApiResponse, logger } from "#utils/index.js";
import { dashboardService } from "#services/dashboardService.js";

/**
 * GET /admin/dashboard - Get dashboard statistics
 */
export const getDashboard = async (req, res) => {
  try {
    const {
      topRatedPage = 0,
      topRatedSize = 5,
      topFavoritedPage = 0,
      topFavoritedSize = 5
    } = req.query;

    const dashboard = await dashboardService.getDashboardStats(
      parseInt(topRatedPage),
      parseInt(topRatedSize),
      parseInt(topFavoritedPage),
      parseInt(topFavoritedSize)
    );

    return ApiResponse.success(res, dashboard, 'Dashboard fetched successfully');
  } catch (error) {
    logger.error('Get dashboard error:', error);
    return ApiResponse.error(res, 'Failed to fetch dashboard', 500);
  }
};

export const getNewUsers = async (req, res) => {
  try {
    const { time } = req.query; // e.g., '7d' for last 7 days
    logger.info('Get new users data for time:', time);
    if (!time) {
      return ApiResponse.error(res, 'Time parameter is required', 400);
    }

    const days = parseInt(time.toString().replace(/\D/g, '')) || 7;
    
    const data = await dashboardService.getNewUsersByTime(days);
    return ApiResponse.success(res, data, 'New users data fetched successfully');
  } catch (error) {
    logger.error('Get new users data error:', error);
    return ApiResponse.error(res, 'Failed to fetch new users data', 500);
  }
}
