import { ApiResponse, logger } from "#utils/index.js";
import {
  getAdminBooks,
  getDeletedBooks,
  createBook,
  updateBook,
  deleteBook,
  deleteBooksBulk,
  restoreBook,
  hardDeleteBook,
  getBookFormats,
  getBookCoverUrl,
} from "#services/book.service.js";
import { uploadToMinio, deleteFromMinio } from "#config/storageConfig.js";
import { uploadToCloudinary, deleteFromCloudinary, CLOUDINARY_FOLDERS } from "#services/storage.service.js";

/**
 * GET /admin/books - Get books with pagination, filters, sorting
 */
export const getBooks = async (req, res) => {
  try {
    const { page = 0, size = 10, keyword = '', genreId, sort = '' } = req.query;
    
    const books = await getAdminBooks(
      parseInt(page),
      parseInt(size),
      keyword,
      genreId || null,
      sort
    );
    
    return ApiResponse.success(res, books, 'Books fetched successfully');
  } catch (error) {
    logger.error('Get admin books error:', error);
    return ApiResponse.error(res, 'Failed to fetch books', 500);
  }
};

/**
 * POST /admin/books/create - Create a new book (multipart/form-data)
 *
 * Expected text fields: title, description, publicationYear, publisher,
 *   authorNames (repeated), genreIds (repeated)
 * Expected files: cover (image), pdfFile, epubFile
 */
export const createBookHandler = async (req, res, next) => {
  try {
    const { title, description, publicationYear, publisher } = req.body;
    // title + description required — validated upstream by route-level middleware if added

    // Parse repeated form fields — multer may deliver a string or an array
    const authorNames = Array.isArray(req.body.authorNames)
      ? req.body.authorNames
      : req.body.authorNames ? [req.body.authorNames] : [];
    const genreIds = Array.isArray(req.body.genreIds)
      ? req.body.genreIds
      : req.body.genreIds ? [req.body.genreIds] : [];

    // ---- Upload cover image to Cloudinary ----
    let coverImageUrl = '';
    const coverFile = req.files?.cover?.[0];
    if (coverFile) {
      const result = await uploadToCloudinary(coverFile.buffer, CLOUDINARY_FOLDERS.COVERS);
      if (!result.success) {
        return ApiResponse.error(res, 'Failed to upload cover image', 500);
      }
      coverImageUrl = result.url;
    }

    // ---- Upload book files to MinIO, collect format entries ----
    const formats = [];

    const pdfFile = req.files?.pdfFile?.[0];
    if (pdfFile) {
      const { key } = await uploadToMinio(pdfFile.buffer, pdfFile.originalname);
      formats.push({
        typeName: 'PDF',
        contentUrl: key,
        fileSizeKb: Math.round(pdfFile.size / 1024),
      });
    }

    const epubFile = req.files?.epubFile?.[0];
    if (epubFile) {
      const { key } = await uploadToMinio(epubFile.buffer, epubFile.originalname);
      formats.push({
        typeName: 'EPUB',
        contentUrl: key,
        fileSizeKb: Math.round(epubFile.size / 1024),
      });
    }
    // ---- Persist book + relations ----
    const book = await createBook({
      title,
      description,
      coverImageUrl,
      publicationYear,
      publisher,
      authorNames,
      genreIds,
      formats,
    });

    logger.info(`Book created: ${book.id} by admin ${req.user.userId}`);
    return ApiResponse.created(res, book, 'Book created successfully');
  } catch (error) {
    logger.error('Create book error:', error);
    next(error);
  }
};

/**
 * PUT /admin/books/update/:bookId - Update a book (multipart/form-data)
 *
 * Expected text fields: title, description, publicationYear, publisher,
 *   authorNames (repeated), genreIds (repeated)
 * Expected files: cover (image), pdfFile, epubFile
 */
