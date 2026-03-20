const Game = require('../models/Game');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

class RoomManager {
    constructor() {
        // Ye tracking sirf memory mein hoga, database nahi badlega
        this.waitingRooms = new Map(); // betAmount -> gameId
        this.expiryTimers = new Map(); // gameId -> timer
    }

    // Pehle user ke liye room create ya existing room do
    async getRoomForUser(userId, betAmount, betRange, createGameCallback) {
        try {
            console.log(`🔍 Looking for room with bet amount: ₹${betAmount}`);

            // Pehle check karo ki koi waiting room hai ya nahi
            const existingGameId = this.waitingRooms.get(betAmount);

            if (existingGameId) {
                // Wait! Check karo ki yeh game abhi bhi valid hai ya nahi
                const existingGame = await Game.findById(existingGameId);

                if (existingGame &&
                    existingGame.status === 'waiting' &&
                    !existingGame.player2) {

                    console.log(`✅ Found waiting room: ${existingGame.roomId}`);

                    // Ye room existing user ka hai, is user ko join karwa do
                    return {
                        success: true,
                        game: existingGame,
                        isNewGame: false,
                        message: 'Joining existing game'
                    };
                } else {
                    // Purana game valid nahi hai, map se hatao
                    this.waitingRooms.delete(betAmount);
                    if (this.expiryTimers.has(existingGameId)) {
                        clearTimeout(this.expiryTimers.get(existingGameId));
                        this.expiryTimers.delete(existingGameId);
                    }
                }
            }

            // Naya game create karo (callback existing createGame logic call karega)
            console.log(`🆕 Creating new room for ₹${betAmount}`);
            const newGame = await createGameCallback(userId, betAmount, betRange);

            // Is room ko waiting rooms mein add karo
            this.waitingRooms.set(betAmount, newGame._id.toString());

            // 10 minute ka timer set karo
            const timer = setTimeout(async () => {
                await this.handleExpiredRoom(newGame._id, betAmount);
            }, 10 * 60 * 1000); // 10 minutes

            this.expiryTimers.set(newGame._id.toString(), timer);

            return {
                success: true,
                game: newGame,
                isNewGame: true,
                message: 'New game created'
            };

        } catch (error) {
            console.error('❌ Room manager error:', error);
            return { success: false, message: error.message };
        }
    }

    // Expired room handle karo
    async handleExpiredRoom(gameId, betAmount) {
        try {
            console.log(`⏰ Room expired: ${gameId}`);

            const game = await Game.findById(gameId);

            if (game && game.status === 'waiting' && !game.player2) {
                // Game status change karo
                game.status = 'cancelled';
                await game.save();

                // User ko refund karo
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

                    console.log(`💰 Refund issued to user: ${game.player1}`);
                }
            }

            // Waiting rooms se hatao
            this.waitingRooms.delete(betAmount);
            this.expiryTimers.delete(gameId.toString());

        } catch (error) {
            console.error('❌ Expiry handler error:', error);
        }
    }

    // Jab game complete ho jaye to waiting rooms se hatao
    async removeFromWaiting(gameId, betAmount) {
        const currentGameId = this.waitingRooms.get(betAmount);
        if (currentGameId === gameId.toString()) {
            this.waitingRooms.delete(betAmount);

            if (this.expiryTimers.has(gameId.toString())) {
                clearTimeout(this.expiryTimers.get(gameId.toString()));
                this.expiryTimers.delete(gameId.toString());
            }
        }
    }

    // Status check
    getStatus() {
        return {
            waitingRooms: Array.from(this.waitingRooms.entries()),
            activeTimers: this.expiryTimers.size
        };
    }
}

module.exports = new RoomManager();