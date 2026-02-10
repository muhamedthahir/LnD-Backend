const pool = require('../config/db');


/**
 * TimingConfig Model
 */
class TimingConfig {
  static async createTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS timing_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        assessment_administrator_id INT NOT NULL,
        total_time INT NOT NULL DEFAULT 0,
        timing_mode ENUM('SEGMENT_WISE', 'OVERALL', 'BOTH') DEFAULT 'SEGMENT_WISE',
        start_date_time DATETIME DEFAULT NULL,
        end_date_time DATETIME DEFAULT NULL,
        allow_early_segment_submit BOOLEAN DEFAULT TRUE,
        carry_forward_time BOOLEAN DEFAULT FALSE,
        auto_submit_on_timeout BOOLEAN DEFAULT TRUE,
        grace_period_seconds INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_admin (assessment_administrator_id),
        FOREIGN KEY (assessment_administrator_id) REFERENCES assessment_administrators(id) ON DELETE CASCADE
      )
    `;
    await pool.execute(sql);
  }

  static async findByAdminId(assessment_administrator_id) {
    const [rows] = await pool.execute(
      'SELECT * FROM timing_configs WHERE assessment_administrator_id = ?',
      [assessment_administrator_id]
    );
    return rows[0] || null;
  }

  static async update(assessment_administrator_id, data) {
    await pool.execute(
      `UPDATE timing_configs SET
         total_time = COALESCE(?, total_time),
         timing_mode = COALESCE(?, timing_mode),
         start_date_time = ?,
         end_date_time = ?,
         allow_early_segment_submit = COALESCE(?, allow_early_segment_submit),
         carry_forward_time = COALESCE(?, carry_forward_time),
         auto_submit_on_timeout = COALESCE(?, auto_submit_on_timeout),
         grace_period_seconds = COALESCE(?, grace_period_seconds)
       WHERE assessment_administrator_id = ?`,
      [data.total_time, data.timing_mode, data.start_date_time, data.end_date_time,
       data.allow_early_segment_submit, data.carry_forward_time, data.auto_submit_on_timeout,
       data.grace_period_seconds, assessment_administrator_id]
    );
    return true;
  }
}

/**
 * ProctoringConfig Model
 */
class ProctoringConfig {
  static async createTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS proctoring_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        assessment_administrator_id INT NOT NULL,
        proctoring_enabled BOOLEAN DEFAULT FALSE,
        full_screen_mandatory BOOLEAN DEFAULT FALSE,
        webcam_required BOOLEAN DEFAULT FALSE,
        max_tab_switch_allowed INT DEFAULT -1,
        disable_copy_paste BOOLEAN DEFAULT FALSE,
        disable_right_click BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_admin (assessment_administrator_id),
        FOREIGN KEY (assessment_administrator_id) REFERENCES assessment_administrators(id) ON DELETE CASCADE
      )
    `;
    await pool.execute(sql);
  }

  static async findByAdminId(assessment_administrator_id) {
    const [rows] = await pool.execute(
      'SELECT * FROM proctoring_configs WHERE assessment_administrator_id = ?',
      [assessment_administrator_id]
    );
    return rows[0] || null;
  }

  static async update(assessment_administrator_id, data) {
    await pool.execute(
      `UPDATE proctoring_configs SET
         proctoring_enabled = COALESCE(?, proctoring_enabled),
         full_screen_mandatory = COALESCE(?, full_screen_mandatory),
         webcam_required = COALESCE(?, webcam_required),
         max_tab_switch_allowed = COALESCE(?, max_tab_switch_allowed),
         disable_copy_paste = COALESCE(?, disable_copy_paste),
         disable_right_click = COALESCE(?, disable_right_click)
       WHERE assessment_administrator_id = ?`,
      [data.proctoring_enabled, data.full_screen_mandatory, data.webcam_required,
       data.max_tab_switch_allowed, data.disable_copy_paste, data.disable_right_click,
       assessment_administrator_id]
    );
    return true;
  }
}

/**
 * ScoringConfig Model
 */
