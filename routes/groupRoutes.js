const express = require('express');
const router = express.Router();
const GroupController = require('../controllers/groupController');
const { authenticate, authorize } = require('../middleware/auth');

// All group routes require authentication and admin role
router.use(authenticate);
router.use(authorize('primary_admin', 'college_admin'));

router.get('/', GroupController.getGroups);
router.get('/template', GroupController.downloadTemplate);
router.get('/:id', GroupController.getGroup);
router.get('/:id/edit-data', GroupController.getGroupEditData);
router.post('/', GroupController.createGroup);
router.post('/:id/upload', GroupController.upload, GroupController.uploadStudents);
router.put('/:id', GroupController.updateGroup);
router.put('/:id/members', GroupController.updateGroupMembers);
router.delete('/:id', GroupController.deleteGroup);

module.exports = router;

