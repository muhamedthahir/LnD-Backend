const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const scope = require('../middleware/assessmentScope');
const assessmentController = require('../controllers/assessmentController');

// =====================================================
// ADMIN ROUTES - Assessment Management
// =====================================================

// Assessment CRUD
router.post('/assessments', authenticate, authorize('primary_admin', 'college_admin'), scope(), assessmentController.createAssessment);
router.get('/assessments', authenticate, authorize('primary_admin', 'college_admin'), scope(), assessmentController.getAssessments);
router.get('/assessments/:id', authenticate, authorize('primary_admin', 'college_admin'), scope('assessment', req => req.params.id), assessmentController.getAssessment);
router.put('/assessments/:id', authenticate, authorize('primary_admin', 'college_admin'), scope('assessment', req => req.params.id), assessmentController.updateAssessment);
router.delete('/assessments/:id', authenticate, authorize('primary_admin', 'college_admin'), scope('assessment', req => req.params.id), assessmentController.deleteAssessment);
router.patch('/assessments/:id/status', authenticate, authorize('primary_admin', 'college_admin'), scope('assessment', req => req.params.id), assessmentController.updateAssessmentStatus);
router.post('/assessments/:id/duplicate', authenticate, authorize('primary_admin', 'college_admin'), scope('assessment', req => req.params.id), assessmentController.duplicateAssessment);

// Segment CRUD
router.post('/segments', authenticate, authorize('primary_admin', 'college_admin'), scope('assessment', req => req.body.assessment_id), assessmentController.createSegment);
router.get('/assessments/:assessment_id/segments', authenticate, authorize('primary_admin', 'college_admin'), scope('assessment', req => req.params.assessment_id), assessmentController.getSegments);
router.get('/segments/:id', authenticate, authorize('primary_admin', 'college_admin'), scope('segment', req => req.params.id), assessmentController.getSegment);
router.put('/segments/:id', authenticate, authorize('primary_admin', 'college_admin'), scope('segment', req => req.params.id), assessmentController.updateSegment);
router.delete('/segments/:id', authenticate, authorize('primary_admin', 'college_admin'), scope('segment', req => req.params.id), assessmentController.deleteSegment);
router.patch('/segments/:id/reorder', authenticate, authorize('primary_admin', 'college_admin'), scope('segment', req => req.params.id), assessmentController.reorderSegment);

// Segment Questions
router.post('/segments/programming-questions', authenticate, authorize('primary_admin', 'college_admin'), scope('segment', req => req.body.segment_id || req.body.assessment_segment_id), assessmentController.addProgrammingQuestion);
router.patch('/segments/programming-questions/:segment_id/:question_id', authenticate, authorize('primary_admin', 'college_admin'), scope('segment', req => req.params.segment_id), assessmentController.updateProgrammingQuestion);
router.delete('/segments/:segment_id/programming-questions/:question_id', authenticate, authorize('primary_admin', 'college_admin'), scope('segment', req => req.params.segment_id), assessmentController.removeProgrammingQuestion);
router.post('/segments/mcq-questions', authenticate, authorize('primary_admin', 'college_admin'), scope('segment', req => req.body.segment_id || req.body.assessment_segment_id), assessmentController.addMCQQuestion);
router.patch('/segments/mcq-questions/:segment_id/:question_id', authenticate, authorize('primary_admin', 'college_admin'), scope('segment', req => req.params.segment_id), assessmentController.updateMCQQuestion);
router.delete('/segments/:segment_id/mcq-questions/:question_id', authenticate, authorize('primary_admin', 'college_admin'), scope('segment', req => req.params.segment_id), assessmentController.removeMCQQuestion);

// Random Fetch Criteria
router.post('/random-fetch-criteria', authenticate, authorize('primary_admin', 'college_admin'), scope('segment', req => req.body.assessment_segment_id), assessmentController.addRandomFetchCriteria);
router.get('/segments/:segment_id/random-fetch-criteria', authenticate, authorize('primary_admin', 'college_admin'), scope('segment', req => req.params.segment_id), assessmentController.getRandomFetchCriteria);
router.put('/random-fetch-criteria/:id', authenticate, authorize('primary_admin', 'college_admin'), scope('criteria', req => req.params.id), assessmentController.updateRandomFetchCriteria);
router.delete('/random-fetch-criteria/:id', authenticate, authorize('primary_admin', 'college_admin'), scope('criteria', req => req.params.id), assessmentController.deleteRandomFetchCriteria);

// Administrator Configuration CRUD
router.post('/administrators', authenticate, authorize('primary_admin', 'college_admin'), scope('assessment', req => req.body.adminData?.assessment_id), assessmentController.createAdministrator);
router.get('/assessments/:assessment_id/administrators', authenticate, authorize('primary_admin', 'college_admin'), scope('assessment', req => req.params.assessment_id), assessmentController.getAdministrators);
router.get('/administrators/:id', authenticate, authorize('primary_admin', 'college_admin'), scope('config', req => req.params.id), assessmentController.getAdministrator);
router.put('/administrators/:id', authenticate, authorize('primary_admin', 'college_admin'), scope('config', req => req.params.id), assessmentController.updateAdministrator);
router.patch('/administrators/:id/status', authenticate, authorize('primary_admin', 'college_admin'), scope('config', req => req.params.id), assessmentController.updateAdministratorStatus);
router.delete('/administrators/:id', authenticate, authorize('primary_admin', 'college_admin'), scope('config', req => req.params.id), assessmentController.deleteAdministrator);

