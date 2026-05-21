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
    getRecentlyUploadedBooks as getRecentlyUploadedBooksService,
} from "#services/book.service.js";
import { getBookRatingsPaginated as getBookRatingsPaginatedService } from "#services/rating.service.js";


// Controller to get all books with pagination, search, sort, and filter
// Validator middleware (booksListQuerySchema) already coerces types and sets defaults.
const getAllBooks = async (req, res, next) => {
    const { page, size, sort, keyword, genreIds, authorIds } = req.query;

    // Parse comma-separated ID arrays (filter keeps only valid integers)
    const parsedGenreIds  = genreIds   ? String(genreIds).split(',').map(Number).filter(n => !Number.isNaN(n))  : [];
    const parsedAuthorIds = authorIds  ? String(authorIds).split(',').map(Number).filter(n => !Number.isNaN(n)) : [];

    try {
        const result = await getAllBooksService({
            page,
            size,
            sort,
            keyword,
            genreIds:  parsedGenreIds,
            authorIds: parsedAuthorIds,
        });

        const booksResponse = toBookListResponse(result.data);
        logger.info(`Fetched ${result.data.length} books (page ${page}, keyword "${keyword}")`);

        return ApiResponse.success(res, {
            content: booksResponse,
            ...result.pagination,
        }, 'Books fetched successfully');
    } catch (err) {
        logger.error(`Error fetching books: ${err.message}`);
        next(err);
    }
}

// Validator middleware (bookIdParamsSchema) guarantees bookId is present.
const getBookById = async (req, res, next) => {
    const { bookId } = req.params;
    const userId = req.query.userId; // Optional userId for personalized details

    try {
        const book = await getBookByIdService(bookId, userId);

        if (!book) {
            return ApiResponse.error(res, 'Book not found', 404);
        }

        return ApiResponse.success(res, toBookDetailResponse(book), 'Book fetched successfully');
    } catch (err) {
        logger.error(`Error fetching book ${bookId}: ${err.message}`);
        next(err);
    }
}

// Validator middleware handles coercion and sort whitelist.
const getBooksByGenre = async (req, res, next) => {
    const { genreId } = req.params;
    const { page, size, sort } = req.query;

    try {
        const result = await getBooksByGenreService(genreId, page, size, sort);
        logger.info(`Fetched ${result.data.length} books for genre ${genreId}`);
        return ApiResponse.success(res, {
            content: toBookListResponse(result.data),
            ...result.pagination,
        }, 'Books fetched successfully');
    } catch (err) {
        logger.error(`Error fetching books for genre ${genreId}: ${err.message}`);
        next(err);
    }
}


// mostReadQuerySchema coerces and validates limit/offset.
const getMostReadBooks = async (req, res, next) => {
    const { limit, offset } = req.query;

    try {
        const books = await getMostReadBooksService(offset, limit);
        logger.info(`Fetched ${books.length} most read books`);
        return ApiResponse.success(res, toBookListResponse(books), 'Most read books fetched successfully');
    } catch (err) {
        logger.error(`Error fetching most read books: ${err.message}`);
        next(err);
    }
}

const getRecentlyUploadedBooks = async (req, res, next) => {
    const { limit = 10 } = req.query;

    try {
        const books = await getRecentlyUploadedBooksService(limit);
        logger.info(`Fetched ${books.length} recently uploaded books`);
        return ApiResponse.success(res, toBookListResponse(books), 'Recently uploaded books fetched successfully');
    } catch (err) {
        logger.error(`Error fetching recently uploaded books: ${err.message}`);
        next(err);
    }
}

const getBookPreview = async (req, res, next) => {
    const { bookId } = req.params;

    try {
        const book = await getBookPreviewService(bookId);

        if (!book) {
            return ApiResponse.error(res, 'Book not found', 404);
        }

        return ApiResponse.success(res, toBookPreviewResponse(book), 'Book preview fetched successfully');
    } catch (err) {
        logger.error(`Error fetching book preview ${bookId}: ${err.message}`);
        next(err);
    }
}

// booksSearchQuerySchema validates keyword, page, size.
const getBookByKeyword = async (req, res, next) => {
    const { keyword, page, size } = req.query;

    try {
        const books = await getBookByKeywordService(keyword, page, size);
        return ApiResponse.success(res, toBookSearchResponse(books), 'Books fetched successfully');
    } catch (err) {
        logger.error(`Error fetching books for keyword "${keyword}": ${err.message}`);
        next(err);
    }
}

const getBookReadUrl = async (req, res, next) => {
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
        next(err);
    }
}

// downloadBookParamsSchema validates bookId + formatId.
const downloadBook = async (req, res, next) => {
    const { bookId, formatId } = req.params;

    try {
        const result = await getBookDownloadUrlService(bookId, formatId);

        if (!result) {
            return ApiResponse.error(res, 'Book format not found', 404);
        }

        return ApiResponse.success(res, result, 'Download URL generated successfully');
    } catch (err) {
        logger.error(`Error generating download URL for book ${bookId}: ${err.message}`);
        next(err);
    }
}


const getBookRatingsPaginated = async (req, res, next) => {
    const { bookId } = req.params;
    const { page, size } = req.query;

    try {
        const result = await getBookRatingsPaginatedService(bookId, page, size);
        return ApiResponse.success(
            res,
            toPaginatedRatingResponse(result, page, size),
            'Ratings fetched successfully'
        );
    } catch (err) {
        logger.error(`Error fetching ratings for book ${bookId}: ${err.message}`);
        next(err);
    }
}

/**
 * GET /books/:bookId/same-genre?limit=6
 * Query params:
 *   limit {number} – max results, clamped to [1, 20], default 6.
 */
// sameGenreQuerySchema + bookIdParamsSchema via validateMultiple handle coercion.
const getSameGenreBooks = async (req, res, next) => {
    const { bookId } = req.params;
    const { limit } = req.query;

    try {
        const books = await getSameGenreBooksService(bookId, limit);
        return ApiResponse.success(res, toBookListResponse(books), 'Same-genre books fetched successfully');
    } catch (err) {
        logger.error(`Error fetching same-genre books for book ${bookId}: ${err.message}`);
        next(err);
    }
}

export { getBooksByGenre, getSameGenreBooks, getBookById, getMostReadBooks, getAllBooks, getBookPreview, getBookByKeyword, getBookReadUrl, downloadBook, getBookRatingsPaginated, getRecentlyUploadedBooks };