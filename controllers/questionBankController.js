const QuestionBank = require('../models/QuestionBank');
const Status = require('../models/Status');
const Institution = require('../models/Institution');

class QuestionBankController {
  // Helper to get institution ID for college_admin
  static async getInstitutionIdForUser(user) {
    if (user.role === 'college_admin' && user.college_name) {
      const institution = await Institution.findByName(user.college_name);
      return institution ? institution.id : null;
    }
    return null;
  }

  // Get all question banks with pagination
  static async getQuestionBanks(req, res) {
    try {
      const { search, limit = 10, offset = 0, institution_id, status_id } = req.query;
      const currentUser = req.user;
      
      // college_admin can only see question banks from their institution
      let institutionFilter = institution_id || null;
      if (currentUser.role === 'college_admin') {
        const userInstitutionId = await QuestionBankController.getInstitutionIdForUser(currentUser);
        if (userInstitutionId) {
          institutionFilter = userInstitutionId;
        } else {
          // If no institution found, return empty result
          return res.json({
            questionBanks: [],
            total: 0,
            limit: parseInt(limit),
            offset: parseInt(offset)
          });
        }
      }
      
      const result = await QuestionBank.getAllPaginated({
        search: search || null,
        limit: parseInt(limit),
        offset: parseInt(offset),
        institutionId: institutionFilter,
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
      const currentUser = req.user;
      const questionBank = await QuestionBank.findById(id);
      
      if (!questionBank) {
        return res.status(404).json({ error: 'Question bank not found' });
      }

      // college_admin can only view question banks from their institution
      if (currentUser.role === 'college_admin') {
        const userInstitutionId = await QuestionBankController.getInstitutionIdForUser(currentUser);
        if (questionBank.institution_id !== userInstitutionId) {
          return res.status(403).json({ error: 'You can only view question banks from your institution' });
        }
      }

      const includeQuestions = req.query.include_questions !== 'false';
      let questions = [];
      if (includeQuestions) {
        questions = await QuestionBank.getQuestions(id);
      }

      res.json({ questionBank, questions });
    } catch (error) {
      console.error('Get question bank error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Create question bank
  static async createQuestionBank(req, res) {
    try {
      const { name, description, institution_id, status_id, level_id, category_id, tags } = req.body;
      const currentUser = req.user;
      const userId = currentUser?.id;

      if (!name) {
        return res.status(400).json({ error: 'Question bank name is required' });
      }

      // college_admin can only create question banks for their institution
      let finalInstitutionId = institution_id;
      if (currentUser.role === 'college_admin') {
        const userInstitutionId = await QuestionBankController.getInstitutionIdForUser(currentUser);
        if (!userInstitutionId) {
          return res.status(403).json({ error: 'Your institution was not found' });
        }
        finalInstitutionId = userInstitutionId;
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
        institution_id: finalInstitutionId,
        status_id: statusId,
        level_id,
        category_id,
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
      const { name, description, institution_id, status_id, level_id, category_id, active, tags } = req.body;
      const currentUser = req.user;
      const userId = currentUser?.id;

      const existing = await QuestionBank.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Question bank not found' });
      }

      // college_admin can only update question banks from their institution
      if (currentUser.role === 'college_admin') {
        const userInstitutionId = await QuestionBankController.getInstitutionIdForUser(currentUser);
        if (existing.institution_id !== userInstitutionId) {
          return res.status(403).json({ error: 'You can only update question banks from your institution' });
        }
        // Prevent changing institution_id
        if (institution_id && institution_id !== userInstitutionId) {
          return res.status(403).json({ error: 'You cannot move question banks to another institution' });
        }
      }

      const finalInstitutionId = currentUser.role === 'college_admin' 
        ? await QuestionBankController.getInstitutionIdForUser(currentUser) 
        : institution_id;

      await QuestionBank.update(id, {
        name: name || existing.name,
        description,
        institution_id: finalInstitutionId,
        status_id: status_id || existing.status_id,
        level_id: level_id !== undefined ? level_id : existing.level_id,
        category_id: category_id !== undefined ? category_id : existing.category_id,
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
      const currentUser = req.user;

      const existing = await QuestionBank.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Question bank not found' });
      }

      // college_admin can only delete question banks from their institution
      if (currentUser.role === 'college_admin') {
        const userInstitutionId = await QuestionBankController.getInstitutionIdForUser(currentUser);
        if (existing.institution_id !== userInstitutionId) {
          return res.status(403).json({ error: 'You can only delete question banks from your institution' });
        }
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




