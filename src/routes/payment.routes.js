import { Router } from 'express'
import {
  getAll,
  getById,
  create,
  getByOrderId,
  verify,
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
router.get('/:id', getById)

// Get payment by order ID
router.get('/order/:orderId', getByOrderId)

// Create new payment for an order
router.post('/', create)

// Upload payment voucher
router.post('/:id/voucher',
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
  requireRole(['ADMIN']),
  getAll
)

// Verify payment (admin only)
router.patch('/:id/verify',
  authenticateUser,
  requireRole(['ADMIN']),
  verify
)

// Get payment statistics (admin only)
router.get('/admin/stats',
  authenticateUser,
  requireRole(['ADMIN']),
  getStats
)

// Search payments (admin only)
router.get('/admin/search',
  authenticateUser,
  requireRole(['ADMIN']),
  search
)

export default router