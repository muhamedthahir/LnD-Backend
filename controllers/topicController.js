const Topic = require('../models/Topic');
const Course = require('../models/Course');
const Segment = require('../models/Segment');
const s3Service = require('../services/s3Service');

class TopicController {
  static async create(req, res) {
    try {
      const { course_id, name, description, order_index } = req.body;
      
      if (!course_id || !name) {
        return res.status(400).json({ error: 'Course ID and topic name are required' });
      }

      const topicId = await Topic.create({
        course_id,
        name,
        description: description || '',
        order_index: order_index || 0
      });

      const topic = await Topic.findById(topicId);
      res.status(201).json({ message: 'Topic created successfully', topic });
    } catch (error) {
      console.error('Create topic error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getByCourse(req, res) {
    try {
      const { course_id } = req.params;
      const topics = await Topic.findByCourseId(course_id);
      res.json(topics);
    } catch (error) {
      console.error('Get topics error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const topic = await Topic.getWithSegments(id);
      
      if (!topic) {
        return res.status(404).json({ error: 'Topic not found' });
      }

      res.json(topic);
    } catch (error) {
      console.error('Get topic error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const { name, description, order_index } = req.body;

      const topic = await Topic.findById(id);
      if (!topic) {
        return res.status(404).json({ error: 'Topic not found' });
      }

      await Topic.update(id, { name, description, order_index });
      const updatedTopic = await Topic.findById(id);
      
      res.json({ message: 'Topic updated successfully', topic: updatedTopic });
    } catch (error) {
      console.error('Update topic error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      
      const topic = await Topic.findById(id);
      if (!topic) {
        return res.status(404).json({ error: 'Topic not found' });
      }

      // Get course info for folder path
      let course = null;
      if (topic.course_id) {
        course = await Course.findById(topic.course_id);
      }

      // Delete all S3 files for this section (and all lessons under it)
      try {
        const sectionFolderPath = s3Service.generateSectionFolderPath(
          course?.id,
          course?.name,
          topic.id,
          topic.name
        );

        if (sectionFolderPath) {
          console.log(`Deleting S3 folder for section: ${sectionFolderPath}`);
          await s3Service.deleteFolder(sectionFolderPath);
        }
      } catch (s3Error) {
        // Log but don't fail the deletion if S3 cleanup fails
        console.error('Error deleting S3 folder for section:', s3Error);
      }

      await Topic.delete(id);
      res.json({ message: 'Topic deleted successfully' });
    } catch (error) {
      console.error('Delete topic error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = TopicController;

