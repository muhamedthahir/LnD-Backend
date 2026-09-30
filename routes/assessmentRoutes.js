const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const assessmentController = require('../controllers/assessmentController');

// =====================================================
// ADMIN ROUTES - Assessment Management
// =====================================================

// Assessment CRUD
router.post('/assessments', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.createAssessment);
router.get('/assessments', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.getAssessments);
router.get('/assessments/:id', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.getAssessment);
router.put('/assessments/:id', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.updateAssessment);
router.delete('/assessments/:id', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.deleteAssessment);
router.patch('/assessments/:id/status', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.updateAssessmentStatus);
router.post('/assessments/:id/duplicate', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.duplicateAssessment);

// Segment CRUD
router.post('/segments', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.createSegment);
router.get('/assessments/:assessment_id/segments', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.getSegments);
router.get('/segments/:id', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.getSegment);
router.put('/segments/:id', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.updateSegment);
router.delete('/segments/:id', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.deleteSegment);
router.patch('/segments/:id/reorder', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.reorderSegment);

// Segment Questions
router.post('/segments/programming-questions', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.addProgrammingQuestion);
router.patch('/segments/programming-questions/:segment_id/:question_id', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.updateProgrammingQuestion);
router.delete('/segments/:segment_id/programming-questions/:question_id', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.removeProgrammingQuestion);
router.post('/segments/mcq-questions', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.addMCQQuestion);
router.patch('/segments/mcq-questions/:segment_id/:question_id', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.updateMCQQuestion);
router.delete('/segments/:segment_id/mcq-questions/:question_id', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.removeMCQQuestion);

// Random Fetch Criteria
router.post('/random-fetch-criteria', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.addRandomFetchCriteria);
router.get('/segments/:segment_id/random-fetch-criteria', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.getRandomFetchCriteria);
router.put('/random-fetch-criteria/:id', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.updateRandomFetchCriteria);
router.delete('/random-fetch-criteria/:id', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.deleteRandomFetchCriteria);

// Administrator Configuration CRUD
router.post('/administrators', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.createAdministrator);
router.get('/assessments/:assessment_id/administrators', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.getAdministrators);
router.get('/administrators/:id', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.getAdministrator);
router.put('/administrators/:id', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.updateAdministrator);
router.patch('/administrators/:id/status', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.updateAdministratorStatus);
router.delete('/administrators/:id', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.deleteAdministrator);

// User Mapping (Admin)
router.post('/administrators/invite', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.inviteUsers);
router.get('/administrators/:administrator_id/users', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.getUserMappings);
router.get('/administrators/:administrator_id/report', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.downloadAssessmentReport);
router.get('/mappings/:mapping_id/result', authenticate, assessmentController.getAssessmentResult);
router.post('/administrators/:administrator_id/allow-reattempt-all', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.allowReattemptForAll);
router.post('/administrators/:administrator_id/regrade-saved-code', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.regradeSavedCodeForAdministrator);
router.post('/user-mappings/:mapping_id/allow-reattempt', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.allowReattempt);
router.post('/user-mappings/:mapping_id/refresh-violation', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.refreshViolation);
router.post('/user-mappings/:mapping_id/extend-time', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.extendTime);
router.delete('/user-mappings/:mapping_id', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.deleteUserMapping);
router.post('/user-mappings/:mapping_id/send-invitation', authenticate, authorize('primary_admin', 'college_admin'), assessmentController.sendInvitation);

// =====================================================
// USER ROUTES - Assessment Taking
// =====================================================

// My Assessments
router.get('/my-assessments', authenticate, assessmentController.getMyAssessments);

// Get Start Info (before starting)
router.get('/user/assessments/:mapping_id/start-info', authenticate, assessmentController.getStartInfo);
router.post('/user/assessments/:mapping_id/resume', authenticate, assessmentController.incrementResumeCount);

// Start Assessment (both routes for compatibility)
router.post('/user/assessments/:mapping_id/start', authenticate, assessmentController.startAssessment);
router.post('/take/:mapping_id/start', authenticate, assessmentController.startAssessment);

// Retake Assessment (user-initiated new attempt within max attempts)
router.post('/user/assessments/:mapping_id/retake', authenticate, assessmentController.retakeAssessment);

// Get Assessment Take Data (in progress assessment)
router.get('/user/assessments/:mapping_id/take', authenticate, assessmentController.getAssessmentTake);

// Get Questions for a Segment
router.get('/take/:mapping_id/segments/:segment_id/questions', authenticate, assessmentController.getAssessmentQuestions);

// Save Answer (auto-save individual answer)
router.post('/user/assessments/:mapping_id/save-answer', authenticate, assessmentController.saveAnswer);

// Save Progress (periodic auto-save of timer and position)
router.post('/user/assessments/:mapping_id/save-progress', authenticate, assessmentController.saveProgress);

// Submit Code (programming question)
router.post('/user/assessments/:mapping_id/submit-code', authenticate, assessmentController.submitCode);

// Update Progress
router.patch('/take/:mapping_id/progress', authenticate, assessmentController.updateProgress);

// Log Proctoring Event (both routes for compatibility)
router.post('/take/:mapping_id/proctoring', authenticate, assessmentController.logProctoringEvent);
router.post('/user/assessments/:mapping_id/proctoring-log', authenticate, assessmentController.logProctoringEvent);

// Submit Assessment (both routes for compatibility)
router.post('/take/:mapping_id/submit', authenticate, assessmentController.submitAssessment);
router.post('/user/assessments/:mapping_id/submit', authenticate, assessmentController.submitAssessment);

// Next Segment
router.post('/user/assessments/:mapping_id/next-segment', authenticate, assessmentController.nextSegment);

// Switch Segment
router.post('/user/assessments/:mapping_id/switch-segment', authenticate, assessmentController.switchSegment);

// Submit Feedback
router.post('/take/:mapping_id/feedback', authenticate, assessmentController.submitFeedback);

module.exports = router;

