const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAdmin } = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');

// All admin routes require admin authentication
router.use(isAdmin);

// Dashboard
router.get('/dashboard', adminController.dashboard);
router.post('/test-verify/:id', adminController.verifyGame);
// Manage games
router.get('/games', adminController.listGames);
router.get('/games/:id', adminController.viewGame);
// router.post('/games/:id/verify', adminController.verifyGame);
router.post('/games/:id/reject', adminController.rejectGame);

// Manage users
router.get('/users', adminController.listUsers);
router.get('/users/:id', adminController.viewUser);
router.post('/users/:id/toggle', adminController.toggleUserStatus);
router.post('/users/:id/adjust-balance', adminController.adjustBalance);

// Manage withdrawals
router.get('/withdrawals', adminController.listWithdrawals);
// Withdrawal routes
router.post('/withdrawals/:id/approve', adminController.approveWithdrawal);
router.post('/withdrawals/:id/reject', adminController.rejectWithdrawal);

// Reports
router.get('/reports', adminController.reports);
router.post('/users/:id/toggle-admin', adminController.toggleAdminStatus);

module.exports = router;