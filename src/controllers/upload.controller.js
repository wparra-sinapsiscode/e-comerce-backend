import { getPrismaClient } from '../config/database.js'
import {
  successResponse,
  errorResponse,
  commonErrors,
} from '../utils/responses.js'
import { validateFile } from '../config/multer.js'
import logger from '../config/logger.js'
import path from 'path'
import fs from 'fs'

const prisma = getPrismaClient()

/**
 * Upload product image
 */
export async function uploadImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json(commonErrors.badRequest('No image file uploaded'))
    }

    // Validate file type
    const validation = validateFile(req.file, 'image')
    if (!validation.valid) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path)
      return res.status(400).json(commonErrors.badRequest(validation.error))
    }

    const imageData = {
      filename: req.file.filename,
      original_name: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      url: `/uploads/images/${req.file.filename}`
    }

    logger.info(`Image uploaded: ${req.file.filename}`)
    res.status(201).json(successResponse(imageData, 'Image uploaded successfully'))
  } catch (error) {
    logger.error('Upload image error:', error)
    
    // Clean up file if it exists
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path)
      } catch (cleanupError) {
        logger.error('Error cleaning up file:', cleanupError)
      }
    }
    
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Upload payment voucher
 */
export async function uploadVoucher(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json(commonErrors.badRequest('No voucher file uploaded'))
    }

    // Validate file type
    const validation = validateFile(req.file, 'voucher')
    if (!validation.valid) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path)
      return res.status(400).json(commonErrors.badRequest(validation.error))
    }

    const voucherData = {
      filename: req.file.filename,
      original_name: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      url: `/uploads/vouchers/${req.file.filename}`
    }

    logger.info(`Voucher uploaded: ${req.file.filename}`)
    res.status(201).json(successResponse(voucherData, 'Voucher uploaded successfully'))
  } catch (error) {
    logger.error('Upload voucher error:', error)
    
    // Clean up file if it exists
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path)
      } catch (cleanupError) {
        logger.error('Error cleaning up file:', cleanupError)
      }
    }
    
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Upload document
 */
export async function uploadDocument(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json(commonErrors.badRequest('No document file uploaded'))
    }

    // Validate file type
    const validation = validateFile(req.file, 'document')
    if (!validation.valid) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path)
      return res.status(400).json(commonErrors.badRequest(validation.error))
    }

    const documentData = {
      filename: req.file.filename,
      original_name: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      url: `/uploads/documents/${req.file.filename}`
    }

    logger.info(`Document uploaded: ${req.file.filename}`)
    res.status(201).json(successResponse(documentData, 'Document uploaded successfully'))
  } catch (error) {
    logger.error('Upload document error:', error)
    
    // Clean up file if it exists
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path)
      } catch (cleanupError) {
        logger.error('Error cleaning up file:', cleanupError)
      }
    }
    
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Upload multiple images
 */
export async function uploadMultipleImages(req, res) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json(commonErrors.badRequest('No image files uploaded'))
    }

    const uploadedImages = []
    const errors = []

    // Process each file
    for (const file of req.files) {
      const validation = validateFile(file, 'image')
      if (!validation.valid) {
        // Clean up invalid file
        try {
          fs.unlinkSync(file.path)
        } catch (cleanupError) {
          logger.error('Error cleaning up invalid file:', cleanupError)
        }
        errors.push(`${file.originalname}: ${validation.error}`)
        continue
      }

      uploadedImages.push({
        filename: file.filename,
        original_name: file.originalname,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype,
        url: `/uploads/images/${file.filename}`
      })
    }

    if (uploadedImages.length === 0) {
      return res.status(400).json(commonErrors.badRequest('No valid images uploaded'))
    }

    const response = {
      uploaded_images: uploadedImages,
      total_uploaded: uploadedImages.length,
      total_attempted: req.files.length
    }

    if (errors.length > 0) {
      response.errors = errors
    }

    logger.info(`Multiple images uploaded: ${uploadedImages.length} successful, ${errors.length} failed`)
    res.status(201).json(successResponse(response, 'Images uploaded'))
  } catch (error) {
    logger.error('Upload multiple images error:', error)
    
    // Clean up all files if error occurs
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        try {
          fs.unlinkSync(file.path)
        } catch (cleanupError) {
          logger.error('Error cleaning up file:', cleanupError)
        }
      })
    }
    
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Delete uploaded file
 */
