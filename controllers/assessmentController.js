const pool = require('../config/db');
const Assessment = require('../models/Assessment');
const AssessmentSegment = require('../models/AssessmentSegment');
const AssessmentAdministrator = require('../models/AssessmentAdministrator');
const AssessmentUserMapping = require('../models/AssessmentUserMapping');
const MCQSubmission = require('../models/MCQSubmission');
const ProgrammingSubmission = require('../models/ProgrammingSubmission');
const {
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
} = require('../models/AssessmentConfigs');

// =====================================================
// ASSESSMENT CRUD
// =====================================================

/**
 * Create a new assessment
 */
const createAssessment = async (req, res) => {
  try {
    const { title, description, institution_id, topic_id, tags } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const assessment = await Assessment.create({
      title,
      description,
      institution_id,
      topic_id,
      created_by: req.user.id
    });

    res.status(201).json({
      message: 'Assessment created successfully',
      assessment
    });
  } catch (error) {
    console.error('Error creating assessment:', error);
    res.status(500).json({ error: error.message || 'Failed to create assessment' });
  }
};

/**
 * Get all assessments with pagination
 */
const getAssessments = async (req, res) => {
  try {
    const { search, status, institution_id, topic_id, page = 1, pageSize = 10 } = req.query;

    const result = await Assessment.getAllPaginated({
      search,
      status,
      institution_id,
      topic_id,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching assessments:', error);
    res.status(500).json({ error: 'Failed to fetch assessments' });
  }
};

/**
 * Get single assessment by ID
 */
const getAssessment = async (req, res) => {
  try {
    const { id } = req.params;
    const assessment = await Assessment.getWithSegments(id);

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Get statistics
    const statistics = await Assessment.getStatistics(id);
    assessment.statistics = statistics;

    res.json(assessment);
  } catch (error) {
    console.error('Error fetching assessment:', error);
    res.status(500).json({ error: 'Failed to fetch assessment' });
  }
};

/**
 * Update assessment
 */
const updateAssessment = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, institution_id, topic_id, status } = req.body;

    const assessment = await Assessment.findById(id);
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    await Assessment.update(id, {
      title,
      description,
      institution_id,
      topic_id,
      status,
      last_updated_by: req.user.id
    });

    res.json({ message: 'Assessment updated successfully' });
  } catch (error) {
    console.error('Error updating assessment:', error);
    res.status(500).json({ error: 'Failed to update assessment' });
  }
};

/**
 * Delete assessment
 */
const deleteAssessment = async (req, res) => {
  try {
    const { id } = req.params;

    const assessment = await Assessment.findById(id);
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    await Assessment.delete(id);
    res.json({ message: 'Assessment deleted successfully' });
  } catch (error) {
    console.error('Error deleting assessment:', error);
    res.status(500).json({ error: 'Failed to delete assessment' });
  }
};

/**
 * Update assessment status
 */
const updateAssessmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await Assessment.updateStatus(id, status, req.user.id);
    res.json({ message: 'Assessment status updated successfully' });
  } catch (error) {
    console.error('Error updating assessment status:', error);
    res.status(500).json({ error: 'Failed to update assessment status' });
  }
};

/**
 * Duplicate assessment
 */
const duplicateAssessment = async (req, res) => {
  try {
    const { id } = req.params;

    const newAssessment = await Assessment.duplicate(id, req.user.id);
    if (!newAssessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    res.status(201).json({
      message: 'Assessment duplicated successfully',
      assessment: newAssessment
    });
  } catch (error) {
    console.error('Error duplicating assessment:', error);
    res.status(500).json({ error: 'Failed to duplicate assessment' });
  }
};

// =====================================================
// SEGMENT CRUD
// =====================================================

/**
 * Create segment
 */
const createSegment = async (req, res) => {
  try {
    const { assessment_id, name, description, segment_duration, allow_back_navigation, is_locked } = req.body;

    if (!assessment_id || !name) {
      return res.status(400).json({ error: 'Assessment ID and name are required' });
    }

    const segment = await AssessmentSegment.create({
      assessment_id,
      name,
      description,
      segment_duration: segment_duration || 1800,
      allow_back_navigation,
      is_locked,
      created_by: req.user.id
    });

    res.status(201).json({
      message: 'Segment created successfully',
      segment
    });
  } catch (error) {
    console.error('Error creating segment:', error);
    res.status(500).json({ error: 'Failed to create segment' });
  }
};

/**
 * Get segments for an assessment
 */
const getSegments = async (req, res) => {
  try {
    const { assessment_id } = req.params;
    const segments = await AssessmentSegment.getByAssessmentId(assessment_id);
    res.json(segments);
  } catch (error) {
    console.error('Error fetching segments:', error);
    res.status(500).json({ error: 'Failed to fetch segments' });
  }
};

/**
 * Get single segment with questions
 */
const getSegment = async (req, res) => {
  try {
    const { id } = req.params;
    const segment = await AssessmentSegment.getWithQuestions(id);

    if (!segment) {
      return res.status(404).json({ error: 'Segment not found' });
    }

    res.json(segment);
  } catch (error) {
    console.error('Error fetching segment:', error);
    res.status(500).json({ error: 'Failed to fetch segment' });
  }
};

/**
 * Update segment
 */
const updateSegment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, segment_duration, allow_back_navigation, is_locked, negative_marking_enabled } = req.body;

    await AssessmentSegment.update(id, {
      name,
      description,
      segment_duration,
      allow_back_navigation,
      is_locked,
      negative_marking_enabled
    });

    res.json({ message: 'Segment updated successfully' });
  } catch (error) {
    console.error('Error updating segment:', error);
    res.status(500).json({ error: 'Failed to update segment' });
  }
};

/**
 * Delete segment
 */
const deleteSegment = async (req, res) => {
  try {
    const { id } = req.params;
    await AssessmentSegment.delete(id);
    res.json({ message: 'Segment deleted successfully' });
  } catch (error) {
    console.error('Error deleting segment:', error);
    res.status(500).json({ error: 'Failed to delete segment' });
  }
};

/**
 * Reorder segment
 */
const reorderSegment = async (req, res) => {
  try {
    const { id } = req.params;
    const { direction } = req.body;

    if (!['up', 'down'].includes(direction)) {
      return res.status(400).json({ error: 'Invalid direction' });
    }

    await AssessmentSegment.reorder(id, direction);
    res.json({ message: 'Segment reordered successfully' });
  } catch (error) {
    console.error('Error reordering segment:', error);
    res.status(500).json({ error: 'Failed to reorder segment' });
  }
};

// =====================================================
// SEGMENT QUESTIONS
// =====================================================

/**
 * Add programming question to segment
 */
