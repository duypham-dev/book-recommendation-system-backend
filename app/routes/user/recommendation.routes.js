import express from 'express';
import { 
  getBookRecommendations, 
  getSimilarBooks, 
  getDiverseBooks, 
  sendFeedback 
} from '#controllers/user/recommendation.controller.js';
import { authenticateToken } from '#middlewares/authenticateToken.js';

const router = express.Router();

router.get('/recommendations', authenticateToken, getBookRecommendations);
router.get('/similar-books', authenticateToken, getSimilarBooks);
router.get('/diverse-books', authenticateToken, getDiverseBooks);
router.post('/feedback', authenticateToken, sendFeedback);

export { router as userRecommendationRouter };
