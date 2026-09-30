const express = require('express');
const router = express.Router();
const PlaygroundController = require('../controllers/playgroundController');
const { authenticate } = require('../middleware/auth');

// Public route - shared playgrounds are viewable without authentication.
// Must be declared BEFORE the authenticate middleware below.
router.get('/public/:shareId', PlaygroundController.getPublic);

// All routes below require authentication.
router.use(authenticate);

router.get('/', PlaygroundController.list);
router.post('/', PlaygroundController.create);
router.get('/:id', PlaygroundController.getOne);
router.put('/:id', PlaygroundController.update);
router.delete('/:id', PlaygroundController.remove);

module.exports = router;
