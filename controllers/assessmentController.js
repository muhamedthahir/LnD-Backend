const pool = require('../config/db');
const ExcelJS = require('exceljs');
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

const formatLabel = (value) => {
  if (!value) return '';
  return value
    .toString()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
};

// Option text may be authored as rich text (e.g. "<div>WME</div>"). Strip tags so
// the "Answer Given" cell shows clean text in reports / the result page.
const stripHtml = (value) =>
  typeof value === 'string' ? value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() : value;

const isBooleanLikeKey = (key) => /(enabled|enable|allow|is_|_required|mandatory|disable|auto_|random)/i.test(key);

// Basic IP allow-list check. `restriction` is a comma-separated list of IPs or prefixes
// (e.g. "203.0.113.4, 192.168.1."). Empty restriction means "allow all".
const isIpAllowed = (clientIp, restriction) => {
  if (!restriction || !String(restriction).trim()) return true;
  if (!clientIp) return false;
  // Normalize IPv4-mapped IPv6 (::ffff:127.0.0.1) to plain IPv4
  const ip = String(clientIp).replace(/^::ffff:/i, '').trim();
  return String(restriction)
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
    .some(entry => ip === entry || ip.startsWith(entry));
};

const formatDateTime = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (num) => num.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const formatDurationMinutes = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const totalSeconds = Number(value);
  if (Number.isNaN(totalSeconds)) return value;
  const totalMinutes = Math.ceil(totalSeconds / 60);
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
  }
  return `${totalMinutes}m`;
};

// Format a millisecond duration as MM:SS:mmm (minutes:seconds:milliseconds).
// Minutes are not capped at 60 so long durations stay readable (e.g. 75:04:200).
const formatDurationMs = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const totalMs = Number(value);
  if (Number.isNaN(totalMs)) return '';
  const ms = Math.max(0, Math.round(totalMs));
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  const pad = (n, len = 2) => n.toString().padStart(len, '0');
  return `${pad(minutes)}:${pad(seconds)}:${pad(millis, 3)}`;
};

const formatConfigValue = (key, value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if ((value === 0 || value === 1) && isBooleanLikeKey(key)) {
    return value === 1 ? 'Yes' : 'No';
  }
  if (/(date|time|timestamp)/i.test(key)) {
    return formatDateTime(value);
  }
  return value;
};

