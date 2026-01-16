const pool = require('../config/db');

class Course {
  static async create(courseData) {
    const { 
      name, 
      category, 
      competency_level, 
      short_description, 
      course_outcomes, 
      status,
      thumbnail,
      has_to_go_by_section,
      created_by 
    } = courseData;
    
    const [result] = await pool.execute(
      `INSERT INTO courses (
        name, 
        category, 
        competency_level, 
        short_description, 
        course_outcomes, 
        status,
        thumbnail,
        has_to_go_by_section,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, 
        category, 
        competency_level, 
        short_description, 
        course_outcomes, 
        status || 'draft',
        thumbnail || null,
        has_to_go_by_section ? 1 : 0,
        created_by
      ]
    );
    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM courses WHERE id = ?',
      [id]
    );
    return rows[0];
  }

  static async getAll(limit = 50, offset = 0, filters = {}) {
    // Ensure limit and offset are valid integers with defaults
    // Use != null to check for both null and undefined, but allow 0
    const limitInt = (limit != null) ? parseInt(limit, 10) : 50;
    const offsetInt = (offset != null) ? parseInt(offset, 10) : 0;
    
    // Validate and set defaults if invalid
    const finalLimit = (isNaN(limitInt) || limitInt < 1) ? 50 : limitInt;
    const finalOffset = (isNaN(offsetInt) || offsetInt < 0) ? 0 : offsetInt;

    let query = 'SELECT c.*, u.name as creator_name, u.college_name as creator_college FROM courses c LEFT JOIN users u ON c.created_by = u.id WHERE 1=1';
    const params = [];

    if (filters.search) {
      query += ' AND c.name LIKE ?';
      params.push(`%${filters.search}%`);
    }

    // Only filter by category if the column exists (will fail gracefully if column doesn't exist)
    if (filters.category) {
      query += ' AND c.category = ?';
      params.push(filters.category);
    }

    // Only filter by status if the column exists
    if (filters.status) {
      query += ' AND c.status = ?';
      params.push(filters.status);
    }

    // Filter by creator's college/institution
    if (filters.college_name) {
      query += ' AND u.college_name = ?';
      params.push(filters.college_name);
    }

    // MySQL doesn't support placeholders for LIMIT and OFFSET in some versions
    // Since we've validated these as integers, it's safe to interpolate them
    query += ` ORDER BY c.created_at DESC LIMIT ${finalLimit} OFFSET ${finalOffset}`;

    try {
      const [rows] = await pool.execute(query, params);
      return rows;
    } catch (error) {
      // If error is due to missing columns, return all courses without filters
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        console.warn('Course table missing some columns, returning all courses without filters');
        const [rows] = await pool.execute(
          `SELECT c.*, u.name as creator_name FROM courses c LEFT JOIN users u ON c.created_by = u.id ORDER BY c.created_at DESC LIMIT ${finalLimit} OFFSET ${finalOffset}`
        );
        return rows;
      }
      throw error;
    }
  }

  static async getCount(filters = {}) {
    let query = 'SELECT COUNT(*) as count FROM courses c LEFT JOIN users u ON c.created_by = u.id WHERE 1=1';
    const params = [];

    if (filters.search) {
      query += ' AND c.name LIKE ?';
      params.push(`%${filters.search}%`);
    }

    if (filters.category) {
      query += ' AND c.category = ?';
      params.push(filters.category);
    }

    if (filters.status) {
      query += ' AND c.status = ?';
      params.push(filters.status);
    }

    // Filter by creator's college/institution
    if (filters.college_name) {
      query += ' AND u.college_name = ?';
      params.push(filters.college_name);
    }

    try {
      const [rows] = await pool.execute(query, params);
      return rows[0].count;
    } catch (error) {
      // If error is due to missing columns, return count without filters
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        console.warn('Course table missing some columns, returning total count without filters');
        const [rows] = await pool.execute('SELECT COUNT(*) as count FROM courses c');
        return rows[0].count;
      }
      throw error;
    }
  }

  static async update(id, courseData) {
    const { 
      name, 
      category, 
      competency_level, 
      short_description, 
      course_outcomes, 
      status,
      thumbnail,
      has_to_go_by_section
    } = courseData;
    
    const updates = [];
    const values = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      values.push(category);
    }
    if (competency_level !== undefined) {
      updates.push('competency_level = ?');
      values.push(competency_level);
    }
    if (short_description !== undefined) {
      updates.push('short_description = ?');
      values.push(short_description);
    }
    if (course_outcomes !== undefined) {
      updates.push('course_outcomes = ?');
      values.push(course_outcomes);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (thumbnail !== undefined) {
      updates.push('thumbnail = ?');
      values.push(thumbnail);
    }
    if (has_to_go_by_section !== undefined) {
      updates.push('has_to_go_by_section = ?');
      values.push(has_to_go_by_section ? 1 : 0);
    }
    
    if (updates.length === 0) {
      return;
    }
    
    values.push(id);
    await pool.execute(
      `UPDATE courses SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }

  static async delete(id) {
    await pool.execute('DELETE FROM courses WHERE id = ?', [id]);
  }

  static async getWithTopics(id) {
    const [course] = await pool.execute(
      'SELECT * FROM courses WHERE id = ?',
      [id]
    );
    
    if (!course[0]) return null;

    const [topics] = await pool.execute(
      'SELECT * FROM topics WHERE course_id = ? ORDER BY order_index',
      [id]
    );

    return { ...course[0], topics };
  }
}

module.exports = Course;

