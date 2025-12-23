const pool = require('../config/db');

class User {
  static async create(userData) {
    const { name, email, password, role, college_name, roll_number, department, section, degree, otp, otp_expires_at } = userData;
    
    try {
      // Try full insert with all columns
      const [result] = await pool.execute(
        'INSERT INTO users (name, email, password, role, college_name, roll_number, department, section, degree, otp, otp_expires_at, password_set) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          name, 
          email, 
          password || null, 
          role, 
          college_name || null, 
          roll_number || null, 
          department || null, 
          section || '1',
          degree || null,
          otp || null,
          otp_expires_at || null,
          password ? true : false
        ]
      );
      return result.insertId;
    } catch (error) {
      // If columns don't exist, use basic insert
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        console.warn('New columns missing, using basic insert. Please run migration.');
        const [result] = await pool.execute(
          'INSERT INTO users (name, email, password, role, college_name) VALUES (?, ?, ?, ?, ?)',
          [name, email, password || null, role, college_name || null]
        );
        return result.insertId;
      }
      throw error;
    }
  }
  
  static async findByOTP(otp) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM users WHERE otp = ? AND otp_expires_at > NOW()',
        [otp]
      );
      return rows[0] || null;
    } catch (error) {
      // If error is about missing columns, OTP feature not available
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        console.warn('OTP columns missing. Please run migration.');
        return null;
      }
      throw error;
    }
  }
  
  static async setPassword(userId, password) {
    await pool.execute(
      'UPDATE users SET password = ?, password_set = TRUE, otp = NULL, otp_expires_at = NULL WHERE id = ?',
      [password, userId]
    );
  }

  static async findByEmail(email) {
    try {
      // Try to select all columns, but handle missing columns gracefully
      const [rows] = await pool.execute(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );
      if (rows[0]) {
        // Ensure all expected fields exist, even if null
        return {
          ...rows[0],
          roll_number: rows[0].roll_number || null,
          department: rows[0].department || null,
          section: rows[0].section || '1',
          otp: rows[0].otp || null,
          otp_expires_at: rows[0].otp_expires_at || null,
          password_set: rows[0].password_set || false
        };
      }
      return null;
    } catch (error) {
      // If error is about missing columns, try a simpler query
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        console.warn('Some columns missing, using basic query. Please run migration.');
        const [rows] = await pool.execute(
          'SELECT id, name, email, password, role, college_name, created_at FROM users WHERE email = ?',
          [email]
        );
        if (rows[0]) {
          return {
            ...rows[0],
            roll_number: null,
            department: null,
            section: '1',
            otp: null,
            otp_expires_at: null,
            password_set: false
          };
        }
        return null;
      }
      throw error;
    }
  }

  static async findById(id) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM users WHERE id = ?',
        [id]
      );
      if (rows[0]) {
        // Ensure all expected fields exist, even if null
        return {
          id: rows[0].id,
          name: rows[0].name,
          email: rows[0].email,
          role: rows[0].role,
          college_name: rows[0].college_name || null,
          roll_number: rows[0].roll_number || null,
          department: rows[0].department || null,
          section: rows[0].section || '1',
          created_at: rows[0].created_at
        };
      }
      return null;
    } catch (error) {
      // If error is about missing columns, try a simpler query
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        console.warn('Some columns missing, using basic query. Please run migration.');
        const [rows] = await pool.execute(
          'SELECT id, name, email, role, college_name, created_at FROM users WHERE id = ?',
          [id]
        );
        if (rows[0]) {
          return {
            ...rows[0],
            roll_number: null,
            department: null,
            section: '1'
          };
        }
        return null;
      }
      throw error;
    }
  }

  static async update(id, userData) {
    const { name, email, role, college_name, roll_number, department, section, degree } = userData;
    const updates = [];
    const values = [];
    
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (email !== undefined) { updates.push('email = ?'); values.push(email); }
    if (role !== undefined) { updates.push('role = ?'); values.push(role); }
    if (college_name !== undefined) { updates.push('college_name = ?'); values.push(college_name); }
    if (roll_number !== undefined) { updates.push('roll_number = ?'); values.push(roll_number); }
    if (department !== undefined) { updates.push('department = ?'); values.push(department); }
    if (section !== undefined) { updates.push('section = ?'); values.push(section); }
    if (degree !== undefined) { updates.push('degree = ?'); values.push(degree); }
    
    if (updates.length > 0) {
      values.push(id);
      await pool.execute(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }
  }

  static async delete(id) {
    await pool.execute('DELETE FROM users WHERE id = ?', [id]);
  }

  static async getAllPaginated({ search, college, limit = 10, offset = 0, excludePrimaryAdmin = false, excludeCurrentUser = null }) {
    try {
      // Build WHERE conditions
      const conditions = [];
      const params = [];
      
      if (excludePrimaryAdmin) {
        conditions.push('role != ?');
        params.push('primary_admin');
      }
      
      if (excludeCurrentUser) {
        conditions.push('id != ?');
        params.push(excludeCurrentUser);
      }
      
      if (college && college.trim() !== '') {
        conditions.push('college_name = ?');
        params.push(college.trim());
      }
      
      if (search && search.trim() !== '') {
        conditions.push('(name LIKE ? OR email LIKE ? OR roll_number LIKE ?)');
        const searchPattern = `%${search.trim()}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }
      
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      console.log('getAllPaginated conditions:', { search, college, excludePrimaryAdmin, excludeCurrentUser });
      console.log('getAllPaginated whereClause:', whereClause);
      console.log('getAllPaginated params:', params);
      
      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM users${whereClause ? ' ' + whereClause : ''}`;
      let countRows;
      try {
        if (params.length > 0) {
          [countRows] = await pool.execute(countQuery, params);
        } else {
          [countRows] = await pool.query(countQuery);
        }
      } catch (countError) {
        console.error('Error in count query:', countError);
        console.error('Count query:', countQuery);
        console.error('Count params:', params);
        throw countError;
      }
      const total = countRows[0].total;
      
      // Get paginated results
      const limitInt = Math.max(1, Math.min(1000, parseInt(limit, 10) || 10));
      const offsetInt = Math.max(0, parseInt(offset, 10) || 0);
      
      // Build query - LIMIT and OFFSET cannot be parameterized in MySQL, so use template literals
      // This is safe because limitInt and offsetInt are validated integers
      const selectQuery = `SELECT *, password_set, password FROM users${whereClause ? ' ' + whereClause : ''} ORDER BY created_at DESC LIMIT ${limitInt} OFFSET ${offsetInt}`;
      console.log('getAllPaginated SELECT SQL:', selectQuery);
      console.log('getAllPaginated SELECT params:', params);
      
      let rows;
      try {
        if (params.length > 0) {
          [rows] = await pool.execute(selectQuery, params);
        } else {
          [rows] = await pool.query(selectQuery);
        }
      } catch (selectError) {
        console.error('Error in select query:', selectError);
        console.error('Select query:', selectQuery);
        console.error('Select params:', params);
        throw selectError;
      }
      
      // Ensure all expected fields exist and calculate status
      const users = rows.map(row => {
        // Check password_set for all users, not just students
        const status = (row.password_set === true || row.password_set === 1 || row.password) ? 'activated' : 'pending';
        
        return {
          id: row.id,
          name: row.name,
          email: row.email,
          role: row.role,
          college_name: row.college_name || null,
          roll_number: row.roll_number || null,
          department: row.department || null,
          section: row.section || '1',
          degree: row.degree || null,
          status: status,
          created_at: row.created_at
        };
      });
      
      return { users, total };
    } catch (error) {
      console.error('Get all paginated error:', error);
      throw error;
    }
  }

  static async getAll(limit = 50, offset = 0) {
    try {
      // Ensure limit and offset are proper integers
      let limitInt = 50;
      let offsetInt = 0;
      
      if (limit != null && limit !== undefined) {
        const parsed = parseInt(limit, 10);
        if (!isNaN(parsed) && parsed > 0) {
          limitInt = parsed;
        }
      }
      
      if (offset != null && offset !== undefined) {
        const parsed = parseInt(offset, 10);
        if (!isNaN(parsed) && parsed >= 0) {
          offsetInt = parsed;
        }
      }
      
      console.log('User.getAll called with limit:', limitInt, 'offset:', offsetInt);
      console.log('Limit type:', typeof limitInt, 'Offset type:', typeof offsetInt);
      
      // Use query instead of execute to avoid parameter binding issues
      const [rows] = await pool.query(
        `SELECT * FROM users ORDER BY created_at DESC LIMIT ${limitInt} OFFSET ${offsetInt}`
      );
      
      // Ensure all expected fields exist and calculate status
      return rows.map(row => {
        // Determine status: pending if password not set, activated if password is set
        // Apply to all users, not just students
        const status = (row.password_set === true || row.password_set === 1 || row.password) ? 'activated' : 'pending';
        
        return {
          id: row.id,
          name: row.name,
          email: row.email,
          role: row.role,
          college_name: row.college_name || null,
          roll_number: row.roll_number || null,
          department: row.department || null,
          section: row.section || '1',
          status: status,
          created_at: row.created_at
        };
      });
    } catch (error) {
      console.error('User.getAll error:', error);
      console.error('Error details:', {
        code: error.code,
        errno: error.errno,
        sqlMessage: error.sqlMessage,
        sql: error.sql,
        limit,
        offset
      });
      
      // If columns don't exist, use basic query
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        console.warn('New columns missing, using basic query. Please run migration.');
        let limitInt = 50;
        let offsetInt = 0;
        
        if (limit != null && limit !== undefined) {
          const parsed = parseInt(limit, 10);
          if (!isNaN(parsed) && parsed > 0) limitInt = parsed;
        }
        if (offset != null && offset !== undefined) {
          const parsed = parseInt(offset, 10);
          if (!isNaN(parsed) && parsed >= 0) offsetInt = parsed;
        }
        
        const [rows] = await pool.query(
          `SELECT id, name, email, role, college_name, created_at, password_set, password FROM users ORDER BY created_at DESC LIMIT ${limitInt} OFFSET ${offsetInt}`
        );
        return rows.map(row => {
          // Check password_set for all users, not just students
          const status = (row.password_set === true || row.password_set === 1 || row.password) ? 'activated' : 'pending';
          return {
            ...row,
            roll_number: null,
            department: null,
            section: '1',
            status: status
          };
        });
      }
      
      throw error;
    }
  }
  
  static async getByRole(role, limit = 50, offset = 0) {
    try {
      // Ensure limit and offset are integers
      let limitInt = 50;
      let offsetInt = 0;
      
      if (limit != null && limit !== undefined) {
        const parsed = parseInt(limit, 10);
        if (!isNaN(parsed) && parsed > 0) limitInt = parsed;
      }
      if (offset != null && offset !== undefined) {
        const parsed = parseInt(offset, 10);
        if (!isNaN(parsed) && parsed >= 0) offsetInt = parsed;
      }
      
      const [rows] = await pool.query(
        `SELECT * FROM users WHERE role = ? ORDER BY created_at DESC LIMIT ${limitInt} OFFSET ${offsetInt}`,
        [role]
      );
      return rows.map(row => {
        // Check password_set for all users, not just students
        const status = (row.password_set === true || row.password_set === 1 || row.password) ? 'activated' : 'pending';
        return {
          id: row.id,
          name: row.name,
          email: row.email,
          role: row.role,
          college_name: row.college_name || null,
          roll_number: row.roll_number || null,
          department: row.department || null,
          section: row.section || '1',
          status: status,
          created_at: row.created_at
        };
      });
    } catch (error) {
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        console.warn('New columns missing, using basic query. Please run migration.');
        let limitInt = 50;
        let offsetInt = 0;
        if (limit != null && limit !== undefined) {
          const parsed = parseInt(limit, 10);
          if (!isNaN(parsed) && parsed > 0) limitInt = parsed;
        }
        if (offset != null && offset !== undefined) {
          const parsed = parseInt(offset, 10);
          if (!isNaN(parsed) && parsed >= 0) offsetInt = parsed;
        }
        const [rows] = await pool.query(
          `SELECT id, name, email, role, college_name, created_at, password_set, password FROM users WHERE role = ? ORDER BY created_at DESC LIMIT ${limitInt} OFFSET ${offsetInt}`,
          [role]
        );
        return rows.map(row => {
          // Check password_set for all users, not just students
          const status = (row.password_set === true || row.password_set === 1 || row.password) ? 'activated' : 'pending';
          return {
            ...row,
            roll_number: null,
            department: null,
            section: '1',
            status: status
          };
        });
      }
      throw error;
    }
  }

  static async getByCollege(collegeName) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM users WHERE college_name = ? ORDER BY name',
        [collegeName]
      );
      return rows.map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        college_name: row.college_name || null,
        roll_number: row.roll_number || null,
        department: row.department || null,
        section: row.section || '1',
        created_at: row.created_at
      }));
    } catch (error) {
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        console.warn('New columns missing, using basic query. Please run migration.');
        const [rows] = await pool.execute(
          'SELECT id, name, email, role, college_name, created_at FROM users WHERE college_name = ? ORDER BY name',
          [collegeName]
        );
        return rows.map(row => ({
          ...row,
          roll_number: null,
          department: null,
          section: '1'
        }));
      }
      throw error;
    }
  }

  static async getColleges() {
    const [rows] = await pool.execute(
      'SELECT DISTINCT college_name FROM users WHERE college_name IS NOT NULL ORDER BY college_name'
    );
    return rows.map(row => row.college_name);
  }

  static async getCollegeAdminsByCollege(collegeName) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM users WHERE role = ? AND college_name = ?',
        ['college_admin', collegeName]
      );
      return rows.map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        college_name: row.college_name
      }));
    } catch (error) {
      console.error('Error getting college admins by college:', error);
      throw error;
    }
  }
}

module.exports = User;

