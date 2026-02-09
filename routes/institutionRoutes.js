const express = require('express');
const router = express.Router();
const InstitutionController = require('../controllers/institutionController');
const { authenticate, authorize } = require('../middleware/auth');

// All institution routes require authentication and primary_admin role
router.get('/', authenticate, authorize('primary_admin', 'skillvantix_admin'), InstitutionController.getInstitutions);
router.get('/all', authenticate, authorize('primary_admin', 'college_admin', 'skillvantix_admin'), InstitutionController.getAllInstitutions);
router.get('/:id', authenticate, authorize('primary_admin', 'skillvantix_admin'), InstitutionController.getInstitution);
router.post('/', authenticate, authorize('primary_admin', 'skillvantix_admin'), InstitutionController.createInstitution);
router.put('/:id', authenticate, authorize('primary_admin', 'skillvantix_admin'), InstitutionController.updateInstitution);
router.delete('/:id', authenticate, authorize('primary_admin', 'skillvantix_admin'), InstitutionController.deleteInstitution);

module.exports = router;

