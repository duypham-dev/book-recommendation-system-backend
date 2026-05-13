/**
 * Admin Genre Controller
 * 
 * Best Practice Architecture:
 * - Controller handles HTTP request/response
 * - Service handles business logic, returns raw entities
 * - Mapper transforms entities to API response format
 */
import { ApiResponse, logger } from "#utils/index.js";
import { genreService } from "#services/genre.service.js";
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
export const createGenre = async (req, res, next) => {
  try {
    const { name, description } = req.body; // genreBodySchema validates name required

    const genre = await genreService.createGenre(name, description);
    const response = toGenreResponse(genre);

    logger.info(`Genre created: ${response.id} by admin ${req.user.userId}`);
    return ApiResponse.created(res, response, 'Genre created successfully');
  } catch (error) {
    logger.error('Create genre error:', error);
    next(error); // global handler maps P2002 → 409
  }
};

/**
 * PUT /admin/genres/update/:genreId - Update a genre
 */
export const updateGenre = async (req, res, next) => {
  try {
    const { genreId } = req.params;
    const { name, description } = req.body; // genreBodySchema validates

    const genre = await genreService.updateGenre(genreId, { name, description });
    const response = toGenreResponse(genre);

    logger.info(`Genre updated: ${genreId} by admin ${req.user.userId}`);
    return ApiResponse.success(res, response, 'Genre updated successfully');
  } catch (error) {
    logger.error('Update genre error:', error);
    next(error); // global handler maps P2025 → 404
  }
};

/**
 * DELETE /admin/genres/delete/:genreId - Delete a genre
 */
export const deleteGenre = async (req, res, next) => {
  try {
    const { genreId } = req.params;

    await genreService.deleteGenre(genreId);

    logger.info(`Genre deleted: ${genreId} by admin ${req.user.userId}`);
    return ApiResponse.success(res, null, 'Genre deleted successfully');
  } catch (error) {
    logger.error('Delete genre error:', error);
    next(error); // global handler maps P2025 → 404
  }
};
