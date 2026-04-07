import { ApiResponse, logger } from "#utils/index.js";
import {genreService} from "#services/genreService.js";
import { toGenreListResponse, toGenreResponse, toGenrePaginatedResponse } from "#mappers/genre.mapper.js";
/**
 * GET /books/genres - Get all genres
 */
const getAllGenres = async (req, res) => {
    try {
        // 1. Call service to get raw genre entities
        const genres = await genreService.getAllGenres();

        logger.info(`Fetched ${genres.length} genres`);

        // 2. Transform to response format via mapper
        const genresResponse = toGenreListResponse(genres);
        
        return ApiResponse.success(res, genresResponse, 'Genres fetched successfully');
    } catch (err) {
        logger.error(`Error fetching genres: ${err.message}`);
        return ApiResponse.error(res, 'Failed to fetch genres', 500);
    }
};

/**
 * GET /books/genres/:genreId - Get genre by ID
 */
const getGenreById = async (req, res) => {
    const { genreId } = req.params;
    if (!genreId) {
        return ApiResponse.error(res, 'Genre ID is required', 400);
    }

    try {
        const genre = await genreService.getGenreById(genreId);

        if (!genre) {
            return ApiResponse.error(res, 'Genre not found', 404);
        }

        const genreResponse = toGenreResponse(genre);
        return ApiResponse.success(res, genreResponse, 'Genre fetched successfully');
    } catch (err) {
        logger.error(`Error fetching genre ${genreId}: ${err.message}`);
        return ApiResponse.error(res, 'Failed to fetch genre', 500);
    }
};

const getGenresLimit = async (req, res) => {
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


export { getAllGenres, getGenreById, getGenresLimit };