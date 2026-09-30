const pool = require('../config/db');
const crypto = require('crypto');

class PlaygroundProject {
  /**
   * Create playground_projects table if it doesn't exist
   */
  static async createTable() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS playground_projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        share_id VARCHAR(32) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL DEFAULT 'Untitled',
        html LONGTEXT,
        css LONGTEXT,
        js LONGTEXT,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_created_by (created_by),
        INDEX idx_share_id (share_id)
      )
    `;

    try {
      await pool.execute(createTableSQL);
      console.log('PlaygroundProject table created or already exists');
    } catch (error) {
      console.error('Error creating playground_projects table:', error);
      throw error;
    }
  }

  /**
   * Generate a URL-safe unique share id
   */
  static generateShareId() {
    return crypto.randomBytes(9).toString('base64url'); // ~12 chars, URL-safe
  }

  /**
   * Create a new project
   */
  static async create({ title, html, css, js, created_by }) {
    const share_id = this.generateShareId();
    const [result] = await pool.execute(
      `INSERT INTO playground_projects (share_id, title, html, css, js, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [share_id, title || 'Untitled', html || '', css || '', js || '', created_by]
    );
    return { id: result.insertId, share_id };
  }

  /**
   * List a user's projects (lightweight fields), with optional search
   */
  static async listByUser(userId, search) {
    let query =
      'SELECT id, share_id, title, created_at, updated_at FROM playground_projects WHERE created_by = ?';
    const params = [userId];

    if (search) {
      query += ' AND title LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY updated_at DESC';

    const [rows] = await pool.execute(query, params);
    return rows;
  }

  /**
   * Find a project owned by a specific user
   */
  static async findByIdForUser(id, userId) {
    const [rows] = await pool.execute(
      'SELECT * FROM playground_projects WHERE id = ? AND created_by = ?',
      [id, userId]
    );
    return rows[0] || null;
  }

  /**
   * Find a project by its public share id (no ownership check)
   */
  static async findByShareId(shareId) {
    const [rows] = await pool.execute(
      'SELECT id, share_id, title, html, css, js, created_at, updated_at FROM playground_projects WHERE share_id = ?',
      [shareId]
    );
    return rows[0] || null;
  }

  /**
   * Update a project (owner only). Returns true if a row was updated.
   */
  static async updateForUser(id, userId, { title, html, css, js }) {
    const [result] = await pool.execute(
      `UPDATE playground_projects SET
         title = COALESCE(?, title),
         html = COALESCE(?, html),
         css = COALESCE(?, css),
         js = COALESCE(?, js)
       WHERE id = ? AND created_by = ?`,
      [
        title ?? null,
        html ?? null,
        css ?? null,
        js ?? null,
        id,
        userId
      ]
    );
    return result.affectedRows > 0;
  }

  /**
   * Delete a project (owner only)
   */
  static async deleteForUser(id, userId) {
    const [result] = await pool.execute(
      'DELETE FROM playground_projects WHERE id = ? AND created_by = ?',
      [id, userId]
    );
    return result.affectedRows > 0;
  }
}

module.exports = PlaygroundProject;
