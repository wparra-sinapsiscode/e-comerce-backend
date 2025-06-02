import rateLimit from 'express-rate-limit'
import logger from '../config/logger.js'

// IP whitelist for trusted sources
const TRUSTED_IPS = [
  '127.0.0.1',
  '::1',
  'localhost',
  // Add your trusted IPs here
]

// Check if IP is whitelisted
const isWhitelisted = (ip) => {
  return TRUSTED_IPS.includes(ip) || ip.startsWith('192.168.') || ip.startsWith('10.')
}

// Custom key generator that considers user role
const createKeyGenerator = (prefix = '') => {
  return (req) => {
    const ip = req.ip
    const userRole = req.user?.role || 'anonymous'
    const userId = req.user?.id || 'anonymous'
    return `${prefix}:${userRole}:${userId}:${ip}`
  }
}

// Custom skip function for whitelisted IPs and admin users
const createSkipFunction = (allowAdmin = true) => {
  return (req) => {
    // Skip for whitelisted IPs
    if (isWhitelisted(req.ip)) {
      return true
    }
    
    // Skip for admin users if allowed
    if (allowAdmin && req.user?.role === 'ADMIN') {
      return true
    }
    
    return false
  }
}

// Standard error response
const rateLimitErrorResponse = {
  success: false,
  error: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Demasiadas solicitudes. Intenta nuevamente más tarde.',
  },
}

/**
 * General API rate limiter
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req) => {
    if (req.user?.role === 'ADMIN') return 1000
    if (req.user?.role === 'CUSTOMER') return 300
    return 100 // Anonymous users
  },
  message: rateLimitErrorResponse,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createKeyGenerator('general'),
  skip: createSkipFunction(false), // Don't skip admin for general limiter
})

/**
 * Authentication rate limiter (stricter)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 attempts per 15 minutes (increased for development)
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Demasiados intentos de autenticación. Intenta nuevamente en 15 minutos.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createKeyGenerator('auth'),
  skip: createSkipFunction(true),
  handler: (req, res, next, options) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`)
    res.status(options.statusCode).json(options.message)
  }
})

/**
 * Upload rate limiter
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: (req) => {
    if (req.user?.role === 'ADMIN') return 200
    return 20 // Regular users
  },
  message: {
    success: false,
    error: {
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
      message: 'Demasiadas subidas de archivos. Intenta nuevamente más tarde.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createKeyGenerator('upload'),
  skip: createSkipFunction(true),
})

/**
 * Search rate limiter
 */
export const searchLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: (req) => {
    if (req.user?.role === 'ADMIN') return 200
    if (req.user?.role === 'CUSTOMER') return 50
    return 20 // Anonymous users
  },
  message: {
    success: false,
    error: {
      code: 'SEARCH_RATE_LIMIT_EXCEEDED',
      message: 'Demasiadas búsquedas. Intenta nuevamente más tarde.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createKeyGenerator('search'),
  skip: createSkipFunction(true),
})

/**
 * Order creation rate limiter
 */
export const orderLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: (req) => {
    if (req.user?.role === 'ADMIN') return 100
    return 10 // Regular users
  },
  message: {
    success: false,
    error: {
      code: 'ORDER_RATE_LIMIT_EXCEEDED',
      message: 'Demasiados pedidos creados. Intenta nuevamente más tarde.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createKeyGenerator('order'),
  skip: createSkipFunction(true),
})

/**
 * Payment rate limiter
 */
export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: (req) => {
    if (req.user?.role === 'ADMIN') return 200
    return 30 // Regular users
  },
  message: {
    success: false,
    error: {
      code: 'PAYMENT_RATE_LIMIT_EXCEEDED',
      message: 'Demasiadas operaciones de pago. Intenta nuevamente más tarde.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createKeyGenerator('payment'),
  skip: createSkipFunction(true),
})

/**
 * Admin operations rate limiter
 */
export const adminLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 500, // High limit for admin operations
  message: {
    success: false,
    error: {
      code: 'ADMIN_RATE_LIMIT_EXCEEDED',
      message: 'Demasiadas operaciones administrativas. Intenta nuevamente más tarde.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createKeyGenerator('admin'),
  skip: (req) => {
    // Only apply to admin users
    return req.user?.role !== 'ADMIN'
  },
})

/**
 * Report generation rate limiter (expensive operations)
 */
export const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limited reports per hour
  message: {
    success: false,
    error: {
      code: 'REPORT_RATE_LIMIT_EXCEEDED',
      message: 'Demasiados reportes generados. Intenta nuevamente más tarde.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createKeyGenerator('report'),
  skip: createSkipFunction(true),
})

/**
 * Password reset rate limiter (very strict)
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Only 3 password reset attempts per hour
  message: {
    success: false,
    error: {
      code: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
      message: 'Demasiados intentos de restablecimiento de contraseña. Intenta nuevamente en 1 hora.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createKeyGenerator('password_reset'),
  skip: createSkipFunction(true),
})

/**
 * Create custom rate limiter
 */
export const createCustomLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    message = rateLimitErrorResponse,
    keyPrefix = 'custom',
    skipAdmin = true,
    skipWhitelisted = true
  } = options

  return rateLimit({
    windowMs,
    max: typeof max === 'function' ? max : () => max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: createKeyGenerator(keyPrefix),
    skip: (req) => {
      if (skipWhitelisted && isWhitelisted(req.ip)) return true
      if (skipAdmin && req.user?.role === 'ADMIN') return true
      return false
    },
  })
}

/**
 * Rate limit status middleware
 */
export const rateLimitStatus = (req, res, next) => {
  // Add rate limit info to response headers
  res.setHeader('X-RateLimit-Trusted-IP', isWhitelisted(req.ip))
  res.setHeader('X-RateLimit-User-Role', req.user?.role || 'anonymous')
  next()
}

/**
 * Dynamic rate limiter based on endpoint
 */
export const dynamicLimiter = (req, res, next) => {
  const path = req.path.toLowerCase()
  const method = req.method

  // Apply specific limiters based on endpoint
  if (path.includes('/auth/')) {
    return authLimiter(req, res, next)
  }
  
  if (path.includes('/upload')) {
    return uploadLimiter(req, res, next)
  }
  
  if (path.includes('/search')) {
    return searchLimiter(req, res, next)
  }
  
  if (path.includes('/orders') && method === 'POST') {
    return orderLimiter(req, res, next)
  }
  
  if (path.includes('/payments')) {
    return paymentLimiter(req, res, next)
  }
  
  if (path.includes('/reports')) {
    return reportLimiter(req, res, next)
  }
  
  if (path.includes('/admin/') || path.includes('/dashboard/')) {
    return adminLimiter(req, res, next)
  }
  
  // Default general limiter
  return generalLimiter(req, res, next)
}

/**
 * Rate limiting health check
 */
export const rateLimitHealthCheck = () => {
  return {
    status: 'healthy',
    limiters: {
      general: 'Active',
      auth: 'Active',
      upload: 'Active',
      search: 'Active',
      order: 'Active',
      payment: 'Active',
      admin: 'Active',
      report: 'Active'
    },
    trusted_ips: TRUSTED_IPS.length,
    features: {
      whitelist: 'Enabled',
      user_role_based: 'Enabled',
      dynamic_limits: 'Enabled'
    }
  }
}

export default {
  generalLimiter,
  authLimiter,
  uploadLimiter,
  searchLimiter,
  orderLimiter,
  paymentLimiter,
  adminLimiter,
  reportLimiter,
  passwordResetLimiter,
  createCustomLimiter,
  rateLimitStatus,
  dynamicLimiter,
  rateLimitHealthCheck
}