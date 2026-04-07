import { prisma } from '#lib/prisma.js';

/**
 * Bookmark Service
 * 
 * Best Practice: Service returns raw Prisma entities
 * Mapping to API response format is done in controller via mapper
 */

/**
 * Get bookmarks for a specific book
 * Returns raw Prisma entities
 */
export const getBookmarks = async (userId, bookId) => {
  return prisma.bookmarks.findMany({
    where: {
      user_id: BigInt(userId),
      book_id: BigInt(bookId),
    },
    orderBy: { created_at: 'desc' },
  });
};

/**
 * Create a new bookmark
 * Returns raw Prisma entity
 */
export const createBookmark = async (userId, bookId, data) => {
  return prisma.bookmarks.create({
    data: {
      user_id: BigInt(userId),
      book_id: BigInt(bookId),
      page_number: data.pageNumber || null,
      location_in_book: data.locationInBook || null,
      note: data.note || null,
    },
  });
};

/**
 * Update a bookmark
 * Returns raw Prisma entity
 */
export const updateBookmark = async (bookmarkId, data) => {
  const updateData = {};
  
  if (data.pageNumber !== undefined) updateData.page_number = data.pageNumber;
  if (data.locationInBook !== undefined) updateData.location_in_book = data.locationInBook;
  if (data.note !== undefined) updateData.note = data.note;

  return prisma.bookmarks.update({
    where: { bookmark_id: BigInt(bookmarkId) },
    data: updateData,
  });
};

/**
 * Delete a bookmark
 */
export const deleteBookmark = async (bookmarkId) => {
  await prisma.bookmarks.delete({
    where: { bookmark_id: BigInt(bookmarkId) },
  });
  return true;
};

/**
 * Get all bookmarks for a user
 * Returns raw Prisma entities + pagination metadata
 */
export const getAllUserBookmarks = async (userId, page = 0, size = 20) => {
  const skip = page * size;

  const [bookmarks, total] = await Promise.all([
    prisma.bookmarks.findMany({
      where: { user_id: BigInt(userId) },
      orderBy: { created_at: 'desc' },
      skip,
      take: size,
      include: {
        books: {
          select: {
            book_id: true,
            title: true,
            cover_image_url: true,
          },
        },
      },
    }),
    prisma.bookmarks.count({
      where: { user_id: BigInt(userId) },
    }),
  ]);

  return {
    data: bookmarks,
    pagination: {
      page,
      size,
      totalElements: total,
      totalPages: Math.ceil(total / size),
    },
  };
};

export const bookmarkService = {
  getBookmarks,
  createBookmark,
  updateBookmark,
  deleteBookmark,
  getAllUserBookmarks,
};
