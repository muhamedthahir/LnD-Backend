const pool = require('../config/db');

class RefreshToken {
  /**
   * Create a new refresh token
   * @param {Object} tokenData - { userId, token, expiresAt }
   * @returns {Promise<number>} Insert ID
   */
  static async create(tokenData) {
    const { userId, token, expiresAt } = tokenData;
    
    try {
      const [result] = await pool.execute(
        'INSERT INTO refresh_tokens (user_id, token, expires_at, created_at) VALUES (?, ?, ?, NOW())',
        [userId, token, expiresAt]
      );
      return result.insertId;
    } catch (error) {
      // If table doesn't exist, create it
      if (error.code === 'ER_NO_SUCH_TABLE') {
        await this.createTable();
        const [result] = await pool.execute(
          'INSERT INTO refresh_tokens (user_id, token, expires_at, created_at) VALUES (?, ?, ?, NOW())',
          [userId, token, expiresAt]
        );
        return result.insertId;
      }
      throw error;
    }
  }

  /**
   * Find a refresh token by token string
   * @param {string} token - Refresh token string
   * @returns {Promise<Object|null>} Refresh token object or null
   */
  static async findByToken(token) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW() AND revoked = FALSE',
        [token]
      );
      return rows[0] || null;
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Revoke a refresh token
   * @param {string} token - Refresh token string
   * @returns {Promise<boolean>} Success
   */
  static async revoke(token) {
    try {
      const [result] = await pool.execute(
        'UPDATE refresh_tokens SET revoked = TRUE WHERE token = ?',
        [token]
      );
      return result.affectedRows > 0;
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Revoke all refresh tokens for a user
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} Success
   */
  static async revokeAllForUser(userId) {
    try {
      const [result] = await pool.execute(
        'UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = ?',
        [userId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Delete expired tokens
   * @returns {Promise<number>} Number of deleted tokens
   */
  static async deleteExpired() {
    try {
      const [result] = await pool.execute(
        'DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked = TRUE'
      );
      return result.affectedRows;
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        return 0;
      }
      throw error;
    }
  }

  /**
   * Create the refresh_tokens table
   * @returns {Promise<void>}
   */
  static async createTable() {
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          token VARCHAR(255) NOT NULL UNIQUE,
          expires_at DATETIME NOT NULL,
          revoked BOOLEAN DEFAULT FALSE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user_id (user_id),
          INDEX idx_token (token),
          INDEX idx_expires_at (expires_at),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('Refresh tokens table created successfully');
    } catch (error) {
      console.error('Error creating refresh_tokens table:', error);
      throw error;
    }
  }
}

module.exports = RefreshToken;

