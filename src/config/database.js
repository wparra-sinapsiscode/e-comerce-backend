import { PrismaClient } from '@prisma/client'
import logger from './logger.js'

let prisma

// Singleton pattern for Prisma client
function createPrismaClient() {
  if (prisma) {
    return prisma
  }

  prisma = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
      {
        emit: 'event',
        level: 'error',
      },
      {
        emit: 'event',
        level: 'info',
      },
      {
        emit: 'event',
        level: 'warn',
      },
    ],
  })

  // Log database queries in development
  if (process.env.NODE_ENV === 'development') {
    prisma.$on('query', (e) => {
      logger.debug('Database Query:', {
        query: e.query,
        params: e.params,
        duration: e.duration,
      })
    })
  }

  // Log database errors
  prisma.$on('error', (e) => {
    logger.error('Database Error:', e)
  })

  // Log database info
  prisma.$on('info', (e) => {
    logger.info('Database Info:', e)
  })

  // Log database warnings
  prisma.$on('warn', (e) => {
    logger.warn('Database Warning:', e)
  })

  return prisma
}

// Connect to database with retry logic
export async function connectDatabase() {
  const maxRetries = 5
  let retries = 0

  while (retries < maxRetries) {
    try {
      const client = createPrismaClient()
      await client.$connect()
      logger.info('✅ Connected to PostgreSQL database')
      return client
    } catch (error) {
      retries++
      logger.error(`❌ Database connection attempt ${retries} failed:`, error.message)
      
      if (retries >= maxRetries) {
        logger.error('❌ Max database connection retries reached')
        throw new Error('Failed to connect to database after multiple attempts')
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.pow(2, retries) * 1000
      logger.info(`⏳ Retrying database connection in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

// Disconnect from database
export async function disconnectDatabase() {
  if (prisma) {
    await prisma.$disconnect()
    logger.info('📴 Disconnected from PostgreSQL database')
  }
}

// Get Prisma client instance
export function getPrismaClient() {
  return createPrismaClient()
}

// Health check for database
export async function checkDatabaseHealth() {
  try {
    const client = getPrismaClient()
    await client.$queryRaw`SELECT 1`
    return { status: 'healthy', message: 'Database connection is working' }
  } catch (error) {
    return { status: 'unhealthy', message: error.message }
  }
}

export default getPrismaClient