export async function deleteFile(req, res) {
  try {
    const { type, filename } = req.params

    // Validate type
    const validTypes = ['images', 'vouchers', 'documents']
    if (!validTypes.includes(type)) {
      return res.status(400).json(commonErrors.badRequest('Invalid file type'))
    }

    // Construct file path
    const filePath = path.join(process.cwd(), 'src', 'uploads', type, filename)

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json(commonErrors.notFound('File'))
    }

    // Delete file
    fs.unlinkSync(filePath)

    logger.info(`File deleted: ${type}/${filename}`)
    res.json(successResponse(null, 'File deleted successfully'))
  } catch (error) {
    logger.error('Delete file error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Get file info
 */
export async function getFileInfo(req, res) {
  try {
    const { type, filename } = req.params

    // Validate type
    const validTypes = ['images', 'vouchers', 'documents']
    if (!validTypes.includes(type)) {
      return res.status(400).json(commonErrors.badRequest('Invalid file type'))
    }

    // Construct file path
    const filePath = path.join(process.cwd(), 'src', 'uploads', type, filename)

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json(commonErrors.notFound('File'))
    }

    // Get file stats
    const stats = fs.statSync(filePath)

    const fileInfo = {
      filename,
      type,
      size: stats.size,
      created_at: stats.birthtime,
      modified_at: stats.mtime,
      url: `/uploads/${type}/${filename}`
    }

    res.json(successResponse(fileInfo))
  } catch (error) {
    logger.error('Get file info error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * List files in directory
 */
export async function listFiles(req, res) {
  try {
    const { type } = req.params
    const { page = 1, limit = 20 } = req.query

    // Validate type
    const validTypes = ['images', 'vouchers', 'documents']
    if (!validTypes.includes(type)) {
      return res.status(400).json(commonErrors.badRequest('Invalid file type'))
    }

    // Construct directory path
    const dirPath = path.join(process.cwd(), 'src', 'uploads', type)

    // Check if directory exists
    if (!fs.existsSync(dirPath)) {
      return res.json(successResponse({
        files: [],
        total: 0,
        page: parseInt(page),
        limit: parseInt(limit)
      }))
    }

    // Read directory
    const files = fs.readdirSync(dirPath)
    const fileInfos = []

    // Get file info for each file
    for (const filename of files) {
      try {
        const filePath = path.join(dirPath, filename)
        const stats = fs.statSync(filePath)

        fileInfos.push({
          filename,
          type,
          size: stats.size,
          created_at: stats.birthtime,
          modified_at: stats.mtime,
          url: `/uploads/${type}/${filename}`
        })
      } catch (fileError) {
        logger.warn(`Error reading file ${filename}:`, fileError)
      }
    }

    // Sort by creation date (newest first)
    fileInfos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    // Apply pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit)
    const endIndex = startIndex + parseInt(limit)
    const paginatedFiles = fileInfos.slice(startIndex, endIndex)

    const result = {
      files: paginatedFiles,
      total: fileInfos.length,
      page: parseInt(page),
      limit: parseInt(limit),
      total_pages: Math.ceil(fileInfos.length / parseInt(limit))
    }

    res.json(successResponse(result))
  } catch (error) {
    logger.error('List files error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Get upload statistics
 */
export async function getUploadStats(req, res) {
  try {
    const types = ['images', 'vouchers', 'documents']
    const stats = {}

    for (const type of types) {
      const dirPath = path.join(process.cwd(), 'src', 'uploads', type)
      
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath)
        let totalSize = 0

        files.forEach(filename => {
          try {
            const filePath = path.join(dirPath, filename)
            const fileStats = fs.statSync(filePath)
            totalSize += fileStats.size
          } catch (error) {
            // Skip problematic files
          }
        })

        stats[type] = {
          count: files.length,
          total_size: totalSize,
          total_size_mb: Math.round(totalSize / (1024 * 1024) * 100) / 100
        }
      } else {
        stats[type] = {
          count: 0,
          total_size: 0,
          total_size_mb: 0
        }
      }
    }

    res.json(successResponse(stats))
  } catch (error) {
    logger.error('Get upload stats error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

export default {
  uploadImage,
  uploadVoucher,
  uploadDocument,
  uploadMultipleImages,
  deleteFile,
  getFileInfo,
  listFiles,
  getUploadStats
}