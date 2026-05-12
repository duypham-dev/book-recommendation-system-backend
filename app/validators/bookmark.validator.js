import Joi from 'joi';

export const bookmarkParamsSchema = Joi.object({
  bookId: Joi.alternatives().try(Joi.string(), Joi.number()).required().messages({
    'any.required': 'ID sách là bắt buộc'
  }),
  bookmarkId: Joi.alternatives().try(Joi.string(), Joi.number()).optional()
});

export const bookmarkIdParamsSchema = Joi.object({
  bookmarkId: Joi.alternatives().try(Joi.string(), Joi.number()).required().messages({
    'any.required': 'ID bookmark là bắt buộc'
  })
});

// Body schema for creating / updating
export const bookmarkBodySchema = Joi.object({
  pageNumber: Joi.number()
    .integer()
    .min(0)
    .optional()
    .messages({
      'number.base': 'Số trang phải là số',
      'number.min': 'Số trang không được âm'
    }),
  locationInBook: Joi.string()
    .trim()
    .optional(),
  note: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow('', null)
    .messages({
      'string.max': 'Ghi chú không được vượt quá 500 ký tự'
    })
});
