import { prisma } from '#lib/prisma.js';

/**
 * History Service
 * 
 * Best Practice: Service returns raw Prisma entities
 * Mapping to API response format is done in controller via mapper
 */

/**
 * Get user's reading history with pagination
 * Returns raw Prisma entities + pagination metadata
 */
export const getUserHistory = async (userId, page = 0, size = 10) => {
  const skip = page * size;

  const [history, total] = await Promise.all([
    prisma.reading_history.findMany({
      where: { user_id: BigInt(userId) },
      orderBy: { last_read_at: 'desc' },
      skip,
      take: size,
      include: {
        books: {
          select: {
            book_id: true,
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
    prisma.reading_history.count({
      where: { user_id: BigInt(userId) },
    }),
  ]);

  return {
    data: history,
    pagination: {
      page,
      size,
      totalElements: total,
      totalPages: Math.ceil(total / size),
    },
  };
};

/**
 * Record or update reading history
 * Returns raw Prisma entity with isNew flag
 */
export const recordHistory = async (userId, bookId, progress = null) => {
  // Check if history entry exists
  const existing = await prisma.reading_history.findFirst({
    where: {
      user_id: BigInt(userId),
      book_id: BigInt(bookId),
    },
  });

  if (existing) {
    // Update existing entry
    const updated = await prisma.reading_history.update({
      where: { history_id: existing.history_id },
      data: {
        last_read_at: new Date(),
        progress: progress !== null ? progress : existing.progress,
      },
    });

    return { entity: updated, isNew: false };
  }

  // Create new entry
  const created = await prisma.reading_history.create({
    data: {
      user_id: BigInt(userId),
      book_id: BigInt(bookId),
      progress: progress || 0,
    },
  });

  return { entity: created, isNew: true };
};

/**
 * Get reading progress for a specific book
 */
export const getBookProgress = async (userId, bookId) => {
  const history = await prisma.reading_history.findFirst({
    where: {
      user_id: BigInt(userId),
      book_id: BigInt(bookId),
    },
  });

  if (!history) return null;

  return {
    id: history.history_id.toString(),
    bookId: history.book_id.toString(),
    lastReadAt: history.last_read_at,
    progress: history.progress,
  };
};

export const historyService = {
  getUserHistory,
  recordHistory,
  getBookProgress,
};
