const Transaction = require('../models/Transaction');
const User = require('../models/User');

class WalletService {
    // Deposit money to wallet
    async deposit(userId, amount, paymentMethod, paymentDetails = {}) {
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');

        const transaction = new Transaction({
            user: userId,
            type: 'deposit',
            amount,
            balanceBefore: user.walletBalance,
            balanceAfter: user.walletBalance + amount,
            status: 'completed',
            paymentMethod,
            paymentDetails,
            description: `Deposit of ₹${amount} via ${paymentMethod}`
        });

        user.walletBalance += amount;
        await user.save();
        await transaction.save();

        return transaction;
    }

    // Withdraw money from wallet
    async withdraw(userId, amount, bankDetails) {
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');
        if (user.walletBalance < amount) throw new Error('Insufficient balance');

        const transaction = new Transaction({
            user: userId,
            type: 'withdrawal',
            amount,
            balanceBefore: user.walletBalance,
            balanceAfter: user.walletBalance - amount,
            status: 'pending', // Admin approval needed
            paymentMethod: 'bank',
            bankDetails,
            description: `Withdrawal of ₹${amount} to bank account`
        });

        user.walletBalance -= amount;
        await user.save();
        await transaction.save();

        return transaction;
    }

    // Place bet for game
    async placeBet(userId, gameId, amount) {
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');
        if (user.walletBalance < amount) throw new Error('Insufficient balance');

        const transaction = new Transaction({
            user: userId,
            type: 'bet',
            amount,
            balanceBefore: user.walletBalance,
            balanceAfter: user.walletBalance - amount,
            status: 'completed',
            game: gameId,
            description: `Bet placed for game: ₹${amount}`
        });

        user.walletBalance -= amount;
        await user.save();
        await transaction.save();

        return transaction;
    }

    // Credit winnings
    async creditWinnings(userId, gameId, amount) {
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');

        const transaction = new Transaction({
            user: userId,
            type: 'win',
            amount,
            balanceBefore: user.walletBalance,
            balanceAfter: user.walletBalance + amount,
            status: 'completed',
            game: gameId,
            description: `Winnings from game: ₹${amount}`
        });

        user.walletBalance += amount;
        await user.save();
        await transaction.save();

        return transaction;
    }

    // Refund bet (if game cancelled)
    async refundBet(userId, gameId, amount) {
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');

        const transaction = new Transaction({
            user: userId,
            type: 'refund',
            amount,
            balanceBefore: user.walletBalance,
            balanceAfter: user.walletBalance + amount,
            status: 'completed',
            game: gameId,
            description: `Refund for cancelled game: ₹${amount}`
        });

        user.walletBalance += amount;
        await user.save();
        await transaction.save();

        return transaction;
    }

    // Get user transaction history
    async getTransactionHistory(userId, page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        const transactions = await Transaction.find({ user: userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('game', 'roomId betAmount status');

        const total = await Transaction.countDocuments({ user: userId });

        return {
            transactions,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    // Get wallet balance
    async getBalance(userId) {
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');
        return user.walletBalance;
    }
}

module.exports = new WalletService();