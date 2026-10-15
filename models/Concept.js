const pool = require('../config/db');

class Concept {
  static async create(conceptData) {
    const { segment_id, title, content, order_index } = conceptData;
    const [result] = await pool.execute(
      'INSERT INTO concepts (segment_id, title, content, order_index) VALUES (?, ?, ?, ?)',
      [segment_id, title, content, order_index]
    );
    return result.insertId;
  }

  static async findBySegmentId(segment_id) {
    const [rows] = await pool.execute(
      'SELECT * FROM concepts WHERE segment_id = ? ORDER BY order_index',
      [segment_id]
    );
    return rows;
  }

  static async update(id, conceptData) {
    const { title, content, order_index } = conceptData;
    await pool.execute(
      'UPDATE concepts SET title = ?, content = ?, order_index = ? WHERE id = ?',
      [title, content, order_index, id]
    );
  }

  static async delete(id) {
    await pool.execute('DELETE FROM concepts WHERE id = ?', [id]);
  }
}

module.exports = Concept;

