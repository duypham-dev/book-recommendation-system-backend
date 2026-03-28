import { ApiResponse, logger } from "#utils/index.js";
import { toBookListResponse, toBookDetailResponse, toBookPreviewResponse, toBookSearchResponse } from "../../mappers/book.mapper.js";
import { toRatingListResponse } from "../../mappers/rating.mapper.js";
import {
    getBooksByGenre as getBooksByGenreService,
    getSameGenreBooks as getSameGenreBooksService,
    getMostReadBooks as getMostReadBooksService,
    getAllBooks as getAllBooksService,
    getBookById as getBookByIdService,
    getBookPreview as getBookPreviewService,
    getBookByKeyword as getBookByKeywordService,
    getBookReadUrl as getBookReadUrlService,
    getBookDownloadUrl as getBookDownloadUrlService,
} from "#services/bookService.js";
import { getBookRatingsPaginated as getBookRatingsPaginatedService } from "#services/ratingService.js";


// Controller to get all books with pagination
const getAllBooks = async (req, res) => {
    // Extract pagination parameters
    const { cursor } = req.query;

    const cursorId = cursor ? parseInt(cursor, 10) : undefined;
    console.log('query params:', req.query);
    try {
        const books = await getAllBooksService(cursorId);

        logger.info(`Fetched ${books.data.length} books (cursor ${cursorId})`);

        const booksResponse = toBookListResponse(books.data);
        const responsePayload = {
            content: booksResponse,
            nextCursor: books.nextCursor,
        };
        return ApiResponse.success(res, responsePayload, 'Books fetched successfully');
    } catch (err) {
        logger.error(`Error fetching books: ${err.message}`);
        return ApiResponse.error(res, 'Failed to fetch books', 500);
    }
}

// Controller to get book details by ID
const getBookById = async (req, res) => {

    // Extract bookId from request parameters
    const { bookId } = req.params;
    const userId = req.query.userId; // Optional userId for personalized details

    // Validate bookId
    if (!bookId) { return ApiResponse.error(res, 'Book ID is required', 400); }

    try {
        const book = await getBookByIdService(bookId, userId);
        
        if (!book) {
            return ApiResponse.error(res, 'Book not found', 404);
        }

        const bookResponse = toBookDetailResponse(book);
        return ApiResponse.success(res, bookResponse, 'Book fetched successfully');
    } catch (err) {
        logger.error(`Error fetching book for book ID ${bookId}: ${err.message}`);
        return ApiResponse.error(res, 'Failed to fetch book', 500);
    }
}

// Controller to get books by genre
const getBooksByGenre = async (req, res) => {
    const { genreId } = req.params;
    const { page = 0, size = 10, sort = 'newest' } = req.query;

    // Validate genreId
    if (!genreId) { return ApiResponse.error(res, 'Genre ID is required', 400); }

    const pageNum = parseInt(page);
    const sizeNum = parseInt(size);

    if (Number.isNaN(pageNum) || pageNum < 0) {
        return ApiResponse.error(res, 'Invalid page parameter', 400);
    }
    if (Number.isNaN(sizeNum) || sizeNum < 1 || sizeNum > 100) {
        return ApiResponse.error(res, 'Invalid size parameter (1-100)', 400);
    }

    const allowedSorts = ['newest', 'popular', 'title-asc', 'title-desc'];
    const validSort = allowedSorts.includes(sort) ? sort : 'newest';

    try {
        const result = await getBooksByGenreService(genreId, pageNum, sizeNum, validSort);
        const bookResponse = toBookListResponse(result.data);
        console.log(`Fetched ${result.data.length} books for genre ID ${genreId} (page ${pageNum}, size ${sizeNum}, sort ${validSort})`);
        return ApiResponse.success(res, {
            content: bookResponse,
            ...result.pagination,
        }, 'Books fetched successfully');
    } catch (err) {
        logger.error(`Error fetching books for genre ID ${genreId}: ${err.message}`);
        return ApiResponse.error(res, 'Failed to fetch books', 500);
    }
}


// Controller to get most read books
const getMostReadBooks = async (req, res) => {
    // Extract pagination parameters
    const { limit = 10, offset = 0 } = req.query;

    try {
        const books = await getMostReadBooksService(parseInt(offset), parseInt(limit));

        if(books.length === 0) {
            logger.info('No reading history found');
        } else {
            logger.info(`Fetched ${books.length} most read books`);
        }

        const booksResponse = toBookListResponse(books);
        return ApiResponse.success(res, booksResponse, 'Most read books fetched successfully');
    } catch (err) {
        logger.error(`Error fetching most read books: ${err.message}`);
        return ApiResponse.error(res, 'Failed to fetch most read books', 500);
    }
}


