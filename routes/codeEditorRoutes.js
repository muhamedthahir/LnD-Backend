const express = require('express');
const { executeCode, getRuntimes } = require('../controllers/codeEditorController');
const { authenticate } = require('../middleware/auth');
const requestBudget = require('../middleware/requestBudget');

const router = express.Router();
const running = new Map();
const executionBudget = requestBudget(120, 60000, req => req.user.id);

router.post('/', authenticate, executionBudget, async (req, res, next) => {
  const id = req.user.id;
  const count = running.get(id) || 0;
  if (count >= 2 || (running.size >= 100 && !running.has(id))) {
    return res.status(429).json({ error: 'Execution capacity reached. Try again shortly.' });
  }
  running.set(id, count + 1);
  try {
    await executeCode(req, res, next);
  } finally {
    const remaining = running.get(id) - 1;
    if (remaining) running.set(id, remaining);
    else running.delete(id);
  }
});

router.get('/runtimes', getRuntimes);

module.exports = router;
