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
 * Protected routes - Authenticated users only
 */

// Get all categories (authenticated users)
router.get('/', authenticateUser, getAll)

// Get category by ID (authenticated users)
router.get('/:id', authenticateUser, getById)

// Get category with products (authenticated users)
router.get('/:id/products', authenticateUser, getWithProducts)

// Check if category name is available (authenticated users)
router.get('/check/name', authenticateUser, checkName)

/**
 * Protected routes - Admin only
 */

// Create new category
router.post('/', 
  authenticateUser,
  requireRole('ADMIN'),
  create
)

// Update category
router.put('/:id',
  authenticateUser,
  requireRole('ADMIN'),
  update
)

// Delete category
router.delete('/:id',
  authenticateUser,
  requireRole('ADMIN'),
  remove
)

// Get category statistics
router.get('/admin/stats',
  authenticateUser,
  requireRole('ADMIN'),
  getStats
)

// Reorder categories
router.put('/admin/reorder',
  authenticateUser,
  requireRole('ADMIN'),
  reorder
)

export default router