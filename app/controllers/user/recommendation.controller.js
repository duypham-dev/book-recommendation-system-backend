/**
 * User Recommendation Controller
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

    ApiResponse.success(
      res,
      toBookListResponse(recommendations),
      'Recommendations fetched successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /books/:bookId/similar
 * Returns books that are content-similar to the given book.
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
