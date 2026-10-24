const pool = require('../config/db');

class MCQMultiSelectQuestion {
  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM mcq_multiselect_questions WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  static async findByQuestionId(questionId) {
    const [rows] = await pool.execute(
      'SELECT * FROM mcq_multiselect_questions WHERE question_id = ?',
      [questionId]
    );
    return rows[0] || null;
  }

  static async create(data) {
    const {
      question_id,
      is_multi_select = false,
      min_select_required = null,
      max_select_allowed = null
    } = data;

    const [result] = await pool.execute(
      `INSERT INTO mcq_multiselect_questions 
       (question_id, is_multi_select, min_select_required, max_select_allowed) 
       VALUES (?, ?, ?, ?)`,
      [question_id, is_multi_select, min_select_required, max_select_allowed]
    );

    return result.insertId;
  }

  static async update(id, data) {
    const {
      is_multi_select,
      min_select_required,
      max_select_allowed
    } = data;

    await pool.execute(
      `UPDATE mcq_multiselect_questions 
       SET is_multi_select = ?, min_select_required = ?, max_select_allowed = ?
       WHERE id = ?`,
      [is_multi_select, min_select_required, max_select_allowed, id]
    );

    return true;
  }

  static async delete(id) {
    await pool.execute('DELETE FROM mcq_multiselect_questions WHERE id = ?', [id]);
    return true;
  }

  static async deleteByQuestionId(questionId) {
    await pool.execute('DELETE FROM mcq_multiselect_questions WHERE question_id = ?', [questionId]);
    return true;
  }

  // Find or create MCQ question record for a base question
  static async findOrCreate(questionId, data = {}) {
    let mcqQuestion = await this.findByQuestionId(questionId);
    
    if (!mcqQuestion) {
      const mcqId = await this.create({
        question_id: questionId,
        is_multi_select: data.is_multi_select || false,
        min_select_required: data.min_select_required || null,
        max_select_allowed: data.max_select_allowed || null
      });
      mcqQuestion = await this.findById(mcqId);
    }
    
    return mcqQuestion;
  }
}

module.exports = MCQMultiSelectQuestion;

