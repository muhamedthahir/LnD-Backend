const TestCase = require('../models/TestCase');
const ProgrammingQuestion = require('../models/ProgrammingQuestion');
const XLSX = require('xlsx');

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

  // Download test case bulk upload template
  static async downloadBulkTestCaseTemplate(req, res) {
    try {
      const workbook = XLSX.utils.book_new();

      const headers = [
        'Name', 'Description', 'Input', 'Expected Output', 'Weight',
        'Active (Yes/No)', 'Hidden from User (Yes/No)', 'Exact Match (Yes/No)', 'Match Percentage'
      ];

      const worksheetData = [
        headers,
        new Array(headers.length).fill('')
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      worksheet['!cols'] = [
        { wch: 25 }, // Name
        { wch: 35 }, // Description
        { wch: 30 }, // Input
        { wch: 30 }, // Expected Output
        { wch: 10 }, // Weight
        { wch: 16 }, // Active
        { wch: 22 }, // Hidden from User
        { wch: 18 }, // Exact Match
        { wch: 18 }  // Match Percentage
      ];

      // Yes/No dropdowns for columns F (Active), G (Hidden), H (Exact Match)
      worksheet['!dataValidation'] = [
        { sqref: 'F2:F1000', type: 'list', formula1: '"Yes,No"', showDropDown: true },
        { sqref: 'G2:G1000', type: 'list', formula1: '"Yes,No"', showDropDown: true },
        { sqref: 'H2:H1000', type: 'list', formula1: '"Yes,No"', showDropDown: true }
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Test Cases');

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=test_cases_bulk_upload_template.xlsx');
      res.send(buffer);
    } catch (error) {
      console.error('Download test case template error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Bulk upload test cases from Excel for a programming question
  static async uploadBulkTestCases(req, res) {
    try {
      const { programming_question_id } = req.params;

      if (!req.file) {
        return res.status(400).json({ error: 'Excel file is required' });
      }

      const progQuestion = await ProgrammingQuestion.findById(programming_question_id);
      if (!progQuestion) {
        return res.status(404).json({ error: 'Programming question not found' });
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      const existingTestCases = await TestCase.findByProgrammingQuestionId(programming_question_id);
      let order = existingTestCases.length;

      const createdTestCases = [];
      const errors = [];

      const parseYesNo = (value, defaultValue) => {
        const s = (value === null || value === undefined ? '' : value).toString().trim().toLowerCase();
        if (s === '') return defaultValue;
        return ['yes', 'y', 'true', '1'].includes(s);
      };

      const hasValue = (value) => value !== '' && value !== null && value !== undefined;

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNum = i + 2;

        try {
          const name = (row['Name'] || '').toString().trim();
          const expected = row['Expected Output'];
          const input = row['Input'];

          // Skip completely empty rows
          if (!name && !hasValue(expected) && !hasValue(input)) {
            continue;
          }

          if (!name) {
            errors.push({ row: rowNum, error: 'Name is required' });
            continue;
          }

          if (!hasValue(expected)) {
            errors.push({ row: rowNum, error: 'Expected Output is required' });
            continue;
          }

          const exactMatch = parseYesNo(row['Exact Match (Yes/No)'], true);
          let matchPercentage = 100;
          if (!exactMatch) {
            const parsed = parseInt(row['Match Percentage'], 10);
            matchPercentage = isNaN(parsed) ? 100 : parsed;
          }

          let weight = 1;
          if (hasValue(row['Weight'])) {
            const parsedWeight = parseFloat(row['Weight']);
            weight = isNaN(parsedWeight) ? 1 : parsedWeight;
          }

          const id = await TestCase.create({
            programming_question_id,
            name,
            description: hasValue(row['Description']) ? row['Description'].toString() : null,
            input: hasValue(input) ? input.toString() : '',
            expected_result: expected.toString(),
            is_active: parseYesNo(row['Active (Yes/No)'], true),
            is_hidden: parseYesNo(row['Hidden from User (Yes/No)'], false),
            should_match_exactly: exactMatch,
            percentage_of_match: matchPercentage,
            order: order++,
            weight
          });

          createdTestCases.push({ row: rowNum, id, name });
        } catch (error) {
          console.error(`Error processing test case row ${rowNum}:`, error);
          errors.push({ row: rowNum, error: error.message || 'Failed to create test case' });
        }
      }

      res.json({
        message: `Bulk upload completed. ${createdTestCases.length} test case(s) created, ${errors.length} error(s).`,
        created: createdTestCases.length,
        createdTestCases,
        errors: errors.length > 0 ? errors : []
      });
    } catch (error) {
      console.error('Bulk upload test cases error:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  }
}

module.exports = TestCaseController;




