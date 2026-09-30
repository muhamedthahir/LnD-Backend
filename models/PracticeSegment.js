const pool = require('../config/db');

class PracticeSegment {
  /**
   * Generate a unique ID for practice segment
   */
  static async generateUniqueId() {
    const [rows] = await pool.execute(
      'SELECT unique_id FROM practice_segments ORDER BY id DESC LIMIT 1'
    );
    
    if (rows.length === 0) {
      return 'PS0001';
    }
    
    const lastCode = rows[0].unique_id;
    const num = parseInt(lastCode.replace('PS', '')) + 1;
    return `PS${num.toString().padStart(4, '0')}`;
  }

  /**
   * Create a new practice segment
   */
  static async create(data) {
    const {
      name,
      description,
      topic_id,
      created_by
    } = data;

    const unique_id = await this.generateUniqueId();

    const [result] = await pool.execute(
      `INSERT INTO practice_segments 
       (unique_id, name, description, topic_id, created_by, updated_by) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [unique_id, name, description || null, topic_id, created_by || null, created_by || null]
    );

    return { id: result.insertId, unique_id };
  }

  /**
   * Find practice segment by ID
   */
  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT ps.*, 
              t.name as topic_name,
              u.name as created_by_name
       FROM practice_segments ps
       LEFT JOIN topics t ON ps.topic_id = t.id
       LEFT JOIN users u ON ps.created_by = u.id
       WHERE ps.id = ?`,
      [id]
    );
    
    if (rows[0]) {
      rows[0].programming_questions = await this.getProgrammingQuestions(id);
      rows[0].mcq_questions = await this.getMcqQuestions(id);
    }
    
    return rows[0] || null;
  }

  /**
   * Find practice segments by topic ID
   */
  static async findByTopicId(topic_id) {
    const [rows] = await pool.execute(
      `SELECT ps.*, 
              t.name as topic_name,
              u.name as created_by_name,
              (SELECT COUNT(*) FROM practice_segment_programming_questions WHERE practice_segment_id = ps.id) as programming_count,
              (SELECT COUNT(*) FROM practice_segment_mcq_questions WHERE practice_segment_id = ps.id) as mcq_count
       FROM practice_segments ps
       LEFT JOIN topics t ON ps.topic_id = t.id
       LEFT JOIN users u ON ps.created_by = u.id
       WHERE ps.topic_id = ?
       ORDER BY ps.created_at DESC`,
      [topic_id]
    );
    
    return rows;
  }

  /**
   * Update a practice segment
   */
  static async update(id, data) {
    const {
      name,
      description,
      updated_by
    } = data;

    await pool.execute(
      `UPDATE practice_segments 
       SET name = ?, description = ?, updated_by = ?
       WHERE id = ?`,
      [name, description || null, updated_by || null, id]
    );

    return true;
  }

  /**
   * Delete a practice segment
   */
  static async delete(id) {
    await pool.execute('DELETE FROM practice_segments WHERE id = ?', [id]);
    return true;
  }

  /**
   * Get programming questions for a practice segment
   */
  static async getProgrammingQuestions(practiceSegmentId) {
    const [rows] = await pool.execute(
      `SELECT q.*, 
              pspq.order_index,
              qt.name as question_type_name,
              l.name as level_name,
              s.name as status_name,
              qb.name as question_bank_name
       FROM practice_segment_programming_questions pspq
       INNER JOIN questions q ON pspq.question_id = q.id
       LEFT JOIN question_types qt ON q.question_type_id = qt.id
       LEFT JOIN levels l ON q.level_id = l.id
       LEFT JOIN statuses s ON q.status_id = s.id
       LEFT JOIN question_banks qb ON q.question_bank_id = qb.id
       WHERE pspq.practice_segment_id = ?
       ORDER BY pspq.order_index`,
      [practiceSegmentId]
    );
    return rows;
  }

