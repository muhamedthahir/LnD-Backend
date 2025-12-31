const pool = require('../config/db');

class ProgrammingQuestion {
  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM programming_questions WHERE id = ?',
      [id]
    );
    
    if (rows[0]) {
      rows[0].languages = await this.getLanguages(id);
      rows[0].testCases = await this.getTestCases(id);
      rows[0].codeTemplates = await this.getCodeTemplates(id);
    }
    
    return rows[0] || null;
  }

  static async findByQuestionId(questionId) {
    const [rows] = await pool.execute(
      'SELECT * FROM programming_questions WHERE question_id = ?',
      [questionId]
    );
    
    if (rows[0]) {
      rows[0].languages = await this.getLanguages(rows[0].id);
      rows[0].testCases = await this.getTestCases(rows[0].id);
      rows[0].codeTemplates = await this.getCodeTemplates(rows[0].id);
    }
    
    return rows[0] || null;
  }

  static async create(data) {
    const {
      question_id,
      time_limit,
      memory_limit,
      threshold,
      no_of_submission_allowed,
      no_of_testcase_to_be_passed,
      constraints,
      sample_input,
      sample_output,
      languages
    } = data;

    const [result] = await pool.execute(
      `INSERT INTO programming_questions 
       (question_id, time_limit, memory_limit, threshold, no_of_submission_allowed, 
        no_of_testcase_to_be_passed, constraints, sample_input, sample_output) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        question_id, time_limit || null, memory_limit || null, threshold || null,
        no_of_submission_allowed || null, no_of_testcase_to_be_passed || null,
        constraints || null, sample_input || null, sample_output || null
      ]
    );

    const progQuestionId = result.insertId;

    // Add languages if provided
    if (languages && languages.length > 0) {
      await this.setLanguages(progQuestionId, languages);
    }

    return progQuestionId;
  }

  static async update(id, data) {
    const {
      time_limit,
      memory_limit,
      threshold,
      no_of_submission_allowed,
      no_of_testcase_to_be_passed,
      constraints,
      sample_input,
      sample_output,
      languages
    } = data;

    await pool.execute(
      `UPDATE programming_questions 
       SET time_limit = ?, memory_limit = ?, threshold = ?, no_of_submission_allowed = ?,
           no_of_testcase_to_be_passed = ?, constraints = ?, sample_input = ?, sample_output = ?
       WHERE id = ?`,
      [
        time_limit || null, memory_limit || null, threshold || null,
        no_of_submission_allowed || null, no_of_testcase_to_be_passed || null,
        constraints || null, sample_input || null, sample_output || null, id
      ]
    );

    // Update languages if provided
    if (languages !== undefined) {
      await this.setLanguages(id, languages || []);
    }

    return true;
  }

  static async delete(id) {
    await pool.execute('DELETE FROM programming_questions WHERE id = ?', [id]);
    return true;
  }

  static async getLanguages(programmingQuestionId) {
    const [rows] = await pool.execute(
      `SELECT l.* FROM languages l
       INNER JOIN programming_question_languages pql ON l.id = pql.language_id
       WHERE pql.programming_question_id = ?`,
      [programmingQuestionId]
    );
    return rows;
  }

  static async setLanguages(programmingQuestionId, languageIds) {
    // Remove existing languages
    await pool.execute(
      'DELETE FROM programming_question_languages WHERE programming_question_id = ?',
      [programmingQuestionId]
    );
    
    // Add new languages
    for (const languageId of languageIds) {
      await pool.execute(
        'INSERT INTO programming_question_languages (programming_question_id, language_id) VALUES (?, ?)',
        [programmingQuestionId, languageId]
      );
    }
    return true;
  }

  static async getTestCases(programmingQuestionId) {
    const [rows] = await pool.execute(
      'SELECT * FROM test_cases WHERE programming_question_id = ? ORDER BY `order` ASC',
      [programmingQuestionId]
    );
    return rows;
  }

  static async getCodeTemplates(programmingQuestionId) {
    const [rows] = await pool.execute(
      `SELECT ct.*, l.name as language_name 
       FROM code_templates ct
       LEFT JOIN languages l ON ct.language_id = l.id
       WHERE ct.programming_question_id = ?`,
      [programmingQuestionId]
    );
    return rows;
  }

  static async hasTestCases(programmingQuestionId) {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM test_cases WHERE programming_question_id = ? AND is_active = TRUE',
      [programmingQuestionId]
    );
    return rows[0].count > 0;
  }
}

module.exports = ProgrammingQuestion;

