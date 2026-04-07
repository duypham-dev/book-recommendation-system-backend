import { prisma } from '#lib/prisma.js';

/**
 * Get all genres (simple list)
 * Returns raw Prisma entities - mapping is done in controller via mapper
 */
const getAllGenres = async () => {
  return prisma.genres.findMany({ 
    orderBy: { genre_id: 'asc' }, 
  });
};

/**
 * Get genres with pagination, search, and sorting
 * Returns raw Prisma entities + pagination metadata
 */
const getGenresWithPagination = async (page = 0, size = 50, keyword = '', sort = '') => {
  const skip = page * size;
  
  // Build where clause
  const where = {};
  if (keyword) {
    where.OR = [
      { genre_name: { contains: keyword, mode: 'insensitive' } },
      { description: { contains: keyword, mode: 'insensitive' } },
    ];
  }
  
  // Build orderBy
  let orderBy = { genre_id: 'asc' };
  if (sort === 'name-asc') {
    orderBy = { genre_name: 'asc' };
  } else if (sort === 'name-desc') {
    orderBy = { genre_name: 'desc' };
  } else if (sort === 'newest') {
    orderBy = { genre_id: 'desc' };
  }

  const [genres, total] = await Promise.all([
    prisma.genres.findMany({
      where,
      orderBy,
      skip,
      take: size,
    }),
    prisma.genres.count({ where }),
  ]);

  return {
    data: genres,
    pagination: {
      page,
      size,
      totalElements: total,
      totalPages: Math.ceil(total / size),
    },
  };
};

/**
 * Get genre by ID
 * Returns raw Prisma entity or null
 */
const getGenreById = async (genreId) => {
  return prisma.genres.findUnique({
    where: { genre_id: BigInt(genreId) },
  });
};

/**
 * Create a new genre
 * Returns raw Prisma entity
 */
const createGenre = async (name, description = null) => {
  return prisma.genres.create({
    data: {
      genre_name: name,
      description: description,
    },
  });
};

/**
 * Update a genre
 * Returns raw Prisma entity
 */
const updateGenre = async (genreId, data) => {
  const updateData = {};
  if (data.name !== undefined) updateData.genre_name = data.name;
  if (data.description !== undefined) updateData.description = data.description;

  return prisma.genres.update({
    where: { genre_id: BigInt(genreId) },
    data: updateData,
  });
};

/**
 * Delete a genre
 */
const deleteGenre = async (genreId) => {
  // First delete book_genres relationships
  await prisma.book_genres.deleteMany({
    where: { genre_id: BigInt(genreId) },
  });

  await prisma.genres.delete({
    where: { genre_id: BigInt(genreId) },
  });

  return true;
};

export { 
  getAllGenres, 
  getGenresWithPagination, 
  getGenreById, 
  createGenre, 
  updateGenre, 
  deleteGenre 
};

export const genreService = {
  getAllGenres,
  getGenresWithPagination,
  getGenreById,
  createGenre,
  updateGenre,
  deleteGenre,
};