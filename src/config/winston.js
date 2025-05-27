import winston from 'winston'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
}

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
}

winston.addColors(colors)

// Custom format for better readability
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let logMessage = `${timestamp} [${level}]: ${message}`
    
    // Add stack trace for errors
    if (stack) {
      logMessage += `\nStack: ${stack}`
    }
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      logMessage += `\nMeta: ${JSON.stringify(meta, null, 2)}`
    }
    
    return logMessage
  })
)

// File format (without colors)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

// Create logs directory path
const logsDir = path.join(__dirname, '../../logs')

// Transports array
const transports = [
  // Console transport
  new winston.transports.Console({
    format: customFormat,
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  }),
  
  // Error log file
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  
  // Combined log file
  new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    format: fileFormat,
    maxsize: 10485760, // 10MB
    maxFiles: 10,
  }),
]

// Add HTTP request log file in production
if (process.env.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'http.log'),
      level: 'http',
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  )
}

// Create the logger
const logger = winston.createLogger({
  levels,
  format: fileFormat,
  defaultMeta: {
    service: 'e-commerce-api',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    pid: process.pid,
  },
  transports,
  exitOnError: false,
})

// Handle uncaught exceptions and unhandled rejections
if (process.env.NODE_ENV === 'production') {
  logger.exceptions.handle(
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: fileFormat,
    })
  )
  
  logger.rejections.handle(
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: fileFormat,
    })
  )
}

// Create child loggers for different modules
export const createChildLogger = (module) => {
  return logger.child({ module })
}

// HTTP request logger middleware
export const httpLogger = (req, res, next) => {
  const start = Date.now()
  
  // Log request
  logger.http('HTTP Request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || 'anonymous',
    userRole: req.user?.role || 'anonymous',
  })
  
  // Override res.end to log response
  const originalEnd = res.end
  res.end = function(...args) {
    const duration = Date.now() - start
    const contentLength = res.get('Content-Length') || 0
    
    logger.http('HTTP Response', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: `${contentLength} bytes`,
      ip: req.ip,
      userId: req.user?.id || 'anonymous',
    })
    
    originalEnd.apply(this, args)
  }
  
  next()
}

// Security event logger
export const securityLogger = {
  authFailure: (req, reason) => {
    logger.warn('Authentication Failure', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      email: req.body?.email || 'unknown',
      reason,
      endpoint: req.path,
      timestamp: new Date().toISOString(),
    })
  },
  
  authSuccess: (req, user) => {
    logger.info('Authentication Success', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: user.id,
      email: user.email,
      role: user.role,
      endpoint: req.path,
      timestamp: new Date().toISOString(),
    })
  },
  
  unauthorized: (req, reason) => {
    logger.warn('Unauthorized Access Attempt', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id || 'anonymous',
      endpoint: req.path,
      reason,
      timestamp: new Date().toISOString(),
    })
  },
  
  suspiciousActivity: (req, activity) => {
    logger.warn('Suspicious Activity Detected', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id || 'anonymous',
      activity,
      endpoint: req.path,
      timestamp: new Date().toISOString(),
    })
  },
  
  rateLimitExceeded: (req, limitType) => {
    logger.warn('Rate Limit Exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id || 'anonymous',
      limitType,
      endpoint: req.path,
      timestamp: new Date().toISOString(),
    })
  }
}

// Business event logger
export const businessLogger = {
  orderCreated: (order, user) => {
    logger.info('Order Created', {
      orderId: order.id,
      customerId: user?.id || 'guest',
      customerName: order.customerName,
      total: order.total,
      itemsCount: order.items?.length || 0,
      paymentMethod: order.paymentMethod,
      timestamp: new Date().toISOString(),
    })
  },
  
  paymentReceived: (payment, order) => {
    logger.info('Payment Received', {
      paymentId: payment.id,
      orderId: payment.orderId,
      amount: payment.amount,
      method: payment.method,
      customerName: order?.customerName || payment.customerName,
      timestamp: new Date().toISOString(),
    })
  },
  
  paymentVerified: (payment, verifiedBy) => {
    logger.info('Payment Verified', {
      paymentId: payment.id,
      orderId: payment.orderId,
      amount: payment.amount,
      verifiedBy,
      timestamp: new Date().toISOString(),
    })
  },
  
  orderStatusChanged: (orderId, oldStatus, newStatus, updatedBy) => {
    logger.info('Order Status Changed', {
      orderId,
      oldStatus,
      newStatus,
      updatedBy,
      timestamp: new Date().toISOString(),
    })
  },
  
  productCreated: (product, createdBy) => {
    logger.info('Product Created', {
      productId: product.id,
      productName: product.name,
      categoryId: product.categoryId,
      price: product.price,
      createdBy,
      timestamp: new Date().toISOString(),
    })
  },
  
  categoryCreated: (category, createdBy) => {
    logger.info('Category Created', {
      categoryId: category.id,
      categoryName: category.name,
      createdBy,
      timestamp: new Date().toISOString(),
    })
  }
}

// Error tracking with context
export const errorLogger = {
  database: (error, query, params) => {
    logger.error('Database Error', {
      error: error.message,
      stack: error.stack,
      query,
      params,
      timestamp: new Date().toISOString(),
    })
  },
  
  validation: (error, data, endpoint) => {
    logger.warn('Validation Error', {
      error: error.message,
      data,
      endpoint,
      timestamp: new Date().toISOString(),
    })
  },
  
  external: (error, service, endpoint) => {
    logger.error('External Service Error', {
      error: error.message,
      stack: error.stack,
      service,
      endpoint,
      timestamp: new Date().toISOString(),
    })
  },
  
  file: (error, operation, filename) => {
    logger.error('File Operation Error', {
      error: error.message,
      stack: error.stack,
      operation,
      filename,
      timestamp: new Date().toISOString(),
    })
  }
}

// Performance monitoring
export const performanceLogger = {
  slowQuery: (query, duration, params) => {
    logger.warn('Slow Database Query', {
      query,
      duration: `${duration}ms`,
      params,
      timestamp: new Date().toISOString(),
    })
  },
  
  slowEndpoint: (req, duration) => {
    logger.warn('Slow API Endpoint', {
      method: req.method,
      url: req.url,
      duration: `${duration}ms`,
      ip: req.ip,
      userId: req.user?.id || 'anonymous',
      timestamp: new Date().toISOString(),
    })
  },
  
  memoryUsage: (usage) => {
    logger.info('Memory Usage', {
      rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(usage.external / 1024 / 1024)}MB`,
      timestamp: new Date().toISOString(),
    })
  }
}

// Log rotation and cleanup
export const logMaintenance = {
  cleanup: () => {
    logger.info('Log cleanup initiated')
    // Additional cleanup logic can be added here
  },
  
  rotate: () => {
    logger.info('Log rotation initiated')
    // Winston handles rotation automatically with maxFiles and maxsize
  }
}

export default logger