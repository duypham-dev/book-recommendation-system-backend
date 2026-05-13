import Joi from 'joi';

// ─── Shared primitives ────────────────────────────────────────────────────────

const pageQuery  = (def = 0)         => Joi.number().integer().min(0).default(def);
const sizeQuery  = (def = 10, max = 100) => Joi.number().integer().min(1).max(max).default(def);
const keywordQuery = ()              => Joi.string().trim().max(200).allow('').default('');
const sortQuery  = (...allowed)      => Joi.string().valid(...allowed).allow('').default('');
const requiredId = (label)           => Joi.string().trim().required()
  .messages({ 'any.required': `${label} là bắt buộc`, 'string.empty': `${label} là bắt buộc` });

// ─── Common param schemas ─────────────────────────────────────────────────────

export const bookIdParamsSchema = Joi.object({
  bookId: requiredId('ID sách'),
});

export const genreIdParamsSchema = Joi.object({
  genreId: requiredId('ID thể loại'),
});

export const userIdParamsSchema = Joi.object({
  userId: requiredId('ID người dùng'),
});

// ─── Paginated list query (admin books / users / genres) ──────────────────────

export const adminListQuerySchema = Joi.object({
  page:    pageQuery(0),
  size:    sizeQuery(10, 100),
  keyword: keywordQuery(),
  sort:    sortQuery('', 'newest', 'title-asc', 'title-desc', 'oldest'),
  genreId: Joi.string().optional().allow('', null),
  status:  Joi.string().optional().allow(''),
});

// ─── Admin genre body ─────────────────────────────────────────────────────────

export const genreBodySchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required()
    .messages({
      'any.required': 'Tên thể loại là bắt buộc',
      'string.empty': 'Tên thể loại là bắt buộc',
      'string.max':   'Tên thể loại không được vượt quá 100 ký tự',
    }),
  description: Joi.string().trim().max(500).optional().allow('', null),
});

// ─── Admin bulk-ids body ──────────────────────────────────────────────────────

export const bulkIdsBodySchema = Joi.object({
  ids: Joi.array().items(Joi.alternatives().try(Joi.string(), Joi.number())).min(1).required()
    .messages({
      'any.required': 'Danh sách ID là bắt buộc',
      'array.min':    'Phải có ít nhất 1 ID',
    }),
});
