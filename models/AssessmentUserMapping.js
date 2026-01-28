const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class AssessmentUserMapping {
  /**
   * Create assessment_user_mappings table if it doesn't exist
   */
  static async createTable() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS assessment_user_mappings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        unique_id VARCHAR(50) UNIQUE NOT NULL,
        assessment_administrator_id INT NOT NULL,
        user_id INT NOT NULL,
        status ENUM('INVITED', 'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'EXPIRED', 'DISQUALIFIED') DEFAULT 'INVITED',
        attempt_number INT DEFAULT 1,
        mail_sent_at DATETIME DEFAULT NULL,
        assessment_started_time DATETIME DEFAULT NULL,
        assessment_ended_time DATETIME DEFAULT NULL,
        submitted_at DATETIME DEFAULT NULL,
        total_time_worked INT DEFAULT 0,
        current_segment_index INT DEFAULT 0,
        last_activity_at DATETIME DEFAULT NULL,
        resume_count INT DEFAULT 0,
        total_score DECIMAL(10,2) DEFAULT 0,
        max_possible_score DECIMAL(10,2) DEFAULT 0,
        percentage_score DECIMAL(5,2) DEFAULT 0,
        passed BOOLEAN DEFAULT FALSE,
        segment_wise_scores JSON DEFAULT NULL,
        ip_address VARCHAR(45) DEFAULT NULL,
        browser_info VARCHAR(500) DEFAULT NULL,
        tab_switch_count INT DEFAULT 0,
        feedback_rating INT DEFAULT NULL,
        feedback_comment TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        UNIQUE KEY unique_user_attempt (user_id, assessment_administrator_id, attempt_number),
        INDEX idx_administrator (assessment_administrator_id),
        INDEX idx_user (user_id),
        INDEX idx_status (status),
        INDEX idx_unique_id (unique_id),
        
        FOREIGN KEY (assessment_administrator_id) REFERENCES assessment_administrators(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;
    
    try {
      await pool.execute(createTableSQL);
      console.log('AssessmentUserMapping table created or already exists');
    } catch (error) {
      console.error('Error creating assessment_user_mappings table:', error);
      throw error;
    }
  }

  /**
   * Generate unique ID
   */
  static generateUniqueId() {
    return `AUM-${uuidv4().substring(0, 8).toUpperCase()}`;
  }

  /**
   * Safely parse JSON
   */
  static safeJsonParse(value, defaultValue = null) {
    if (!value || value === '' || value === 'null') return defaultValue;
    try {
      return typeof value === 'string' ? JSON.parse(value) : value;
    } catch (e) {
      return defaultValue;
    }
  }

  /**
   * Create a new user mapping (invite user)
   */
  static async create(mappingData) {
    const {
      assessment_administrator_id,
      user_id,
      status = 'INVITED'
    } = mappingData;

    const unique_id = this.generateUniqueId();

    // Check max attempts
    const { AccessConfig } = require('./AssessmentConfigs');
    const accessConfig = await AccessConfig.findByAdminId(assessment_administrator_id);
    const maxAttempts = accessConfig?.max_attempts || 1;

    // Get current attempt count
    const [attempts] = await pool.execute(
      'SELECT MAX(attempt_number) as max_attempt FROM assessment_user_mappings WHERE assessment_administrator_id = ? AND user_id = ?',
      [assessment_administrator_id, user_id]
    );
    const attemptNumber = (attempts[0].max_attempt || 0) + 1;

    if (attemptNumber > maxAttempts) {
      throw new Error(`Maximum attempts (${maxAttempts}) exceeded for this user`);
    }

    try {
      const [result] = await pool.execute(
        `INSERT INTO assessment_user_mappings 
         (unique_id, assessment_administrator_id, user_id, status, attempt_number)
         VALUES (?, ?, ?, ?, ?)`,
        [unique_id, assessment_administrator_id, user_id, status, attemptNumber]
      );
      
      return {
        id: result.insertId,
        unique_id,
        attempt_number: attemptNumber
      };
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('User already has an attempt for this assessment');
      }
      throw error;
    }
  }

  /**
   * Bulk invite users
   */
  static async bulkInvite(assessment_administrator_id, user_ids) {
    const results = {
      success: [],
      failed: []
    };

    for (const user_id of user_ids) {
      try {
        const mapping = await this.create({
          assessment_administrator_id,
          user_id,
          status: 'INVITED'
        });
        results.success.push({ user_id, mapping_id: mapping.id });
      } catch (error) {
        results.failed.push({ user_id, error: error.message });
      }
    }

    return results;
  }

  /**
   * Find mapping by ID
   */
  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT aum.*,
              u.name as user_name, u.email as user_email,
              aa.display_name as administrator_name,
              a.title as assessment_title
       FROM assessment_user_mappings aum
       JOIN users u ON aum.user_id = u.id
       JOIN assessment_administrators aa ON aum.assessment_administrator_id = aa.id
       JOIN assessments a ON aa.assessment_id = a.id
       WHERE aum.id = ?`,
      [id]
    );
    
    if (rows[0]) {
      rows[0].segment_wise_scores = this.safeJsonParse(rows[0].segment_wise_scores);
    }
    
    return rows[0] || null;
  }

  /**
   * Find mapping by unique_id
   */
  static async findByUniqueId(unique_id) {
    const [rows] = await pool.execute(
      'SELECT id FROM assessment_user_mappings WHERE unique_id = ?',
      [unique_id]
    );
    if (!rows[0]) return null;
    return this.findById(rows[0].id);
  }

  /**
   * Get mappings for an administrator with pagination
   */
  static async getByAdministratorId(assessment_administrator_id, { search, status, page = 1, pageSize = 10 }) {
    const offset = (page - 1) * pageSize;
    let query = `
      SELECT aum.*,
             u.name as user_name, u.email as user_email
      FROM assessment_user_mappings aum
      JOIN users u ON aum.user_id = u.id
      WHERE aum.assessment_administrator_id = ?
    `;
    const params = [assessment_administrator_id];

    if (search) {
      query += ' AND (u.name LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      query += ' AND aum.status = ?';
      params.push(status);
    }

    // Get total count
    const countQuery = query.replace('SELECT aum.*,\n             u.name as user_name, u.email as user_email', 'SELECT COUNT(*) as total');
    const [countRows] = await pool.execute(countQuery, params);
    const total = countRows[0].total;

    // Get paginated results
    query += ' ORDER BY aum.created_at DESC';
    query += ` LIMIT ${parseInt(pageSize)} OFFSET ${parseInt(offset)}`;
    const [rows] = await pool.execute(query, params);

    const mappings = rows.map(row => ({
      ...row,
      segment_wise_scores: this.safeJsonParse(row.segment_wise_scores)
    }));

    return {
      mappings,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      totalPages: Math.ceil(total / pageSize)
    };
  }

  /**
   * Get user's assessments
   */
  static async getByUserId(user_id, { status, page = 1, pageSize = 10 }) {
    const offset = (page - 1) * pageSize;
    let query = `
      SELECT aum.*,
             aum.id as user_mapping_id,
             aa.display_name as administrator_name,
             a.title as assessment_title, a.description as assessment_description,
             tc.total_time, tc.start_date_time, tc.end_date_time
      FROM assessment_user_mappings aum
      JOIN assessment_administrators aa ON aum.assessment_administrator_id = aa.id
      JOIN assessments a ON aa.assessment_id = a.id
      LEFT JOIN timing_configs tc ON aa.id = tc.assessment_administrator_id
      WHERE aum.user_id = ? AND aa.status = 'ACTIVE'
    `;
    const params = [user_id];

    if (status) {
      if (status === 'PENDING') {
        query += ' AND aum.status IN (\'INVITED\', \'NOT_STARTED\')';
      } else {
        query += ' AND aum.status = ?';
        params.push(status);
      }
    }

    // Get total count
    const countQuery = query.replace(/SELECT aum\.\*[\s\S]*?FROM assessment_user_mappings aum/, 'SELECT COUNT(*) as total FROM assessment_user_mappings aum');
    const [countRows] = await pool.execute(countQuery, params);
    const total = countRows[0].total;

    // Get paginated results
    query += ' ORDER BY aum.created_at DESC';
    query += ` LIMIT ${parseInt(pageSize)} OFFSET ${parseInt(offset)}`;
    const [rows] = await pool.execute(query, params);

    const mappings = rows.map(row => ({
      ...row,
      segment_wise_scores: this.safeJsonParse(row.segment_wise_scores)
    }));

    return {
      assessments: mappings,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      totalPages: Math.ceil(total / pageSize)
    };
  }

  /**
   * Start assessment
   */
  static async startAssessment(id, { ip_address, browser_info }) {
    const mapping = await this.findById(id);
    if (!mapping) throw new Error('Mapping not found');

    // Check if already started - allow starting from INVITED or NOT_STARTED
    if (mapping.status === 'IN_PROGRESS') {
      throw new Error('Assessment already in progress');
    }

    if (mapping.status === 'COMPLETED' || mapping.status === 'SUBMITTED') {
      throw new Error('Assessment already completed');
    }

    // Allow starting from INVITED, NOT_STARTED, or PAUSED
    if (!['INVITED', 'NOT_STARTED', 'PAUSED'].includes(mapping.status)) {
      throw new Error(`Cannot start assessment from ${mapping.status} status`);
    }

    // Check timing
    const [timingConfig] = await pool.execute(
      'SELECT * FROM timing_configs WHERE assessment_administrator_id = ?',
      [mapping.assessment_administrator_id]
    );

    if (timingConfig[0]) {
      const now = new Date();
      if (timingConfig[0].start_date_time && new Date(timingConfig[0].start_date_time) > now) {
        throw new Error('Assessment has not started yet');
      }
      if (timingConfig[0].end_date_time && new Date(timingConfig[0].end_date_time) < now) {
        throw new Error('Assessment has expired');
      }
    }

    await pool.execute(
      `UPDATE assessment_user_mappings SET
         status = 'IN_PROGRESS',
         assessment_started_time = NOW(),
         last_activity_at = NOW(),
         ip_address = ?,
         browser_info = ?
       WHERE id = ?`,
      [ip_address, browser_info, id]
    );

    // Assign questions to user
    await this.assignQuestionsToUser(id);

    return this.findById(id);
  }

  /**
   * Assign questions to user when test starts
   */
  static async assignQuestionsToUser(mapping_id) {
    const mapping = await this.findById(mapping_id);
    if (!mapping) throw new Error('Mapping not found');

    // Get question config
    const [questionConfig] = await pool.execute(
      'SELECT * FROM question_configs WHERE assessment_administrator_id = ?',
      [mapping.assessment_administrator_id]
    );

    const config = questionConfig[0] || {};

    // Get administrator to get assessment_id
    const [admin] = await pool.execute(
      'SELECT assessment_id FROM assessment_administrators WHERE id = ?',
      [mapping.assessment_administrator_id]
    );

    // Get segments
    const [segments] = await pool.execute(
      'SELECT * FROM assessment_segments WHERE assessment_id = ? ORDER BY sequence_order',
      [admin[0].assessment_id]
    );

    for (const segment of segments) {
      let programmingQuestions = [];
      let mcqQuestions = [];

      if (config.fetch_random_question) {
        // Fetch random questions
        const result = await this.fetchRandomQuestionsForSegment(segment.id, mapping_id);
        programmingQuestions = result.programming || [];
        mcqQuestions = result.mcq || [];
        console.log(`Segment ${segment.id} (${segment.name}): Fetched ${programmingQuestions.length} programming, ${mcqQuestions.length} MCQ questions (random)`);
      } else {
        // Get static questions from segment
        try {
          const [pq] = await pool.execute(
            `SELECT spq.*, q.points as default_weightage, pq.id as programming_question_id
             FROM segment_programming_questions spq
             JOIN programming_questions pq ON spq.programming_question_id = pq.id
             JOIN questions q ON pq.question_id = q.id
             WHERE spq.assessment_segment_id = ?
             ORDER BY spq.sequence_order`,
            [segment.id]
          );
          console.log(`Segment ${segment.id} (${segment.name}): Raw programming questions query returned ${pq.length} rows`);
          programmingQuestions = pq.map(q => ({
            question_id: q.programming_question_id,
            sequence_order: q.sequence_order || 1,
            weightage: q.weightage_override || q.default_weightage || q.positive_marks || 0,
            is_from_random_fetch: false
          }));
        } catch (error) {
          console.error(`Error fetching programming questions for segment ${segment.id}:`, error);
          programmingQuestions = [];
        }

        try {
          const [mq] = await pool.execute(
            `SELECT smq.*, q.points as default_weightage, mq.id as mcq_question_id
             FROM segment_mcq_questions smq
             JOIN mcq_multiselect_questions mq ON smq.mcq_question_id = mq.id
             JOIN questions q ON mq.question_id = q.id
             WHERE smq.assessment_segment_id = ?
             ORDER BY smq.sequence_order`,
            [segment.id]
          );
          console.log(`Segment ${segment.id} (${segment.name}): Raw MCQ questions query returned ${mq.length} rows`);
          mcqQuestions = mq.map(q => ({
            question_id: q.mcq_question_id,
            sequence_order: q.sequence_order || 1,
            weightage: q.weightage_override || q.default_weightage || q.positive_marks || 0,
            is_from_random_fetch: false
          }));
        } catch (error) {
          console.error(`Error fetching MCQ questions for segment ${segment.id}:`, error);
          mcqQuestions = [];
        }
        
        console.log(`Segment ${segment.id} (${segment.name}): Found ${programmingQuestions.length} programming, ${mcqQuestions.length} MCQ questions (static)`);
        
        // Debug: Check if questions exist in segment tables
        const [checkProg] = await pool.execute(
          'SELECT COUNT(*) as count FROM segment_programming_questions WHERE assessment_segment_id = ?',
          [segment.id]
        );
        const [checkMCQ] = await pool.execute(
          'SELECT COUNT(*) as count FROM segment_mcq_questions WHERE assessment_segment_id = ?',
          [segment.id]
        );
        console.log(`Segment ${segment.id} (${segment.name}): Database has ${checkProg[0]?.count || 0} programming and ${checkMCQ[0]?.count || 0} MCQ questions in segment tables`);
      }

      // Warn if segment has no questions
      if (programmingQuestions.length === 0 && mcqQuestions.length === 0) {
        console.warn(`WARNING: Segment ${segment.id} (${segment.name}) has no questions assigned!`);
      }

      // Randomize if needed
      if (config.randomize_question_to_users && (programmingQuestions.length > 0 || mcqQuestions.length > 0)) {
        programmingQuestions = this.shuffleArray(programmingQuestions);
        mcqQuestions = this.shuffleArray(mcqQuestions);
        
        // Re-assign sequence orders
        programmingQuestions.forEach((q, i) => q.sequence_order = i + 1);
        mcqQuestions.forEach((q, i) => q.sequence_order = programmingQuestions.length + i + 1);
      }

      // Check if questions are already assigned for this segment
      const [existingAssignments] = await pool.execute(
        'SELECT COUNT(*) as count FROM user_question_assignments WHERE assessment_user_mapping_id = ? AND assessment_segment_id = ?',
        [mapping_id, segment.id]
      );

      // Only insert if no assignments exist
      if (existingAssignments[0].count === 0) {
        // Insert question assignments
        for (const q of programmingQuestions) {
          try {
            await pool.execute(
              `INSERT IGNORE INTO user_question_assignments 
               (assessment_user_mapping_id, assessment_segment_id, question_type, question_id, sequence_order, weightage, is_from_random_fetch)
               VALUES (?, ?, 'PROGRAMMING', ?, ?, ?, ?)`,
              [mapping_id, segment.id, q.question_id, q.sequence_order, q.weightage, q.is_from_random_fetch]
            );
          } catch (error) {
            console.error(`Error inserting programming question ${q.question_id} for segment ${segment.id}:`, error);
          }
        }

        for (const q of mcqQuestions) {
          try {
            await pool.execute(
              `INSERT IGNORE INTO user_question_assignments 
               (assessment_user_mapping_id, assessment_segment_id, question_type, question_id, sequence_order, weightage, is_from_random_fetch)
               VALUES (?, ?, 'MCQ', ?, ?, ?, ?)`,
              [mapping_id, segment.id, q.question_id, q.sequence_order, q.weightage, q.is_from_random_fetch]
            );
          } catch (error) {
            console.error(`Error inserting MCQ question ${q.question_id} for segment ${segment.id}:`, error);
          }
        }
        
        // Verify assignments were created
        const [verifyAssignments] = await pool.execute(
          'SELECT COUNT(*) as count FROM user_question_assignments WHERE assessment_user_mapping_id = ? AND assessment_segment_id = ?',
          [mapping_id, segment.id]
        );
        console.log(`Segment ${segment.id} (${segment.name}): Created ${verifyAssignments[0].count} question assignments`);
      } else {
        console.log(`Segment ${segment.id} (${segment.name}): Questions already assigned (${existingAssignments[0].count} existing)`);
      }

      // Create or update segment progress
      const totalQuestions = programmingQuestions.length + mcqQuestions.length;
      await pool.execute(
        `INSERT INTO assessment_segment_progress 
         (assessment_user_mapping_id, assessment_segment_id, status, time_allocated, total_questions)
         VALUES (?, ?, 'NOT_STARTED', ?, ?)
         ON DUPLICATE KEY UPDATE 
         time_allocated = VALUES(time_allocated),
         total_questions = VALUES(total_questions)`,
        [mapping_id, segment.id, segment.segment_duration || 0, totalQuestions]
      );
    }

    // Calculate max possible score
    const [maxScore] = await pool.execute(
      'SELECT SUM(weightage) as total FROM user_question_assignments WHERE assessment_user_mapping_id = ?',
      [mapping_id]
    );

    await pool.execute(
      'UPDATE assessment_user_mappings SET max_possible_score = ? WHERE id = ?',
      [maxScore[0].total || 0, mapping_id]
    );
  }

  /**
   * Fetch random questions for a segment
   */
  static async fetchRandomQuestionsForSegment(segment_id, mapping_id) {
    const result = { programming: [], mcq: [] };

    // Get random fetch criteria
    const [criteria] = await pool.execute(
      'SELECT * FROM random_fetch_criteria WHERE assessment_segment_id = ? AND is_active = TRUE',
      [segment_id]
    );

    for (const c of criteria) {
      if (c.question_type === 'PROGRAMMING') {
        const questions = await this.fetchRandomProgrammingQuestions(c, mapping_id);
        result.programming = questions;
      } else if (c.question_type === 'MCQ') {
        const questions = await this.fetchRandomMCQQuestions(c, mapping_id);
        result.mcq = questions;
      }
    }

    return result;
  }

  /**
   * Fetch random programming questions
   */
  static async fetchRandomProgrammingQuestions(criteria, mapping_id) {
    let query = 'SELECT id, weightage FROM programming_questions WHERE 1=1';
    const params = [];

    if (criteria.question_bank_id) {
      query += ' AND question_bank_id = ?';
      params.push(criteria.question_bank_id);
    }

    if (criteria.topics) {
      const topicIds = criteria.topics.split(',').map(t => t.trim());
      query += ` AND topic_id IN (${topicIds.map(() => '?').join(',')})`;
      params.push(...topicIds);
    }

    if (criteria.exclude_question_ids) {
      const excludeIds = criteria.exclude_question_ids.split(',').map(t => t.trim());
      query += ` AND id NOT IN (${excludeIds.map(() => '?').join(',')})`;
      params.push(...excludeIds);
    }

    const questions = [];
    
    // Fetch by difficulty
    for (const [difficulty, count] of [['easy', criteria.easy_count], ['medium', criteria.medium_count], ['hard', criteria.hard_count]]) {
      if (count > 0) {
        const diffQuery = query + ` AND difficulty = ? ORDER BY RAND() LIMIT ${count}`;
        const [rows] = await pool.execute(diffQuery, [...params, difficulty]);
        questions.push(...rows.map((q, i) => ({
          question_id: q.id,
          sequence_order: questions.length + i + 1,
          weightage: q.weightage,
          is_from_random_fetch: true
        })));
      }
    }

    return questions;
  }

  /**
   * Fetch random MCQ questions
   */
  static async fetchRandomMCQQuestions(criteria, mapping_id) {
    let query = 'SELECT id, weightage FROM mcq_multiselect_questions WHERE 1=1';
    const params = [];

    if (criteria.question_bank_id) {
      query += ' AND question_bank_id = ?';
      params.push(criteria.question_bank_id);
    }

    if (criteria.topics) {
      const topicIds = criteria.topics.split(',').map(t => t.trim());
      query += ` AND topic_id IN (${topicIds.map(() => '?').join(',')})`;
      params.push(...topicIds);
    }

    if (criteria.exclude_question_ids) {
      const excludeIds = criteria.exclude_question_ids.split(',').map(t => t.trim());
      query += ` AND id NOT IN (${excludeIds.map(() => '?').join(',')})`;
      params.push(...excludeIds);
    }

    const questions = [];
    
    // Fetch by difficulty
    for (const [difficulty, count] of [['easy', criteria.easy_count], ['medium', criteria.medium_count], ['hard', criteria.hard_count]]) {
      if (count > 0) {
        const diffQuery = query + ` AND difficulty = ? ORDER BY RAND() LIMIT ${count}`;
        const [rows] = await pool.execute(diffQuery, [...params, difficulty]);
        questions.push(...rows.map((q, i) => ({
          question_id: q.id,
          sequence_order: questions.length + i + 1,
          weightage: q.weightage,
          is_from_random_fetch: true
        })));
      }
    }

    return questions;
  }

  /**
   * Shuffle array (Fisher-Yates)
   */
  static shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Update progress/activity
   */
  static async updateActivity(id, data = {}) {
    const updates = ['last_activity_at = NOW()'];
    const params = [];

    if (data.current_segment_index !== undefined) {
      updates.push('current_segment_index = ?');
      params.push(data.current_segment_index);
    }

    if (data.total_time_worked !== undefined) {
      updates.push('total_time_worked = ?');
      params.push(data.total_time_worked);
    }

    if (data.tab_switch_count !== undefined) {
      updates.push('tab_switch_count = ?');
      params.push(data.tab_switch_count);
    }

    params.push(id);

    await pool.execute(
      `UPDATE assessment_user_mappings SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
  }

  /**
   * Submit assessment
   */
  static async submitAssessment(id) {
    const mapping = await this.findById(id);
    if (!mapping) throw new Error('Mapping not found');

    if (mapping.status === 'COMPLETED') {
      throw new Error('Assessment already submitted');
    }

    // Calculate scores
    const scores = await this.calculateScores(id);

    // Get threshold
    const [scoringConfig] = await pool.execute(
      'SELECT * FROM scoring_configs WHERE assessment_administrator_id = ?',
      [mapping.assessment_administrator_id]
    );

    const threshold = scoringConfig[0]?.threshold_for_pass || 40;
    const thresholdType = scoringConfig[0]?.threshold_type || 'PERCENTAGE';
    
    let passed = false;
    if (thresholdType === 'PERCENTAGE') {
      passed = scores.percentage_score >= threshold;
    } else {
      passed = scores.total_score >= threshold;
    }

    await pool.execute(
      `UPDATE assessment_user_mappings SET
         status = 'COMPLETED',
         assessment_ended_time = NOW(),
         submitted_at = NOW(),
         total_score = ?,
         percentage_score = ?,
         passed = ?,
         segment_wise_scores = ?
       WHERE id = ?`,
      [scores.total_score, scores.percentage_score, passed, JSON.stringify(scores.segment_scores), id]
    );

    return this.findById(id);
  }

  /**
   * Calculate scores for a mapping
   */
  static async calculateScores(mapping_id) {
    const mapping = await this.findById(mapping_id);
    if (!mapping) throw new Error('Mapping not found');

    // Get scoring config for negative marking
    const [scoringConfig] = await pool.execute(
      'SELECT * FROM scoring_configs WHERE assessment_administrator_id = ?',
      [mapping.assessment_administrator_id]
    );
    const negativeMarkingEnabled = scoringConfig[0]?.negative_marking_enabled || false;
    const negativeMarkPercentage = scoringConfig[0]?.negative_mark_percentage || 0;

    // Get segment progress
    const [segments] = await pool.execute(
      `SELECT asp.*, aseg.name as segment_name
       FROM assessment_segment_progress asp
       JOIN assessment_segments aseg ON asp.assessment_segment_id = aseg.id
       WHERE asp.assessment_user_mapping_id = ?`,
      [mapping_id]
    );

    let totalScore = 0;
    const segmentScores = {};

    for (const segment of segments) {
      // Get programming submissions for this segment
      const [progSubmissions] = await pool.execute(
        `SELECT ps.*, uqa.weightage
         FROM programming_submissions ps
         JOIN user_question_assignments uqa ON ps.question_id = uqa.question_id 
           AND uqa.assessment_user_mapping_id = ? 
           AND uqa.assessment_segment_id = ?
           AND uqa.question_type = 'PROGRAMMING'
         WHERE ps.assessment_user_mapping_id = ? AND ps.assessment_segment_id = ?`,
        [mapping_id, segment.assessment_segment_id, mapping_id, segment.assessment_segment_id]
      );

      // Get MCQ submissions for this segment
      const [mcqSubmissions] = await pool.execute(
        `SELECT ms.*, uqa.weightage
         FROM mcq_submissions ms
         JOIN user_question_assignments uqa ON ms.question_id = uqa.question_id 
           AND uqa.assessment_user_mapping_id = ? 
           AND uqa.assessment_segment_id = ?
           AND uqa.question_type = 'MCQ'
         WHERE ms.assessment_user_mapping_id = ? AND ms.assessment_segment_id = ?`,
        [mapping_id, segment.assessment_segment_id, mapping_id, segment.assessment_segment_id]
      );

      let segmentScore = 0;

      // Calculate programming scores (based on test cases)
      for (const sub of progSubmissions) {
        if (sub.is_correct) {
          segmentScore += sub.weightage;
        } else if (negativeMarkingEnabled && sub.attempted) {
          segmentScore -= (sub.weightage * negativeMarkPercentage / 100);
        }
      }

      // Calculate MCQ scores
      for (const sub of mcqSubmissions) {
        if (sub.is_correct) {
          segmentScore += sub.weightage;
        } else if (negativeMarkingEnabled && sub.selected_options) {
          segmentScore -= (sub.weightage * negativeMarkPercentage / 100);
        }
      }

      // Ensure score doesn't go negative
      segmentScore = Math.max(0, segmentScore);

      // Update segment progress
      await pool.execute(
        'UPDATE assessment_segment_progress SET score = ? WHERE id = ?',
        [segmentScore, segment.id]
      );

      totalScore += segmentScore;

      // Get segment total possible score
      const [segmentMaxScore] = await pool.execute(
        'SELECT SUM(weightage) as total FROM user_question_assignments WHERE assessment_user_mapping_id = ? AND assessment_segment_id = ?',
        [mapping_id, segment.assessment_segment_id]
      );

      segmentScores[`segment_${segment.assessment_segment_id}`] = {
        segmentId: segment.assessment_segment_id,
        name: segment.segment_name,
        obtained: segmentScore,
        total: segmentMaxScore[0].total || 0,
        percentage: segmentMaxScore[0].total ? (segmentScore / segmentMaxScore[0].total * 100).toFixed(2) : 0,
        timeUsed: segment.time_used
      };
    }

    const percentageScore = mapping.max_possible_score > 0 
      ? (totalScore / mapping.max_possible_score * 100).toFixed(2)
      : 0;

    return {
      total_score: totalScore,
      max_possible_score: mapping.max_possible_score,
      percentage_score: parseFloat(percentageScore),
      segment_scores: segmentScores
    };
  }

  /**
   * Update status
   */
  static async updateStatus(id, status) {
    await pool.execute(
      'UPDATE assessment_user_mappings SET status = ? WHERE id = ?',
      [status, id]
    );
    return true;
  }

  /**
   * Mark mail sent
   */
  static async markMailSent(id) {
    await pool.execute(
      'UPDATE assessment_user_mappings SET mail_sent_at = NOW() WHERE id = ?',
      [id]
    );
    return true;
  }

  /**
   * Submit feedback
   */
  static async submitFeedback(id, { rating, comment }) {
    await pool.execute(
      'UPDATE assessment_user_mappings SET feedback_rating = ?, feedback_comment = ? WHERE id = ?',
      [rating, comment, id]
    );
    return true;
  }

  /**
   * Delete mapping
   */
  static async delete(id) {
    await pool.execute('DELETE FROM assessment_user_mappings WHERE id = ?', [id]);
    return true;
  }

  /**
   * Increment tab switch count
   */
  static async incrementTabSwitch(id) {
    await pool.execute(
      'UPDATE assessment_user_mappings SET tab_switch_count = tab_switch_count + 1, last_activity_at = NOW() WHERE id = ?',
      [id]
    );

    // Check if should disqualify
    const mapping = await this.findById(id);
    const [proctoringConfig] = await pool.execute(
      'SELECT max_tab_switch_allowed FROM proctoring_configs WHERE assessment_administrator_id = ?',
      [mapping.assessment_administrator_id]
    );

    const maxAllowed = proctoringConfig[0]?.max_tab_switch_allowed ?? -1;
    if (maxAllowed !== -1 && mapping.tab_switch_count >= maxAllowed) {
      await this.updateStatus(id, 'DISQUALIFIED');
      return { disqualified: true, count: mapping.tab_switch_count + 1 };
    }

    return { disqualified: false, count: mapping.tab_switch_count + 1 };
  }

  /**
   * Resume assessment
   */
  static async resumeAssessment(id) {
    const mapping = await this.findById(id);
    if (!mapping) throw new Error('Mapping not found');

    if (mapping.status !== 'IN_PROGRESS') {
      throw new Error('Cannot resume - assessment is not in progress');
    }

    // Check resume window
    const [accessConfig] = await pool.execute(
      'SELECT * FROM access_configs WHERE assessment_administrator_id = ?',
      [mapping.assessment_administrator_id]
    );

    if (!accessConfig[0]?.allow_resume) {
      throw new Error('Resume is not allowed for this assessment');
    }

    const resumeWindow = accessConfig[0]?.resume_window_minutes || 30;
    const lastActivity = new Date(mapping.last_activity_at);
    const now = new Date();
    const minutesSinceLastActivity = (now - lastActivity) / (1000 * 60);

    if (minutesSinceLastActivity > resumeWindow) {
      await this.updateStatus(id, 'ABANDONED');
      throw new Error('Resume window has expired');
    }

    await pool.execute(
      'UPDATE assessment_user_mappings SET resume_count = resume_count + 1, last_activity_at = NOW() WHERE id = ?',
      [id]
    );

    return this.findById(id);
  }
}

module.exports = AssessmentUserMapping;

