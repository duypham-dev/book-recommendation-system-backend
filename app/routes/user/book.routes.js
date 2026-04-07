import express from 'express';
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

router.get('/books/most-read', getMostReadBooks);
router.get('/books/search', getBookByKeyword);
router.get('/books/genre/:genreId', getBooksByGenre);
router.get('/books', getAllBooks);

// Dynamic routes with :bookId — sub-resource routes must precede the bare /:bookId route
router.get('/books/:bookId/same-genre', getSameGenreBooks);
router.get('/books/:bookId/read-url', getBookReadUrl);
router.get('/books/:bookId/download/:formatId', downloadBook);
router.get('/books/:bookId/preview', getBookPreview);
router.get('/books/:bookId/ratings', getBookRatingsPaginated);
router.get('/books/:bookId', getBookById);

export {router as userBookRouter};