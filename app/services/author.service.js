import { prisma } from '#lib/prisma.js';

/**
 * Get all authors
 */
export const getAllAuthors = async () => {
  const authors = await prisma.authors.findMany({
    orderBy: { author_name: 'asc' },
    select: {
      author_id: true,
      author_name: true,
      biography: true,
    },
  });

  return authors.map(author => ({
    id: author.author_id.toString(),
    name: author.author_name,
    biography: author.biography,
  }));
};

/**
 * Get author by ID
 */
export const getAuthorById = async (authorId) => {
  const author = await prisma.authors.findUnique({
    where: { author_id: BigInt(authorId) },
    include: {
      book_authors: {
        include: {
          books: {
            select: {
              book_id: true,
              title: true,
              cover_image_url: true,
            },
          },
        },
      },
    },
  });

  if (!author) return null;

  return {
    id: author.author_id.toString(),
    name: author.author_name,
    biography: author.biography,
    books: author.book_authors.map(ba => ({
      id: ba.books.book_id.toString(),
      title: ba.books.title,
      coverImageUrl: ba.books.cover_image_url,
    })),
  };
};

/**
 * Create a new author
 */
export const createAuthor = async (name, biography = null) => {
  const author = await prisma.authors.create({
    data: {
      author_name: name,
      biography: biography,
    },
  });

  return {
    id: author.author_id.toString(),
    name: author.author_name,
    biography: author.biography,
  };
};

/**
 * Update an author
 */
export const updateAuthor = async (authorId, data) => {
  const updateData = {};
  if (data.name !== undefined) updateData.author_name = data.name;
  if (data.biography !== undefined) updateData.biography = data.biography;

  const author = await prisma.authors.update({
    where: { author_id: BigInt(authorId) },
    data: updateData,
  });

  return {
    id: author.author_id.toString(),
    name: author.author_name,
    biography: author.biography,
  };
};

/**
 * Delete an author
 */
export const deleteAuthor = async (authorId) => {
  // First delete book_authors relationships
  await prisma.book_authors.deleteMany({
    where: { author_id: BigInt(authorId) },
  });

  await prisma.authors.delete({
    where: { author_id: BigInt(authorId) },
  });

  return true;
};

/**
 * Find or create author by name
 */
export const findOrCreateAuthor = async (name) => {
  let author = await prisma.authors.findFirst({
    where: { author_name: name },
  });

  if (!author) {
    author = await prisma.authors.create({
      data: { author_name: name },
    });
  }

  return {
    id: author.author_id.toString(),
    name: author.author_name,
  };
};

export const authorService = {
  getAllAuthors,
  getAuthorById,
  createAuthor,
  updateAuthor,
  deleteAuthor,
  findOrCreateAuthor,
};
