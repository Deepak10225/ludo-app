const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { isGuest, isAuthenticated } = require('../middleware/auth');
const catchAsync = require('../middleware/catchAsync');

// Login routes
router.get('/login', isGuest, catchAsync((req, res, next) => authController.showLogin(req, res, next)));
router.post('/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
], catchAsync((req, res, next) => authController.login(req, res, next)));

// Register routes
router.get('/register', isGuest, catchAsync((req, res, next) => authController.showRegister(req, res, next)));
router.post('/register', [
    body('username').isLength({ min: 3 }).trim(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('phoneNumber').optional().isMobilePhone()
], catchAsync((req, res, next) => authController.register(req, res, next)));

// Logout
router.get('/logout', isAuthenticated, catchAsync((req, res, next) => authController.logout(req, res, next)));

const { upload, handleUploadError } = require('../middleware/upload');

// Profile routes
router.get('/profile', isAuthenticated, catchAsync((req, res, next) => authController.showProfile(req, res, next)));
router.post('/profile', isAuthenticated, catchAsync((req, res, next) => authController.updateProfile(req, res, next)));
router.post('/profile/avatar', isAuthenticated, upload.single('avatar'), catchAsync((req, res, next) => authController.updateAvatar(req, res, next)), handleUploadError);

// Home route
router.get('/', (req, res) => {
    res.render('index', { title: 'Ludo Gaming Platform' });
});

module.exports = router;