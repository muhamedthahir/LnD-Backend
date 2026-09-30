const PracticeSegment = require('../models/PracticeSegment');
const Topic = require('../models/Topic');

class PracticeSegmentController {
  /**
   * Create a new practice segment
   */
  static async create(req, res) {
    try {
      const { name, description, topic_id } = req.body;
      const created_by = req.user?.id;

      if (!name || !topic_id) {
        return res.status(400).json({ 
          error: 'Name and topic_id are required' 
        });
      }

      // Verify topic exists
      const topic = await Topic.findById(topic_id);
      if (!topic) {
        return res.status(404).json({ error: 'Topic not found' });
      }

      const result = await PracticeSegment.create({
        name,
        description,
        topic_id,
        created_by
      });

      const practiceSegment = await PracticeSegment.findById(result.id);
      res.status(201).json({ 
        message: 'Practice segment created successfully', 
        practiceSegment 
      });
    } catch (error) {
      console.error('Create practice segment error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get practice segment by ID
   */
  static async getById(req, res) {
    try {
      const { id } = req.params;
      const practiceSegment = await PracticeSegment.findById(id);

      if (!practiceSegment) {
        return res.status(404).json({ error: 'Practice segment not found' });
      }

      res.json(practiceSegment);
    } catch (error) {
      console.error('Get practice segment error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get practice segments by topic ID
   */
  static async getByTopic(req, res) {
    try {
      const { topic_id } = req.params;
      const practiceSegments = await PracticeSegment.findByTopicId(topic_id);
      res.json(practiceSegments);
    } catch (error) {
      console.error('Get practice segments by topic error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Update a practice segment
   */
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      const updated_by = req.user?.id;

      const practiceSegment = await PracticeSegment.findById(id);
      if (!practiceSegment) {
        return res.status(404).json({ error: 'Practice segment not found' });
      }

      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      await PracticeSegment.update(id, {
        name,
        description,
        updated_by
      });

      const updatedPracticeSegment = await PracticeSegment.findById(id);
      res.json({ 
        message: 'Practice segment updated successfully', 
        practiceSegment: updatedPracticeSegment 
      });
    } catch (error) {
      console.error('Update practice segment error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Delete a practice segment
   */
  static async delete(req, res) {
    try {
      const { id } = req.params;

      const practiceSegment = await PracticeSegment.findById(id);
      if (!practiceSegment) {
        return res.status(404).json({ error: 'Practice segment not found' });
      }

      await PracticeSegment.delete(id);
      res.json({ message: 'Practice segment deleted successfully' });
    } catch (error) {
      console.error('Delete practice segment error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Add a programming question to practice segment
   */
  static async addProgrammingQuestion(req, res) {
    try {
      const { id } = req.params;
      const { question_id, order_index } = req.body;

      if (!question_id) {
        return res.status(400).json({ error: 'question_id is required' });
      }

      const practiceSegment = await PracticeSegment.findById(id);
      if (!practiceSegment) {
        return res.status(404).json({ error: 'Practice segment not found' });
      }

      const result = await PracticeSegment.addProgrammingQuestion(id, question_id, order_index || 0);
      
      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }

      res.status(201).json({ 
        message: 'Programming question added successfully to practice segment' 
      });
    } catch (error) {
      console.error('Add programming question error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Remove a programming question from practice segment
   */
  static async removeProgrammingQuestion(req, res) {
    try {
      const { id, question_id } = req.params;

      const practiceSegment = await PracticeSegment.findById(id);
      if (!practiceSegment) {
        return res.status(404).json({ error: 'Practice segment not found' });
      }

      const removed = await PracticeSegment.removeProgrammingQuestion(id, question_id);
      
      if (!removed) {
        return res.status(404).json({ error: 'Question not found in this practice segment' });
      }

      res.json({ message: 'Programming question removed successfully from practice segment' });
    } catch (error) {
      console.error('Remove programming question error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Add an MCQ question to practice segment
   */
  static async addMcqQuestion(req, res) {
    try {
      const { id } = req.params;
      const { question_id, order_index } = req.body;

      if (!question_id) {
        return res.status(400).json({ error: 'question_id is required' });
      }

      const practiceSegment = await PracticeSegment.findById(id);
      if (!practiceSegment) {
        return res.status(404).json({ error: 'Practice segment not found' });
      }

      const result = await PracticeSegment.addMcqQuestion(id, question_id, order_index || 0);
      
      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }

      res.status(201).json({ 
        message: 'MCQ question added successfully to practice segment' 
      });
    } catch (error) {
      console.error('Add MCQ question error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Remove an MCQ question from practice segment
   */
  static async removeMcqQuestion(req, res) {
    try {
      const { id, question_id } = req.params;

      const practiceSegment = await PracticeSegment.findById(id);
      if (!practiceSegment) {
        return res.status(404).json({ error: 'Practice segment not found' });
      }

      const removed = await PracticeSegment.removeMcqQuestion(id, question_id);
      
      if (!removed) {
        return res.status(404).json({ error: 'Question not found in this practice segment' });
      }

      res.json({ message: 'MCQ question removed successfully from practice segment' });
    } catch (error) {
      console.error('Remove MCQ question error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get available programming questions for the practice segment
   * Filters by user's institution or public questions
   */
  static async getAvailableProgrammingQuestions(req, res) {
    try {
      const { id } = req.params;
      const { search, limit = 50, offset = 0 } = req.query;
      const userInstitutionId = req.user?.institution_id;

      const result = await PracticeSegment.getAvailableProgrammingQuestions(
        userInstitutionId, 
        id, 
        { search, limit: parseInt(limit), offset: parseInt(offset) }
      );

      res.json(result);
    } catch (error) {
      console.error('Get available programming questions error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get available MCQ questions for the practice segment
   * Filters by user's institution or public questions
   */
  static async getAvailableMcqQuestions(req, res) {
    try {
      const { id } = req.params;
      const { search, limit = 50, offset = 0 } = req.query;
      const userInstitutionId = req.user?.institution_id;

      const result = await PracticeSegment.getAvailableMcqQuestions(
        userInstitutionId, 
        id, 
        { search, limit: parseInt(limit), offset: parseInt(offset) }
      );

      res.json(result);
    } catch (error) {
      console.error('Get available MCQ questions error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get programming questions for a practice segment
   */
  static async getProgrammingQuestions(req, res) {
    try {
      const { id } = req.params;

      const practiceSegment = await PracticeSegment.findById(id);
      if (!practiceSegment) {
        return res.status(404).json({ error: 'Practice segment not found' });
      }

      const questions = await PracticeSegment.getProgrammingQuestions(id);
      res.json(questions);
    } catch (error) {
      console.error('Get programming questions error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get MCQ questions for a practice segment
   */
  static async getMcqQuestions(req, res) {
    try {
      const { id } = req.params;

      const practiceSegment = await PracticeSegment.findById(id);
      if (!practiceSegment) {
        return res.status(404).json({ error: 'Practice segment not found' });
      }

      const questions = await PracticeSegment.getMcqQuestions(id);
      res.json(questions);
    } catch (error) {
      console.error('Get MCQ questions error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = PracticeSegmentController;

