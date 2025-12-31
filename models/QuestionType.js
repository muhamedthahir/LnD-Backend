const pool = require('../config/db');

class QuestionType {
  static async getAll() {
    const [rows] = await pool.execute(
      'SELECT * FROM question_types ORDER BY name ASC'
    );
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM question_types WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  static async findByName(name) {
    const [rows] = await pool.execute(
      'SELECT * FROM question_types WHERE name = ?',
      [name]
    );
    return rows[0] || null;
  }

  static async create(data) {
    const { name, description } = data;
    const [result] = await pool.execute(
      'INSERT INTO question_types (name, description) VALUES (?, ?)',
      [name, description || null]
    );
    return result.insertId;
  }

  static async update(id, data) {
    const { name, description } = data;
    await pool.execute(
      'UPDATE question_types SET name = ?, description = ? WHERE id = ?',
      [name, description || null, id]
    );
    return true;
  }

  static async delete(id) {
    await pool.execute('DELETE FROM question_types WHERE id = ?', [id]);
    return true;
  }
}

module.exports = QuestionType;

