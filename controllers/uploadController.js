// uploadController.js - Controller for file upload operations

const s3Service = require('../services/s3Service');

// Allowed file types
const ALLOWED_MIME_TYPES = {
  // Audio
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
  
  // Video
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogg',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  
  // Documents
  'application/pdf': 'pdf',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
  
  // Images (for thumbnails)
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp'
};

const EXTENSION_TO_MIME = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  webm: 'video/webm',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  pdf: 'application/pdf',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp'
};

const resolveUploadContentType = (fileName, contentType) => {
  const normalized = String(contentType || '').trim();
  if (normalized && normalized !== 'application/octet-stream' && ALLOWED_MIME_TYPES[normalized]) {
    return normalized;
  }

  const extension = String(fileName || '').split('.').pop()?.toLowerCase();
  const inferred = extension ? EXTENSION_TO_MIME[extension] : null;
  if (inferred && ALLOWED_MIME_TYPES[inferred]) {
    return inferred;
  }

  return null;
};

// Maximum file sizes (in bytes)
const MAX_FILE_SIZES = {
  audio: 100 * 1024 * 1024,    // 100MB for audio
  video: 500 * 1024 * 1024,    // 500MB for video
  document: 50 * 1024 * 1024,  // 50MB for documents
  image: 10 * 1024 * 1024      // 10MB for images
};

/**
 * Get file category from mime type
 */
const getFileCategory = (mimeType) => {
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('image/')) return 'image';
  return 'document';
};

/**
 * Validate file
 */
const validateFile = (file) => {
  // Check if mime type is allowed
  if (!ALLOWED_MIME_TYPES[file.mimetype]) {
    return {
      valid: false,
      error: `File type '${file.mimetype}' is not allowed. Allowed types: audio, video, pdf, ppt, pptx, doc, docx, txt`
    };
  }

  // Check file size
  const category = getFileCategory(file.mimetype);
  const maxSize = MAX_FILE_SIZES[category];
  
  if (file.size > maxSize) {
    const maxSizeMB = maxSize / (1024 * 1024);
    return {
      valid: false,
      error: `File size exceeds maximum allowed (${maxSizeMB}MB for ${category} files)`
    };
  }

  return { valid: true };
};

/**
 * Upload single file
 * POST /api/upload
 */
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Validate file
    const validation = validateFile(req.file);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Extract metadata from request body
    const { courseId, courseName, sectionId, sectionName, lessonName } = req.body;

    // Upload to S3
    const result = await s3Service.uploadFile({
      file: req.file,
      courseId,
      courseName,
      sectionId,
      sectionName,
      lessonName
    });

    res.json({
      success: true,
      message: 'Document uploaded successfully',
      data: result
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload file',
      details: error.message
    });
  }
};

/**
 * Upload multiple files
 * POST /api/upload/multiple
 */
const uploadMultipleFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    // Validate all files
    const validationErrors = [];
    for (const file of req.files) {
      const validation = validateFile(file);
      if (!validation.valid) {
        validationErrors.push({
          fileName: file.originalname,
          error: validation.error
        });
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        error: 'Some files failed validation',
        details: validationErrors
      });
    }

    // Extract metadata from request body
    const { courseId, courseName, sectionId, sectionName, lessonName } = req.body;

    // Upload all files to S3
    const result = await s3Service.uploadMultipleFiles({
      files: req.files,
      courseId,
      courseName,
      sectionId,
      sectionName,
      lessonName
    });

    res.json({
      success: result.success,
      message: result.message,
      data: result
    });

  } catch (error) {
    console.error('Multiple upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload files',
      details: error.message
    });
  }
};

/**
 * Delete a file
 * DELETE /api/upload/delete
 */
const deleteFile = async (req, res) => {
  try {
    const { key } = req.body;

    if (!key) {
      return res.status(400).json({ error: 'File key is required' });
    }

    await s3Service.deleteFile(key);

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ 
      error: 'Failed to delete file',
      details: error.message
    });
  }
};

/**
 * Create S3 bucket (admin only)
 * POST /api/upload/create-bucket
 */
const createBucket = async (req, res) => {
  try {
    const { bucketName } = req.body;

    const result = await s3Service.createBucket(bucketName);

    res.json(result);

  } catch (error) {
    console.error('Create bucket error:', error);
    res.status(500).json({ 
      error: 'Failed to create bucket',
      details: error.message
    });
  }
};

/**
 * Get allowed file types
 * GET /api/upload/allowed-types
 */
const getAllowedTypes = (req, res) => {
  const types = Object.entries(ALLOWED_MIME_TYPES).reduce((acc, [mimeType, ext]) => {
    const category = getFileCategory(mimeType);
    if (!acc[category]) {
      acc[category] = [];
    }
    if (!acc[category].includes(ext)) {
      acc[category].push(ext);
    }
    return acc;
  }, {});

  res.json({
    allowedTypes: types,
    maxSizes: {
      audio: '100MB',
      video: '500MB',
      document: '50MB',
      image: '10MB'
    }
  });
};

/**
 * Get presigned URL for uploading a file directly to S3
 * POST /api/upload/presigned-url
 * 
 * Request body:
 * {
 *   fileName: string,
 *   contentType: string,
 *   courseId: number,
 *   courseName: string,
 *   sectionId: number,
 *   sectionName: string,
 *   lessonName: string
 * }
 */
