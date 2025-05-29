import { Router } from 'express'
import {
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
} from '../controllers/payment.controller.js'
import { authenticateUser, requireRole } from '../middleware/auth.js'
import { uploadVoucher as uploadVoucherMiddleware, handleMulterError } from '../config/multer.js'

const router = Router()

/**
 * Public routes
 */

// Get payment information (Yape/Plin accounts, QR codes)
router.get('/info', getPaymentInfo)

// Get payment by ID (customer can see their own, admin can see all)
router.get('/:id', authenticateUser, getById)

// Get payment by order ID
router.get('/order/:orderId', authenticateUser, getByOrderId)

// Create new payment for an order
router.post('/', authenticateUser, create)

// Upload payment voucher
router.post('/:id/voucher',
  authenticateUser,
  uploadVoucherMiddleware.single('voucher'),
  handleMulterError,
  uploadVoucher
)

/**
 * Protected routes - Admin only
 */

// Get all payments (admin only)
router.get('/', 
  authenticateUser,
  requireRole('ADMIN'),
  getAll
)

// Verify payment (admin only)
router.patch('/:id/verify',
  authenticateUser,
  requireRole('ADMIN'),
  verify
)

// Confirm verified payment and start order preparation (admin only)
router.patch('/:id/confirm',
  authenticateUser,
  requireRole('ADMIN'),
  confirmPayment
)

// Get payment statistics (admin only)
router.get('/admin/stats',
  authenticateUser,
  requireRole('ADMIN'),
  getStats
)

// Search payments (admin only)
router.get('/admin/search',
  authenticateUser,
  requireRole('ADMIN'),
  search
)

export default router