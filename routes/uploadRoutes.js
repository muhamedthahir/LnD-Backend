// uploadRoutes.js - Routes for file upload operations

const express = require('express');
const router = express.Router();
const multer = require('multer');
const uploadController = require('../controllers/uploadController');

// Configure multer for memory storage (files will be uploaded to S3)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max (for videos)
    files: 10 // Maximum 10 files at once
  }
});

// Upload single file
// POST /api/upload
router.post('/', upload.single('file'), uploadController.uploadFile);

// Upload multiple files
// POST /api/upload/multiple
router.post('/multiple', upload.array('files', 10), uploadController.uploadMultipleFiles);

// Delete a file
// DELETE /api/upload/delete (key passed in body)
router.delete('/delete', uploadController.deleteFile);

// Create S3 bucket (admin only - can add auth middleware later)
// POST /api/upload/create-bucket
router.post('/create-bucket', uploadController.createBucket);

// Get allowed file types
// GET /api/upload/allowed-types
router.get('/allowed-types', uploadController.getAllowedTypes);

// Get presigned URL for direct S3 upload (single file)
// POST /api/upload/presigned-url
router.post('/presigned-url', uploadController.getPresignedUploadUrl);

// Get presigned URLs for direct S3 upload (multiple files)
// POST /api/upload/presigned-urls
router.post('/presigned-urls', uploadController.getPresignedUploadUrls);

module.exports = router;

