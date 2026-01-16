const Question = require('../models/Question');
const QuestionType = require('../models/QuestionType');
const ProgrammingQuestion = require('../models/ProgrammingQuestion');
const MCQMultiSelectQuestion = require('../models/MCQMultiSelectQuestion');
const Status = require('../models/Status');
const Option = require('../models/Option');
const TestCase = require('../models/TestCase');
const QuestionBank = require('../models/QuestionBank');
const Institution = require('../models/Institution');

class QuestionController {
  // Helper to get institution ID for college_admin
  static async getInstitutionIdForUser(user) {
    if (user.role === 'college_admin' && user.college_name) {
      const institution = await Institution.findByName(user.college_name);
      return institution ? institution.id : null;
    }
    return null;
  }

  // Helper to check if question belongs to user's institution
  static async canAccessQuestion(user, questionId) {
    if (user.role === 'primary_admin') return true;
    if (user.role !== 'college_admin') return true; // Students can access based on enrollment
    
    const question = await Question.findById(questionId);
    if (!question || !question.question_bank_id) return false;
    
    const questionBank = await QuestionBank.findById(question.question_bank_id);
    if (!questionBank) return false;
    
    const userInstitutionId = await QuestionController.getInstitutionIdForUser(user);
    return questionBank.institution_id === userInstitutionId;
  }