class ScoringConfig {
  static async createTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS scoring_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        assessment_administrator_id INT NOT NULL,
        threshold_for_pass INT DEFAULT 40,
        threshold_type ENUM('PERCENTAGE', 'ABSOLUTE_SCORE') DEFAULT 'PERCENTAGE',
        negative_marking_enabled BOOLEAN DEFAULT FALSE,
        negative_mark_percentage DECIMAL(5,2) DEFAULT 0.00,
        show_score_at_end BOOLEAN DEFAULT FALSE,
        show_correct_answers_after BOOLEAN DEFAULT FALSE,
        show_feedback_or_rating BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_admin (assessment_administrator_id),
        FOREIGN KEY (assessment_administrator_id) REFERENCES assessment_administrators(id) ON DELETE CASCADE
      )
    `;
    await pool.execute(sql);
  }

  static async findByAdminId(assessment_administrator_id) {
    const [rows] = await pool.execute(
      'SELECT * FROM scoring_configs WHERE assessment_administrator_id = ?',
      [assessment_administrator_id]
    );
    return rows[0] || null;
  }

  static async update(assessment_administrator_id, data) {
    await pool.execute(
      `UPDATE scoring_configs SET
         threshold_for_pass = COALESCE(?, threshold_for_pass),
         threshold_type = COALESCE(?, threshold_type),
         negative_marking_enabled = COALESCE(?, negative_marking_enabled),
         negative_mark_percentage = COALESCE(?, negative_mark_percentage),
         show_score_at_end = COALESCE(?, show_score_at_end),
         show_correct_answers_after = COALESCE(?, show_correct_answers_after),
         show_feedback_or_rating = COALESCE(?, show_feedback_or_rating)
       WHERE assessment_administrator_id = ?`,
      [data.threshold_for_pass, data.threshold_type, data.negative_marking_enabled,
       data.negative_mark_percentage, data.show_score_at_end, data.show_correct_answers_after,
       data.show_feedback_or_rating, assessment_administrator_id]
    );
    return true;
  }
}

/**
 * QuestionConfig Model
 */
class QuestionConfig {
  static async createTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS question_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        assessment_administrator_id INT NOT NULL,
        fetch_random_question BOOLEAN DEFAULT FALSE,
        randomize_question_to_users BOOLEAN DEFAULT FALSE,
        shuffle_options_in_mcq BOOLEAN DEFAULT FALSE,
        allow_review_before_submit BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_admin (assessment_administrator_id),
        FOREIGN KEY (assessment_administrator_id) REFERENCES assessment_administrators(id) ON DELETE CASCADE
      )
    `;
    await pool.execute(sql);
  }

  static async findByAdminId(assessment_administrator_id) {
    const [rows] = await pool.execute(
      'SELECT * FROM question_configs WHERE assessment_administrator_id = ?',
      [assessment_administrator_id]
    );
    return rows[0] || null;
  }

  static async update(assessment_administrator_id, data) {
    await pool.execute(
      `UPDATE question_configs SET
         fetch_random_question = COALESCE(?, fetch_random_question),
         randomize_question_to_users = COALESCE(?, randomize_question_to_users),
         shuffle_options_in_mcq = COALESCE(?, shuffle_options_in_mcq),
         allow_review_before_submit = COALESCE(?, allow_review_before_submit)
       WHERE assessment_administrator_id = ?`,
      [data.fetch_random_question, data.randomize_question_to_users,
       data.shuffle_options_in_mcq, data.allow_review_before_submit,
       assessment_administrator_id]
    );
    return true;
  }
}

/**
 * AccessConfig Model
 */
class AccessConfig {
  static async createTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS access_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        assessment_administrator_id INT NOT NULL,
        access_code VARCHAR(100) DEFAULT NULL,
        max_attempts INT DEFAULT 1,
        allow_resume BOOLEAN DEFAULT TRUE,
        resume_window_minutes INT DEFAULT 30,
        ip_restriction VARCHAR(500) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_admin (assessment_administrator_id),
        FOREIGN KEY (assessment_administrator_id) REFERENCES assessment_administrators(id) ON DELETE CASCADE
      )
    `;
    await pool.execute(sql);
  }

  static async findByAdminId(assessment_administrator_id) {
    const [rows] = await pool.execute(
      'SELECT * FROM access_configs WHERE assessment_administrator_id = ?',
      [assessment_administrator_id]
    );
    return rows[0] || null;
  }

  static async update(assessment_administrator_id, data) {
    await pool.execute(
      `UPDATE access_configs SET
         access_code = ?,
         max_attempts = COALESCE(?, max_attempts),
         allow_resume = COALESCE(?, allow_resume),
         resume_window_minutes = COALESCE(?, resume_window_minutes),
         ip_restriction = ?
       WHERE assessment_administrator_id = ?`,
      [data.access_code, data.max_attempts, data.allow_resume,
       data.resume_window_minutes, data.ip_restriction,
       assessment_administrator_id]
    );
    return true;
  }
}

/**
 * RandomFetchCriteria Model
 */
class RandomFetchCriteria {
  static async createTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS random_fetch_criteria (
        id INT AUTO_INCREMENT PRIMARY KEY,
        assessment_segment_id INT NOT NULL,
        question_type ENUM('PROGRAMMING', 'MCQ') NOT NULL,
        question_bank_id INT DEFAULT NULL,
        total_questions INT NOT NULL DEFAULT 5,
        easy_count INT DEFAULT 0,
        medium_count INT DEFAULT 0,
        hard_count INT DEFAULT 0,
        topics VARCHAR(500) DEFAULT NULL,
        tags VARCHAR(500) DEFAULT NULL,
        exclude_question_ids TEXT DEFAULT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_segment (assessment_segment_id),
        FOREIGN KEY (assessment_segment_id) REFERENCES assessment_segments(id) ON DELETE CASCADE
      )
    `;
    await pool.execute(sql);
  }

  static async create(data) {
    const [result] = await pool.execute(
      `INSERT INTO random_fetch_criteria 
       (assessment_segment_id, question_type, question_bank_id, total_questions,
        easy_count, medium_count, hard_count, topics, tags, exclude_question_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.assessment_segment_id, data.question_type, data.question_bank_id,
       data.total_questions || 5, data.easy_count || 0, data.medium_count || 0,
       data.hard_count || 0, data.topics, data.tags, data.exclude_question_ids]
    );
    return result.insertId;
  }

  static async findBySegmentId(assessment_segment_id) {
    const [rows] = await pool.execute(
      'SELECT * FROM random_fetch_criteria WHERE assessment_segment_id = ? AND is_active = TRUE',
      [assessment_segment_id]
    );
    return rows;
  }

  static async update(id, data) {
    await pool.execute(
      `UPDATE random_fetch_criteria SET
         question_type = COALESCE(?, question_type),
         question_bank_id = ?,
         total_questions = COALESCE(?, total_questions),
         easy_count = COALESCE(?, easy_count),
         medium_count = COALESCE(?, medium_count),
         hard_count = COALESCE(?, hard_count),
         topics = ?,
         tags = ?,
         exclude_question_ids = ?,
         is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [data.question_type, data.question_bank_id, data.total_questions,
       data.easy_count, data.medium_count, data.hard_count,
       data.topics, data.tags, data.exclude_question_ids, data.is_active, id]
    );
    return true;
  }

  static async delete(id) {
    await pool.execute('DELETE FROM random_fetch_criteria WHERE id = ?', [id]);
    return true;
  }
}

