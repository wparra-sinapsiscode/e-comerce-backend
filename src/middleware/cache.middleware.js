import NodeCache from 'node-cache'
import logger from '../config/logger.js'

// Create cache instances with different TTL settings
const shortCache = new NodeCache({ 
  stdTTL: 5 * 60, // 5 minutes
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: false
})

const mediumCache = new NodeCache({ 
  stdTTL: 15 * 60, // 15 minutes
  checkperiod: 120,
  useClones: false
})

const longCache = new NodeCache({ 
  stdTTL: 60 * 60, // 1 hour
  checkperiod: 300,
  useClones: false
})

// Cache key generators
const generateCacheKey = (req, prefix = '') => {
  const { path, query, user } = req
  const userRole = user?.role || 'anonymous'
  const queryString = new URLSearchParams(query).toString()
  return `${prefix}:${userRole}:${path}:${queryString}`
}

const generateUserSpecificKey = (req, prefix = '') => {
  const userId = req.user?.id || 'anonymous'
  const { path, query } = req
  const queryString = new URLSearchParams(query).toString()
  return `${prefix}:user_${userId}:${path}:${queryString}`
}

/**
 * Generic cache middleware factory
 */
export const createCacheMiddleware = (options = {}) => {
  const {
    ttl = 5 * 60, // 5 minutes default
    keyGenerator = generateCacheKey,
    keyPrefix = 'api',
    skipCache = () => false,
    cacheInstance = null
  } = options

  // Select cache instance based on TTL
  let cache = cacheInstance
  if (!cache) {
    if (ttl <= 5 * 60) cache = shortCache
    else if (ttl <= 15 * 60) cache = mediumCache
    else cache = longCache
  }

  return (req, res, next) => {
    // Skip cache for certain conditions
    if (skipCache(req) || req.method !== 'GET') {
      return next()
    }

    const cacheKey = keyGenerator(req, keyPrefix)
    
    try {
      const cachedData = cache.get(cacheKey)
      
      if (cachedData) {
        logger.debug(`Cache HIT: ${cacheKey}`)
        
        // Add cache headers
        res.setHeader('X-Cache', 'HIT')
        res.setHeader('X-Cache-Key', cacheKey)
        
        return res.json(cachedData)
      }
      
      logger.debug(`Cache MISS: ${cacheKey}`)
      
      // Store original res.json function
      const originalJson = res.json
      
      // Override res.json to cache the response
      res.json = function(data) {
        // Only cache successful responses
        if (res.statusCode === 200 && data?.success !== false) {
          cache.set(cacheKey, data, ttl)
          logger.debug(`Cache SET: ${cacheKey}`)
        }
        
        // Add cache headers
        res.setHeader('X-Cache', 'MISS')
        res.setHeader('X-Cache-Key', cacheKey)
        
        // Call original json function
        return originalJson.call(this, data)
      }
      
      next()
    } catch (error) {
      logger.error('Cache middleware error:', error)
      next() // Continue without cache on error
    }
  }
}

/**
 * Cache middleware for public data (products, categories)
 */
export const cachePublicData = createCacheMiddleware({
  ttl: 15 * 60, // 15 minutes
  keyPrefix: 'public',
  skipCache: (req) => {
    // Skip cache for admin users to see real-time data
    return req.user?.role === 'ADMIN'
  }
})

/**
 * Cache middleware for user-specific data
 */
export const cacheUserData = createCacheMiddleware({
  ttl: 5 * 60, // 5 minutes
  keyPrefix: 'user',
  keyGenerator: generateUserSpecificKey,
  skipCache: (req) => {
    // Always cache user-specific data
    return false
  }
})

/**
 * Cache middleware for dashboard data (admin only)
 */
export const cacheDashboardData = createCacheMiddleware({
  ttl: 2 * 60, // 2 minutes for dashboard
  keyPrefix: 'dashboard',
  skipCache: (req) => {
    // Only cache for admin users
    return req.user?.role !== 'ADMIN'
  }
})

/**
 * Cache middleware for reports (longer TTL)
 */
export const cacheReports = createCacheMiddleware({
  ttl: 30 * 60, // 30 minutes
  keyPrefix: 'reports',
  skipCache: (req) => {
    // Skip cache if format is not JSON
    return req.query.format !== 'json' && req.query.format !== undefined
  }
})

/**
 * Cache middleware for search results
 */
export const cacheSearchResults = createCacheMiddleware({
  ttl: 10 * 60, // 10 minutes
  keyPrefix: 'search'
})

/**
 * Manual cache operations
 */
