const cron = require('node-cron');
const Game = require('../models/Game');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// Har minute check karo
cron.schedule('* * * * *', async () => {
    try {
        console.log('🔍 Checking for expired games...');

        // 10 minute pehle ke games
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

        const expiredGames = await Game.find({
            status: 'waiting',
            player2: null,
            createdAt: { $lt: tenMinutesAgo }
        });

        for (const game of expiredGames) {
            console.log(`⏰ Expired game: ${game.roomId}`);

            // Game cancel kar
            game.status = 'cancelled';
            await game.save();

            // User ko refund kar
            const user = await User.findById(game.player1);
            if (user) {
                user.walletBalance += game.betAmount;
                await user.save();

                // Transaction record
                await Transaction.create({
                    user: game.player1,
                    type: 'refund',
                    amount: game.betAmount,
                    balanceBefore: user.walletBalance - game.betAmount,
                    balanceAfter: user.walletBalance,
                    status: 'completed',
                    game: game._id,
                    description: `Refund for expired game (₹${game.betAmount})`
                });

                console.log(`💰 Refunded ₹${game.betAmount} to user ${game.player1}`);
            }
        }

    } catch (error) {
        console.error('❌ Cleanup error:', error);
    }
});