  /**
   * Get MCQ questions for a practice segment with options
   */
  static async getMcqQuestions(practiceSegmentId) {
    const [rows] = await pool.execute(
      `SELECT q.*, 
              psmq.order_index,
              qt.name as question_type_name,
              l.name as level_name,
              s.name as status_name,
              qb.name as question_bank_name,
              mcq.id as mcq_question_id,
              mcq.is_multi_select,
              mcq.min_select_required,
              mcq.max_select_allowed
       FROM practice_segment_mcq_questions psmq
       INNER JOIN questions q ON psmq.question_id = q.id
       LEFT JOIN question_types qt ON q.question_type_id = qt.id
       LEFT JOIN levels l ON q.level_id = l.id
       LEFT JOIN statuses s ON q.status_id = s.id
       LEFT JOIN question_banks qb ON q.question_bank_id = qb.id
       LEFT JOIN mcq_multiselect_questions mcq ON mcq.question_id = q.id
       WHERE psmq.practice_segment_id = ?
       ORDER BY psmq.order_index`,
      [practiceSegmentId]
    );
    
    // Fetch options for each MCQ question
    for (const question of rows) {
      if (question.mcq_question_id) {
        const [options] = await pool.execute(
          `SELECT id, text, is_correct, \`order\`, explanation 
           FROM options 
           WHERE mcq_multiselect_question_id = ? 
           ORDER BY \`order\` ASC`,
          [question.mcq_question_id]
        );
        question.options = options;
      } else {
        question.options = [];
      }
    }
    
    return rows;
  }

