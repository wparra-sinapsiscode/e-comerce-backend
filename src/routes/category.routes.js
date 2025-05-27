import { Router } from 'express'
import {
  getAll,
  getById,
  getWithProducts,
  create,
  update,
  remove,
  checkName,
  getStats,
  reorder
} from '../controllers/category.controller.js'
import { authenticateUser, requireRole } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validation.middleware.js'
import { CategoryQuerySchema, CreateCategorySchema, UpdateCategorySchema } from '../schemas/category.schema.js'

const router = Router()

/**
 * Public routes
 */

// Get all categories (public)
router.get('/', getAll)

// Get category by ID (public)
router.get('/:id', getById)

// Get category with products (public)
router.get('/:id/products', getWithProducts)

// Check if category name is available (public)
router.get('/check/name', checkName)

/**
 * Protected routes - Admin only
 */

// Create new category
router.post('/', 
  authenticateUser,
  requireRole(['ADMIN']),
  create
)

// Update category
router.put('/:id',
  authenticateUser,
  requireRole(['ADMIN']),
  update
)

// Delete category
router.delete('/:id',
  authenticateUser,
  requireRole(['ADMIN']),
  remove
)

// Get category statistics
router.get('/admin/stats',
  authenticateUser,
  requireRole(['ADMIN']),
  getStats
)

// Reorder categories
router.put('/admin/reorder',
  authenticateUser,
  requireRole(['ADMIN']),
  reorder
)

export default router