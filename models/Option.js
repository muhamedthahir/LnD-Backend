const pool = require('../config/db');

class Option {
  static async findByQuestionId(questionId) {
    const [rows] = await pool.execute(
      `SELECT * FROM options WHERE question_id = ? ORDER BY \`order\` ASC`,
      [questionId]
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
      question_id,
      text,
      is_correct = false,
      order = 0,
      explanation
    } = data;

    const [result] = await pool.execute(
      `INSERT INTO options (question_id, text, is_correct, \`order\`, explanation) 
       VALUES (?, ?, ?, ?, ?)`,
      [question_id, text, is_correct, order, explanation || null]
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

  static async deleteByQuestionId(questionId) {
    await pool.execute('DELETE FROM options WHERE question_id = ?', [questionId]);
    return true;
  }

  static async setOptions(questionId, options) {
    // Delete existing options
    await this.deleteByQuestionId(questionId);
    
    // Add new options
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      await this.create({
        question_id: questionId,
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

