// codeEditorRoutes.js
const express = require('express');
const router = express.Router();
const { executeCode, getRuntimes } = require('../controllers/codeEditorController');

// POST /api/codeExecute - Execute code using Piston API
// No authentication required for now
router.post('/', executeCode);

// GET /api/codeExecute/runtimes - Get available language runtimes
router.get('/runtimes', getRuntimes);

module.exports = router;

