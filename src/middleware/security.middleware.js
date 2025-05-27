import helmet from 'helmet'
import mongoSanitize from 'express-mongo-sanitize'
import xss from 'xss'
import { body, param, query, validationResult } from 'express-validator'
import logger, { securityLogger } from '../config/winston.js'
import { commonErrors } from '../utils/responses.js'

/**
 * Enhanced Helmet configuration for security headers
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      manifestSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for uploads
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
})

/**
 * MongoDB injection protection
 */
export const mongoSanitization = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    securityLogger.suspiciousActivity(req, `MongoDB injection attempt detected in ${key}`)
  }
})

/**
 * XSS protection middleware
 */
export const xssProtection = (req, res, next) => {
  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body)
    }
    
    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query)
    }
    
    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params)
    }
    
    next()
  } catch (error) {
    logger.error('XSS protection error:', error)
    next()
  }
}

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj) {
  if (obj === null || typeof obj !== 'object') {
    return typeof obj === 'string' ? xss(obj) : obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item))
  }
  
  const sanitized = {}
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeObject(value)
  }
  
  return sanitized
}

/**
 * Input validation middleware factory
 */
export const validateInput = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)))
    
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      const errorDetails = errors.array().map(error => ({
        field: error.path || error.param,
        value: error.value,
        message: error.msg
      }))
      
      securityLogger.unauthorized(req, `Validation failed: ${JSON.stringify(errorDetails)}`)
      
      return res.status(400).json({
        success: false,
        error: {
          type: 'validation',
          message: 'Datos de entrada inválidos',
          details: errorDetails
        }
      })
    }
    
    next()
  }
}

/**
 * Common validation rules
 */
export const validationRules = {
  // Email validation
  email: () => body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email debe ser válido'),
  
  // Phone validation (Peru format)
  phone: () => body('phone')
    .matches(/^\+?51[0-9]{9}$/)
    .withMessage('Teléfono debe ser un número válido de Perú'),
  
  // Password validation
  password: () => body('password')
    .isLength({ min: 8, max: 128 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número'),
  
  // Name validation
  name: () => body('name')
    .isLength({ min: 2, max: 100 })
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('Nombre debe contener solo letras y espacios'),
  
  // ID validation
  id: () => param('id')
    .isInt({ min: 1 })
    .withMessage('ID debe ser un número entero positivo'),
  
  // Order ID validation
  orderId: () => param('id')
    .matches(/^ORD-[0-9]+$/)
    .withMessage('ID de orden inválido'),
  
  // Payment ID validation
  paymentId: () => param('id')
    .matches(/^PAY-[0-9]+$/)
    .withMessage('ID de pago inválido'),
  
  // Pagination validation
  pagination: () => [
    query('page')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Página debe ser un número entre 1 y 1000'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Límite debe ser un número entre 1 y 100')
  ],
  
  // Price validation
  price: () => body('price')
    .isFloat({ min: 0.01, max: 999999.99 })
    .withMessage('Precio debe ser un número positivo válido'),
  
  // Decimal validation
  decimal: (field) => body(field)
    .isFloat({ min: 0 })
    .withMessage(`${field} debe ser un número decimal positivo`),
  
  // String length validation
  string: (field, min = 1, max = 255) => body(field)
    .isLength({ min, max })
    .trim()
    .escape()
    .withMessage(`${field} debe tener entre ${min} y ${max} caracteres`),
  
  // Enum validation
  enum: (field, values) => body(field)
    .isIn(values)
    .withMessage(`${field} debe ser uno de: ${values.join(', ')}`),
  
  // File validation
  file: (field) => body(field)
    .optional()
    .matches(/^[a-zA-Z0-9._-]+\.(jpg|jpeg|png|gif|pdf)$/i)
    .withMessage(`${field} debe ser un archivo válido (jpg, jpeg, png, gif, pdf)`)
}

/**
 * SQL injection protection (for raw queries)
 */
export const sqlInjectionProtection = (req, res, next) => {
  const suspiciousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
    /(--|;|\/\*|\*\/)/,
    /(\b(OR|AND)\b.*=.*)/i,
    /'[^']*'/,
    /\b\d+\s*=\s*\d+\b/
  ]
  
  const checkForSQLInjection = (obj, path = '') => {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key
      
      if (typeof value === 'string') {
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(value)) {
            securityLogger.suspiciousActivity(req, `Potential SQL injection in ${currentPath}: ${value}`)
            return true
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        if (checkForSQLInjection(value, currentPath)) {
          return true
        }
      }
    }
    return false
  }
  
  try {
    let suspicious = false
    
    if (req.body && checkForSQLInjection(req.body, 'body')) suspicious = true
    if (req.query && checkForSQLInjection(req.query, 'query')) suspicious = true
    if (req.params && checkForSQLInjection(req.params, 'params')) suspicious = true
    
    if (suspicious) {
      return res.status(400).json(commonErrors.badRequest('Invalid input detected'))
    }
    
    next()
  } catch (error) {
    logger.error('SQL injection protection error:', error)
    next()
  }
}

