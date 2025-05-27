import { z } from 'zod'

/**
 * Product Schema Validation
 */

// Unit type enum
const UnitTypeEnum = z.enum(['KG', 'U', 'L', 'G', 'PAQ', 'PRESENTATION'])

// Base product schema
export const ProductSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(200),
  categoryId: z.number().int().positive(),
  price: z.number().positive(),
  unit: UnitTypeEnum,
  description: z.string().optional(),
  image: z.string().url().optional(),
  active: z.boolean().default(true),
  created_at: z.date(),
  updated_at: z.date()
})

// Create product schema
export const CreateProductSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(200, 'Name must be less than 200 characters')
    .trim(),
  categoryId: z.number()
    .int('Category ID must be integer')
    .positive('Category ID must be positive'),
  price: z.number()
    .positive('Price must be positive')
    .max(999999.99, 'Price too high'),
  unit: UnitTypeEnum,
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .trim()
    .optional(),
  image: z.string()
    .url('Must be valid URL')
    .optional()
})

// Update product schema
export const UpdateProductSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(200, 'Name must be less than 200 characters')
    .trim()
    .optional(),
  categoryId: z.number()
    .int('Category ID must be integer')
    .positive('Category ID must be positive')
    .optional(),
  price: z.number()
    .positive('Price must be positive')
    .max(999999.99, 'Price too high')
    .optional(),
  unit: UnitTypeEnum.optional(),
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .trim()
    .optional(),
  image: z.string()
    .url('Must be valid URL')
    .optional(),
  active: z.boolean().optional()
})

// Product query parameters schema
export const ProductQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  categoryId: z.string().regex(/^\d+$/).transform(Number).optional(),
  active: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'price', 'createdAt', 'updatedAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  minPrice: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).optional(),
  maxPrice: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).optional(),
  featured: z.enum(['true', 'false']).optional()
})

// Presentation schema
export const PresentationSchema = z.object({
  id: z.number().int().positive(),
  productId: z.number().int().positive(),
  name: z.string().min(1).max(100),
  price: z.number().positive(),
  unit: z.string().min(1).max(20),
  sortOrder: z.number().int().min(0).default(0),
  created_at: z.date(),
  updated_at: z.date()
})

// Create presentation schema
export const CreatePresentationSchema = z.object({
  productId: z.number()
    .int('Product ID must be integer')
    .positive('Product ID must be positive'),
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .trim(),
  price: z.number()
    .positive('Price must be positive')
    .max(999999.99, 'Price too high'),
  unit: z.string()
    .min(1, 'Unit is required')
    .max(20, 'Unit must be less than 20 characters'),
  sortOrder: z.number()
    .int('Sort order must be integer')
    .min(0, 'Sort order must be positive')
    .optional()
    .default(0)
})

/**
 * Validation functions
 */
export function validateProduct(data) {
  try {
    const result = ProductSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.errors }
  }
}

export function validateCreateProduct(data) {
  try {
    const result = CreateProductSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.errors }
  }
}

export function validateUpdateProduct(data) {
  try {
    const result = UpdateProductSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.errors }
  }
}

export function validateProductQuery(data) {
  try {
    const result = ProductQuerySchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.errors }
  }
}

export function validatePresentation(data) {
  try {
    const result = PresentationSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.errors }
  }
}

export function validateCreatePresentation(data) {
  try {
    const result = CreatePresentationSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.errors }
  }
}

/**
 * Format product response for API
 */
export function formatProductResponse(product) {
  return {
    id: product.id,
    name: product.name,
    category_id: product.categoryId,
    category: product.category ? {
      id: product.category.id,
      name: product.category.name,
      icon: product.category.icon,
      color: product.category.color
    } : null,
    price: product.price,
    unit: product.unit,
    description: product.description,
    image: product.image,
    active: product.active,
    presentations: product.presentations || [],
    created_at: product.createdAt,
    updated_at: product.updatedAt
  }
}

export default {
  ProductSchema,
  CreateProductSchema,
  UpdateProductSchema,
  ProductQuerySchema,
  PresentationSchema,
  CreatePresentationSchema,
  validateProduct,
  validateCreateProduct,
  validateUpdateProduct,
  validateProductQuery,
  validatePresentation,
  validateCreatePresentation,
  formatProductResponse
}