const addProgrammingQuestion = async (req, res) => {
  try {
    const { segment_id, assessment_segment_id, question_id, programming_question_ids, weightage_override = null, is_mandatory } = req.body;

    // Support both single and bulk add
    const segmentId = segment_id || assessment_segment_id;
    
    // If programming_question_ids array is provided, do bulk add
    if (programming_question_ids && Array.isArray(programming_question_ids)) {
      const results = [];
      const errors = [];
      
      for (const qId of programming_question_ids) {
        try {
          const id = await SegmentProgrammingQuestion.add({
            assessment_segment_id: segmentId,
            question_id: qId,
            weightage_override: weightage_override !== undefined ? weightage_override : null,
            is_mandatory: is_mandatory !== undefined ? is_mandatory : true
          });
          results.push(id);
        } catch (error) {
          if (error.code !== 'ER_DUP_ENTRY') {
            errors.push({ question_id: qId, error: error.message });
          }
        }
      }
      
      if (errors.length > 0 && results.length === 0) {
        return res.status(500).json({ error: 'Failed to add questions', errors });
      }
      
      return res.status(201).json({
        message: `Added ${results.length} question(s) successfully${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
        added: results.length,
        failed: errors.length,
        ids: results
      });
    }
    
    // Single question add (original behavior)
    const id = await SegmentProgrammingQuestion.add({
      assessment_segment_id: segmentId,
      question_id,
      weightage_override: weightage_override !== undefined ? weightage_override : null,
      is_mandatory: is_mandatory !== undefined ? is_mandatory : true
    });

    res.status(201).json({
      message: 'Question added successfully',
      id
    });
  } catch (error) {
    console.error('Error adding programming question:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Question already exists in segment' });
    }
    res.status(500).json({ error: 'Failed to add question' });
  }
};

/**
 * Remove programming question from segment
 */
const removeProgrammingQuestion = async (req, res) => {
  try {
    const { segment_id, question_id } = req.params;
    await SegmentProgrammingQuestion.remove(segment_id, question_id);
    res.json({ message: 'Question removed successfully' });
  } catch (error) {
    console.error('Error removing programming question:', error);
    res.status(500).json({ error: 'Failed to remove question' });
  }
};

/**
 * Add MCQ question to segment
 */
const addMCQQuestion = async (req, res) => {
  try {
    const { segment_id, assessment_segment_id, question_id, mcq_question_ids, weightage_override = null, is_mandatory } = req.body;

    // Support both single and bulk add
    const segmentId = segment_id || assessment_segment_id;
    
    // If mcq_question_ids array is provided, do bulk add
    if (mcq_question_ids && Array.isArray(mcq_question_ids)) {
      const results = [];
      const errors = [];
      
      for (const qId of mcq_question_ids) {
        try {
          const id = await SegmentMCQQuestion.add({
            assessment_segment_id: segmentId,
            question_id: qId,
            weightage_override: weightage_override !== undefined ? weightage_override : null,
            is_mandatory: is_mandatory !== undefined ? is_mandatory : true
          });
          results.push(id);
        } catch (error) {
          if (error.code !== 'ER_DUP_ENTRY') {
            errors.push({ question_id: qId, error: error.message });
          }
        }
      }
      
      if (errors.length > 0 && results.length === 0) {
        return res.status(500).json({ error: 'Failed to add questions', errors });
      }
      
      return res.status(201).json({
        message: `Added ${results.length} question(s) successfully${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
        added: results.length,
        failed: errors.length,
        ids: results
      });
    }
    
    // Single question add (original behavior)
    const id = await SegmentMCQQuestion.add({
      assessment_segment_id: segmentId,
      question_id,
      weightage_override: weightage_override !== undefined ? weightage_override : null,
      is_mandatory: is_mandatory !== undefined ? is_mandatory : true
    });

    res.status(201).json({
      message: 'MCQ question added successfully',
      id
    });
  } catch (error) {
    console.error('Error adding MCQ question:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Question already exists in segment' });
    }
    res.status(500).json({ error: 'Failed to add MCQ question' });
  }
};

/**
 * Remove MCQ question from segment
 */
const removeMCQQuestion = async (req, res) => {
  try {
    const { segment_id, question_id } = req.params;
    await SegmentMCQQuestion.remove(segment_id, question_id);
    res.json({ message: 'MCQ question removed successfully' });
  } catch (error) {
    console.error('Error removing MCQ question:', error);
    res.status(500).json({ error: 'Failed to remove MCQ question' });
  }
};

/**
 * Update programming question in segment (override score, marks, etc.)
 */
const updateProgrammingQuestion = async (req, res) => {
  try {
    const { segment_id, question_id } = req.params;
    const updateData = req.body;

    await SegmentProgrammingQuestion.update(
      parseInt(segment_id),
      parseInt(question_id),
      updateData
    );

    res.json({ message: 'Question updated successfully' });
  } catch (error) {
    console.error('Error updating programming question:', error);
    res.status(500).json({ error: 'Failed to update question' });
  }
};

/**
 * Update MCQ question in segment (override score, marks, etc.)
 */
const updateMCQQuestion = async (req, res) => {
  try {
    const { segment_id, question_id } = req.params;
    const updateData = req.body;

    await SegmentMCQQuestion.update(
      parseInt(segment_id),
      parseInt(question_id),
      updateData
    );

    res.json({ message: 'Question updated successfully' });
  } catch (error) {
    console.error('Error updating MCQ question:', error);
    res.status(500).json({ error: 'Failed to update question' });
  }
};

// =====================================================
// ADMINISTRATOR CRUD
// =====================================================

/**
 * Create administrator configuration
 */
const createAdministrator = async (req, res) => {
  try {
    const { adminData, configData } = req.body;

    if (!adminData.assessment_id || !adminData.display_name) {
      return res.status(400).json({ error: 'Assessment ID and display name are required' });
    }

    adminData.created_by = req.user.id;

    const administrator = await AssessmentAdministrator.create(adminData, configData);

    res.status(201).json({
      message: 'Administrator configuration created successfully',
      administrator
    });
  } catch (error) {
    console.error('Error creating administrator:', error);
    res.status(500).json({ error: 'Failed to create administrator configuration' });
  }
};

/**
 * Get administrators for an assessment
 */
const getAdministrators = async (req, res) => {
  try {
    const { assessment_id } = req.params;
    const administrators = await AssessmentAdministrator.getByAssessmentId(assessment_id);
    res.json(administrators);
  } catch (error) {
    console.error('Error fetching administrators:', error);
    res.status(500).json({ error: 'Failed to fetch administrators' });
  }
};

/**
 * Get single administrator with all configs
 */
const getAdministrator = async (req, res) => {
  try {
    const { id } = req.params;
    const administrator = await AssessmentAdministrator.findById(id);

    if (!administrator) {
      return res.status(404).json({ error: 'Administrator not found' });
    }

    // Get statistics
    const statistics = await AssessmentAdministrator.getStatistics(id);
    administrator.statistics = statistics;

    res.json(administrator);
  } catch (error) {
    console.error('Error fetching administrator:', error);
    res.status(500).json({ error: 'Failed to fetch administrator' });
  }
};

/**
 * Update administrator and configs
 */
const updateAdministrator = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminData, configData } = req.body;

    await AssessmentAdministrator.update(id, adminData, configData);
    res.json({ message: 'Administrator updated successfully' });
  } catch (error) {
    console.error('Error updating administrator:', error);
    res.status(500).json({ error: 'Failed to update administrator' });
  }
};

/**
 * Update administrator status
 */
const updateAdministratorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await AssessmentAdministrator.updateStatus(id, status);
    res.json({ message: 'Administrator status updated successfully' });
  } catch (error) {
    console.error('Error updating administrator status:', error);
    res.status(500).json({ error: 'Failed to update administrator status' });
  }
};

/**
 * Delete administrator
 */
const deleteAdministrator = async (req, res) => {
  try {
    const { id } = req.params;
    await AssessmentAdministrator.delete(id);
    res.json({ message: 'Administrator deleted successfully' });
  } catch (error) {
    console.error('Error deleting administrator:', error);
    res.status(500).json({ error: 'Failed to delete administrator' });
  }
};

// =====================================================
// USER MAPPING
// =====================================================

/**
 * Invite users to assessment
 */
const inviteUsers = async (req, res) => {
  try {
    const { administrator_id, user_ids } = req.body;

    if (!administrator_id || !user_ids || !Array.isArray(user_ids)) {
      return res.status(400).json({ error: 'Administrator ID and user IDs are required' });
    }

    const result = await AssessmentUserMapping.bulkInvite(administrator_id, user_ids);
    res.status(201).json({
      message: 'Users invited successfully',
      result
    });
  } catch (error) {
    console.error('Error inviting users:', error);
    res.status(500).json({ error: 'Failed to invite users' });
  }
};