const appendConfigSection = (rows, title, config, sections) => {
  if (!config) return;
  const headerRow = rows.length;
  rows.push([title]);
  const startRow = rows.length;
  Object.entries(config).forEach(([key, value]) => {
    if (['id', 'assessment_administrator_id', 'created_at', 'last_updated_at'].includes(key)) {
      return;
    }
    rows.push([formatLabel(key), formatConfigValue(key, value)]);
  });
  const endRow = rows.length - 1;
  sections.push({ headerRow, startRow, endRow });
  rows.push([]);
};

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
    const { assessment_id, name, description, segment_duration, allow_back_navigation, is_locked, question_source, question_bank_id } = req.body;

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
      question_source,
      question_bank_id,
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
    const { name, description, segment_duration, allow_back_navigation, is_locked, negative_marking_enabled, question_source, question_bank_id } = req.body;

    await AssessmentSegment.update(id, {
      name,
      description,
      segment_duration,
      allow_back_navigation,
      is_locked,
      negative_marking_enabled,
      question_source,
      question_bank_id
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
 * Download assessment report (multi-sheet Excel)
 */
const downloadAssessmentReport = async (req, res) => {
  const { administrator_id } = req.params;

  try {
    const admin = await AssessmentAdministrator.findById(administrator_id);
    if (!admin) {
      return res.status(404).json({ error: 'Assessment administrator not found' });
    }

    const assessment = await Assessment.findById(admin.assessment_id);

    const [mappingRows] = await pool.execute(
      `SELECT aum.*,
              u.name as user_name,
              u.email as user_email,
              u.department as user_department,
              u.section as user_section,
              ud.mobile_number as user_phone,
              (
                SELECT COUNT(*)
                FROM assessment_user_mappings aum2
                WHERE aum2.assessment_administrator_id = aum.assessment_administrator_id
                  AND aum2.user_id = aum.user_id
              ) as attempts_taken
       FROM assessment_user_mappings aum
       JOIN users u ON aum.user_id = u.id
       LEFT JOIN user_details ud ON ud.user_id = u.id
       WHERE aum.assessment_administrator_id = ?
       ORDER BY u.name ASC`,
      [administrator_id]
    );

    const statusCounts = mappingRows.reduce(
      (acc, row) => {
        acc.total += 1;
        acc[row.status] = (acc[row.status] || 0) + 1;
        return acc;
      },
      { total: 0 }
    );

    const takenCount = ['IN_PROGRESS', 'COMPLETED', 'SUBMITTED', 'DISQUALIFIED']
      .reduce((sum, status) => sum + (statusCounts[status] || 0), 0);

    // Sheet 1: Assessment + Config details
    const sheet1Rows = [];
    const sections = [];

    const addSectionHeader = (title) => {
      const headerRow = sheet1Rows.length;
      sheet1Rows.push([title]);
      return headerRow;
    };

    const assessmentHeaderRow = addSectionHeader('Assessment Details');
    const assessmentStartRow = sheet1Rows.length;
    sheet1Rows.push(
      ['Assessment Title', assessment?.title || admin.assessment_title || ''],
      ['Assessment Unique ID', assessment?.unique_id || admin.assessment_unique_id || ''],
      ['Description', assessment?.description || ''],
      ['Institution', assessment?.institution_name || ''],
      ['Topic', assessment?.topic_name || '']
    );
    sections.push({
      headerRow: assessmentHeaderRow,
      startRow: assessmentStartRow,
      endRow: sheet1Rows.length - 1
    });
    sheet1Rows.push([]);

    const adminHeaderRow = addSectionHeader('Administrator Details');
    const adminStartRow = sheet1Rows.length;
    sheet1Rows.push(
      ['Display Name', admin.display_name || ''],
      ['Administrator Unique ID', admin.unique_id || ''],
      ['Status', admin.status || ''],
      ['Config Name', admin.config_name || ''],
      ['Category', admin.category_name || '']
    );
    sections.push({
      headerRow: adminHeaderRow,
      startRow: adminStartRow,
      endRow: sheet1Rows.length - 1
    });
    sheet1Rows.push([]);

    appendConfigSection(sheet1Rows, 'Timing Configuration', admin.timing_config, sections);
    appendConfigSection(sheet1Rows, 'Proctoring Configuration', admin.proctoring_config, sections);
    appendConfigSection(sheet1Rows, 'Scoring Configuration', admin.scoring_config, sections);
    appendConfigSection(sheet1Rows, 'Question Configuration', admin.question_config, sections);
    appendConfigSection(sheet1Rows, 'Access Configuration', admin.access_config, sections);

    const statusHeaderRow = addSectionHeader('User Status Summary');
    const statusStartRow = sheet1Rows.length;
    let notStartedCount = statusCounts.total - takenCount;
    sheet1Rows.push(
      ['Total Users', statusCounts.total || 0],
      ['Users Taken Assessment', takenCount],
      ['Users Not Started', notStartedCount || 0],
      ['Users In Progress', statusCounts.IN_PROGRESS || 0],
      ['Users Completed', statusCounts.COMPLETED || 0],
      ['Users Disqualified', statusCounts.DISQUALIFIED || 0]
    );
    sections.push({
      headerRow: statusHeaderRow,
      startRow: statusStartRow,
      endRow: sheet1Rows.length - 1
    });

    const workbook = new ExcelJS.Workbook();
    const sheet1 = workbook.addWorksheet('Assessment Summary');
    sheet1.columns = [{ width: 35 }, { width: 60 }];

    sheet1Rows.forEach(row => sheet1.addRow(row));

    const headerStyle = {
      font: { bold: true },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    };
    const detailStyle = {
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      }
    };

    sections.forEach(section => {
      const headerRowNumber = section.headerRow + 1;
      sheet1.mergeCells(`A${headerRowNumber}:B${headerRowNumber}`);
      const headerRow = sheet1.getRow(headerRowNumber);
      headerRow.getCell(1).style = headerStyle;
      headerRow.getCell(2).style = headerStyle;

      for (let rowIndex = section.startRow + 1; rowIndex <= section.endRow + 1; rowIndex += 1) {
        const row = sheet1.getRow(rowIndex);
        row.getCell(1).style = detailStyle;
        row.getCell(2).style = detailStyle;
      }
    });

    // Sheet 2: User details with segment/question columns.
    // For random-fetch segments each candidate is assigned a different (and usually
    // smaller) subset of the pool, so question columns are sized to the number of
    // questions a candidate actually answers — not the whole pool. Columns are
    // therefore positional (Q1, Q2, ...) and driven by user_question_assignments,
    // falling back to the segment's fixed question list for legacy data.
    const segments = await AssessmentSegment.getByAssessmentId(admin.assessment_id);
    const mappingIds = mappingRows.map(row => row.id);

    // Fallback question list per segment (used when a segment has no per-candidate
    // assignments recorded, e.g. legacy attempts or non-random/fixed segments).
    const poolListBySegment = {};
    for (const segment of segments) {
      const segmentWithQuestions = await AssessmentSegment.getWithQuestions(segment.id);
      poolListBySegment[segment.id] = [
        ...(segmentWithQuestions?.programming_questions || []).map(q => ({
          type: 'PROGRAMMING', qid: q.programming_question_id, name: q.name || 'Programming Question', weight: Number(q.weightage) || 1
        })),
        ...(segmentWithQuestions?.mcq_questions || []).map(q => ({
          type: 'MCQ', qid: q.mcq_question_id, name: q.name || 'MCQ Question', weight: Number(q.weightage) || 1
        }))
      ];
    }

    // Per-candidate assigned questions (ordered) + the number of question columns
    // each segment needs (the max questions answered by any candidate in it).
    const assignmentMap = {};               // `${mappingId}:${segmentId}` -> [{ type, qid }]
    const segmentsWithAssignments = new Set();
    const segmentSlotCount = {};            // segmentId -> question column count
    if (mappingIds.length > 0) {
      const [assignRows] = await pool.execute(
        `SELECT assessment_user_mapping_id, assessment_segment_id, question_type, question_id, weightage, sequence_order
         FROM user_question_assignments
         WHERE assessment_user_mapping_id IN (${mappingIds.map(() => '?').join(',')})
         ORDER BY assessment_segment_id, assessment_user_mapping_id, sequence_order, id`,
        mappingIds
      );
      assignRows.forEach(r => {
        const key = `${r.assessment_user_mapping_id}:${r.assessment_segment_id}`;
        (assignmentMap[key] = assignmentMap[key] || []).push({
          type: r.question_type,
          qid: r.question_id,
          weight: Number(r.weightage) || 1
        });
        segmentsWithAssignments.add(r.assessment_segment_id);
      });
      Object.entries(assignmentMap).forEach(([key, list]) => {
        const segId = Number(key.split(':')[1]);
        segmentSlotCount[segId] = Math.max(segmentSlotCount[segId] || 0, list.length);
      });
    }
    // Segments without per-candidate assignments fall back to the full pool size.
    segments.forEach(segment => {
      if (!segmentsWithAssignments.has(segment.id)) {
        segmentSlotCount[segment.id] = (poolListBySegment[segment.id] || []).length;
      }
    });

    // Ordered question list to render for a given candidate + segment.
    const getAssignedList = (mappingId, segmentId) =>
      assignmentMap[`${mappingId}:${segmentId}`] || poolListBySegment[segmentId] || [];

    const baseHeaders = [
      'Name',
      'Email',
      'Phone',
      'Department',
      'Section',
      'Status',
      'Score (%)',
      'Time Remaining',
      'Overall Time Taken (mm:ss:ms)',
      'Attempt Start Time',
      'Attempt End Time',
      'Refresh Violation Count',
      'Attempt Number',
      'Attempts Taken',
      'Segments Attempted'
    ];

    const headerRow1 = [...baseHeaders];
    const headerRow2 = baseHeaders.map(() => '');
    const merges = [];
    let currentCol = baseHeaders.length;

    baseHeaders.forEach((_, index) => {
      merges.push({ s: { r: 0, c: index }, e: { r: 1, c: index } });
    });

    segments.forEach(segment => {
      const segmentStartCol = currentCol;
      const slotCount = segmentSlotCount[segment.id] || 0;
      // Segment-level columns: existing time remaining + new time taken.
      headerRow1.push(segment.name);
      headerRow2.push('Segment Time Remaining');
      currentCol += 1;
      headerRow1.push(segment.name);
      headerRow2.push('Segment Time Taken (mm:ss:ms)');
      currentCol += 1;
      // Positional question columns (sized to how many questions a candidate answers).
      // Each slot has 4 columns (time taken, question statement, answer given, score).
      for (let slot = 1; slot <= slotCount; slot += 1) {
        const qNo = `Q${slot}`;
        const subLabels = [
          `${qNo} Time Taken (mm:ss:ms)`,
          `${qNo} Question Statement`,
          `${qNo} Answer Given`,
          `${qNo} Score`
        ];
        subLabels.forEach(label => {
          headerRow1.push(segment.name);
          headerRow2.push(label);
          currentCol += 1;
        });
      }
      // Merge the segment name across its whole block (always >= 2 segment columns).
      merges.push({
        s: { r: 0, c: segmentStartCol },
        e: { r: 0, c: currentCol - 1 }
      });
    });

    headerRow1.push('Total Score');
    headerRow2.push('');
    merges.push({ s: { r: 0, c: currentCol }, e: { r: 1, c: currentCol } });

    const segmentAttemptMap = {};
    const segmentTimeRemainingMap = {};
    const segmentTimeTakenMsMap = {};   // `${mappingId}:${segmentId}` -> ms actively spent on its questions
    const overallTimeTakenMsMap = {};   // mappingId -> total ms across all questions
    const mcqSubmissionMap = {};
    const programmingSubmissionMap = {};
    const optionTextMap = {};           // optionId -> option text (for "answer given")
    const optionOwnerMcq = {};          // optionId -> owning mcq_multiselect_questions.id
    const optionsByMcq = {};            // mcq.id -> Set(optionId) for that question
    const mcqMeta = {};                 // mcq.id -> { name, mcqId, baseId }
    const progMeta = {};                // programming_questions.id -> { name }
    // Candidate's MCQ answer attributed to the question it actually belongs to.
    // Answers are matched by the owning question of the selected option (globally
    // unique), so a row mis-stored under the wrong question id is still recovered.
    const mcqAnswerByOwner = {};        // `${mappingId}:${ownerMcqId}` -> { score, selected, time_ms }

    // Every MCQ / programming question id that can appear in a candidate's columns.
    const assignedMcqIds = new Set();
    const assignedProgIds = new Set();
    const collectQids = (list) => (list || []).forEach(a => {
      if (a.type === 'MCQ') assignedMcqIds.add(a.qid);
      else if (a.type === 'PROGRAMMING') assignedProgIds.add(a.qid);
    });
    Object.values(assignmentMap).forEach(collectQids);
    Object.values(poolListBySegment).forEach(collectQids);

    const addTimeTaken = (mappingId, segmentId, ms) => {
      const value = Number(ms) || 0;
      if (value <= 0) return;
      overallTimeTakenMsMap[mappingId] = (overallTimeTakenMsMap[mappingId] || 0) + value;
      if (segmentId !== null && segmentId !== undefined) {
        const key = `${mappingId}:${segmentId}`;
        segmentTimeTakenMsMap[key] = (segmentTimeTakenMsMap[key] || 0) + value;
      }
    };

    if (mappingIds.length > 0) {
      const [segmentCounts] = await pool.execute(
        `SELECT assessment_user_mapping_id, COUNT(DISTINCT assessment_segment_id) as segments_attempted
         FROM assessment_segment_progress
         WHERE assessment_user_mapping_id IN (${mappingIds.map(() => '?').join(',')})
           AND status != 'NOT_STARTED'
         GROUP BY assessment_user_mapping_id`,
        mappingIds
      );
      segmentCounts.forEach(row => {
        segmentAttemptMap[row.assessment_user_mapping_id] = row.segments_attempted;
      });

      const [segmentTimes] = await pool.execute(
        `SELECT assessment_user_mapping_id, assessment_segment_id, time_remaining
         FROM assessment_segment_progress
         WHERE assessment_user_mapping_id IN (${mappingIds.map(() => '?').join(',')})`,
        mappingIds
      );
      segmentTimes.forEach(row => {
        const key = `${row.assessment_user_mapping_id}:${row.assessment_segment_id}`;
        segmentTimeRemainingMap[key] = row.time_remaining ?? '';
      });

      const [mcqRows] = await pool.execute(
        `SELECT assessment_user_mapping_id, assessment_segment_id, mcq_question_id,
                best_score, time_taken_ms, last_selected_options
         FROM mcq_submissions
         WHERE assessment_user_mapping_id IN (${mappingIds.map(() => '?').join(',')})`,
        mappingIds
      );
      mcqRows.forEach(row => {
        const key = `${row.assessment_user_mapping_id}:${row.mcq_question_id}`;
        let selected = row.last_selected_options;
        if (typeof selected === 'string') {
          try { selected = JSON.parse(selected); } catch (e) { selected = []; }
        }
        mcqSubmissionMap[key] = {
          score: row.best_score,
          time_ms: row.time_taken_ms ?? 0,
          selected: Array.isArray(selected) ? selected : []
        };
        addTimeTaken(row.assessment_user_mapping_id, row.assessment_segment_id, row.time_taken_ms);
      });

      const [progRows] = await pool.execute(
        `SELECT assessment_user_mapping_id, assessment_segment_id, programming_question_id,
                best_score, best_test_cases_passed, test_cases_total, time_taken_ms,
                last_submitted_code, best_submitted_code
         FROM programming_submissions
         WHERE assessment_user_mapping_id IN (${mappingIds.map(() => '?').join(',')})`,
        mappingIds
      );
      progRows.forEach(row => {
        const key = `${row.assessment_user_mapping_id}:${row.programming_question_id}`;
        programmingSubmissionMap[key] = {
          score: row.best_score,
          passed: row.best_test_cases_passed ?? 0,
          total: row.test_cases_total ?? 0,
          time_ms: row.time_taken_ms ?? 0,
          code: row.best_submitted_code || row.last_submitted_code || ''
        };
        addTimeTaken(row.assessment_user_mapping_id, row.assessment_segment_id, row.time_taken_ms);
      });

      // Resolve MCQ statements. Assigned ids are always mcq_multiselect_questions.id,
      // so key strictly by mcq.id (keying by base id too caused collisions where one
      // question's base id equals another question's mcq id -> wrong statement/answer).
      if (assignedMcqIds.size > 0) {
        const ids = Array.from(assignedMcqIds);
        const placeholders = ids.map(() => '?').join(',');
        const [metaRows] = await pool.execute(
          `SELECT mq.id AS mcq_id, mq.question_id AS base_id, q.name
           FROM mcq_multiselect_questions mq
           JOIN questions q ON mq.question_id = q.id
           WHERE mq.id IN (${placeholders})`,
          ids
        );
        const mcqIds = new Set();
        metaRows.forEach(r => {
          mcqMeta[r.mcq_id] = { name: r.name, mcqId: r.mcq_id, baseId: r.base_id };
          mcqIds.add(r.mcq_id);
        });
        if (mcqIds.size > 0) {
          const optIds = Array.from(mcqIds);
          const [optionRows] = await pool.execute(
            `SELECT id, text, mcq_multiselect_question_id FROM options
             WHERE mcq_multiselect_question_id IN (${optIds.map(() => '?').join(',')})`,
            optIds
          );
          optionRows.forEach(o => {
            optionTextMap[o.id] = o.text;
            optionOwnerMcq[o.id] = o.mcq_multiselect_question_id;
            (optionsByMcq[o.mcq_multiselect_question_id] = optionsByMcq[o.mcq_multiselect_question_id] || new Set()).add(o.id);
          });
        }
      }

      // Resolve programming question statements.
      if (assignedProgIds.size > 0) {
        const ids = Array.from(assignedProgIds);
        const [metaRows] = await pool.execute(
          `SELECT pq.id AS pid, q.name
           FROM programming_questions pq
           JOIN questions q ON pq.question_id = q.id
           WHERE pq.id IN (${ids.map(() => '?').join(',')})`,
          ids
        );
        metaRows.forEach(r => { progMeta[r.pid] = { name: r.name }; });
      }

      // Attribute each MCQ answer to its real question via the owning question of the
      // selected option(s). This recovers answers that were stored under a different
      // question id and prevents an answer from being shown against the wrong question.
      Object.entries(mcqSubmissionMap).forEach(([key, sub]) => {
        const mappingId = key.split(':')[0];
        let owner = null;
        for (const oid of (sub.selected || [])) {
          if (optionOwnerMcq[oid] !== undefined) { owner = optionOwnerMcq[oid]; break; }
        }
        if (owner === null) return; // no identifiable selection (blank / attempted only)
        const ownerKey = `${mappingId}:${owner}`;
        const prev = mcqAnswerByOwner[ownerKey];
        if (!prev || (Number(sub.score) || 0) >= (Number(prev.score) || 0)) {
          mcqAnswerByOwner[ownerKey] = sub;
        }
      });
    }

    const sheet2Rows = [headerRow1, headerRow2];
    mappingRows.forEach(row => {
      const dataRow = [
        row.user_name || '',
        row.user_email || '',
        row.user_phone || 'NA',
        row.user_department || 'NA',
        row.user_section || 'NA',
        row.status || '',
        row.percentage_score !== null && row.percentage_score !== undefined
          ? Number(row.percentage_score)
          : '',
        formatDurationMinutes(row.time_remaining),
        formatDurationMs(overallTimeTakenMsMap[row.id]),
        formatDateTime(row.assessment_started_time),
        formatDateTime(row.assessment_ended_time || row.submitted_at),
        row.refresh_violation_count ?? 'NA',
        row.attempt_number ?? 'NA',
        row.attempts_taken || row.attempt_number || 1,
        segmentAttemptMap[row.id] || 0
      ];

      // Accumulate the overall score from the questions actually assigned to this
      // candidate so the totals always match the per-question scores shown (and never
      // exceed the max from stale/duplicate submission rows).
      let rowObtained = 0;
      let rowMax = 0;

      segments.forEach(segment => {
        const segmentKey = `${row.id}:${segment.id}`;
        dataRow.push(formatDurationMinutes(segmentTimeRemainingMap[segmentKey]));
        dataRow.push(formatDurationMs(segmentTimeTakenMsMap[segmentKey]));

        const slotCount = segmentSlotCount[segment.id] || 0;
        const assigned = getAssignedList(row.id, segment.id);
        for (let slot = 0; slot < slotCount; slot += 1) {
          const a = assigned[slot];
          // Candidate has no question in this positional slot (assigned fewer) -> blank.
          if (!a) { dataRow.push('', '', '', ''); continue; }

          rowMax += Number(a.weight) || 1;

          if (a.type === 'PROGRAMMING') {
            const submission = programmingSubmissionMap[`${row.id}:${a.qid}`];
            const progScore = submission && submission.score !== null && submission.score !== undefined
              ? Number(submission.score) : null;
            if (progScore !== null) rowObtained += progScore;
            // Time taken
            dataRow.push(submission ? formatDurationMs(submission.time_ms) : '');
            // Question statement
            dataRow.push(progMeta[a.qid]?.name || a.name || '');
            // Answer given (the submitted code)
            dataRow.push(submission?.code || '');
            // Score (with passed/total when available)
            if (submission && submission.total > 0) {
              const scoreValue = progScore !== null ? progScore.toFixed(2) : '0.00';
              dataRow.push(`${scoreValue} (${submission.passed}/${submission.total})`);
            } else if (progScore !== null) {
              dataRow.push(progScore.toFixed(2));
            } else {
              dataRow.push('');
            }
          } else {
            // MCQ: attribute the answer to this question via the owning question of the
            // selected option (robust to answers stored under a different question id).
            // Fall back to id-keyed lookup (covers attempted-but-blank rows).
            const meta = mcqMeta[a.qid] || {};
            const submission = mcqAnswerByOwner[`${row.id}:${a.qid}`]
              || mcqSubmissionMap[`${row.id}:${meta.baseId}`]
              || mcqSubmissionMap[`${row.id}:${a.qid}`];
            const optSet = optionsByMcq[a.qid];
            // Only show selected options that actually belong to this question.
            const validSelected = (submission?.selected || [])
              .filter(id => !optSet || optSet.has(Number(id)));
            const mcqScore = submission && submission.score !== null && submission.score !== undefined
              ? Number(submission.score) : null;
            if (mcqScore !== null) rowObtained += mcqScore;
            // Time taken
            dataRow.push(submission ? formatDurationMs(submission.time_ms) : '');
            // Question statement
            dataRow.push(meta.name || a.name || '');
            // Answer given (selected option text(s))
            dataRow.push(validSelected.length > 0
              ? validSelected.map(id => stripHtml(optionTextMap[id]) ?? id).join(', ')
              : '');
            // Score
            dataRow.push(mcqScore !== null ? mcqScore.toFixed(2) : '');
          }
        }
      });

      // Overwrite Score (%) and Total Score with values derived from the assigned
      // questions above so the report is internally consistent.
      const rowTotal = Math.max(0, rowObtained);
      dataRow[6] = rowMax > 0 ? parseFloat((rowTotal / rowMax * 100).toFixed(2)) : 0;
      dataRow.push(parseFloat(rowTotal.toFixed(2)));
      sheet2Rows.push(dataRow);
    });

    const sheet2 = workbook.addWorksheet('User Details');
    sheet2Rows.forEach(row => sheet2.addRow(row));

    merges.forEach(merge => {
      sheet2.mergeCells(
        merge.s.r + 1,
        merge.s.c + 1,
        merge.e.r + 1,
        merge.e.c + 1
      );
    });

    const sheet2HeaderStyle = {
      font: { bold: true },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      }
    };
    const sheet2CellStyle = {
      alignment: { horizontal: 'left', vertical: 'middle' },
      border: {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      }
    };
    const statusStyles = {
      DISQUALIFIED: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } } },
      COMPLETED: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } } },
      SUBMITTED: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } } },
      IN_PROGRESS: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } } }
    };

    sheet2.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.style = rowNumber <= 2 ? sheet2HeaderStyle : sheet2CellStyle;
      });
    });

    const statusColIndex = baseHeaders.indexOf('Status') + 1;
    if (statusColIndex > 0) {
      sheet2.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        if (rowNumber <= 2) return;
        const cell = row.getCell(statusColIndex);
        const statusStyle = statusStyles[cell.value];
        if (statusStyle) {
          cell.style = { ...sheet2CellStyle, ...statusStyle };
        }
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=assessment-report-${administrator_id}.xlsx`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Error generating assessment report:', error);
    res.status(500).json({ error: 'Failed to generate assessment report' });
  }
};

/**
 * Allow user to reattempt assessment
 */
const allowReattempt = async (req, res) => {
  try {
    const { mapping_id } = req.params;

    const mapping = await AssessmentUserMapping.findById(mapping_id);
    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    // Only allow reattempt for IN_PROGRESS, COMPLETED, SUBMITTED, or DISQUALIFIED
    if (!['IN_PROGRESS', 'COMPLETED', 'SUBMITTED', 'DISQUALIFIED'].includes(mapping.status)) {
      return res.status(400).json({ error: `Cannot allow reattempt for status: ${mapping.status}` });
    }

    const result = await AssessmentUserMapping.createReattempt(mapping_id);

    res.json({
      message: 'Reattempt allowed successfully',
      mapping_id: result.id,
      attempt_number: result.attempt_number
    });
  } catch (error) {
    console.error('Error allowing reattempt:', error);
    res.status(500).json({ error: error.message || 'Failed to allow reattempt' });
  }
};

/**
 * Refresh violation count for disqualified user
 */
const refreshViolation = async (req, res) => {
  try {
    const { mapping_id } = req.params;

    const mapping = await AssessmentUserMapping.findById(mapping_id);
    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    // Only allow refresh for DISQUALIFIED status
    if (mapping.status !== 'DISQUALIFIED') {
      return res.status(400).json({ error: `Can only refresh violation for DISQUALIFIED users. Current status: ${mapping.status}` });
    }

    const result = await AssessmentUserMapping.refreshViolation(mapping_id);

    res.json({
      message: 'Violation refreshed successfully. User can continue the assessment.',
      mapping_id: result.id,
      refresh_violation_count: result.refresh_violation_count,
      status: result.status
    });
  } catch (error) {
    console.error('Error refreshing violation:', error);
    res.status(500).json({ error: error.message || 'Failed to refresh violation' });
  }
};

/**
 * Delete user mapping
 */
const deleteUserMapping = async (req, res) => {
  try {
    const { mapping_id } = req.params;

    await AssessmentUserMapping.delete(mapping_id);
    res.json({ message: 'User mapping deleted successfully' });
  } catch (error) {
    console.error('Error deleting user mapping:', error);
    res.status(500).json({ error: 'Failed to delete user mapping' });
  }
};

/**
 * Send invitation to user
 */
const sendInvitation = async (req, res) => {
  try {
    const { mapping_id } = req.params;

    const mapping = await AssessmentUserMapping.findById(mapping_id);
    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    await AssessmentUserMapping.markMailSent(mapping_id);
    
    // TODO: Actually send email here
    
    res.json({ message: 'Invitation sent successfully' });
  } catch (error) {
    console.error('Error sending invitation:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
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
    const segmentQuestionCounts = {};
    if (admin.question_config?.fetch_random_question) {
      for (const segment of segments) {
        const criteria = await RandomFetchCriteria.findBySegmentId(segment.id);
        const segmentTotal = (criteria || []).reduce((sum, c) => sum + (c.total_questions || 0), 0);
        segmentQuestionCounts[segment.id] = segmentTotal;
        totalQuestions += segmentTotal;
      }
    } else {
      segments.forEach(segment => {
        const progCount = segment.programming_question_count || 0;
        const mcqCount = segment.mcq_question_count || 0;
        const segmentTotal = progCount + mcqCount;
        segmentQuestionCounts[segment.id] = segmentTotal;
        totalQuestions += segmentTotal;
      });
    }

    // Build response
    const response = {
      display_name: admin.display_name,
      assessment_title: admin.assessment_title,
      total_duration: admin.timing_config?.total_time || 0,
      timing_mode: admin.timing_config?.timing_mode || 'OVERALL',
      start_date_time: admin.timing_config?.start_date_time || null,
      end_date_time: admin.timing_config?.end_date_time || null,
      segment_count: segments.length,
      total_questions: totalQuestions,
      threshold_for_pass: admin.scoring_config?.threshold_for_pass || 40,
      threshold_type: admin.scoring_config?.threshold_type || 'PERCENTAGE',
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
      fetch_random_question: admin.question_config?.fetch_random_question || false,
      randomize_question_to_users: admin.question_config?.randomize_question_to_users || false,
      allow_resume: admin.access_config?.allow_resume !== false, // Default true
      resume_window_minutes: admin.access_config?.resume_window_minutes || 30,
      max_attempts: admin.access_config?.max_attempts || 1,
      ip_restriction: admin.access_config?.ip_restriction || null,
      segments: segments.map(segment => ({
        id: segment.id,
        name: segment.name,
        segment_duration: segment.segment_duration,
        question_count: segmentQuestionCounts[segment.id] || 0
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

    // Enforce IP restriction if configured
    const clientIp = req.ip || req.connection?.remoteAddress;
    if (!isIpAllowed(clientIp, accessConfig?.ip_restriction)) {
      return res.status(403).json({ error: 'Access from your network is not allowed for this assessment' });
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
        // Enforce IP restriction on auto-start as well
        const accessConfigForIp = await AccessConfig.findByAdminId(mapping.assessment_administrator_id);
        const clientIp = req.ip || req.connection?.remoteAddress;
        if (!isIpAllowed(clientIp, accessConfigForIp?.ip_restriction)) {
          return res.status(403).json({ error: 'Access from your network is not allowed for this assessment' });
        }
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

          let mcqOptions = optionRows.map(opt => ({
            id: opt.id,
            value: opt.id,
            text: opt.option_text
          }));
          // Hardening: shuffle option order per candidate so a shared screen/answer key
          // (e.g. "the answer is option B") isn't reusable across students.
          if (config.shuffle_options_in_mcq) {
            mcqOptions = seededShuffle(mcqOptions, `${mapping_id}-${mqRows[0].id}`);
          }

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
            options: mcqOptions
          });
        }
      }
    }

    // Get saved answers
    const savedAnswers = questionAssignments; // Use the same query result

    // Calculate time remaining
    const startTime = new Date(mapping.assessment_started_time);
    const now = new Date();
    const totalDuration = admin.timing_config?.total_time || 0;
    const startMs = startTime.getTime();
    const elapsedSeconds = Number.isFinite(startMs) ? Math.floor((now - startTime) / 1000) : 0;
    const timeRemaining = Math.max(0, totalDuration - elapsedSeconds);

    // Server-side backstop for auto-submit on timeout. If the overall wall-clock limit
    // (plus any grace period) has passed and the config requests auto-submit, finalize the
    // attempt server-side so a candidate cannot keep working by ignoring the client timer.
    const autoSubmitOnTimeout = admin.timing_config?.auto_submit_on_timeout !== false; // default true
    const gracePeriodSeconds = admin.timing_config?.grace_period_seconds || 0;
    if (autoSubmitOnTimeout && totalDuration > 0 && elapsedSeconds > (totalDuration + gracePeriodSeconds)) {
      try {
        const submitResult = await AssessmentUserMapping.submitAssessment(mapping_id);
        return res.json({
          auto_submitted: true,
          message: 'Time has expired; the assessment was automatically submitted.',
          result: submitResult
        });
      } catch (e) {
        console.error('Auto-submit on timeout failed:', e);
      }
    }

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
      answersMap = await UserQuestionAssignment.getSavedAnswers(mapping_id, currentSegment.id);
    } catch (e) {
      console.log('No saved answers found or table not exists');
    }

    const hasSavedTime = mapping.time_remaining > 0;
    const hasSavedSegmentTime = mapping.segment_time_remaining > 0;

    // Prefer saved remaining time when available (never exceed computed time)
    const actualTimeRemaining = hasSavedTime
      ? Math.min(mapping.time_remaining, timeRemaining || mapping.time_remaining)
      : timeRemaining;

    const actualSegmentTimeRemaining = hasSavedSegmentTime
      ? Math.min(mapping.segment_time_remaining, segmentTimeRemaining || mapping.segment_time_remaining)
      : segmentTimeRemaining;

    // Check if this is a resume
    const isResume =
      (hasSavedTime && mapping.time_remaining < totalDuration) ||
      (hasSavedSegmentTime && currentSegment?.segment_duration && mapping.segment_time_remaining < currentSegment.segment_duration);

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
      allow_segment_switch: admin.proctoring_config?.allow_segment_switch ?? true,
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

    // Get proctoring config for max_tab_switch_allowed
    const proctoringConfig = await ProctoringConfig.findByAdminId(mapping.assessment_administrator_id);
    const maxTabSwitchAllowed = proctoringConfig?.max_tab_switch_allowed ?? -1;

    // Get segment names for proctoring logs
    const admin = await AssessmentAdministrator.findById(mapping.assessment_administrator_id);
    const segments = await AssessmentSegment.getByAssessmentId(admin?.assessment_id);
    const segmentMap = {};
    segments.forEach(s => { segmentMap[s.id] = s.name; });

    // Enhance proctoring logs with segment names
    const enhancedProctoringLogs = proctoringLogs.map(log => ({
      ...log,
      segment_name: log.segment_id ? segmentMap[log.segment_id] || 'Unknown' : null,
      violation_cycle: log.metadata?.violation_cycle || mapping.refresh_violation_count || 1
    }));

    // Calculate total violations:
    // total = current_count + maxAllowed * (refresh_violation_count - 1)
    const currentViolationCount = mapping.tab_switch_count || 0;
    const refreshViolationCount = mapping.refresh_violation_count || 1;
    const totalViolations = maxTabSwitchAllowed >= 0 
      ? currentViolationCount + (maxTabSwitchAllowed * (refreshViolationCount - 1))
      : currentViolationCount;

    // Attribute each MCQ answer to the question it actually belongs to using the owning
    // question of the selected option (option ids are globally unique). This recovers
    // answers that were stored under a different question id and keeps the per-question
    // scores/answers consistent with the downloadable report.
    const [allMcqSubs] = await pool.execute(
      'SELECT mcq_question_id, best_score, last_selected_options FROM mcq_submissions WHERE assessment_user_mapping_id = ?',
      [mapping_id]
    );
    const allOptionIds = new Set();
    const parsedMcqSubs = allMcqSubs.map(s => {
      let sel = s.last_selected_options;
      if (typeof sel === 'string') { try { sel = JSON.parse(sel); } catch (e) { sel = []; } }
      sel = Array.isArray(sel) ? sel.map(Number).filter(n => !isNaN(n)) : [];
      sel.forEach(id => allOptionIds.add(id));
      return { ...s, sel };
    });
    const ownerByOpt = {};
    const optTextById = {};
    if (allOptionIds.size > 0) {
      const ids = Array.from(allOptionIds);
      const [orows] = await pool.execute(
        `SELECT id, text, mcq_multiselect_question_id FROM options WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids
      );
      orows.forEach(o => { ownerByOpt[o.id] = o.mcq_multiselect_question_id; optTextById[o.id] = o.text; });
    }
    const mcqByOwner = {}; // owning mcq.id -> { best_score, sel }
    parsedMcqSubs.forEach(s => {
      let owner = null;
      for (const oid of s.sel) { if (ownerByOpt[oid] !== undefined) { owner = ownerByOpt[oid]; break; } }
      if (owner === null) return;
      const prev = mcqByOwner[owner];
      if (!prev || (Number(s.best_score) || 0) >= (Number(prev.best_score) || 0)) mcqByOwner[owner] = s;
    });

    // Enhance segment progress with detailed question data
    const detailedSegmentProgress = await Promise.all(segmentProgress.map(async (segment) => {
      // Get questions assigned to this user for this segment
      const questions = await UserQuestionAssignment.getByMappingAndSegment(mapping_id, segment.assessment_segment_id);
      
      // Get submissions for these questions
      const enhancedQuestions = await Promise.all(questions.map(async (q) => {
        if (q.question_type === 'PROGRAMMING') {
          const submission = await ProgrammingSubmission.findByAssessmentAndQuestion(mapping_id, q.question_id);
          return {
            ...q,
            is_attempted: !!submission,
            submitted_code: submission?.best_submitted_code,
            language_used: submission?.language_used,
            test_cases_passed: submission?.best_test_cases_passed,
            test_cases_total: submission?.test_cases_total,
            user_answer: null,
            score: submission?.best_score || 0
          };
        }

        // MCQ: prefer the answer attributed by option ownership; fall back to an
        // id-keyed lookup (covers attempted-but-unanswered rows).
        const owned = mcqByOwner[q.question_id];
        let selIds = owned ? owned.sel : [];
        let score = owned ? owned.best_score : null;
        let attempted = !!owned;
        if (!owned) {
          const resolvedQuestionId = await MCQSubmission.resolveQuestionId(q.question_id);
          const [subRows] = await pool.execute(
            `SELECT * FROM mcq_submissions
             WHERE assessment_user_mapping_id = ? AND mcq_question_id IN (?, ?)
             ORDER BY best_score DESC, last_answered_at DESC, id DESC
             LIMIT 1`,
            [mapping_id, resolvedQuestionId, q.question_id]
          );
          const sub = subRows[0] || null;
          if (sub) {
            attempted = true;
            score = sub.best_score;
            let sel = sub.last_selected_options;
            if (typeof sel === 'string') { try { sel = JSON.parse(sel); } catch (e) { sel = []; } }
            selIds = Array.isArray(sel) ? sel.map(Number).filter(n => !isNaN(n)) : [];
          }
        }

        return {
          ...q,
          is_attempted: attempted,
          user_answer: selIds.length ? selIds.map(id => stripHtml(optTextById[id]) ?? id).join(', ') : null,
          score: Number(score) || 0
        };
      }));

      // Derive the segment totals from the questions actually assigned to this
      // candidate so the per-question scores always add up to the segment score
      // (stale/duplicate submission rows from other question sets are ignored).
      const segObtained = enhancedQuestions.reduce((sum, q) => sum + (Number(q.score) || 0), 0);
      const segMax = enhancedQuestions.reduce((sum, q) => sum + (Number(q.weightage) || 1), 0);
      const segAttempted = enhancedQuestions.filter(q => q.is_attempted).length;

      return {
        ...segment,
        score: segObtained,
        max_score: segMax,
        attempted_questions: segAttempted,
        total_questions: enhancedQuestions.length,
        questions: enhancedQuestions
      };
    }));

    // Keep the overall score consistent with the (assigned) per-segment scores above.
    const derivedTotalScore = detailedSegmentProgress.reduce((sum, seg) => sum + (Number(seg.score) || 0), 0);
    const derivedMaxScore = detailedSegmentProgress.reduce((sum, seg) => sum + (Number(seg.max_score) || 0), 0);
    const derivedPercentage = derivedMaxScore > 0 ? (derivedTotalScore / derivedMaxScore * 100) : 0;

    res.json({
      mapping: {
        ...mapping,
        total_score: derivedTotalScore,
        percentage_score: parseFloat(derivedPercentage.toFixed(2)),
        refresh_violation_count: refreshViolationCount,
        total_violations: totalViolations
      },
      segment_progress: detailedSegmentProgress,
      proctoring_logs: enhancedProctoringLogs,
      proctoring_summary: {
        current_tab_switch_count: currentViolationCount,
        refresh_violation_count: refreshViolationCount,
        max_tab_switch_allowed: maxTabSwitchAllowed,
        total_violations: totalViolations
      },
      show_correct_answers: scoringConfig?.show_correct_answers_after || false
    });
  } catch (error) {
    console.error('Error fetching assessment result:', error);
    res.status(500).json({ error: 'Failed to fetch result' });
  }
};

