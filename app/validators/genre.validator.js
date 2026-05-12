import Joi from 'joi';

// Validation schema for getting genre by ID
export const getGenreByIdSchema = Joi.object({
  genreId: Joi.alternatives().try(Joi.string(), Joi.number())
    .required()
    .messages({
      'any.required': 'ID thể loại là bắt buộc'
    })
});

// Validation schema for getting genres limit
export const getGenresLimitSchema = Joi.object({
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10)
    .messages({
      'number.base': 'Giới hạn phải là số',
      'number.min': 'Giới hạn phải ≥ 1',
      'number.max': 'Giới hạn không được vượt quá 100'
    })
});

// Validation schema for getting all genres
export const getAllGenresSchema = Joi.object({
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(0)
});