/**
 * Get user mappings for an administrator
 */
const getUserMappings = async (req, res) => {
  try {
    const { administrator_id } = req.params;
    const { search, status, page = 1, pageSize = 10 } = req.query;

    const result = await AssessmentUserMapping.getByAdministratorId(administrator_id, {
      search,
      status,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching user mappings:', error);
    res.status(500).json({ error: 'Failed to fetch user mappings' });
  }
};

/**
 * Get user's assessments
 */
const getMyAssessments = async (req, res) => {
  try {
    const { status, page = 1, pageSize = 10 } = req.query;

    const result = await AssessmentUserMapping.getByUserId(req.user.id, {
      status,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching user assessments:', error);
    res.status(500).json({ error: 'Failed to fetch assessments' });
  }
};

/**
 * Get assessment start info (before starting)
 */
const getStartInfo = async (req, res) => {
  try {
    const { mapping_id } = req.params;

    // Get mapping
    const mapping = await AssessmentUserMapping.findById(mapping_id);
    if (!mapping) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Verify user
    if (mapping.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get administrator with all configs
    const admin = await AssessmentAdministrator.findById(mapping.assessment_administrator_id);
    if (!admin) {
      return res.status(404).json({ error: 'Administrator not found' });
    }

    // Get segments
    const segments = await AssessmentSegment.getByAssessmentId(admin.assessment_id);

    // Calculate total questions
    let totalQuestions = 0;
    segments.forEach(segment => {
      const progCount = segment.programming_question_count || 0;
      const mcqCount = segment.mcq_question_count || 0;
      totalQuestions += progCount + mcqCount;
    });

    // Build response
    const response = {
      display_name: admin.display_name,
      assessment_title: admin.assessment_title,
      total_duration: admin.timing_config?.total_time || 0,
      segment_count: segments.length,
      total_questions: totalQuestions,
      threshold_for_pass: admin.scoring_config?.threshold_for_pass || 40,
      instruction_page: admin.instruction_page,
      requires_access_code: !!admin.access_config?.access_code,
      proctoring_enabled: admin.proctoring_config?.proctoring_enabled || false,
      full_screen_mandatory: admin.proctoring_config?.full_screen_mandatory || false,
      webcam_required: admin.proctoring_config?.webcam_required || false,
      max_tab_switch_allowed: admin.proctoring_config?.max_tab_switch_allowed ?? -1,
      disable_copy_paste: admin.proctoring_config?.disable_copy_paste || false,
      auto_submit_on_timeout: admin.timing_config?.auto_submit_on_timeout || false,
      allow_back_navigation: admin.timing_config?.allow_early_segment_submit !== false, // Default true
      negative_marking_enabled: admin.scoring_config?.negative_marking_enabled || false,
      negative_mark_percentage: admin.scoring_config?.negative_mark_percentage || 0,
      allow_resume: admin.access_config?.allow_resume !== false, // Default true
      resume_window_minutes: admin.access_config?.resume_window_minutes || 30,
      segments: segments.map(segment => ({
        id: segment.id,
        name: segment.name,
        segment_duration: segment.segment_duration,
        question_count: (segment.programming_question_count || 0) + (segment.mcq_question_count || 0)
      }))
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching start info:', error);
    res.status(500).json({ error: 'Failed to fetch assessment details' });
  }
};

/**
 * Start assessment
 */
const startAssessment = async (req, res) => {
  try {
    const { mapping_id } = req.params;
    const { access_code } = req.body;

    // Get mapping
    const mapping = await AssessmentUserMapping.findById(mapping_id);
    if (!mapping) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Verify user
    if (mapping.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check access code if required
    const accessConfig = await AccessConfig.findByAdminId(mapping.assessment_administrator_id);
    if (accessConfig?.access_code && accessConfig.access_code !== access_code) {
      return res.status(400).json({ error: 'Invalid access code' });
    }

    const result = await AssessmentUserMapping.startAssessment(mapping_id, {
      ip_address: req.ip || req.connection.remoteAddress,
      browser_info: req.headers['user-agent']
    });

    res.json({
      message: 'Assessment started successfully',
      mapping: result
    });
  } catch (error) {
    console.error('Error starting assessment:', error);
    res.status(500).json({ error: error.message || 'Failed to start assessment' });
  }
};

/**
 * Get assessment data for taking (in progress assessment)
 */
const getAssessmentTake = async (req, res) => {
  try {
    const { mapping_id } = req.params;

    // Get mapping
    const mapping = await AssessmentUserMapping.findById(mapping_id);
    if (!mapping) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Verify user
    if (mapping.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if assessment is in progress or can be started
    if (!['IN_PROGRESS', 'INVITED', 'NOT_STARTED', 'PAUSED'].includes(mapping.status)) {
      return res.status(400).json({ error: `Assessment cannot be taken. Current status: ${mapping.status}` });
    }

    // If not in progress, start it first
    if (mapping.status !== 'IN_PROGRESS') {
      try {
        await AssessmentUserMapping.startAssessment(mapping_id, {
          ip_address: req.ip || req.connection.remoteAddress,
          browser_info: req.headers['user-agent']
        });
        // Re-fetch mapping to get updated status
        const updatedMapping = await AssessmentUserMapping.findById(mapping_id);
        Object.assign(mapping, updatedMapping);
      } catch (error) {
        console.error('Error starting assessment:', error);
        return res.status(400).json({ error: error.message || 'Failed to start assessment' });
      }
    }

    // Get administrator with all configs
    const admin = await AssessmentAdministrator.findById(mapping.assessment_administrator_id);
    if (!admin) {
      return res.status(404).json({ error: 'Administrator not found' });
    }

    // Get question config to check if random fetch is enabled
    const [questionConfigRows] = await pool.execute(
      'SELECT * FROM question_configs WHERE assessment_administrator_id = ?',
      [mapping.assessment_administrator_id]
    );
    const config = questionConfigRows[0] || {};

    // Get segments
    const segments = await AssessmentSegment.getByAssessmentId(admin.assessment_id);
    
    if (!segments || segments.length === 0) {
      return res.status(400).json({ error: 'No segments found for this assessment' });
    }
    
    // Get current segment progress
    let currentSegmentIndex = mapping.current_segment_index || 0;
    let currentSegment = segments[currentSegmentIndex];
    
    // If segment index is out of bounds, default to first segment
    if (!currentSegment) {
      currentSegment = segments[0];
      currentSegmentIndex = 0;
      // Update mapping to point to first segment
      await pool.execute(
        'UPDATE assessment_user_mappings SET current_segment_index = 0 WHERE id = ?',
        [mapping_id]
      );
    }
    
    if (!currentSegment) {
      // If segment index is out of bounds, default to first segment
      const firstSegment = segments[0];
      if (firstSegment) {
        // Update mapping to point to first segment
        await pool.execute(
          'UPDATE assessment_user_mappings SET current_segment_index = 0 WHERE id = ?',
          [mapping_id]
        );
        // Use first segment
        const segmentToUse = firstSegment;
        const segmentIndexToUse = 0;
        
        // Continue with first segment logic below
        // (We'll set currentSegment and currentSegmentIndex)
        currentSegment = segmentToUse;
        currentSegmentIndex = segmentIndexToUse;
      } else {
        return res.status(404).json({ error: 'No segments available' });
      }
    }

    // Get questions assigned to this user for current segment
    let [questionAssignments] = await pool.execute(
      `SELECT uqa.*
       FROM user_question_assignments uqa
       WHERE uqa.assessment_user_mapping_id = ? AND uqa.assessment_segment_id = ?
       ORDER BY uqa.sequence_order ASC`,
      [mapping_id, currentSegment.id]
    );

    // If no questions assigned, try to assign them (should have been done on start, but handle edge case)
    if (!questionAssignments || questionAssignments.length === 0) {
      try {
        // Check if questions exist for this specific segment
        const [segmentAssignments] = await pool.execute(
          'SELECT COUNT(*) as count FROM user_question_assignments WHERE assessment_user_mapping_id = ? AND assessment_segment_id = ?',
          [mapping_id, currentSegment.id]
        );
        
        // Check if questions exist for other segments
        const [allAssignments] = await pool.execute(
          'SELECT COUNT(*) as count FROM user_question_assignments WHERE assessment_user_mapping_id = ?',
          [mapping_id]
        );
        
        // If no questions assigned for this segment, try to assign
        // This handles cases where assignment failed partially or questions weren't assigned for this segment
        if (segmentAssignments[0].count === 0) {
          console.log(`No questions found for segment ${currentSegment.id} (${currentSegment.name}), attempting to assign...`);
          
          // First check if segment has questions configured
          const [segmentProgQuestions] = await pool.execute(
            'SELECT COUNT(*) as count FROM segment_programming_questions WHERE assessment_segment_id = ?',
            [currentSegment.id]
          );
          const [segmentMCQQuestions] = await pool.execute(
            'SELECT COUNT(*) as count FROM segment_mcq_questions WHERE assessment_segment_id = ?',
            [currentSegment.id]
          );
          
          const totalSegmentQuestions = (segmentProgQuestions[0]?.count || 0) + (segmentMCQQuestions[0]?.count || 0);
          
          console.log(`Segment ${currentSegment.id} (${currentSegment.name}): Found ${segmentProgQuestions[0]?.count || 0} programming and ${segmentMCQQuestions[0]?.count || 0} MCQ questions in database`);
          
          if (totalSegmentQuestions === 0 && !config.fetch_random_question) {
            console.error(`Segment ${currentSegment.id} (${currentSegment.name}) has no questions configured and random fetch is disabled`);
            return res.status(400).json({ 
              error: `Segment "${currentSegment.name}" has no questions configured. Please add questions to this segment.` 
            });
          }
          
          // If questions exist but weren't assigned, try to assign them
          if (totalSegmentQuestions > 0) {
            console.log(`Segment ${currentSegment.id} has ${totalSegmentQuestions} questions, attempting assignment...`);
          }
          
          await AssessmentUserMapping.assignQuestionsToUser(mapping_id);
        }
        
        // Re-fetch assignments after potential assignment
        const [retryAssignments] = await pool.execute(
          `SELECT uqa.*
           FROM user_question_assignments uqa
           WHERE uqa.assessment_user_mapping_id = ? AND uqa.assessment_segment_id = ?
           ORDER BY uqa.sequence_order ASC`,
          [mapping_id, currentSegment.id]
        );
        
        if (retryAssignments && retryAssignments.length > 0) {
          // Replace the array with new assignments
          questionAssignments = retryAssignments;
        } else {
          console.error(`No questions available for segment ${currentSegment.id} after assignment attempt`);
          return res.status(400).json({ 
            error: `No questions available for segment "${currentSegment.name}". Please contact administrator.` 
          });
        }
      } catch (error) {
        console.error('Error assigning questions:', error);
        // If it's a duplicate entry error, just continue - questions might already be assigned
        if (error.code === 'ER_DUP_ENTRY') {
          console.log('Duplicate entry error, re-fetching assignments...');
          // Re-fetch assignments one more time
          const [retryAssignments] = await pool.execute(
            `SELECT uqa.*
             FROM user_question_assignments uqa
             WHERE uqa.assessment_user_mapping_id = ? AND uqa.assessment_segment_id = ?
             ORDER BY uqa.sequence_order ASC`,
            [mapping_id, currentSegment.id]
          );
          if (retryAssignments && retryAssignments.length > 0) {
            questionAssignments = retryAssignments;
          } else {
            console.error(`No questions found after duplicate entry error for segment ${currentSegment.id}`);
            return res.status(400).json({ 
              error: `No questions available for segment "${currentSegment.name}". Please contact administrator.` 
            });
          }
        } else {
          console.error('Failed to assign questions:', error.message);
          return res.status(400).json({ 
            error: `Failed to assign questions: ${error.message || 'Please contact administrator.'}` 
          });
        }
      }
    }

    // Get full question details for each assigned question
    const questions = [];
    for (const assignment of questionAssignments) {
      if (assignment.question_type === 'PROGRAMMING') {
        const [pqRows] = await pool.execute(
          `SELECT pq.*, q.name, q.description, q.points,
                  COALESCE(spq.positive_marks, q.points) as positive_marks,
                  COALESCE(spq.negative_marks, 0) as negative_marks,
                  COALESCE(spq.neutral_marks, 0) as neutral_marks
           FROM programming_questions pq
           JOIN questions q ON pq.question_id = q.id
           LEFT JOIN segment_programming_questions spq ON spq.programming_question_id = pq.id AND spq.assessment_segment_id = ?
           WHERE pq.id = ?`,
          [currentSegment.id, assignment.question_id]
        );
        if (pqRows[0]) {
          // Fetch test cases for this programming question (only non-hidden for display)
          const [testCaseRows] = await pool.execute(
            `SELECT id, input, expected_result, description, is_hidden, weight
             FROM test_cases 
             WHERE programming_question_id = ? AND is_hidden = 0
             ORDER BY \`order\` ASC, id ASC`,
            [pqRows[0].id]
          );
          
          questions.push({
            ...pqRows[0],
            question_type: 'PROGRAMMING',
            programming_question_id: pqRows[0].id,
            problem_statement: pqRows[0].name || pqRows[0].description,
            sequence_order: assignment.sequence_order,
            weightage: assignment.weightage,
            positive_marks: pqRows[0].positive_marks || pqRows[0].points || 0,
            negative_marks: pqRows[0].negative_marks || 0,
            neutral_marks: pqRows[0].neutral_marks || 0,
            test_cases: testCaseRows.map(tc => ({
              id: tc.id,
              input: tc.input,
              expected_output: tc.expected_result,
              description: tc.description,
              is_hidden: tc.is_hidden,
              points: tc.weight
            }))
          });
        }
      } else if (assignment.question_type === 'MCQ') {
        const [mqRows] = await pool.execute(
          `SELECT mq.*, q.name, q.description, q.points,
                  COALESCE(smq.positive_marks, q.points) as positive_marks,
                  COALESCE(smq.negative_marks, 0) as negative_marks,
                  COALESCE(smq.neutral_marks, 0) as neutral_marks
           FROM mcq_multiselect_questions mq
           JOIN questions q ON mq.question_id = q.id
           LEFT JOIN segment_mcq_questions smq ON smq.mcq_question_id = mq.id AND smq.assessment_segment_id = ?
           WHERE mq.id = ?`,
          [currentSegment.id, assignment.question_id]
        );
        if (mqRows[0]) {
          // Fetch options for this MCQ
          const [optionRows] = await pool.execute(
            `SELECT id, text as option_text, \`order\` FROM options WHERE mcq_multiselect_question_id = ? ORDER BY \`order\` ASC`,
            [mqRows[0].id]
          );
          
          questions.push({
            ...mqRows[0],
            question_type: 'MCQ',
            mcq_question_id: mqRows[0].id,
            question_text: mqRows[0].name || mqRows[0].description,
            sequence_order: assignment.sequence_order,
            weightage: assignment.weightage,
            positive_marks: mqRows[0].positive_marks || mqRows[0].points || 0,
            negative_marks: mqRows[0].negative_marks || 0,
            neutral_marks: mqRows[0].neutral_marks || 0,
            options: optionRows.map(opt => ({
              id: opt.id,
              value: opt.id,
              text: opt.option_text
            }))
          });
        }
      }
    }

    // Get saved answers
    const savedAnswers = questionAssignments; // Use the same query result

    // Calculate time remaining
    const startTime = new Date(mapping.assessment_started_time);
    const now = new Date();
    const elapsedSeconds = Math.floor((now - startTime) / 1000);
    const totalDuration = admin.timing_config?.total_time || 0;
    const timeRemaining = Math.max(0, totalDuration - elapsedSeconds);

    // Calculate segment time remaining if segment-wise timing
    let segmentTimeRemaining = 0;
    if (admin.timing_config?.timing_mode === 'SEGMENT_WISE' && currentSegment.segment_duration) {
      // Get segment start time from progress
      const [progressRows] = await pool.execute(
        'SELECT * FROM assessment_segment_progress WHERE assessment_user_mapping_id = ? AND assessment_segment_id = ?',
        [mapping_id, currentSegment.id]
      );
      if (progressRows[0]?.started_at) {
        const segmentStartTime = new Date(progressRows[0].started_at);
        const segmentElapsed = Math.floor((now - segmentStartTime) / 1000);
        segmentTimeRemaining = Math.max(0, currentSegment.segment_duration - segmentElapsed);
      } else {
        segmentTimeRemaining = currentSegment.segment_duration;
      }
    }

    // Get saved answers from database
    let answersMap = {};
    try {
      answersMap = await UserQuestionAssignment.getSavedAnswers(mapping_id);
    } catch (e) {
      console.log('No saved answers found or table not exists');
    }

    // Check if this is a resume (if saved time_remaining exists and is less than calculated)
    const isResume = mapping.time_remaining > 0 && mapping.time_remaining < timeRemaining;
    const actualTimeRemaining = isResume ? mapping.time_remaining : timeRemaining;
    
    // For segment time, use saved if resuming in same segment
    const actualSegmentTimeRemaining = (isResume && mapping.segment_time_remaining > 0) 
      ? mapping.segment_time_remaining 
      : segmentTimeRemaining;

    // If resuming, increment resume count
    if (isResume) {
      await AssessmentUserMapping.resume(mapping_id);
    }

    res.json({
      questions: questions.map(q => ({
        ...q,
        question_type: q.question_type || (q.programming_question_id ? 'PROGRAMMING' : 'MCQ')
      })),
      time_remaining: actualTimeRemaining,
      segment_time_remaining: actualSegmentTimeRemaining,
      total_time_worked: mapping.total_time_worked || 0,
      resume_count: (mapping.resume_count || 0) + (isResume ? 1 : 0),
      current_segment: {
        id: currentSegment.id,
        name: currentSegment.name,
        segment_duration: currentSegment.segment_duration,
        time_remaining: actualSegmentTimeRemaining
      },
      current_segment_index: currentSegmentIndex,
      current_question_index: mapping.current_question_index || 0,
      saved_answers: answersMap,
      proctoring: {
        proctoring_enabled: admin.proctoring_config?.proctoring_enabled || false,
        full_screen_mandatory: admin.proctoring_config?.full_screen_mandatory || false,
        webcam_required: admin.proctoring_config?.webcam_required || false,
        max_tab_switch_allowed: admin.proctoring_config?.max_tab_switch_allowed ?? -1,
        disable_copy_paste: admin.proctoring_config?.disable_copy_paste || false,
        disable_right_click: admin.proctoring_config?.disable_right_click || false
      },
      segments: segments.map(s => ({
        id: s.id,
        name: s.name,
        segment_duration: s.segment_duration
      })),
      total_duration: totalDuration,
      timing_mode: admin.timing_config?.timing_mode || 'OVERALL',
      tab_switch_count: mapping.tab_switch_count || 0
    });
  } catch (error) {
    console.error('Error fetching assessment take data:', error);
    res.status(500).json({ error: 'Failed to fetch assessment data' });
  }
};

/**
 * Get assessment questions for user
 */
const getAssessmentQuestions = async (req, res) => {
  try {
    const { mapping_id, segment_id } = req.params;

    const mapping = await AssessmentUserMapping.findById(mapping_id);
    if (!mapping) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Verify user
    if (mapping.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const questions = await UserQuestionAssignment.getByMappingAndSegment(mapping_id, segment_id);
    const progress = await AssessmentSegmentProgress.findByMappingAndSegment(mapping_id, segment_id);

    res.json({
      questions,
      progress
    });
  } catch (error) {
    console.error('Error fetching assessment questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
};

/**
 * Submit assessment
 */
const submitAssessment = async (req, res) => {
  try {
    const { mapping_id } = req.params;

    const mapping = await AssessmentUserMapping.findById(mapping_id);
    if (!mapping) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Verify user
    if (mapping.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await AssessmentUserMapping.submitAssessment(mapping_id);

    res.json({
      message: 'Assessment submitted successfully',
      result
    });
  } catch (error) {
    console.error('Error submitting assessment:', error);
    res.status(500).json({ error: error.message || 'Failed to submit assessment' });
  }
};

/**
 * Update assessment progress
 */
const updateProgress = async (req, res) => {
  try {
    const { mapping_id } = req.params;
    const { current_segment_index, total_time_worked } = req.body;

    await AssessmentUserMapping.updateActivity(mapping_id, {
      current_segment_index,
      total_time_worked
    });

    res.json({ message: 'Progress updated' });
  } catch (error) {
    console.error('Error updating progress:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
};

/**
 * Log proctoring event
 */
const logProctoringEvent = async (req, res) => {
  try {
    const { mapping_id } = req.params;
    const { event_type, metadata, details, segment_id } = req.body;

    // Support both 'metadata' and 'details' field names
    const eventMetadata = metadata || details || {};

    await ProctoringLog.log({
      assessment_user_mapping_id: mapping_id,
      event_type,
      metadata: eventMetadata,
      segment_id
    });

    // Handle tab switch events
    if (event_type === 'TAB_SWITCH' || event_type === 'WINDOW_BLUR') {
      const result = await AssessmentUserMapping.incrementTabSwitch(mapping_id);
      return res.json(result);
    }

    res.json({ message: 'Event logged' });
  } catch (error) {
    console.error('Error logging proctoring event:', error);
    res.status(500).json({ error: 'Failed to log event' });
  }
};

/**
 * Submit feedback
 */
const submitFeedback = async (req, res) => {
  try {
    const { mapping_id } = req.params;
    const { rating, comment } = req.body;

    await AssessmentUserMapping.submitFeedback(mapping_id, { rating, comment });
    res.json({ message: 'Feedback submitted successfully' });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
};

/**
 * Get assessment result
 */
const getAssessmentResult = async (req, res) => {
  try {
    const { mapping_id } = req.params;

    const mapping = await AssessmentUserMapping.findById(mapping_id);
    if (!mapping) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Verify user or admin (primary_admin, college_admin, or generic admin)
    const isAdmin = ['primary_admin', 'college_admin', 'admin'].includes(req.user.role);
    
    if (mapping.user_id !== req.user.id && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get scoring config to check if results should be shown
    const scoringConfig = await ScoringConfig.findByAdminId(mapping.assessment_administrator_id);
    if (!scoringConfig?.show_score_at_end && !isAdmin) {
      return res.status(403).json({ error: 'Results are not available' });
    }

    const segmentProgress = await AssessmentSegmentProgress.getByMappingId(mapping_id);
    const proctoringLogs = await ProctoringLog.getByMappingId(mapping_id);

    // Enhance segment progress with detailed question data
    const detailedSegmentProgress = await Promise.all(segmentProgress.map(async (segment) => {
      // Get questions assigned to this user for this segment
      const questions = await UserQuestionAssignment.getByMappingAndSegment(mapping_id, segment.assessment_segment_id);
      
      // Get submissions for these questions
      const enhancedQuestions = await Promise.all(questions.map(async (q) => {
        let submission = null;
        if (q.question_type === 'PROGRAMMING') {
          submission = await ProgrammingSubmission.findByAssessmentAndQuestion(mapping_id, q.question_id);
        } else {
          submission = await MCQSubmission.findByAssessmentAndQuestion(mapping_id, q.question_id);
        }

        return {
          ...q,
          is_attempted: !!submission,
          submitted_code: submission?.best_submitted_code,
          language_used: submission?.language_used,
          test_cases_passed: submission?.test_cases_passed,
          test_cases_total: submission?.test_cases_total,
          user_answer: submission?.last_selected_options ? 
            (typeof submission.last_selected_options === 'string' ? JSON.parse(submission.last_selected_options) : submission.last_selected_options).join(', ') : null,
          score: submission?.best_score || 0
        };
      }));

      return {
        ...segment,
        questions: enhancedQuestions
      };
    }));

    res.json({
      mapping,
      segment_progress: detailedSegmentProgress,
      proctoring_logs: proctoringLogs,
      show_correct_answers: scoringConfig?.show_correct_answers_after || false
    });
  } catch (error) {
    console.error('Error fetching assessment result:', error);
    res.status(500).json({ error: 'Failed to fetch result' });
  }
};

/**
 * Save answer (auto-save individual answer)
 * For MCQ, also calculates if answer is correct
 */
const saveAnswer = async (req, res) => {
  try {
    const { mapping_id } = req.params;
    const { question_id, question_type, answer } = req.body;

    const mapping = await AssessmentUserMapping.findById(mapping_id);
    if (!mapping) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    if (mapping.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (mapping.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Assessment is not in progress' });
    }

    let isCorrect = null;
    let score = null;

    // For MCQ, calculate if the answer is correct
    if (question_type === 'MCQ' && answer) {
      // Get correct options for this MCQ
      const [correctOptions] = await pool.execute(
        `SELECT id FROM options WHERE mcq_multiselect_question_id = ? AND is_correct = 1`,
        [question_id]
      );
      const correctIds = correctOptions.map(o => o.id).sort((a, b) => a - b);
      
      // Get selected options from answer (could be array or single value)
      let selectedIds = [];
      if (Array.isArray(answer)) {
        selectedIds = answer.map(id => parseInt(id)).filter(id => !isNaN(id)).sort((a, b) => a - b);
      } else if (answer.selected_options) {
        selectedIds = answer.selected_options.map(id => parseInt(id)).filter(id => !isNaN(id)).sort((a, b) => a - b);
      } else if (typeof answer === 'number' || typeof answer === 'string') {
        const parsed = parseInt(answer);
        if (!isNaN(parsed)) selectedIds = [parsed];
      }

      // Check if selected matches correct
      isCorrect = correctIds.length === selectedIds.length && 
                  correctIds.every((id, idx) => id === selectedIds[idx]);

      // Get question marks/weightage
      const [questionInfo] = await pool.execute(
        `SELECT q.points, smq.positive_marks, smq.negative_marks
         FROM mcq_multiselect_questions mq
         JOIN questions q ON mq.question_id = q.id
         LEFT JOIN segment_mcq_questions smq ON smq.mcq_question_id = mq.id
         WHERE mq.id = ?
         LIMIT 1`,
        [question_id]
      );
      
      const marks = questionInfo[0]?.positive_marks || questionInfo[0]?.points || 1;
      const negativeMarks = questionInfo[0]?.negative_marks || 0;

      // Calculate score (normalized to 1)
      if (isCorrect) {
        score = 1; // Correct answer gives 1 point
      } else if (selectedIds.length > 0) {
        // Wrong answer - apply negative marking if enabled
        score = - (negativeMarks / marks); // Normalize negative marks too
      } else {
        // Unanswered
        score = 0;
      }
    }

    // Get segment_id from segment_index
    const segment_id = await AssessmentSegmentProgress.getSegmentIdByIndex(mapping_id, mapping.current_segment_index);

    // Get correct options for MCQ to pass to submission
    let correctOptions = [];
    if (question_type === 'MCQ') {
      const [correctOpts] = await pool.execute(
        `SELECT id FROM options WHERE mcq_multiselect_question_id = ? AND is_correct = 1`,
        [question_id]
      );
      correctOptions = correctOpts.map(o => o.id);
    }

    // Save or update the answer in mcq_submissions table
    if (question_type === 'MCQ') {
      await MCQSubmission.createOrUpdateForAssessment({
        user_id: req.user.id,
        assessment_user_mapping_id: mapping_id,
        assessment_segment_id: segment_id,
        mcq_question_id: question_id,
        selected_options: Array.isArray(answer) ? answer : (answer?.selected_options || [answer]),
        correct_options: correctOptions,
        is_correct: isCorrect,
        score: score || 0, // Score is 0 to 1
        max_score: 1
      });
    }

    // Update segment progress (attempted questions count)
    await AssessmentSegmentProgress.updateQuestionProgress(
      mapping_id,
      mapping.current_segment_index,
      question_id,
      question_type
    );

    // Update segment score from all submissions
    let segmentScore = null;
    let mappingScore = null;
    if (segment_id) {
      segmentScore = await AssessmentSegmentProgress.updateSegmentScore(mapping_id, segment_id);
      // Cascade: update mapping total score from all segment scores
      mappingScore = await AssessmentSegmentProgress.updateMappingTotalScore(mapping_id);
    }

    // Update mapping last activity
    await AssessmentUserMapping.updateActivity(mapping_id, {});

    res.json({ 
      message: 'Answer saved',
      is_correct: isCorrect,
      score,
      segment_score: segmentScore,
      total_score: mappingScore?.totalScore,
      percentage_score: mappingScore?.percentageScore
    });
  } catch (error) {
    console.error('Error saving answer:', error);
    res.status(500).json({ error: 'Failed to save answer' });
  }
};

/**
 * Save progress (periodic auto-save of timer and position)
 */
const saveProgress = async (req, res) => {
  try {
    const { mapping_id } = req.params;
    const { 
      current_segment_index, 
      current_question_index, 
      time_remaining, 
      segment_time_remaining,
      total_time_worked,
      segment_id,
      time_spent
    } = req.body;

    const mapping = await AssessmentUserMapping.findById(mapping_id);
    if (!mapping) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    if (mapping.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (mapping.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Assessment is not in progress' });
    }

    // Update mapping with progress data
    await AssessmentUserMapping.saveProgress(mapping_id, {
      current_segment_index,
      current_question_index,
      time_remaining,
      segment_time_remaining,
      total_time_worked,
      segment_id,
      time_spent
    });

    // Update segment progress if segment_id is provided or we can determine it
    let actualSegmentId = segment_id;
    if (!actualSegmentId && current_segment_index !== undefined) {
      const admin = await AssessmentAdministrator.findById(mapping.assessment_administrator_id);
      if (admin) {
        const segments = await AssessmentSegment.getByAssessmentId(admin.assessment_id);
        if (segments && segments[current_segment_index]) {
          actualSegmentId = segments[current_segment_index].id;
        }
      }
    }

    if (actualSegmentId) {
      await AssessmentSegmentProgress.updateProgressByMappingAndSegment(mapping_id, actualSegmentId, {
        time_remaining: segment_time_remaining,
        time_used: time_spent,
        current_question_index: current_question_index,
        status: 'IN_PROGRESS'
      });

      
      if (actualSegmentId && current_question_index !== undefined) {
        // We need to know which question it is. 
        // In assessments, questions are assigned.
        const [assignments] = await pool.execute(
          `SELECT question_id, question_type FROM user_question_assignments 
           WHERE assessment_user_mapping_id = ? AND assessment_segment_id = ? 
           ORDER BY sequence_order ASC`,
          [mapping_id, actualSegmentId]
        );

        if (assignments && assignments[current_question_index]) {
          const { question_id, question_type } = assignments[current_question_index];
          if (question_type === 'PROGRAMMING') {
            await ProgrammingSubmission.markAttemptedForAssessment({
              user_id: req.user.id,
              assessment_user_mapping_id: mapping_id,
              assessment_segment_id: actualSegmentId,
              programming_question_id: question_id
            });
          } else if (question_type === 'MCQ') {
            await MCQSubmission.markAttemptedForAssessment({
              user_id: req.user.id,
              assessment_user_mapping_id: mapping_id,
              assessment_segment_id: actualSegmentId,
              mcq_question_id: question_id
            });
          }
        }
      }
    }

    res.json({ message: 'Progress saved' });
  } catch (error) {
    console.error('Error saving progress:', error);
    res.status(500).json({ error: 'Failed to save progress' });
  }
};

/**
 * Submit code (programming question submission)
 * Runs all test cases including hidden ones and calculates score
 */
const submitCode = async (req, res) => {
  try {
    const { mapping_id } = req.params;
    const { question_id, code, language } = req.body;

    const mapping = await AssessmentUserMapping.findById(mapping_id);
    if (!mapping) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    if (mapping.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (mapping.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Assessment is not in progress' });
    }

    // Get all test cases for this question (including hidden)
    const [allTestCases] = await pool.execute(
      `SELECT id, input, expected_result, is_hidden, weight 
       FROM test_cases 
       WHERE programming_question_id = ?
       ORDER BY \`order\` ASC, id ASC`,
      [question_id]
    );

    // Run code against all test cases
    const pistonUrl = process.env.PISTON_URL || 'http://localhost';
    const pistonPort = process.env.PISTON_PORT || '2000';
    const pistonEndpoint = `${pistonUrl}:${pistonPort}/api/v2/execute`;

    const languageVersions = {
      'node': '18.15.0',
      'javascript': '18.15.0',
      'python': '3.10.0',
      'java': '15.0.2',
      'c': '10.2.0',
      'cpp': '10.2.0',
      'c++': '10.2.0'
    };

    let testCasesPassed = 0;
    let totalTestCases = allTestCases.length;
    let totalPoints = 0;
    let earnedPoints = 0;
    const testResults = [];

    for (const testCase of allTestCases) {
      totalPoints += testCase.weight || 1;
      
      try {
        const pistonPayload = {
          language: language.toLowerCase(),
          version: languageVersions[language.toLowerCase()] || '*',
          files: [{ name: `main.${language === 'python' ? 'py' : language === 'java' ? 'java' : language}`, content: code }],
          stdin: testCase.input || '',
          args: [],
          compile_timeout: 10000,
          run_timeout: 10000
        };

        const response = await fetch(pistonEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pistonPayload)
        });

        if (response.ok) {
          const result = await response.json();
          const actualOutput = (result.run?.stdout || '').trim();
          const expectedOutput = (testCase.expected_result || '').trim();
          const passed = actualOutput === expectedOutput;

          if (passed) {
            testCasesPassed++;
            earnedPoints += testCase.weight || 1;
          }

          testResults.push({
            test_case_id: testCase.id,
            is_hidden: testCase.is_hidden,
            passed,
            // Only include details for non-hidden test cases
            ...(testCase.is_hidden ? {} : {
              input: testCase.input,
              expected_result: testCase.expected_result,
              actual_output: actualOutput
            })
          });
        } else {
          testResults.push({
            test_case_id: testCase.id,
            is_hidden: testCase.is_hidden,
            passed: false,
            error: 'Execution failed'
          });
        }
      } catch (execError) {
        console.error('Test case execution error:', execError);
        testResults.push({
          test_case_id: testCase.id,
          is_hidden: testCase.is_hidden,
          passed: false,
          error: execError.message
        });
      }
    }

    const percentageScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const normalizedScore = totalPoints > 0 ? (earnedPoints / totalPoints) : 0; // Score between 0 and 1

    // Get segment_id from segment_index
    const segment_id = await AssessmentSegmentProgress.getSegmentIdByIndex(mapping_id, mapping.current_segment_index);

    // Save the code submission in programming_submissions table
    const result = await ProgrammingSubmission.createOrUpdateForAssessment({
      user_id: req.user.id,
      assessment_user_mapping_id: mapping_id,
      assessment_segment_id: segment_id,
      programming_question_id: question_id,
      submitted_code: code,
      language_used: language,
      status: testCasesPassed === totalTestCases ? 'passed' : 'failed',
      test_cases_passed: testCasesPassed,
      test_cases_total: totalTestCases,
      score: normalizedScore,  // Store normalized score 0 to 1
      max_score: 1,
      execution_result: testResults
    });

    // Update segment progress (attempted questions count)
    await AssessmentSegmentProgress.updateQuestionProgress(
      mapping_id,
      mapping.current_segment_index,
      question_id,
      'PROGRAMMING'
    );

    // Update segment score from all submissions
    let segmentScore = null;
    let mappingScore = null;
    if (segment_id) {
      segmentScore = await AssessmentSegmentProgress.updateSegmentScore(mapping_id, segment_id);
      // Cascade: update mapping total score from all segment scores
      mappingScore = await AssessmentSegmentProgress.updateMappingTotalScore(mapping_id);
    }

    // Update mapping last activity
    await AssessmentUserMapping.updateActivity(mapping_id, {});

    res.json({ 
      message: 'Code submitted successfully',
      submission_id: result?.id,
      test_cases_passed: testCasesPassed,
      test_cases_total: totalTestCases,
      score: percentageScore, // Return percentage to UI
      earned_points: earnedPoints,
      total_points: totalPoints,
      segment_score: segmentScore,
      total_score: mappingScore?.totalScore,
      percentage_score: mappingScore?.percentageScore,
      // Return visible test case results (not hidden ones' details)
      results: testResults.filter(r => !r.is_hidden).map(r => ({
        passed: r.passed,
        input: r.input,
        expected_result: r.expected_result,
        actual_output: r.actual_output
      })),
      hidden_passed: testResults.filter(r => r.is_hidden && r.passed).length,
      hidden_total: testResults.filter(r => r.is_hidden).length
    });
  } catch (error) {
    console.error('Error submitting code:', error);
    res.status(500).json({ error: 'Failed to submit code' });
  }
};

/**
 * Move to next segment
 */
const nextSegment = async (req, res) => {
  try {
    const { mapping_id } = req.params;

    const mapping = await AssessmentUserMapping.findById(mapping_id);
    if (!mapping) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    if (mapping.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (mapping.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Assessment is not in progress' });
    }

    // Get admin and segments
    const admin = await AssessmentAdministrator.findById(mapping.assessment_administrator_id);
    const segments = await AssessmentSegment.findByAssessmentId(admin.assessment_id);
    
    const nextIndex = mapping.current_segment_index + 1;
    if (nextIndex >= segments.length) {
      return res.status(400).json({ error: 'No more segments' });
    }

    // Update current segment index
    await AssessmentUserMapping.updateSegmentIndex(mapping_id, nextIndex);

    // Get questions for next segment
    const nextSegment = segments[nextIndex];
    const questions = await getSegmentQuestions(nextSegment.id, mapping_id);

    // Mark current segment as completed in progress
    await AssessmentSegmentProgress.markSegmentCompleted(mapping_id, mapping.current_segment_index);

    res.json({
      segment_index: nextIndex,
      segment: nextSegment,
      questions,
      segment_duration: nextSegment.segment_duration,
      saved_answers: {}
    });
  } catch (error) {
    console.error('Error moving to next segment:', error);
    res.status(500).json({ error: 'Failed to move to next segment' });
  }
};

/**
 * Switch to a different segment
 */
const switchSegment = async (req, res) => {
  try {
    const { mapping_id } = req.params;
    const { segment_index } = req.body;

    const mapping = await AssessmentUserMapping.findById(mapping_id);
    if (!mapping) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    if (mapping.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (mapping.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Assessment is not in progress' });
    }

    // Get admin and check if segment switch is allowed
    const admin = await AssessmentAdministrator.findById(mapping.assessment_administrator_id);
    const segments = await AssessmentSegment.findByAssessmentId(admin.assessment_id);
    
    if (segment_index < 0 || segment_index >= segments.length) {
      return res.status(400).json({ error: 'Invalid segment index' });
    }

    // Check timing config for segment navigation restrictions
    const timingConfig = await TimingConfig.findByAdminId(mapping.assessment_administrator_id);
    
    // Update current segment index
    await AssessmentUserMapping.updateSegmentIndex(mapping_id, segment_index);

    // Get questions for the segment
    const targetSegment = segments[segment_index];
    const questions = await getSegmentQuestions(targetSegment.id, mapping_id);

    res.json({
      segment_index,
      segment: targetSegment,
      questions,
      segment_duration: targetSegment.segment_duration,
      saved_answers: {}
    });
  } catch (error) {
    console.error('Error switching segment:', error);
    res.status(500).json({ error: 'Failed to switch segment' });
  }
};

// Helper function to get segment questions
const getSegmentQuestions = async (segmentId, mappingId) => {
  // Get programming questions
  const [progQuestions] = await pool.execute(
    `SELECT pq.*, aspq.marks, aspq.order_index
     FROM assessment_segment_programming_questions aspq
     JOIN programming_questions pq ON aspq.programming_question_id = pq.id
     WHERE aspq.assessment_segment_id = ?
     ORDER BY aspq.order_index`,
    [segmentId]
  );

  // Get MCQ questions
  const [mcqQuestions] = await pool.execute(
    `SELECT mq.*, asmq.marks, asmq.order_index
     FROM assessment_segment_mcq_questions asmq
     JOIN mcq_questions mq ON asmq.mcq_question_id = mq.id
     WHERE asmq.assessment_segment_id = ?
     ORDER BY asmq.order_index`,
    [segmentId]
  );

  // Get MCQ options
  for (const q of mcqQuestions) {
    const [options] = await pool.execute(
      'SELECT * FROM mcq_options WHERE mcq_question_id = ? ORDER BY order_index',
      [q.id]
    );
    q.options = options;
  }

  // Get test cases for programming questions (only non-hidden for display)
  for (const q of progQuestions) {
    const [testCases] = await pool.execute(
      `SELECT id, input, expected_result, description, is_hidden, weight 
       FROM test_cases 
       WHERE programming_question_id = ? AND is_hidden = 0
       ORDER BY \`order\` ASC, id ASC`,
      [q.id]
    );
    q.test_cases = testCases.map(tc => ({
      id: tc.id,
      input: tc.input,
      expected_output: tc.expected_result,
      description: tc.description,
      points: tc.weight
    }));
  }

  // Combine and sort questions
  const allQuestions = [
    ...progQuestions.map(q => ({ ...q, type: 'PROGRAMMING', question_type: 'PROGRAMMING' })),
    ...mcqQuestions.map(q => ({ ...q, type: 'MCQ', question_type: 'MCQ' }))
  ].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

  return allQuestions;
};

// =====================================================
// RANDOM FETCH CRITERIA
// =====================================================

/**
 * Add random fetch criteria
 */
const addRandomFetchCriteria = async (req, res) => {
  try {
    const {
      assessment_segment_id,
      question_type,
      question_bank_id,
      total_questions,
      easy_count,
      medium_count,
      hard_count,
      topics,
      tags
    } = req.body;

    const id = await RandomFetchCriteria.create({
      assessment_segment_id,
      question_type,
      question_bank_id,
      total_questions,
      easy_count,
      medium_count,
      hard_count,
      topics,
      tags
    });

    res.status(201).json({
      message: 'Random fetch criteria added successfully',
      id
    });
  } catch (error) {
    console.error('Error adding random fetch criteria:', error);
    res.status(500).json({ error: 'Failed to add random fetch criteria' });
  }
};

/**
 * Get random fetch criteria for segment
 */
const getRandomFetchCriteria = async (req, res) => {
  try {
    const { segment_id } = req.params;
    const criteria = await RandomFetchCriteria.findBySegmentId(segment_id);
    res.json(criteria);
  } catch (error) {
    console.error('Error fetching random fetch criteria:', error);
    res.status(500).json({ error: 'Failed to fetch criteria' });
  }
};

/**
 * Update random fetch criteria
 */
const updateRandomFetchCriteria = async (req, res) => {
  try {
    const { id } = req.params;
    await RandomFetchCriteria.update(id, req.body);
    res.json({ message: 'Criteria updated successfully' });
  } catch (error) {
    console.error('Error updating random fetch criteria:', error);
    res.status(500).json({ error: 'Failed to update criteria' });
  }
};

/**
 * Delete random fetch criteria
 */
const deleteRandomFetchCriteria = async (req, res) => {
  try {
    const { id } = req.params;
    await RandomFetchCriteria.delete(id);
    res.json({ message: 'Criteria deleted successfully' });
  } catch (error) {
    console.error('Error deleting random fetch criteria:', error);
    res.status(500).json({ error: 'Failed to delete criteria' });
  }
};

module.exports = {
  // Assessment
  createAssessment,
  getAssessments,
  getAssessment,
  updateAssessment,
  deleteAssessment,
  updateAssessmentStatus,
  duplicateAssessment,
  
  // Segment
  createSegment,
  getSegments,
  getSegment,
  updateSegment,
  deleteSegment,
  reorderSegment,
  
  // Segment Questions
  addProgrammingQuestion,
  removeProgrammingQuestion,
  updateProgrammingQuestion,
  addMCQQuestion,
  removeMCQQuestion,
  updateMCQQuestion,
  
  // Administrator
  createAdministrator,
  getAdministrators,
  getAdministrator,
  updateAdministrator,
  updateAdministratorStatus,
  deleteAdministrator,
  
  // User Mapping
  inviteUsers,
  getUserMappings,
  getMyAssessments,
  getStartInfo,
  startAssessment,
  getAssessmentTake,
  getAssessmentQuestions,
  submitAssessment,
  updateProgress,
  logProctoringEvent,
  submitFeedback,
  getAssessmentResult,
  saveAnswer,
  saveProgress,
  submitCode,
  nextSegment,
  switchSegment,
  
  // Random Fetch Criteria
  addRandomFetchCriteria,
  getRandomFetchCriteria,
  updateRandomFetchCriteria,
  deleteRandomFetchCriteria
};

