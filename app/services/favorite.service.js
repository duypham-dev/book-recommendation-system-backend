import { prisma } from '#lib/prisma.js';

/**
 * Favorite Service

/**
 * Get user's favorite books with pagination
 * Returns raw Prisma entities + pagination metadata
 */
export const getUserFavorites = async (userId, page = 0, size = 12) => {
  const skip = page * size;

  const [favorites, total] = await Promise.all([
    prisma.favorites.findMany({
      where: { user_id: BigInt(userId) },
      orderBy: { added_at: 'desc' },
      skip,
      take: size,
      select: {
        favorite_id: true,
        book_id: true,
        books: {
          select: {
            title: true,
            cover_image_url: true,
            book_authors: {
              select: {
                authors: {
                  select: {
                    author_id: true,
                    author_name: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.favorites.count({
      where: { user_id: BigInt(userId) },
    }),
  ]);

  return {
    data: favorites,
    pagination: {
      page,
      size,
      totalElements: total,
      totalPages: Math.ceil(total / size),
    },
  };
};

/**
 * Add book to favorites
 * Returns raw Prisma entity with alreadyExists flag
 */
export const addFavorite = async (userId, bookId) => {
  // Check if already favorited
  const existing = await prisma.favorites.findFirst({
    where: {
      user_id: BigInt(userId),
      book_id: BigInt(bookId),
    },
  });

  if (existing) {
    return { entity: existing, alreadyExists: true };
  }

  const favorite = await prisma.favorites.create({
    data: {
      user_id: BigInt(userId),
      book_id: BigInt(bookId),
    },
  });

  return { entity: favorite, alreadyExists: false };
};

/**
 * Remove book from favorites
 */
export const removeFavorite = async (userId, bookId) => {
  const deleted = await prisma.favorites.deleteMany({
    where: {
      user_id: BigInt(userId),
      book_id: BigInt(bookId),
    },
  });

  return deleted.count > 0;
};

/**
 * Check if book is in user's favorites
 */
export const isFavorite = async (userId, bookId) => {
  const favorite = await prisma.favorites.findFirst({
    where: {
      user_id: BigInt(userId),
      book_id: BigInt(bookId),
    },
  });

  return !!favorite;
};

export const favoriteService = {
  getUserFavorites,
  addFavorite,
  removeFavorite,
  isFavorite,
};
