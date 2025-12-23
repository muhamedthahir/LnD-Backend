const Segment = require('../models/Segment');
const Concept = require('../models/Concept');
const InClassPractice = require('../models/InClassPractice');
const PostClassPractice = require('../models/PostClassPractice');

const VALID_SEGMENT_TYPES = ['coding', 'mcq', 'reference_videos', 'articles', 'assessment', 'lesson_text', 'lesson_video', 'lesson_audio', 'lesson_document'];

class SegmentController {
  static async create(req, res) {
    try {
      const { topic_id, name, description, segment_type, order_index, content } = req.body;
      
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

      const segmentId = await Segment.create({
        topic_id,
        name,
        description: description || '',
        segment_type,
        order_index: order_index || 0,
        content: content || {}
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
      res.json(segments);
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

      res.json(segment);
    } catch (error) {
      console.error('Get segment error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const { name, description, segment_type, order_index, content } = req.body;

      const segment = await Segment.findById(id);
      if (!segment) {
        return res.status(404).json({ error: 'Segment not found' });
      }

      if (segment_type && !VALID_SEGMENT_TYPES.includes(segment_type)) {
        return res.status(400).json({ 
          error: `Invalid segment type. Must be one of: ${VALID_SEGMENT_TYPES.join(', ')}` 
        });
      }

      await Segment.update(id, { name, description, segment_type, order_index, content });
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

