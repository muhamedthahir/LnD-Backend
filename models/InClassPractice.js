const pool = require('../config/db');

class InClassPractice {
  static async create(practiceData) {
    const { segment_id, title, content, order_index } = practiceData;
    const [result] = await pool.execute(
      'INSERT INTO inclass_practice (segment_id, title, content, order_index) VALUES (?, ?, ?, ?)',
      [segment_id, title, content, order_index]
    );
    return result.insertId;
  }

  static async findBySegmentId(segment_id) {
    const [rows] = await pool.execute(
      'SELECT * FROM inclass_practice WHERE segment_id = ? ORDER BY order_index',
      [segment_id]
    );
    return rows;
  }

  static async update(id, practiceData) {
    const { title, content, order_index } = practiceData;
    await pool.execute(
      'UPDATE inclass_practice SET title = ?, content = ?, order_index = ? WHERE id = ?',
      [title, content, order_index, id]
    );
  }

  static async delete(id) {
    await pool.execute('DELETE FROM inclass_practice WHERE id = ?', [id]);
  }
}

module.exports = InClassPractice;

