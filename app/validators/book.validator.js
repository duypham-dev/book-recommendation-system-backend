import Joi from 'joi';

const BOOK_SORTS = ['newest', 'title-asc', 'title-desc'];
const GENRE_SORTS = ['newest', 'popular', 'title-asc', 'title-desc'];

const requiredId = (label) =>
  Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': `${label} là bắt buộc`,
      'any.required': `${label} là bắt buộc`
    });

const numberField = (label, { min, max, defaultValue } = {}) => {
  let schema = Joi.number().integer();
  if (min !== undefined) {
    schema = schema.min(min);
  }
  if (max !== undefined) {
    schema = schema.max(max);
  }
  if (defaultValue !== undefined) {
    schema = schema.default(defaultValue);
  }

  const messages = { 'number.base': `${label} phải là số` };
  if (min !== undefined) {
    messages['number.min'] = `${label} phải ≥ ${min}`;
  }
  if (max !== undefined) {
    messages['number.max'] = `${label} không được vượt quá ${max}`;
  }

  return schema.messages(messages);
};

const pageQuery = (defaultValue = 0) => numberField('Trang', { min: 0, defaultValue });
const sizeQuery = (defaultValue = 10, max = 100) => numberField('Giới hạn', { min: 1, max, defaultValue });
const limitQuery = (defaultValue, max) => numberField('Giới hạn', { min: 1, max, defaultValue });
const offsetQuery = () => numberField('Offset', { min: 0, defaultValue: 0 });

const keywordQuery = Joi.string()
  .trim()
  .min(1)
  .max(100)
  .required()
  .messages({
    'string.empty': 'Từ khóa tìm kiếm là bắt buộc',
    'string.min': 'Từ khóa phải ít nhất 1 ký tự',
    'string.max': 'Từ khóa không được vượt quá 100 ký tự',
    'any.required': 'Từ khóa tìm kiếm là bắt buộc'
  });

export const booksByGenreParamsSchema = Joi.object({
  genreId: requiredId('ID thể loại')
});

export const booksByGenreQuerySchema = Joi.object({
  page: pageQuery(0),
  size: sizeQuery(10, 100),
  sort: Joi.string().valid(...GENRE_SORTS).optional()
});

export const bookIdParamsSchema = Joi.object({
  bookId: requiredId('ID sách')
});

export const downloadBookParamsSchema = Joi.object({
  bookId: requiredId('ID sách'),
  formatId: requiredId('ID định dạng')
});

export const booksSearchQuerySchema = Joi.object({
  keyword: keywordQuery,
  page: pageQuery(0),
  size: sizeQuery(10, 100),
  sort: Joi.string().valid(...BOOK_SORTS).optional(),
  genreIds: Joi.string().optional(),
  authorIds: Joi.string().optional()
});

export const booksListQuerySchema = Joi.object({
  page: pageQuery(0),
  size: sizeQuery(12, 100),
  sort: Joi.string().valid(...BOOK_SORTS).optional(),
  keyword: Joi.string().optional(),
  genreIds: Joi.string().optional(),
  authorIds: Joi.string().optional()
});

export const bookRatingsQuerySchema = Joi.object({
  page: pageQuery(0),
  size: sizeQuery(10, 100)
});

export const sameGenreQuerySchema = Joi.object({
  limit: limitQuery(6, 20)
});

export const mostReadQuerySchema = Joi.object({
  limit: limitQuery(10, 50),
  offset: offsetQuery(),
  page: numberField('Trang', { min: 0 }),
  size: numberField('Giới hạn', { min: 1, max: 50 })
})
  .rename('page', 'offset', { override: true, ignoreUndefined: true })
  .rename('size', 'limit', { override: true, ignoreUndefined: true });

export const recentlyUploadedQuerySchema = Joi.object({
  limit: limitQuery(10, 50)
});
