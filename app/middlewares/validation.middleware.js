import { ApiResponse, logger } from "#utils/index.js";

/**
 * General validation middleware using Joi schemas
 * @param {Object} schema - Joi validation schema
 * @param {string} property - Property to validate ('body', 'query', 'params')
 * @returns {Function} Express middleware function
 */
export const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    try {
      // Get data to validate from request
      const dataToValidate = req[property];
      
      // Validate data with schema
      const { error, value } = schema.validate(dataToValidate, {
        abortEarly: false, // Return all errors, don't stop at first error
        stripUnknown: true, // Remove fields not in schema
        convert: true // Auto convert data types (e.g., string to number)
      });
      
      // If validation errors exist
      if (error) {
        const validationErrors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context.value
        }));
        
        logger.warn('Validation failed', {
          property,
          errors: validationErrors,
          originalData: dataToValidate
        });
        
        return ApiResponse.error(res, 'Invalid input data', 400, {
          errors: validationErrors
        });
      }
      
      // Update request with validated and cleaned data
      if (property === 'query') {
        Object.assign(req.query, value);
      } else {
        req[property] = value;
      }
      
      logger.debug('Validation passed', {
        property,
        validatedData: value
      });
      
      next();
    } catch (err) {
      logger.error('Validation middleware error', err);
      return ApiResponse.error(res, 'Validation processing error', 500);
    }
  };
};

/**
 * Validation middleware for multiple properties
 * @param {Object} schemas - Object containing schemas for each property
 * @returns {Function} Express middleware function
 */
export const validateMultiple = (schemas) => {
  return (req, res, next) => {
    try {
      const allErrors = [];
      const validatedData = {};
      
      // Validate each property
      for (const [property, schema] of Object.entries(schemas)) {
        const dataToValidate = req[property];
        
        const { error, value } = schema.validate(dataToValidate, {
          abortEarly: false,
          stripUnknown: true,
          convert: true
        });
        
        if (error) {
          const propertyErrors = error.details.map(detail => ({
            property,
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context.value
          }));
          allErrors.push(...propertyErrors);
        } else {
          validatedData[property] = value;
        }
      }
      
      // If validation errors exist
      if (allErrors.length > 0) {
        logger.warn('Multiple validation failed', {
          errors: allErrors
        });
        
        return ApiResponse.error(res, 'Invalid input data', 400, {
          errors: allErrors
        });
      }
      
      // Update request with validated data
      Object.entries(validatedData).forEach(([property, value]) => {
        if (property === 'query') {
          Object.assign(req.query, value);
        } else {
          req[property] = value;
        }
      });
      
      logger.debug('Multiple validation passed', validatedData);
      
      next();
    } catch (err) {
      logger.error('Multiple validation middleware error', err);
      return ApiResponse.error(res, 'Validation processing error', 500);
    }
  };
};