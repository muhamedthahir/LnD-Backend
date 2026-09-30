const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class AssessmentSegment {
  /**
   * Create assessment_segments table if it doesn't exist
   */
  static async createTable() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS assessment_segments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        unique_id VARCHAR(50) UNIQUE NOT NULL,
        assessment_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        sequence_order INT NOT NULL DEFAULT 1,
        segment_duration INT NOT NULL DEFAULT 1800,
        total_marks INT DEFAULT 0,
        allow_back_navigation BOOLEAN DEFAULT TRUE,
        is_locked BOOLEAN DEFAULT FALSE,
        negative_marking_enabled BOOLEAN DEFAULT NULL,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_assessment (assessment_id),
        INDEX idx_sequence (assessment_id, sequence_order),
        INDEX idx_unique_id (unique_id),
        
        FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
      )
    `;
    
    try {
      await pool.execute(createTableSQL);
      console.log('AssessmentSegment table created or already exists');
    } catch (error) {
      console.error('Error creating assessment_segments table:', error);
      throw error;
    }

    // Question source per segment (added later):
    //  - 'POOL' => random fetch draws from the questions manually added to this segment
    //  - 'BANK' => random fetch draws from the linked question bank
    //  - NULL   => legacy segments; fetch falls back to random_fetch_criteria.question_bank_id
    try {
      await pool.execute(`ALTER TABLE assessment_segments ADD COLUMN question_source ENUM('POOL','BANK') DEFAULT NULL`);
    } catch (e) { /* column already exists */ }
    try {
      await pool.execute(`ALTER TABLE assessment_segments ADD COLUMN question_bank_id INT DEFAULT NULL`);
    } catch (e) { /* column already exists */ }
    try {
      await pool.execute(`ALTER TABLE assessment_segments ADD COLUMN allowed_language_ids JSON DEFAULT NULL`);
    } catch (e) { /* column already exists */ }
  }

  static parseAllowedLanguageIds(raw) {
    if (raw == null || raw === '') return null;
    if (Array.isArray(raw)) {
      const ids = raw.map(Number).filter((n) => !Number.isNaN(n));
      return ids.length ? ids : null;
    }
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!Array.isArray(parsed) || parsed.length === 0) return null;
      const ids = parsed.map(Number).filter((n) => !Number.isNaN(n));
      return ids.length ? ids : null;
    } catch {
      return null;
    }
  }

  static serializeAllowedLanguageIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return null;
    const normalized = ids.map(Number).filter((n) => !Number.isNaN(n));
    return normalized.length ? JSON.stringify(normalized) : null;
  }

  static normalizeSegmentRow(row) {
    if (!row) return row;
    return {
      ...row,
      allowed_language_ids: this.parseAllowedLanguageIds(row.allowed_language_ids)
    };
  }

  /**
   * Generate unique ID
   */
  static generateUniqueId() {
    return `SEG-${uuidv4().substring(0, 8).toUpperCase()}`;
  }

  /**
   * Create a new segment
   */
  static async create(segmentData) {
    const {
      assessment_id,
      name,
      description,
      sequence_order,
      segment_duration = 1800,
      allow_back_navigation = true,
      is_locked = false,
      negative_marking_enabled = null,
      question_source = 'POOL',
      question_bank_id = null,
      allowed_language_ids = null,
      created_by
    } = segmentData;

    const unique_id = this.generateUniqueId();

    // Get next sequence order if not provided
    let order = sequence_order;
    if (!order) {
      const [maxOrder] = await pool.execute(
        'SELECT COALESCE(MAX(sequence_order), 0) + 1 as next_order FROM assessment_segments WHERE assessment_id = ?',
        [assessment_id]
      );
      order = maxOrder[0].next_order;
    }

    try {
      const [result] = await pool.execute(
        `INSERT INTO assessment_segments 
         (unique_id, assessment_id, name, description, sequence_order, segment_duration, 
          allow_back_navigation, is_locked, negative_marking_enabled, question_source, question_bank_id,
          allowed_language_ids, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [unique_id, assessment_id, name, description, order, segment_duration,
         allow_back_navigation, is_locked, negative_marking_enabled,
         question_source || 'POOL', question_bank_id || null,
         this.serializeAllowedLanguageIds(allowed_language_ids), created_by]
      );

      // Update assessment total duration
      const Assessment = require('./Assessment');
      await Assessment.updateTotalDuration(assessment_id);

      return {
        id: result.insertId,
        unique_id
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find segment by ID
   */
  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT s.*, a.title as assessment_title
       FROM assessment_segments s
       JOIN assessments a ON s.assessment_id = a.id
       WHERE s.id = ?`,
      [id]
    );
    return this.normalizeSegmentRow(rows[0] || null);
  }

  /**
   * Find segment by unique_id
   */
  static async findByUniqueId(unique_id) {
    const [rows] = await pool.execute(
      `SELECT s.*, a.title as assessment_title
       FROM assessment_segments s
       JOIN assessments a ON s.assessment_id = a.id
       WHERE s.unique_id = ?`,
      [unique_id]
    );
    return this.normalizeSegmentRow(rows[0] || null);
  }

  /**
   * Get all segments for an assessment
   */
  static async getByAssessmentId(assessment_id) {
    const [rows] = await pool.execute(
      `SELECT s.*,
              (SELECT COUNT(*) FROM segment_programming_questions WHERE assessment_segment_id = s.id) as programming_question_count,
              (SELECT COUNT(*) FROM segment_mcq_questions WHERE assessment_segment_id = s.id) as mcq_question_count
       FROM assessment_segments s
       WHERE s.assessment_id = ?
       ORDER BY s.sequence_order ASC`,
      [assessment_id]
    );
    return rows.map((row) => this.normalizeSegmentRow(row));
  }

  /**
   * Update a segment
   */
  static async update(id, segmentData) {
    const {
      name,
      description,
      sequence_order,
      segment_duration,
      allow_back_navigation,
      is_locked,
      negative_marking_enabled,
      question_source,
      question_bank_id,
      allowed_language_ids
    } = segmentData;

    // Get current segment to know assessment_id
    const segment = await this.findById(id);
    if (!segment) throw new Error('Segment not found');

    // Convert undefined to null for SQL compatibility
    const safeName = name !== undefined ? name : null;
    const safeDescription = description !== undefined ? description : null;
    const safeSequenceOrder = sequence_order !== undefined ? sequence_order : null;
    const safeSegmentDuration = segment_duration !== undefined ? segment_duration : null;
    const safeAllowBackNavigation = allow_back_navigation !== undefined ? allow_back_navigation : null;
    const safeIsLocked = is_locked !== undefined ? is_locked : null;
    const safeNegativeMarkingEnabled = negative_marking_enabled !== undefined ? negative_marking_enabled : null;
    const safeQuestionSource = question_source !== undefined ? question_source : null;
    // question_bank_id is set directly (null allowed) so switching to POOL can clear the bank
    const safeQuestionBankId = question_source === 'BANK'
      ? (question_bank_id || null)
      : (question_source === 'POOL' ? null : (question_bank_id !== undefined ? question_bank_id : segment.question_bank_id ?? null));
    const safeAllowedLanguageIds = allowed_language_ids !== undefined
      ? this.serializeAllowedLanguageIds(allowed_language_ids)
      : undefined;

    const updateFields = [
      'name = COALESCE(?, name)',
      'description = COALESCE(?, description)',
      'sequence_order = COALESCE(?, sequence_order)',
      'segment_duration = COALESCE(?, segment_duration)',
      'allow_back_navigation = COALESCE(?, allow_back_navigation)',
      'is_locked = COALESCE(?, is_locked)',
      'negative_marking_enabled = ?',
      'question_source = COALESCE(?, question_source)',
      'question_bank_id = ?'
    ];
    const params = [
      safeName, safeDescription, safeSequenceOrder, safeSegmentDuration,
      safeAllowBackNavigation, safeIsLocked, safeNegativeMarkingEnabled,
      safeQuestionSource, safeQuestionBankId
    ];

    if (safeAllowedLanguageIds !== undefined) {
      updateFields.push('allowed_language_ids = ?');
      params.push(safeAllowedLanguageIds);
    }

    params.push(id);

    try {
      await pool.execute(
        `UPDATE assessment_segments SET ${updateFields.join(', ')} WHERE id = ?`,
        params
      );

      // Update assessment total duration
      const Assessment = require('./Assessment');
      await Assessment.updateTotalDuration(segment.assessment_id);

      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete a segment
   */
  static async delete(id) {
    const segment = await this.findById(id);
    if (!segment) throw new Error('Segment not found');

    await pool.execute('DELETE FROM assessment_segments WHERE id = ?', [id]);

    // Reorder remaining segments
    await this.reorderSegments(segment.assessment_id);

    // Update assessment total duration
    const Assessment = require('./Assessment');
    await Assessment.updateTotalDuration(segment.assessment_id);

    return true;
  }

  /**
   * Reorder segments after deletion
   */
  static async reorderSegments(assessment_id) {
    const [segments] = await pool.execute(
      'SELECT id FROM assessment_segments WHERE assessment_id = ? ORDER BY sequence_order ASC',
      [assessment_id]
    );

    for (let i = 0; i < segments.length; i++) {
      await pool.execute(
        'UPDATE assessment_segments SET sequence_order = ? WHERE id = ?',
        [i + 1, segments[i].id]
      );
    }
  }

  /**
   * Move segment up or down
   */
  static async reorder(id, direction) {
    const segment = await this.findById(id);
    if (!segment) throw new Error('Segment not found');

    const newOrder = direction === 'up' 
      ? segment.sequence_order - 1 
      : segment.sequence_order + 1;

    if (newOrder < 1) return false;

    // Find segment at target position
    const [targetSegment] = await pool.execute(
      'SELECT id FROM assessment_segments WHERE assessment_id = ? AND sequence_order = ?',
      [segment.assessment_id, newOrder]
    );

    if (targetSegment.length === 0) return false;

    // Swap positions
    await pool.execute(
      'UPDATE assessment_segments SET sequence_order = ? WHERE id = ?',
      [newOrder, id]
    );
    await pool.execute(
      'UPDATE assessment_segments SET sequence_order = ? WHERE id = ?',
      [segment.sequence_order, targetSegment[0].id]
    );

    return true;
  }

  /**
   * Get segment with all questions
   */
  static async getWithQuestions(id) {
    const segment = await this.findById(id);
    if (!segment) return null;

    // Get programming questions
    const [programmingQuestions] = await pool.execute(
      `SELECT spq.*, 
              pq.id as programming_question_id,
              q.id as question_id,
              q.name, 
              q.description, 
              q.level_id,
              l.name as level_name,
              q.points as default_weightage,
              COALESCE(spq.positive_marks, q.points) as positive_marks,
              COALESCE(spq.negative_marks, 0) as negative_marks,
              COALESCE(spq.neutral_marks, 0) as neutral_marks
       FROM segment_programming_questions spq
       JOIN programming_questions pq ON spq.programming_question_id = pq.id
       JOIN questions q on pq.question_id = q.id
       LEFT JOIN levels l ON q.level_id = l.id
       WHERE spq.assessment_segment_id = ?
       ORDER BY spq.sequence_order ASC`,
      [id]
    );

    // Get MCQ questions
    const [mcqQuestions] = await pool.execute(
      `SELECT smq.*,
              mq.id as mcq_question_id,
              q.id as question_id,
              q.name, 
              q.description, 
              q.level_id,
              l.name as level_name,
              q.points as default_weightage,
              COALESCE(smq.positive_marks, q.points) as positive_marks,
              COALESCE(smq.negative_marks, 0) as negative_marks,
              COALESCE(smq.neutral_marks, 0) as neutral_marks
       FROM segment_mcq_questions smq
       JOIN mcq_multiselect_questions mq ON smq.mcq_question_id = mq.id
       JOIN questions q ON mq.question_id = q.id
       LEFT JOIN levels l ON q.level_id = l.id
       WHERE smq.assessment_segment_id = ?
       ORDER BY smq.sequence_order ASC`,
      [id]
    );

    segment.programming_questions = programmingQuestions;
    segment.mcq_questions = mcqQuestions;
    
    return segment;
  }

  /**
   * Calculate and update total marks for segment
   */
  static async updateTotalMarks(id) {
    await pool.execute(
      `UPDATE assessment_segments 
       SET total_marks = (
         SELECT COALESCE(SUM(
           CASE
             WHEN spq.weightage_override IS NOT NULL AND spq.weightage_override != 0
               THEN COALESCE(spq.positive_marks, q.points, 0)
             ELSE COALESCE(spq.positive_marks, q.points, 0)
           END
         ), 0)
         FROM segment_programming_questions spq
         JOIN programming_questions pq ON spq.programming_question_id = pq.id
         JOIN questions q ON pq.question_id = q.id
         WHERE spq.assessment_segment_id = ?
       ) + (
         SELECT COALESCE(SUM(
           CASE
             WHEN smq.weightage_override IS NOT NULL AND smq.weightage_override != 0
               THEN COALESCE(smq.positive_marks, q.points, 0)
             ELSE COALESCE(smq.positive_marks, q.points, 0)
           END
         ), 0)
         FROM segment_mcq_questions smq
         JOIN mcq_multiselect_questions mq ON smq.mcq_question_id = mq.id
         JOIN questions q ON mq.question_id = q.id
         WHERE smq.assessment_segment_id = ?
       )
       WHERE id = ?`,
      [id, id, id]
    );
    return true;
  }

  /**
   * Duplicate a segment
   */
  static async duplicate(id, assessment_id, created_by) {
    const segment = await this.getWithQuestions(id);
    if (!segment) return null;

    // Create new segment
    const newSegment = await this.create({
      assessment_id: assessment_id || segment.assessment_id,
      name: `${segment.name} (Copy)`,
      description: segment.description,
      segment_duration: segment.segment_duration,
      allow_back_navigation: segment.allow_back_navigation,
      is_locked: segment.is_locked,
      negative_marking_enabled: segment.negative_marking_enabled,
      question_source: segment.question_source,
      question_bank_id: segment.question_bank_id,
      allowed_language_ids: segment.allowed_language_ids,
      created_by
    });

    // Copy programming questions
    for (const pq of segment.programming_questions) {
      await pool.execute(
        `INSERT INTO segment_programming_questions 
         (assessment_segment_id, programming_question_id, sequence_order, weightage_override, is_mandatory)
         VALUES (?, ?, ?, ?, ?)`,
        [newSegment.id, pq.programming_question_id, pq.sequence_order, pq.weightage_override, pq.is_mandatory]
      );
    }

    // Copy MCQ questions
    for (const mq of segment.mcq_questions) {
      await pool.execute(
        `INSERT INTO segment_mcq_questions 
         (assessment_segment_id, mcq_question_id, sequence_order, weightage_override, is_mandatory)
         VALUES (?, ?, ?, ?, ?)`,
        [newSegment.id, mq.mcq_question_id, mq.sequence_order, mq.weightage_override, mq.is_mandatory]
      );
    }

    // Update total marks
    await this.updateTotalMarks(newSegment.id);

    return newSegment;
  }
}

module.exports = AssessmentSegment;

