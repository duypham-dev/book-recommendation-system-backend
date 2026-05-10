import * as recommendationService from '#services/recommendation.service.js';
import { ApiResponse } from '#utils/response.js';
import { toBookListResponse } from "../../mappers/book.mapper.js";
export const getBookRecommendations = async (req, res, next) => {
  try {
    const userId = req.user.user_id; // From auth middleware
    const limit = parseInt(req.query.limit) || 10;
    
    const recommendations = await recommendationService.getRecommendations(userId, limit);
    
    ApiResponse.success(res, recommendations, 'Recommendations fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const getSimilarBooks = async (req, res, next) => {
  try {
    const bookId = parseInt(req.query.bookId) || parseInt(req.params.bookId);
    const limit = parseInt(req.query.limit) || 10;

    if (!bookId) {
      return res.status(400).json({ status: 'fail', message: 'bookId is required' });
    }

    const books = await recommendationService.getSimilarBooks(bookId, limit);
    ApiResponse.success(res, toBookListResponse(books), 'Similar books fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const getDiverseBooks = async (req, res, next) => {
  try {
    const bookId = parseInt(req.query.bookId) || parseInt(req.params.bookId);
    const limit = parseInt(req.query.limit) || 5;

    if (!bookId) {
      return res.status(400).json({ status: 'fail', message: 'bookId is required' });
    }

    const books = await recommendationService.getDiverseBooks(bookId, limit);
    ApiResponse.success(res, books, 'Diverse books fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const sendFeedback = async (req, res, next) => {
  try {
    const userId = req.user.user_id; // From auth middleware
    const { book_id, event, rating_value, progress } = req.body;

    if (!book_id || !event) {
      return res.status(400).json({ status: 'fail', message: 'book_id and event are required' });
    }

    const result = await recommendationService.sendFeedback(userId, { book_id, event, rating_value, progress });
    ApiResponse.success(res, result, 'Feedback recorded successfully');
  } catch (error) {
    next(error);
  }
};
