const Segment = require('../models/Segment');
const Concept = require('../models/Concept');
const InClassPractice = require('../models/InClassPractice');
const PostClassPractice = require('../models/PostClassPractice');
const s3Service = require('../services/s3Service');
const Topic = require('../models/Topic');
const Course = require('../models/Course');

const VALID_SEGMENT_TYPES = ['coding', 'mcq', 'reference_videos', 'articles', 'assessment', 'lesson_text', 'lesson_video', 'lesson_audio', 'lesson_document'];

// File types that should be uploaded to S3
const FILE_UPLOAD_SEGMENT_TYPES = ['lesson_video', 'lesson_audio', 'lesson_document'];

class SegmentController {
  /**
   * Helper function to delete S3 files from segment content
   * @param {object} content - The segment content object
   * @returns {Promise<void>}
   */
  static async deleteS3FilesFromContent(content) {
    if (!content || content.source !== 'upload') return;

    try {
      // Single file (video/audio)
      if (content.key) {
        console.log(`Deleting S3 file: ${content.key}`);
        await s3Service.deleteFile(content.key);
      }

      // Multiple files (documents)
      if (content.files && Array.isArray(content.files)) {
        for (const file of content.files) {
          if (file.key) {
            console.log(`Deleting S3 file: ${file.key}`);
            await s3Service.deleteFile(file.key);
          }
        }
      }
    } catch (error) {
      // Log error but don't fail the operation
      console.error('Error deleting S3 files:', error);
    }
  }

  /**
   * Helper function to upload files to S3 and get URLs
   */
  static async uploadFilesToS3(files, topic_id, segmentName) {
    if (!files || files.length === 0) return null;

    try {
      // Get course and section info for folder structure
      let courseId, courseName, sectionId, sectionName;
      console.log('topic_id ', topic_id);
      if (topic_id) {
        const topic = await Topic.findById(topic_id);
        if (topic) {
          sectionId = topic.id;
          sectionName = topic.name;
          
          if (topic.course_id) {
            const course = await Course.findById(topic.course_id);
            if (course) {
              courseId = course.id;
              courseName = course.name;
            }
          }
        }
      }

      const uploadResults = await s3Service.uploadMultipleFiles({
        files,
        courseId,
        courseName,
        sectionId,
        sectionName,
        lessonName: segmentName
      });

      return uploadResults;
    } catch (error) {
      console.error('S3 upload error:', error);
      throw error;
    }
  }

