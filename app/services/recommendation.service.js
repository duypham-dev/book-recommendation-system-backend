import { prisma } from '#lib/prisma.js';
import { NotFoundError } from '#utils/error.js';
import { redisClient } from '#config/redis.js';
import { logger } from '#utils/logger.js';

const CACHE_TTL = 86400; // 24 hours in seconds

/**
 * Helper function to fetch data from Recommendation Service (RS) with Redis caching.
 * Caches the raw array of items from RS (which contains book_id and scores).
 * @param {string} cacheKey - The unique key for Redis cache
 * @param {string} url - The URL to fetch data from RS
 * @returns {Promise<Array>} The items array from RS response
 */
const fetchFromRSWithCache = async (cacheKey, url) => {
  const redis = redisClient.getClient();

  try {
    // 1. Check cache first
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      logger.debug(`[Cache Hit] RS Data: ${cacheKey}`);
      return JSON.parse(cachedData);
    }
  } catch (err) {
    logger.warn(`[Redis Error] Failed to get cache for ${cacheKey}: ${err.message}`);
  }

  // 2. Cache miss, fetch from RS
  logger.debug(`[Cache Miss] Fetching from RS: ${url}`);
  const response = await fetch(url).catch(() => {
    throw new NotFoundError('Failed to fetch data from Suggestion Engine');
  });
  
  if (!response.ok) {
    throw new NotFoundError('Failed to fetch data from Suggestion Engine');
  }

  const data = await response.json();
  const items = data.items || data.results || [];

  try {
    // 3. Save to cache
    if (items.length > 0) {
      await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(items));
      logger.debug(`[Cache Set] Cached RS Data: ${cacheKey}`);
    }
  } catch (err) {
    logger.warn(`[Redis Error] Failed to set cache for ${cacheKey}: ${err.message}`);
  }
  return items;
};

// Get suggestion books from Python Recommendation Service
export const getRecommendations = async (userId, limit = 10) => {
  const recommendationUrl = process.env.RECOMMENDATION_SERVICE_URL || 'http://localhost:8003';
  
  // 1. Fetch recommendations from FastAPI service (with caching)
  const parsedUserId = userId || 0; // Handle undefined/null userId
  const cacheKey = `recommendations:${parsedUserId}:${limit}`;
  const url = `${recommendationUrl}/api/v1/recommendations?user_id=${parsedUserId}&limit=${limit}`;
  
  const rsItems = await fetchFromRSWithCache(cacheKey, url);
  const recommendedBookIds = rsItems.map(item => BigInt(item.book_id));
  
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

  const favoritedBookIds = new Set();
  if (userId) {
    const favorites = await prisma.favorites.findMany({
      where: {
        user_id: BigInt(userId),
        book_id: { in: recommendedBookIds }
      },
      select: { book_id: true }
    });
    favorites.forEach(f => favoritedBookIds.add(f.book_id.toString()));
  }

  // 4. Sort books to match the order from recommendation engine
  const sortedBooks = recommendedBookIds
    .map(id => {
       const book = books.find(book => book.book_id === id);
       if (book) {
          book.isFav = favoritedBookIds.has(book.book_id.toString());
          return book;
       }
       return undefined;
    })
    .filter(book => book !== undefined);

  return sortedBooks;
};

export const getSimilarBooks = async (bookId, limit = 10) => {
  const recommendationUrl = process.env.RECOMMENDATION_SERVICE_URL || 'http://localhost:8003';
  
  // 1. Fetch similar books from FastAPI service (with caching)
  const cacheKey = `similar_books:${bookId}:${limit}`;
  const url = `${recommendationUrl}/api/v1/similar?book_id=${bookId}&limit=${limit}`;
  
  const rsItems = await fetchFromRSWithCache(cacheKey, url);
  const similarBookIds = rsItems.map(item => BigInt(item.book_id));
  
  if (!similarBookIds.length) return [];

  // 2. Fetch book details from database
  const books = await prisma.books.findMany({
    where: {
      book_id: { in: similarBookIds },
      is_deleted: false,
    },
    include: { book_authors: { include: { authors: true } } },
  });

  // 3. Sort books to match the order from recommendation engine
  const sortedBooks = similarBookIds
    .map(id => books.find(book => book.book_id === id))
    .filter(book => book !== undefined);

  return sortedBooks;
};