/**
 * Rate limiting bypass detection
 */
export const detectBypassAttempts = (req, res, next) => {
  const suspiciousHeaders = [
    'x-forwarded-for',
    'x-real-ip', 
    'x-originating-ip',
    'x-cluster-client-ip',
    'cf-connecting-ip'
  ]
  
  let suspiciousCount = 0
  suspiciousHeaders.forEach(header => {
    if (req.headers[header]) {
      suspiciousCount++
    }
  })
  
  // If too many IP-related headers, might be bypass attempt
  if (suspiciousCount > 2) {
    securityLogger.suspiciousActivity(req, `Potential rate limit bypass attempt - multiple IP headers`)
  }
  
  next()
}

/**
 * Content type validation
 */
export const validateContentType = (allowedTypes = ['application/json']) => {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'DELETE') {
      return next()
    }
    
    const contentType = req.headers['content-type']
    if (!contentType) {
      return res.status(400).json(commonErrors.badRequest('Content-Type header required'))
    }
    
    const isAllowed = allowedTypes.some(type => contentType.includes(type))
    if (!isAllowed) {
      securityLogger.suspiciousActivity(req, `Invalid content type: ${contentType}`)
      return res.status(415).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'Tipo de contenido no soportado'
        }
      })
    }
    
    next()
  }
}

/**
 * Request size validation
 */
export const validateRequestSize = (maxSize = 10 * 1024 * 1024) => {
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0')
    
    if (contentLength > maxSize) {
      securityLogger.suspiciousActivity(req, `Request too large: ${contentLength} bytes`)
      return res.status(413).json({
        success: false,
        error: {
          code: 'REQUEST_TOO_LARGE',
          message: 'Solicitud demasiado grande'
        }
      })
    }
    
    next()
  }
}

/**
 * IP whitelist middleware
 */
export const ipWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    if (allowedIPs.length === 0) {
      return next()
    }
    
    const clientIP = req.ip || req.connection.remoteAddress
    const isAllowed = allowedIPs.some(ip => {
      if (ip.includes('/')) {
        // CIDR notation support would go here
        return false
      }
      return clientIP === ip
    })
    
    if (!isAllowed) {
      securityLogger.unauthorized(req, `IP not whitelisted: ${clientIP}`)
      return res.status(403).json(commonErrors.forbidden())
    }
    
    next()
  }
}

/**
 * Security audit logger
 */
export const securityAudit = (req, res, next) => {
  const originalJson = res.json
  
  res.json = function(data) {
    // Log security-relevant responses
    if (res.statusCode >= 400) {
      securityLogger.unauthorized(req, `${res.statusCode} response: ${JSON.stringify(data)}`)
    }
    
    return originalJson.call(this, data)
  }
  
  next()
}

export default {
  securityHeaders,
  mongoSanitization,
  xssProtection,
  validateInput,
  validationRules,
  sqlInjectionProtection,
  detectBypassAttempts,
  validateContentType,
  validateRequestSize,
  ipWhitelist,
  securityAudit
}