/**
 * Increment resume count when user continues an in-progress assessment
 */
const incrementResumeCount = async (req, res) => {
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

    // Enforce resume policy from access config
    const accessConfig = await AccessConfig.findByAdminId(mapping.assessment_administrator_id);
    if (accessConfig && accessConfig.allow_resume === false) {
      return res.status(403).json({ error: 'Resume is not allowed for this assessment' });
    }
    if (accessConfig?.allow_resume !== false && mapping.last_activity_at) {
      const resumeWindow = accessConfig?.resume_window_minutes || 30;
      const minutesSinceLastActivity = (Date.now() - new Date(mapping.last_activity_at).getTime()) / (1000 * 60);
      if (minutesSinceLastActivity > resumeWindow) {
        await AssessmentUserMapping.updateStatus(mapping_id, 'ABANDONED');
        return res.status(403).json({ error: 'Resume window has expired' });
      }
    }

    await AssessmentUserMapping.resume(mapping_id);
    res.json({ message: 'Resume count updated' });
  } catch (error) {
    console.error('Error incrementing resume count:', error);
    res.status(500).json({ error: 'Failed to update resume count' });
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
    let timeToSolve = null; // configured expected time for this question (seconds), if any

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
        `SELECT q.points, q.time_to_solve, smq.positive_marks, smq.negative_marks
         FROM mcq_multiselect_questions mq
         JOIN questions q ON mq.question_id = q.id
         LEFT JOIN segment_mcq_questions smq ON smq.mcq_question_id = mq.id
         WHERE mq.id = ?
         LIMIT 1`,
        [question_id]
      );
      
      const marks = questionInfo[0]?.positive_marks || questionInfo[0]?.points || 1;
      const negativeMarks = questionInfo[0]?.negative_marks || 0;
      timeToSolve = questionInfo[0]?.time_to_solve ?? null;

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
      const [mcqRows] = await pool.execute(
        `SELECT id, question_id
         FROM mcq_multiselect_questions
         WHERE id = ? OR question_id = ?
         LIMIT 1`,
        [question_id, question_id]
      );
      const mcqId = mcqRows[0]?.id;

      const [correctOpts] = await pool.execute(
        `SELECT id FROM options WHERE mcq_multiselect_question_id = ? AND is_correct = 1`,
        [mcqId || question_id]
      );
      correctOptions = correctOpts.map(o => o.id);
    }

    // Save or update the answer in mcq_submissions table
    if (question_type === 'MCQ') {
      const [mcqRows] = await pool.execute(
        `SELECT id, question_id
         FROM mcq_multiselect_questions
         WHERE id = ?
         LIMIT 1`,
        [question_id]
      );
      const resolvedQuestionId = mcqRows[0]?.question_id || question_id;
      await MCQSubmission.createOrUpdateForAssessment({
        user_id: req.user.id,
        assessment_user_mapping_id: mapping_id,
        assessment_segment_id: segment_id,
        mcq_question_id: resolvedQuestionId,
        selected_options: Array.isArray(answer) ? answer : (answer?.selected_options || [answer]),
        correct_options: correctOptions,
        is_correct: isCorrect,
        score: score || 0, // Score is 0 to 1
        max_score: 1
      });

      // Accumulate millisecond-precision time spent on this question (sent as a
      // delta by the client). Resume-safe because we add to the running total.
      const deltaMs = Number(req.body.time_taken_ms);
      if (Number.isFinite(deltaMs) && deltaMs > 0) {
        try {
          await pool.execute(
            `UPDATE mcq_submissions
             SET time_taken_ms = COALESCE(time_taken_ms, 0) + ?
             WHERE assessment_user_mapping_id = ? AND mcq_question_id = ?`,
            [Math.round(deltaMs), mapping_id, resolvedQuestionId]
          );
        } catch (e) {
          // Legacy DB without time_taken_ms column; ignore so answer saving still works.
        }
      }
    }

    // Update segment score from all submissions
    let segmentScore = null;
    let mappingScore = null;
    if (segment_id) {
      segmentScore = await AssessmentSegmentProgress.updateSegmentScore(mapping_id, segment_id);
      // Cascade: update mapping total score from all segment scores
      mappingScore = await AssessmentSegmentProgress.updateMappingTotalScore(mapping_id);
    }

    // ANOMALY DETECTION: flag suspiciously fast correct answers in the proctoring log.
    // A candidate reading answers from DevTools / an AI overlay (without ever losing focus,
    // so client-side proctoring never fires) tends to submit correct answers almost
    // instantly. We measure the gap since the previous answer save (a clean per-question
    // timing signal, see last_answer_saved_at) and log a RAPID_ANSWER event when a CORRECT
    // answer arrives faster than a human plausibly could. This never blocks the candidate or
    // leaks anything to the client — it is purely a server-side flag for reviewers.
    //
    // The threshold is derived from each question's configured `time_to_solve` (the expected
    // time budget set by the author) rather than a single flat number: answering correctly in
    // a tiny fraction of the allotted time is the real signal. We only fall back to a flat
    // value for questions that have no time_to_solve configured.
    if (question_type === 'MCQ' && isCorrect === true) {
      const SUSPICIOUS_FRACTION = 0.15;          // <15% of allotted time => suspicious
      const MIN_THRESHOLD_SECONDS = 2;           // floor so tiny budgets don't yield ~0s
      const FALLBACK_THRESHOLD_SECONDS = 3;      // used when time_to_solve isn't configured
      const usingTimeToSolve = Number.isFinite(timeToSolve) && timeToSolve > 0;
      const thresholdSeconds = usingTimeToSolve
        ? Math.max(MIN_THRESHOLD_SECONDS, Math.round(timeToSolve * SUSPICIOUS_FRACTION))
        : FALLBACK_THRESHOLD_SECONDS;
      try {
        const [timeRows] = await pool.execute(
          `SELECT TIMESTAMPDIFF(SECOND, COALESCE(last_answer_saved_at, assessment_started_time), NOW()) AS seconds_spent
           FROM assessment_user_mappings WHERE id = ?`,
          [mapping_id]
        );
        const secondsSpent = timeRows[0]?.seconds_spent;
        if (secondsSpent !== null && secondsSpent !== undefined && secondsSpent <= thresholdSeconds) {
          await ProctoringLog.log({
            assessment_user_mapping_id: mapping_id,
            event_type: 'RAPID_ANSWER',
            segment_id,
            metadata: {
              question_id,
              question_type,
              is_correct: true,
              seconds_spent: secondsSpent,
              threshold_seconds: thresholdSeconds,
              time_to_solve: usingTimeToSolve ? timeToSolve : null,
              basis: usingTimeToSolve ? 'time_to_solve' : 'fallback',
              reason: usingTimeToSolve
                ? `Correct answer submitted in under ${Math.round(SUSPICIOUS_FRACTION * 100)}% of the allotted time`
                : 'Correct answer submitted faster than humanly plausible'
            }
          });
        }
      } catch (anomalyErr) {
        // Anomaly detection must never break answer saving (e.g. legacy table without the
        // last_answer_saved_at column). Log and continue.
        console.error('Rapid-answer anomaly check failed:', anomalyErr);
      }
    }

    // Record when this answer was saved, used to time the NEXT question. Kept separate from
    // last_activity_at so periodic progress pings don't pollute the per-question timing.
    try {
      await pool.execute(
        `UPDATE assessment_user_mappings SET last_answer_saved_at = NOW() WHERE id = ?`,
        [mapping_id]
      );
    } catch (e) { /* legacy table without column; safe to ignore */ }

    // Update mapping last activity
    await AssessmentUserMapping.updateActivity(mapping_id, {});

    // SECURITY: Do NOT return correctness or running score to the candidate during a live attempt.
    // Returning is_correct/score lets a student read the Network tab in DevTools and brute-force
    // answers in real time (no focus change, so client-side proctoring never fires). Scores are
    // still computed and persisted server-side above; results are revealed only after submission
    // (and only if the assessment is configured to show them).
    res.json({ message: 'Answer saved' });
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

      // Derive attempted_questions from submission records (do NOT increment on submit)
      // attempted_questions = (#MCQ submissions + #Programming submissions) for this mapping+segment
      const [mcqCountRows] = await pool.execute(
        `SELECT COUNT(*) as cnt
         FROM mcq_submissions
         WHERE assessment_user_mapping_id = ? AND assessment_segment_id = ?`,
        [mapping_id, actualSegmentId]
      );
      const [progCountRows] = await pool.execute(
        `SELECT COUNT(*) as cnt
         FROM programming_submissions
         WHERE assessment_user_mapping_id = ? AND assessment_segment_id = ?`,
        [mapping_id, actualSegmentId]
      );

      const attemptedQuestions =
        (parseInt(mcqCountRows?.[0]?.cnt, 10) || 0) +
        (parseInt(progCountRows?.[0]?.cnt, 10) || 0);

      await AssessmentSegmentProgress.updateProgressByMappingAndSegment(mapping_id, actualSegmentId, {
        attempted_questions: attemptedQuestions
      });
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

    // Accumulate millisecond-precision time spent on this question (client sends a delta).
    const deltaMs = Number(req.body.time_taken_ms);
    if (Number.isFinite(deltaMs) && deltaMs > 0) {
      try {
        await pool.execute(
          `UPDATE programming_submissions
           SET time_taken_ms = COALESCE(time_taken_ms, 0) + ?
           WHERE assessment_user_mapping_id = ? AND programming_question_id = ?`,
          [Math.round(deltaMs), mapping_id, question_id]
        );
      } catch (e) {
        // Legacy DB without time_taken_ms column; ignore.
      }
    }

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
    const segments = await AssessmentSegment.getByAssessmentId(admin.assessment_id);
    
    if (segment_index < 0 || segment_index >= segments.length) {
      return res.status(400).json({ error: 'Invalid segment index' });
    }

    // Enforce inter-segment navigation policy. When disabled, candidates cannot jump
    // between segments (segments lock once completed; forward progress uses "next segment").
    const proctoringConfig = await ProctoringConfig.findByAdminId(mapping.assessment_administrator_id);
    const allowSegmentSwitch = proctoringConfig?.allow_segment_switch !== false; // default true
    if (!allowSegmentSwitch && Number(segment_index) !== Number(mapping.current_segment_index)) {
      return res.status(403).json({ error: 'Segment navigation is disabled for this assessment' });
    }

    // Update current segment index
    await AssessmentUserMapping.updateSegmentIndex(mapping_id, segment_index);

    // Get questions for the segment
    const targetSegment = segments[segment_index];
    const questions = await getSegmentQuestions(targetSegment.id, mapping_id);

    // If segment was already started/completed, restore saved answers and time remaining
    const progress = await AssessmentSegmentProgress.findByMappingAndSegment(mapping_id, targetSegment.id);
    const hasTakenSegment = progress && progress.status !== 'NOT_STARTED';
    const savedAnswers = hasTakenSegment
      ? await UserQuestionAssignment.getSavedAnswers(mapping_id, targetSegment.id)
      : {};
    const segmentTimeRemaining = hasTakenSegment
      ? (progress.time_remaining ?? 0)
      : targetSegment.segment_duration;

    res.json({
      segment_index,
      segment: targetSegment,
      questions,
      segment_duration: targetSegment.segment_duration,
      segment_time_remaining: segmentTimeRemaining,
      saved_answers: savedAnswers
    });
  } catch (error) {
    console.error('Error switching segment:', error);
    res.status(500).json({ error: 'Failed to switch segment' });
  }
};


