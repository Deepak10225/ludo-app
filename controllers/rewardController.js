const User = require('../models/User');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

class RewardController {
    // Show Daily Spin Wheel page
    async showDailyReward(req, res) {
        try {
            const user = await User.findById(req.session.user.id);
            
            // Check if user has already claimed today
            let canClaim = true;
            if (user.lastDailyRewardClaimed) {
                const lastClaim = new Date(user.lastDailyRewardClaimed);
                const now = new Date();
                // Check if 24 hours have passed
                const hoursSinceLastClaim = (now - lastClaim) / (1000 * 60 * 60);
                if (hoursSinceLastClaim < 24) {
                    canClaim = false;
                }
            }

            res.render('rewards/daily', {
                title: 'Daily Rewards - Spin & Win',
                user,
                canClaim,
                nextClaimTime: user.lastDailyRewardClaimed ? new Date(new Date(user.lastDailyRewardClaimed).getTime() + 24 * 60 * 60 * 1000) : null
            });
        } catch (error) {
            console.error('Show daily reward error:', error);
            req.flash('error_msg', 'Error loading rewards page');
            res.redirect('/games');
        }
    }

    // Process Daily Reward Claim
    async claimDailyReward(req, res) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const userId = req.session.user.id;
            const user = await User.findById(userId).session(session);

            // Double check cooldown
            if (user.lastDailyRewardClaimed) {
                const lastClaim = new Date(user.lastDailyRewardClaimed);
                const now = new Date();
                const hoursSinceLastClaim = (now - lastClaim) / (1000 * 60 * 60);
                if (hoursSinceLastClaim < 24) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ success: false, message: 'Reward already claimed today' });
                }
            }

            // Random reward logic (1 to 10 tokens/rupees)
            const rewards = [1, 2, 5, 10, 20];
            const rewardAmount = rewards[Math.floor(Math.random() * rewards.length)];

            // Update user
            const oldBalance = user.walletBalance;
            user.walletBalance += rewardAmount;
            user.lastDailyRewardClaimed = new Date();
            await user.save({ session });

            // Create transaction
            const rewardTransaction = new Transaction({
                user: userId,
                type: 'reward',
                amount: rewardAmount,
                balanceBefore: oldBalance,
                balanceAfter: user.walletBalance,
                status: 'completed',
                description: 'Daily login reward'
            });
            await rewardTransaction.save({ session });

            await session.commitTransaction();
            session.endSession();

            res.json({
                success: true,
                amount: rewardAmount,
                message: `Congratulations! You won ₹${rewardAmount}`
            });
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            console.error('Claim daily reward error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }
}

module.exports = new RewardController();
