import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import {
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
} from '../controllers/auth.controller.js'
import { authenticateUser, optionalAuth } from '../middleware/auth.js'
import { validateBody, sanitizeInput } from '../middleware/validation.js'
import {
  LoginSchema,
  RegisterSchema,
  RefreshTokenSchema,
  UpdateProfileSchema,
  ChangePasswordSchema,
  ResetPasswordSchema,
  ConfirmResetPasswordSchema,
  GuestCheckoutSchema,
} from '../schemas/auth.schema.js'

const router = Router()

// Rate limiting for authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiados intentos de autenticación. Intenta nuevamente en 15 minutos.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
})

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 registration attempts per hour
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiados intentos de registro. Intenta nuevamente en 1 hora.',
    },
  },
})

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit password reset requests
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiados intentos de restablecimiento. Intenta nuevamente en 1 hora.',
    },
  },
})

// Apply sanitization to all routes
router.use(sanitizeInput)

/**
 * @route POST /api/v1/auth/login
 * @desc Login user with email/phone and password
 * @access Public
 */
router.post('/login', 
  authLimiter,
  validateBody(LoginSchema),
  login
)

/**
 * @route POST /api/v1/auth/register
 * @desc Register new user account
 * @access Public
 */
router.post('/register',
  registerLimiter,
  validateBody(RegisterSchema),
  register
)

/**
 * @route POST /api/v1/auth/logout
 * @desc Logout user and invalidate refresh tokens
 * @access Public (but can work with auth for better cleanup)
 */
router.post('/logout',
  optionalAuth,
  logout
)

/**
 * @route POST /api/v1/auth/refresh
 * @desc Refresh access token using refresh token
 * @access Public
 */
router.post('/refresh',
  validateBody(RefreshTokenSchema),
  refreshToken
)

/**
 * @route GET /api/v1/auth/profile
 * @desc Get current user profile
 * @access Private
 */
router.get('/profile',
  authenticateUser,
  getProfile
)

/**
 * @route PUT /api/v1/auth/profile
 * @desc Update user profile
 * @access Private
 */
router.put('/profile',
  authenticateUser,
  validateBody(UpdateProfileSchema),
  updateProfile
)

/**
 * @route POST /api/v1/auth/profile/change-password
 * @desc Change user password
 * @access Private
 */
router.post('/profile/change-password',
  authenticateUser,
  validateBody(ChangePasswordSchema),
  changePassword
)

/**
 * @route POST /api/v1/auth/login/reset-password
 * @desc Request password reset email
 * @access Public
 */
router.post('/login/reset-password',
  passwordResetLimiter,
  validateBody(ResetPasswordSchema),
  requestPasswordReset
)

/**
 * @route POST /api/v1/auth/login/confirm-reset
 * @desc Confirm password reset with token
 * @access Public
 */
router.post('/login/confirm-reset',
  validateBody(ConfirmResetPasswordSchema),
  confirmPasswordReset
)

/**
 * @route POST /api/v1/auth/login/guest
 * @desc Create guest session for checkout
 * @access Public
 */
router.post('/login/guest',
  validateBody(GuestCheckoutSchema),
  guestCheckout
)

export default router