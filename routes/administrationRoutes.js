const express = require('express');
const router = express.Router();
const AdministrationController = require('../controllers/administrationController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication and admin authorization
router.post('/', authenticate, authorize('college_admin', 'primary_admin', 'skillvantix_admin'), AdministrationController.create);
router.get('/', authenticate, authorize('college_admin', 'primary_admin', 'skillvantix_admin'), AdministrationController.getAll);
router.get('/:id', authenticate, authorize('college_admin', 'primary_admin', 'skillvantix_admin'), AdministrationController.getById);
router.get('/:id/enrolled-users', authenticate, authorize('college_admin', 'primary_admin', 'skillvantix_admin'), AdministrationController.getEnrolledUsers);
router.get('/:id/overall-report', authenticate, authorize('college_admin', 'primary_admin', 'skillvantix_admin'), AdministrationController.getOverallReport);
router.get('/:id/users/:userId/progress', authenticate, authorize('college_admin', 'primary_admin', 'skillvantix_admin'), AdministrationController.getUserProgressReport);
router.post('/:id/update-progress', authenticate, authorize('college_admin', 'primary_admin', 'skillvantix_admin'), AdministrationController.updateAllUsersProgress);
router.get('/:id/progress-history', authenticate, authorize('college_admin', 'primary_admin', 'skillvantix_admin'), AdministrationController.getProgressUpdateHistory);
router.post('/:id/users/:userId/force-expire', authenticate, authorize('college_admin', 'primary_admin', 'skillvantix_admin'), AdministrationController.forceExpireUser);
router.put('/:id', authenticate, authorize('college_admin', 'primary_admin', 'skillvantix_admin'), AdministrationController.update);
router.delete('/:id', authenticate, authorize('college_admin', 'primary_admin', 'skillvantix_admin'), AdministrationController.delete);
router.post('/draft', authenticate, authorize('college_admin', 'primary_admin', 'skillvantix_admin'), AdministrationController.saveAsDraft);

module.exports = router;