  /**
   * Add a programming question to practice segment
   */
  static async addProgrammingQuestion(practiceSegmentId, questionId, orderIndex = 0) {
    try {
      await pool.execute(
        `INSERT INTO practice_segment_programming_questions 
         (practice_segment_id, question_id, order_index) 
         VALUES (?, ?, ?)`,
        [practiceSegmentId, questionId, orderIndex]
      );
      return { success: true };
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return { success: false, message: 'Question already exists in this practice segment' };
      }
      throw error;
    }
  }

  /**
   * Remove a programming question from practice segment
   */
  static async removeProgrammingQuestion(practiceSegmentId, questionId) {
    const [result] = await pool.execute(
      `DELETE FROM practice_segment_programming_questions 
       WHERE practice_segment_id = ? AND question_id = ?`,
      [practiceSegmentId, questionId]
    );
    return result.affectedRows > 0;
  }

  /**
   * Add an MCQ question to practice segment
   */
  static async addMcqQuestion(practiceSegmentId, questionId, orderIndex = 0) {
    try {
      await pool.execute(
        `INSERT INTO practice_segment_mcq_questions 
         (practice_segment_id, question_id, order_index) 
         VALUES (?, ?, ?)`,
        [practiceSegmentId, questionId, orderIndex]
      );
      return { success: true };
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return { success: false, message: 'Question already exists in this practice segment' };
      }
      throw error;
    }
  }

  /**
   * Remove an MCQ question from practice segment
   */
  static async removeMcqQuestion(practiceSegmentId, questionId) {
    const [result] = await pool.execute(
      `DELETE FROM practice_segment_mcq_questions 
       WHERE practice_segment_id = ? AND question_id = ?`,
      [practiceSegmentId, questionId]
    );
    return result.affectedRows > 0;
  }

  /**
   * Get available programming questions for a user's institution
   * Questions from question banks matching user's institution OR questions with no institution
   */
  static async getAvailableProgrammingQuestions(userInstitutionId, practiceSegmentId, { search = '', limit = 50, offset = 0 } = {}) {
    let whereClause = `WHERE qt.name = 'Programming'`;
    const params = [];

    // Filter by institution: user's institution OR no institution (public)
    if (userInstitutionId) {
      whereClause += ` AND (qb.institution_id = ? OR qb.institution_id IS NULL)`;
      params.push(userInstitutionId);
    }

    // Exclude already added questions
    if (practiceSegmentId) {
      whereClause += ` AND q.id NOT IN (SELECT question_id FROM practice_segment_programming_questions WHERE practice_segment_id = ?)`;
      params.push(practiceSegmentId);
    }

    // Search filter
    if (search) {
      whereClause += ` AND (q.name LIKE ? OR q.code LIKE ? OR q.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Only active questions
    whereClause += ` AND q.active = 1`;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM questions q
      LEFT JOIN question_types qt ON q.question_type_id = qt.id
      LEFT JOIN question_banks qb ON q.question_bank_id = qb.id
      ${whereClause}
    `;
    const [countRows] = await pool.execute(countQuery, params);
    const total = countRows[0].total;

    const dataQuery = `
      SELECT q.*, 
             qt.name as question_type_name,
             l.name as level_name,
             s.name as status_name,
             qb.name as question_bank_name
      FROM questions q
      LEFT JOIN question_types qt ON q.question_type_id = qt.id
      LEFT JOIN levels l ON q.level_id = l.id
      LEFT JOIN statuses s ON q.status_id = s.id
      LEFT JOIN question_banks qb ON q.question_bank_id = qb.id
      ${whereClause}
      ORDER BY q.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    const [rows] = await pool.execute(dataQuery, params);

    return { questions: rows, total };
  }

  /**
   * Get available MCQ/MultiSelect questions for a user's institution
   */
  static async getAvailableMcqQuestions(userInstitutionId, practiceSegmentId, { search = '', limit = 50, offset = 0 } = {}) {
    let whereClause = `WHERE (qt.name = 'MCQ' OR qt.name = 'Multi Select' OR qt.name = 'MultiSelect')`;
    const params = [];

    // Filter by institution: user's institution OR no institution (public)
    if (userInstitutionId) {
      whereClause += ` AND (qb.institution_id = ? OR qb.institution_id IS NULL)`;
      params.push(userInstitutionId);
    }

    // Exclude already added questions
    if (practiceSegmentId) {
      whereClause += ` AND q.id NOT IN (SELECT question_id FROM practice_segment_mcq_questions WHERE practice_segment_id = ?)`;
      params.push(practiceSegmentId);
    }

    // Search filter
    if (search) {
      whereClause += ` AND (q.name LIKE ? OR q.code LIKE ? OR q.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Only active questions
    whereClause += ` AND q.active = 1`;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM questions q
      LEFT JOIN question_types qt ON q.question_type_id = qt.id
      LEFT JOIN question_banks qb ON q.question_bank_id = qb.id
      ${whereClause}
    `;
    const [countRows] = await pool.execute(countQuery, params);
    const total = countRows[0].total;

    const dataQuery = `
      SELECT q.*, 
             qt.name as question_type_name,
             l.name as level_name,
             s.name as status_name,
             qb.name as question_bank_name
      FROM questions q
      LEFT JOIN question_types qt ON q.question_type_id = qt.id
      LEFT JOIN levels l ON q.level_id = l.id
      LEFT JOIN statuses s ON q.status_id = s.id
      LEFT JOIN question_banks qb ON q.question_bank_id = qb.id
      ${whereClause}
      ORDER BY q.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    const [rows] = await pool.execute(dataQuery, params);

    return { questions: rows, total };
  }

  /**
   * Update question order in programming questions
   */
  static async updateProgrammingQuestionOrder(practiceSegmentId, questionId, newOrder) {
    await pool.execute(
      `UPDATE practice_segment_programming_questions 
       SET order_index = ? 
       WHERE practice_segment_id = ? AND question_id = ?`,
      [newOrder, practiceSegmentId, questionId]
    );
    return true;
  }

  /**
   * Update question order in MCQ questions
   */
  static async updateMcqQuestionOrder(practiceSegmentId, questionId, newOrder) {
    await pool.execute(
      `UPDATE practice_segment_mcq_questions 
       SET order_index = ? 
       WHERE practice_segment_id = ? AND question_id = ?`,
      [newOrder, practiceSegmentId, questionId]
    );
    return true;
  }
}

module.exports = PracticeSegment;

