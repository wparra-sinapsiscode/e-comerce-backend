import { z } from 'zod'

/**
 * Category Schema Validation
 */

// Base category schema
export const CategorySchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  icon: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Must be valid hex color'),
  sortOrder: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
  created_at: z.date(),
  updated_at: z.date()
})

// Create category schema
export const CreateCategorySchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .trim(),
  icon: z.string()
    .min(1, 'Icon is required')
    .max(100, 'Icon must be less than 100 characters'),
  color: z.string()
    .regex(/^#[0-9A-F]{6}$/i, 'Must be valid hex color (e.g., #FF0000)'),
  sortOrder: z.number()
    .int('Sort order must be integer')
    .min(0, 'Sort order must be positive')
    .optional()
    .default(0)
})

// Update category schema
export const UpdateCategorySchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .trim()
    .optional(),
  icon: z.string()
    .min(1, 'Icon is required')
    .max(100, 'Icon must be less than 100 characters')
    .optional(),
  color: z.string()
    .regex(/^#[0-9A-F]{6}$/i, 'Must be valid hex color (e.g., #FF0000)')
    .optional(),
  sortOrder: z.number()
    .int('Sort order must be integer')
    .min(0, 'Sort order must be positive')
    .optional(),
  active: z.boolean().optional()
})

// Category query parameters schema
export const CategoryQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  active: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'sortOrder', 'createdAt', 'updatedAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
})

/**
 * Validation functions
 */
export function validateCategory(data) {
  try {
    const result = CategorySchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.errors }
  }
}

export function validateCreateCategory(data) {
  try {
    const result = CreateCategorySchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.errors }
  }
}

export function validateUpdateCategory(data) {
  try {
    const result = UpdateCategorySchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.errors }
  }
}

export function validateCategoryQuery(data) {
  try {
    const result = CategoryQuerySchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.errors }
  }
}

/**
 * Format category response for API
 */
export function formatCategoryResponse(category, productCount = 0) {
  return {
    id: category.id,
    name: category.name,
    icon: category.icon,
    color: category.color,
    sort_order: category.sortOrder,
    active: category.active,
    created_at: category.createdAt,
    updated_at: category.updatedAt,
    productCount: productCount
  }
}

export default {
  CategorySchema,
  CreateCategorySchema,
  UpdateCategorySchema,
  CategoryQuerySchema,
  validateCategory,
  validateCreateCategory,
  validateUpdateCategory,
  validateCategoryQuery,
  formatCategoryResponse
}