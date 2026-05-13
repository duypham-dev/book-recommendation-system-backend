import express from 'express';
import { validate } from '#middlewares/validation.middleware.js';
import { getGenreByIdSchema } from '#validators/genre.validator.js';
import { getAllGenres, getGenreById, getGenresLimit } from '#controllers/user/genre.controller.js';

const router = express.Router();

router.get('/genres', getAllGenres);
router.get('/genres/limit', getGenresLimit);
router.get('/genres/:genreId', validate(getGenreByIdSchema, 'params'), getGenreById);

export { router as userGenreRouter };