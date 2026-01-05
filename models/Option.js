const pool = require('../config/db');

class Option {
  static async findByMcqQuestionId(mcqQuestionId) {
    const [rows] = await pool.execute(
      `SELECT * FROM options WHERE mcq_multiselect_question_id = ? ORDER BY \`order\` ASC`,
      [mcqQuestionId]
    );
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM options WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  static async create(data) {
    const {
      mcq_multiselect_question_id,
      text,
      is_correct = false,
      order = 0,
      explanation
    } = data;

    const [result] = await pool.execute(
      `INSERT INTO options (mcq_multiselect_question_id, text, is_correct, \`order\`, explanation) 
       VALUES (?, ?, ?, ?, ?)`,
      [mcq_multiselect_question_id, text, is_correct, order, explanation || null]
    );

    return { id: result.insertId };
  }

  static async update(id, data) {
    const {
      text,
      is_correct,
      order,
      explanation
    } = data;

    await pool.execute(
      `UPDATE options 
       SET text = ?, is_correct = ?, \`order\` = ?, explanation = ?
       WHERE id = ?`,
      [text, is_correct, order, explanation || null, id]
    );

    return true;
  }

  static async delete(id) {
    await pool.execute('DELETE FROM options WHERE id = ?', [id]);
    return true;
  }

  static async deleteByMcqQuestionId(mcqQuestionId) {
    await pool.execute('DELETE FROM options WHERE mcq_multiselect_question_id = ?', [mcqQuestionId]);
    return true;
  }

  static async setOptions(mcqQuestionId, options) {
    // Delete existing options
    await this.deleteByMcqQuestionId(mcqQuestionId);
    
    // Add new options
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      await this.create({
        mcq_multiselect_question_id: mcqQuestionId,
        text: opt.text,
        is_correct: opt.is_correct || false,
        order: i,
        explanation: opt.explanation
      });
    }
    
    return true;
  }
}

module.exports = Option;
