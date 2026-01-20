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
    const [result] = await pool.execute(
      `INSERT INTO segment_programming_questions 
       (assessment_segment_id, programming_question_id, sequence_order, weightage_override, is_mandatory)
       VALUES (?, ?, ?, ?, ?)`,
      [data.assessment_segment_id, programming_question_id[0].id, 
       data.sequence_order || maxOrder[0].next_order, data.weightage_override, data.is_mandatory ?? true]
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
      `SELECT spq.*, pq.title, pq.description, pq.difficulty, pq.weightage as default_weightage
       FROM segment_programming_questions spq
       JOIN programming_questions pq ON spq.programming_question_id = pq.id
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
    const [result] = await pool.execute(
      `INSERT INTO segment_mcq_questions 
       (assessment_segment_id, mcq_question_id, sequence_order, weightage_override, is_mandatory)
       VALUES (?, ?, ?, ?, ?)`,
      [data.assessment_segment_id, mcq_question_id[0].id, 
       data.sequence_order || maxOrder[0].next_order, data.weightage_override, data.is_mandatory ?? true]
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
      `SELECT smq.*, mq.question_text, mq.difficulty, mq.weightage as default_weightage
       FROM segment_mcq_questions smq
       JOIN mcq_multiselect_questions mq ON smq.mcq_question_id = mq.id
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
              CASE 
                WHEN uqa.question_type = 'PROGRAMMING' THEN pq.title
                WHEN uqa.question_type = 'MCQ' THEN mq.question_text
              END as question_title,
              CASE 
                WHEN uqa.question_type = 'PROGRAMMING' THEN pq.difficulty
                WHEN uqa.question_type = 'MCQ' THEN mq.difficulty
              END as difficulty
       FROM user_question_assignments uqa
       LEFT JOIN programming_questions pq ON uqa.question_type = 'PROGRAMMING' AND uqa.question_id = pq.id
       LEFT JOIN mcq_multiselect_questions mq ON uqa.question_type = 'MCQ' AND uqa.question_id = mq.id
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
      [data.assessment_user_mapping_id, data.event_type, 
       data.metadata ? JSON.stringify(data.metadata) : null, data.segment_id]
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
      metadata: row.metadata ? JSON.parse(row.metadata) : null
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

