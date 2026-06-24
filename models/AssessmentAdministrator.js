const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class AssessmentAdministrator {
  /**
   * Create assessment_administrators table if it doesn't exist
   */
  static async createTable() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS assessment_administrators (
        id INT AUTO_INCREMENT PRIMARY KEY,
        unique_id VARCHAR(50) UNIQUE NOT NULL,
        assessment_id INT NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        config_name VARCHAR(255),
        target_audience TEXT,
        category_id INT,
        job_role VARCHAR(255),
        experience INT DEFAULT NULL,
        instruction_page LONGTEXT,
        mailer_template_id INT DEFAULT NULL,
        status ENUM('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED') DEFAULT 'DRAFT',
        is_default BOOLEAN DEFAULT FALSE,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_assessment (assessment_id),
        INDEX idx_status (status),
        INDEX idx_unique_id (unique_id),
        INDEX idx_category (category_id),
        
        FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (mailer_template_id) REFERENCES mailer_templates(id) ON DELETE SET NULL
      )
    `;
    
    try {
      await pool.execute(createTableSQL);
      console.log('AssessmentAdministrator table created or already exists');
    } catch (error) {
      console.error('Error creating assessment_administrators table:', error);
      throw error;
    }
  }

  /**
   * Generate unique ID
   */
  static generateUniqueId() {
    return `AAD-${uuidv4().substring(0, 8).toUpperCase()}`;
  }

  /**
   * Create a new assessment administrator with all configs
   */
  static async create(adminData, configData = {}) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      const {
        assessment_id,
        display_name,
        config_name,
        target_audience,
        category_id,
        job_role,
        experience,
        instruction_page,
        mailer_template_id,
        status = 'DRAFT',
        is_default = false,
        created_by
      } = adminData;

      const unique_id = this.generateUniqueId();

      // If this is set as default, unset other defaults
      if (is_default) {
        await connection.execute(
          'UPDATE assessment_administrators SET is_default = FALSE WHERE assessment_id = ?',
          [assessment_id]
        );
      }

      // Create administrator
      const [result] = await connection.execute(
        `INSERT INTO assessment_administrators 
         (unique_id, assessment_id, display_name, config_name, target_audience, 
          category_id, job_role, experience, instruction_page, mailer_template_id, 
          status, is_default, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [unique_id, assessment_id, display_name, config_name, target_audience,
         category_id || null, job_role, experience, instruction_page, mailer_template_id,
         status, is_default, created_by]
      );

      const adminId = result.insertId;

      // Create timing config
      const timingConfig = configData.timing || {};
      await connection.execute(
        `INSERT INTO timing_configs 
         (assessment_administrator_id, total_time, timing_mode, start_date_time, end_date_time,
          allow_early_segment_submit, carry_forward_time, auto_submit_on_timeout, grace_period_seconds)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [adminId, 
         timingConfig.total_time || 0,
         timingConfig.timing_mode || 'SEGMENT_WISE',
         timingConfig.start_date_time || null,
         timingConfig.end_date_time || null,
         timingConfig.allow_early_segment_submit !== false,
         timingConfig.carry_forward_time || false,
         timingConfig.auto_submit_on_timeout !== false,
         timingConfig.grace_period_seconds || 0]
      );

      // Create proctoring config
      const proctoringConfig = configData.proctoring || {};
      await connection.execute(
        `INSERT INTO proctoring_configs 
         (assessment_administrator_id, proctoring_enabled, full_screen_mandatory, webcam_required,
          max_tab_switch_allowed, allow_segment_switch, disable_copy_paste, disable_right_click)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [adminId,
         proctoringConfig.proctoring_enabled || false,
         proctoringConfig.full_screen_mandatory || false,
         proctoringConfig.webcam_required || false,
         proctoringConfig.max_tab_switch_allowed ?? -1,
         proctoringConfig.allow_segment_switch !== false,
         proctoringConfig.disable_copy_paste || false,
         proctoringConfig.disable_right_click || false]
      );

      // Create scoring config
      const scoringConfig = configData.scoring || {};
      await connection.execute(
        `INSERT INTO scoring_configs 
         (assessment_administrator_id, threshold_for_pass, threshold_type, negative_marking_enabled,
          negative_mark_percentage, show_score_at_end, show_correct_answers_after, show_feedback_or_rating)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [adminId,
         scoringConfig.threshold_for_pass || 40,
         scoringConfig.threshold_type || 'PERCENTAGE',
         scoringConfig.negative_marking_enabled || false,
         scoringConfig.negative_mark_percentage || 0,
         scoringConfig.show_score_at_end || false,
         scoringConfig.show_correct_answers_after || false,
         scoringConfig.show_feedback_or_rating !== false]
      );

      // Create question config
      const questionConfig = configData.question || {};
      await connection.execute(
        `INSERT INTO question_configs 
         (assessment_administrator_id, fetch_random_question, randomize_question_to_users,
          shuffle_options_in_mcq, allow_review_before_submit)
         VALUES (?, ?, ?, ?, ?)`,
        [adminId,
         questionConfig.fetch_random_question || false,
         questionConfig.randomize_question_to_users || false,
         questionConfig.shuffle_options_in_mcq || false,
         questionConfig.allow_review_before_submit !== false]
      );

      // Create access config
      const accessConfig = configData.access || {};
      await connection.execute(
        `INSERT INTO access_configs 
         (assessment_administrator_id, access_code, max_attempts, allow_resume,
          resume_window_minutes, ip_restriction)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [adminId,
         accessConfig.access_code || null,
         accessConfig.max_attempts || 1,
         accessConfig.allow_resume !== false,
         accessConfig.resume_window_minutes || 30,
         accessConfig.ip_restriction || null]
      );

      // Create random fetch criteria if enabled
      if (questionConfig.fetch_random_question && questionConfig.segment_questions) {
        const AssessmentSegment = require('./AssessmentSegment');
        const segments = await AssessmentSegment.getByAssessmentId(assessment_id);

        for (const segment of segments) {
          const segmentQ = questionConfig.segment_questions[segment.id];
          if (segmentQ && segmentQ.total > 0) {
            const [[programmingCount]] = await connection.execute(
              'SELECT COUNT(*) as total FROM segment_programming_questions WHERE assessment_segment_id = ?',
              [segment.id]
            );
            const [[mcqCount]] = await connection.execute(
              'SELECT COUNT(*) as total FROM segment_mcq_questions WHERE assessment_segment_id = ?',
              [segment.id]
            );
            const fallbackType = (programmingCount?.total || 0) > (mcqCount?.total || 0) ? 'PROGRAMMING' : 'MCQ';
            const AssessmentUserMapping = require('./AssessmentUserMapping');
            const questionType = AssessmentUserMapping.resolveQuestionType(
              segmentQ,
              {
                programming: programmingCount?.total || 0,
                mcq: mcqCount?.total || 0
              },
              segment
            ) || fallbackType;
            await connection.execute(
              `INSERT INTO random_fetch_criteria 
               (assessment_segment_id, question_type, question_bank_id, total_questions, easy_count, medium_count, hard_count, is_active)
               VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
              [
                segment.id,
                questionType,
                segmentQ.question_bank_id || null,
                segmentQ.total || 0,
                segmentQ.easy || 0,
                segmentQ.medium || 0,
                segmentQ.hard || 0
              ]
            );
          }
        }
      }

      await connection.commit();

      return {
        id: adminId,
        unique_id
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Find administrator by ID with all configs
   */
  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT aa.*,
              a.title as assessment_title,
              a.unique_id as assessment_unique_id,
              c.name as category_name,
              mt.name as mailer_template_name
       FROM assessment_administrators aa
       JOIN assessments a ON aa.assessment_id = a.id
       LEFT JOIN categories c ON aa.category_id = c.id
       LEFT JOIN mailer_templates mt ON aa.mailer_template_id = mt.id
       WHERE aa.id = ?`,
      [id]
    );

    if (!rows[0]) return null;

    const admin = rows[0];

    // Get timing config
    const [timingRows] = await pool.execute(
      'SELECT * FROM timing_configs WHERE assessment_administrator_id = ?',
      [id]
    );
    admin.timing_config = timingRows[0] || null;

    // Get proctoring config
    const [proctoringRows] = await pool.execute(
      'SELECT * FROM proctoring_configs WHERE assessment_administrator_id = ?',
      [id]
    );
    admin.proctoring_config = proctoringRows[0] || null;

    // Get scoring config
    const [scoringRows] = await pool.execute(
      'SELECT * FROM scoring_configs WHERE assessment_administrator_id = ?',
      [id]
    );
    admin.scoring_config = scoringRows[0] || null;

    // Get question config
    const [questionRows] = await pool.execute(
      'SELECT * FROM question_configs WHERE assessment_administrator_id = ?',
      [id]
    );
    admin.question_config = questionRows[0] || null;
    
    // If random fetch is enabled, get segment-wise criteria
    if (admin.question_config && admin.question_config.fetch_random_question) {
      const AssessmentSegment = require('./AssessmentSegment');
      const AssessmentUserMapping = require('./AssessmentUserMapping');
      const segments = await AssessmentSegment.getByAssessmentId(admin.assessment_id);
      const segmentQuestions = {};
      
      for (const segment of segments) {
        const [criteriaRows] = await pool.execute(
          'SELECT * FROM random_fetch_criteria WHERE assessment_segment_id = ? AND is_active = TRUE',
          [segment.id]
        );
        
        if (criteriaRows.length > 0) {
          // Aggregate criteria (in case there are multiple for different question types)
          const aggregated = criteriaRows.reduce((acc, c) => {
            acc.total = (acc.total || 0) + (c.total_questions || 0);
            acc.easy = (acc.easy || 0) + (c.easy_count || 0);
            acc.medium = (acc.medium || 0) + (c.medium_count || 0);
            acc.hard = (acc.hard || 0) + (c.hard_count || 0);
            if (!acc.question_type && c.question_type) {
              acc.question_type = c.question_type;
            }
            if (!acc.question_bank_id && c.question_bank_id) {
              acc.question_bank_id = c.question_bank_id;
            }
            return acc;
          }, { total: 0, easy: 0, medium: 0, hard: 0, question_bank_id: null, question_type: null });
          
          segmentQuestions[segment.id] = {
            ...aggregated,
            question_type: AssessmentUserMapping.resolveQuestionType(
              aggregated,
              {
                programming: segment.programming_question_count || 0,
                mcq: segment.mcq_question_count || 0
              },
              segment
            )
          };
        }
      }
      
      // Add segment_questions to question_config
      if (admin.question_config) {
        admin.question_config.segment_questions = segmentQuestions;
      }
    }

    // Get access config
    const [accessRows] = await pool.execute(
      'SELECT * FROM access_configs WHERE assessment_administrator_id = ?',
      [id]
    );
    admin.access_config = accessRows[0] || null;

    return admin;
  }

  /**
   * Find administrator by unique_id
   */
  static async findByUniqueId(unique_id) {
    const [rows] = await pool.execute(
      'SELECT id FROM assessment_administrators WHERE unique_id = ?',
      [unique_id]
    );
    if (!rows[0]) return null;
    return this.findById(rows[0].id);
  }

  /**
   * Get all administrators for an assessment
   */
  static async getByAssessmentId(assessment_id) {
    const [rows] = await pool.execute(
      `SELECT aa.*,
              c.name as category_name,
              tc.start_date_time, tc.end_date_time,
              (SELECT COUNT(*) FROM assessment_user_mappings WHERE assessment_administrator_id = aa.id) as user_count
       FROM assessment_administrators aa
       LEFT JOIN categories c ON aa.category_id = c.id
       LEFT JOIN timing_configs tc ON aa.id = tc.assessment_administrator_id
       WHERE aa.assessment_id = ?
       ORDER BY aa.created_at DESC`,
      [assessment_id]
    );
    return rows;
  }

  /**
   * Get all administrators with pagination
   */
  static async getAllPaginated({ search, status, assessment_id, page = 1, pageSize = 10 }) {
    const offset = (page - 1) * pageSize;
    let query = `
      SELECT aa.*,
             a.title as assessment_title,
             c.name as category_name,
             tc.start_date_time, tc.end_date_time,
             (SELECT COUNT(*) FROM assessment_user_mappings WHERE assessment_administrator_id = aa.id) as user_count
      FROM assessment_administrators aa
      JOIN assessments a ON aa.assessment_id = a.id
      LEFT JOIN categories c ON aa.category_id = c.id
      LEFT JOIN timing_configs tc ON aa.id = tc.assessment_administrator_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ' AND (aa.display_name LIKE ? OR aa.unique_id LIKE ? OR a.title LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      query += ' AND aa.status = ?';
      params.push(status);
    }

    if (assessment_id) {
      query += ' AND aa.assessment_id = ?';
      params.push(assessment_id);
    }

    // Get total count
    const countQuery = query.replace(/SELECT aa\.\*[\s\S]*?FROM assessment_administrators aa/, 'SELECT COUNT(*) as total FROM assessment_administrators aa');
    const [countRows] = await pool.execute(countQuery, params);
    const total = countRows[0].total;

    // Get paginated results
    query += ' ORDER BY aa.created_at DESC';
    query += ` LIMIT ${parseInt(pageSize)} OFFSET ${parseInt(offset)}`;
    const [rows] = await pool.execute(query, params);

    return {
      administrators: rows,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      totalPages: Math.ceil(total / pageSize)
    };
  }

  /**
   * Update administrator and configs
   */
  static async update(id, adminData, configData = {}) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      const {
        display_name,
        config_name,
        target_audience,
        category_id,
        job_role,
        experience,
        instruction_page,
        mailer_template_id,
        status,
        is_default
      } = adminData;

      // Convert undefined to null for all fields to prevent MySQL errors
      const displayNameValue = display_name !== undefined ? display_name : null;
      const configNameValue = config_name !== undefined ? config_name : null;
      const targetAudienceValue = target_audience !== undefined ? target_audience : null;
      const categoryIdValue = category_id !== undefined ? category_id : null;
      const jobRoleValue = job_role !== undefined ? job_role : null;
      const experienceValue = experience !== undefined ? experience : null;
      const instructionPageValue = instruction_page !== undefined ? instruction_page : null;
      const mailerTemplateIdValue = mailer_template_id !== undefined ? mailer_template_id : null;
      const statusValue = status !== undefined ? status : null;
      const isDefaultValue = is_default !== undefined ? is_default : null;

      // If setting as default, unset other defaults
      if (is_default) {
        const admin = await this.findById(id);
        await connection.execute(
          'UPDATE assessment_administrators SET is_default = FALSE WHERE assessment_id = ? AND id != ?',
          [admin.assessment_id, id]
        );
      }

      // Update administrator
      await connection.execute(
        `UPDATE assessment_administrators SET
           display_name = COALESCE(?, display_name),
           config_name = COALESCE(?, config_name),
           target_audience = COALESCE(?, target_audience),
           category_id = ?,
           job_role = COALESCE(?, job_role),
           experience = ?,
           instruction_page = COALESCE(?, instruction_page),
           mailer_template_id = ?,
           status = COALESCE(?, status),
           is_default = COALESCE(?, is_default)
         WHERE id = ?`,
        [displayNameValue, configNameValue, targetAudienceValue, categoryIdValue,
         jobRoleValue, experienceValue, instructionPageValue, mailerTemplateIdValue,
         statusValue, isDefaultValue, id]
      );

      // Update timing config if provided
      if (configData.timing) {
        const tc = configData.timing;
        // Convert undefined to null
        const startDateTime = tc.start_date_time !== undefined ? tc.start_date_time : null;
        const endDateTime = tc.end_date_time !== undefined ? tc.end_date_time : null;
        await connection.execute(
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
          [tc.total_time, tc.timing_mode, startDateTime, endDateTime,
           tc.allow_early_segment_submit, tc.carry_forward_time, tc.auto_submit_on_timeout,
           tc.grace_period_seconds, id]
        );
      }

      // Update proctoring config if provided
      if (configData.proctoring) {
        const pc = configData.proctoring;
        await connection.execute(
          `UPDATE proctoring_configs SET
             proctoring_enabled = COALESCE(?, proctoring_enabled),
             full_screen_mandatory = COALESCE(?, full_screen_mandatory),
             webcam_required = COALESCE(?, webcam_required),
             max_tab_switch_allowed = COALESCE(?, max_tab_switch_allowed),
             allow_segment_switch = COALESCE(?, allow_segment_switch),
             disable_copy_paste = COALESCE(?, disable_copy_paste),
             disable_right_click = COALESCE(?, disable_right_click)
           WHERE assessment_administrator_id = ?`,
          [pc.proctoring_enabled, pc.full_screen_mandatory, pc.webcam_required,
           pc.max_tab_switch_allowed, pc.allow_segment_switch, pc.disable_copy_paste, pc.disable_right_click, id]
        );
      }

      // Update scoring config if provided
      if (configData.scoring) {
        const sc = configData.scoring;
        await connection.execute(
          `UPDATE scoring_configs SET
             threshold_for_pass = COALESCE(?, threshold_for_pass),
             threshold_type = COALESCE(?, threshold_type),
             negative_marking_enabled = COALESCE(?, negative_marking_enabled),
             negative_mark_percentage = COALESCE(?, negative_mark_percentage),
             show_score_at_end = COALESCE(?, show_score_at_end),
             show_correct_answers_after = COALESCE(?, show_correct_answers_after),
             show_feedback_or_rating = COALESCE(?, show_feedback_or_rating)
           WHERE assessment_administrator_id = ?`,
          [sc.threshold_for_pass, sc.threshold_type, sc.negative_marking_enabled,
           sc.negative_mark_percentage, sc.show_score_at_end, sc.show_correct_answers_after,
           sc.show_feedback_or_rating, id]
        );
      }

      // Update question config if provided
      if (configData.question) {
        const qc = configData.question;
        await connection.execute(
          `UPDATE question_configs SET
             fetch_random_question = COALESCE(?, fetch_random_question),
             randomize_question_to_users = COALESCE(?, randomize_question_to_users),
             shuffle_options_in_mcq = COALESCE(?, shuffle_options_in_mcq),
             allow_review_before_submit = COALESCE(?, allow_review_before_submit)
           WHERE assessment_administrator_id = ?`,
          [qc.fetch_random_question, qc.randomize_question_to_users,
           qc.shuffle_options_in_mcq, qc.allow_review_before_submit, id]
        );
        
        // Handle segment-wise randomization if fetch_random_question is enabled
        if (qc.fetch_random_question && qc.segment_questions) {
          const RandomFetchCriteria = require('./AssessmentConfigs').RandomFetchCriteria;
          const AssessmentSegment = require('./AssessmentSegment');
          
          // Get assessment_id to get all segments
          const admin = await this.findById(id);
          if (admin && admin.assessment_id) {
            const segments = await AssessmentSegment.getByAssessmentId(admin.assessment_id);
            
            // For each segment with randomization data, create/update random_fetch_criteria
            for (const segment of segments) {
              const segmentQ = qc.segment_questions[segment.id];
              if (segmentQ && segmentQ.total > 0) {
                // Check if criteria already exists for this segment
                const [existingCriteria] = await connection.execute(
                  'SELECT id FROM random_fetch_criteria WHERE assessment_segment_id = ? AND is_active = TRUE',
                  [segment.id]
                );
                
                if (existingCriteria.length > 0) {
                  const [[programmingCount]] = await connection.execute(
                    'SELECT COUNT(*) as total FROM segment_programming_questions WHERE assessment_segment_id = ?',
                    [segment.id]
                  );
                  const [[mcqCount]] = await connection.execute(
                    'SELECT COUNT(*) as total FROM segment_mcq_questions WHERE assessment_segment_id = ?',
                    [segment.id]
                  );
                  const AssessmentUserMapping = require('./AssessmentUserMapping');
                  const questionType = AssessmentUserMapping.resolveQuestionType(
                    segmentQ,
                    {
                      programming: programmingCount?.total || 0,
                      mcq: mcqCount?.total || 0
                    },
                    segment
                  );
                  // Update existing criteria for this segment
                  for (const criteriaRow of existingCriteria) {
                    await connection.execute(
                      `UPDATE random_fetch_criteria SET
                         question_type = ?,
                         question_bank_id = ?,
                         total_questions = ?,
                         easy_count = ?,
                         medium_count = ?,
                         hard_count = ?
                       WHERE id = ?`,
                      [
                        questionType,
                        segmentQ.question_bank_id || null,
                        segmentQ.total || 0,
                        segmentQ.easy || 0,
                        segmentQ.medium || 0,
                        segmentQ.hard || 0,
                        criteriaRow.id
                      ]
                    );
                  }
                } else {
                  const [[programmingCount]] = await connection.execute(
                    'SELECT COUNT(*) as total FROM segment_programming_questions WHERE assessment_segment_id = ?',
                    [segment.id]
                  );
                  const [[mcqCount]] = await connection.execute(
                    'SELECT COUNT(*) as total FROM segment_mcq_questions WHERE assessment_segment_id = ?',
                    [segment.id]
                  );
                  const fallbackType = (programmingCount?.total || 0) > (mcqCount?.total || 0) ? 'PROGRAMMING' : 'MCQ';
                  const AssessmentUserMapping = require('./AssessmentUserMapping');
                  const questionType = AssessmentUserMapping.resolveQuestionType(
                    segmentQ,
                    {
                      programming: programmingCount?.total || 0,
                      mcq: mcqCount?.total || 0
                    },
                    segment
                  ) || fallbackType;
                  await connection.execute(
                    `INSERT INTO random_fetch_criteria 
                     (assessment_segment_id, question_type, question_bank_id, total_questions, easy_count, medium_count, hard_count, is_active)
                     VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
                    [
                      segment.id,
                      questionType,
                      segmentQ.question_bank_id || null,
                      segmentQ.total || 0,
                      segmentQ.easy || 0,
                      segmentQ.medium || 0,
                      segmentQ.hard || 0
                    ]
                  );
                }
              } else {
                // If segment has no randomization data, deactivate existing criteria
                await connection.execute(
                  'UPDATE random_fetch_criteria SET is_active = FALSE WHERE assessment_segment_id = ?',
                  [segment.id]
                );
              }
            }
          }
        }
      }

      // Update access config if provided
      if (configData.access) {
        const ac = configData.access;
        // Convert undefined to null
        const accessCode = ac.access_code !== undefined ? ac.access_code : null;
        const ipRestriction = ac.ip_restriction !== undefined ? ac.ip_restriction : null;
        await connection.execute(
          `UPDATE access_configs SET
             access_code = ?,
             max_attempts = COALESCE(?, max_attempts),
             allow_resume = COALESCE(?, allow_resume),
             resume_window_minutes = COALESCE(?, resume_window_minutes),
             ip_restriction = ?
           WHERE assessment_administrator_id = ?`,
          [accessCode, ac.max_attempts, ac.allow_resume,
           ac.resume_window_minutes, ipRestriction, id]
        );
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Update status
   */
  static async updateStatus(id, status) {
    await pool.execute(
      'UPDATE assessment_administrators SET status = ? WHERE id = ?',
      [status, id]
    );
    return true;
  }

  /**
   * Delete administrator and all related configs
   */
  static async delete(id) {
    // Cascade delete will handle related tables
    await pool.execute('DELETE FROM assessment_administrators WHERE id = ?', [id]);
    return true;
  }

  /**
   * Get statistics for an administrator
   */
  static async getStatistics(id) {
    const [stats] = await pool.execute(
      `SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_users,
        SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress_users,
        SUM(CASE WHEN status = 'INVITED' THEN 1 ELSE 0 END) as invited_users,
        SUM(CASE WHEN passed = TRUE THEN 1 ELSE 0 END) as passed_users,
        AVG(CASE WHEN status = 'COMPLETED' THEN percentage_score ELSE NULL END) as avg_score,
        MIN(CASE WHEN status = 'COMPLETED' THEN percentage_score ELSE NULL END) as min_score,
        MAX(CASE WHEN status = 'COMPLETED' THEN percentage_score ELSE NULL END) as max_score
       FROM assessment_user_mappings
       WHERE assessment_administrator_id = ?`,
      [id]
    );
    return stats[0];
  }

  /**
   * Duplicate an administrator configuration
   */
  static async duplicate(id, created_by) {
    const admin = await this.findById(id);
    if (!admin) return null;

    return this.create(
      {
        assessment_id: admin.assessment_id,
        display_name: `${admin.display_name} (Copy)`,
        config_name: admin.config_name ? `${admin.config_name}_copy` : null,
        target_audience: admin.target_audience,
        category_id: admin.category_id,
        job_role: admin.job_role,
        experience: admin.experience,
        instruction_page: admin.instruction_page,
        mailer_template_id: admin.mailer_template_id,
        status: 'DRAFT',
        is_default: false,
        created_by
      },
      {
        timing: admin.timing_config,
        proctoring: admin.proctoring_config,
        scoring: admin.scoring_config,
        question: admin.question_config,
        access: admin.access_config
      }
    );
  }
}

module.exports = AssessmentAdministrator;

