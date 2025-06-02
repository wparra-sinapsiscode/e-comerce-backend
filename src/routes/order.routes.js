import { Router } from 'express'
import {
  getAll,
  getById,
  create,
  getMyOrders,
  getByCustomerPhone,
  getByStatus,
  updateStatus,
  getOrderItems,
  getStats,
  search,
  cancel
} from '../controllers/order.controller.js'
import { authenticateUser, requireRole } from '../middleware/auth.js'
import { adminLimiter, dynamicLimiter } from '../middleware/rateLimiting.middleware.js'

const router = Router()

/**
 * Specific routes (must come before parameterized routes)
 */

// Get my orders (authenticated user only)
router.get('/my-orders', authenticateUser, getMyOrders)

// Get orders by customer phone
router.get('/customer/:phone', getByCustomerPhone)

/**
 * Public routes
 */

// Create new order (requires authentication)
router.post('/', authenticateUser, create)

// Get order by ID (customer can see their own, admin can see all)
router.get('/:id', authenticateUser, getById)

// Get order items (customer can see their own, admin can see all)
router.get('/:id/items', authenticateUser, getOrderItems)

// Cancel order (customer can cancel their own, admin can cancel any)
router.patch('/:id/cancel', authenticateUser, cancel)

/**
 * Protected routes - Admin only
 */

// Get all orders (admin only)
router.get('/', 
  authenticateUser,
  requireRole('ADMIN'),
  adminLimiter, // Use admin-specific limiter with higher limits
  getAll
)

// Get orders by status (admin only)
router.get('/status/:status',
  authenticateUser,
  requireRole('ADMIN'),
  adminLimiter, // Use admin-specific limiter with higher limits
  getByStatus
)

// Update order status (admin only)
router.patch('/:id/status',
  authenticateUser,
  requireRole('ADMIN'),
  updateStatus
)

// Get order statistics (admin only)
router.get('/admin/stats',
  authenticateUser,
  requireRole('ADMIN'),
  getStats
)

// Search orders (admin only)
router.get('/admin/search',
  authenticateUser,
  requireRole('ADMIN'),
  search
)

export default router