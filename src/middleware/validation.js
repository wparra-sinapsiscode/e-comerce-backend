import { validationErrorResponse } from '../utils/responses.js'
import logger from '../config/logger.js'

/**
 * Middleware factory for Zod schema validation
 * @param {object} schema - Zod schema to validate against
 * @param {string} source - Where to get data from: 'body', 'query', 'params'
 * @returns {Function} Express middleware function
 */
export function validateSchema(schema, source = 'body') {
  return (req, res, next) => {
    try {
      let data
      
      switch (source) {
        case 'body':
          data = req.body
          break
        case 'query':
          data = req.query
          break
        case 'params':
          data = req.params
          break
        default:
          data = req.body
      }

      // Parse and validate data
      const result = schema.safeParse(data)
      
      if (!result.success) {
        const errors = result.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        }))
        
        logger.warn('Validation failed:', { errors, data })
        return res.status(400).json(validationErrorResponse(errors))
      }

      // Attach validated data to request
      switch (source) {
        case 'body':
          req.validatedBody = result.data
          break
        case 'query':
          req.validatedQuery = result.data
          break
        case 'params':
          req.validatedParams = result.data
          break
      }

      next()
    } catch (error) {
      logger.error('Validation middleware error:', error)
      res.status(500).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
        },
      })
    }
  }
}

/**
 * Validate request body
 */
export function validateBody(schema) {
  return validateSchema(schema, 'body')
}

/**
 * Validate query parameters
 */
export function validateQuery(schema) {
  return validateSchema(schema, 'query')
}

/**
 * Validate route parameters
 */
export function validateParams(schema) {
  return validateSchema(schema, 'params')
}

/**
 * Validate multiple sources at once
 */
export function validateMultiple(schemas) {
  return (req, res, next) => {
    const errors = []
    const validatedData = {}

    // Validate each source
    for (const [source, schema] of Object.entries(schemas)) {
      let data
      
      switch (source) {
        case 'body':
          data = req.body
          break
        case 'query':
          data = req.query
          break
        case 'params':
          data = req.params
          break
        default:
          continue
      }

      const result = schema.safeParse(data)
      
      if (!result.success) {
        const sourceErrors = result.error.issues.map(issue => ({
          field: `${source}.${issue.path.join('.')}`,
          message: issue.message,
          code: issue.code,
        }))
        errors.push(...sourceErrors)
      } else {
        validatedData[source] = result.data
      }
    }

    if (errors.length > 0) {
      logger.warn('Multi-source validation failed:', { errors })
      return res.status(400).json(validationErrorResponse(errors))
    }

    // Attach all validated data
    if (validatedData.body) req.validatedBody = validatedData.body
    if (validatedData.query) req.validatedQuery = validatedData.query
    if (validatedData.params) req.validatedParams = validatedData.params

    next()
  }
}

/**
 * Sanitize and normalize data
 */
export function sanitizeInput(req, res, next) {
  // Recursively trim strings and handle common sanitization
  function sanitizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject)
    }

    const sanitized = {}
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // Trim whitespace
        sanitized[key] = value.trim()
        
        // Convert empty strings to null for optional fields
        if (sanitized[key] === '') {
          sanitized[key] = null
        }
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value)
      } else {
        sanitized[key] = value
      }
    }

    return sanitized
  }

  // Sanitize body, query, and params
  if (req.body) {
    req.body = sanitizeObject(req.body)
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query)
  }

  next()
}

/**
 * Convert string numbers to actual numbers in query params
 */
export function parseNumericQuery(req, res, next) {
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string' && /^\d+$/.test(value)) {
        req.query[key] = parseInt(value, 10)
      } else if (typeof value === 'string' && /^\d+\.\d+$/.test(value)) {
        req.query[key] = parseFloat(value)
      }
    }
  }
  next()
}

export default {
  validateSchema,
  validateBody,
  validateQuery,
  validateParams,
  validateMultiple,
  sanitizeInput,
  parseNumericQuery,
}