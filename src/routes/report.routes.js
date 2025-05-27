import { Router } from 'express'
import {
  generateSalesReport,
  generateInventoryReport,
  generateCustomerReport,
  generateFinancialReport
} from '../controllers/report.controller.js'
import { authenticateUser, requireRole } from '../middleware/auth.js'
import { cacheReports } from '../middleware/cache.middleware.js'
import { reportLimiter } from '../middleware/rateLimiting.middleware.js'

const router = Router()

// All report routes require admin authentication
router.use(authenticateUser)
router.use(requireRole('ADMIN'))
router.use(reportLimiter)

/**
 * Report generation routes - All admin only
 */

// Generate sales report with detailed breakdown
// Supports JSON and CSV formats
// Query params: format, period, groupBy, includeItems, dateFrom, dateTo
router.get('/sales', cacheReports, generateSalesReport)

// Generate inventory report
// Shows current stock levels, product details, and alerts
// Query params: format, includeInactive
router.get('/inventory', cacheReports, generateInventoryReport)

// Generate customer report
// Customer analytics, orders, and behavior patterns
// Query params: format, period
router.get('/customers', cacheReports, generateCustomerReport)

// Generate financial report
// Revenue, payments, taxes, and financial metrics
// Query params: format, period
router.get('/financial', cacheReports, generateFinancialReport)

export default router