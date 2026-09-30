const pool = require('../config/db');

class UserRole {
  /**
   * Create a new user role
   * @param {Object} roleData - { name, description, role_rank }
   * @returns {Promise<number>} - The inserted role ID
   */
  static async create(roleData) {
    const { name, description, role_rank } = roleData;
    const [result] = await pool.execute(
      'INSERT INTO user_roles (name, description, role_rank) VALUES (?, ?, ?)',
      [name, description || null, role_rank || 0]
    );
    return result.insertId;
  }

  /**
   * Find a role by ID
   * @param {number} id - Role ID
   * @returns {Promise<Object|null>} - Role object or null
   */
  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM user_roles WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Find a role by name
   * @param {string} name - Role name
   * @returns {Promise<Object|null>} - Role object or null
   */
  static async findByName(name) {
    const [rows] = await pool.execute(
      'SELECT * FROM user_roles WHERE name = ?',
      [name]
    );
    return rows[0] || null;
  }

  /**
   * Get all roles ordered by role_rank
   * @returns {Promise<Array>} - Array of role objects
   */
  static async getAll() {
    const [rows] = await pool.execute(
      'SELECT * FROM user_roles ORDER BY role_rank ASC'
    );
    return rows;
  }

  /**
   * Update a role
   * @param {number} id - Role ID
   * @param {Object} roleData - { name, description, role_rank }
   * @returns {Promise<boolean>} - True if updated
   */
  static async update(id, roleData) {
    const { name, description, role_rank } = roleData;
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (role_rank !== undefined) {
      updates.push('role_rank = ?');
      values.push(role_rank);
    }

    if (updates.length === 0) {
      return false;
    }

    values.push(id);
    const [result] = await pool.execute(
      `UPDATE user_roles SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    return result.affectedRows > 0;
  }

  /**
   * Delete a role
   * @param {number} id - Role ID
   * @returns {Promise<boolean>} - True if deleted
   */
  static async delete(id) {
    const [result] = await pool.execute(
      'DELETE FROM user_roles WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Check if a role exists by name
   * @param {string} name - Role name
   * @returns {Promise<boolean>} - True if exists
   */
  static async exists(name) {
    const [rows] = await pool.execute(
      'SELECT 1 FROM user_roles WHERE name = ? LIMIT 1',
      [name]
    );
    return rows.length > 0;
  }

  /**
   * Get role name for a user by checking their role_id or fallback to role field
   * @param {Object} user - User object with role_id and/or role fields
   * @returns {Promise<string|null>} - Role name
   */
  static async getRoleNameForUser(user) {
    // If user has role_id, fetch from user_roles table
    if (user.role_id) {
      const role = await this.findById(user.role_id);
      return role ? role.name : null;
    }
    // Fallback to the role field in users table (for backward compatibility)
    return user.role || null;
  }

  /**
   * Get role ID by name (useful for lookups)
   * @param {string} name - Role name
   * @returns {Promise<number|null>} - Role ID or null
   */
  static async getIdByName(name) {
    const role = await this.findByName(name);
    return role ? role.id : null;
  }
}

module.exports = UserRole;

