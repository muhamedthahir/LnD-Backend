const pool = require('../config/db');

class Segment {
  static async create(segmentData) {
    const { topic_id, name, description, segment_type, order_index, content } = segmentData;
    // Ensure content is properly stringified
    const contentJson = content ? (typeof content === 'string' ? content : JSON.stringify(content)) : JSON.stringify({});
    const [result] = await pool.execute(
      'INSERT INTO segments (topic_id, name, description, segment_type, order_index, content) VALUES (?, ?, ?, ?, ?, ?)',
      [topic_id, name, description, segment_type, order_index, contentJson]
    );
    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM segments WHERE id = ?',
      [id]
    );
    if (rows[0] && rows[0].content) {
      // Handle both JSON string and already parsed object
      if (typeof rows[0].content === 'string') {
        try {
          rows[0].content = JSON.parse(rows[0].content);
        } catch (e) {
          // If parsing fails, keep as string or set to empty object
          rows[0].content = rows[0].content || {};
        }
      }
      // If it's already an object, use it as is
    }
    return rows[0];
  }

  static async findByTopicId(topic_id) {
    const [rows] = await pool.execute(
      'SELECT * FROM segments WHERE topic_id = ? ORDER BY order_index',
      [topic_id]
    );
    return rows.map(row => {
      if (row.content) {
        // Handle both JSON string and already parsed object
        if (typeof row.content === 'string') {
          try {
            row.content = JSON.parse(row.content);
          } catch (e) {
            // If parsing fails, keep as string or set to empty object
            row.content = row.content || {};
          }
        }
        // If it's already an object, use it as is
      }
      return row;
    });
  }

  static async update(id, segmentData) {
    const { name, description, segment_type, order_index, content } = segmentData;
    // Ensure content is properly stringified
    const contentJson = content ? (typeof content === 'string' ? content : JSON.stringify(content)) : JSON.stringify({});
    await pool.execute(
      'UPDATE segments SET name = ?, description = ?, segment_type = ?, order_index = ?, content = ? WHERE id = ?',
      [name, description, segment_type, order_index, contentJson, id]
    );
  }

  static async delete(id) {
    await pool.execute('DELETE FROM segments WHERE id = ?', [id]);
  }

  static async getWithRelatedData(id) {
    const segment = await this.findById(id);
    if (!segment) return null;

    const [concepts] = await pool.execute(
      'SELECT * FROM concepts WHERE segment_id = ? ORDER BY order_index',
      [id]
    );

    const [inclassPractice] = await pool.execute(
      'SELECT * FROM inclass_practice WHERE segment_id = ? ORDER BY order_index',
      [id]
    );

    const [postclassPractice] = await pool.execute(
      'SELECT * FROM postclass_practice WHERE segment_id = ? ORDER BY order_index',
      [id]
    );

    return {
      ...segment,
      concepts,
      inclass_practice: inclassPractice,
      postclass_practice: postclassPractice
    };
  }
}

module.exports = Segment;

