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
  validateCategory,
  validateCreateCategory,
  validateUpdateCategory,
  formatCategoryResponse,
} from '../schemas/category.schema.js'
import logger from '../config/logger.js'

const prisma = getPrismaClient()

/**
 * Get all categories with optional filters
 */
export async function getAll(req, res) {
  try {
    const {
      page = 1,
      limit = 50,
      active,
      search,
      sortBy = 'sortOrder',
      sortOrder = 'asc'
    } = req.query

    // Build where clause
    const where = {}
    
    if (active !== undefined) {
      where.active = active === 'true'
    }
    
    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive'
      }
    }

    // Build orderBy clause
    const orderBy = {}
    orderBy[sortBy] = sortOrder === 'desc' ? 'desc' : 'asc'

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)

    // Get categories with product count
    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          _count: {
            select: { products: true }
          }
        }
      }),
      prisma.category.count({ where })
    ])

    // Format response
    const formattedCategories = categories.map(category => ({
      ...formatCategoryResponse(category),
      productCount: category._count.products
    }))

    logger.info(`Retrieved ${categories.length} categories`)

    if (page && limit) {
      return res.json(paginatedResponse(formattedCategories, {
        page: parseInt(page),
        limit: parseInt(limit),
        total
      }))
    }

    res.json(successResponse(formattedCategories))
  } catch (error) {
    logger.error('Get categories error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Get category by ID
 */
export async function getById(req, res) {
  try {
    const { id } = req.params

    const category = await prisma.category.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: { products: true }
        }
      }
    })

    if (!category) {
      return res.status(404).json(commonErrors.notFound('Category'))
    }

    const formattedCategory = {
      ...formatCategoryResponse(category),
      productCount: category._count.products
    }

    logger.info(`Retrieved category: ${category.name}`)
    res.json(successResponse(formattedCategory))
  } catch (error) {
    logger.error('Get category error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Get category with its products
 */
export async function getWithProducts(req, res) {
  try {
    const { id } = req.params
    const { page = 1, limit = 20, activeOnly = 'true' } = req.query

    const category = await prisma.category.findUnique({
      where: { id: parseInt(id) }
    })

    if (!category) {
      return res.status(404).json(commonErrors.notFound('Category'))
    }

    // Build products where clause
    const productsWhere = { categoryId: parseInt(id) }
    if (activeOnly === 'true') {
      productsWhere.active = true
    }

    // Pagination for products
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: productsWhere,
        skip,
        take,
        include: {
          presentations: {
            orderBy: { sortOrder: 'asc' }
          }
        },
        orderBy: { name: 'asc' }
      }),
      prisma.product.count({ where: productsWhere })
    ])

    const result = {
      category: formatCategoryResponse(category),
      products: products.map(product => ({
        id: product.id,
        name: product.name,
        price: product.price,
        unit: product.unit,
        description: product.description,
        image: product.image,
        active: product.active,
        presentations: product.presentations,
        created_at: product.createdAt,
        updated_at: product.updatedAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    }

    logger.info(`Retrieved category ${category.name} with ${products.length} products`)
    res.json(successResponse(result))
  } catch (error) {
    logger.error('Get category with products error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Create new category
 */
export async function create(req, res) {
  try {
    const validation = validateCreateCategory(req.body)
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { type: 'validation', errors: validation.error }
      })
    }

    const { name, icon, color, sortOrder } = validation.data

    // Check if category name already exists
    const existingCategory = await prisma.category.findUnique({
      where: { name }
    })

    if (existingCategory) {
      return res.status(409).json(errorResponse(
        'Category name already exists',
        'CATEGORY_NAME_EXISTS'
      ))
    }

    // Create category
    const category = await prisma.category.create({
      data: {
        name,
        icon,
        color,
        sortOrder: sortOrder || 0
      }
    })

    logger.info(`Category created: ${category.name}`)
    res.status(201).json(successResponse(formatCategoryResponse(category)))
  } catch (error) {
    logger.error('Create category error:', error)
    
    if (error.code === 'P2002') {
      return res.status(409).json(errorResponse(
        'Category name already exists',
        'CATEGORY_NAME_EXISTS'
      ))
    }
    
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Update category
 */
export async function update(req, res) {
  try {
    const { id } = req.params
    
    const validation = validateUpdateCategory(req.body)
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { type: 'validation', errors: validation.error }
      })
    }

    const updateData = validation.data

    // Check if category exists
    const existingCategory = await prisma.category.findUnique({
      where: { id: parseInt(id) }
    })

    if (!existingCategory) {
      return res.status(404).json(commonErrors.notFound('Category'))
    }

    // Check if new name conflicts (if name is being updated)
    if (updateData.name && updateData.name !== existingCategory.name) {
      const nameConflict = await prisma.category.findUnique({
        where: { name: updateData.name }
      })

      if (nameConflict) {
        return res.status(409).json(errorResponse(
          'Category name already exists',
          'CATEGORY_NAME_EXISTS'
        ))
      }
    }

    // Update category
    const updatedCategory = await prisma.category.update({
      where: { id: parseInt(id) },
      data: updateData
    })

    logger.info(`Category updated: ${updatedCategory.name}`)
    res.json(successResponse(formatCategoryResponse(updatedCategory)))
  } catch (error) {
    logger.error('Update category error:', error)
    
    if (error.code === 'P2002') {
      return res.status(409).json(errorResponse(
        'Category name already exists',
        'CATEGORY_NAME_EXISTS'
      ))
    }
    
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Delete category
 */
export async function remove(req, res) {
  try {
    const { id } = req.params
    const { force = 'false' } = req.query

    // Check if category exists
    const category = await prisma.category.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: { products: true }
        }
      }
    })

    if (!category) {
      return res.status(404).json(commonErrors.notFound('Category'))
    }

    // Check if category has products
    if (category._count.products > 0 && force !== 'true') {
      return res.status(400).json(errorResponse(
        'Cannot delete category with products. Use force=true to delete anyway.',
        'CATEGORY_HAS_PRODUCTS'
      ))
    }

    // Delete category (cascade will handle products if force=true)
    await prisma.category.delete({
      where: { id: parseInt(id) }
    })

    logger.info(`Category deleted: ${category.name}`)
    res.json(successResponse(null, 'Category deleted successfully'))
  } catch (error) {
    logger.error('Delete category error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Check if category name is available
 */
export async function checkName(req, res) {
  try {
    const { name } = req.query
    const { excludeId } = req.query

    if (!name) {
      return res.status(400).json(commonErrors.badRequest('Name parameter required'))
    }

    const where = { name }
    if (excludeId) {
      where.NOT = { id: parseInt(excludeId) }
    }

    const existingCategory = await prisma.category.findFirst({ where })

    res.json(successResponse({
      available: !existingCategory,
      exists: !!existingCategory
    }))
  } catch (error) {
    logger.error('Check category name error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Get category statistics
 */
export async function getStats(req, res) {
  try {
    const stats = await prisma.category.findMany({
      include: {
        _count: {
          select: { products: true }
        }
      }
    })

    const result = {
      totalCategories: stats.length,
      activeCategories: stats.filter(c => c.active).length,
      inactiveCategories: stats.filter(c => !c.active).length,
      totalProducts: stats.reduce((sum, c) => sum + c._count.products, 0),
      categoriesWithProducts: stats.filter(c => c._count.products > 0).length,
      emptyCategoriesCount: stats.filter(c => c._count.products === 0).length,
      averageProductsPerCategory: stats.length > 0 
        ? (stats.reduce((sum, c) => sum + c._count.products, 0) / stats.length).toFixed(2)
        : 0
    }

    logger.info('Category statistics retrieved')
    res.json(successResponse(result))
  } catch (error) {
    logger.error('Get category stats error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Reorder categories
 */
export async function reorder(req, res) {
  try {
    const { categoryIds } = req.body

    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      return res.status(400).json(commonErrors.badRequest('categoryIds array required'))
    }

    // Update sort order for each category
    const updatePromises = categoryIds.map((categoryId, index) =>
      prisma.category.update({
        where: { id: parseInt(categoryId) },
        data: { sortOrder: index }
      })
    )

    await Promise.all(updatePromises)

    logger.info(`Reordered ${categoryIds.length} categories`)
    res.json(successResponse(null, 'Categories reordered successfully'))
  } catch (error) {
    logger.error('Reorder categories error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

export default {
  getAll,
  getById,
  getWithProducts,
  create,
  update,
  remove,
  checkName,
  getStats,
  reorder
}