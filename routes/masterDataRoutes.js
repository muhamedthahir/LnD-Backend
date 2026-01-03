const express = require('express');
const router = express.Router();
const MasterDataController = require('../controllers/masterDataController');
const { authenticate, authorize } = require('../middleware/auth');

// All master data - for dropdowns
router.get('/all', authenticate, MasterDataController.getAllMasterData);

// Individual master data
router.get('/levels', authenticate, MasterDataController.getLevels);
router.get('/statuses', authenticate, MasterDataController.getStatuses);
router.get('/question-types', authenticate, MasterDataController.getQuestionTypes);
router.get('/languages', authenticate, MasterDataController.getLanguages);
router.get('/categories', authenticate, MasterDataController.getCategories);
router.get('/tags', authenticate, MasterDataController.getTags);

// Create master data
router.post('/tags', authenticate, authorize('primary_admin', 'college_admin'), MasterDataController.createTag);
router.post('/categories', authenticate, authorize('primary_admin', 'college_admin'), MasterDataController.createCategory);

module.exports = router;




