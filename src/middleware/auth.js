import { verifyAccessToken } from '../utils/jwt.js'
import { getPrismaClient } from '../config/database.js'
import { authErrors, commonErrors } from '../utils/responses.js'
import { hasPermission } from '../schemas/auth.schema.js'
import logger from '../config/logger.js'

const prisma = getPrismaClient()

// Authenticate user with JWT
export async function authenticateUser(req, res, next) {
  try {
    console.log('🔐 AUTH MIDDLEWARE - Headers:', req.headers)
    const authHeader = req.headers.authorization
    console.log('🔐 AUTH MIDDLEWARE - Auth Header:', authHeader)
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ AUTH MIDDLEWARE - No valid auth header')
      return res.status(401).json(authErrors.tokenRequired())
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    console.log('🔐 AUTH MIDDLEWARE - Token extracted:', token.substring(0, 20) + '...')
    
    const tokenVerification = verifyAccessToken(token)
    console.log('🔐 AUTH MIDDLEWARE - Token verification:', tokenVerification)
    if (!tokenVerification.success) {
      console.log('❌ AUTH MIDDLEWARE - Token verification failed')
      return res.status(401).json(authErrors.invalidToken())
    }

    const { decoded } = tokenVerification
    console.log('🔐 AUTH MIDDLEWARE - Token decoded:', decoded)

    // Get fresh user data from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        role: true,
        active: true,
        emailVerified: true,
        phoneVerified: true,
        avatar: true,
        address: true,
        preferences: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    console.log('🔐 AUTH MIDDLEWARE - User found:', user ? user.email : 'NOT FOUND')

    if (!user) {
      console.log('❌ AUTH MIDDLEWARE - User not found in database')
      return res.status(401).json(authErrors.userNotFound())
    }

    if (!user.active) {
      console.log('❌ AUTH MIDDLEWARE - User is inactive')
      return res.status(401).json(authErrors.userInactive())
    }

    console.log('✅ AUTH MIDDLEWARE - User authenticated successfully:', { id: user.id, email: user.email, role: user.role })
    // Attach user to request
    req.user = user
    next()
  } catch (error) {
    console.log('❌ AUTH MIDDLEWARE - Error:', error.message)
    logger.error('Authentication error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

// Optional authentication (for routes that work with or without auth)
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No authentication provided, continue without user
      req.user = null
      return next()
    }

    // Try to authenticate, but don't fail if it doesn't work
    await authenticateUser(req, res, (error) => {
      if (error) {
        // Authentication failed, but continue without user
        req.user = null
      }
      next()
    })
  } catch (error) {
    // Silent fail for optional auth
    req.user = null
    next()
  }
}

// Require specific role
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    console.log('🔑 AUTHORIZE MIDDLEWARE - Required roles:', allowedRoles)
    console.log('🔑 AUTHORIZE MIDDLEWARE - User role:', req.user?.role)
    console.log('🔑 AUTHORIZE MIDDLEWARE - User:', req.user)
    
    if (!req.user) {
      console.log('❌ AUTHORIZE - No user in request')
      return res.status(401).json(authErrors.tokenRequired())
    }

    if (!allowedRoles.includes(req.user.role)) {
      console.log('❌ AUTHORIZE - Role not allowed:', req.user.role, 'not in', allowedRoles)
      return res.status(403).json(authErrors.insufficientPermissions())
    }

    console.log('✅ AUTHORIZE - Access granted')
    next()
  }
}

// Require specific permission
export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(authErrors.tokenRequired())
    }

    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json(authErrors.insufficientPermissions())
    }

    next()
  }
}

// Admin only middleware
export const requireAdmin = requireRole('ADMIN')

// Customer or Admin middleware
export const requireCustomerOrAdmin = requireRole('CUSTOMER', 'ADMIN')

// Check if user owns resource or is admin
export function requireOwnershipOrAdmin(getUserIdFromRequest) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(authErrors.tokenRequired())
    }

    // Admin can access any resource
    if (req.user.role === 'ADMIN') {
      return next()
    }

    // Check if user owns the resource
    const resourceUserId = getUserIdFromRequest(req)
    if (req.user.id !== resourceUserId) {
      return res.status(403).json(authErrors.insufficientPermissions())
    }

    next()
  }
}

// Middleware to check if user can access specific order
export async function requireOrderAccess(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json(authErrors.tokenRequired())
    }

    // Admin can access any order
    if (req.user.role === 'ADMIN') {
      return next()
    }

    const orderId = req.params.id || req.params.orderId
    if (!orderId) {
      return res.status(400).json(commonErrors.badRequest('Order ID required'))
    }

    // Check if order belongs to user (by phone number)
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { customerPhone: true, userId: true },
    })

    if (!order) {
      return res.status(404).json(commonErrors.notFound('Order'))
    }

    // Allow access if order belongs to user (by user ID or phone)
    if (order.userId === req.user.id || order.customerPhone === req.user.phone) {
      return next()
    }

    return res.status(403).json(authErrors.insufficientPermissions())
  } catch (error) {
    logger.error('Order access check error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

// Rate limiting for sensitive operations
export function rateLimitSensitive(req, res, next) {
  // This would integrate with express-rate-limit
  // For now, just pass through
  next()
}

export default {
  authenticateUser,
  optionalAuth,
  requireRole,
  requirePermission,
  requireAdmin,
  requireCustomerOrAdmin,
  requireOwnershipOrAdmin,
  requireOrderAccess,
  rateLimitSensitive,
}