import { z } from 'zod'

// Payment method enum
export const PaymentMethodEnum = z.enum([
  'TRANSFER',
  'YAPE',
  'PLIN',
  'CASH'
])

// Payment status enum
export const PaymentStatusEnum = z.enum([
  'PENDING',
  'VERIFIED',
  'REJECTED'
])

// Create payment schema
export const CreatePaymentSchema = z.object({
  order_id: z.string()
    .min(1, 'Order ID is required')
    .max(50, 'Order ID must be at most 50 characters'),
  method: PaymentMethodEnum,
  reference_number: z.string()
    .min(1, 'Reference number is required for electronic payments')
    .max(100, 'Reference number must be at most 100 characters')
    .optional()
    .or(z.literal('')),
  amount: z.number()
    .positive('Amount must be positive')
    .optional(),
  voucher: z.string()
    .optional()
    .nullable() // Base64 image data
})

// Verify payment schema
export const VerifyPaymentSchema = z.object({
  status: z.enum(['VERIFIED', 'REJECTED']),
  verification_notes: z.string()
    .max(1000, 'Verification notes must be at most 1000 characters')
    .optional()
    .or(z.literal('')),
  rejected_reason: z.string()
    .min(5, 'Rejection reason must be at least 5 characters')
    .max(500, 'Rejection reason must be at most 500 characters')
    .optional()
    .or(z.literal(''))
}).refine((data) => {
  // If status is REJECTED, rejected_reason should be provided
  if (data.status === 'REJECTED' && (!data.rejected_reason || data.rejected_reason.trim() === '')) {
    return false
  }
  return true
}, {
  message: 'Rejection reason is required when rejecting a payment',
  path: ['rejected_reason']
})

// Payment query schema (for filtering)
export const PaymentQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  status: PaymentStatusEnum.optional(),
  method: PaymentMethodEnum.optional(),
  search: z.string().max(100).optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  sort_by: z.enum(['createdAt', 'date', 'amount', 'customerName']).optional(),
  sort_order: z.enum(['asc', 'desc']).optional()
})

// Payment ID param schema
export const PaymentIdParamSchema = z.object({
  id: z.string()
    .min(1, 'Payment ID is required')
    .max(50, 'Payment ID must be at most 50 characters')
})

// Order ID param schema
export const OrderIdParamSchema = z.object({
  orderId: z.string()
    .min(1, 'Order ID is required')
    .max(50, 'Order ID must be at most 50 characters')
})

// Payment method query schema
export const PaymentMethodQuerySchema = z.object({
  method: PaymentMethodEnum.optional()
})

// File upload validation schema
export const UploadVoucherSchema = z.object({
  payment_id: z.string()
    .min(1, 'Payment ID is required')
    .max(50, 'Payment ID must be at most 50 characters')
})

/**
 * Validation functions
 */

export function validateCreatePayment(data) {
  try {
    const result = CreatePaymentSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.errors }
  }
}

export function validateVerifyPayment(data) {
  try {
    const result = VerifyPaymentSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.errors }
  }
}

export function validatePaymentQuery(data) {
  try {
    const result = PaymentQuerySchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.errors }
  }
}

export function validatePaymentIdParam(data) {
  try {
    const result = PaymentIdParamSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.errors }
  }
}

export function validateOrderIdParam(data) {
  try {
    const result = OrderIdParamSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.errors }
  }
}

export function validatePaymentMethodQuery(data) {
  try {
    const result = PaymentMethodQuerySchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.errors }
  }
}

export function validateUploadVoucher(data) {
  try {
    const result = UploadVoucherSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.errors }
  }
}

/**
 * Format payment response for API
 */
export function formatPaymentResponse(payment) {
  return {
    id: payment.id,
    order_id: payment.orderId || payment.order_id,
    customer_name: payment.customerName || payment.customer_name,
    customer_phone: payment.customerPhone || payment.customer_phone,
    date: payment.date,
    amount: parseFloat(payment.amount),
    method: payment.method,
    status: payment.status,
    voucher: payment.voucher,
    voucher_file_name: payment.voucherFileName || payment.voucher_file_name,
    reference_number: payment.referenceNumber || payment.reference_number,
    verification_notes: payment.verificationNotes || payment.verification_notes,
    verified_by: payment.verifiedBy || payment.verified_by,
    verified_at: payment.verifiedAt || payment.verified_at,
    rejected_reason: payment.rejectedReason || payment.rejected_reason,
    created_at: payment.createdAt || payment.created_at,
    updated_at: payment.updatedAt || payment.updated_at,
    order: payment.order
  }
}

/**
 * Business validation helpers
 */

export function validatePaymentAmount(paymentAmount, orderTotal) {
  const tolerance = 0.01 // 1 cent tolerance for rounding differences
  return Math.abs(paymentAmount - orderTotal) <= tolerance
}

export function isValidReferenceNumber(method, referenceNumber) {
  // Reference number validation based on payment method
  switch (method) {
    case 'YAPE':
    case 'PLIN':
      // Should be 6-12 digits for mobile payments
      return /^\d{6,12}$/.test(referenceNumber)
    case 'TRANSFER':
      // Can be alphanumeric for bank transfers
      return /^[A-Za-z0-9]{6,20}$/.test(referenceNumber)
    case 'CASH':
      // No reference number needed for cash
      return true
    default:
      return false
  }
}

export function getPaymentMethodRequirements(method) {
  const requirements = {
    YAPE: {
      requires_reference: true,
      requires_voucher: true,
      account_info: 'Yape account number',
      validation_time: '5-10 minutes'
    },
    PLIN: {
      requires_reference: true,
      requires_voucher: true,
      account_info: 'Plin account number',
      validation_time: '5-10 minutes'
    },
    TRANSFER: {
      requires_reference: true,
      requires_voucher: true,
      account_info: 'Bank account details',
      validation_time: '1-24 hours'
    },
    CASH: {
      requires_reference: false,
      requires_voucher: false,
      account_info: 'Pay on delivery',
      validation_time: 'Immediate'
    }
  }

  return requirements[method] || null
}

export default {
  PaymentMethodEnum,
  PaymentStatusEnum,
  CreatePaymentSchema,
  VerifyPaymentSchema,
  PaymentQuerySchema,
  PaymentIdParamSchema,
  OrderIdParamSchema,
  PaymentMethodQuerySchema,
  UploadVoucherSchema,
  validateCreatePayment,
  validateVerifyPayment,
  validatePaymentQuery,
  validatePaymentIdParam,
  validateOrderIdParam,
  validatePaymentMethodQuery,
  validateUploadVoucher,
  formatPaymentResponse,
  validatePaymentAmount,
  isValidReferenceNumber,
  getPaymentMethodRequirements
}