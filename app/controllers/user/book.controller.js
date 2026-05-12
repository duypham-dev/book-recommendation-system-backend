import { ApiResponse, logger } from "#utils/index.js";
import { toBookListResponse, toBookDetailResponse, toBookPreviewResponse, toBookSearchResponse } from "../../mappers/book.mapper.js";
import { toPaginatedRatingResponse } from "../../mappers/rating.mapper.js";
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
} from "#services/book.service.js";
import { getBookRatingsPaginated as getBookRatingsPaginatedService } from "#services/rating.service.js";


// Controller to get all books with pagination, search, sort, and filter
const getAllBooks = async (req, res) => {
    const { page = 0, size = 12, sort = 'newest', keyword = '', genreIds, authorIds } = req.query;

    const pageNum = parseInt(page, 10);
    const sizeNum = parseInt(size, 10);

    // Validate sort
    const allowedSorts = ['newest', 'title-asc', 'title-desc'];
    const validSort = allowedSorts.includes(sort) ? sort : 'newest';

    // Parse comma-separated ID arrays
    const parsedGenreIds = genreIds ? String(genreIds).split(',').map(Number).filter(n => !Number.isNaN(n)) : [];
    const parsedAuthorIds = authorIds ? String(authorIds).split(',').map(Number).filter(n => !Number.isNaN(n)) : [];

    try {
        const result = await getAllBooksService({
            page: pageNum,
            size: sizeNum,
            sort: validSort,
            keyword: keyword.trim(),
            genreIds: parsedGenreIds,
            authorIds: parsedAuthorIds,
        });

        const booksResponse = toBookListResponse(result.data);

        logger.info(`Fetched ${result.data.length} books (page ${pageNum}, keyword "${keyword}")`);

        return ApiResponse.success(res, {
            content: booksResponse,
            ...result.pagination,
        }, 'Books fetched successfully');
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

    const pageNum = parseInt(page);
    const sizeNum = parseInt(size);

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
    const page = Math.max(0, parseInt(req.query.page) || 0);
    const size = Math.min(20, Math.max(1, parseInt(req.query.size) || 5));

    try {
        const result = await getBookRatingsPaginatedService(bookId, page, size);
        return ApiResponse.success(
            res,
            toPaginatedRatingResponse(result, page, size),
            'Ratings fetched successfully'
        );
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