/**
 * BookMark Controller
 * Handles bookmark CRUD operations for users
 */
import { ApiResponse, logger } from "#utils/index.js";
import { bookmarkService } from "#services/bookmark.service.js";
import { toBookmarkListResponse, toBookmarkResponse } from "#mappers/bookmark.mapper.js";


// BOOKMARKS ENDPOINTS
/**
 * GET /books/:bookId/bookmarks - Get bookmarks for a book
 */
export const getBookmarks = async (req, res) => {
  try {
    const { userId } = req.user;
    const { bookId } = req.params;

    // 1. Call service to get raw entities
    const bookmarks = await bookmarkService.getBookmarks(userId, bookId);
    
    // 2. Transform via mapper
    const response = toBookmarkListResponse(bookmarks);
    
    return ApiResponse.success(res, response, 'Bookmarks fetched successfully');
  } catch (error) {
    logger.error('Get bookmarks error:', error);
    return ApiResponse.error(res, 'Failed to fetch bookmarks', 500);
  }
};

/**
 * POST /books/:bookId/bookmarks - Create bookmark
 */
export const createBookmark = async (req, res) => {
  try {
    const { bookId } = req.params;
    const { userId } = req.user;

    const { pageNumber, locationInBook, note } = req.body;
    
    // 1. Call service
    const bookmark = await bookmarkService.createBookmark(userId, bookId, {
      pageNumber,
      locationInBook,
      note,
    });
    
    // 2. Transform via mapper
    const response = toBookmarkResponse(bookmark);
    
    return ApiResponse.created(res, response, 'Bookmark created');
  } catch (error) {
    logger.error('Create bookmark error:', error);
    return ApiResponse.error(res, 'Failed to create bookmark', 500);
  }
};

/**
 * PUT /users/:userId/bookmarks/:bookmarkId - Update bookmark
 */
export const updateBookmark = async (req, res) => {
  try {
    const { bookmarkId } = req.params;
    const { userId } = req.user;

    const { pageNumber, locationInBook, note } = req.body;
    
    // 1. Call service
    const bookmark = await bookmarkService.updateBookmark(userId, bookmarkId, {
      pageNumber,
      locationInBook,
      note,
    });
    
    // 2. Transform via mapper
    const response = toBookmarkResponse(bookmark);
    
    return ApiResponse.success(res, response, 'Bookmark updated');
  } catch (error) {
    logger.error('Update bookmark error:', error);
    return ApiResponse.error(res, 'Failed to update bookmark', 500);
  }
};

/**
 * DELETE /users/:userId/bookmarks/:bookmarkId - Delete bookmark
 */
export const deleteBookmark = async (req, res) => {
  try {
    const { bookmarkId } = req.params;
    const { userId } = req.user;
    
    await bookmarkService.deleteBookmark(userId, bookmarkId);
    
    return ApiResponse.success(res, null, 'Bookmark deleted');
  } catch (error) {
    logger.error('Delete bookmark error:', error);
    return ApiResponse.error(res, 'Failed to delete bookmark', 500);
  }
};
