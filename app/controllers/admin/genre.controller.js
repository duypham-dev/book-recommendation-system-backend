/**
 * Admin Genre Controller
 * 
 * Best Practice Architecture:
 * - Controller handles HTTP request/response
 * - Service handles business logic, returns raw entities
 * - Mapper transforms entities to API response format
 */
import { ApiResponse, logger } from "#utils/index.js";
import { genreService } from "#services/genreService.js";
import { toGenreResponse, toGenrePaginatedResponse } from "#mappers/genre.mapper.js";

/**
 * GET /admin/genres - Get genres with pagination (for admin management)
 */
export const getGenresWithPagination = async (req, res) => {
  try {
    const { page = 0, size = 50, keyword = '', sort = '' } = req.query;
    
    // 1. Call service to get raw data
    const result = await genreService.getGenresWithPagination(
      parseInt(page),
      parseInt(size),
      keyword,
      sort
    );
    
    // 2. Transform to response format via mapper
    const response = toGenrePaginatedResponse(result);
    
    return ApiResponse.success(res, response, 'Genres fetched successfully');
  } catch (error) {
    logger.error('Get genres error:', error);
    return ApiResponse.error(res, 'Failed to fetch genres', 500);
  }
};

/**
 * POST /admin/genres/create - Create a new genre
 */
export const createGenre = async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return ApiResponse.error(res, 'Genre name is required', 400);
    }
    
    // 1. Call service to create genre
    const genre = await genreService.createGenre(name, description);
    
    // 2. Transform to response format via mapper
    const response = toGenreResponse(genre);
    
    logger.info(`Genre created: ${response.id} by admin ${req.user.userId}`);
    
    return ApiResponse.created(res, response, 'Genre created successfully');
  } catch (error) {
    logger.error('Create genre error:', error);
    
    // Check for unique constraint violation
    if (error.code === 'P2002') {
      return ApiResponse.error(res, 'Genre name already exists', 409);
    }
    
    return ApiResponse.error(res, 'Failed to create genre', 500);
  }
};

/**
 * PUT /admin/genres/update/:genreId - Update a genre
 */
export const updateGenre = async (req, res) => {
  try {
    const { genreId } = req.params;
    const { name, description } = req.body;
    
    // 1. Call service to update genre
    const genre = await genreService.updateGenre(genreId, { name, description });
    
    // 2. Transform to response format via mapper
    const response = toGenreResponse(genre);
    
    logger.info(`Genre updated: ${genreId} by admin ${req.user.userId}`);
    
    return ApiResponse.success(res, response, 'Genre updated successfully');
  } catch (error) {
    logger.error('Update genre error:', error);
    
    if (error.code === 'P2025') {
      return ApiResponse.error(res, 'Genre not found', 404);
    }
    
    return ApiResponse.error(res, 'Failed to update genre', 500);
  }
};

/**
 * DELETE /admin/genres/delete/:genreId - Delete a genre
 */
export const deleteGenre = async (req, res) => {
  try {
    const { genreId } = req.params;
    
    await genreService.deleteGenre(genreId);
    
    logger.info(`Genre deleted: ${genreId} by admin ${req.user.userId}`);
    
    return ApiResponse.success(res, null, 'Genre deleted successfully');
  } catch (error) {
    logger.error('Delete genre error:', error);
    
    if (error.code === 'P2025') {
      return ApiResponse.error(res, 'Genre not found', 404);
    }
    
    return ApiResponse.error(res, 'Failed to delete genre', 500);
  }
};
