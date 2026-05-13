import Joi from 'joi';

const requiredId = (label) => Joi.string().trim().required()
  .messages({ 'any.required': `${label} là bắt buộc`, 'string.empty': `${label} là bắt buộc` });

// ─── Rating ───────────────────────────────────────────────────────────────────

export const bookIdParamsSchema = Joi.object({
  bookId: requiredId('ID sách'),
});

export const ratingBodySchema = Joi.object({
  value: Joi.number().integer().min(1).max(5).required()
    .messages({
      'any.required':  'Giá trị đánh giá là bắt buộc',
      'number.base':   'Giá trị đánh giá phải là số',
      'number.min':    'Giá trị đánh giá phải từ 1 đến 5',
      'number.max':    'Giá trị đánh giá phải từ 1 đến 5',
    }),
  comment: Joi.string().trim().max(1000).optional().allow('', null)
    .messages({ 'string.max': 'Nhận xét không được vượt quá 1000 ký tự' }),
});

// ─── History ──────────────────────────────────────────────────────────────────

export const historyBodySchema = Joi.object({
  progress: Joi.number().min(0).max(100).required()
    .messages({
      'any.required': 'Tiến độ đọc là bắt buộc',
      'number.base':  'Tiến độ đọc phải là số',
      'number.min':   'Tiến độ đọc phải từ 0 đến 100',
      'number.max':   'Tiến độ đọc phải từ 0 đến 100',
    }),
});

export const historyQuerySchema = Joi.object({
  page: Joi.number().integer().min(0).default(0),
  size: Joi.number().integer().min(1).max(100).default(10),
});

// ─── Favorite ─────────────────────────────────────────────────────────────────

export const favoriteParamsSchema = Joi.object({
  bookId: requiredId('ID sách'),
});

export const favoritesQuerySchema = Joi.object({
  page: Joi.number().integer().min(0).default(0),
  size: Joi.number().integer().min(1).max(100).default(12),
});
