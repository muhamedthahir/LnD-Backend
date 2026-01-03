const TestCase = require('../models/TestCase');
const ProgrammingQuestion = require('../models/ProgrammingQuestion');

class TestCaseController {
  // Get all test cases for a programming question
  static async getTestCases(req, res) {
    try {
      const { programming_question_id } = req.params;
      
      const testCases = await TestCase.findByProgrammingQuestionId(programming_question_id);

      res.json({ testCases });
    } catch (error) {
      console.error('Get test cases error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get single test case by ID
  static async getTestCase(req, res) {
    try {
      const { id } = req.params;
      const testCase = await TestCase.findById(id);
      
      if (!testCase) {
        return res.status(404).json({ error: 'Test case not found' });
      }

      res.json({ testCase });
    } catch (error) {
      console.error('Get test case error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Create test case
  static async createTestCase(req, res) {
    try {
      const {
        programming_question_id,
        name,
        description,
        input,
        expected_result,
        is_active,
        is_hidden,
        should_match_exactly,
        percentage_of_match,
        order,
        weight
      } = req.body;

      if (!programming_question_id) {
        return res.status(400).json({ error: 'Programming question ID is required' });
      }

      if (!name) {
        return res.status(400).json({ error: 'Test case name is required' });
      }

      if (input === undefined || input === null) {
        return res.status(400).json({ error: 'Test case input is required' });
      }

      if (!expected_result) {
        return res.status(400).json({ error: 'Expected result is required' });
      }

      // Verify programming question exists
      const progQuestion = await ProgrammingQuestion.findById(programming_question_id);
      if (!progQuestion) {
        return res.status(404).json({ error: 'Programming question not found' });
      }

      const id = await TestCase.create({
        programming_question_id,
        name,
        description,
        input,
        expected_result,
        is_active,
        is_hidden,
        should_match_exactly,
        percentage_of_match,
        order,
        weight
      });

      const testCase = await TestCase.findById(id);

      res.status(201).json({
        message: 'Test case created successfully',
        testCase
      });
    } catch (error) {
      console.error('Create test case error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // Update test case
  static async updateTestCase(req, res) {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        input,
        expected_result,
        is_active,
        is_hidden,
        should_match_exactly,
        percentage_of_match,
        order,
        weight
      } = req.body;

      const existing = await TestCase.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Test case not found' });
      }

      await TestCase.update(id, {
        name: name || existing.name,
        description,
        input: input !== undefined ? input : existing.input,
        expected_result: expected_result || existing.expected_result,
        is_active: is_active !== undefined ? is_active : existing.is_active,
        is_hidden: is_hidden !== undefined ? is_hidden : existing.is_hidden,
        should_match_exactly: should_match_exactly !== undefined ? should_match_exactly : existing.should_match_exactly,
        percentage_of_match: percentage_of_match !== undefined ? percentage_of_match : existing.percentage_of_match,
        order: order !== undefined ? order : existing.order,
        weight: weight !== undefined ? weight : existing.weight
      });

      const testCase = await TestCase.findById(id);

      res.json({
        message: 'Test case updated successfully',
        testCase
      });
    } catch (error) {
      console.error('Update test case error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // Delete test case
  static async deleteTestCase(req, res) {
    try {
      const { id } = req.params;

      const existing = await TestCase.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Test case not found' });
      }

      await TestCase.delete(id);

      res.json({ message: 'Test case deleted successfully' });
    } catch (error) {
      console.error('Delete test case error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // Toggle test case active status
  static async toggleActive(req, res) {
    try {
      const { id } = req.params;

      const existing = await TestCase.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Test case not found' });
      }

      await TestCase.toggleActive(id);
      const testCase = await TestCase.findById(id);

      res.json({
        message: `Test case ${testCase.is_active ? 'activated' : 'deactivated'} successfully`,
        testCase
      });
    } catch (error) {
      console.error('Toggle test case active error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // Toggle test case hidden status
  static async toggleHidden(req, res) {
    try {
      const { id } = req.params;

      const existing = await TestCase.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Test case not found' });
      }

      await TestCase.toggleHidden(id);
      const testCase = await TestCase.findById(id);

      res.json({
        message: `Test case is now ${testCase.is_hidden ? 'hidden' : 'visible'}`,
        testCase
      });
    } catch (error) {
      console.error('Toggle test case hidden error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
}

module.exports = TestCaseController;




