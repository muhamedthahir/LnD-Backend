const Assessment = require('../models/Assessment');
const AssessmentSegment = require('../models/AssessmentSegment');
const AssessmentAdministrator = require('../models/AssessmentAdministrator');
const AssessmentUserMapping = require('../models/AssessmentUserMapping');
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
    const { segment_id, programming_question_id, weightage_override, is_mandatory } = req.body;

    const id = await SegmentProgrammingQuestion.add({
      assessment_segment_id: segment_id,
      programming_question_id,
      weightage_override,
      is_mandatory
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
    const { segment_id, mcq_question_id, weightage_override, is_mandatory } = req.body;

    const id = await SegmentMCQQuestion.add({
      assessment_segment_id: segment_id,
      mcq_question_id,
      weightage_override,
      is_mandatory
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
    const { event_type, metadata, segment_id } = req.body;

    await ProctoringLog.log({
      assessment_user_mapping_id: mapping_id,
      event_type,
      metadata,
      segment_id
    });

    // Handle tab switch
    if (event_type === 'TAB_SWITCH') {
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

    // Verify user or admin
    if (mapping.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get scoring config to check if results should be shown
    const scoringConfig = await ScoringConfig.findByAdminId(mapping.assessment_administrator_id);
    if (!scoringConfig?.show_score_at_end && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Results are not available' });
    }

    const segmentProgress = await AssessmentSegmentProgress.getByMappingId(mapping_id);
    const proctoringLogs = await ProctoringLog.getByMappingId(mapping_id);

    res.json({
      mapping,
      segment_progress: segmentProgress,
      proctoring_logs: proctoringLogs,
      show_correct_answers: scoringConfig?.show_correct_answers_after || false
    });
  } catch (error) {
    console.error('Error fetching assessment result:', error);
    res.status(500).json({ error: 'Failed to fetch result' });
  }
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
  addMCQQuestion,
  removeMCQQuestion,
  
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
  startAssessment,
  getAssessmentQuestions,
  submitAssessment,
  updateProgress,
  logProctoringEvent,
  submitFeedback,
  getAssessmentResult,
  
  // Random Fetch Criteria
  addRandomFetchCriteria,
  getRandomFetchCriteria,
  updateRandomFetchCriteria,
  deleteRandomFetchCriteria
};

