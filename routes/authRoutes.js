const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const budget = require('../middleware/requestBudget');
const credentials = budget(20, 15 * 60 * 1000);
const recovery = budget(10, 15 * 60 * 1000);

router.post('/register', credentials, AuthController.register);
router.post('/login', credentials, AuthController.login);
router.post('/refresh', AuthController.refreshToken); // No authenticate middleware - uses refresh token
router.post('/set-password', credentials, AuthController.setPassword);
router.post('/forgot-password', recovery, AuthController.forgotPassword);
router.post('/reset-password', credentials, AuthController.resetPassword);
router.post('/logout', AuthController.logout); // Can be called with or without auth
router.get('/profile', authenticate, AuthController.getProfile);
router.get('/check', AuthController.checkAuth); // No authenticate middleware needed - this is the check endpoint

module.exports = router;

