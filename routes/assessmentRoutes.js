const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const assessmentController = require('../controllers/assessmentController');

// =====================================================
// ADMIN ROUTES - Assessment Management
// =====================================================

// Assessment CRUD
router.post('/assessments', authenticateToken, requireAdmin, assessmentController.createAssessment);
router.get('/assessments', authenticateToken, requireAdmin, assessmentController.getAssessments);
router.get('/assessments/:id', authenticateToken, requireAdmin, assessmentController.getAssessment);
router.put('/assessments/:id', authenticateToken, requireAdmin, assessmentController.updateAssessment);
router.delete('/assessments/:id', authenticateToken, requireAdmin, assessmentController.deleteAssessment);
router.patch('/assessments/:id/status', authenticateToken, requireAdmin, assessmentController.updateAssessmentStatus);
router.post('/assessments/:id/duplicate', authenticateToken, requireAdmin, assessmentController.duplicateAssessment);

// Segment CRUD
router.post('/segments', authenticateToken, requireAdmin, assessmentController.createSegment);
router.get('/assessments/:assessment_id/segments', authenticateToken, requireAdmin, assessmentController.getSegments);
router.get('/segments/:id', authenticateToken, requireAdmin, assessmentController.getSegment);
router.put('/segments/:id', authenticateToken, requireAdmin, assessmentController.updateSegment);
router.delete('/segments/:id', authenticateToken, requireAdmin, assessmentController.deleteSegment);
router.patch('/segments/:id/reorder', authenticateToken, requireAdmin, assessmentController.reorderSegment);

// Segment Questions
router.post('/segments/programming-questions', authenticateToken, requireAdmin, assessmentController.addProgrammingQuestion);
router.delete('/segments/:segment_id/programming-questions/:question_id', authenticateToken, requireAdmin, assessmentController.removeProgrammingQuestion);
router.post('/segments/mcq-questions', authenticateToken, requireAdmin, assessmentController.addMCQQuestion);
router.delete('/segments/:segment_id/mcq-questions/:question_id', authenticateToken, requireAdmin, assessmentController.removeMCQQuestion);

// Random Fetch Criteria
router.post('/random-fetch-criteria', authenticateToken, requireAdmin, assessmentController.addRandomFetchCriteria);
router.get('/segments/:segment_id/random-fetch-criteria', authenticateToken, requireAdmin, assessmentController.getRandomFetchCriteria);
router.put('/random-fetch-criteria/:id', authenticateToken, requireAdmin, assessmentController.updateRandomFetchCriteria);
router.delete('/random-fetch-criteria/:id', authenticateToken, requireAdmin, assessmentController.deleteRandomFetchCriteria);

// Administrator Configuration CRUD
router.post('/administrators', authenticateToken, requireAdmin, assessmentController.createAdministrator);
router.get('/assessments/:assessment_id/administrators', authenticateToken, requireAdmin, assessmentController.getAdministrators);
router.get('/administrators/:id', authenticateToken, requireAdmin, assessmentController.getAdministrator);
router.put('/administrators/:id', authenticateToken, requireAdmin, assessmentController.updateAdministrator);
router.patch('/administrators/:id/status', authenticateToken, requireAdmin, assessmentController.updateAdministratorStatus);
router.delete('/administrators/:id', authenticateToken, requireAdmin, assessmentController.deleteAdministrator);

// User Mapping (Admin)
router.post('/administrators/invite', authenticateToken, requireAdmin, assessmentController.inviteUsers);
router.get('/administrators/:administrator_id/users', authenticateToken, requireAdmin, assessmentController.getUserMappings);
router.get('/mappings/:mapping_id/result', authenticateToken, assessmentController.getAssessmentResult);

// =====================================================
// USER ROUTES - Assessment Taking
// =====================================================

// My Assessments
router.get('/my-assessments', authenticateToken, assessmentController.getMyAssessments);

// Start Assessment
router.post('/take/:mapping_id/start', authenticateToken, assessmentController.startAssessment);

// Get Questions for a Segment
router.get('/take/:mapping_id/segments/:segment_id/questions', authenticateToken, assessmentController.getAssessmentQuestions);

// Update Progress
router.patch('/take/:mapping_id/progress', authenticateToken, assessmentController.updateProgress);

// Log Proctoring Event
router.post('/take/:mapping_id/proctoring', authenticateToken, assessmentController.logProctoringEvent);

// Submit Assessment
router.post('/take/:mapping_id/submit', authenticateToken, assessmentController.submitAssessment);

// Submit Feedback
router.post('/take/:mapping_id/feedback', authenticateToken, assessmentController.submitFeedback);

module.exports = router;