/**
 * SegmentProgrammingQuestion Model
 */
class SegmentProgrammingQuestion {
  static async createTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS segment_programming_questions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        assessment_segment_id INT NOT NULL,
        programming_question_id INT NOT NULL,
        sequence_order INT NOT NULL DEFAULT 1,
        weightage_override INT DEFAULT NULL,
        is_mandatory BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_segment_question (assessment_segment_id, programming_question_id),
        INDEX idx_segment (assessment_segment_id),
        INDEX idx_question (programming_question_id),
        FOREIGN KEY (assessment_segment_id) REFERENCES assessment_segments(id) ON DELETE CASCADE,
        FOREIGN KEY (programming_question_id) REFERENCES programming_questions(id) ON DELETE CASCADE
      )
    `;
    await pool.execute(sql);
  }

  static async add(data) {
    const [maxOrder] = await pool.execute(
      'SELECT COALESCE(MAX(sequence_order), 0) + 1 as next_order FROM segment_programming_questions WHERE assessment_segment_id = ?',
      [data.assessment_segment_id]
    );
    const [ programming_question_id ] = await pool.execute(
      `SELECT id from programming_questions where question_id = ${data.question_id}`
    )
    console.log( programming_question_id, data);
    
    // Convert undefined to null for SQL compatibility
    const safeSequenceOrder = data.sequence_order !== undefined ? data.sequence_order : maxOrder[0].next_order
    const safeWeightageOverride = data.weightage_override !== undefined ? data.weightage_override : null
    const safeIsMandatory = data.is_mandatory !== undefined ? data.is_mandatory : true
    
    const [result] = await pool.execute(
      `INSERT INTO segment_programming_questions 
       (assessment_segment_id, programming_question_id, sequence_order, weightage_override, is_mandatory)
       VALUES (?, ?, ?, ?, ?)`,
      [data.assessment_segment_id, programming_question_id[0].id, 
       safeSequenceOrder, safeWeightageOverride, safeIsMandatory]
    );

    // Update segment total marks
    const AssessmentSegment = require('./AssessmentSegment');
    await AssessmentSegment.updateTotalMarks(data.assessment_segment_id);

    return result.insertId;
  }

  static async remove(assessment_segment_id, programming_question_id) {
    await pool.execute(
      'DELETE FROM segment_programming_questions WHERE assessment_segment_id = ? AND programming_question_id = ?',
      [assessment_segment_id, programming_question_id]
    );

    // Update segment total marks
    const AssessmentSegment = require('./AssessmentSegment');
    await AssessmentSegment.updateTotalMarks(assessment_segment_id);

    return true;
  }

  static async getBySegmentId(assessment_segment_id) {
    const [rows] = await pool.execute(
      `SELECT spq.*, q.name as title, q.description, l.name as difficulty, q.points as default_weightage
       FROM segment_programming_questions spq
       JOIN programming_questions pq ON spq.programming_question_id = pq.id
       JOIN questions q ON pq.question_id = q.id
       LEFT JOIN levels l ON q.level_id = l.id
       WHERE spq.assessment_segment_id = ?
       ORDER BY spq.sequence_order ASC`,
      [assessment_segment_id]
    );
    return rows;
  }

  static async updateOrder(id, sequence_order) {
    await pool.execute(
      'UPDATE segment_programming_questions SET sequence_order = ? WHERE id = ?',
      [sequence_order, id]
    );
    return true;
  }

  static async update(assessment_segment_id, programming_question_id, data) {
    const updates = [];
    const params = [];

    if (data.weightage_override !== undefined) {
      updates.push('weightage_override = ?');
      params.push(data.weightage_override !== null ? data.weightage_override : null);
    }
    if (data.positive_marks !== undefined) {
      updates.push('positive_marks = ?');
      params.push(data.positive_marks !== null && data.positive_marks !== '' ? parseFloat(data.positive_marks) : null);
    }
    if (data.negative_marks !== undefined) {
      updates.push('negative_marks = ?');
      params.push(data.negative_marks !== null && data.negative_marks !== '' ? parseFloat(data.negative_marks) : null);
    }
    if (data.neutral_marks !== undefined) {
      updates.push('neutral_marks = ?');
      params.push(data.neutral_marks !== null && data.neutral_marks !== '' ? parseFloat(data.neutral_marks) : null);
    }
    if (data.is_mandatory !== undefined) {
      updates.push('is_mandatory = ?');
      params.push(data.is_mandatory);
    }

    if (updates.length === 0) {
      return true; // No updates to make
    }

    params.push(assessment_segment_id, programming_question_id);

    await pool.execute(
      `UPDATE segment_programming_questions 
       SET ${updates.join(', ')} 
       WHERE assessment_segment_id = ? AND programming_question_id = ?`,
      params
    );

    // Update segment total marks if weightage changed
    if (data.weightage_override !== undefined) {
      const AssessmentSegment = require('./AssessmentSegment');
      await AssessmentSegment.updateTotalMarks(assessment_segment_id);
    }

    return true;
  }
}

/**
 * SegmentMCQQuestion Model
 */
class SegmentMCQQuestion {
  static async createTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS segment_mcq_questions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        assessment_segment_id INT NOT NULL,
        mcq_question_id INT NOT NULL,
        sequence_order INT NOT NULL DEFAULT 1,
        weightage_override INT DEFAULT NULL,
        is_mandatory BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_segment_mcq (assessment_segment_id, mcq_question_id),
        INDEX idx_segment (assessment_segment_id),
        INDEX idx_mcq (mcq_question_id),
        FOREIGN KEY (assessment_segment_id) REFERENCES assessment_segments(id) ON DELETE CASCADE,
        FOREIGN KEY (mcq_question_id) REFERENCES mcq_multiselect_questions(id) ON DELETE CASCADE
      )
    `;
    await pool.execute(sql);
  }

  static async add(data) {
    const [maxOrder] = await pool.execute(
      'SELECT COALESCE(MAX(sequence_order), 0) + 1 as next_order FROM segment_mcq_questions WHERE assessment_segment_id = ?',
      [data.assessment_segment_id]
    );
    const [ mcq_question_id ] = await pool.execute(
      `SELECT id from mcq_multiselect_questions where question_id = ${data.question_id}`
    )
    console.log( mcq_question_id, data);
    
    // Convert undefined to null for SQL compatibility
    const safeSequenceOrder = data.sequence_order !== undefined ? data.sequence_order : maxOrder[0].next_order
    const safeWeightageOverride = data.weightage_override !== undefined ? data.weightage_override : null
    const safeIsMandatory = data.is_mandatory !== undefined ? data.is_mandatory : true
    const [result] = await pool.execute(
      `INSERT INTO segment_mcq_questions 
       (assessment_segment_id, mcq_question_id, sequence_order, weightage_override, is_mandatory)
       VALUES (?, ?, ?, ?, ?)`,
      [data.assessment_segment_id, mcq_question_id[0].id, 
       safeSequenceOrder, safeWeightageOverride, safeIsMandatory]
    );

    // Update segment total marks
    const AssessmentSegment = require('./AssessmentSegment');
    await AssessmentSegment.updateTotalMarks(data.assessment_segment_id);

    return result.insertId;
  }

  static async remove(assessment_segment_id, mcq_question_id) {
    await pool.execute(
      'DELETE FROM segment_mcq_questions WHERE assessment_segment_id = ? AND mcq_question_id = ?',
      [assessment_segment_id, mcq_question_id]
    );

    // Update segment total marks
    const AssessmentSegment = require('./AssessmentSegment');
    await AssessmentSegment.updateTotalMarks(assessment_segment_id);

    return true;
  }

  static async getBySegmentId(assessment_segment_id) {
    const [rows] = await pool.execute(
      `SELECT smq.*, q.name as question_text, l.name as difficulty, q.points as default_weightage
       FROM segment_mcq_questions smq
       JOIN mcq_multiselect_questions mq ON smq.mcq_question_id = mq.id
       JOIN questions q ON mq.question_id = q.id
       LEFT JOIN levels l ON q.level_id = l.id
       WHERE smq.assessment_segment_id = ?
       ORDER BY smq.sequence_order ASC`,
      [assessment_segment_id]
    );
    return rows;
  }

  static async updateOrder(id, sequence_order) {
    await pool.execute(
      'UPDATE segment_mcq_questions SET sequence_order = ? WHERE id = ?',
      [sequence_order, id]
    );
    return true;
  }

  static async update(assessment_segment_id, mcq_question_id, data) {
    const updates = [];
    const params = [];

    if (data.weightage_override !== undefined) {
      updates.push('weightage_override = ?');
      params.push(data.weightage_override !== null ? data.weightage_override : null);
    }
    if (data.positive_marks !== undefined) {
      updates.push('positive_marks = ?');
      params.push(data.positive_marks !== null && data.positive_marks !== '' ? parseFloat(data.positive_marks) : null);
    }
    if (data.negative_marks !== undefined) {
      updates.push('negative_marks = ?');
      params.push(data.negative_marks !== null && data.negative_marks !== '' ? parseFloat(data.negative_marks) : null);
    }
    if (data.neutral_marks !== undefined) {
      updates.push('neutral_marks = ?');
      params.push(data.neutral_marks !== null && data.neutral_marks !== '' ? parseFloat(data.neutral_marks) : null);
    }
    if (data.is_mandatory !== undefined) {
      updates.push('is_mandatory = ?');
      params.push(data.is_mandatory);
    }

    if (updates.length === 0) {
      return true; // No updates to make
    }

    params.push(assessment_segment_id, mcq_question_id);

    await pool.execute(
      `UPDATE segment_mcq_questions 
       SET ${updates.join(', ')} 
       WHERE assessment_segment_id = ? AND mcq_question_id = ?`,
      params
    );

    // Update segment total marks if weightage changed
    if (data.weightage_override !== undefined) {
      const AssessmentSegment = require('./AssessmentSegment');
      await AssessmentSegment.updateTotalMarks(assessment_segment_id);
    }

    return true;
  }
}

