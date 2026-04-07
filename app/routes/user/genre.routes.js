import express from 'express';
import { getAllGenres, getGenreById, getGenresLimit } from '#controllers/users/genre.controller.js';

const router = express.Router();

router.get('/genres', getAllGenres);
router.get('/genres/:genreId', getGenreById);
router.get('/genres/limit', getGenresLimit);

export {router as UserGenreRouter};