const pool = require('../config/db');
const ensureColumns = require('../utils/ensureColumns');

class Institution {
  static async ensureDetailColumns() {
    await ensureColumns(pool, 'institutions', [
      { name: 'address', definition: 'TEXT NULL' },
      { name: 'spoc_contact_number', definition: 'VARCHAR(50) NULL' },
      { name: 'alternate_contact', definition: 'VARCHAR(50) NULL' },
      { name: 'alternate_email', definition: 'VARCHAR(255) NULL' },
      { name: 'status', definition: "ENUM('active', 'inactive') NOT NULL DEFAULT 'active'" }
    ]);
  }

  static async create(institutionData) {
    await this.ensureDetailColumns();
    const {
      name,
      address = null,
      spoc_contact_number = null,
      alternate_contact = null,
      alternate_email = null,
      status = 'active'
    } = institutionData;

    try {
      const [result] = await pool.execute(
        `INSERT INTO institutions (
          name, address, spoc_contact_number, alternate_contact, alternate_email, status
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          name,
          address || null,
          spoc_contact_number || null,
          alternate_contact || null,
          alternate_email || null,
          status === 'inactive' ? 'inactive' : 'active'
        ]
      );
      return result.insertId;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('Institution with this name already exists');
      }
      throw error;
    }
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM institutions WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  static async findByName(name) {
    const [rows] = await pool.execute(
      'SELECT * FROM institutions WHERE name = ?',
      [name]
    );
    return rows[0] || null;
  }

  static async getAllPaginated({ search, limit, offset }) {
    await this.ensureDetailColumns();
    let query = 'SELECT * FROM institutions WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND name LIKE ?';
      params.push(`%${search}%`);
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    // Get paginated results
    const pageSize = Math.max(1, Math.min(1000, Number.parseInt(limit, 10) || 10));
    const start = Math.max(0, Number.parseInt(offset, 10) || 0);
    query += ` ORDER BY name ASC, id ASC LIMIT ${pageSize} OFFSET ${start}`;
    const [[rows], [countRows]] = await Promise.all([pool.execute(query, params), pool.execute(countQuery, params)]);
    const total = countRows[0].total;

    return {
      institutions: rows,
      total: total
    };
  }

  static async getAll() {
    await this.ensureDetailColumns();
    const [rows] = await pool.execute(
      'SELECT * FROM institutions ORDER BY name ASC'
    );
    return rows;
  }

  /** Institutions available for assignment (dropdowns): active only */
  static async getAllActive() {
    await this.ensureDetailColumns();
    try {
      const [rows] = await pool.execute(
        "SELECT * FROM institutions WHERE status = 'active' ORDER BY name ASC"
      );
      return rows;
    } catch (error) {
      // Backward compatibility for databases where status column isn't migrated yet.
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        const [rows] = await pool.execute(
          'SELECT * FROM institutions ORDER BY name ASC'
        );
        return rows;
      }
      throw error;
    }
  }

  static async update(id, institutionData) {
    await this.ensureDetailColumns();
    const {
      name,
      address = null,
      spoc_contact_number = null,
      alternate_contact = null,
      alternate_email = null,
      status = 'active'
    } = institutionData;

    try {
      await pool.execute(
        `UPDATE institutions SET
          name = ?,
          address = ?,
          spoc_contact_number = ?,
          alternate_contact = ?,
          alternate_email = ?,
          status = ?
        WHERE id = ?`,
        [
          name,
          address || null,
          spoc_contact_number || null,
          alternate_contact || null,
          alternate_email || null,
          status === 'inactive' ? 'inactive' : 'active',
          id
        ]
      );
      return true;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('Institution with this name already exists');
      }
      throw error;
    }
  }

  static async delete(id) {
    // Check if institution has users
    const [userRows] = await pool.execute(
      'SELECT COUNT(*) as count FROM users WHERE college_name = (SELECT name FROM institutions WHERE id = ?)',
      [id]
    );

    if (userRows[0].count > 0) {
      throw new Error('Cannot delete institution with existing users');
    }

    await pool.execute(
      'DELETE FROM institutions WHERE id = ?',
      [id]
    );
    return true;
  }

  static async getAdmins(institutionId) {
    const [rows] = await pool.execute(
      `SELECT u.* FROM users u
       INNER JOIN institutions i ON u.college_name = i.name
       WHERE i.id = ? AND u.role = 'college_admin'
       ORDER BY u.created_at ASC`,
      [institutionId]
    );
    return rows;
  }
}

module.exports = Institution;
