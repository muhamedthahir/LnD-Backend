const express = require('express');
const router = express.Router();
const MasterDataController = require('../controllers/masterDataController');
const { authenticate, authorize } = require('../middleware/auth');

// All master data - for dropdowns
router.get('/all', authenticate, MasterDataController.getAllMasterData);

// ==================== LEVELS ====================
router.get('/levels', authenticate, MasterDataController.getLevels);
router.get('/levels/:id', authenticate, MasterDataController.getLevel);
router.post('/levels', authenticate, authorize('primary_admin'), MasterDataController.createLevel);
router.put('/levels/:id', authenticate, authorize('primary_admin'), MasterDataController.updateLevel);
router.delete('/levels/:id', authenticate, authorize('primary_admin'), MasterDataController.deleteLevel);

// ==================== STATUSES ====================
router.get('/statuses', authenticate, MasterDataController.getStatuses);
router.get('/statuses/:id', authenticate, MasterDataController.getStatus);
router.post('/statuses', authenticate, authorize('primary_admin'), MasterDataController.createStatus);
router.put('/statuses/:id', authenticate, authorize('primary_admin'), MasterDataController.updateStatus);
router.delete('/statuses/:id', authenticate, authorize('primary_admin'), MasterDataController.deleteStatus);

// ==================== QUESTION TYPES ====================
router.get('/question-types', authenticate, MasterDataController.getQuestionTypes);
router.get('/question-types/:id', authenticate, MasterDataController.getQuestionType);
router.post('/question-types', authenticate, authorize('primary_admin'), MasterDataController.createQuestionType);
router.put('/question-types/:id', authenticate, authorize('primary_admin'), MasterDataController.updateQuestionType);
router.delete('/question-types/:id', authenticate, authorize('primary_admin'), MasterDataController.deleteQuestionType);

// ==================== LANGUAGES ====================
router.get('/languages', authenticate, MasterDataController.getLanguages);
router.get('/languages/:id', authenticate, MasterDataController.getLanguage);
router.post('/languages', authenticate, authorize('primary_admin'), MasterDataController.createLanguage);
router.put('/languages/:id', authenticate, authorize('primary_admin'), MasterDataController.updateLanguage);
router.delete('/languages/:id', authenticate, authorize('primary_admin'), MasterDataController.deleteLanguage);

// ==================== CATEGORIES ====================
router.get('/categories', authenticate, MasterDataController.getCategories);
router.get('/categories/:id', authenticate, MasterDataController.getCategory);
router.post('/categories', authenticate, authorize('primary_admin'), MasterDataController.createCategory);
router.put('/categories/:id', authenticate, authorize('primary_admin'), MasterDataController.updateCategory);
router.delete('/categories/:id', authenticate, authorize('primary_admin'), MasterDataController.deleteCategory);

// ==================== TAGS ====================
router.get('/tags', authenticate, MasterDataController.getTags);
router.get('/tags/:id', authenticate, MasterDataController.getTag);
router.post('/tags', authenticate, authorize('primary_admin'), MasterDataController.createTag);
router.put('/tags/:id', authenticate, authorize('primary_admin'), MasterDataController.updateTag);
router.delete('/tags/:id', authenticate, authorize('primary_admin'), MasterDataController.deleteTag);

// ==================== USER ROLES ====================
router.get('/user-roles', authenticate, MasterDataController.getUserRoles);
router.get('/user-roles/:id', authenticate, MasterDataController.getUserRole);
router.post('/user-roles', authenticate, authorize('primary_admin'), MasterDataController.createUserRole);
router.put('/user-roles/:id', authenticate, authorize('primary_admin'), MasterDataController.updateUserRole);
router.delete('/user-roles/:id', authenticate, authorize('primary_admin'), MasterDataController.deleteUserRole);

module.exports = router;
