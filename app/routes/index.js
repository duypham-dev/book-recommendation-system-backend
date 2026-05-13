import express from 'express';
const router = express.Router();

// USER routes
import { userBookRouter } from '#routes/user/book.routes.js';
import { userGenreRouter } from '#routes/user/genre.routes.js';
import { bookmarkRouter } from '#routes/user/bookmark.routes.js';
import { historyRouter } from '#routes/user/history.routes.js';
import { profileRouter } from '#routes/user/profile.routes.js';
import { ratingRouter } from '#routes/user/rating.routes.js';
import { favoriteRouter } from '#routes/user/favorite.routes.js';
import { userRecommendationRouter } from '#routes/user/recommendation.routes.js';
import { AuthRouter } from '#routes/auth/auth.routes.js';

// ADMIN routes
import { authorRouter } from '#routes/admin/author.routes.js';
import { adminBookRouter } from '#routes/admin/book.routes.js';
import { adminGenreRouter } from '#routes/admin/genre.routes.js';
import { userManagementRouter } from '#routes/admin/user.routes.js';
import { dashboardRouter } from '#routes/admin/dashboard.routes.js';
import { adminRecommendationRouter } from '#routes/admin/recommendation.routes.js';

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).send({ status: 'OK' });
});

router.get('/test-deploy', (req, res) => {
  res.status(200).send({ status: 'OK' });
});

// Mount user routes
router.use(userBookRouter);
router.use(userGenreRouter);
router.use(bookmarkRouter);
router.use(favoriteRouter);
router.use(historyRouter);
router.use(profileRouter);
router.use(ratingRouter);
router.use(userRecommendationRouter);

// Mount auth routes
router.use(AuthRouter);

// Mount admin routes
router.use(authorRouter);
router.use(adminBookRouter);
router.use(adminGenreRouter);
router.use(userManagementRouter);
router.use(dashboardRouter);
router.use(adminRecommendationRouter);

export default router;