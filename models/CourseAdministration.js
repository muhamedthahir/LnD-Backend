const db = require('../config/db');
const pool = db;
const executeWithRetry = db.executeWithRetry || pool.execute;

class CourseAdministration {
  /**
   * Create a new course administration
   * @param {Object} adminData - Administration data
   * @returns {Promise<number>} Insert ID
   */
  static async create(adminData) {
    const {
      displayId,
      administrationName,
      category,
      competencyLevel,
      courseId,
      startDate,
      endDate,
      status,
      createdBy,
      college
    } = adminData;

    try {
      const [result] = await executeWithRetry(
        `INSERT INTO course_administrations (
          display_id,
          administration_name,
          category,
          competency_level,
          course_id,
          start_date,
          end_date,
          status,
          created_by,
          college,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          displayId,
          administrationName,
          category,
          competencyLevel,
          courseId,
          startDate,
          endDate,
          status || 'draft',
          createdBy,
          college || null
        ]
      );
      return result.insertId;
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        await this.createTable();
        const [result] = await executeWithRetry(
          `INSERT INTO course_administrations (
            display_id,
            administration_name,
            category,
            competency_level,
            course_id,
            start_date,
            end_date,
            status,
            created_by,
            college,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            displayId,
            administrationName,
            category,
            competencyLevel,
            courseId,
            startDate,
            endDate,
            status || 'draft',
            createdBy,
            college || null
          ]
        );
        return result.insertId;
      }
      throw error;
    }
  }

  /**
   * Find course administration by ID
   * @param {number} id - Administration ID
   * @returns {Promise<Object|null>} Administration object or null
   */
  static async findById(id) {
    try {
      const [rows] = await executeWithRetry(
        `SELECT a.*, 
         c.name as course_name,
         u.name as created_by_name,
         COUNT(DISTINCT e.id) as total_invites
         FROM course_administrations a
         LEFT JOIN courses c ON a.course_id = c.id
         LEFT JOIN users u ON a.created_by = u.id
         LEFT JOIN enrollments e ON e.administration_id = a.id AND e.student_id IS NOT NULL
         WHERE a.id = ?
         GROUP BY a.id`,
        [id]
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
   * Get all course administrations with filters and pagination
   * @param {Object} options - { limit, offset, filters }
   * @returns {Promise<Object>} { administrations, total }
   */
  static async getAll(options = {}) {
    const { limit = 50, offset = 0, filters = {} } = options;
    
    try {
      let query = `
        SELECT a.*, 
         c.name as course_name,
         u.name as created_by_name,
         COUNT(DISTINCT e.id) as total_invites,
         COALESCE(a.college, GROUP_CONCAT(DISTINCT u2.college_name)) as colleges
         FROM course_administrations a
         LEFT JOIN courses c ON a.course_id = c.id
         LEFT JOIN users u ON a.created_by = u.id
         LEFT JOIN enrollments e ON e.administration_id = a.id AND e.student_id IS NOT NULL
         LEFT JOIN enrollments e2 ON e2.administration_id = a.id AND e2.student_id IS NOT NULL
         LEFT JOIN users u2 ON e2.student_id = u2.id
         WHERE 1=1
      `;
      const params = [];

      // Apply filters
      if (filters.administrationName) {
        query += ' AND a.administration_name LIKE ?';
        params.push(`%${filters.administrationName}%`);
      }

      if (filters.status && filters.status !== 'all') {
        query += ' AND a.status = ?';
        params.push(filters.status);
      }

      if (filters.college) {
        query += ' AND (a.college = ? OR u2.college_name = ?)';
        params.push(filters.college, filters.college);
      }

      query += ' GROUP BY a.id';
      query += ' ORDER BY a.created_at DESC';
      // Use parseInt to ensure integers for LIMIT and OFFSET
      query += ` LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

      const [rows] = await executeWithRetry(query, params);

      // Get total count
      let countQuery = `
        SELECT COUNT(DISTINCT a.id) as total
        FROM course_administrations a
        LEFT JOIN enrollments e2 ON e2.administration_id = a.id AND e2.student_id IS NOT NULL
        LEFT JOIN users u2 ON e2.student_id = u2.id
        WHERE 1=1
      `;
      const countParams = [];

      if (filters.administrationName) {
        countQuery += ' AND a.administration_name LIKE ?';
        countParams.push(`%${filters.administrationName}%`);
      }

      if (filters.status && filters.status !== 'all') {
        countQuery += ' AND a.status = ?';
        countParams.push(filters.status);
      }

      if (filters.college) {
        countQuery += ' AND (a.college = ? OR u2.college_name = ?)';
        countParams.push(filters.college, filters.college);
      }

      const [countRows] = await executeWithRetry(countQuery, countParams);
      const total = countRows[0]?.total || 0;

      return {
        administrations: rows,
        total
      };
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        return { administrations: [], total: 0 };
      }
      throw error;
    }
  }

  /**
   * Update course administration
   * @param {number} id - Administration ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<boolean>} Success
   */
  static async update(id, updateData) {
    const {
      administrationName,
      startDate,
      endDate
    } = updateData;

    try {
      const [result] = await executeWithRetry(
        `UPDATE course_administrations 
         SET administration_name = ?,
             start_date = ?,
             end_date = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [administrationName, startDate, endDate, id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update administration status
   * @param {number} id - Administration ID
   * @param {string} status - New status ('draft' or 'published')
   * @returns {Promise<boolean>} Success
   */
  static async updateStatus(id, status) {
    try {
      const [result] = await executeWithRetry(
        `UPDATE course_administrations 
         SET status = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [status, id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete course administration
   * @param {number} id - Administration ID
   * @returns {Promise<boolean>} Success
   */
  static async delete(id) {
    try {
      const [result] = await executeWithRetry(
        'DELETE FROM course_administrations WHERE id = ?',
        [id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create the course_administrations table
   * @returns {Promise<void>}
   */
  static async createTable() {
    try {
      // Create course_administrations table
      await executeWithRetry(`
        CREATE TABLE IF NOT EXISTS course_administrations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          display_id VARCHAR(255) NOT NULL UNIQUE,
          administration_name VARCHAR(255) NOT NULL,
          category ENUM('code-along', 'self-paced') NOT NULL,
          competency_level ENUM('beginner', 'proficient', 'advanced', 'mastery', 'competency') NOT NULL,
          course_id INT NOT NULL,
          start_date DATETIME NOT NULL,
          end_date DATETIME NOT NULL,
          status ENUM('draft', 'published') DEFAULT 'draft',
          created_by INT NOT NULL,
          college VARCHAR(255) NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_course_id (course_id),
          INDEX idx_status (status),
          INDEX idx_created_by (created_by),
          INDEX idx_display_id (display_id),
          INDEX idx_college (college),
          FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Add college column if it doesn't exist (for existing tables)
      try {
        const [columns] = await executeWithRetry(`
          SELECT COLUMN_NAME
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'course_administrations' 
          AND COLUMN_NAME = 'college'
        `);
        
        if (columns.length === 0) {
          await executeWithRetry(`
            ALTER TABLE course_administrations 
            ADD COLUMN college VARCHAR(255) NULL,
            ADD INDEX idx_college (college)
          `);
          console.log('Added college column to course_administrations table');
        }
      } catch (error) {
        console.warn('Could not add college column (might already exist):', error.message);
      }
      
      // Update enrollments table to support administrations
      try {
        // Check if course_id is nullable
        const [columns] = await executeWithRetry(`
          SELECT COLUMN_NAME, IS_NULLABLE
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'enrollments' 
          AND COLUMN_NAME IN ('course_id', 'student_id', 'administration_id')
        `);
        
        const columnMap = {};
        columns.forEach(col => {
          columnMap[col.COLUMN_NAME] = col.IS_NULLABLE;
        });
        
        // Make course_id nullable if it's not already
        if (columnMap['course_id'] === 'NO') {
          await executeWithRetry(`
            ALTER TABLE enrollments 
            MODIFY COLUMN course_id INT NULL
          `);
          console.log('Made course_id nullable in enrollments table');
        }
        
        // Make student_id nullable if it's not already
        if (columnMap['student_id'] === 'NO') {
          await executeWithRetry(`
            ALTER TABLE enrollments 
            MODIFY COLUMN student_id INT NULL
          `);
          console.log('Made student_id nullable in enrollments table');
        }
        
        // Add administration_id column if it doesn't exist
        if (!columnMap['administration_id']) {
          await executeWithRetry(`
            ALTER TABLE enrollments 
            ADD COLUMN administration_id INT NULL,
            ADD INDEX idx_administration_id (administration_id)
          `);
          
          console.log('Added administration_id column to enrollments table');
        }
        
        // Check and fix foreign key constraint
        try {
          const [constraints] = await executeWithRetry(`
            SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'enrollments'
            AND COLUMN_NAME = 'administration_id'
          `);
          
          const oldConstraint = constraints.find(c => c.REFERENCED_TABLE_NAME === 'administrations');
          const correctConstraint = constraints.find(c => c.REFERENCED_TABLE_NAME === 'course_administrations');
          
          // If there's an old constraint pointing to 'administrations', drop it
          if (oldConstraint && !correctConstraint) {
            await executeWithRetry(`
              ALTER TABLE enrollments 
              DROP FOREIGN KEY ${oldConstraint.CONSTRAINT_NAME}
            `);
            console.log(`Dropped old foreign key constraint: ${oldConstraint.CONSTRAINT_NAME}`);
          }
          
          // Add correct foreign key if it doesn't exist
          if (!correctConstraint) {
            await executeWithRetry(`
              ALTER TABLE enrollments 
              ADD FOREIGN KEY (administration_id) REFERENCES course_administrations(id) ON DELETE CASCADE
            `);
            console.log('Added foreign key constraint to course_administrations');
          }
        } catch (fkError) {
          console.warn('Could not fix foreign key constraint:', fkError.message);
        }
      } catch (alterError) {
        console.warn('Could not alter enrollments table:', alterError.message);
      }
      
      console.log('Course administrations table created successfully');
    } catch (error) {
      console.error('Error creating course administrations table:', error);
      throw error;
    }
  }
}

module.exports = CourseAdministration;

