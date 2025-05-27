import { Router } from 'express'
import {
  getAll,
  getById,
  getByCategory,
  search,
  create,
  update,
  remove,
  getFeatured,
  getPresentations
} from '../controllers/product.controller.js'
import { authenticateUser, requireRole } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validation.middleware.js'
import { ProductQuerySchema, CreateProductSchema, UpdateProductSchema } from '../schemas/product.schema.js'

const router = Router()

/**
 * Protected routes - Authenticated users only
 */

// Get all products (authenticated users)
router.get('/', authenticateUser, getAll)

// Get product by ID (authenticated users)
router.get('/:id', authenticateUser, getById)

// Get products by category (authenticated users)
router.get('/category/:categoryId', authenticateUser, getByCategory)

// Search products (authenticated users)
router.get('/search/query', authenticateUser, search)

// Get featured products (authenticated users)
router.get('/featured/list', authenticateUser, getFeatured)

// Get product presentations (authenticated users)
router.get('/:id/presentations', authenticateUser, getPresentations)

/**
 * Protected routes - Admin only
 */

// Create new product
router.post('/',
  authenticateUser,
  requireRole('ADMIN'),
  create
)

// Update product
router.put('/:id',
  authenticateUser,
  requireRole('ADMIN'),
  update
)

// Delete product
router.delete('/:id',
  authenticateUser,
  requireRole('ADMIN'),
  remove
)

export default router