const getBookPreview = async (req, res) => {
    const { bookId } = req.params;

    if (!bookId) { return ApiResponse.error(res, 'Book ID is required', 400); }

    try {
        const book = await getBookPreviewService(bookId);
        
        if (!book) {
            return ApiResponse.error(res, 'Book not found', 404);
        }

        const bookResponse = toBookPreviewResponse(book);
        return ApiResponse.success(res, bookResponse, 'Book preview fetched successfully');
    } catch (err) {
        logger.error(`Error fetching book preview for book ID ${bookId}: ${err.message}`);
        return ApiResponse.error(res, 'Failed to fetch book preview', 500);
    }
}

const getBookByKeyword = async (req, res) => {
    const {keyword , page = 0, size = 10} = req.query;

    if (!keyword || Number.isNaN(parseInt(page)) || Number.isNaN(parseInt(size))) {
        return ApiResponse.error(res, 'query params are invalid', 400);
    }

    try{
        const books = await getBookByKeywordService(keyword, parseInt(page), parseInt(size));
        const booksResponse = toBookSearchResponse(books);
        return ApiResponse.success(res, booksResponse, 'Books fetched successfully');
    } catch (err) {
        logger.error(`Error fetching books for keyword ${keyword}: ${err.message}`);
        return ApiResponse.error(res, 'Failed to fetch books', 500);
    }

}

// Controller to get a presigned read URL for a book
const getBookReadUrl = async (req, res) => {
    const { bookId } = req.params;
    const { format = 'EPUB' } = req.query;

    if (!bookId) { return ApiResponse.error(res, 'Book ID is required', 400); }

    try {
        const result = await getBookReadUrlService(bookId, format);

        if (!result) {
            return ApiResponse.error(res, 'Book format not found', 404);
        }

        return ApiResponse.success(res, result, 'Read URL generated successfully');
    } catch (err) {
        logger.error(`Error generating read URL for book ${bookId}: ${err.message}`);
        return ApiResponse.error(res, 'Failed to generate read URL', 500);
    }
}

// Controller to get a presigned download URL for a book format
const downloadBook = async (req, res) => {
    const { bookId, formatId } = req.params;

    if (!bookId || !formatId) {
        return ApiResponse.error(res, 'Book ID and format ID are required', 400);
    }

    try {
        const result = await getBookDownloadUrlService(bookId, formatId);

        if (!result) {
            return ApiResponse.error(res, 'Book format not found', 404);
        }

        return ApiResponse.success(res, result, 'Download URL generated successfully');
    } catch (err) {
        logger.error(`Error generating download URL for book ${bookId}: ${err.message}`);
        return ApiResponse.error(res, 'Failed to generate download URL', 500);
    }
}

// Controller to get paginated ratings for a book
const getBookRatingsPaginated = async (req, res) => {
    const { bookId } = req.params;
    if (!bookId) return ApiResponse.error(res, 'Book ID is required', 400);

    const page = Math.max(0, parseInt(req.query.page) || 0);
    const size = Math.min(20, Math.max(1, parseInt(req.query.size) || 5));

    try {
        const result = await getBookRatingsPaginatedService(bookId, page, size);
        return ApiResponse.success(res, {
            ratings: toRatingListResponse(result.ratings),
            total: result.total,
            hasMore: result.hasMore,
            page,
            size,
        }, 'Ratings fetched successfully');
    } catch (err) {
        logger.error(`Error fetching ratings for book ${bookId}: ${err.message}`);
        return ApiResponse.error(res, 'Failed to fetch ratings', 500);
    }
}

/**
 * GET /books/:bookId/same-genre?limit=6
 *
 * Returns a capped list of books that share at least one genre with the
 * requested book, excluding the book itself, ordered newest-first.
 *
 * Query params:
 *   limit {number} – max results, clamped to [1, 20], default 6.
 */
const getSameGenreBooks = async (req, res) => {
    const { bookId } = req.params;
    if (!bookId) return ApiResponse.error(res, 'Book ID is required', 400);

    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 6));

    try {
        const books = await getSameGenreBooksService(bookId, limit);
        const booksResponse = toBookListResponse(books);
        return ApiResponse.success(res, booksResponse, 'Same-genre books fetched successfully');
    } catch (err) {
        logger.error(`Error fetching same-genre books for book ${bookId}: ${err.message}`);
        return ApiResponse.error(res, 'Failed to fetch same-genre books', 500);
    }
}

export { getBooksByGenre, getSameGenreBooks, getBookById, getMostReadBooks, getAllBooks, getBookPreview, getBookByKeyword, getBookReadUrl, downloadBook, getBookRatingsPaginated };