import express from 'express';
import { getAllAuthors, getAuthorById, createAuthor, updateAuthor, deleteAuthor } from '#controllers/users/AuthorController.js';
import { authenticateToken } from '#middlewares/authenticateToken.js';

const router = express.Router();

// Public routes
router.get('/authors', getAllAuthors);
router.get('/authors/:authorId', getAuthorById);

// Admin routes (require authentication)
router.post('/admin/authors/create', authenticateToken, createAuthor);
router.put('/admin/authors/update/:authorId', authenticateToken, updateAuthor);
router.delete('/admin/authors/delete/:authorId', authenticateToken, deleteAuthor);

export { router as AuthorRouter };
