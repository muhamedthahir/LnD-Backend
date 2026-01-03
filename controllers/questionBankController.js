const QuestionBank = require('../models/QuestionBank');
const Status = require('../models/Status');

class QuestionBankController {
  // Get all question banks with pagination
  static async getQuestionBanks(req, res) {
    try {
      const { search, limit = 10, offset = 0, institution_id, status_id } = req.query;
      
      const result = await QuestionBank.getAllPaginated({
        search: search || null,
        limit: parseInt(limit),
        offset: parseInt(offset),
        institutionId: institution_id || null,
        statusId: status_id || null
      });

      res.json({
        questionBanks: result.questionBanks,
        total: result.total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } catch (error) {
      console.error('Get question banks error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get single question bank by ID
  static async getQuestionBank(req, res) {
    try {
      const { id } = req.params;
      const questionBank = await QuestionBank.findById(id);
      
      if (!questionBank) {
        return res.status(404).json({ error: 'Question bank not found' });
      }

      // Get questions in this bank
      const questions = await QuestionBank.getQuestions(id);

      res.json({ questionBank, questions });
    } catch (error) {
      console.error('Get question bank error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Create question bank
  static async createQuestionBank(req, res) {
    try {
      const { name, description, institution_id, status_id, tags } = req.body;
      const userId = req.user?.id;

      if (!name) {
        return res.status(400).json({ error: 'Question bank name is required' });
      }

      // Get default status if not provided
      let statusId = status_id;
      if (!statusId) {
        const draftStatus = await Status.findByName('DRAFT');
        statusId = draftStatus?.id;
      }

      if (!statusId) {
        return res.status(400).json({ error: 'Status is required' });
      }

      const id = await QuestionBank.create({
        name,
        description,
        institution_id,
        status_id: statusId,
        created_by: userId,
        tags
      });

      const questionBank = await QuestionBank.findById(id);

      res.status(201).json({
        message: 'Question bank created successfully',
        questionBank
      });
    } catch (error) {
      console.error('Create question bank error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // Update question bank
  static async updateQuestionBank(req, res) {
    try {
      const { id } = req.params;
      const { name, description, institution_id, status_id, active, tags } = req.body;
      const userId = req.user?.id;

      const existing = await QuestionBank.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Question bank not found' });
      }

      await QuestionBank.update(id, {
        name: name || existing.name,
        description,
        institution_id,
        status_id: status_id || existing.status_id,
        active: active !== undefined ? active : existing.active,
        updated_by: userId,
        tags
      });

      const questionBank = await QuestionBank.findById(id);

      res.json({
        message: 'Question bank updated successfully',
        questionBank
      });
    } catch (error) {
      console.error('Update question bank error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // Delete question bank
  static async deleteQuestionBank(req, res) {
    try {
      const { id } = req.params;

      const existing = await QuestionBank.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Question bank not found' });
      }

      await QuestionBank.delete(id);

      res.json({ message: 'Question bank deleted successfully' });
    } catch (error) {
      console.error('Delete question bank error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
}

module.exports = QuestionBankController;




