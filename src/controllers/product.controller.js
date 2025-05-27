import { getPrismaClient } from '../config/database.js'
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  commonErrors,
  businessErrors,
  dbErrors,
} from '../utils/responses.js'
import {
  validateProduct,
  validateCreateProduct,
  validateUpdateProduct,
  validateProductQuery,
  formatProductResponse,
} from '../schemas/product.schema.js'
import logger from '../config/logger.js'

const prisma = getPrismaClient()

/**
 * Get all products with optional filters
 */
export async function getAll(req, res) {
  try {
    const {
      page = 1,
      limit = 50,
      categoryId,
      active,
      search,
      sortBy = 'name',
      sortOrder = 'asc',
      minPrice,
      maxPrice,
      featured
    } = req.query

    // Build where clause
    const where = {}
    
    if (categoryId) {
      where.categoryId = parseInt(categoryId)
    }
    
    if (active !== undefined) {
      where.active = active === 'true'
    }
    
    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          description: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ]
    }

    if (minPrice || maxPrice) {
      where.price = {}
      if (minPrice) where.price.gte = parseFloat(minPrice)
      if (maxPrice) where.price.lte = parseFloat(maxPrice)
    }

    // Build orderBy clause
    const orderBy = {}
    orderBy[sortBy] = sortOrder === 'desc' ? 'desc' : 'asc'

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)

    // Get products with related data
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          category: true,
          presentations: {
            orderBy: { sortOrder: 'asc' }
          }
        }
      }),
      prisma.product.count({ where })
    ])

    // Format response
    const formattedProducts = products.map(formatProductResponse)

    logger.info(`Retrieved ${products.length} products`)

    if (page && limit) {
      return res.json(paginatedResponse(formattedProducts, {
        page: parseInt(page),
        limit: parseInt(limit),
        total
      }))
    }

    res.json(successResponse(formattedProducts))
  } catch (error) {
    logger.error('Get products error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Get product by ID
 */
export async function getById(req, res) {
  try {
    const { id } = req.params

    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: {
        category: true,
        presentations: {
          orderBy: { sortOrder: 'asc' }
        }
      }
    })

    if (!product) {
      return res.status(404).json(commonErrors.notFound('Product'))
    }

    logger.info(`Retrieved product: ${product.name}`)
    res.json(successResponse(formatProductResponse(product)))
  } catch (error) {
    logger.error('Get product error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Get products by category
 */
export async function getByCategory(req, res) {
  try {
    const { categoryId } = req.params
    const { 
      page = 1, 
      limit = 20, 
      active = 'true',
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query

    // Check if category exists
    const category = await prisma.category.findUnique({
      where: { id: parseInt(categoryId) }
    })

    if (!category) {
      return res.status(404).json(commonErrors.notFound('Category'))
    }

    // Build where clause
    const where = { categoryId: parseInt(categoryId) }
    if (active === 'true') {
      where.active = true
    }

    // Build orderBy clause
    const orderBy = {}
    orderBy[sortBy] = sortOrder === 'desc' ? 'desc' : 'asc'

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          category: true,
          presentations: {
            orderBy: { sortOrder: 'asc' }
          }
        }
      }),
      prisma.product.count({ where })
    ])

    const formattedProducts = products.map(formatProductResponse)

    logger.info(`Retrieved ${products.length} products for category ${category.name}`)

    res.json(paginatedResponse(formattedProducts, {
      page: parseInt(page),
      limit: parseInt(limit),
      total
    }))
  } catch (error) {
    logger.error('Get products by category error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Search products
 */
export async function search(req, res) {
  try {
    const { 
      q: query,
      page = 1,
      limit = 20,
      categoryId,
      minPrice,
      maxPrice,
      active = 'true'
    } = req.query

    if (!query) {
      return res.status(400).json(commonErrors.badRequest('Search query required'))
    }

    // Build where clause
    const where = {
      OR: [
        {
          name: {
            contains: query,
            mode: 'insensitive'
          }
        },
        {
          description: {
            contains: query,
            mode: 'insensitive'
          }
        }
      ]
    }

    if (categoryId) {
      where.categoryId = parseInt(categoryId)
    }

    if (active === 'true') {
      where.active = true
    }

    if (minPrice || maxPrice) {
      where.price = {}
      if (minPrice) where.price.gte = parseFloat(minPrice)
      if (maxPrice) where.price.lte = parseFloat(maxPrice)
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        include: {
          category: true,
          presentations: {
            orderBy: { sortOrder: 'asc' }
          }
        },
        orderBy: { name: 'asc' }
      }),
      prisma.product.count({ where })
    ])

    const formattedProducts = products.map(formatProductResponse)

    logger.info(`Search "${query}" returned ${products.length} products`)

    res.json(paginatedResponse(formattedProducts, {
      page: parseInt(page),
      limit: parseInt(limit),
      total
    }))
  } catch (error) {
    logger.error('Search products error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Create new product
 */
export async function create(req, res) {
  try {
    console.log('=== CREATE PRODUCT REQUEST ===')
    console.log('Body:', req.body)
    console.log('Headers:', req.headers)
    console.log('User:', req.user)
    
    // TRANSFORMAR datos del frontend al formato esperado por el backend
    const transformedData = {
      ...req.body,
      // Convertir category_id a categoryId (snake_case → camelCase)
      categoryId: req.body.category_id || req.body.categoryId,
      // Convertir unit a MAYÚSCULAS (l → L, kg → KG, etc.)
      unit: req.body.unit ? req.body.unit.toUpperCase() : req.body.unit
    }
    
    // Remover category_id del objeto transformado (ya está como categoryId)
    delete transformedData.category_id
    
    console.log('🔄 DATOS TRANSFORMADOS:', transformedData)
    console.log('🔄 TRANSFORMACIONES:', {
      'category_id → categoryId': `${req.body.category_id} → ${transformedData.categoryId}`,
      'unit → MAYÚSCULAS': `${req.body.unit} → ${transformedData.unit}`
    })
    
    const validation = validateCreateProduct(transformedData)
    if (!validation.success) {
      console.log('❌ VALIDATION FAILED:', validation.error)
      return res.status(400).json({
        success: false,
        error: { type: 'validation', errors: validation.error }
      })
    }

    const productData = validation.data

    // Check if category exists
    const category = await prisma.category.findUnique({
      where: { id: productData.categoryId }
    })

    if (!category) {
      return res.status(404).json(commonErrors.notFound('Category'))
    }

    if (!category.active) {
      return res.status(400).json(businessErrors.categoryInactive())
    }

    // Create product
    console.log('📦 CREATING PRODUCT WITH DATA:', productData)
    const product = await prisma.product.create({
      data: productData,
      include: {
        category: true,
        presentations: true
      }
    })

    console.log('✅ PRODUCT CREATED SUCCESSFULLY:', product)
    logger.info(`Product created: ${product.name}`)
    res.status(201).json(successResponse(formatProductResponse(product)))
  } catch (error) {
    logger.error('Create product error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Update product
 */
export async function update(req, res) {
  try {
    const { id } = req.params
    
    // TRANSFORMAR datos del frontend al formato esperado por el backend
    const transformedData = {
      ...req.body,
      // Convertir category_id a categoryId (snake_case → camelCase)
      categoryId: req.body.category_id || req.body.categoryId,
      // Convertir unit a MAYÚSCULAS (l → L, kg → KG, etc.)
      unit: req.body.unit ? req.body.unit.toUpperCase() : req.body.unit
    }
    
    // Remover category_id del objeto transformado (ya está como categoryId)
    delete transformedData.category_id
    
    const validation = validateUpdateProduct(transformedData)
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { type: 'validation', errors: validation.error }
      })
    }

    const updateData = validation.data

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id: parseInt(id) }
    })

    if (!existingProduct) {
      return res.status(404).json(commonErrors.notFound('Product'))
    }

    // If categoryId is being updated, check if new category exists and is active
    if (updateData.categoryId && updateData.categoryId !== existingProduct.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: updateData.categoryId }
      })

      if (!category) {
        return res.status(404).json(commonErrors.notFound('Category'))
      }

      if (!category.active) {
        return res.status(400).json(businessErrors.categoryInactive())
      }
    }

    // Update product
    const updatedProduct = await prisma.product.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        category: true,
        presentations: {
          orderBy: { sortOrder: 'asc' }
        }
      }
    })

    logger.info(`Product updated: ${updatedProduct.name}`)
    res.json(successResponse(formatProductResponse(updatedProduct)))
  } catch (error) {
    logger.error('Update product error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Delete product
 */
export async function remove(req, res) {
  try {
    const { id } = req.params

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: { 
            orderItems: true,
            presentations: true
          }
        }
      }
    })

    if (!product) {
      return res.status(404).json(commonErrors.notFound('Product'))
    }

    // Check if product has order items (can't delete if has orders)
    if (product._count.orderItems > 0) {
      return res.status(400).json(errorResponse(
        'Cannot delete product that has been ordered. Consider deactivating instead.',
        'PRODUCT_HAS_ORDERS'
      ))
    }

    // Delete product (cascade will handle presentations)
    await prisma.product.delete({
      where: { id: parseInt(id) }
    })

    logger.info(`Product deleted: ${product.name}`)
    res.json(successResponse(null, 'Product deleted successfully'))
  } catch (error) {
    logger.error('Delete product error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Get featured products
 */
export async function getFeatured(req, res) {
  try {
    const { limit = 10 } = req.query

    // For now, get random active products
    // TODO: Add featured field to Product model
    const products = await prisma.product.findMany({
      where: { active: true },
      include: {
        category: true,
        presentations: {
          orderBy: { sortOrder: 'asc' }
        }
      },
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' }
    })

    const formattedProducts = products.map(formatProductResponse)

    logger.info(`Retrieved ${products.length} featured products`)
    res.json(successResponse(formattedProducts))
  } catch (error) {
    logger.error('Get featured products error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Get product presentations
 */
export async function getPresentations(req, res) {
  try {
    const { id } = req.params

    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: {
        presentations: {
          orderBy: { sortOrder: 'asc' }
        }
      }
    })

    if (!product) {
      return res.status(404).json(commonErrors.notFound('Product'))
    }

    logger.info(`Retrieved ${product.presentations.length} presentations for ${product.name}`)
    res.json(successResponse(product.presentations))
  } catch (error) {
    logger.error('Get product presentations error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

export default {
  getAll,
  getById,
  getByCategory,
  search,
  create,
  update,
  remove,
  getFeatured,
  getPresentations
}