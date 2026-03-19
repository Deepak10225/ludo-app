const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { isAuthenticated } = require('../middleware/auth');

// All wallet routes require authentication
router.use(isAuthenticated);

// Wallet home
router.get('/', walletController.index);

// Deposit
router.post('/deposit', walletController.deposit);

// Withdrawal
router.get('/withdraw', walletController.showWithdraw);
router.post('/withdraw', walletController.withdraw);

// Transactions
router.get('/transactions', walletController.transactions);

// API endpoint for balance
router.get('/balance', walletController.getBalance);

module.exports = router;