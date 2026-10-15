const pool = require('../config/db');

class Topic {
  static async create(topicData) {
    const { course_id, name, description, order_index } = topicData;
    const [result] = await pool.execute(
      'INSERT INTO topics (course_id, name, description, order_index) VALUES (?, ?, ?, ?)',
      [course_id, name, description, order_index]
    );
    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM topics WHERE id = ?',
      [id]
    );
    return rows[0];
  }

  static async findByCourseId(course_id) {
    const [rows] = await pool.execute(
      'SELECT * FROM topics WHERE course_id = ? ORDER BY order_index',
      [course_id]
    );
    return rows;
  }

  static async update(id, topicData) {
    const { name, description, order_index } = topicData;
    await pool.execute(
      'UPDATE topics SET name = ?, description = ?, order_index = ? WHERE id = ?',
      [name, description, order_index, id]
    );
  }

  static async delete(id) {
    await pool.execute('DELETE FROM topics WHERE id = ?', [id]);
  }

  static async getWithSegments(id) {
    const [topic] = await pool.execute(
      'SELECT * FROM topics WHERE id = ?',
      [id]
    );
    
    if (!topic[0]) return null;

    const [segments] = await pool.execute(
      'SELECT * FROM segments WHERE topic_id = ? ORDER BY order_index',
      [id]
    );

    return { ...topic[0], segments };
  }
}

module.exports = Topic;

