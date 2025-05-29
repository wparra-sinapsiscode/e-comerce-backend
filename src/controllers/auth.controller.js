import bcrypt from 'bcryptjs'
import { getPrismaClient } from '../config/database.js'
import { 
  generateAccessToken, 
  generateRefreshToken, 
  verifyRefreshToken,
  invalidateRefreshToken,
  invalidateAllRefreshTokens 
} from '../utils/jwt.js'
import {
  successResponse,
  authErrors,
  commonErrors,
  dbErrors,
} from '../utils/responses.js'
import {
  validateLogin,
  validateRegister,
  validateGuestCheckout,
  validateUpdateProfile,
  validateChangePassword,
  formatPhone,
} from '../schemas/auth.schema.js'
import logger from '../config/logger.js'

const prisma = getPrismaClient()

/**
 * Login user with email/phone and password
 */
export async function login(req, res) {
  try {
    console.log('🔐 Login attempt with data:', JSON.stringify(req.body, null, 2))
    
    const validation = validateLogin(req.body)
    if (!validation.success) {
      console.log('❌ Login validation failed:', JSON.stringify(validation.error, null, 2))
      return res.status(400).json({
        success: false,
        error: { type: 'validation', errors: validation.error }
      })
    }

    const { email, phone, password, admin } = validation.data
    console.log('✅ Login validated data:', JSON.stringify({ email, phone, admin, hasPassword: !!password }, null, 2))

    // Find user by email or phone
    const whereClause = email ? { email } : { phone: formatPhone(phone) }
    console.log('🔍 Looking for user with:', JSON.stringify(whereClause, null, 2))
    
    const user = await prisma.user.findUnique({
      where: whereClause,
    })
    
    console.log('👤 User found:', user ? JSON.stringify({ id: user.id, email: user.email, role: user.role, active: user.active }, null, 2) : 'NOT FOUND')

    if (!user) {
      return res.status(401).json(authErrors.invalidCredentials())
    }

    // Check if user is active
    if (!user.active) {
      return res.status(401).json(authErrors.userInactive())
    }

    // For admin login, verify admin role
    if (admin && user.role !== 'ADMIN') {
      return res.status(403).json(authErrors.insufficientPermissions())
    }

    // Verify password
    console.log('🔑 Verifying password...')
    const isPasswordValid = await bcrypt.compare(password, user.password)
    console.log('🔑 Password valid:', isPasswordValid)
    if (!isPasswordValid) {
      console.log('❌ Password verification failed')
      return res.status(401).json(authErrors.invalidCredentials())
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    })

    // Generate tokens
    const accessToken = generateAccessToken(user)
    const refreshToken = await generateRefreshToken(user.id)

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user

    // Convert database format to frontend format
    const responseUser = {
      ...userWithoutPassword,
      email_verified: user.emailVerified,
      phone_verified: user.phoneVerified,
      last_login: user.lastLogin,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    }

    logger.info(`User logged in: ${user.email}`)

    res.json(successResponse({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 15 * 60, // 15 minutes in seconds
      user: responseUser,
    }))
  } catch (error) {
    logger.error('Login error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Register new user
 */
export async function register(req, res) {
  try {
    console.log('🔵 REGISTRO CLIENTE - Iniciando...')
    console.log('🔵 REGISTRO CLIENTE - Datos recibidos:', {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      role: req.body.role || 'CUSTOMER (default)',
      hasAddress: !!req.body.address
    })
    
    const validation = validateRegister(req.body)
    if (!validation.success) {
      console.log('🔴 REGISTRO CLIENTE - Validación fallida:', validation.error)
      return res.status(400).json({
        success: false,
        error: { type: 'validation', errors: validation.error }
      })
    }

    const { name, email, phone, password, address } = validation.data

    // Check if email exists
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    })

    if (existingEmail) {
      return res.status(409).json(authErrors.emailExists())
    }

    // Check if phone exists
    const formattedPhone = formatPhone(phone)
    const existingPhone = await prisma.user.findUnique({
      where: { phone: formattedPhone },
    })

    if (existingPhone) {
      return res.status(409).json(authErrors.phoneExists())
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone: formattedPhone,
        password: hashedPassword,
        address,
        role: 'CUSTOMER',
        preferences: {
          notifications: true,
          marketing_emails: false,
          language: 'es'
        },
      },
    })

    console.log('✅ REGISTRO CLIENTE - Usuario creado:', {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      active: user.active
    })

    // Generate tokens
    const accessToken = generateAccessToken(user)
    const refreshToken = await generateRefreshToken(user.id)
    
    console.log('🔵 REGISTRO CLIENTE - Tokens generados, preparando respuesta')

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user

    // Convert database format to frontend format
    const responseUser = {
      ...userWithoutPassword,
      email_verified: user.emailVerified,
      phone_verified: user.phoneVerified,
      last_login: user.lastLogin,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    }

    console.log('🔵 REGISTRO CLIENTE - Enviando respuesta, redirigiendo a:', 
      user.role === 'ADMIN' ? '/admin' : '/store'
    )
    
    logger.info(`User registered: ${user.email}`)

    res.status(201).json(successResponse({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 15 * 60, // 15 minutes in seconds
      user: responseUser,
    }))
  } catch (error) {
    logger.error('Registration error:', error)
    
    // Handle unique constraint violations
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0]
      if (field === 'email') {
        return res.status(409).json(authErrors.emailExists())
      } else if (field === 'phone') {
        return res.status(409).json(authErrors.phoneExists())
      }
    }
    
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Logout user (invalidate refresh token)
 */
