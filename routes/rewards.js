const express = require('express');
const router = express.Router();
const rewardController = require('../controllers/rewardController');
const { isAuthenticated } = require('../middleware/auth');

// Daily Reward Page
router.get('/daily', isAuthenticated, rewardController.showDailyReward);

// Claim Daily Reward (AJAX)
router.post('/claim', isAuthenticated, rewardController.claimDailyReward);

module.exports = router;
