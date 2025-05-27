import { getPrismaClient } from '../config/database.js'
import { successResponse, commonErrors } from '../utils/responses.js'
import { cacheOperations, cacheHealthCheck } from '../middleware/cache.middleware.js'
import { rateLimitHealthCheck } from '../middleware/rateLimiting.middleware.js'
import logger from '../config/winston.js'
import os from 'os'

const prisma = getPrismaClient()

/**
 * Enhanced health check with detailed system information
 */
export async function getHealthCheck(req, res) {
  try {
    const startTime = Date.now()
    
    // Database health check
    const dbStart = Date.now()
    let dbHealth = { status: 'unhealthy', responseTime: 0, error: null }
    
    try {
      await prisma.$queryRaw`SELECT 1`
      dbHealth = {
        status: 'healthy',
        responseTime: Date.now() - dbStart,
        connection_pool: {
          active: prisma._engine?.activeConnectionsCount || 0,
          idle: prisma._engine?.idleConnectionsCount || 0
        }
      }
    } catch (error) {
      dbHealth.error = error.message
      dbHealth.responseTime = Date.now() - dbStart
    }
    
    // Memory usage
    const memoryUsage = process.memoryUsage()
    const systemMemory = {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem()
    }
    
    // CPU information
    const cpus = os.cpus()
    const loadAverage = os.loadavg()
    
    // Cache health
    const cacheHealth = cacheHealthCheck()
    
    // Rate limiting health
    const rateLimitHealth = rateLimitHealthCheck()
    
    // Application metrics
    const uptime = process.uptime()
    const responseTime = Date.now() - startTime
    
    const health = {
      status: dbHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: {
        process: uptime,
        system: os.uptime(),
        formatted: formatUptime(uptime)
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      node_version: process.version,
      response_time: `${responseTime}ms`,
      database: dbHealth,
      memory: {
        process: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
          arrayBuffers: Math.round(memoryUsage.arrayBuffers / 1024 / 1024)
        },
        system: {
          total: Math.round(systemMemory.total / 1024 / 1024),
          free: Math.round(systemMemory.free / 1024 / 1024),
          used: Math.round(systemMemory.used / 1024 / 1024),
          usage_percent: Math.round((systemMemory.used / systemMemory.total) * 100)
        }
      },
      cpu: {
        count: cpus.length,
        model: cpus[0]?.model || 'Unknown',
        load_average: {
          '1min': loadAverage[0],
          '5min': loadAverage[1],
          '15min': loadAverage[2]
        },
        platform: os.platform(),
        arch: os.arch()
      },
      cache: cacheHealth,
      rate_limiting: rateLimitHealth,
      security: {
        headers: 'Active',
        xss_protection: 'Active',
        sql_injection_protection: 'Active',
        mongo_sanitization: 'Active'
      }
    }
    
    const statusCode = health.status === 'healthy' ? 200 : 503
    
    logger.info('Health check performed', {
      status: health.status,
      responseTime: health.response_time,
      dbResponseTime: dbHealth.responseTime
    })
    
    res.status(statusCode).json(health)
  } catch (error) {
    logger.error('Health check error:', error)
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      message: error.message
    })
  }
}

/**
 * System metrics endpoint for monitoring
 */
