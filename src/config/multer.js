import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads')
const vouchersDir = path.join(uploadsDir, 'vouchers')
const imagesDir = path.join(uploadsDir, 'images')
const documentsDir = path.join(uploadsDir, 'documents')
const qrDir = path.join(uploadsDir, 'qr')

// Create directories array
const dirsToCreate = [uploadsDir, vouchersDir, imagesDir, documentsDir, qrDir]

// Ensure directories exist
dirsToCreate.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
})

// File filter function
const fileFilter = (allowedTypes) => {
  return (req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`), false)
    }
  }
}

// Generate unique filename
const generateFileName = (originalname) => {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 1000)
  const ext = path.extname(originalname)
  const name = path.basename(originalname, ext).replace(/[^a-zA-Z0-9]/g, '')
  return `${timestamp}-${random}-${name}${ext}`
}

// Storage configuration for vouchers
const voucherStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, vouchersDir)
  },
  filename: (req, file, cb) => {
    cb(null, generateFileName(file.originalname))
  }
})

// Storage configuration for images
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, imagesDir)
  },
  filename: (req, file, cb) => {
    cb(null, generateFileName(file.originalname))
  }
})

// Storage configuration for documents
const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, documentsDir)
  },
  filename: (req, file, cb) => {
    cb(null, generateFileName(file.originalname))
  }
})

// File type definitions
const IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/webp'
]

const DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]

const VOUCHER_TYPES = [
  ...IMAGE_TYPES,
  'application/pdf'
]

// Multer configurations
export const uploadVoucher = multer({
  storage: voucherStorage,
  fileFilter: fileFilter(VOUCHER_TYPES),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  }
})

export const uploadImage = multer({
  storage: imageStorage,
  fileFilter: fileFilter(IMAGE_TYPES),
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB
    files: 1
  }
})

export const uploadDocument = multer({
  storage: documentStorage,
  fileFilter: fileFilter(DOCUMENT_TYPES),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  }
})

// Multiple files upload
export const uploadMultipleImages = multer({
  storage: imageStorage,
  fileFilter: fileFilter(IMAGE_TYPES),
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB per file
    files: 5 // Maximum 5 files
  }
})

// Generic upload with dynamic configuration
export const createUpload = (type, maxSize = 5, maxFiles = 1) => {
  let allowedTypes, storage

  switch (type) {
    case 'image':
      allowedTypes = IMAGE_TYPES
      storage = imageStorage
      break
    case 'document':
      allowedTypes = DOCUMENT_TYPES
      storage = documentStorage
      break
    case 'voucher':
      allowedTypes = VOUCHER_TYPES
      storage = voucherStorage
      break
    default:
      throw new Error('Invalid upload type')
  }

  return multer({
    storage,
    fileFilter: fileFilter(allowedTypes),
    limits: {
      fileSize: maxSize * 1024 * 1024, // Convert MB to bytes
      files: maxFiles
    }
  })
}

// Error handling middleware for multer
export const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'File size exceeds the allowed limit'
          }
        })
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          error: {
            code: 'TOO_MANY_FILES',
            message: 'Too many files uploaded'
          }
        })
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          error: {
            code: 'UNEXPECTED_FILE',
            message: 'Unexpected file field'
          }
        })
      default:
        return res.status(400).json({
          success: false,
          error: {
            code: 'UPLOAD_ERROR',
            message: 'File upload error'
          }
        })
    }
  }

  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_FILE_TYPE',
        message: error.message
      }
    })
  }

  next(error)
}

// File validation helper
export const validateFile = (file, type) => {
  if (!file) {
    return { valid: false, error: 'No file provided' }
  }

  let allowedTypes
  switch (type) {
    case 'image':
      allowedTypes = IMAGE_TYPES
      break
    case 'document':
      allowedTypes = DOCUMENT_TYPES
      break
    case 'voucher':
      allowedTypes = VOUCHER_TYPES
      break
    default:
      return { valid: false, error: 'Invalid validation type' }
  }

  if (!allowedTypes.includes(file.mimetype)) {
    return { 
      valid: false, 
      error: `Invalid file type. Allowed: ${allowedTypes.join(', ')}` 
    }
  }

  return { valid: true }
}

// Clean up old files helper
export const cleanupOldFiles = (directory, maxAgeInDays = 30) => {
  const maxAge = maxAgeInDays * 24 * 60 * 60 * 1000 // Convert days to milliseconds
  const now = Date.now()

  try {
    const files = fs.readdirSync(directory)
    
    files.forEach(file => {
      const filePath = path.join(directory, file)
      const stats = fs.statSync(filePath)
      
      if (now - stats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filePath)
        console.log(`Cleaned up old file: ${file}`)
      }
    })
  } catch (error) {
    console.error('Error cleaning up old files:', error)
  }
}

export default {
  uploadVoucher,
  uploadImage,
  uploadDocument,
  uploadMultipleImages,
  createUpload,
  handleMulterError,
  validateFile,
  cleanupOldFiles
}