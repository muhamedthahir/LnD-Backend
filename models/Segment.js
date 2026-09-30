const pool = require('../config/db');

class Segment {
  static async create(segmentData) {
    const { topic_id, name, description, segment_type, order_index, content, threshold_value } = segmentData;
    // Ensure content is properly stringified
    const contentJson = content ? (typeof content === 'string' ? content : JSON.stringify(content)) : JSON.stringify({});
    // Default threshold_value to 100 if not provided
    const thresholdVal = threshold_value !== undefined ? threshold_value : 100;
    const [result] = await pool.execute(
      'INSERT INTO segments (topic_id, name, description, segment_type, order_index, content, threshold_value) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [topic_id, name, description, segment_type, order_index, contentJson, thresholdVal]
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
    const { name, description, segment_type, order_index, content, threshold_value } = segmentData;
    // Ensure content is properly stringified
    const contentJson = content ? (typeof content === 'string' ? content : JSON.stringify(content)) : JSON.stringify({});
    
    // Build dynamic update query
    let query = 'UPDATE segments SET name = ?, description = ?, segment_type = ?, order_index = ?, content = ?';
    const params = [name, description, segment_type, order_index, contentJson];
    
    if (threshold_value !== undefined) {
      query += ', threshold_value = ?';
      params.push(threshold_value);
    }
    
    query += ' WHERE id = ?';
    params.push(id);
    
    await pool.execute(query, params);
  }

  static async delete(id) {
    await pool.execute('DELETE FROM segments WHERE id = ?', [id]);
  }

  static async getWithRelatedData(id) {
    const segment = await this.findById(id);
    if (!segment) return null;

    const loadRelated = async (table) => {
      try {
        const [rows] = await pool.execute(
          `SELECT * FROM ${table} WHERE segment_id = ? ORDER BY order_index`,
          [id]
        );
        return rows;
      } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') return [];
        throw err;
      }
    };
    // Table names are constants; only the segment id comes from the request.
    const [conceptsData, inclassPractice, postclassPractice] = await Promise.all([
      loadRelated('concepts'),
      loadRelated('inclass_practice'),
      loadRelated('postclass_practice')
    ]);

    return {
      ...segment,
      concepts: conceptsData,
      inclass_practice: inclassPractice,
      postclass_practice: postclassPractice
    };
  }
}

module.exports = Segment;
