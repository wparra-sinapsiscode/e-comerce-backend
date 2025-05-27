import { z } from 'zod'

// Order status enum
export const OrderStatusEnum = z.enum([
  'AWAITING_PAYMENT',
  'PREPARING', 
  'READY_FOR_SHIPPING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED'
])

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

// Order item schema
export const OrderItemSchema = z.object({
  product_id: z.number().int().positive('Product ID must be a positive integer'),
  presentation_id: z.number().int().positive().optional(),
  quantity: z.number().positive('Quantity must be positive'),
})

// Create order schema
export const CreateOrderSchema = z.object({
  customer_name: z.string()
    .min(2, 'Customer name must be at least 2 characters')
    .max(100, 'Customer name must be at most 100 characters')
    .trim(),
  customer_phone: z.string()
    .min(9, 'Phone number must be at least 9 characters')
    .max(15, 'Phone number must be at most 15 characters')
    .regex(/^\+?[1-9]\d{8,14}$/, 'Invalid phone number format')
    .trim(),
  customer_email: z.string()
    .email('Invalid email format')
    .max(150, 'Email must be at most 150 characters')
    .optional()
    .or(z.literal('')),
  customer_address: z.string()
    .min(10, 'Address must be at least 10 characters')
    .max(500, 'Address must be at most 500 characters')
    .trim(),
  payment_method: PaymentMethodEnum,
  notes: z.string()
    .max(1000, 'Notes must be at most 1000 characters')
    .optional()
    .or(z.literal('')),
  delivery_date: z.string()
    .datetime()
    .optional()
    .or(z.literal('')),
  delivery_notes: z.string()
    .max(500, 'Delivery notes must be at most 500 characters')
    .optional()
    .or(z.literal('')),
  items: z.array(OrderItemSchema)
    .min(1, 'Order must contain at least one item')
    .max(50, 'Order cannot contain more than 50 items')
})

// Update order status schema
export const UpdateOrderStatusSchema = z.object({
  status: OrderStatusEnum,
  notes: z.string()
    .max(500, 'Notes must be at most 500 characters')
    .optional()
    .or(z.literal(''))
})

// Order query schema (for filtering)
export const OrderQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  status: OrderStatusEnum.optional(),
  payment_status: PaymentStatusEnum.optional(),
  payment_method: PaymentMethodEnum.optional(),
  search: z.string().max(100).optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  sort_by: z.enum(['createdAt', 'date', 'total', 'customerName']).optional(),
  sort_order: z.enum(['asc', 'desc']).optional()
})

// Cancel order schema
export const CancelOrderSchema = z.object({
  reason: z.string()
    .min(5, 'Cancellation reason must be at least 5 characters')
    .max(500, 'Cancellation reason must be at most 500 characters')
    .optional()
    .or(z.literal(''))
})

// Phone validation schema
export const PhoneParamSchema = z.object({
  phone: z.string()
    .min(9, 'Phone number must be at least 9 characters')
    .max(15, 'Phone number must be at most 15 characters')
    .regex(/^\+?[1-9]\d{8,14}$/, 'Invalid phone number format')
})

// Status param schema
export const StatusParamSchema = z.object({
  status: OrderStatusEnum
})

// Order ID param schema
export const OrderIdParamSchema = z.object({
  id: z.string()
    .min(1, 'Order ID is required')
    .max(50, 'Order ID must be at most 50 characters')
})

/**
 * Validation functions
 */

export function validateCreateOrder(data) {
  try {
    const result = CreateOrderSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.errors }
  }
}

export function validateUpdateOrderStatus(data) {
  try {
    const result = UpdateOrderStatusSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.errors }
  }
}

export function validateOrderQuery(data) {
  try {
    const result = OrderQuerySchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.errors }
  }
}

export function validateCancelOrder(data) {
  try {
    const result = CancelOrderSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.errors }
  }
}

export function validatePhoneParam(data) {
  try {
    const result = PhoneParamSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.errors }
  }
}

export function validateStatusParam(data) {
  try {
    const result = StatusParamSchema.parse(data)
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

/**
 * Format order response for API
 */
export function formatOrderResponse(order) {
  return {
    id: order.id,
    customer_name: order.customerName || order.customer_name,
    customer_phone: order.customerPhone || order.customer_phone,
    customer_email: order.customerEmail || order.customer_email,
    customer_address: order.customerAddress || order.customer_address,
    user_id: order.userId || order.user_id,
    date: order.date,
    status: order.status,
    payment_method: order.paymentMethod || order.payment_method,
    payment_status: order.paymentStatus || order.payment_status,
    subtotal: parseFloat(order.subtotal),
    tax: parseFloat(order.tax),
    total: parseFloat(order.total),
    notes: order.notes,
    delivery_date: order.deliveryDate || order.delivery_date,
    delivery_notes: order.deliveryNotes || order.delivery_notes,
    created_at: order.createdAt || order.created_at,
    updated_at: order.updatedAt || order.updated_at,
    items: order.items,
    user: order.user,
    payments: order.payments,
    status_history: order.statusHistory || order.status_history
  }
}

export default {
  OrderStatusEnum,
  PaymentMethodEnum,
  PaymentStatusEnum,
  OrderItemSchema,
  CreateOrderSchema,
  UpdateOrderStatusSchema,
  OrderQuerySchema,
  CancelOrderSchema,
  PhoneParamSchema,
  StatusParamSchema,
  OrderIdParamSchema,
  validateCreateOrder,
  validateUpdateOrderStatus,
  validateOrderQuery,
  validateCancelOrder,
  validatePhoneParam,
  validateStatusParam,
  validateOrderIdParam,
  formatOrderResponse
}