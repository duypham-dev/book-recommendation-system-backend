import express from 'express';
import { 
  getBookRecommendations, 
  getSimilarBooks, 
} from '#controllers/user/recommendation.controller.js';
import { authenticateToken } from '#middlewares/authenticateToken.js';

const router = express.Router();

router.get('/recommendations', authenticateToken, getBookRecommendations);
router.get('/similar-books', getSimilarBooks);


export { router as userRecommendationRouter };
