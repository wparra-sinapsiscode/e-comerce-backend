import { getPrismaClient } from '../config/database.js'
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  commonErrors,
  businessErrors,
  dbErrors,
} from '../utils/responses.js'
import logger from '../config/logger.js'

const prisma = getPrismaClient()

// Generate unique payment ID
function generatePaymentId() {
  const timestamp = Date.now().toString()
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `PAY-${timestamp.slice(-6)}${random}`
}

// Payment account information
const PAYMENT_ACCOUNTS = {
  YAPE: {
    number: '+51987654321',
    name: 'E-commerce Store',
    qr_code: '/uploads/qr/yape-qr.jpg'
  },
  PLIN: {
    number: '+51987654321',
    name: 'E-commerce Store',
    qr_code: '/uploads/qr/plin-qr.jpg'
  },
  TRANSFER: {
    bank: 'BCP',
    account_number: '1234567890123456',
    cci: '00212345678901234567',
    name: 'E-commerce Store SAC'
  }
}

// Format payment response
function formatPaymentResponse(payment) {
  return {
    id: payment.id,
    order_id: payment.orderId,
    customer_name: payment.customerName,
    customer_phone: payment.customerPhone,
    date: payment.date,
    amount: parseFloat(payment.amount),
    method: payment.method,
    status: payment.status,
    voucher: payment.voucher,
    voucher_file_name: payment.voucherFileName,
    reference_number: payment.referenceNumber,
    verification_notes: payment.verificationNotes,
    verified_by: payment.verifiedBy,
    verified_at: payment.verifiedAt,
    rejected_reason: payment.rejectedReason,
    created_at: payment.createdAt,
    updated_at: payment.updatedAt,
    order: payment.order
  }
}

/**
 * Get all payments (Admin only)
 */