// User Mapping (Admin)
router.post('/administrators/invite', authenticate, authorize('primary_admin', 'college_admin'), scope('config', req => req.body.administrator_id), assessmentController.inviteUsers);
router.get('/administrators/:administrator_id/users', authenticate, authorize('primary_admin', 'college_admin'), scope('config', req => req.params.administrator_id), assessmentController.getUserMappings);
router.get('/administrators/:administrator_id/report', authenticate, authorize('primary_admin', 'college_admin'), scope('config', req => req.params.administrator_id), assessmentController.downloadAssessmentReport);
router.get('/mappings/:mapping_id/result', authenticate, scope('mapping', req => req.params.mapping_id), assessmentController.getAssessmentResult);
router.get('/user/assessments/:mapping_id/results', authenticate, scope('mapping', req => req.params.mapping_id), assessmentController.getAssessmentResult);
router.post('/administrators/:administrator_id/allow-reattempt-all', authenticate, authorize('primary_admin', 'college_admin'), scope('config', req => req.params.administrator_id), assessmentController.allowReattemptForAll);
router.post('/administrators/:administrator_id/regrade-saved-code', authenticate, authorize('primary_admin', 'college_admin'), scope('config', req => req.params.administrator_id), assessmentController.regradeSavedCodeForAdministrator);
router.post('/user-mappings/:mapping_id/allow-reattempt', authenticate, authorize('primary_admin', 'college_admin'), scope('mapping', req => req.params.mapping_id), assessmentController.allowReattempt);
router.post('/user-mappings/:mapping_id/refresh-violation', authenticate, authorize('primary_admin', 'college_admin'), scope('mapping', req => req.params.mapping_id), assessmentController.refreshViolation);
router.post('/user-mappings/:mapping_id/extend-time', authenticate, authorize('primary_admin', 'college_admin'), scope('mapping', req => req.params.mapping_id), assessmentController.extendTime);
router.delete('/user-mappings/:mapping_id', authenticate, authorize('primary_admin', 'college_admin'), scope('mapping', req => req.params.mapping_id), assessmentController.deleteUserMapping);
router.post('/user-mappings/:mapping_id/send-invitation', authenticate, authorize('primary_admin', 'college_admin'), scope('mapping', req => req.params.mapping_id), assessmentController.sendInvitation);

// =====================================================
// USER ROUTES - Assessment Taking
// =====================================================

// My Assessments
router.get('/my-assessments', authenticate, assessmentController.getMyAssessments);

// Get Start Info (before starting)
router.get('/user/assessments/:mapping_id/start-info', authenticate, scope.ownAttempt, assessmentController.getStartInfo);
router.post('/user/assessments/:mapping_id/resume', authenticate, scope.ownAttempt, assessmentController.incrementResumeCount);

// Start Assessment (both routes for compatibility)
router.post('/user/assessments/:mapping_id/start', authenticate, scope.ownAttempt, assessmentController.startAssessment);
router.post('/take/:mapping_id/start', authenticate, scope.ownAttempt, assessmentController.startAssessment);

// Retake Assessment (user-initiated new attempt within max attempts)
router.post('/user/assessments/:mapping_id/retake', authenticate, scope.ownAttempt, assessmentController.retakeAssessment);

// Get Assessment Take Data (in progress assessment)
router.get('/user/assessments/:mapping_id/take', authenticate, scope.ownAttempt, assessmentController.getAssessmentTake);

// Get Questions for a Segment
router.get('/take/:mapping_id/segments/:segment_id/questions', authenticate, scope.ownAttempt, assessmentController.getAssessmentQuestions);

// Save Answer (auto-save individual answer)
router.post('/user/assessments/:mapping_id/save-answer', authenticate, scope.ownAttempt, assessmentController.saveAnswer);

// Save Progress (periodic auto-save of timer and position)
router.post('/user/assessments/:mapping_id/save-progress', authenticate, scope.ownAttempt, assessmentController.saveProgress);

// Submit Code (programming question)
router.post('/user/assessments/:mapping_id/submit-code', authenticate, scope.ownAttempt, assessmentController.submitCode);

// Update Progress
router.patch('/take/:mapping_id/progress', authenticate, scope.ownAttempt, assessmentController.updateProgress);

// Log Proctoring Event (both routes for compatibility)
router.post('/take/:mapping_id/proctoring', authenticate, scope.ownAttempt, assessmentController.logProctoringEvent);
router.post('/user/assessments/:mapping_id/proctoring-log', authenticate, scope.ownAttempt, assessmentController.logProctoringEvent);

// Submit Assessment (both routes for compatibility)
router.post('/take/:mapping_id/submit', authenticate, scope.ownAttempt, assessmentController.submitAssessment);
router.post('/user/assessments/:mapping_id/submit', authenticate, scope.ownAttempt, assessmentController.submitAssessment);

// Next Segment
router.post('/user/assessments/:mapping_id/next-segment', authenticate, scope.ownAttempt, assessmentController.nextSegment);

// Switch Segment
router.post('/user/assessments/:mapping_id/switch-segment', authenticate, scope.ownAttempt, assessmentController.switchSegment);

// Submit Feedback
router.post('/take/:mapping_id/feedback', authenticate, scope.ownAttempt, assessmentController.submitFeedback);
router.post('/user/assessments/:mapping_id/feedback', authenticate, scope.ownAttempt, assessmentController.submitFeedback);

module.exports = router;
