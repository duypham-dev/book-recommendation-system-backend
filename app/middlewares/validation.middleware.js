import { logger } from '#utils/index.js';
import { ValidationError } from '#utils/error.js';

const JOI_OPTIONS = {
  abortEarly: false,  // collect ALL errors, not just the first
  stripUnknown: true, // drop keys not declared in the schema
  convert: true,      // coerce types
};

/**
 * Formats a single Joi ValidationError detail into the standard error shape.
 * @param {import('joi').ValidationErrorItem} detail
 * @param {string} [property] - Which part of the request ('body' | 'query' | 'params')
 * @returns {{ field: string, message: string, value: unknown }}
 */
const formatDetail = (detail, property) => ({
  ...(property && { property }),          // only included in validateMultiple
  field: detail.path.join('.'),
  message: detail.message.replace(/['"]/g, ''), // strip Joi's surrounding quotes
  value: detail.context?.value,
});

/**
 * validate(schema, property?)
 * Validates a single part of the request (body / query / params).
 *
 * @param {import('joi').Schema} schema
 * @param {'body' | 'query' | 'params'} property
 * @returns {import('express').RequestHandler}
 */
export const validate = (schema, property = 'body') => {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req[property], JOI_OPTIONS);

    if (error) {
      const errors = error.details.map((d) => formatDetail(d));

      logger.warn('Validation failed', { property, errors, data: req[property] });

      // Pass a typed ValidationError to the global error handler.
      return next(new ValidationError('Invalid input data.', errors));
    }

    // Express.js defines req.query with a getter that evaluates the query string on every access.
    // We must use Object.defineProperty to replace the getter with the statically validated object.
    if (property === 'query') {
      Object.defineProperty(req, 'query', {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      req[property] = value;
    }

    logger.debug('Validation passed', { property, value });
    next();
  };
};

/**
 * validateMultiple(schemas)
 * Validates body, query, and/or params in a single middleware..
 *
 * @param {{ body?: import('joi').Schema, query?: import('joi').Schema, params?: import('joi').Schema }} schemas
 * @returns {import('express').RequestHandler}
 */
export const validateMultiple = (schemas) => {
  return (req, _res, next) => {
    const allErrors = [];
    const cleaned = {}; // accumulate sanitised values for each property

    for (const [property, schema] of Object.entries(schemas)) {
      const { error, value } = schema.validate(req[property], JOI_OPTIONS);

      if (error) {
        // whether "field" belongs to params, query, or body.
        const propertyErrors = error.details.map((d) => formatDetail(d, property));
        allErrors.push(...propertyErrors);
      } else {
        // Only store the clean value when this property passed.
        cleaned[property] = value;
      }
    }

    if (allErrors.length > 0) {
      logger.warn('Multiple validation failed', { errors: allErrors });
      return next(new ValidationError('Invalid input data.', allErrors));
    }
 
    // Apply all cleaned values back to the request at once.
    for (const [property, value] of Object.entries(cleaned)) {
      if (property === 'query') {
        Object.defineProperty(req, 'query', {
          value: value,
          enumerable: true,
          configurable: true,
          writable: true
        });
      } else {
        req[property] = value;
      }
    }

    logger.debug('Multiple validation passed', cleaned);
    next();
  };
};