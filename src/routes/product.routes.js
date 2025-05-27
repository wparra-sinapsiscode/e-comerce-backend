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
 * Public routes
 */

// Get all products (public)
router.get('/', getAll)

// Get product by ID (public)
router.get('/:id', getById)

// Get products by category (public)
router.get('/category/:categoryId', getByCategory)

// Search products (public)
router.get('/search/query', search)

// Get featured products (public)
router.get('/featured/list', getFeatured)

// Get product presentations (public)
router.get('/:id/presentations', getPresentations)

/**
 * Protected routes - Admin only
 */

// Create new product
router.post('/',
  authenticateUser,
  requireRole(['ADMIN']),
  create
)

// Update product
router.put('/:id',
  authenticateUser,
  requireRole(['ADMIN']),
  update
)

// Delete product
router.delete('/:id',
  authenticateUser,
  requireRole(['ADMIN']),
  remove
)

export default router