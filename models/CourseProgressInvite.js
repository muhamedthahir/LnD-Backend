const pool = require('../config/db');

class CourseProgressInvite {
  /**
   * Create a new course progress invite record
   * @param {Object} data - Progress invite data
   * @returns {Promise<number>} Insert ID
   */
  static async create(data) {
    const {
      administration_id,
      course_id,
      triggered_by,
      total_users,
      users_updated,
      status = 'pending',
      message = null
    } = data;

    try {
      const [result] = await pool.execute(
        `INSERT INTO course_progress_invites (
          administration_id,
          course_id,
          triggered_by,
          total_users,
          users_updated,
          status,
          message,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          administration_id,
          course_id,
          triggered_by,
          total_users,
          users_updated,
          status,
          message
        ]
      );
      return result.insertId;
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        await this.createTable();
        return this.create(data);
      }
      throw error;
    }
  }

  /**
   * Update progress invite record
   * @param {number} id - Record ID
   * @param {Object} data - Data to update
   */
  static async update(id, data) {
    const updates = [];
    const values = [];

    if (data.users_updated !== undefined) {
      updates.push('users_updated = ?');
      values.push(data.users_updated);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }
    if (data.message !== undefined) {
      updates.push('message = ?');
      values.push(data.message);
    }
    if (data.completed_at !== undefined) {
      updates.push('completed_at = ?');
      values.push(data.completed_at);
    }
    if (data.email_sent_at !== undefined) {
      updates.push('email_sent_at = ?');
      values.push(data.email_sent_at);
    }

    if (updates.length === 0) return;

    values.push(id);
    await pool.execute(
      `UPDATE course_progress_invites SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }

  /**
   * Find by ID
   * @param {number} id - Record ID
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT cpi.*, 
              ca.administration_name,
              c.name as course_name,
              u.name as triggered_by_name,
              u.email as triggered_by_email
       FROM course_progress_invites cpi
       LEFT JOIN course_administrations ca ON cpi.administration_id = ca.id
       LEFT JOIN courses c ON cpi.course_id = c.id
       LEFT JOIN users u ON cpi.triggered_by = u.id
       WHERE cpi.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Get all by administration ID
   * @param {number} administration_id - Administration ID
   * @returns {Promise<Array>}
   */
  static async findByAdministrationId(administration_id) {
    const [rows] = await pool.execute(
      `SELECT cpi.*, 
              u.name as triggered_by_name
       FROM course_progress_invites cpi
       LEFT JOIN users u ON cpi.triggered_by = u.id
       WHERE cpi.administration_id = ?
       ORDER BY cpi.created_at DESC`,
      [administration_id]
    );
    return rows;
  }

  /**
   * Create table if not exists
   */
  static async createTable() {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS course_progress_invites (
        id INT AUTO_INCREMENT PRIMARY KEY,
        administration_id INT NOT NULL,
        course_id INT NOT NULL,
        triggered_by INT NOT NULL,
        total_users INT NOT NULL DEFAULT 0,
        users_updated INT NOT NULL DEFAULT 0,
        status ENUM('pending', 'in_progress', 'completed', 'failed') DEFAULT 'pending',
        message TEXT NULL,
        email_sent_at DATETIME NULL,
        completed_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_administration_id (administration_id),
        INDEX idx_course_id (course_id),
        INDEX idx_triggered_by (triggered_by),
        INDEX idx_status (status),
        FOREIGN KEY (administration_id) REFERENCES course_administrations(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
        FOREIGN KEY (triggered_by) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('course_progress_invites table created successfully');
  }
}

module.exports = CourseProgressInvite;

