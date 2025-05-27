/**
 * Standardized API response utilities
 */

// Success response
export function successResponse(data = null, message = 'Success', meta = null) {
  const response = {
    success: true,
    data,
    message,
  }

  if (meta) {
    response.meta = meta
  }

  return response
}

// Error response
export function errorResponse(message = 'An error occurred', code = 'INTERNAL_ERROR', details = null) {
  const response = {
    success: false,
    error: {
      code,
      message,
    },
  }

  if (details) {
    response.error.details = details
  }

  return response
}

// Validation error response
export function validationErrorResponse(errors, message = 'Validation failed') {
  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message,
      details: errors,
    },
  }
}

// Paginated response
export function paginatedResponse(data, pagination) {
  return {
    success: true,
    data,
    meta: {
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: Math.ceil(pagination.total / pagination.limit),
        hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit),
        hasPrev: pagination.page > 1,
      },
    },
  }
}

// Authentication error responses
export const authErrors = {
  invalidCredentials: () => errorResponse('Invalid email/phone or password', 'INVALID_CREDENTIALS'),
  userNotFound: () => errorResponse('User not found', 'USER_NOT_FOUND'),
  userInactive: () => errorResponse('User account is inactive', 'USER_INACTIVE'),
  emailExists: () => errorResponse('Email already exists', 'EMAIL_EXISTS'),
  phoneExists: () => errorResponse('Phone number already exists', 'PHONE_EXISTS'),
  invalidToken: () => errorResponse('Invalid or expired token', 'INVALID_TOKEN'),
  tokenRequired: () => errorResponse('Authentication token required', 'TOKEN_REQUIRED'),
  refreshTokenInvalid: () => errorResponse('Invalid refresh token', 'REFRESH_TOKEN_INVALID'),
  insufficientPermissions: () => errorResponse('Insufficient permissions', 'INSUFFICIENT_PERMISSIONS'),
}

// Common error responses
export const commonErrors = {
  notFound: (resource = 'Resource') => errorResponse(`${resource} not found`, 'NOT_FOUND'),
  forbidden: () => errorResponse('Access forbidden', 'FORBIDDEN'),
  badRequest: (message = 'Bad request') => errorResponse(message, 'BAD_REQUEST'),
  conflict: (message = 'Resource conflict') => errorResponse(message, 'CONFLICT'),
  internalError: () => errorResponse('Internal server error', 'INTERNAL_ERROR'),
  serviceUnavailable: () => errorResponse('Service temporarily unavailable', 'SERVICE_UNAVAILABLE'),
  rateLimitExceeded: () => errorResponse('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED'),
}

// Database error responses
export const dbErrors = {
  connectionFailed: () => errorResponse('Database connection failed', 'DB_CONNECTION_FAILED'),
  queryFailed: () => errorResponse('Database query failed', 'DB_QUERY_FAILED'),
  constraintViolation: () => errorResponse('Database constraint violation', 'DB_CONSTRAINT_VIOLATION'),
  uniqueConstraintViolation: (field) => errorResponse(`${field} already exists`, 'UNIQUE_CONSTRAINT_VIOLATION'),
}

// File upload error responses
export const uploadErrors = {
  fileTooLarge: (maxSize) => errorResponse(`File too large. Max size: ${maxSize}`, 'FILE_TOO_LARGE'),
  invalidFileType: (allowedTypes) => errorResponse(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`, 'INVALID_FILE_TYPE'),
  uploadFailed: () => errorResponse('File upload failed', 'UPLOAD_FAILED'),
  fileRequired: () => errorResponse('File is required', 'FILE_REQUIRED'),
}

// Business logic error responses
export const businessErrors = {
  insufficientStock: () => errorResponse('Insufficient stock', 'INSUFFICIENT_STOCK'),
  orderNotFound: () => errorResponse('Order not found', 'ORDER_NOT_FOUND'),
  paymentFailed: () => errorResponse('Payment failed', 'PAYMENT_FAILED'),
  invalidOrderStatus: () => errorResponse('Invalid order status transition', 'INVALID_ORDER_STATUS'),
  productInactive: () => errorResponse('Product is not available', 'PRODUCT_INACTIVE'),
  categoryInactive: () => errorResponse('Category is not available', 'CATEGORY_INACTIVE'),
}

export default {
  successResponse,
  errorResponse,
  validationErrorResponse,
  paginatedResponse,
  authErrors,
  commonErrors,
  dbErrors,
  uploadErrors,
  businessErrors,
}