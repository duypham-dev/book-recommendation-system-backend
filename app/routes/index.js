import express from 'express';
const router = express.Router();

// USER routes
import { UserBookRouter } from '#routes/user/bookRoute.js';
import { UserGenreRouter } from '#routes/user/genreRoute.js';
import { UserRouter } from '#routes/user/userRoute.js';
import { BookmarkRouter } from '#routes/user/bookmarkRoute.js';
import { AuthorRouter } from '#routes//authorRoute.js';
import { AuthRouter } from '#routes/authRoute.js';

// ADMIN routes
import { adminRouter } from '#routes/admin/AdminRoute.js';

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
router.use(adminRouter);

export default router;