export const updateBookHandler = async (req, res) => {
  try {
    const { bookId } = req.params;
    const { title, description, publicationYear, publisher } = req.body;

    // Normalize repeated form fields — multer may deliver a string or an array
    const authorNames = Array.isArray(req.body.authorNames)
      ? req.body.authorNames
      : req.body.authorNames ? [req.body.authorNames] : [];
    const genreIds = Array.isArray(req.body.genreIds)
      ? req.body.genreIds
      : req.body.genreIds ? [req.body.genreIds] : [];

    // ---- Handle cover image upload to Cloudinary ----
    let coverImageUrl;
    const coverFile = req.files?.cover?.[0];
    if (coverFile) {
      // Delete old cover from Cloudinary before uploading new one
      const oldCoverUrl = await getBookCoverUrl(bookId);
      if (oldCoverUrl) {
        await deleteFromCloudinary(oldCoverUrl);
      }

      const result = await uploadToCloudinary(coverFile.buffer, CLOUDINARY_FOLDERS.COVERS);
      if (!result.success) {
        return ApiResponse.error(res, 'Failed to upload cover image', 500);
      }
      coverImageUrl = result.url;
    }

    // ---- Handle book file uploads to MinIO ----
    const formats = [];

    const pdfFile = req.files?.pdfFile?.[0];
    if (pdfFile) {
      const { key } = await uploadToMinio(pdfFile.buffer, pdfFile.originalname);
      formats.push({
        typeName: 'PDF',
        contentUrl: key,
        fileSizeKb: Math.round(pdfFile.size / 1024),
      });
    }

    const epubFile = req.files?.epubFile?.[0];
    if (epubFile) {
      const { key } = await uploadToMinio(epubFile.buffer, epubFile.originalname);
      formats.push({
        typeName: 'EPUB',
        contentUrl: key,
        fileSizeKb: Math.round(epubFile.size / 1024),
      });
    }

    // ---- Persist updates ----
    const book = await updateBook(bookId, {
      title,
      description,
      coverImageUrl,
      publicationYear,
      publisher,
      authorNames,
      genreIds,
      formats,
    });

    logger.info(`Book updated: ${bookId} by admin ${req.user.userId}`);
    return ApiResponse.success(res, book, 'Book updated successfully');
  } catch (error) {
    logger.error('Update book error:', error);
    next(error);
  }
};

/**
 * DELETE /admin/books/delete/:bookId - Delete a book
 */
export const deleteBookHandler = async (req, res) => {
  try {
    const { bookId } = req.params;
    
    await deleteBook(bookId);
    
    logger.info(`Book deleted: ${bookId} by admin ${req.user.userId}`);
    
    return ApiResponse.success(res, null, 'Book deleted successfully');
  } catch (error) {
    logger.error('Delete book error:', error);
    return ApiResponse.error(res, 'Failed to delete book', 500);
  }
};

/**
 * DELETE /admin/books - Bulk delete books
 */
export const deleteBooksBulkHandler = async (req, res, next) => {
  try {
    const { ids } = req.body; // bulkIdsBodySchema validates ids is a non-empty array

    await deleteBooksBulk(ids);
    logger.info(`${ids.length} books deleted by admin ${req.user.userId}`);
    return ApiResponse.success(res, null, `${ids.length} books deleted successfully`);
  } catch (error) {
    logger.error('Bulk delete books error:', error);
    next(error);
  }
};

/**
 * GET /books/:bookId/formats - Get book formats
 */
export const getBookFormatsHandler = async (req, res) => {
  try {
    const { bookId } = req.params;
    
    const formats = await getBookFormats(bookId);
    
    return ApiResponse.success(res, formats, 'Book formats fetched successfully');
  } catch (error) {
    logger.error('Get book formats error:', error);
    return ApiResponse.error(res, 'Failed to fetch book formats', 500);
  }
};

/**
 * GET /admin/books/deleted - Get soft-deleted books (trash)
 */
export const getDeletedBooksHandler = async (req, res) => {
  try {
    const { page = 0, size = 10, keyword = '', sort = '' } = req.query;

    const books = await getDeletedBooks(parseInt(page), parseInt(size), keyword, sort);

    return ApiResponse.success(res, books, 'Deleted books fetched successfully');
  } catch (error) {
    logger.error('Get deleted books error:', error);
    return ApiResponse.error(res, 'Failed to fetch deleted books', 500);
  }
};

/**
 * PATCH /admin/books/restore/:bookId - Restore a soft-deleted (hidden) book
 */
export const restoreBookHandler = async (req, res) => {
  try {
    const { bookId } = req.params;

    await restoreBook(bookId);

    logger.info(`Book restored: ${bookId} by admin ${req.user.userId}`);

    return ApiResponse.success(res, null, 'Book restored successfully');
  } catch (error) {
    logger.error('Restore book error:', error);
    return ApiResponse.error(res, 'Failed to restore book', 500);
  }
};

/**
 * DELETE /admin/books/hard-delete/:bookId - Permanently delete a book from the database
 */
export const hardDeleteBookHandler = async (req, res) => {
  try {
    const { bookId } = req.params;  

    const formats = await getBookFormats(bookId);
    const coverUrl = await getBookCoverUrl(bookId);
    // First delete cover image from Cloudinary if exists
    if (coverUrl) {
      await deleteFromCloudinary(coverUrl);
      logger.info(`✅ Deleted cover image for book ${bookId} from Cloudinary successfully.`);
    }

    // Second delete associated files from MinIO
    for (const format of formats) {
      if (format.contentUrl) {
        await deleteFromMinio(format.contentUrl);
      }
    }
    logger.info(`✅ Deleted associated files for book ${bookId} from MinIO successfully.`);
    await hardDeleteBook(bookId);

    logger.info(`🟢 Book ${bookId} permanently deleted by admin ${req.user.userId}`);

    return ApiResponse.success(res, null, 'Book permanently deleted successfully');
  } catch (error) {
    logger.error('❌ Hard delete book error:', error);
    return ApiResponse.error(res, 'Failed to permanently delete book', 500);
  }
};