const getPresignedUploadUrl = async (req, res) => {
  try {
    const { fileName, contentType, courseId, courseName, sectionId, sectionName, lessonName } = req.body;

    if (!fileName) {
      return res.status(400).json({ error: 'fileName is required' });
    }

    const resolvedContentType = resolveUploadContentType(fileName, contentType);
    if (!resolvedContentType) {
      return res.status(400).json({
        error: `Content type '${contentType || ''}' is not allowed for file '${fileName}'`,
        allowedTypes: Object.keys(ALLOWED_MIME_TYPES)
      });
    }

    // Generate folder path based on course/section/lesson
    const folderPath = s3Service.generateLessonFolderPath(
      courseId,
      courseName,
      sectionId,
      sectionName,
      lessonName
    );

    // Generate unique filename to avoid conflicts
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFileName = `${timestamp}_${sanitizedFileName}`;
    const key = `${folderPath}${uniqueFileName}`;

    console.info('[upload/presigned-url] request', {
      fileName,
      requestedContentType: contentType || null,
      resolvedContentType,
      key,
      bucket: process.env.S3_BUCKET_NAME,
      region: process.env.AWS_REGION || 'us-east-1'
    });

    // Generate presigned URL
    const result = await s3Service.generatePresignedUploadUrl(key, resolvedContentType, 3600); // 1 hour expiry

    res.json({
      success: true,
      data: {
        presignedUrl: result.presignedUrl,
        key: result.key,
        fileUrl: result.fileUrl,
        fileName: uniqueFileName,
        originalFileName: fileName,
        contentType: result.contentType,
        bucket: result.bucket,
        region: result.region,
        expiresIn: result.expiresIn
      }
    });

  } catch (error) {
    console.error('Get presigned URL error:', error);
    res.status(500).json({ 
      error: 'Failed to generate presigned URL',
      details: error.message
    });
  }
};

/**
 * Get presigned URLs for uploading multiple files directly to S3
 * POST /api/upload/presigned-urls
 * 
 * Request body:
 * {
 *   files: [{ fileName: string, contentType: string }],
 *   courseId: number,
 *   courseName: string,
 *   sectionId: number,
 *   sectionName: string,
 *   lessonName: string
 * }
 */
const getPresignedUploadUrls = async (req, res) => {
  try {
    const { files, courseId, courseName, sectionId, sectionName, lessonName } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'files array is required' });
    }

    const resolvedFiles = [];
    for (const file of files) {
      if (!file.fileName) {
        return res.status(400).json({ error: 'Each file must have fileName' });
      }

      const resolvedContentType = resolveUploadContentType(file.fileName, file.contentType);
      if (!resolvedContentType) {
        return res.status(400).json({
          error: `Content type '${file.contentType || ''}' for file '${file.fileName}' is not allowed`
        });
      }

      resolvedFiles.push({
        ...file,
        resolvedContentType
      });
    }

    // Generate folder path
    const folderPath = s3Service.generateLessonFolderPath(
      courseId,
      courseName,
      sectionId,
      sectionName,
      lessonName
    );

    // Prepare files with unique names and folder paths
    const timestamp = Date.now();
    const filesWithPaths = resolvedFiles.map((file, index) => {
      const sanitizedFileName = file.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueFileName = `${timestamp}_${index}_${sanitizedFileName}`;
      return {
        fileName: uniqueFileName,
        originalFileName: file.fileName,
        contentType: file.resolvedContentType,
        folderPath
      };
    });

    console.info('[upload/presigned-urls] request', {
      fileCount: filesWithPaths.length,
      bucket: process.env.S3_BUCKET_NAME,
      region: process.env.AWS_REGION || 'us-east-1',
      files: filesWithPaths.map((file) => ({
        originalFileName: file.originalFileName,
        contentType: file.contentType,
        key: `${file.folderPath}${file.fileName}`
      }))
    });

    // Generate presigned URLs
    const results = await s3Service.generatePresignedUploadUrls(filesWithPaths, 3600);

    res.json({
      success: true,
      data: results.map((result, index) => ({
        presignedUrl: result.presignedUrl,
        key: result.key,
        fileUrl: result.fileUrl,
        fileName: filesWithPaths[index].fileName,
        originalFileName: files[index].fileName,
        contentType: result.contentType,
        bucket: result.bucket,
        region: result.region,
        expiresIn: result.expiresIn
      }))
    });

  } catch (error) {
    console.error('Get presigned URLs error:', error);
    res.status(500).json({ 
      error: 'Failed to generate presigned URLs',
      details: error.message
    });
  }
};

/**
 * Get a presigned URL for downloading/streaming a file from S3
 * POST /api/upload/presigned-download
 *
 * Request body: { key: string }
 */
const getPresignedDownloadUrl = async (req, res) => {
  try {
    const { key } = req.body;

    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: 'key is required' });
    }

    const presignedUrl = await s3Service.getPresignedUrl(key);

    res.json({
      success: true,
      data: {
        key,
        presignedUrl
      }
    });
  } catch (error) {
    console.error('Get presigned download URL error:', error);
    res.status(500).json({
      error: 'Failed to generate presigned download URL',
      details: error.message
    });
  }
};

module.exports = {
  uploadFile,
  uploadMultipleFiles,
  deleteFile,
  createBucket,
  getAllowedTypes,
  getPresignedUploadUrl,
  getPresignedUploadUrls,
  getPresignedDownloadUrl
};