export async function getAll(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      method,
      search,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query

    // Build where clause
    const where = {}
    
    if (status) {
      where.status = status
    }
    
    if (method) {
      where.method = method
    }
    
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
        { id: { contains: search, mode: 'insensitive' } },
        { orderId: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) where.date.gte = new Date(dateFrom)
      if (dateTo) where.date.lte = new Date(dateTo)
    }

    // Build orderBy clause
    const orderBy = {}
    orderBy[sortBy] = sortOrder === 'desc' ? 'desc' : 'asc'

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)

    // Get payments with related data
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          order: {
            select: {
              id: true,
              customerName: true,
              status: true,
              total: true
            }
          }
        }
      }),
      prisma.payment.count({ where })
    ])

    // Format response
    const formattedPayments = payments.map(formatPaymentResponse)

    logger.info(`Retrieved ${payments.length} payments`)

    res.json(paginatedResponse(formattedPayments, {
      page: parseInt(page),
      limit: parseInt(limit),
      total
    }))
  } catch (error) {
    logger.error('Get payments error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Get payment by ID
 */
export async function getById(req, res) {
  try {
    const { id } = req.params

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            items: {
              include: {
                product: true,
                presentation: true
              }
            }
          }
        }
      }
    })

    if (!payment) {
      return res.status(404).json(commonErrors.notFound('Payment'))
    }

    // Check permissions - users can only see their own payments
    if (req.user?.role !== 'ADMIN' && req.user?.id !== payment.order.userId) {
      return res.status(403).json(commonErrors.forbidden())
    }

    logger.info(`Retrieved payment: ${payment.id}`)
    res.json(successResponse(formatPaymentResponse(payment)))
  } catch (error) {
    logger.error('Get payment error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Create new payment for an order
 */
export async function create(req, res) {
  try {
    const {
      order_id,
      method,
      reference_number,
      amount: providedAmount
    } = req.body

    // Validate required fields
    if (!order_id || !method) {
      return res.status(400).json(commonErrors.badRequest('Missing required fields'))
    }

    // Validate payment method
    const validMethods = ['TRANSFER', 'YAPE', 'PLIN', 'CASH']
    if (!validMethods.includes(method)) {
      return res.status(400).json(commonErrors.badRequest('Invalid payment method'))
    }

    // Get order to validate
    const order = await prisma.order.findUnique({
      where: { id: order_id }
    })

    if (!order) {
      return res.status(404).json(commonErrors.notFound('Order'))
    }

    // Check if order already has a payment
    const existingPayment = await prisma.payment.findFirst({
      where: { orderId: order_id }
    })

    if (existingPayment) {
      return res.status(400).json(errorResponse(
        'Order already has a payment',
        'ORDER_ALREADY_HAS_PAYMENT'
      ))
    }

    // Use order amount if not provided
    const amount = providedAmount ? parseFloat(providedAmount) : parseFloat(order.total)

    // Validate amount matches order total (with small tolerance for rounding)
    const orderTotal = parseFloat(order.total)
    if (Math.abs(amount - orderTotal) > 0.01) {
      return res.status(400).json(errorResponse(
        'Payment amount does not match order total',
        'AMOUNT_MISMATCH'
      ))
    }

    // Generate unique payment ID
    const paymentId = generatePaymentId()

    // Create payment
    const payment = await prisma.payment.create({
      data: {
        id: paymentId,
        orderId: order_id,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        amount,
        method,
        referenceNumber: reference_number || null
      },
      include: {
        order: {
          select: {
            id: true,
            customerName: true,
            status: true,
            total: true
          }
        }
      }
    })

    logger.info(`Payment created: ${payment.id} for order ${order_id}`)
    res.status(201).json(successResponse(formatPaymentResponse(payment)))
  } catch (error) {
    logger.error('Create payment error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Get payment by order ID
 */
export async function getByOrderId(req, res) {
  try {
    const { orderId } = req.params

    const payment = await prisma.payment.findFirst({
      where: { orderId },
      include: {
        order: {
          select: {
            id: true,
            customerName: true,
            status: true,
            total: true,
            userId: true
          }
        }
      }
    })

    if (!payment) {
      return res.status(404).json(commonErrors.notFound('Payment'))
    }

    // Check permissions
    if (req.user?.role !== 'ADMIN' && req.user?.id !== payment.order.userId) {
      return res.status(403).json(commonErrors.forbidden())
    }

    logger.info(`Retrieved payment for order: ${orderId}`)
    res.json(successResponse(formatPaymentResponse(payment)))
  } catch (error) {
    logger.error('Get payment by order error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Verify payment (Admin only)
 */
export async function verify(req, res) {
  try {
    const { id } = req.params
    const { status, verification_notes, rejected_reason } = req.body

    // Validate status
    const validStatuses = ['VERIFIED', 'REJECTED']
    if (!validStatuses.includes(status)) {
      return res.status(400).json(commonErrors.badRequest('Invalid verification status'))
    }

    // Check if payment exists
    const existingPayment = await prisma.payment.findUnique({
      where: { id },
      include: {
        order: true
      }
    })

    if (!existingPayment) {
      return res.status(404).json(commonErrors.notFound('Payment'))
    }

    if (existingPayment.status !== 'PENDING') {
      return res.status(400).json(errorResponse(
        'Payment has already been verified or rejected',
        'PAYMENT_ALREADY_PROCESSED'
      ))
    }

    // Update payment in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update payment
      const updatedPayment = await tx.payment.update({
        where: { id },
        data: {
          status,
          verificationNotes: verification_notes,
          verifiedBy: req.user?.email || 'admin',
          verifiedAt: new Date(),
          rejectedReason: status === 'REJECTED' ? rejected_reason : null
        },
        include: {
          order: true
        }
      })

      // If payment is verified, update order payment status to VERIFIED (but keep order status as AWAITING_PAYMENT for double confirmation)
      if (status === 'VERIFIED') {
        await tx.order.update({
          where: { id: existingPayment.orderId },
          data: { 
            paymentStatus: 'VERIFIED'
            // Note: Order status remains AWAITING_PAYMENT until final confirmation
          }
        })

        // Add to order status history
        await tx.orderStatusHistory.create({
          data: {
            orderId: existingPayment.orderId,
            status: 'AWAITING_PAYMENT',
            notes: 'Payment verified - awaiting final confirmation to start preparation',
            updatedBy: req.user?.email || 'admin'
          }
        })
      } else if (status === 'REJECTED') {
        // Update order payment status to rejected
        await tx.order.update({
          where: { id: existingPayment.orderId },
          data: { paymentStatus: 'REJECTED' }
        })
      }

      return updatedPayment
    })

    logger.info(`Payment ${id} ${status.toLowerCase()} by ${req.user?.email}`)
    res.json(successResponse(formatPaymentResponse(result)))
  } catch (error) {
    logger.error('Verify payment error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Upload payment voucher
 */
export async function uploadVoucher(req, res) {
  try {
    const { id } = req.params

    if (!req.file) {
      return res.status(400).json(commonErrors.badRequest('No voucher file uploaded'))
    }

    // Check if payment exists
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        order: {
          select: { userId: true }
        }
      }
    })

    if (!payment) {
      return res.status(404).json(commonErrors.notFound('Payment'))
    }

    // Check permissions
    if (req.user?.role !== 'ADMIN' && req.user?.id !== payment.order.userId) {
      return res.status(403).json(commonErrors.forbidden())
    }

    // Update payment with voucher info
    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: {
        voucher: req.file.path,
        voucherFileName: req.file.originalname
      },
      include: {
        order: {
          select: {
            id: true,
            customerName: true,
            status: true,
            total: true
          }
        }
      }
    })

    logger.info(`Voucher uploaded for payment: ${id}`)
    res.json(successResponse(formatPaymentResponse(updatedPayment)))
  } catch (error) {
    logger.error('Upload voucher error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Get payment information (accounts, QR codes)
 */
export async function getPaymentInfo(req, res) {
  try {
    const { method } = req.query

    if (method && PAYMENT_ACCOUNTS[method]) {
      return res.json(successResponse(PAYMENT_ACCOUNTS[method]))
    }

    // Return all payment methods info
    res.json(successResponse(PAYMENT_ACCOUNTS))
  } catch (error) {
    logger.error('Get payment info error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Get payment statistics (Admin only)
 */
export async function getStats(req, res) {
  try {
    const { period = '30d' } = req.query
    
    // Calculate date range
    let dateFrom = new Date()
    switch (period) {
      case '7d':
        dateFrom.setDate(dateFrom.getDate() - 7)
        break
      case '30d':
        dateFrom.setDate(dateFrom.getDate() - 30)
        break
      case '90d':
        dateFrom.setDate(dateFrom.getDate() - 90)
        break
      case '1y':
        dateFrom.setFullYear(dateFrom.getFullYear() - 1)
        break
      default:
        dateFrom.setDate(dateFrom.getDate() - 30)
    }

    const stats = await Promise.all([
      // Total payments
      prisma.payment.count(),
      // Payments in period
      prisma.payment.count({
        where: { createdAt: { gte: dateFrom } }
      }),
      // Payments by status
      prisma.payment.groupBy({
        by: ['status'],
        _count: { status: true },
        where: { createdAt: { gte: dateFrom } }
      }),
      // Payments by method
      prisma.payment.groupBy({
        by: ['method'],
        _count: { method: true },
        where: { createdAt: { gte: dateFrom } }
      }),
      // Total amount collected
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { 
          status: 'VERIFIED',
          createdAt: { gte: dateFrom }
        }
      }),
      // Average payment amount
      prisma.payment.aggregate({
        _avg: { amount: true },
        where: { 
          status: 'VERIFIED',
          createdAt: { gte: dateFrom }
        }
      }),
      // Pending payments requiring verification
      prisma.payment.count({
        where: { status: 'PENDING' }
      })
    ])

    const result = {
      total_payments: stats[0],
      payments_in_period: stats[1],
      payments_by_status: stats[2].reduce((acc, item) => {
        acc[item.status] = item._count.status
        return acc
      }, {}),
      payments_by_method: stats[3].reduce((acc, item) => {
        acc[item.method] = item._count.method
        return acc
      }, {}),
      total_amount_collected: parseFloat(stats[4]._sum.amount || 0),
      average_payment_amount: parseFloat(stats[5]._avg.amount || 0),
      pending_verifications: stats[6]
    }

    logger.info('Payment statistics retrieved')
    res.json(successResponse(result))
  } catch (error) {
    logger.error('Get payment stats error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Confirm verified payment and start order preparation (Admin only)
 */
export async function confirmPayment(req, res) {
  try {
    const { id } = req.params
    const { confirmation_notes } = req.body

    // Check if payment exists
    const existingPayment = await prisma.payment.findUnique({
      where: { id },
      include: {
        order: true
      }
    })

    if (!existingPayment) {
      return res.status(404).json(commonErrors.notFound('Payment'))
    }

    if (existingPayment.status !== 'VERIFIED') {
      return res.status(400).json(errorResponse(
        'Payment must be verified before confirmation',
        'PAYMENT_NOT_VERIFIED'
      ))
    }

    if (existingPayment.order.status !== 'AWAITING_PAYMENT') {
      return res.status(400).json(errorResponse(
        'Order status is not awaiting payment',
        'INVALID_ORDER_STATUS'
      ))
    }

    // Confirm payment and update order status in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update order status to PREPARING
      const updatedOrder = await tx.order.update({
        where: { id: existingPayment.orderId },
        data: { 
          status: 'PREPARING'
        }
      })

      // Add to order status history
      await tx.orderStatusHistory.create({
        data: {
          orderId: existingPayment.orderId,
          status: 'PREPARING',
          notes: confirmation_notes || 'Payment confirmed - order started preparation',
          updatedBy: req.user?.email || 'admin'
        }
      })

      return { payment: existingPayment, order: updatedOrder }
    })

    logger.info(`Payment ${id} confirmed and order ${existingPayment.orderId} moved to PREPARING by ${req.user?.email}`)
    res.json(successResponse({
      message: 'Payment confirmed successfully - Order moved to preparation',
      payment: formatPaymentResponse(result.payment),
      order: result.order
    }))
  } catch (error) {
    logger.error('Confirm payment error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Search payments (Admin only)
 */
export async function search(req, res) {
  try {
    const { 
      q: query,
      page = 1,
      limit = 20,
      status,
      method,
      dateFrom,
      dateTo
    } = req.query

    if (!query) {
      return res.status(400).json(commonErrors.badRequest('Search query required'))
    }

    // Build where clause
    const where = {
      OR: [
        { id: { contains: query, mode: 'insensitive' } },
        { orderId: { contains: query, mode: 'insensitive' } },
        { customerName: { contains: query, mode: 'insensitive' } },
        { customerPhone: { contains: query, mode: 'insensitive' } },
        { referenceNumber: { contains: query, mode: 'insensitive' } }
      ]
    }

    if (status) {
      where.status = status
    }

    if (method) {
      where.method = method
    }

    if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) where.date.gte = new Date(dateFrom)
      if (dateTo) where.date.lte = new Date(dateTo)
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take,
        include: {
          order: {
            select: {
              id: true,
              customerName: true,
              status: true,
              total: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.payment.count({ where })
    ])

    const formattedPayments = payments.map(formatPaymentResponse)

    logger.info(`Search "${query}" returned ${payments.length} payments`)

    res.json(paginatedResponse(formattedPayments, {
      page: parseInt(page),
      limit: parseInt(limit),
      total
    }))
  } catch (error) {
    logger.error('Search payments error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

export default {
  getAll,
  getById,
  create,
  getByOrderId,
  verify,
  confirmPayment,
  uploadVoucher,
  getPaymentInfo,
  getStats,
  search
}