  // Get all questions with pagination
  static async getQuestions(req, res) {
    try {
      const { 
        search, limit = 10, offset = 0, 
        question_bank_id, question_type_id, level_id, status_id, category_id 
      } = req.query;
      const currentUser = req.user;
      
      // For college_admin, filter questions by their institution's question banks
      let questionBankFilter = question_bank_id || null;
      let institutionFilter = null;
      
      if (currentUser.role === 'college_admin') {
        institutionFilter = await QuestionController.getInstitutionIdForUser(currentUser);
        if (!institutionFilter) {
          // If no institution found, return empty result
          return res.json({
            questions: [],
            total: 0,
            limit: parseInt(limit),
            offset: parseInt(offset)
          });
        }
      }
      
      const result = await Question.getAllPaginated({
        search: search || null,
        limit: parseInt(limit),
        offset: parseInt(offset),
        questionBankId: questionBankFilter,
        questionTypeId: question_type_id || null,
        levelId: level_id || null,
        statusId: status_id || null,
        categoryId: category_id || null,
        institutionId: institutionFilter
      });

      res.json({
        questions: result.questions,
        total: result.total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } catch (error) {
      console.error('Get questions error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get single question by ID
  static async getQuestion(req, res) {
    try {
      const { id } = req.params;
      const currentUser = req.user;
      const question = await Question.findById(id);
      
      if (!question) {
        return res.status(404).json({ error: 'Question not found' });
      }

      // college_admin can only view questions from their institution's question banks
      if (currentUser.role === 'college_admin') {
        const canAccess = await QuestionController.canAccessQuestion(currentUser, id);
        if (!canAccess) {
          return res.status(403).json({ error: 'You can only view questions from your institution' });
        }
      }

      const questionType = await QuestionType.findById(question.question_type_id);
      
      // Get programming question details if applicable
      let programmingQuestion = null;
      let testCases = [];
      
      if (questionType?.name === 'Programming') {
        programmingQuestion = await ProgrammingQuestion.findByQuestionId(id);
        if (programmingQuestion) {
          testCases = await TestCase.findByProgrammingQuestionId(programmingQuestion.id);
        }
      }

      // Get options for MCQ/Multi Select
      let options = [];
      let mcqQuestion = null;
      if (questionType?.name === 'MCQ' || questionType?.name === 'Multi Select') {
        mcqQuestion = await MCQMultiSelectQuestion.findByQuestionId(id);
        if (mcqQuestion) {
          options = await Option.findByMcqQuestionId(mcqQuestion.id);
        }
      }

      // Get code templates for programming questions
      let codeTemplates = [];
      if (programmingQuestion) {
        codeTemplates = programmingQuestion.codeTemplates || [];
      }

      res.json({ 
        question,
        programmingQuestion,
        mcqQuestion,
        testCases,
        options,
        codeTemplates,
        hasTestCases: programmingQuestion ? testCases.length > 0 : null
      });
    } catch (error) {
      console.error('Get question error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Create question
  static async createQuestion(req, res) {
    try {
      const {
        name,
        description,
        level_id,
        question_type_id,
        question_bank_id,
        category_id,
        status_id,
        points,
        negative_marks,
        time_to_solve,
        explanation,
        hint,
        tags,
        // Programming question specific fields
        programming_details,
        // MCQ/Multi Select specific fields
        mcq_details,
        // MCQ/Multi Select options
        options
      } = req.body;
      const currentUser = req.user;
      const userId = currentUser?.id;

      if (!name) {
        return res.status(400).json({ error: 'Question name is required' });
      }

      if (!question_type_id) {
        return res.status(400).json({ error: 'Question type is required' });
      }

      // college_admin can only create questions in their institution's question banks
      if (currentUser.role === 'college_admin' && question_bank_id) {
        const questionBank = await QuestionBank.findById(question_bank_id);
        if (questionBank) {
          const userInstitutionId = await QuestionController.getInstitutionIdForUser(currentUser);
          if (questionBank.institution_id !== userInstitutionId) {
            return res.status(403).json({ error: 'You can only create questions in your institution\'s question banks' });
          }
        }
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

      // Create base question
      const { id: questionId, code } = await Question.create({
        name,
        description,
        level_id,
        question_type_id,
        question_bank_id,
        category_id,
        status_id: statusId,
        points,
        negative_marks,
        time_to_solve,
        explanation,
        hint,
        created_by: userId,
        tags
      });

      const questionType = await QuestionType.findById(question_type_id);
      
      // Create programming question if type is Programming
      let programmingQuestionId = null;
      if (questionType?.name === 'Programming' && programming_details) {
        programmingQuestionId = await ProgrammingQuestion.create({
          question_id: questionId,
          ...programming_details
        });
      }

      // Create MCQ/Multi Select question and options
      let mcqQuestion = null;
      let savedOptions = [];
      if (questionType?.name === 'MCQ' || questionType?.name === 'Multi Select') {
        // Create MCQ question record
        mcqQuestion = await MCQMultiSelectQuestion.findOrCreate(questionId, {
          is_multi_select: questionType?.name === 'Multi Select',
          ...mcq_details
        });
        
        // Create options
        if (options && options.length > 0) {
          await Option.setOptions(mcqQuestion.id, options);
          savedOptions = await Option.findByMcqQuestionId(mcqQuestion.id);
        }
      }

      const question = await Question.findById(questionId);
      let programmingQuestion = null;
      if (programmingQuestionId) {
        programmingQuestion = await ProgrammingQuestion.findById(programmingQuestionId);
      }

      res.status(201).json({
        message: 'Question created successfully',
        question,
        programmingQuestion,
        mcqQuestion,
        options: savedOptions
      });
    } catch (error) {
      console.error('Create question error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // Update question
  static async updateQuestion(req, res) {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        level_id,
        question_type_id,
        question_bank_id,
        category_id,
        status_id,
        active,
        points,
        negative_marks,
        time_to_solve,
        explanation,
        hint,
        tags,
        programming_details,
        mcq_details,
        options
      } = req.body;
      const currentUser = req.user;
      const userId = currentUser?.id;

      const existing = await Question.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Question not found' });
      }

      // college_admin can only update questions from their institution's question banks
      if (currentUser.role === 'college_admin') {
        const canAccess = await QuestionController.canAccessQuestion(currentUser, id);
        if (!canAccess) {
          return res.status(403).json({ error: 'You can only update questions from your institution' });
        }
        
        // If changing question bank, verify new question bank belongs to same institution
        if (question_bank_id && question_bank_id !== existing.question_bank_id) {
          const newQuestionBank = await QuestionBank.findById(question_bank_id);
          if (newQuestionBank) {
            const userInstitutionId = await QuestionController.getInstitutionIdForUser(currentUser);
            if (newQuestionBank.institution_id !== userInstitutionId) {
              return res.status(403).json({ error: 'You can only move questions to your institution\'s question banks' });
            }
          }
        }
      }

      await Question.update(id, {
        name: name || existing.name,
        description,
        level_id,
        question_type_id: question_type_id || existing.question_type_id,
        question_bank_id,
        category_id,
        status_id: status_id || existing.status_id,
        active: active !== undefined ? active : existing.active,
        points: points !== undefined ? points : existing.points,
        negative_marks: negative_marks !== undefined ? negative_marks : existing.negative_marks,
        time_to_solve,
        explanation,
        hint,
        updated_by: userId,
        tags
      });

      // Update programming question if applicable
      if (programming_details) {
        const progQuestion = await ProgrammingQuestion.findByQuestionId(id);
        if (progQuestion) {
          await ProgrammingQuestion.update(progQuestion.id, programming_details);
        }
      }

      // Update MCQ/Multi Select question and options
      const questionType = await QuestionType.findById(question_type_id || existing.question_type_id);
      let mcqQuestion = null;
      let savedOptions = [];
      
      if (questionType?.name === 'MCQ' || questionType?.name === 'Multi Select') {
        // Find or create MCQ question record
        mcqQuestion = await MCQMultiSelectQuestion.findOrCreate(id, {
          is_multi_select: questionType?.name === 'Multi Select',
          ...mcq_details
        });
        
        // Update MCQ details if provided
        if (mcq_details) {
          await MCQMultiSelectQuestion.update(mcqQuestion.id, mcq_details);
          mcqQuestion = await MCQMultiSelectQuestion.findById(mcqQuestion.id);
        }
        
        // Update options if provided
        if (options) {
          await Option.setOptions(mcqQuestion.id, options);
        }
        
        savedOptions = await Option.findByMcqQuestionId(mcqQuestion.id);
      }

      const question = await Question.findById(id);
      const programmingQuestion = await ProgrammingQuestion.findByQuestionId(id);

      res.json({
        message: 'Question updated successfully',
        question,
        programmingQuestion,
        mcqQuestion,
        options: savedOptions
      });
    } catch (error) {
      console.error('Update question error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // Delete question
  static async deleteQuestion(req, res) {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      const existing = await Question.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Question not found' });
      }

      // college_admin can only delete questions from their institution's question banks
      if (currentUser.role === 'college_admin') {
        const canAccess = await QuestionController.canAccessQuestion(currentUser, id);
        if (!canAccess) {
          return res.status(403).json({ error: 'You can only delete questions from your institution' });
        }
      }

      await Question.delete(id);

      res.json({ message: 'Question deleted successfully' });
    } catch (error) {
      console.error('Delete question error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // Add question to question bank
  static async addToQuestionBank(req, res) {
    try {
      const { id } = req.params;
      const { question_bank_id } = req.body;

      const existing = await Question.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Question not found' });
      }

      await Question.addToQuestionBank(id, question_bank_id);

      res.json({ message: 'Question added to question bank successfully' });
    } catch (error) {
      console.error('Add to question bank error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // Remove question from question bank
  static async removeFromQuestionBank(req, res) {
    try {
      const { id } = req.params;

      const existing = await Question.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Question not found' });
      }

      await Question.removeFromQuestionBank(id);

      res.json({ message: 'Question removed from question bank successfully' });
    } catch (error) {
      console.error('Remove from question bank error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // Get programming question details (for code editor integration)
  static async getProgrammingDetails(req, res) {
    try {
      const { id } = req.params;
      
      const question = await Question.findById(id);
      if (!question) {
        return res.status(404).json({ error: 'Question not found' });
      }

      // Get programming question details
      const programmingQuestion = await ProgrammingQuestion.findByQuestionId(id);
      
      if (!programmingQuestion) {
        return res.status(404).json({ error: 'Programming question details not found' });
      }

      // Get test cases (non-hidden for visible, all for checking)
      const allTestCases = await TestCase.findByProgrammingQuestionId(programmingQuestion.id);
      
      // Filter test cases - show non-hidden ones to users
      const visibleTestCases = allTestCases.filter(tc => !tc.is_hidden && tc.is_active);
      
      res.json({
        programmingQuestion,
        languages: programmingQuestion.languages || [],
        codeTemplates: programmingQuestion.codeTemplates || [],
        testCases: visibleTestCases,
        constraints: programmingQuestion.constraints,
        sample_input: programmingQuestion.sample_input,
        sample_output: programmingQuestion.sample_output,
        time_limit: programmingQuestion.time_limit,
        memory_limit: programmingQuestion.memory_limit
      });
    } catch (error) {
      console.error('Get programming details error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = QuestionController;
