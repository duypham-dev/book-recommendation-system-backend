import { prisma } from '#lib/prisma.js';

/**
 * Rating Service
 * 
 * Best Practice: Service returns raw Prisma entities
 * Mapping to API response format is done in controller via mapper
 */

/**
 * Get ratings for a book
 * If userId is '0' or null, return all ratings for the book
 * Otherwise, return only the user's rating
 * Returns raw Prisma entities with user relation
 */
export const getBookRatings = async (userId, bookId) => {
  const where = { book_id: BigInt(bookId) };
  
  // If userId is provided and not '0', filter by user
  if (userId && userId !== '0') {
    where.user_id = BigInt(userId);
  }

  return prisma.ratings.findMany({
    where,
    orderBy: { created_at: 'desc' },
    include: {
      users: {
        select: {
          user_id: true,
          username: true,
          full_name: true,
          avatar_url: true,
        },
      },
    },
  });
};

/**
 * Create or update a rating
 * Returns raw Prisma entity with isNew flag
 */
export const createOrUpdateRating = async (userId, bookId, value, comment = null) => {
  // Check if rating exists
  const existing = await prisma.ratings.findFirst({
    where: {
      user_id: BigInt(userId),
      book_id: BigInt(bookId),
    },
  });

  if (existing) {
    // Update existing rating
    const updated = await prisma.ratings.update({
      where: { rating_id: existing.rating_id },
      data: {
        rating_value: value,
        comment: comment,
        created_at: new Date(), // Update timestamp
      },
    });

    return { entity: updated, isNew: false };
  }

  // Create new rating
  const created = await prisma.ratings.create({
    data: {
      user_id: BigInt(userId),
      book_id: BigInt(bookId),
      rating_value: value,
      comment: comment,
    },
  });

  return { entity: created, isNew: true };
};

/**
 * Delete a rating
 */
export const deleteRating = async (userId, bookId) => {
  const deleted = await prisma.ratings.deleteMany({
    where: {
      user_id: BigInt(userId),
      book_id: BigInt(bookId),
    },
  });

  return deleted.count > 0;
};

/**
 * Get average rating for a book
 * Returns raw Prisma aggregation result
 */
export const getAverageRating = async (bookId) => {
  return prisma.ratings.aggregate({
    where: { book_id: BigInt(bookId) },
    _avg: { rating_value: true },
    _count: { rating_id: true },
  });
};

/**
 * Get user's rating for a book
 * Returns raw Prisma entity or null
 */
export const getUserRating = async (userId, bookId) => {
  return prisma.ratings.findFirst({
    where: {
      user_id: BigInt(userId),
      book_id: BigInt(bookId),
    },
  });
};

/**
 * Get paginated ratings for a book.
 * Returns raw Prisma entities + pagination metadata.
 */
export const getBookRatingsPaginated = async (bookId, page = 0, size = 5) => {
  const where = { book_id: BigInt(bookId) };
  const skip = page * size;

  const [ratings, total] = await Promise.all([
    prisma.ratings.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: size,
      include: {
        users: {
          select: {
            user_id: true,
            username: true,
            full_name: true,
            avatar_url: true,
          },
        },
      },
    }),
    prisma.ratings.count({ where }),
  ]);

  return {
    ratings,
    total,
    hasMore: skip + ratings.length < total,
  };
};

export const ratingService = {
  getBookRatings,
  createOrUpdateRating,
  deleteRating,
  getAverageRating,
  getUserRating,
  getBookRatingsPaginated,
};
