/**
 * Author Controller
 */
import { ApiResponse, logger } from "#utils/index.js";
import { authorService } from "#services/authorService.js";

/**
 * GET /authors - Get all authors
 */
export const getAllAuthors = async (req, res) => {
  try {
    const authors = await authorService.getAllAuthors();
    
    return ApiResponse.success(res, authors, 'Authors fetched successfully');
  } catch (error) {
    logger.error('Get authors error:', error);
    return ApiResponse.error(res, 'Failed to fetch authors', 500);
  }
};

/**
 * GET /authors/:authorId - Get author by ID
 */
export const getAuthorById = async (req, res) => {
  try {
    const { authorId } = req.params;
    
    const author = await authorService.getAuthorById(authorId);
    
    if (!author) {
      return ApiResponse.error(res, 'Author not found', 404);
    }
    
    return ApiResponse.success(res, author, 'Author fetched successfully');
  } catch (error) {
    logger.error('Get author error:', error);
    return ApiResponse.error(res, 'Failed to fetch author', 500);
  }
};

/**
 * POST /admin/authors/create - Create author (Admin)
 */
export const createAuthor = async (req, res) => {
  try {
    const { name, biography } = req.body;
    
    if (!name) {
      return ApiResponse.error(res, 'Author name is required', 400);
    }
    
    const author = await authorService.createAuthor(name, biography);
    
    logger.info(`Author created: ${author.id} by admin ${req.user.userId}`);
    
    return ApiResponse.created(res, author, 'Author created successfully');
  } catch (error) {
    logger.error('Create author error:', error);
    return ApiResponse.error(res, 'Failed to create author', 500);
  }
};

/**
 * PUT /admin/authors/update/:authorId - Update author (Admin)
 */
export const updateAuthor = async (req, res) => {
  try {
    const { authorId } = req.params;
    const { name, biography } = req.body;
    
    const author = await authorService.updateAuthor(authorId, { name, biography });
    
    logger.info(`Author updated: ${authorId} by admin ${req.user.userId}`);
    
    return ApiResponse.success(res, author, 'Author updated successfully');
  } catch (error) {
    logger.error('Update author error:', error);
    
    if (error.code === 'P2025') {
      return ApiResponse.error(res, 'Author not found', 404);
    }
    
    return ApiResponse.error(res, 'Failed to update author', 500);
  }
};

/**
 * DELETE /admin/authors/delete/:authorId - Delete author (Admin)
 */
export const deleteAuthor = async (req, res) => {
  try {
    const { authorId } = req.params;
    
    await authorService.deleteAuthor(authorId);
    
    logger.info(`Author deleted: ${authorId} by admin ${req.user.userId}`);
    
    return ApiResponse.success(res, null, 'Author deleted successfully');
  } catch (error) {
    logger.error('Delete author error:', error);
    
    if (error.code === 'P2025') {
      return ApiResponse.error(res, 'Author not found', 404);
    }
    
    return ApiResponse.error(res, 'Failed to delete author', 500);
  }
};