/**
 * AssessmentSegmentProgress Model
 */
class AssessmentSegmentProgress {
  static async createTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS assessment_segment_progress (
        id INT AUTO_INCREMENT PRIMARY KEY,
        assessment_user_mapping_id INT NOT NULL,
        assessment_segment_id INT NOT NULL,
        status ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED') DEFAULT 'NOT_STARTED',
        started_at DATETIME DEFAULT NULL,
        completed_at DATETIME DEFAULT NULL,
        time_allocated INT NOT NULL DEFAULT 0,
        time_used INT DEFAULT 0,
        time_remaining INT DEFAULT 0,
        score DECIMAL(10,2) DEFAULT 0,
        total_questions INT DEFAULT 0,
        attempted_questions INT DEFAULT 0,
        current_question_index INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_progress (assessment_user_mapping_id, assessment_segment_id),
        INDEX idx_user_mapping (assessment_user_mapping_id),
        FOREIGN KEY (assessment_user_mapping_id) REFERENCES assessment_user_mappings(id) ON DELETE CASCADE,
        FOREIGN KEY (assessment_segment_id) REFERENCES assessment_segments(id) ON DELETE CASCADE
      )
    `;
    await pool.execute(sql);
  }

  static async findByMappingAndSegment(assessment_user_mapping_id, assessment_segment_id) {
    const [rows] = await pool.execute(
      'SELECT * FROM assessment_segment_progress WHERE assessment_user_mapping_id = ? AND assessment_segment_id = ?',
      [assessment_user_mapping_id, assessment_segment_id]
    );
    return rows[0] || null;
  }

  static async getByMappingId(assessment_user_mapping_id) {
    const [rows] = await pool.execute(
      `SELECT asp.*, aseg.name as segment_name, aseg.sequence_order
       FROM assessment_segment_progress asp
       JOIN assessment_segments aseg ON asp.assessment_segment_id = aseg.id
       WHERE asp.assessment_user_mapping_id = ?
       ORDER BY aseg.sequence_order ASC`,
      [assessment_user_mapping_id]
    );
    return rows;
  }

  static async startSegment(assessment_user_mapping_id, assessment_segment_id) {
    await pool.execute(
      `UPDATE assessment_segment_progress 
       SET status = 'IN_PROGRESS', started_at = NOW()
       WHERE assessment_user_mapping_id = ? AND assessment_segment_id = ?`,
      [assessment_user_mapping_id, assessment_segment_id]
    );
    return true;
  }

  static async completeSegment(assessment_user_mapping_id, assessment_segment_id, time_used) {
    await pool.execute(
      `UPDATE assessment_segment_progress 
       SET status = 'COMPLETED', completed_at = NOW(), time_used = ?
       WHERE assessment_user_mapping_id = ? AND assessment_segment_id = ?`,
      [time_used, assessment_user_mapping_id, assessment_segment_id]
    );
    return true;
  }

  static async updateProgress(id, data) {
    const updates = [];
    const params = [];

    if (data.time_used !== undefined) {
      updates.push('time_used = ?');
      params.push(data.time_used);
    }
    if (data.time_remaining !== undefined) {
      updates.push('time_remaining = ?');
      params.push(data.time_remaining);
    }
    if (data.attempted_questions !== undefined) {
      updates.push('attempted_questions = ?');
      params.push(data.attempted_questions);
    }
    if (data.current_question_index !== undefined) {
      updates.push('current_question_index = ?');
      params.push(data.current_question_index);
    }
    if (data.score !== undefined) {
      updates.push('score = ?');
      params.push(data.score);
    }

    if (updates.length > 0) {
      params.push(id);
      await pool.execute(
        `UPDATE assessment_segment_progress SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }
    return true;
  }

  /**
   * Update progress by mapping_id and segment_id
   */
  static async updateProgressByMappingAndSegment(assessment_user_mapping_id, assessment_segment_id, data) {
    const updates = ['last_updated_at = NOW()'];
    const params = [];

    if (data.time_used !== undefined && data.time_used !== null) {
      updates.push('time_used = ?');
      params.push(data.time_used);
    }
    if (data.time_remaining !== undefined && data.time_remaining !== null) {
      updates.push('time_remaining = ?');
      params.push(data.time_remaining);
    }
    if (data.attempted_questions !== undefined) {
      updates.push('attempted_questions = ?');
      params.push(data.attempted_questions);
    }
    if (data.current_question_index !== undefined && data.current_question_index !== null) {
      updates.push('current_question_index = ?');
      params.push(data.current_question_index);
    }
    if (data.score !== undefined) {
      updates.push('score = ?');
      params.push(data.score);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }

    params.push(assessment_user_mapping_id, assessment_segment_id);
    
    await pool.execute(
      `UPDATE assessment_segment_progress SET ${updates.join(', ')} 
       WHERE assessment_user_mapping_id = ? AND assessment_segment_id = ?`,
      params
    );
    return true;
  }

  /**
   * Mark a segment as completed
   */
  static async markSegmentCompleted(assessment_user_mapping_id, segment_index) {
    // Get the segment ID for this index
    const [mappingRows] = await pool.execute(
      `SELECT aum.assessment_administrator_id, aa.assessment_id 
       FROM assessment_user_mappings aum
       JOIN assessment_administrators aa ON aum.assessment_administrator_id = aa.id
       WHERE aum.id = ?`,
      [assessment_user_mapping_id]
    );

    if (mappingRows.length === 0) return false;

    const [segments] = await pool.execute(
      'SELECT id FROM assessment_segments WHERE assessment_id = ? ORDER BY sequence_order ASC LIMIT ?, 1',
      [mappingRows[0].assessment_id, segment_index]
    );

    if (segments.length === 0) return false;

    await pool.execute(
      `UPDATE assessment_segment_progress 
       SET status = 'COMPLETED', completed_at = NOW()
       WHERE assessment_user_mapping_id = ? AND assessment_segment_id = ?`,
      [assessment_user_mapping_id, segments[0].id]
    );

    return true;
  }

  /**
   * Update question progress when an answer is submitted
   */
  static async updateQuestionProgress(assessment_user_mapping_id, segment_index, question_id, question_type) {
    // Default segment_index to 0 if undefined/null
    const safeSegmentIndex = parseInt(segment_index) || 0;
    
    // Get the segment ID for this index
    const [mappingRows] = await pool.execute(
      `SELECT aum.assessment_administrator_id, aa.assessment_id 
       FROM assessment_user_mappings aum
       JOIN assessment_administrators aa ON aum.assessment_administrator_id = aa.id
       WHERE aum.id = ?`,
      [assessment_user_mapping_id]
    );

    if (mappingRows.length === 0) return false;

    // Use OFFSET instead of LIMIT ?,1 for MySQL prepared statement compatibility
    const [segments] = await pool.execute(
      `SELECT id FROM assessment_segments WHERE assessment_id = ? ORDER BY sequence_order ASC LIMIT 1 OFFSET ${safeSegmentIndex}`,
      [mappingRows[0].assessment_id]
    );

    if (segments.length === 0) return false;

    // Increment attempted_questions count
    await pool.execute(
      `UPDATE assessment_segment_progress 
       SET attempted_questions = COALESCE(attempted_questions, 0) + 1
       WHERE assessment_user_mapping_id = ? AND assessment_segment_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM user_question_submissions 
         WHERE assessment_user_mapping_id = ? AND question_id = ? AND question_type = ?
       )`,
      [assessment_user_mapping_id, segments[0].id, assessment_user_mapping_id, question_id, question_type]
    );

    return true;
  }

  /**
   * Update segment score from the sum of all question submissions
   */
  static async updateSegmentScore(assessment_user_mapping_id, assessment_segment_id) {
    // Calculate MCQ scores from mcq_submissions table
    const [mcqResult] = await pool.execute(
      `SELECT COALESCE(SUM(last_score), 0) as total_score
       FROM mcq_submissions 
       WHERE assessment_user_mapping_id = ? 
         AND assessment_segment_id = ?`,
      [assessment_user_mapping_id, assessment_segment_id]
    );

    // Calculate Programming scores from programming_submissions table
    const [progResult] = await pool.execute(
      `SELECT COALESCE(SUM(last_score), 0) as total_score
       FROM programming_submissions 
       WHERE assessment_user_mapping_id = ? 
         AND assessment_segment_id = ?`,
      [assessment_user_mapping_id, assessment_segment_id]
    );

    const mcqScore = parseFloat(mcqResult[0]?.total_score || 0);
    const progScore = parseFloat(progResult[0]?.total_score || 0);
    const totalScore = mcqScore + progScore;

    // Update segment progress with calculated score
    await pool.execute(
      `UPDATE assessment_segment_progress 
       SET score = ? 
       WHERE assessment_user_mapping_id = ? AND assessment_segment_id = ?`,
      [totalScore, assessment_user_mapping_id, assessment_segment_id]
    );

    return totalScore;
  }

  /**
   * Update total mapping score from all segment scores
   */
  static async updateMappingTotalScore(assessment_user_mapping_id) {
    // Sum all segment scores for this mapping
    const [result] = await pool.execute(
      `SELECT COALESCE(SUM(score), 0) as total_score
       FROM assessment_segment_progress 
       WHERE assessment_user_mapping_id = ?`,
      [assessment_user_mapping_id]
    );

    const totalScore = parseFloat(result[0]?.total_score || 0);

    // Get max possible score from mapping
    const [mappingResult] = await pool.execute(
      `SELECT max_possible_score FROM assessment_user_mappings WHERE id = ?`,
      [assessment_user_mapping_id]
    );

    const maxPossibleScore = parseFloat(mappingResult[0]?.max_possible_score || 0);
    const percentageScore = maxPossibleScore > 0 ? (totalScore / maxPossibleScore * 100) : 0;

    // Update mapping with total score
    await pool.execute(
      `UPDATE assessment_user_mappings 
       SET total_score = ?, percentage_score = ?
       WHERE id = ?`,
      [totalScore, percentageScore.toFixed(2), assessment_user_mapping_id]
    );

    return { totalScore, percentageScore: parseFloat(percentageScore.toFixed(2)) };
  }

  /**
   * Get segment ID by mapping and index
   */
  static async getSegmentIdByIndex(assessment_user_mapping_id, segment_index) {
    const [mappingRows] = await pool.execute(
      `SELECT aa.assessment_id 
       FROM assessment_user_mappings aum
       JOIN assessment_administrators aa ON aum.assessment_administrator_id = aa.id
       WHERE aum.id = ?`,
      [assessment_user_mapping_id]
    );

    if (mappingRows.length === 0) return null;

    const safeSegmentIndex = parseInt(segment_index) || 0;
    const [segments] = await pool.execute(
      `SELECT id FROM assessment_segments WHERE assessment_id = ? ORDER BY sequence_order ASC LIMIT 1 OFFSET ${safeSegmentIndex}`,
      [mappingRows[0].assessment_id]
    );

    return segments.length > 0 ? segments[0].id : null;
  }
}

