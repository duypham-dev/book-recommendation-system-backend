import express from 'express';
import { 
  getBookRecommendations, 
  getSimilarBooks, 
  getDiverseBooks, 
} from '#controllers/user/recommendation.controller.js';
import { authenticateToken } from '#middlewares/authenticateToken.js';

const router = express.Router();

router.get('/recommendations', authenticateToken, getBookRecommendations);
router.get('/similar-books', getSimilarBooks);
router.get('/diverse-books', authenticateToken, getDiverseBooks);

export { router as userRecommendationRouter };
