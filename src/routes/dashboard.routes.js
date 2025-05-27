import { Router } from 'express'
import {
  getOverview,
  getSalesStats,
  getTopProducts,
  getTopCategories,
  getRevenueByPeriod,
  getCustomerStats,
  getInventoryAlerts,
  getRecentActivity
} from '../controllers/dashboard.controller.js'
import { authenticateUser, requireRole } from '../middleware/auth.js'
import { cacheDashboardData } from '../middleware/cache.middleware.js'
import { adminLimiter } from '../middleware/rateLimiting.middleware.js'

const router = Router()

// All dashboard routes require admin authentication
router.use(authenticateUser)
router.use(requireRole(['ADMIN']))
router.use(adminLimiter)

/**
 * Dashboard routes - All admin only with caching
 */

// Dashboard overview with general statistics
router.get('/overview', cacheDashboardData, getOverview)

// Sales statistics with detailed breakdown
router.get('/sales', cacheDashboardData, getSalesStats)

// Top selling products
router.get('/products/top', cacheDashboardData, getTopProducts)

// Top categories by sales
router.get('/categories/top', cacheDashboardData, getTopCategories)

// Revenue breakdown by period
router.get('/revenue', cacheDashboardData, getRevenueByPeriod)

// Customer statistics and analytics
router.get('/customers', cacheDashboardData, getCustomerStats)

// Inventory alerts for low stock
router.get('/inventory/alerts', cacheDashboardData, getInventoryAlerts)

// Recent activity feed
router.get('/activity', cacheDashboardData, getRecentActivity)

export default router