/**
 * UserQuestionAssignment Model
 */
class UserQuestionAssignment {
  static async createTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS user_question_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        assessment_user_mapping_id INT NOT NULL,
        assessment_segment_id INT NOT NULL,
        question_type ENUM('PROGRAMMING', 'MCQ') NOT NULL,
        question_id INT NOT NULL,
        sequence_order INT NOT NULL DEFAULT 1,
        weightage INT NOT NULL DEFAULT 1,
        is_from_random_fetch BOOLEAN DEFAULT FALSE,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_assignment (assessment_user_mapping_id, assessment_segment_id, question_type, question_id),
        INDEX idx_user_mapping (assessment_user_mapping_id),
        INDEX idx_segment (assessment_segment_id),
        FOREIGN KEY (assessment_user_mapping_id) REFERENCES assessment_user_mappings(id) ON DELETE CASCADE,
        FOREIGN KEY (assessment_segment_id) REFERENCES assessment_segments(id) ON DELETE CASCADE
      )
    `;
    await pool.execute(sql);
  }

  static async getByMappingAndSegment(assessment_user_mapping_id, assessment_segment_id) {
    const [rows] = await pool.execute(
      `SELECT uqa.*,
              q.name as question_title,
              l.name as difficulty
       FROM user_question_assignments uqa
       LEFT JOIN programming_questions pq ON uqa.question_type = 'PROGRAMMING' AND uqa.question_id = pq.id
       LEFT JOIN mcq_multiselect_questions mq ON uqa.question_type = 'MCQ' AND uqa.question_id = mq.id
       LEFT JOIN questions q ON (uqa.question_type = 'PROGRAMMING' AND pq.question_id = q.id) OR (uqa.question_type = 'MCQ' AND mq.question_id = q.id)
       LEFT JOIN levels l ON q.level_id = l.id
       WHERE uqa.assessment_user_mapping_id = ? AND uqa.assessment_segment_id = ?
       ORDER BY uqa.sequence_order ASC`,
      [assessment_user_mapping_id, assessment_segment_id]
    );
    return rows;
  }

  static async getByMappingId(assessment_user_mapping_id) {
    const [rows] = await pool.execute(
      `SELECT uqa.*, aseg.name as segment_name, aseg.sequence_order as segment_order
       FROM user_question_assignments uqa
       JOIN assessment_segments aseg ON uqa.assessment_segment_id = aseg.id
       WHERE uqa.assessment_user_mapping_id = ?
       ORDER BY aseg.sequence_order ASC, uqa.sequence_order ASC`,
      [assessment_user_mapping_id]
    );
    return rows;
  }

  /**
   * Save or update an answer (MCQ submission)
   */
  static async saveAnswer(data) {
    const { assessment_user_mapping_id, assessment_segment_id, question_id, question_type, answer, is_correct, score } = data;
    
    // Ensure user_question_submissions table exists with all required columns
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS user_question_submissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        assessment_user_mapping_id INT NOT NULL,
        assessment_segment_id INT DEFAULT NULL,
        question_id INT NOT NULL,
        question_type ENUM('PROGRAMMING', 'MCQ') NOT NULL,
        answer_data JSON DEFAULT NULL,
        is_correct BOOLEAN DEFAULT NULL,
        score DECIMAL(10,2) DEFAULT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_submission (assessment_user_mapping_id, question_id, question_type),
        INDEX idx_mapping (assessment_user_mapping_id),
        INDEX idx_segment (assessment_segment_id),
        FOREIGN KEY (assessment_user_mapping_id) REFERENCES assessment_user_mappings(id) ON DELETE CASCADE
      )
    `);

    // Add missing columns if they don't exist (for existing tables)
    try {
      await pool.execute(`ALTER TABLE user_question_submissions ADD COLUMN is_correct BOOLEAN DEFAULT NULL`);
    } catch (e) { /* Column may already exist */ }
    try {
      await pool.execute(`ALTER TABLE user_question_submissions ADD COLUMN score DECIMAL(10,2) DEFAULT NULL`);
    } catch (e) { /* Column may already exist */ }
    try {
      await pool.execute(`ALTER TABLE user_question_submissions ADD COLUMN assessment_segment_id INT DEFAULT NULL`);
    } catch (e) { /* Column may already exist */ }

    // Upsert the answer with score and segment_id
    await pool.execute(
      `INSERT INTO user_question_submissions 
       (assessment_user_mapping_id, assessment_segment_id, question_id, question_type, answer_data, is_correct, score)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         assessment_segment_id = VALUES(assessment_segment_id),
         answer_data = VALUES(answer_data), 
         is_correct = VALUES(is_correct),
         score = VALUES(score),
         updated_at = NOW()`,
      [assessment_user_mapping_id, assessment_segment_id || null, question_id, question_type, JSON.stringify(answer), is_correct, score]
    );

    return true;
  }

  /**
   * Submit code for a programming question
   */
  static async submitCode(data) {
    const { assessment_user_mapping_id, assessment_segment_id, question_id, code, language, test_cases_passed, test_cases_total, score, execution_result } = data;

    // Ensure code_submissions table exists with all required columns
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS assessment_code_submissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        assessment_user_mapping_id INT NOT NULL,
        assessment_segment_id INT DEFAULT NULL,
        question_id INT NOT NULL,
        code LONGTEXT NOT NULL,
        language VARCHAR(50) NOT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        execution_result JSON DEFAULT NULL,
        test_cases_passed INT DEFAULT 0,
        test_cases_total INT DEFAULT 0,
        score DECIMAL(10,2) DEFAULT 0,
        INDEX idx_mapping (assessment_user_mapping_id),
        INDEX idx_segment (assessment_segment_id),
        INDEX idx_question (question_id),
        FOREIGN KEY (assessment_user_mapping_id) REFERENCES assessment_user_mappings(id) ON DELETE CASCADE
      )
    `);

    // Add assessment_segment_id column if it doesn't exist (for existing tables)
    try {
      await pool.execute(`ALTER TABLE assessment_code_submissions ADD COLUMN assessment_segment_id INT DEFAULT NULL`);
    } catch (e) { /* Column may already exist */ }

    // Check if submission exists
    const [existing] = await pool.execute(
      'SELECT id FROM assessment_code_submissions WHERE assessment_user_mapping_id = ? AND question_id = ?',
      [assessment_user_mapping_id, question_id]
    );

    if (existing.length > 0) {
      // Update existing submission with score info and segment_id
      await pool.execute(
        `UPDATE assessment_code_submissions 
         SET assessment_segment_id = ?, code = ?, language = ?, test_cases_passed = ?, test_cases_total = ?, score = ?, execution_result = ?, updated_at = NOW()
         WHERE assessment_user_mapping_id = ? AND question_id = ?`,
        [assessment_segment_id || null, code, language, test_cases_passed || 0, test_cases_total || 0, score || 0, execution_result ? JSON.stringify(execution_result) : null, assessment_user_mapping_id, question_id]
      );
      return { id: existing[0].id, updated: true };
    } else {
      // Create new submission with score info and segment_id
      const [result] = await pool.execute(
        `INSERT INTO assessment_code_submissions 
         (assessment_user_mapping_id, assessment_segment_id, question_id, code, language, test_cases_passed, test_cases_total, score, execution_result)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [assessment_user_mapping_id, assessment_segment_id || null, question_id, code, language, test_cases_passed || 0, test_cases_total || 0, score || 0, execution_result ? JSON.stringify(execution_result) : null]
      );
      return { id: result.insertId, updated: false };
    }
  }

  /**
   * Get saved answers for a mapping
   */
  static async getSavedAnswers(assessment_user_mapping_id, assessment_segment_id = null) {
    const answers = {};
    const params = [assessment_user_mapping_id];
    const segmentFilter = assessment_segment_id !== null && assessment_segment_id !== undefined
      ? ' AND ms.assessment_segment_id = ?'
      : '';

    if (segmentFilter) params.push(assessment_segment_id);

    const [mcqRows] = await pool.execute(
      `SELECT ms.mcq_question_id,
              ms.last_selected_options,
              ms.is_correct,
              ms.last_score,
              mq.id as mcq_id
       FROM mcq_submissions ms
       LEFT JOIN mcq_multiselect_questions mq
         ON mq.question_id = ms.mcq_question_id OR mq.id = ms.mcq_question_id
       WHERE ms.assessment_user_mapping_id = ?${segmentFilter}`,
      params
    );

    for (const row of mcqRows) {
      let selected = row.last_selected_options;
      if (typeof selected === 'string') {
        try { selected = JSON.parse(selected); } catch (e) { /* keep raw */ }
      }
      const key = row.mcq_id || row.mcq_question_id;
      answers[key] = {
        question_type: 'MCQ',
        selected_options: selected,
        is_correct: row.is_correct,
        score: row.last_score
      };
    }

    const progParams = [assessment_user_mapping_id];
    const progSegmentFilter = assessment_segment_id !== null && assessment_segment_id !== undefined
      ? ' AND ps.assessment_segment_id = ?'
      : '';
    if (progSegmentFilter) progParams.push(assessment_segment_id);

    const [progRows] = await pool.execute(
      `SELECT ps.programming_question_id,
              ps.last_submitted_code,
              ps.language_used,
              ps.status,
              ps.last_score,
              ps.last_test_cases_passed,
              ps.test_cases_total
       FROM programming_submissions ps
       WHERE ps.assessment_user_mapping_id = ?${progSegmentFilter}`,
      progParams
    );

    for (const row of progRows) {
      answers[row.programming_question_id] = {
        question_type: 'PROGRAMMING',
        code: row.last_submitted_code,
        language: row.language_used,
        status: row.status,
        score: row.last_score,
        test_cases_passed: row.last_test_cases_passed,
        test_cases_total: row.test_cases_total
      };
    }

    return answers;
  }
  
}

