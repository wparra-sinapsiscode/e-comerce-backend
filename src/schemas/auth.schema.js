import { z } from 'zod'

// User role enum
export const UserRoleSchema = z.enum(['ADMIN', 'CUSTOMER', 'DELIVERY'])

// User schema (database model compatible)
export const UserSchema = z.object({
  id: z.number().int().positive(),
  email: z.string().email('Email inválido'),
  phone: z.string().min(9, 'Teléfono debe tener al menos 9 dígitos').max(15),
  name: z.string().min(1, 'Nombre requerido').max(100),
  password: z.string().min(6, 'Contraseña debe tener al menos 6 caracteres'),
  role: UserRoleSchema,
  active: z.boolean().default(true),
  emailVerified: z.boolean().default(false),
  phoneVerified: z.boolean().default(false),
  avatar: z.string().url().optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  preferences: z.object({
    notifications: z.boolean().default(true),
    marketing_emails: z.boolean().default(false),
    language: z.enum(['es', 'en']).default('es'),
  }).optional().nullable(),
  lastLogin: z.date().optional().nullable(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

// Public user schema (no password)
export const PublicUserSchema = UserSchema.omit({ password: true })

// Login schemas
export const LoginSchema = z.object({
  email: z.string().email('Email inválido').optional(),
  phone: z.string().min(9, 'Teléfono inválido').optional(),
  password: z.string().min(1, 'Contraseña requerida'),
  admin: z.boolean().optional(), // Flag for admin login
}).refine(data => data.email || data.phone, {
  message: 'Email o teléfono requerido',
  path: ['email'],
})

// Registration schemas
export const RegisterSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(100),
  email: z.string().email('Email inválido'),
  phone: z.string().min(9, 'Teléfono inválido').max(15),
  password: z.string().min(6, 'Contraseña debe tener al menos 6 caracteres'),
  confirm_password: z.string(),
  address: z.string().min(10, 'Dirección debe tener al menos 10 caracteres').max(200).optional(),
  accept_terms: z.boolean().refine(val => val === true, {
    message: 'Debes aceptar los términos y condiciones',
  }),
}).refine(data => data.password === data.confirm_password, {
  message: 'Las contraseñas no coinciden',
  path: ['confirm_password'],
})

// Guest checkout schema
export const GuestCheckoutSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(100),
  phone: z.string().min(9, 'Teléfono inválido').max(15),
  email: z.string().email('Email inválido').optional(),
  address: z.string().min(10, 'Dirección requerida').max(200),
})

// Password schemas
export const ChangePasswordSchema = z.object({
  current_password: z.string().min(1, 'Contraseña actual requerida'),
  new_password: z.string().min(6, 'Nueva contraseña debe tener al menos 6 caracteres'),
  confirm_password: z.string(),
}).refine(data => data.new_password === data.confirm_password, {
  message: 'Las contraseñas no coinciden',
  path: ['confirm_password'],
})

export const ResetPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
})

export const ConfirmResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
  password: z.string().min(6, 'Contraseña debe tener al menos 6 caracteres'),
  confirm_password: z.string(),
}).refine(data => data.password === data.confirm_password, {
  message: 'Las contraseñas no coinciden',
  path: ['confirm_password'],
})

// Profile update schema
export const UpdateProfileSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(100).optional(),
  email: z.string().email('Email inválido').optional(),
  phone: z.string().min(9, 'Teléfono inválido').max(15).optional(),
  address: z.string().max(200).optional().nullable(),
  avatar: z.string().url().optional().nullable(),
  preferences: z.object({
    notifications: z.boolean().optional(),
    marketing_emails: z.boolean().optional(),
    language: z.enum(['es', 'en']).optional(),
  }).optional(),
})

// Token schemas
export const TokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  token_type: z.string().default('Bearer'),
  expires_in: z.number().int().positive(),
  user: PublicUserSchema,
})

export const RefreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token requerido'),
})

// User permissions
export const USER_PERMISSIONS = {
  ADMIN: [
    'products:read',
    'products:write', 
    'products:delete',
    'categories:read',
    'categories:write',
    'categories:delete',
    'orders:read',
    'orders:write',
    'orders:update_status',
    'payments:read',
    'payments:verify',
    'dashboard:access',
    'users:read',
    'users:write',
  ],
  CUSTOMER: [
    'products:read',
    'categories:read',
    'orders:read_own',
    'orders:create',
    'profile:read',
    'profile:write',
  ],
  DELIVERY: [
    'orders:read_assigned',
    'orders:update_delivery_status',
    'profile:read',
    'profile:write',
  ],
}

// Validation helpers
export const validateLogin = (data) => {
  try {
    return { success: true, data: LoginSchema.parse(data), error: null }
  } catch (error) {
    return { success: false, data: null, error: error.errors }
  }
}

export const validateRegister = (data) => {
  try {
    return { success: true, data: RegisterSchema.parse(data), error: null }
  } catch (error) {
    return { success: false, data: null, error: error.errors }
  }
}

export const validateGuestCheckout = (data) => {
  try {
    return { success: true, data: GuestCheckoutSchema.parse(data), error: null }
  } catch (error) {
    return { success: false, data: null, error: error.errors }
  }
}

export const validateUpdateProfile = (data) => {
  try {
    return { success: true, data: UpdateProfileSchema.parse(data), error: null }
  } catch (error) {
    return { success: false, data: null, error: error.errors }
  }
}

export const validateChangePassword = (data) => {
  try {
    return { success: true, data: ChangePasswordSchema.parse(data), error: null }
  } catch (error) {
    return { success: false, data: null, error: error.errors }
  }
}

// Helper functions
export const hasPermission = (userRole, permission) => {
  const permissions = USER_PERMISSIONS[userRole] || []
  return permissions.includes(permission)
}

export const formatPhone = (phone) => {
  // Format to standard Peruvian format
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('51')) {
    return '+' + cleaned
  }
  if (cleaned.startsWith('9') && cleaned.length === 9) {
    return '+51' + cleaned
  }
  return phone
}

export const isValidPhone = (phone) => {
  // Peruvian phone validation
  const phoneRegex = /^(\+51|51)?[9]\d{8}$/
  return phoneRegex.test(phone.replace(/\s+/g, ''))
}

export default {
  UserSchema,
  PublicUserSchema,
  LoginSchema,
  RegisterSchema,
  GuestCheckoutSchema,
  ChangePasswordSchema,
  UpdateProfileSchema,
  TokenResponseSchema,
  RefreshTokenSchema,
  validateLogin,
  validateRegister,
  validateGuestCheckout,
  validateUpdateProfile,
  validateChangePassword,
  hasPermission,
  formatPhone,
  isValidPhone,
  USER_PERMISSIONS,
}