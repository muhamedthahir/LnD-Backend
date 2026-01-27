const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class Assessment {
  /**
   * Create assessments table if it doesn't exist
   */
  static async createTable() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS assessments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        unique_id VARCHAR(50) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        institution_id INT,
        topic_id INT,
        status ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') DEFAULT 'DRAFT',
        is_published BOOLEAN DEFAULT FALSE,
        total_duration INT DEFAULT 0,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated_by INT,
        last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_status (status),
        INDEX idx_institution (institution_id),
        INDEX idx_topic (topic_id),
        INDEX idx_created_at (created_at),
        INDEX idx_unique_id (unique_id)
      )
    `;
    
    try {
      await pool.execute(createTableSQL);
      console.log('Assessment table created or already exists');
    } catch (error) {
      console.error('Error creating assessments table:', error);
      throw error;
    }
  }

  /**
   * Generate unique ID
   */
  static generateUniqueId() {
    return `ASM-${uuidv4().substring(0, 8).toUpperCase()}`;
  }

  /**
   * Create a new assessment
   */
  static async create(assessmentData) {
    const {
      title,
      description,
      institution_id,
      topic_id,
      status = 'DRAFT',
      created_by
    } = assessmentData;

    const unique_id = this.generateUniqueId();

    try {
      const [result] = await pool.execute(
        `INSERT INTO assessments 
         (unique_id, title, description, institution_id, topic_id, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [unique_id, title, description, institution_id || null, topic_id || null, status, created_by]
      );
      
      return {
        id: result.insertId,
        unique_id
      };
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('Assessment with this unique ID already exists');
      }
      throw error;
    }
  }

  /**
   * Find assessment by ID
   */
  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT a.*, 
              i.name as institution_name,
              t.name as topic_name,
              u.name as created_by_name
       FROM assessments a
       LEFT JOIN institutions i ON a.institution_id = i.id
       LEFT JOIN topics t ON a.topic_id = t.id
       LEFT JOIN users u ON a.created_by = u.id
       WHERE a.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Find assessment by unique_id
   */
  static async findByUniqueId(unique_id) {
    const [rows] = await pool.execute(
      `SELECT a.*, 
              i.name as institution_name,
              t.name as topic_name,
              u.name as created_by_name
       FROM assessments a
       LEFT JOIN institutions i ON a.institution_id = i.id
       LEFT JOIN topics t ON a.topic_id = t.id
       LEFT JOIN users u ON a.created_by = u.id
       WHERE a.unique_id = ?`,
      [unique_id]
    );
    return rows[0] || null;
  }

  /**
   * Get all assessments with pagination and filters
   */
  static async getAllPaginated({ search, status, institution_id, topic_id, page = 1, pageSize = 10 }) {
    const offset = (page - 1) * pageSize;
    let query = `
      SELECT a.*, 
             i.name as institution_name,
             t.name as topic_name,
             u.name as created_by_name,
             (SELECT COUNT(*) FROM assessment_segments WHERE assessment_id = a.id) as segment_count,
             (SELECT COUNT(*) FROM assessment_administrators WHERE assessment_id = a.id) as config_count
      FROM assessments a
      LEFT JOIN institutions i ON a.institution_id = i.id
      LEFT JOIN topics t ON a.topic_id = t.id
      LEFT JOIN users u ON a.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ' AND (a.title LIKE ? OR a.unique_id LIKE ? OR a.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }

    if (institution_id) {
      query += ' AND a.institution_id = ?';
      params.push(institution_id);
    }

    if (topic_id) {
      query += ' AND a.topic_id = ?';
      params.push(topic_id);
    }

    // Get total count
    const countQuery = query.replace(/SELECT a\.\*[\s\S]*?FROM assessments a/, 'SELECT COUNT(*) as total FROM assessments a');
    const [countRows] = await pool.execute(countQuery, params);
    const total = countRows[0].total;

    // Get paginated results
    query += ' ORDER BY a.created_at DESC';
    query += ` LIMIT ${parseInt(pageSize)} OFFSET ${parseInt(offset)}`;
    const [rows] = await pool.execute(query, params);

    return {
      assessments: rows,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      totalPages: Math.ceil(total / pageSize)
    };
  }

  /**
   * Update an assessment
   */
  static async update(id, assessmentData) {
    const {
      title,
      description,
      institution_id,
      topic_id,
      status,
      is_published,
      total_duration,
      last_updated_by
    } = assessmentData;

    try {
      await pool.execute(
        `UPDATE assessments SET
           title = COALESCE(?, title),
           description = COALESCE(?, description),
           institution_id = ?,
           topic_id = ?,
           status = COALESCE(?, status),
           is_published = COALESCE(?, is_published),
           total_duration = COALESCE(?, total_duration),
           last_updated_by = ?
         WHERE id = ?`,
        [title, description, institution_id, topic_id, status, is_published, total_duration, last_updated_by, id]
      );
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete an assessment
   */
  static async delete(id) {
    await pool.execute('DELETE FROM assessments WHERE id = ?', [id]);
    return true;
  }

  /**
   * Update assessment status
   */
  static async updateStatus(id, status, updated_by) {
    const is_published = status === 'PUBLISHED';
    await pool.execute(
      'UPDATE assessments SET status = ?, is_published = ?, last_updated_by = ? WHERE id = ?',
      [status, is_published, updated_by, id]
    );
    return true;
  }

  /**
   * Calculate and update total duration from segments
   */
  static async updateTotalDuration(id) {
    const [result] = await pool.execute(
      `UPDATE assessments 
       SET total_duration = (
         SELECT COALESCE(SUM(segment_duration), 0) 
         FROM assessment_segments 
         WHERE assessment_id = ?
       )
       WHERE id = ?`,
      [id, id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Get assessment with all segments
   */
  static async getWithSegments(id) {
    const assessment = await this.findById(id);
    if (!assessment) return null;

    const AssessmentSegment = require('./AssessmentSegment');
    const segments = await AssessmentSegment.getByAssessmentId(id);
    
    // Get questions for each segment
    for (const segment of segments) {
      const segmentWithQuestions = await AssessmentSegment.getWithQuestions(segment.id);
      if (segmentWithQuestions) {
        segment.programming_questions = segmentWithQuestions.programming_questions || [];
        segment.mcq_questions = segmentWithQuestions.mcq_questions || [];
      } else {
        segment.programming_questions = [];
        segment.mcq_questions = [];
      }
    }

    assessment.segments = segments;
    return assessment;
  }

  /**
   * Get assessment with all configurations
   */
  static async getWithConfigurations(id) {
    const assessment = await this.findById(id);
    if (!assessment) return null;

    const [configurations] = await pool.execute(
      `SELECT aa.*, 
              tc.total_time, tc.timing_mode, tc.start_date_time, tc.end_date_time,
              pc.proctoring_enabled, pc.full_screen_mandatory,
              sc.threshold_for_pass, sc.show_score_at_end,
              qc.fetch_random_question, qc.randomize_question_to_users,
              ac.access_code, ac.max_attempts
       FROM assessment_administrators aa
       LEFT JOIN timing_configs tc ON aa.id = tc.assessment_administrator_id
       LEFT JOIN proctoring_configs pc ON aa.id = pc.assessment_administrator_id
       LEFT JOIN scoring_configs sc ON aa.id = sc.assessment_administrator_id
       LEFT JOIN question_configs qc ON aa.id = qc.assessment_administrator_id
       LEFT JOIN access_configs ac ON aa.id = ac.assessment_administrator_id
       WHERE aa.assessment_id = ?
       ORDER BY aa.created_at DESC`,
      [id]
    );

    assessment.configurations = configurations;
    return assessment;
  }

  /**
   * Duplicate an assessment
   */
  static async duplicate(id, created_by) {
    const assessment = await this.findById(id);
    if (!assessment) return null;

    // Create new assessment
    const newAssessment = await this.create({
      title: `${assessment.title} (Copy)`,
      description: assessment.description,
      institution_id: assessment.institution_id,
      topic_id: assessment.topic_id,
      status: 'DRAFT',
      created_by
    });

    // Copy segments
    const [segments] = await pool.execute(
      'SELECT * FROM assessment_segments WHERE assessment_id = ?',
      [id]
    );

    for (const segment of segments) {
      const AssessmentSegment = require('./AssessmentSegment');
      await AssessmentSegment.create({
        assessment_id: newAssessment.id,
        name: segment.name,
        description: segment.description,
        sequence_order: segment.sequence_order,
        segment_duration: segment.segment_duration,
        allow_back_navigation: segment.allow_back_navigation,
        is_locked: segment.is_locked,
        created_by
      });
    }

    return newAssessment;
  }

  /**
   * Get assessment statistics
   */
  static async getStatistics(id) {
    const [stats] = await pool.execute(
      `SELECT 
        (SELECT COUNT(*) FROM assessment_segments WHERE assessment_id = ?) as total_segments,
        (SELECT COUNT(*) FROM assessment_administrators WHERE assessment_id = ?) as total_configs,
        (SELECT COUNT(DISTINCT aum.user_id) 
         FROM assessment_user_mappings aum
         JOIN assessment_administrators aa ON aum.assessment_administrator_id = aa.id
         WHERE aa.assessment_id = ?) as total_users,
        (SELECT COUNT(*) 
         FROM assessment_user_mappings aum
         JOIN assessment_administrators aa ON aum.assessment_administrator_id = aa.id
         WHERE aa.assessment_id = ? AND aum.status = 'COMPLETED') as completed_users,
        (SELECT AVG(aum.percentage_score) 
         FROM assessment_user_mappings aum
         JOIN assessment_administrators aa ON aum.assessment_administrator_id = aa.id
         WHERE aa.assessment_id = ? AND aum.status = 'COMPLETED') as avg_score
      `,
      [id, id, id, id, id]
    );
    return stats[0];
  }
}

module.exports = Assessment;

