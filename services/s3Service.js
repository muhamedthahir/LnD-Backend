// s3Service.js - AWS S3 Service for file uploads

const { S3Client, CreateBucketCommand, PutObjectCommand, HeadBucketCommand, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const getAwsCredentials = () => ({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const getAwsRegion = () => process.env.AWS_REGION || 'us-east-1';

// Initialize S3 Client from environment variables (server-side uploads)
const getS3Client = () => {
  return new S3Client({
    region: getAwsRegion(),
    credentials: getAwsCredentials()
  });
};

/**
 * S3 client for browser presigned PUT uploads.
 * AWS SDK v3.729+ defaults to checksum headers in PutObject signatures; browsers
 * cannot reproduce those headers, which causes 403 SignatureDoesNotMatch.
 */
const getPresignedUploadS3Client = () => {
  return new S3Client({
    region: getAwsRegion(),
    credentials: getAwsCredentials(),
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED'
  });
};

const redactPresignedUrl = (url) => {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}?[signed-query]`;
  } catch {
    return '[invalid-presigned-url]';
  }
};

const logPresignedUploadContext = (phase, details) => {
  console.info('[S3 presigned upload]', phase, {
    bucket: details.bucket,
    region: details.region,
    key: details.key,
    contentType: details.contentType,
    presignedUrl: details.presignedUrl ? redactPresignedUrl(details.presignedUrl) : undefined,
    expiresIn: details.expiresIn,
    ...details.extra
  });
};

/**
 * Create a new S3 bucket
 * @param {string} bucketName - Name of the bucket to create
 * @returns {Promise<object>} - Result of bucket creation
 */
const createBucket = async (bucketName) => {
  const s3Client = getS3Client();
  const bucket = bucketName || process.env.S3_BUCKET_NAME;

  try {
    // Check if bucket already exists
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
      console.log(`Bucket '${bucket}' already exists`);
      return { success: true, message: 'Bucket already exists', bucketName: bucket };
    } catch (headError) {
      // Bucket doesn't exist, create it
      if (headError.name === 'NotFound' || headError.$metadata?.httpStatusCode === 404) {
        const createParams = {
          Bucket: bucket
        };

        // Add location constraint for non-us-east-1 regions
        const region = process.env.AWS_REGION || 'us-east-1';
        if (region !== 'us-east-1') {
          createParams.CreateBucketConfiguration = {
            LocationConstraint: region
          };
        }

        await s3Client.send(new CreateBucketCommand(createParams));
        console.log(`Bucket '${bucket}' created successfully`);
        return { success: true, message: 'Bucket created successfully', bucketName: bucket };
      }
      throw headError;
    }
  } catch (error) {
    console.error('Error creating bucket:', error);
    throw error;
  }
};

/**
 * Generate S3 key path based on course, section, and lesson
 * @param {object} params - Path parameters
 * @returns {string} - S3 key path
 */
const generateS3Key = ({ courseId, courseName, sectionId, sectionName, lessonName, fileName }) => {
  const sanitize = (str) => {
    if (!str) return '';
    return str.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50);
  };

  let path = '';

  // Course folder: courseId_courseName
  if (courseId && courseName) {
    path += `${courseId}_${sanitize(courseName)}/`;
  } else if (courseId) {
    path += `${courseId}/`;
  }

  // Section folder: sectionId_sectionName
  if (sectionId && sectionName) {
    path += `${sectionId}_${sanitize(sectionName)}/`;
  } else if (sectionId) {
    path += `${sectionId}/`;
  }

  // Lesson folder
  if (lessonName) {
    path += `${sanitize(lessonName)}/`;
  }

  // Append filename with timestamp to avoid collisions
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-_]/g, '_');
  path += `${timestamp}_${sanitizedFileName}`;

  return path;
};

/**
 * Upload a file to S3
 * @param {object} params - Upload parameters
 * @returns {Promise<object>} - Upload result with S3 URL
 */
const uploadFile = async ({ 
  file, 
  courseId, 
  courseName, 
  sectionId, 
  sectionName, 
  lessonName,
  fileName,
  contentType 
}) => {
  const s3Client = getS3Client();
  const bucket = process.env.S3_BUCKET_NAME;

  if (!bucket) {
    throw new Error('S3_BUCKET_NAME environment variable is not set');
  }

  // Generate the S3 key path
  const key = generateS3Key({
    courseId,
    courseName,
    sectionId,
    sectionName,
    lessonName,
    fileName: fileName || file.originalname
  });

  const uploadParams = {
    Bucket: bucket,
    Key: key,
    Body: file.buffer,
    ContentType: contentType || file.mimetype,
    Metadata: {
      courseId: String(courseId || ''),
      sectionId: String(sectionId || ''),
      lessonName: lessonName || '',
      originalName: file.originalname || fileName
    }
  };

  try {
    await s3Client.send(new PutObjectCommand(uploadParams));

    // Construct the S3 URL
    const region = process.env.AWS_REGION || 'us-east-1';
    const s3Url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    console.log(`File uploaded successfully to: ${s3Url}`);

    return {
      success: true,
      message: 'File uploaded successfully',
      url: s3Url,
      key: key,
      bucket: bucket,
      fileName: fileName || file.originalname,
      contentType: contentType || file.mimetype,
      size: file.size
    };
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw error;
  }
};

/**
 * Upload multiple files to S3
 * @param {object} params - Upload parameters with files array
 * @returns {Promise<object[]>} - Array of upload results
 */
const uploadMultipleFiles = async ({ 
  files, 
  courseId, 
  courseName, 
  sectionId, 
  sectionName, 
  lessonName 
}) => {
  const results = [];
  const errors = [];

  for (const file of files) {
    try {
      const result = await uploadFile({
        file,
        courseId,
        courseName,
        sectionId,
        sectionName,
        lessonName
      });
      results.push(result);
    } catch (error) {
      errors.push({
        fileName: file.originalname,
        error: error.message
      });
    }
  }

  return {
    success: errors.length === 0,
    uploaded: results,
    failed: errors,
    message: errors.length === 0 
      ? `Successfully uploaded ${results.length} file(s)` 
      : `Uploaded ${results.length} file(s), ${errors.length} failed`
  };
};

/**
 * Delete a file from S3
 * @param {string} key - S3 object key
 * @returns {Promise<object>} - Deletion result
 */
const deleteFile = async (key) => {
  const s3Client = getS3Client();
  const bucket = process.env.S3_BUCKET_NAME;

  try {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: key
    }));

    return { success: true, message: 'File deleted successfully' };
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    throw error;
  }
};

/**
 * Get a file from S3
 * @param {string} key - S3 object key
 * @returns {Promise<object>} - File stream and metadata
 */
const getFile = async (key) => {
  const s3Client = getS3Client();
  const bucket = process.env.S3_BUCKET_NAME;

  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key
    }));

    return {
      body: response.Body,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      metadata: response.Metadata
    };
  } catch (error) {
    console.error('Error getting file from S3:', error);
    throw error;
  }
};

/**
 * Generate a presigned URL for a file in S3
 * @param {string} key - S3 object key
 * @param {number} expiresIn - Expiration time in seconds (default: 3 hours = 10800 seconds)
 * @param {string|null} responseContentType - Optional Content-Type override for playback
 * @returns {Promise<string>} - Presigned URL
 */
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

const inferContentTypeFromKey = (key) => {
  const fileName = String(key || '').split('/').pop() || '';
  const extension = fileName.split('.').pop()?.toLowerCase();
  return extension ? EXTENSION_TO_MIME[extension] || null : null;
};

const getPresignedUrl = async (key, expiresIn = 10800, responseContentType = null) => {
  const s3Client = getS3Client();
  const bucket = process.env.S3_BUCKET_NAME;

  if (!bucket) {
    throw new Error('S3_BUCKET_NAME environment variable is not set');
  }

  try {
    const commandInput = {
      Bucket: bucket,
      Key: key
    };

    const resolvedContentType = responseContentType || inferContentTypeFromKey(key);
    if (resolvedContentType) {
      commandInput.ResponseContentType = resolvedContentType;
    }

    const command = new GetObjectCommand(commandInput);

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return presignedUrl;
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw error;
  }
};

/**
 * Convert content object URLs to presigned URLs
 * @param {object} content - The segment content object
 * @param {number} expiresIn - Expiration time in seconds (default: 3 hours)
 * @returns {Promise<object>} - Content with presigned URLs
 */
const convertToPresignedUrls = async (content, expiresIn = 10800) => {
  if (!content || content.source !== 'upload') {
    return content;
  }

  // Check if S3 is configured before attempting to generate presigned URLs
  const bucket = process.env.S3_BUCKET_NAME;
  if (!bucket) {
    // S3 is not configured, return original content with existing URLs
    return content;
  }

  try {
    const updatedContent = { ...content };

    // Single file (video/audio)
    if (content.key) {
      try {
        updatedContent.presignedUrl = await getPresignedUrl(content.key, expiresIn);
      } catch (error) {
        console.error('Error generating presigned URL for single file:', error);
        // Keep original URL if presigning fails
      }
    }

    // Multiple files (documents)
    if (content.files && Array.isArray(content.files)) {
      updatedContent.files = await Promise.all(
        content.files.map(async (file) => {
          if (file.key) {
            try {
              return {
                ...file,
                presignedUrl: await getPresignedUrl(file.key, expiresIn)
              };
            } catch (error) {
              console.error('Error generating presigned URL for file:', file.key, error);
              // Return original file if presigning fails
              return file;
            }
          }
          return file;
        })
      );
    }

    return updatedContent;
  } catch (error) {
    console.error('Error converting to presigned URLs:', error);
    // Return original content if presigning fails
    return content;
  }
};

/**
 * Delete all files in a folder (prefix) from S3
 * @param {string} prefix - The folder prefix to delete (e.g., "courseId_name/sectionId_name/")
 * @returns {Promise<object>} - Deletion result
 */
const deleteFolder = async (prefix) => {
  const s3Client = getS3Client();
  const bucket = process.env.S3_BUCKET_NAME;

  if (!bucket) {
    throw new Error('S3_BUCKET_NAME environment variable is not set');
  }

  if (!prefix) {
    throw new Error('Prefix is required');
  }

  // Ensure prefix ends with /
  const folderPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;

  try {
    let totalDeleted = 0;
    let continuationToken = null;

    // List and delete all objects with the given prefix
    do {
      const listParams = {
        Bucket: bucket,
        Prefix: folderPrefix,
        ContinuationToken: continuationToken
      };

      const listResponse = await s3Client.send(new ListObjectsV2Command(listParams));

      if (listResponse.Contents && listResponse.Contents.length > 0) {
        // Delete objects in batches (max 1000 per request)
        const deleteParams = {
          Bucket: bucket,
          Delete: {
            Objects: listResponse.Contents.map(obj => ({ Key: obj.Key })),
            Quiet: true
          }
        };

        await s3Client.send(new DeleteObjectsCommand(deleteParams));
        totalDeleted += listResponse.Contents.length;
        console.log(`Deleted ${listResponse.Contents.length} objects from ${folderPrefix}`);
      }

      continuationToken = listResponse.IsTruncated ? listResponse.NextContinuationToken : null;
    } while (continuationToken);

    console.log(`Total ${totalDeleted} objects deleted from folder: ${folderPrefix}`);
    return { success: true, message: `Deleted ${totalDeleted} objects from folder`, deletedCount: totalDeleted };
  } catch (error) {
    console.error('Error deleting folder from S3:', error);
    throw error;
  }
};

/**
 * Generate folder path for a section
 * @param {number} courseId - Course ID
 * @param {string} courseName - Course name
 * @param {number} sectionId - Section ID
 * @param {string} sectionName - Section name
 * @returns {string} - Folder path
 */
const generateSectionFolderPath = (courseId, courseName, sectionId, sectionName) => {
  const sanitize = (str) => {
    if (!str) return '';
    return str.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50);
  };

  let path = '';
  if (courseId && courseName) {
    path += `${courseId}_${sanitize(courseName)}/`;
  } else if (courseId) {
    path += `${courseId}/`;
  }

  if (sectionId && sectionName) {
    path += `${sectionId}_${sanitize(sectionName)}/`;
  } else if (sectionId) {
    path += `${sectionId}/`;
  }

  return path;
};

/**
 * Generate folder path for a lesson
 * @param {number} courseId - Course ID
 * @param {string} courseName - Course name
 * @param {number} sectionId - Section ID
 * @param {string} sectionName - Section name
 * @param {string} lessonName - Lesson name
 * @returns {string} - Folder path
 */
const generateLessonFolderPath = (courseId, courseName, sectionId, sectionName, lessonName) => {
  const sanitize = (str) => {
    if (!str) return '';
    return str.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50);
  };

  let path = generateSectionFolderPath(courseId, courseName, sectionId, sectionName);
  
  if (lessonName) {
    path += `${sanitize(lessonName)}/`;
  }

  return path;
};

/**
 * Generate a presigned URL for uploading a file to S3
 * @param {string} key - The S3 object key (file path)
 * @param {string} contentType - The content type of the file
 * @param {number} expiresIn - Expiration time in seconds (default 1 hour)
 * @returns {Promise<object>} - Object containing presigned URL and key
 */
const generatePresignedUploadUrl = async (key, contentType, expiresIn = 3600) => {
  const bucket = process.env.S3_BUCKET_NAME;
  const region = getAwsRegion();

  // Check if S3 is configured
  if (!bucket || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('S3 is not configured. Please set S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY environment variables.');
  }

  if (!contentType) {
    throw new Error('contentType is required for presigned upload URLs');
  }

  const s3Client = getPresignedUploadS3Client();

  try {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });

    // Generate the final S3 URL (what the file URL will be after upload)
    const fileUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    logPresignedUploadContext('generated', {
      bucket,
      region,
      key,
      contentType,
      presignedUrl,
      expiresIn
    });

    return {
      presignedUrl,
      key,
      fileUrl,
      contentType,
      bucket,
      region,
      expiresIn
    };
  } catch (error) {
    console.error('[S3 presigned upload] generation failed', {
      bucket,
      region,
      key,
      contentType,
      message: error.message,
      name: error.name
    });
    throw error;
  }
};

/**
 * Generate presigned upload URLs for multiple files
 * @param {Array} files - Array of {fileName, contentType, folderPath}
 * @param {number} expiresIn - Expiration time in seconds
 * @returns {Promise<Array>} - Array of presigned URL objects
 */
const generatePresignedUploadUrls = async (files, expiresIn = 3600) => {
  const results = [];
  
  for (const file of files) {
    const key = `${file.folderPath}${file.fileName}`;
    const result = await generatePresignedUploadUrl(key, file.contentType, expiresIn);
    results.push({
      ...result,
      originalFileName: file.fileName
    });
  }
  
  return results;
};

module.exports = {
  createBucket,
  uploadFile,
  uploadMultipleFiles,
  deleteFile,
  getFile,
  generateS3Key,
  getPresignedUrl,
  convertToPresignedUrls,
  deleteFolder,
  generateSectionFolderPath,
  generateLessonFolderPath,
  generatePresignedUploadUrl,
  generatePresignedUploadUrls,
  redactPresignedUrl,
  logPresignedUploadContext
};

