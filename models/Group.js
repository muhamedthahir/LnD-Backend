const pool = require('../config/db');

class Group {
  static async create(groupData) {
    const { name, college_name, degree, department, passout_year, created_by } = groupData;
    const [result] = await pool.execute(
      'INSERT INTO `groups` (name, college_name, degree, department, passout_year, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [name, college_name, degree || null, department || null, passout_year || null, created_by]
    );
    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM `groups` WHERE id = ?',
      [id]
    );
    return rows[0];
  }

  static async getAll(collegeName = null, limit = 50, offset = 0) {
    let query = `
      SELECT g.*, u.name as creator_name, COUNT(gm.user_id) as member_count 
      FROM \`groups\` g 
      LEFT JOIN users u ON g.created_by = u.id 
      LEFT JOIN group_members gm ON g.id = gm.group_id 
    `;
    
    const params = [];
    
    if (collegeName) {
      query += ' WHERE g.college_name = ?';
      params.push(collegeName);
    }
    
    query += ' GROUP BY g.id ORDER BY g.created_at DESC';
    
    // Only add LIMIT/OFFSET if provided
    if (limit != null && offset != null) {
      const limitInt = parseInt(limit, 10) || 50;
      const offsetInt = parseInt(offset, 10) || 0;
      query += ` LIMIT ${limitInt} OFFSET ${offsetInt}`;
    }
    
    const [rows] = await pool.query(query, params);
    return rows;
  }

  static async update(id, groupData) {
    const { name, college_name, degree, department, passout_year } = groupData;
    await pool.execute(
      'UPDATE `groups` SET name = ?, college_name = ?, degree = ?, department = ?, passout_year = ? WHERE id = ?',
      [name, college_name, degree || null, department || null, passout_year || null, id]
    );
  }

  static async delete(id) {
    await pool.execute('DELETE FROM `groups` WHERE id = ?', [id]);
  }

  static async getMembers(groupId) {
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.roll_number, u.department, u.section 
       FROM group_members gm 
       JOIN users u ON gm.user_id = u.id 
       WHERE gm.group_id = ? 
       ORDER BY u.name`,
      [groupId]
    );
    return rows;
  }

  static async addMember(groupId, userId) {
    try {
      await pool.execute(
        'INSERT INTO group_members (group_id, user_id) VALUES (?, ?)',
        [groupId, userId]
      );
      return true;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return false; // Already a member
      }
      throw error;
    }
  }

  static async removeMember(groupId, userId) {
    await pool.execute(
      'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );
  }

  static async addMembers(groupId, userIds) {
    if (userIds.length === 0) return;
    
    const values = userIds.map(userId => [groupId, userId]);
    const placeholders = values.map(() => '(?, ?)').join(', ');
    const flatValues = values.flat();
    
    try {
      await pool.execute(
        `INSERT IGNORE INTO group_members (group_id, user_id) VALUES ${placeholders}`,
        flatValues
      );
      return true;
    } catch (error) {
      throw error;
    }
  }

  static async removeMembers(groupId, userIds) {
    if (userIds.length === 0) return;
    
    const placeholders = userIds.map(() => '?').join(', ');
    await pool.execute(
      `DELETE FROM group_members WHERE group_id = ? AND user_id IN (${placeholders})`,
      [groupId, ...userIds]
    );
  }

  static async getUsersNotInGroup(groupId, collegeName, search = '') {
    let query = `
      SELECT u.id, u.name, u.email, u.roll_number, u.department, u.section 
      FROM users u 
      WHERE u.role = 'student' 
      AND u.college_name = ? 
      AND u.id NOT IN (SELECT user_id FROM group_members WHERE group_id = ?)
    `;
    const params = [collegeName, groupId];

    if (search) {
      query += ` AND (u.name LIKE ? OR u.email LIKE ? OR u.roll_number LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    query += ' ORDER BY u.name';

    const [rows] = await pool.execute(query, params);
    return rows;
  }
}

module.exports = Group;

