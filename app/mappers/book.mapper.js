import "dotenv/config";
/**
 * Extract and map authors from book_authors relation
 */
const mapAuthors = (bookAuthors) => {
  if (!Array.isArray(bookAuthors)) return [];
  
  return bookAuthors
    .filter(ba => ba?.authors?.author_id && ba?.authors?.author_name)
    .map(ba => ({
      authorId: ba.authors.author_id,
      authorName: ba.authors.author_name,
    }));
};

// /**
//  * Extract and map genres from book_genres relation
//  */
const mapGenres = (bookGenres) => {
  if (!Array.isArray(bookGenres)) return [];
    return bookGenres
    .filter(bg => bg?.genres?.genre_id && bg?.genres?.genre_name)
    .map(bg => ({
      genreId: bg.genres.genre_id,
      genreName: bg.genres.genre_name,
    }));
};

/**
 * Map base book fields (used by both list and detail)
 */
const mapBaseBookFields = (book) => ({
  bookId: book.book_id,
  title: book.title,
  coverImageUrl: book.cover_image_url,
  publicationYear: book.publication_year,
  authors: mapAuthors(book.book_authors),
  isFav: book.isFav ?? false,
  description: book.description,
});

/**
 * Transform single book to list response format
 */
const toBookListItem = (book) => {
  if (!book) return null;
  return mapBaseBookFields(book);
};

/**
 * Transform single book to detail response format.
 * Ratings are decoupled — fetched via a separate paginated endpoint.
 * Only aggregated stats (averageRating, totalReviews) are included here.
 */
const toBookDetailItem = (book) => {
  if (!book) return null;

  return {
    ...mapBaseBookFields(book),
    description: book.description,
    publisher: book.publisher,
    genres: mapGenres(book.book_genres),
    formats: book.book_formats ? book.book_formats.map(format => ({
      formatId: format.format_id?.toString() || null,
      typeName: format.book_types?.type_name || null,
    })) : [],
    isFav: book.isFav ?? false,
    averageRating: book.averageRating != null ? Math.round(book.averageRating * 10) / 10 : 0,
    totalReviews: book.totalRatings ?? 0,
  };
};

const toBookSearchItem = (book) => {
  if (!book) return null;
  return {
    bookId: book.book_id,
    title: book.title,
    coverImageUrl: book.cover_image_url,
    authors: mapAuthors(book.book_authors),
  };
}

/** Transform single book to preview response format
 */
const toBookPreviewItem = (book) => {
  if (!book) return null;
  
  return {
    bookId: book.book_id,
    description: book.description,
    publicationYear: book.publication_year,
    coverImageUrl: book.cover_image_url,
    genres: mapGenres(book.book_genres),
    authors: mapAuthors(book.book_authors),
  };
};

/** Transform array of books to preview response format
 */
export const toBookPreviewResponse = (books) => {
  if (!books) return null;
  if (!Array.isArray(books)) return toBookPreviewItem(books);

  return books.map(toBookPreviewItem).filter(Boolean);
};


/**
 * Transform array of books to list response format
 */
export const toBookListResponse = (books) => {
  if (!books) return null;
  if (!Array.isArray(books)) return toBookListItem(books);
  
  return books.map(toBookListItem).filter(Boolean);
};

/**
 * Transform array of books to detail response format
 */
export const toBookDetailResponse = (books) => {
  if (!books) return null;
  if (!Array.isArray(books)) return toBookDetailItem(books);

  return books.map(toBookDetailItem).filter(Boolean);
};

export const toBookSearchResponse =  (books) => {
  if (!books) return null;
  if (!Array.isArray(books)) return toBookSearchItem(books);

  return books.map(toBookSearchItem).filter(Boolean);
}; 

// Export helper functions for use by other mappers
export { mapAuthors, mapGenres };