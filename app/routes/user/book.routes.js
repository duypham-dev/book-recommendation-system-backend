import express from 'express';
import { validate, validateMultiple } from '#middlewares/validation.middleware.js';
import {
    bookIdParamsSchema,
    booksByGenreParamsSchema,
    booksByGenreQuerySchema,
    booksListQuerySchema,
    booksSearchQuerySchema,
    bookRatingsQuerySchema,
    sameGenreQuerySchema,
    downloadBookParamsSchema,
    mostReadQuerySchema
} from '#validators/book.validator.js';

import {
    getBooksByGenre,
    getSameGenreBooks,
    getBookById,
    getMostReadBooks,
    getAllBooks,
    getBookPreview,
    getBookByKeyword,
    getBookReadUrl,
    downloadBook,
    getBookRatingsPaginated,
} from '#controllers/user/book.controller.js';

const router = express.Router();

router.get('/books/most-read', validate(mostReadQuerySchema, 'query'), getMostReadBooks);
router.get('/books/search', validate(booksSearchQuerySchema, 'query'), getBookByKeyword);
router.get('/books/genre/:genreId',
    validateMultiple({ params: booksByGenreParamsSchema, query: booksByGenreQuerySchema }),
    getBooksByGenre
);
router.get('/books', validate(booksListQuerySchema, 'query'), getAllBooks);

// Dynamic routes with :bookId — sub-resource routes must precede the bare /:bookId route
router.get('/books/:bookId/same-genre',
    validateMultiple({ params: bookIdParamsSchema, query: sameGenreQuerySchema }),
    getSameGenreBooks
);
router.get('/books/:bookId/read-url', validate(bookIdParamsSchema, 'params'), getBookReadUrl);
router.get('/books/:bookId/download/:formatId', validate(downloadBookParamsSchema, 'params'), downloadBook);
router.get('/books/:bookId/preview', validate(bookIdParamsSchema, 'params'), getBookPreview);
router.get('/books/:bookId/ratings',
    validateMultiple({ params: bookIdParamsSchema, query: bookRatingsQuerySchema }),
    getBookRatingsPaginated
);
router.get('/books/:bookId', validate(bookIdParamsSchema, 'params'), getBookById);

export { router as userBookRouter };