export async function logout(req, res) {
  try {
    const authHeader = req.headers.authorization
    if (authHeader) {
      // If user is authenticated, invalidate all their refresh tokens
      if (req.user) {
        await invalidateAllRefreshTokens(req.user.id)
        logger.info(`User logged out: ${req.user.email}`)
      }
    }

    res.json(successResponse(null, 'Logged out successfully'))
  } catch (error) {
    logger.error('Logout error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Refresh access token
 */
export async function refreshToken(req, res) {
  try {
    const { refresh_token } = req.body

    if (!refresh_token) {
      return res.status(400).json(authErrors.refreshTokenInvalid())
    }

    const tokenVerification = await verifyRefreshToken(refresh_token)
    if (!tokenVerification.success) {
      return res.status(401).json(authErrors.refreshTokenInvalid())
    }

    const { user } = tokenVerification

    // Check if user is still active
    if (!user.active) {
      await invalidateRefreshToken(refresh_token)
      return res.status(401).json(authErrors.userInactive())
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken(user)
    const newRefreshToken = await generateRefreshToken(user.id)

    // Invalidate old refresh token
    await invalidateRefreshToken(refresh_token)

    res.json(successResponse({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      token_type: 'Bearer',
      expires_in: 15 * 60, // 15 minutes in seconds
    }))
  } catch (error) {
    logger.error('Token refresh error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Get user profile
 */
export async function getProfile(req, res) {
  try {
    const user = req.user

    // Convert database format to frontend format
    const responseUser = {
      ...user,
      email_verified: user.emailVerified,
      phone_verified: user.phoneVerified,
      last_login: user.lastLogin,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    }

    res.json(successResponse({ user: responseUser }))
  } catch (error) {
    logger.error('Get profile error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Update user profile
 */
export async function updateProfile(req, res) {
  try {
    const validation = validateUpdateProfile(req.body)
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { type: 'validation', errors: validation.error }
      })
    }

    const updateData = validation.data
    const userId = req.user.id

    // Check if email is being updated and doesn't exist
    if (updateData.email && updateData.email !== req.user.email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: updateData.email },
      })

      if (existingEmail) {
        return res.status(409).json(authErrors.emailExists())
      }
    }

    // Check if phone is being updated and doesn't exist
    if (updateData.phone && updateData.phone !== req.user.phone) {
      const formattedPhone = formatPhone(updateData.phone)
      const existingPhone = await prisma.user.findUnique({
        where: { phone: formattedPhone },
      })

      if (existingPhone) {
        return res.status(409).json(authErrors.phoneExists())
      }
      
      updateData.phone = formattedPhone
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
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

    // Convert database format to frontend format
    const responseUser = {
      ...updatedUser,
      email_verified: updatedUser.emailVerified,
      phone_verified: updatedUser.phoneVerified,
      last_login: updatedUser.lastLogin,
      created_at: updatedUser.createdAt,
      updated_at: updatedUser.updatedAt,
    }

    logger.info(`Profile updated for user: ${updatedUser.email}`)

    res.json(successResponse({ user: responseUser }))
  } catch (error) {
    logger.error('Update profile error:', error)
    
    // Handle unique constraint violations
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0]
      if (field === 'email') {
        return res.status(409).json(authErrors.emailExists())
      } else if (field === 'phone') {
        return res.status(409).json(authErrors.phoneExists())
      }
    }
    
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Change user password
 */
export async function changePassword(req, res) {
  try {
    const validation = validateChangePassword(req.body)
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { type: 'validation', errors: validation.error }
      })
    }

    const { current_password, new_password } = validation.data
    const userId = req.user.id

    // Get current user with password
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return res.status(404).json(authErrors.userNotFound())
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(current_password, user.password)
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Contraseña actual incorrecta'
        }
      })
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(new_password, 12)

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    })

    // Invalidate all refresh tokens to force re-login on other devices
    await invalidateAllRefreshTokens(userId)

    logger.info(`Password changed for user: ${user.email}`)

    res.json(successResponse(null, 'Contraseña actualizada correctamente'))
  } catch (error) {
    logger.error('Change password error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Request password reset (placeholder for future implementation)
 */
export async function requestPasswordReset(req, res) {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMAIL_REQUIRED', message: 'Email requerido' }
      })
    }

    // TODO: Implement email-based password reset
    // For now, just return success (in production, send email)
    
    logger.info(`Password reset requested for: ${email}`)
    
    res.json(successResponse(null, 'Si el email existe, recibirás instrucciones para restablecer tu contraseña'))
  } catch (error) {
    logger.error('Password reset request error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Confirm password reset (placeholder for future implementation)
 */
export async function confirmPasswordReset(req, res) {
  try {
    // TODO: Implement token-based password reset confirmation
    
    res.status(501).json({
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Función no implementada aún'
      }
    })
  } catch (error) {
    logger.error('Password reset confirmation error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Guest checkout (create temporary session)
 */
export async function guestCheckout(req, res) {
  try {
    const validation = validateGuestCheckout(req.body)
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { type: 'validation', errors: validation.error }
      })
    }

    const guestData = validation.data
    guestData.phone = formatPhone(guestData.phone)

    // Create a temporary session token (short-lived)
    const sessionToken = generateAccessToken({
      id: 0, // Special ID for guests
      email: guestData.email || 'guest@temp.com',
      phone: guestData.phone,
      name: guestData.name,
      role: 'GUEST',
    })

    logger.info(`Guest checkout initiated for: ${guestData.phone}`)

    res.json(successResponse({
      session_token: sessionToken,
      guest_data: guestData,
    }))
  } catch (error) {
    logger.error('Guest checkout error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

export default {
  login,
  register,
  logout,
  refreshToken,
  getProfile,
  updateProfile,
  changePassword,
  requestPasswordReset,
  confirmPasswordReset,
  guestCheckout,
}