const pool = require('../config/db');

class CodeTemplate {
  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT ct.*, l.name as language_name 
       FROM code_templates ct
       LEFT JOIN languages l ON ct.language_id = l.id
       WHERE ct.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  static async findByProgrammingQuestionId(programmingQuestionId) {
    const [rows] = await pool.execute(
      `SELECT ct.*, l.name as language_name 
       FROM code_templates ct
       LEFT JOIN languages l ON ct.language_id = l.id
       WHERE ct.programming_question_id = ?`,
      [programmingQuestionId]
    );
    return rows;
  }

  static async findByProgrammingQuestionAndLanguage(programmingQuestionId, languageId) {
    const [rows] = await pool.execute(
      'SELECT * FROM code_templates WHERE programming_question_id = ? AND language_id = ?',
      [programmingQuestionId, languageId]
    );
    return rows[0] || null;
  }

  static async create(data) {
    const {
      programming_question_id,
      language_id,
      template_code,
      solution_code
    } = data;

    const [result] = await pool.execute(
      `INSERT INTO code_templates 
       (programming_question_id, language_id, template_code, solution_code) 
       VALUES (?, ?, ?, ?)`,
      [programming_question_id, language_id, template_code, solution_code || null]
    );

    return result.insertId;
  }

  static async update(id, data) {
    const { template_code, solution_code } = data;

    await pool.execute(
      'UPDATE code_templates SET template_code = ?, solution_code = ? WHERE id = ?',
      [template_code, solution_code || null, id]
    );

    return true;
  }

  static async upsert(data) {
    const {
      programming_question_id,
      language_id,
      template_code,
      solution_code
    } = data;

    // Check if exists
    const existing = await this.findByProgrammingQuestionAndLanguage(programming_question_id, language_id);
    
    if (existing) {
      await this.update(existing.id, { template_code, solution_code });
      return existing.id;
    } else {
      return await this.create(data);
    }
  }

  static async delete(id) {
    await pool.execute('DELETE FROM code_templates WHERE id = ?', [id]);
    return true;
  }

  static async deleteByProgrammingQuestionId(programmingQuestionId) {
    await pool.execute(
      'DELETE FROM code_templates WHERE programming_question_id = ?',
      [programmingQuestionId]
    );
    return true;
  }
}

module.exports = CodeTemplate;