// Deterministic seeded shuffle: stable per (user attempt + question) so a candidate sees a
// consistent order across reloads/resumes, but different candidates get different orders.
// MCQ answers are stored/scored by option id, so reordering the display is always safe.
const seededShuffle = (array, seedStr) => {
  const arr = [...array];
  // xmur3 string hash -> 32-bit seed
  let h = 1779033703 ^ String(seedStr).length;
  for (let i = 0; i < String(seedStr).length; i++) {
    h = Math.imul(h ^ String(seedStr).charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let seed = (h ^= h >>> 16) >>> 0;
  // mulberry32 PRNG
  const rand = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// Helper function to get segment questions
const getSegmentQuestions = async (segmentId, mappingId) => {
  const assignments = await UserQuestionAssignment.getByMappingAndSegment(mappingId, segmentId);
  const questions = [];

  // Load whether MCQ options should be shuffled for this assessment
  let shuffleOptionsInMcq = false;
  try {
    const [cfgRows] = await pool.execute(
      `SELECT qc.shuffle_options_in_mcq
       FROM question_configs qc
       JOIN assessment_user_mappings aum ON aum.assessment_administrator_id = qc.assessment_administrator_id
       WHERE aum.id = ?`,
      [mappingId]
    );
    shuffleOptionsInMcq = !!(cfgRows[0] && cfgRows[0].shuffle_options_in_mcq);
  } catch (e) {
    shuffleOptionsInMcq = false;
  }

  for (const assignment of assignments) {
    if (assignment.question_type === 'PROGRAMMING') {
      const [pqRows] = await pool.execute(
        `SELECT pq.*, q.name, q.description, q.points
         FROM programming_questions pq
         JOIN questions q ON pq.question_id = q.id
         WHERE pq.id = ?`,
        [assignment.question_id]
      );

      if (pqRows[0]) {
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
        [segmentId, assignment.question_id]
      );

      if (mqRows[0]) {
        const [optionRows] = await pool.execute(
          `SELECT id, text as option_text, \`order\`
           FROM options
           WHERE mcq_multiselect_question_id = ?
           ORDER BY \`order\` ASC`,
          [mqRows[0].id]
        );

        let mcqOptions = optionRows.map(opt => ({
          id: opt.id,
          value: opt.id,
          text: opt.option_text
        }));
        if (shuffleOptionsInMcq) {
          mcqOptions = seededShuffle(mcqOptions, `${mappingId}-${mqRows[0].id}`);
        }

        questions.push({
          ...mqRows[0],
          question_type: 'MCQ',
          mcq_question_id: mqRows[0].id,
          question_text: mqRows[0].name || mqRows[0].description,
          sequence_order: assignment.sequence_order,
          weightage: assignment.weightage,
          options: mcqOptions
        });
      }
    }
  }

  return questions;
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
  downloadAssessmentReport,
  allowReattempt,
  refreshViolation,
  deleteUserMapping,
  sendInvitation,
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
  incrementResumeCount,
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

