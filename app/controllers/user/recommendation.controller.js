import * as recommendationService from '#services/recommendation.service.js';
import { ApiResponse } from '#utils/response.js';
import { toBookListResponse } from "../../mappers/book.mapper.js";

export const getBookRecommendations = async (req, res, next) => {
  try {
    const { userId } = req.user; // From auth middleware
    console.log("Userid: ", userId)
    const limit = parseInt(req.query.limit) || 10;
    
    const recommendations = await recommendationService.getRecommendations(userId, limit);
    console.log("RECOMMENDATION: ", recommendations);
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
