const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { isAuthenticated } = require('../middleware/auth');
const catchAsync = require('../middleware/catchAsync');

// All wallet routes require authentication
router.use(isAuthenticated);

// Wallet home
router.get('/', catchAsync((req, res, next) => walletController.index(req, res, next)));

// Deposit
router.post('/deposit', catchAsync((req, res, next) => walletController.deposit(req, res, next)));

// Withdrawal
router.get('/withdraw', catchAsync((req, res, next) => walletController.showWithdraw(req, res, next)));
router.post('/withdraw', catchAsync((req, res, next) => walletController.withdraw(req, res, next)));

// Transactions
router.get('/transactions', catchAsync((req, res, next) => walletController.transactions(req, res, next)));

// API endpoint for balance
router.get('/balance', catchAsync((req, res, next) => walletController.getBalance(req, res, next)));

module.exports = router;