  static async create(req, res) {
    try {
      const { topic_id, name, description, segment_type, order_index, threshold_value } = req.body;
      let content = req.body.content;

      // Parse content if it's a string (from FormData)
      if (typeof content === 'string') {
        try {
          content = JSON.parse(content);
        } catch (e) {
          content = {};
        }
      }
      
      if (!topic_id || !name || !segment_type) {
        return res.status(400).json({ 
          error: 'Topic ID, segment name, and segment type are required' 
        });
      }

      if (!VALID_SEGMENT_TYPES.includes(segment_type)) {
        return res.status(400).json({ 
          error: `Invalid segment type. Must be one of: ${VALID_SEGMENT_TYPES.join(', ')}` 
        });
      }

      // Handle file uploads for video, audio, document types
      if (FILE_UPLOAD_SEGMENT_TYPES.includes(segment_type) && req.files && req.files.length > 0) {
        try {
          const uploadResults = await SegmentController.uploadFilesToS3(req.files, topic_id, name);
          
          if (uploadResults && uploadResults.uploaded && uploadResults.uploaded.length > 0) {
            // For single file types (video, audio), store single URL
            if (segment_type === 'lesson_video' || segment_type === 'lesson_audio') {
              content = {
                type: segment_type.replace('lesson_', ''),
                source: 'upload',
                url: uploadResults.uploaded[0].url,
                fileName: uploadResults.uploaded[0].fileName,
                key: uploadResults.uploaded[0].key
              };
            } else if (segment_type === 'lesson_document') {
              // For documents, store array of URLs
              content = {
                type: 'document',
                source: 'upload',
                files: uploadResults.uploaded.map(file => ({
                  url: file.url,
                  fileName: file.fileName,
                  key: file.key,
                  contentType: file.contentType
                }))
              };
            }
          }
        } catch (uploadError) {
          console.error('File upload error:', uploadError);
          return res.status(500).json({ error: 'Failed to upload files to S3' });
        }
      }

      // Parse threshold_value - default to 100 for video/audio types
      let thresholdVal = 100;
      if (threshold_value !== undefined && threshold_value !== null && threshold_value !== '') {
        thresholdVal = parseInt(threshold_value, 10);
        if (isNaN(thresholdVal) || thresholdVal < 0 || thresholdVal > 100) {
          thresholdVal = 100;
        }
      }

      const segmentId = await Segment.create({
        topic_id,
        name,
        description: description || '',
        segment_type,
        order_index: order_index || 0,
        content: content || {},
        threshold_value: thresholdVal
      });

      const segment = await Segment.findById(segmentId);
      res.status(201).json({ message: 'Segment created successfully', segment });
    } catch (error) {
      console.error('Create segment error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getByTopic(req, res) {
    try {
      const { topic_id } = req.params;
      const segments = await Segment.findByTopicId(topic_id);
      
      // Convert S3 URLs to presigned URLs for each segment
      const segmentsWithPresignedUrls = await Promise.all(
        segments.map(async (segment) => {
          if (segment.content && segment.content.source === 'upload') {
            const updatedContent = await s3Service.convertToPresignedUrls(segment.content);
            return { ...segment, content: updatedContent };
          }
          return segment;
        })
      );
      
      res.json(segmentsWithPresignedUrls);
    } catch (error) {
      console.error('Get segments error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const segment = await Segment.getWithRelatedData(id);
      
      if (!segment) {
        return res.status(404).json({ error: 'Segment not found' });
      }

      // Convert S3 URLs to presigned URLs
      if (segment.content && segment.content.source === 'upload') {
        segment.content = await s3Service.convertToPresignedUrls(segment.content);
      }

      res.json(segment);
    } catch (error) {
      console.error('Get segment error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async update(req, res) {
    try {
      console.log('Updating segment');
      const { id } = req.params;
      const { name, description, segment_type, order_index, threshold_value } = req.body;
      let content = req.body.content;
      console.log('req.body ', req.body);
      // Parse content if it's a string (from FormData)
      if (typeof content === 'string') {
        try {
          content = JSON.parse(content);
        } catch (e) {
          content = {};
        }
      }

      const segment = await Segment.findById(id);
      console.log('segment ', segment);
      if (!segment) {
        return res.status(404).json({ error: 'Segment not found' });
      }

      if (segment_type && !VALID_SEGMENT_TYPES.includes(segment_type)) {
        return res.status(400).json({ 
          error: `Invalid segment type. Must be one of: ${VALID_SEGMENT_TYPES.join(', ')}` 
        });
      }

      const effectiveSegmentType = segment_type || segment.segment_type;

      // Check if content type is changing from a file type to another type
      const oldSegmentType = segment.segment_type;
      const isContentTypeChanging = segment_type && segment_type !== oldSegmentType;
      const wasFileType = FILE_UPLOAD_SEGMENT_TYPES.includes(oldSegmentType);
      const isNowFileType = FILE_UPLOAD_SEGMENT_TYPES.includes(effectiveSegmentType);
      console.log('isContentTypeChanging ', isContentTypeChanging);
      // If changing from a file type to a non-file type (e.g., video to article), delete old S3 files
      if (isContentTypeChanging && wasFileType && !isNowFileType) {
        if (segment.content && segment.content.source === 'upload') {
          try {
            console.log(`Content type changed from ${oldSegmentType} to ${effectiveSegmentType}, deleting old S3 files...`);
            await SegmentController.deleteS3FilesFromContent(segment.content);
          } catch (s3Error) {
            console.error('S3 delete error (non-blocking):', s3Error.message);
            // Don't fail the update if S3 delete fails
          }
        }
      }

      // If changing from one file type to another (e.g., video to audio), delete old S3 files
      if (isContentTypeChanging && wasFileType && isNowFileType && oldSegmentType !== effectiveSegmentType) {
        if (segment.content && segment.content.source === 'upload') {
          try {
            console.log(`Content type changed from ${oldSegmentType} to ${effectiveSegmentType}, deleting old S3 files...`);
            await SegmentController.deleteS3FilesFromContent(segment.content);
          } catch (s3Error) {
            console.error('S3 delete error (non-blocking):', s3Error.message);
            // Don't fail the update if S3 delete fails
          }
        }
      }
      console.log('effectiveSegmentType ', effectiveSegmentType);
      // Handle file uploads for video, audio, document types
      if (FILE_UPLOAD_SEGMENT_TYPES.includes(effectiveSegmentType) && req.files && req.files.length > 0) {
        try {
          // Delete old S3 files before uploading new ones (if same type but replacing files)
          if (segment.content && segment.content.source === 'upload' && !isContentTypeChanging) {
            try {
              console.log('Replacing files, deleting old S3 files before uploading new ones...');
              await SegmentController.deleteS3FilesFromContent(segment.content);
            } catch (s3DeleteError) {
              console.error('S3 delete error (non-blocking):', s3DeleteError.message);
              // Continue with upload even if delete fails
            }
          }
          console.log('Uploading files to S3...');
          const uploadResults = await SegmentController.uploadFilesToS3(
            req.files, 
            segment.topic_id, 
            name || segment.name
          );
          
          if (uploadResults && uploadResults.uploaded && uploadResults.uploaded.length > 0) {
            // For single file types (video, audio), store single URL
            if (effectiveSegmentType === 'lesson_video' || effectiveSegmentType === 'lesson_audio') {
              content = {
                type: effectiveSegmentType.replace('lesson_', ''),
                source: 'upload',
                url: uploadResults.uploaded[0].url,
                fileName: uploadResults.uploaded[0].fileName,
                key: uploadResults.uploaded[0].key
              };
            } else if (effectiveSegmentType === 'lesson_document') {
              // For documents, store array of URLs
              content = {
                type: 'document',
                source: 'upload',
                files: uploadResults.uploaded.map(file => ({
                  url: file.url,
                  fileName: file.fileName,
                  key: file.key,
                  contentType: file.contentType
                }))
              };
            }
          }
        } catch (uploadError) {
          console.error('File upload error:', uploadError);
          return res.status(500).json({ error: 'Failed to upload files to S3' });
        }
      }

      // If changing from upload to embedded, delete old S3 files
      if (content && content.source === 'embedded' && segment.content && segment.content.source === 'upload') {
        try {
          console.log('Changing from upload to embedded, deleting old S3 files...');
          await SegmentController.deleteS3FilesFromContent(segment.content);
        } catch (s3Error) {
          console.error('S3 delete error (non-blocking):', s3Error.message);
          // Don't fail the update if S3 delete fails
        }
      }

      // Parse threshold_value if provided
      let thresholdVal = undefined;
      if (threshold_value !== undefined && threshold_value !== null && threshold_value !== '') {
        thresholdVal = parseInt(threshold_value, 10);
        if (isNaN(thresholdVal) || thresholdVal < 0 || thresholdVal > 100) {
          thresholdVal = undefined; // Keep existing value if invalid
        }
      }

      await Segment.update(id, { 
        name: name || segment.name, 
        description: description !== undefined ? description : segment.description, 
        segment_type: effectiveSegmentType, 
        order_index: order_index !== undefined ? order_index : segment.order_index, 
        content: content || segment.content,
        threshold_value: thresholdVal
      });
      const updatedSegment = await Segment.findById(id);
      
      res.json({ message: 'Segment updated successfully', segment: updatedSegment });
    } catch (error) {
      console.error('Update segment error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      
      const segment = await Segment.findById(id);
      if (!segment) {
        return res.status(404).json({ error: 'Segment not found' });
      }

      // Delete entire lesson folder from S3 (includes all files)
      try {
        let course = null;
        let topic = null;
        
        if (segment.topic_id) {
          topic = await Topic.findById(segment.topic_id);
          if (topic && topic.course_id) {
            course = await Course.findById(topic.course_id);
          }
        }

        const lessonFolderPath = s3Service.generateLessonFolderPath(
          course?.id,
          course?.name,
          topic?.id,
          topic?.name,
          segment.name
        );

        if (lessonFolderPath) {
          console.log(`Deleting S3 folder for lesson: ${lessonFolderPath}`);
          await s3Service.deleteFolder(lessonFolderPath);
        }
      } catch (s3Error) {
        // Log but don't fail the deletion if S3 cleanup fails
        console.error('Error deleting S3 folder for lesson:', s3Error);
      }

      await Segment.delete(id);
      res.json({ message: 'Segment deleted successfully' });
    } catch (error) {
      console.error('Delete segment error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Concept management
  static async addConcept(req, res) {
    try {
      const { segment_id } = req.params;
      const { title, content, order_index } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Concept title is required' });
      }

      const conceptId = await Concept.create({
        segment_id,
        title,
        content: content || '',
        order_index: order_index || 0
      });

      res.status(201).json({ message: 'Concept added successfully', concept_id: conceptId });
    } catch (error) {
      console.error('Add concept error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // InClass Practice management
  static async addInClassPractice(req, res) {
    try {
      const { segment_id } = req.params;
      const { title, content, order_index } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Practice title is required' });
      }

      const practiceId = await InClassPractice.create({
        segment_id,
        title,
        content: content || '',
        order_index: order_index || 0
      });

      res.status(201).json({ message: 'In-class practice added successfully', practice_id: practiceId });
    } catch (error) {
      console.error('Add in-class practice error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // PostClass Practice management
  static async addPostClassPractice(req, res) {
    try {
      const { segment_id } = req.params;
      const { title, content, order_index } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Practice title is required' });
      }

      const practiceId = await PostClassPractice.create({
        segment_id,
        title,
        content: content || '',
        order_index: order_index || 0
      });

      res.status(201).json({ message: 'Post-class practice added successfully', practice_id: practiceId });
    } catch (error) {
      console.error('Add post-class practice error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = SegmentController;

