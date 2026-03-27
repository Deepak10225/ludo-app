const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { isGuest, isAuthenticated } = require('../middleware/auth');

// Login routes
router.get('/login', isGuest, authController.showLogin);
router.post('/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
], authController.login);

// Register routes
router.get('/register', isGuest, authController.showRegister);
router.post('/register', [
    body('username').isLength({ min: 3 }).trim(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('phoneNumber').optional().isMobilePhone()
], authController.register);

// Logout
router.get('/logout', isAuthenticated, authController.logout);

const { upload, handleUploadError } = require('../middleware/upload');

// Profile routes
router.get('/profile', isAuthenticated, authController.showProfile);
router.post('/profile', isAuthenticated, authController.updateProfile);
router.post('/profile/avatar', isAuthenticated, upload.single('avatar'), authController.updateAvatar, handleUploadError);

// Home route
router.get('/', (req, res) => {
    res.render('index', { title: 'Ludo Gaming Platform' });
});

module.exports = router;