export const cacheOperations = {
  // Clear all cache
  clearAll() {
    shortCache.flushAll()
    mediumCache.flushAll()
    longCache.flushAll()
    logger.info('All caches cleared')
  },

  // Clear cache by pattern
  clearByPattern(pattern) {
    [shortCache, mediumCache, longCache].forEach(cache => {
      const keys = cache.keys()
      const matchingKeys = keys.filter(key => key.includes(pattern))
      cache.del(matchingKeys)
      logger.info(`Cleared ${matchingKeys.length} cache entries matching pattern: ${pattern}`)
    })
  },

  // Clear cache by prefix
  clearByPrefix(prefix) {
    [shortCache, mediumCache, longCache].forEach(cache => {
      const keys = cache.keys()
      const matchingKeys = keys.filter(key => key.startsWith(prefix))
      cache.del(matchingKeys)
      logger.info(`Cleared ${matchingKeys.length} cache entries with prefix: ${prefix}`)
    })
  },

  // Get cache statistics
  getStats() {
    return {
      short_cache: shortCache.getStats(),
      medium_cache: mediumCache.getStats(),
      long_cache: longCache.getStats()
    }
  },

  // Get all cache keys
  getAllKeys() {
    return {
      short_cache: shortCache.keys(),
      medium_cache: mediumCache.keys(),
      long_cache: longCache.keys()
    }
  },

  // Manual cache set
  set(key, value, ttl = 5 * 60) {
    let cache = shortCache
    if (ttl > 15 * 60) cache = longCache
    else if (ttl > 5 * 60) cache = mediumCache
    
    cache.set(key, value, ttl)
    logger.debug(`Manual cache SET: ${key}`)
  },

  // Manual cache get
  get(key) {
    return shortCache.get(key) || mediumCache.get(key) || longCache.get(key)
  },

  // Manual cache delete
  delete(key) {
    let deleted = 0
    if (shortCache.del(key)) deleted++
    if (mediumCache.del(key)) deleted++
    if (longCache.del(key)) deleted++
    
    if (deleted > 0) {
      logger.debug(`Manual cache DELETE: ${key}`)
    }
    return deleted > 0
  }
}

/**
 * Cache invalidation helpers
 */
export const invalidateCache = {
  // Invalidate product-related cache when products change
  products() {
    cacheOperations.clearByPattern('public')
    cacheOperations.clearByPattern('search')
    cacheOperations.clearByPattern('dashboard')
  },

  // Invalidate category-related cache
  categories() {
    cacheOperations.clearByPattern('public')
    cacheOperations.clearByPattern('dashboard')
  },

  // Invalidate order-related cache
  orders() {
    cacheOperations.clearByPattern('dashboard')
    cacheOperations.clearByPattern('reports')
    cacheOperations.clearByPattern('user')
  },

  // Invalidate payment-related cache
  payments() {
    cacheOperations.clearByPattern('dashboard')
    cacheOperations.clearByPattern('reports')
  },

  // Invalidate user-specific cache
  user(userId) {
    cacheOperations.clearByPattern(`user_${userId}`)
  },

  // Invalidate all dashboard data
  dashboard() {
    cacheOperations.clearByPrefix('dashboard')
  }
}

/**
 * Cache warming functions
 */
export const warmCache = {
  // Warm up frequently accessed data
  async products(req, res, next) {
    // This would be called during server startup or scheduled
    // Implementation depends on your specific needs
    logger.info('Cache warming: products')
  },

  async categories(req, res, next) {
    logger.info('Cache warming: categories')
  }
}

/**
 * Cache health check
 */
export const cacheHealthCheck = () => {
  const stats = cacheOperations.getStats()
  const totalKeys = stats.short_cache.keys + stats.medium_cache.keys + stats.long_cache.keys
  const totalHits = stats.short_cache.hits + stats.medium_cache.hits + stats.long_cache.hits
  const totalMisses = stats.short_cache.misses + stats.medium_cache.misses + stats.long_cache.misses
  
  return {
    status: 'healthy',
    total_keys: totalKeys,
    hit_rate: totalHits + totalMisses > 0 ? (totalHits / (totalHits + totalMisses)) * 100 : 0,
    instances: {
      short: { ...stats.short_cache, ttl: '5 minutes' },
      medium: { ...stats.medium_cache, ttl: '15 minutes' },
      long: { ...stats.long_cache, ttl: '1 hour' }
    }
  }
}

// Event listeners for cache events
shortCache.on('set', (key, value) => {
  logger.debug(`Short cache SET: ${key}`)
})

shortCache.on('expired', (key, value) => {
  logger.debug(`Short cache EXPIRED: ${key}`)
})

mediumCache.on('set', (key, value) => {
  logger.debug(`Medium cache SET: ${key}`)
})

longCache.on('set', (key, value) => {
  logger.debug(`Long cache SET: ${key}`)
})

export default {
  createCacheMiddleware,
  cachePublicData,
  cacheUserData,
  cacheDashboardData,
  cacheReports,
  cacheSearchResults,
  cacheOperations,
  invalidateCache,
  warmCache,
  cacheHealthCheck
}