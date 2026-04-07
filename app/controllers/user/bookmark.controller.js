/**
 * BookMark Controller
 * Handles bookmark CRUD operations for users
 */
import { ApiResponse, logger } from "#utils/index.js";
import { bookmarkService } from "#services/bookmarkService.js";
import { toBookmarkListResponse, toBookmarkResponse } from "#mappers/bookmark.mapper.js";

// ============================================
// BOOKMARKS ENDPOINTS
// ============================================

/**
 * GET /users/:userId/books/:bookId/bookmarks - Get bookmarks for a book
 */
export const getBookmarks = async (req, res) => {
  try {
    const { userId, bookId } = req.params;
    
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
 * POST /users/:userId/books/:bookId/bookmarks - Create bookmark
 */
export const createBookmark = async (req, res) => {
  try {
    const { userId, bookId } = req.params;
    const { pageNumber, locationInBook, note } = req.body;
    
    // Verify user owns this action
    if (req.user.userId !== userId) {
      return ApiResponse.error(res, 'Unauthorized', 403);
    }
    
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
    const { userId, bookmarkId } = req.params;
    const { pageNumber, locationInBook, note } = req.body;
    
    // Verify user owns this action
    if (req.user.userId !== userId) {
      return ApiResponse.error(res, 'Unauthorized', 403);
    }
    
    // 1. Call service
    const bookmark = await bookmarkService.updateBookmark(bookmarkId, {
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
    const { userId, bookmarkId } = req.params;
    
    // Verify user owns this action
    if (req.user.userId !== userId) {
      return ApiResponse.error(res, 'Unauthorized', 403);
    }
    
    await bookmarkService.deleteBookmark(bookmarkId);
    
    return ApiResponse.success(res, null, 'Bookmark deleted');
  } catch (error) {
    logger.error('Delete bookmark error:', error);
    return ApiResponse.error(res, 'Failed to delete bookmark', 500);
  }
};
