/**
 * Admin Dashboard Controller
 */
import { ApiResponse, logger } from "#utils/index.js";
import { dashboardService } from "#services/dashboard.service.js";

/**
 * GET /admin/dashboard - Get dashboard statistics
 */
export const  getTopRatedBooks = async (req, res) => {
  try {
    const {
      page = 0,
      size = 5
    } = req.query;
    console.log('querry params:', req.query);
    const topRatedBooks = await dashboardService.getTopRatedBooks(parseInt(page), parseInt(size));
    return ApiResponse.success(res, topRatedBooks, 'Top rated books fetched successfully');
  } catch (error) {
    logger.error('Get top rated books error:', error);
    return ApiResponse.error(res, 'Failed to fetch top rated books', 500);
  }
};

export const getTopFavoritedBooks = async (req, res) => {
  try {
    const {
      page = 0,
      size = 5
    } = req.query;
    console.log('querry params:', req.query);
    const topFavoritedBooks = await dashboardService.getTopFavoritedBooks(parseInt(page), parseInt(size));
    return ApiResponse.success(res, topFavoritedBooks, 'Top favorited books fetched successfully');
  } catch (error) {
    logger.error('Get top favorited books error:', error);
    return ApiResponse.error(res, 'Failed to fetch top favorited books', 500);
  }
}


export const getStats = async (req, res) => {
  try{
    const dashboardStats = await dashboardService.getDashboardStats();
    return ApiResponse.success(res, dashboardStats, 'Dashboard stats fetched successfully');
  } catch (error) {
    logger.error('Get dashboard stats error:', error);
    return ApiResponse.error(res, 'Failed to fetch dashboard stats', 500);
  }
}

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
