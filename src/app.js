import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Import routes
import authRoutes from './routes/auth.routes.js'
import categoryRoutes from './routes/category.routes.js'
import productRoutes from './routes/product.routes.js'

// Import middleware
import { authenticateUser } from './middleware/auth.js'

// Import utilities
import logger from './config/logger.js'
import { connectDatabase, checkDatabaseHealth } from './config/database.js'
import { successResponse, commonErrors } from './utils/responses.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Create Express app
const app = express()

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1)

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}))

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true)
    
    const allowedOrigins = [
      process.env.CORS_ORIGIN || 'http://localhost:4001',
      'http://localhost:5173', // Default Vite port
      'http://localhost:3000', // Alternative dev port  
      'http://127.0.0.1:4001',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
    ]
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      logger.warn(`CORS blocked origin: ${origin}`)
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With', 
    'Content-Type', 
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-API-Key'
  ],
}

app.use(cors(corsOptions))

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  strict: true,
  type: 'application/json'
}))
app.use(express.urlencoded({ 
  extended: true,
  limit: '10mb'
}))

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiadas solicitudes desde esta IP. Intenta nuevamente más tarde.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health check
    return req.path === '/health'
  },
})

app.use(globalLimiter)

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now()
  
  res.on('finish', () => {
    const duration = Date.now() - start
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info'
    
    logger[logLevel](`${req.method} ${req.path}`, {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id || 'anonymous',
    })
  })
  
  next()
})

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth()
    
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      database: dbHealth,
    }
    
    const statusCode = dbHealth.status === 'healthy' ? 200 : 503
    res.status(statusCode).json(health)
  } catch (error) {
    logger.error('Health check error:', error)
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    })
  }
})

// API routes
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/categories', categoryRoutes)
app.use('/api/v1/products', productRoutes)

// Welcome route
app.get('/', (req, res) => {
  res.json(successResponse({
    message: 'E-commerce API Server',
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      auth: '/api/v1/auth',
      categories: '/api/v1/categories',
      products: '/api/v1/products',
      docs: '/api/docs (coming soon)',
    }
  }))
})

// Catch-all for API routes
app.all('/api/*', (req, res) => {
  res.status(404).json(commonErrors.notFound('API endpoint'))
})

// Global error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    query: req.query,
    ip: req.ip,
  })

  // Handle specific error types
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
      },
    })
  }

  if (error.name === 'SyntaxError' && error.status === 400 && 'body' in error) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Invalid JSON in request body',
      },
    })
  }

  if (error.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'CORS_ERROR',
        message: 'CORS policy violation',
      },
    })
  }

  // Default internal server error
  res.status(500).json(commonErrors.internalError())
})

// Handle 404 for non-API routes
app.use((req, res) => {
  res.status(404).json(commonErrors.notFound('Route'))
})

// Graceful shutdown handler
export function setupGracefulShutdown(server) {
  const gracefulShutdown = (signal) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`)
    
    server.close(() => {
      logger.info('HTTP server closed')
      
      // Close database connections and other cleanup
      process.exit(0)
    })
    
    // Force close after 30 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down')
      process.exit(1)
    }, 30000)
  }
  
  process.on('SIGTERM', gracefulShutdown)
  process.on('SIGINT', gracefulShutdown)
}

export default app