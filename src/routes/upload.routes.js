import { Router } from 'express'
import {
  uploadImage,
  uploadVoucher,
  uploadDocument,
  uploadMultipleImages,
  deleteFile,
  getFileInfo,
  listFiles,
  getUploadStats
} from '../controllers/upload.controller.js'
import { authenticateUser, requireRole } from '../middleware/auth.js'
import {
  uploadImage as uploadImageMiddleware,
  uploadVoucher as uploadVoucherMiddleware,
  uploadDocument as uploadDocumentMiddleware,
  uploadMultipleImages as uploadMultipleImagesMiddleware,
  handleMulterError
} from '../config/multer.js'

const router = Router()

/**
 * Upload routes - Some public, some protected
 */

// Upload single image (for products - admin only)
router.post('/image',
  authenticateUser,
  requireRole('ADMIN'),
  uploadImageMiddleware.single('image'),
  handleMulterError,
  uploadImage
)

// Upload multiple images (for products - admin only)
router.post('/images',
  authenticateUser,
  requireRole('ADMIN'),
  uploadMultipleImagesMiddleware.array('images', 5),
  handleMulterError,
  uploadMultipleImages
)

// Upload voucher (public - customers can upload payment vouchers)
router.post('/voucher',
  uploadVoucherMiddleware.single('voucher'),
  handleMulterError,
  uploadVoucher
)

// Upload document (admin only)
router.post('/document',
  authenticateUser,
  requireRole('ADMIN'),
  uploadDocumentMiddleware.single('document'),
  handleMulterError,
  uploadDocument
)

/**
 * File management routes - Admin only
 */

// Get file information
router.get('/file/:type/:filename',
  authenticateUser,
  requireRole('ADMIN'),
  getFileInfo
)

// List files in directory
router.get('/files/:type',
  authenticateUser,
  requireRole('ADMIN'),
  listFiles
)

// Delete file
router.delete('/file/:type/:filename',
  authenticateUser,
  requireRole('ADMIN'),
  deleteFile
)

// Get upload statistics
router.get('/stats',
  authenticateUser,
  requireRole('ADMIN'),
  getUploadStats
)

export default router