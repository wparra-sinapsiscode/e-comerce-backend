import 'dotenv/config'
import app, { setupGracefulShutdown } from './src/app.js'
import { connectDatabase, disconnectDatabase } from './src/config/database.js'
import { cleanExpiredTokens } from './src/utils/jwt.js'
import logger from './src/config/logger.js'

// Validate required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET'
]

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.error(`Missing required environment variable: ${envVar}`)
    process.exit(1)
  }
}

// Configuration
const PORT = process.env.PORT || 4000
const HOST = process.env.HOST || 'localhost'
const NODE_ENV = process.env.NODE_ENV || 'development'

async function startServer() {
  try {
    // Connect to database with retry logic
    logger.info('🔄 Connecting to database...')
    await connectDatabase()
    
    // Start HTTP server
    const server = app.listen(PORT, HOST, () => {
      logger.info(`🚀 Server running on http://${HOST}:${PORT}`)
      logger.info(`📊 Environment: ${NODE_ENV}`)
      logger.info(`📡 Health check: http://${HOST}:${PORT}/health`)
      logger.info(`🔐 Auth endpoints: http://${HOST}:${PORT}/api/v1/auth`)
      
      if (NODE_ENV === 'development') {
        logger.info('🔧 Development mode: Detailed logging enabled')
      }
    })

    // Setup graceful shutdown
    setupGracefulShutdown(server)

    // Setup periodic cleanup tasks
    setupPeriodicTasks()

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error)
      process.exit(1)
    })

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
      process.exit(1)
    })

    return server
  } catch (error) {
    logger.error('❌ Failed to start server:', error)
    await disconnectDatabase()
    process.exit(1)
  }
}

// Setup periodic tasks
function setupPeriodicTasks() {
  // Clean expired refresh tokens every hour
  setInterval(async () => {
    try {
      const result = await cleanExpiredTokens()
      if (result.success && result.cleaned > 0) {
        logger.info(`🧹 Cleaned ${result.cleaned} expired refresh tokens`)
      }
    } catch (error) {
      logger.error('Error cleaning expired tokens:', error)
    }
  }, 60 * 60 * 1000) // 1 hour

  // Health check log every 30 minutes in production
  if (NODE_ENV === 'production') {
    setInterval(() => {
      const memoryUsage = process.memoryUsage()
      const memoryUsageMB = {
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
      }
      
      logger.info('📊 Server health:', {
        uptime: process.uptime(),
        memory: memoryUsageMB,
        pid: process.pid,
      })
    }, 30 * 60 * 1000) // 30 minutes
  }
}

// Start the server
startServer().catch((error) => {
  logger.error('❌ Server startup failed:', error)
  process.exit(1)
})