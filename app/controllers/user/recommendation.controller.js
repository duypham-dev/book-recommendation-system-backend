/**
 * User Recommendation Controller
 *
 * Pattern: throw a typed AppError subclass inside the try block,
 * then pass ALL errors (both expected and unexpected) to next(error).
 * The global errorHandler in app/middlewares/errorHandler.js takes care
 * of formatting and sending the response — controllers stay thin.
 */

import * as recommendationService from '#services/recommendation.service.js';
import { ApiResponse } from '#utils/response.js';
import { BadRequestError, NotFoundError } from '#utils/error.js';
import { toBookListResponse } from '../../mappers/book.mapper.js';

/**
 * GET /recommendations
 * Returns personalised book recommendations for the authenticated user.
 */
export const getBookRecommendations = async (req, res, next) => {
  try {
    const { userId } = req.user; // injected by auth middleware
    const limit = parseInt(req.query.limit) || 10;

    const recommendations = await recommendationService.getRecommendations(userId, limit);
    
    // If the service returns nothing we treat it as a normal (empty) success,
    // but if a user record is missing the service should throw — which we
    // would catch here and re-throw as NotFoundError:
    //   throw new NotFoundError('User profile not found');

    ApiResponse.success(
      res,
      toBookListResponse(recommendations),
      'Recommendations fetched successfully'
    );
  } catch (error) {
    // Propagate to the global error handler — no manual res.status() calls needed.
    next(error);
  }
};

/**
 * GET /books/:bookId/similar
 * Returns books that are content-similar to the given book.
 *
 * Example of how to use typed errors:
 *   - Missing required param   → BadRequestError
 *   - Book not in database     → NotFoundError (thrown by service or manually)
 *   - User lacks permission    → ForbiddenError
 */
export const getSimilarBooks = async (req, res, next) => {
  try {
    const bookId = parseInt(req.query.bookId) || parseInt(req.params.bookId);
    const limit = parseInt(req.query.limit) || 10;

    // Throw a typed error instead of writing res.status(400).json(…) inline.
    // The global handler will format this consistently for every endpoint.
    if (!bookId) {
      throw new BadRequestError('bookId is required.');
    }

    const books = await recommendationService.getSimilarBooks(bookId, limit);

    // If the book itself doesn't exist, throw NotFoundError so the handler
    // returns 404 with the standard shape — no ad-hoc ApiResponse.error() call.
    if (!books) {
      throw new NotFoundError(`Book with id ${bookId} not found.`);
    }

    ApiResponse.success(res, toBookListResponse(books), 'Similar books fetched successfully');
  } catch (error) {
    next(error);
  }
};