/**
 * ProctoringLog Model
 */
class ProctoringLog {
  static async createTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS proctoring_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        assessment_user_mapping_id INT NOT NULL,
        event_type ENUM('TAB_SWITCH', 'FULLSCREEN_EXIT', 'WINDOW_BLUR', 'COPY_PASTE', 'RIGHT_CLICK', 'FACE_NOT_DETECTED', 'MULTIPLE_FACES', 'SCREEN_SHARE_STOPPED') NOT NULL,
        event_timestamp DATETIME NOT NULL,
        metadata JSON DEFAULT NULL,
        segment_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_mapping (assessment_user_mapping_id),
        INDEX idx_event_type (event_type),
        FOREIGN KEY (assessment_user_mapping_id) REFERENCES assessment_user_mappings(id) ON DELETE CASCADE
      )
    `;
    await pool.execute(sql);
  }

  static async log(data) {
    const [result] = await pool.execute(
      `INSERT INTO proctoring_logs 
       (assessment_user_mapping_id, event_type, event_timestamp, metadata, segment_id)
       VALUES (?, ?, NOW(), ?, ?)`,
      [
        data.assessment_user_mapping_id, 
        data.event_type, 
        data.metadata ? JSON.stringify(data.metadata) : null, 
        data.segment_id ?? null  // Convert undefined to null for MySQL
      ]
    );
    return result.insertId;
  }

  static async getByMappingId(assessment_user_mapping_id) {
    const [rows] = await pool.execute(
      'SELECT * FROM proctoring_logs WHERE assessment_user_mapping_id = ? ORDER BY event_timestamp DESC',
      [assessment_user_mapping_id]
    );
    return rows.map(row => ({
      ...row,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
    }));
  }
}

module.exports = {
  TimingConfig,
  ProctoringConfig,
  ScoringConfig,
  QuestionConfig,
  AccessConfig,
  RandomFetchCriteria,
  SegmentProgrammingQuestion,
  SegmentMCQQuestion,
  AssessmentSegmentProgress,
  UserQuestionAssignment,
  ProctoringLog
};