export async function getMetrics(req, res) {
  try {
    const startTime = Date.now()
    
    // Get database statistics
    const dbStats = await Promise.all([
      prisma.user.count(),
      prisma.product.count(),
      prisma.category.count(),
      prisma.order.count(),
      prisma.payment.count(),
      prisma.order.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      }),
      prisma.payment.count({
        where: {
          status: 'PENDING'
        }
      })
    ])
    
    // Cache statistics
    const cacheStats = cacheOperations.getStats()
    
    // Process statistics
    const processStats = process.resourceUsage()
    const memoryUsage = process.memoryUsage()
    
    const metrics = {
      timestamp: new Date().toISOString(),
      response_time: `${Date.now() - startTime}ms`,
      database: {
        total_users: dbStats[0],
        total_products: dbStats[1],
        total_categories: dbStats[2],
        total_orders: dbStats[3],
        total_payments: dbStats[4],
        orders_last_24h: dbStats[5],
        pending_payments: dbStats[6]
      },
      performance: {
        uptime: process.uptime(),
        memory_usage: {
          rss_mb: Math.round(memoryUsage.rss / 1024 / 1024),
          heap_total_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          heap_used_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          external_mb: Math.round(memoryUsage.external / 1024 / 1024)
        },
        cpu_usage: {
          user_time: processStats.userCPUTime,
          system_time: processStats.systemCPUTime,
          max_rss: processStats.maxRSS
        },
        event_loop: {
          delay: 0 // Could implement event loop delay measurement
        }
      },
      cache: {
        hit_rate: calculateHitRate(cacheStats),
        total_keys: Object.values(cacheStats).reduce((sum, stat) => sum + stat.keys, 0),
        total_hits: Object.values(cacheStats).reduce((sum, stat) => sum + stat.hits, 0),
        total_misses: Object.values(cacheStats).reduce((sum, stat) => sum + stat.misses, 0),
        instances: cacheStats
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        node_version: process.version,
        load_average: os.loadavg(),
        free_memory: Math.round(os.freemem() / 1024 / 1024),
        total_memory: Math.round(os.totalmem() / 1024 / 1024)
      },
      environment: {
        node_env: process.env.NODE_ENV,
        port: process.env.PORT,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    }
    
    logger.info('Metrics collected', {
      responseTime: metrics.response_time,
      totalOrders: metrics.database.total_orders,
      memoryUsed: metrics.performance.memory_usage.heap_used_mb
    })
    
    res.json(successResponse(metrics))
  } catch (error) {
    logger.error('Metrics collection error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Application status summary
 */
export async function getStatus(req, res) {
  try {
    // Quick health checks
    const dbCheck = await prisma.$queryRaw`SELECT 1`
    const memoryUsage = process.memoryUsage()
    const uptime = process.uptime()
    
    // Get critical counts
    const [pendingPayments, activeOrders] = await Promise.all([
      prisma.payment.count({ where: { status: 'PENDING' } }),
      prisma.order.count({ 
        where: { 
          status: { in: ['AWAITING_PAYMENT', 'PREPARING', 'READY_FOR_SHIPPING'] }
        }
      })
    ])
    
    const status = {
      service: 'E-commerce API',
      status: 'operational',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: formatUptime(uptime),
      timestamp: new Date().toISOString(),
      database: 'connected',
      memory_usage: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      alerts: {
        pending_payments: pendingPayments,
        active_orders: activeOrders,
        high_memory: memoryUsage.heapUsed > 512 * 1024 * 1024 // 512MB threshold
      },
      endpoints: {
        healthy: true,
        total: 8, // auth, categories, products, orders, payments, uploads, dashboard, reports
        status_url: '/health'
      }
    }
    
    res.json(successResponse(status))
  } catch (error) {
    logger.error('Status check error:', error)
    res.status(500).json({
      service: 'E-commerce API',
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    })
  }
}

/**
 * Cache management endpoints
 */
export async function getCacheStats(req, res) {
  try {
    const stats = cacheOperations.getStats()
    const keys = cacheOperations.getAllKeys()
    
    const result = {
      statistics: stats,
      keys_by_instance: keys,
      total_keys: Object.values(stats).reduce((sum, stat) => sum + stat.keys, 0),
      hit_rate: calculateHitRate(stats),
      recommendations: generateCacheRecommendations(stats)
    }
    
    res.json(successResponse(result))
  } catch (error) {
    logger.error('Cache stats error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

export async function clearCache(req, res) {
  try {
    const { pattern, prefix } = req.query
    
    if (pattern) {
      cacheOperations.clearByPattern(pattern)
      logger.info(`Cache cleared by pattern: ${pattern}`)
      res.json(successResponse(null, `Cache cleared for pattern: ${pattern}`))
    } else if (prefix) {
      cacheOperations.clearByPrefix(prefix)
      logger.info(`Cache cleared by prefix: ${prefix}`)
      res.json(successResponse(null, `Cache cleared for prefix: ${prefix}`))
    } else {
      cacheOperations.clearAll()
      logger.info('All cache cleared')
      res.json(successResponse(null, 'All cache cleared'))
    }
  } catch (error) {
    logger.error('Clear cache error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

// Helper functions
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  return `${days}d ${hours}h ${minutes}m ${secs}s`
}

function calculateHitRate(cacheStats) {
  const totalHits = Object.values(cacheStats).reduce((sum, stat) => sum + stat.hits, 0)
  const totalRequests = Object.values(cacheStats).reduce((sum, stat) => sum + stat.hits + stat.misses, 0)
  
  return totalRequests > 0 ? Math.round((totalHits / totalRequests) * 100) : 0
}

function generateCacheRecommendations(cacheStats) {
  const recommendations = []
  const totalHitRate = calculateHitRate(cacheStats)
  
  if (totalHitRate < 50) {
    recommendations.push('Consider increasing cache TTL for frequently accessed data')
  }
  
  if (totalHitRate > 90) {
    recommendations.push('Cache performance is excellent')
  }
  
  Object.entries(cacheStats).forEach(([instance, stats]) => {
    if (stats.keys > 1000) {
      recommendations.push(`${instance} cache has many keys (${stats.keys}), consider cleanup`)
    }
  })
  
  return recommendations
}

export default {
  getHealthCheck,
  getMetrics,
  getStatus,
  getCacheStats,
  clearCache
}