import { Router } from 'express'
import {
  getAll,
  getById,
  create,
  getByCustomerPhone,
  getByStatus,
  updateStatus,
  getOrderItems,
  getStats,
  search,
  cancel
} from '../controllers/order.controller.js'
import { authenticateUser, requireRole } from '../middleware/auth.js'

const router = Router()

/**
 * Public routes
 */

// Get order by ID (customer can see their own, admin can see all)
router.get('/:id', getById)

// Get order items (customer can see their own, admin can see all)
router.get('/:id/items', getOrderItems)

// Get orders by customer phone
router.get('/customer/:phone', getByCustomerPhone)

// Create new order (can be done without authentication for guest orders)
router.post('/', create)

// Cancel order (customer can cancel their own, admin can cancel any)
router.patch('/:id/cancel', cancel)

/**
 * Protected routes - Admin only
 */

// Get all orders (admin only)
router.get('/', 
  authenticateUser,
  requireRole(['ADMIN']),
  getAll
)

// Get orders by status (admin only)
router.get('/status/:status',
  authenticateUser,
  requireRole(['ADMIN']),
  getByStatus
)

// Update order status (admin only)
router.patch('/:id/status',
  authenticateUser,
  requireRole(['ADMIN']),
  updateStatus
)

// Get order statistics (admin only)
router.get('/admin/stats',
  authenticateUser,
  requireRole(['ADMIN']),
  getStats
)

// Search orders (admin only)
router.get('/admin/search',
  authenticateUser,
  requireRole(['ADMIN']),
  search
)

export default router