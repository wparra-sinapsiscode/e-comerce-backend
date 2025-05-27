import jwt from 'jsonwebtoken'
import { getPrismaClient } from '../config/database.js'
import logger from '../config/logger.js'

const prisma = getPrismaClient()

// Generate access token
export function generateAccessToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    phone: user.phone,
    name: user.name,
    role: user.role,
    type: 'access'
  }

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    issuer: 'ecommerce-api',
    audience: 'ecommerce-app',
  })
}

// Generate refresh token
export async function generateRefreshToken(userId) {
  const payload = {
    userId,
    type: 'refresh'
  }

  const token = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: 'ecommerce-api',
    audience: 'ecommerce-app',
  })

  // Calculate expiration date
  const expiresAt = new Date()
  const expiresInMs = ms(process.env.JWT_REFRESH_EXPIRES_IN || '7d')
  expiresAt.setTime(expiresAt.getTime() + expiresInMs)

  // Store refresh token in database
  try {
    await prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    })
  } catch (error) {
    logger.error('Failed to store refresh token:', error)
    throw new Error('Failed to generate refresh token')
  }

  return token
}

// Verify access token
export function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'ecommerce-api',
      audience: 'ecommerce-app',
    })

    if (decoded.type !== 'access') {
      throw new Error('Invalid token type')
    }

    return { success: true, decoded }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Verify refresh token
export async function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
      issuer: 'ecommerce-api',
      audience: 'ecommerce-app',
    })

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type')
    }

    // Check if token exists in database and is not expired
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!storedToken) {
      throw new Error('Token not found')
    }

    if (storedToken.expiresAt < new Date()) {
      // Remove expired token
      await prisma.refreshToken.delete({
        where: { token },
      })
      throw new Error('Token expired')
    }

    return { success: true, user: storedToken.user }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Invalidate refresh token
export async function invalidateRefreshToken(token) {
  try {
    await prisma.refreshToken.delete({
      where: { token },
    })
    return { success: true }
  } catch (error) {
    logger.error('Failed to invalidate refresh token:', error)
    return { success: false, error: error.message }
  }
}

// Invalidate all refresh tokens for a user
export async function invalidateAllRefreshTokens(userId) {
  try {
    await prisma.refreshToken.deleteMany({
      where: { userId },
    })
    return { success: true }
  } catch (error) {
    logger.error('Failed to invalidate all refresh tokens:', error)
    return { success: false, error: error.message }
  }
}

// Clean expired refresh tokens (should be run periodically)
export async function cleanExpiredTokens() {
  try {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    })
    
    if (result.count > 0) {
      logger.info(`Cleaned ${result.count} expired refresh tokens`)
    }
    
    return { success: true, cleaned: result.count }
  } catch (error) {
    logger.error('Failed to clean expired tokens:', error)
    return { success: false, error: error.message }
  }
}

// Helper function to parse time strings (like "7d", "15m")
function ms(timeString) {
  const units = {
    's': 1000,
    'm': 1000 * 60,
    'h': 1000 * 60 * 60,
    'd': 1000 * 60 * 60 * 24,
    'w': 1000 * 60 * 60 * 24 * 7,
  }

  const match = timeString.match(/^(\d+)([smhdw])$/)
  if (!match) {
    throw new Error(`Invalid time format: ${timeString}`)
  }

  const [, number, unit] = match
  return parseInt(number) * units[unit]
}

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  invalidateRefreshToken,
  invalidateAllRefreshTokens,
  cleanExpiredTokens,
}