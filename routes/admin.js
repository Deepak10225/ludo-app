const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAdmin } = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');
const catchAsync = require('../middleware/catchAsync');

// All admin routes require admin authentication
router.use(isAdmin);

// Dashboard
router.get('/dashboard', catchAsync((req, res, next) => adminController.dashboard(req, res, next)));
router.post('/test-verify/:id', catchAsync((req, res, next) => adminController.verifyGame(req, res, next)));
// Manage games
router.get('/games', catchAsync((req, res, next) => adminController.listGames(req, res, next)));
router.get('/games/:id', catchAsync((req, res, next) => adminController.viewGame(req, res, next)));
// router.post('/games/:id/verify', catchAsync((req, res, next) => adminController.verifyGame(req, res, next)));
router.post('/games/:id/reject', catchAsync((req, res, next) => adminController.rejectGame(req, res, next)));

// Manage users
router.get('/users', catchAsync((req, res, next) => adminController.listUsers(req, res, next)));
router.get('/users/:id', catchAsync((req, res, next) => adminController.viewUser(req, res, next)));
router.post('/users/:id/toggle', catchAsync((req, res, next) => adminController.toggleUserStatus(req, res, next)));
router.post('/users/:id/adjust-balance', catchAsync((req, res, next) => adminController.adjustBalance(req, res, next)));

// Manage withdrawals
router.get('/withdrawals', catchAsync((req, res, next) => adminController.listWithdrawals(req, res, next)));
// Withdrawal routes
router.post('/withdrawals/:id/approve', catchAsync((req, res, next) => adminController.approveWithdrawal(req, res, next)));
router.post('/withdrawals/:id/reject', catchAsync((req, res, next) => adminController.rejectWithdrawal(req, res, next)));

// Reports
router.get('/reports', catchAsync((req, res, next) => adminController.reports(req, res, next)));
router.post('/users/:id/toggle-admin', catchAsync((req, res, next) => adminController.toggleAdminStatus(req, res, next)));

module.exports = router;