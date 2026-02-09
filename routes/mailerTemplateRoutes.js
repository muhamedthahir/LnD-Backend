const express = require('express');
const router = express.Router();
const MailerTemplateController = require('../controllers/mailerTemplateController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication and primary_admin role
router.use(authenticate);
router.use(authorize('primary_admin', 'skillvantix_admin'));

// List and filter templates
router.get('/', MailerTemplateController.getTemplates);

// Get active templates (for dropdowns)
router.get('/active', MailerTemplateController.getActiveTemplates);

// Get distinct categories
router.get('/categories', MailerTemplateController.getCategories);

// Get templates by type
router.get('/type/:type', MailerTemplateController.getTemplatesByType);

// Get template by unique_id
router.get('/unique/:uniqueId', MailerTemplateController.getTemplateByUniqueId);

// Get single template
router.get('/:id', MailerTemplateController.getTemplate);

// Create template
router.post('/', MailerTemplateController.createTemplate);

// Update template
router.put('/:id', MailerTemplateController.updateTemplate);

// Delete template
router.delete('/:id', MailerTemplateController.deleteTemplate);

// Toggle active status
router.patch('/:id/toggle-active', MailerTemplateController.toggleActive);

// Duplicate template
router.post('/:id/duplicate', MailerTemplateController.duplicateTemplate);

// Preview template with sample data
router.post('/:id/preview', MailerTemplateController.previewTemplate);

module.exports = router;

