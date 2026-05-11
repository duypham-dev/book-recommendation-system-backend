import { prisma } from '#lib/prisma.js';
import { AppError } from '#utils/error.js';

// Get suggestion books from Python Recommendation Service
export const getRecommendations = async (userId, limit = 10) => {
  try {
    const recommendationUrl = process.env.RECOMMENDATION_SERVICE_URL || 'http://localhost:8003';
    
    // 1. Fetch recommendations from FastAPI service
    const response = await fetch(`${recommendationUrl}/api/v1/recommendations?user_id=${userId}&limit=${limit}`);
    
    if (!response.ok) {
      throw new AppError('Failed to fetch recommendations from Suggestion Engine', response.status);
    }
    
    const data = await response.json();
    const recommendedBookIds = (data.items || data.results || []).map(item => item.book_id);
    
    // 2. If no books returned, return empty array
    if (!recommendedBookIds || recommendedBookIds.length === 0) {
      return [];
    }

    // 3. Fetch book details from database
    const books = await prisma.books.findMany({
      where: {
        book_id: { in: recommendedBookIds },
        is_deleted: false,
      },
      include: {
        book_authors: {
          include: {
            authors: true,
          },
        },
      },
    });

    // 4. Sort books to match the order from recommendation engine
    const sortedBooks = recommendedBookIds
      .map(id => books.find(book => book.book_id === id))
      .filter(book => book !== undefined);

    return sortedBooks;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Recommendation error: ${error.message}`, 500);
  }
};

export const getSimilarBooks = async (bookId, limit = 10) => {
  try {
    const recommendationUrl = process.env.RECOMMENDATION_SERVICE_URL || 'http://localhost:8003';
    const response = await fetch(`${recommendationUrl}/api/v1/similar?book_id=${bookId}&limit=${limit}`);
    
    if (!response.ok) {
      throw new AppError('Failed to fetch similar books from Suggestion Engine', response.status);
    }
    
    const data = await response.json();

    const similarBookIds = (data.items || data.results || []).map(item => item.book_id);
    
    if (!similarBookIds.length) return [];

    const books = await prisma.books.findMany({
      where: {
        book_id: { in: similarBookIds },
        is_deleted: false,
      },
      include: { book_authors: { include: { authors: true } } },
    });

    return books;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Similar books error: ${error.message}`, 500);
  }
};

export const getDiverseBooks = async (bookId, limit = 5) => {
  try {
    const recommendationUrl = process.env.RECOMMENDATION_SERVICE_URL || 'http://localhost:8003';
    const response = await fetch(`${recommendationUrl}/api/v1/diversity?book_id=${bookId}&limit=${limit}`);
    
    if (!response.ok) {
      throw new AppError('Failed to fetch diverse books from Suggestion Engine', response.status);
    }
    
    const data = await response.json();
    const diverseBookIds = (data.items || data.results || []).map(item => item.book_id);
    
    if (!diverseBookIds.length) return [];

    const books = await prisma.books.findMany({
      where: {
        book_id: { in: diverseBookIds },
        is_deleted: false,
      },
      include: { book_authors: { include: { authors: true } } },
    });

    return diverseBookIds
      .map(id => books.find(book => book.book_id === id))
      .filter(book => book !== undefined);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Diverse books error: ${error.message}`, 500);
  }
};

