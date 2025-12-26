const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refreshToken); // No authenticate middleware - uses refresh token
router.post('/set-password', AuthController.setPassword);
router.post('/logout', AuthController.logout); // Can be called with or without auth
router.get('/profile', authenticate, AuthController.getProfile);
router.get('/check', AuthController.checkAuth); // No authenticate middleware needed - this is the check endpoint

module.exports = router;

