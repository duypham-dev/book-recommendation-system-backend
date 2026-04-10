import express from 'express';
import { getAllAuthors, getAuthorById, createAuthor, updateAuthor, deleteAuthor } from '#controllers/admin/author.controller.js';
import { authenticateToken } from '#middlewares/authenticateToken.js';

const router = express.Router();

// Public routes
router.get('/authors', getAllAuthors);
router.get('/authors/:authorId', getAuthorById);

// Admin routes (require authentication)
router.use('/admin/authors', authenticateToken);

router.route('/admin/authors')
    .post(createAuthor);

router.route('/admin/authors/:authorId')
    .put(updateAuthor)
    .delete(deleteAuthor);

export { router as authorRouter };
