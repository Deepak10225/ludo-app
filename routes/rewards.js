const express = require('express');
const router = express.Router();
const rewardController = require('../controllers/rewardController');
const { isAuthenticated } = require('../middleware/auth');
const catchAsync = require('../middleware/catchAsync');

// Daily Reward Page
router.get('/daily', isAuthenticated, catchAsync((req, res, next) => rewardController.showDailyReward(req, res, next)));

// Claim Daily Reward (AJAX)
router.post('/claim', isAuthenticated, catchAsync((req, res, next) => rewardController.claimDailyReward(req, res, next)));

module.exports = router;
