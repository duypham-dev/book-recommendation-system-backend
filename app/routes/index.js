import express from 'express';
const router = express.Router();

// USER routes
import { UserBookRouter } from '#routes/Users/bookRoute.js';
import { UserGenreRouter } from '#routes/Users/genreRoute.js';
import { UserRouter } from '#routes/Users/userRoute.js';
import { BookmarkRouter } from '#routes/Users/bookmarkRoute.js';
import { AuthorRouter } from '#routes/Users/authorRoute.js';
import { AuthRouter } from '#routes/authRoute.js';

// ADMIN routes
import { AdminRouter } from '#routes/Admin/AdminRoute.js';

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).send({ status: 'OK' });
});

// Mount user routes
router.use(UserBookRouter);
router.use(UserGenreRouter);
router.use(UserRouter);
router.use(BookmarkRouter);
router.use(AuthorRouter);

// Mount auth routes
router.use(AuthRouter);

// Mount admin routes
router.use(AdminRouter);

export default router;