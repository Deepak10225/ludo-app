const User = require('../models/User');
const Transaction = require('../models/Transaction');
const walletService = require('../services/walletService');

class WalletController {
    // Show wallet page
    async index(req, res) {
        try {
            const userId = req.session.user.id;
            const user = await User.findById(userId);

            // Get recent transactions
            const recentTransactions = await Transaction.find({ user: userId })
                .sort({ createdAt: -1 })
                .limit(5);

            res.render('wallet/index', {
                title: 'My Wallet',
                user,
                recentTransactions
            });
        } catch (error) {
            console.error('Wallet index error:', error);
            req.flash('error_msg', 'Error loading wallet');
            res.redirect('/');
        }
    }


    // Process deposit
    async deposit(req, res) {
        try {
            const { amount, paymentMethod } = req.body;
            const userId = req.session.user.id;

            // Validate amount
            if (amount < 100) {
                req.flash('error_msg', 'Minimum deposit amount is ₹100');
                return res.redirect('/wallet');
            }

            // For demo, we'll process deposit directly
            // In production, integrate with Razorpay/Paytm/PhonePe
            const transaction = await walletService.deposit(
                userId,
                parseFloat(amount),
                paymentMethod,
                { demo: true }
            );

            req.flash('success_msg', `₹${amount} deposited successfully!`);
            res.redirect('/wallet');
        } catch (error) {
            console.error('Deposit error:', error);
            req.flash('error_msg', 'Error processing deposit');
            res.redirect('/wallet');
        }
    }

    // Show withdrawal form
    // Show withdrawal form
    async showWithdraw(req, res) {
        try {
            const userId = req.session.user.id;
            const user = await User.findById(userId);

            // Get recent withdrawals for this user
            const recentWithdrawals = await Transaction.find({
                user: userId,
                type: 'withdrawal'
            })
                .sort({ createdAt: -1 })
                .limit(5);

            res.render('wallet/withdraw', {
                title: 'Withdraw Funds',
                user,
                recentWithdrawals: recentWithdrawals || [] // Ensure it's always an array
            });
        } catch (error) {
            console.error('Show withdraw error:', error);
            req.flash('error_msg', 'Error loading withdrawal page');
            res.redirect('/wallet');
        }
    }

    // Process withdrawal
    async withdraw(req, res) {
        try {
            const { amount, accountNumber, ifscCode, accountHolderName } = req.body;
            const userId = req.session.user.id;

            // Validate amount
            if (amount < 100) {
                req.flash('error_msg', 'Minimum withdrawal amount is ₹100');
                return res.redirect('/wallet/withdraw');
            }

            // Process withdrawal
            const transaction = await walletService.withdraw(userId, parseFloat(amount), {
                accountNumber,
                ifscCode,
                accountHolderName
            });

            req.flash('success_msg', 'Withdrawal request submitted successfully. It will be processed within 24 hours.');
            res.redirect('/wallet');
        } catch (error) {
            console.error('Withdrawal error:', error);
            req.flash('error_msg', error.message || 'Error processing withdrawal');
            res.redirect('/wallet/withdraw');
        }
    }

    // Show transaction history
    async transactions(req, res) {
        try {
            const userId = req.session.user.id;
            const page = parseInt(req.query.page) || 1;
            const limit = 10;
            const skip = (page - 1) * limit;

            console.log('Fetching transactions for user:', userId);

            // Get user with current balance
            const user = await User.findById(userId);
            if (!user) {
                console.error('User not found:', userId);
                req.flash('error_msg', 'User not found');
                return res.redirect('/wallet');
            }

            // Get transactions with proper error handling
            let transactions = [];
            try {
                transactions = await Transaction.find({ user: userId })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .populate('game', 'roomId betAmount')
                    .lean(); // Use lean() for better performance
            } catch (transError) {
                console.error('Error fetching transactions:', transError);
                transactions = [];
            }

            // Get total count for pagination
            const total = await Transaction.countDocuments({ user: userId });

            // Calculate summary statistics safely
            let summary = {
                totalDeposits: 0,
                totalWithdrawals: 0,
                totalBets: 0,
                totalWins: 0,
                totalRefunds: 0,
                transactionCount: total
            };

            try {
                const summaryData = await Transaction.aggregate([
                    {
                        $match: {
                            user: userId,
                            status: 'completed'
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalDeposits: {
                                $sum: {
                                    $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0]
                                }
                            },
                            totalWithdrawals: {
                                $sum: {
                                    $cond: [{ $eq: ['$type', 'withdrawal'] }, '$amount', 0]
                                }
                            },
                            totalBets: {
                                $sum: {
                                    $cond: [{ $eq: ['$type', 'bet'] }, '$amount', 0]
                                }
                            },
                            totalWins: {
                                $sum: {
                                    $cond: [{ $eq: ['$type', 'win'] }, '$amount', 0]
                                }
                            },
                            totalRefunds: {
                                $sum: {
                                    $cond: [{ $eq: ['$type', 'refund'] }, '$amount', 0]
                                }
                            }
                        }
                    }
                ]);

                if (summaryData && summaryData.length > 0) {
                    summary = { ...summary, ...summaryData[0] };
                }
            } catch (aggError) {
                console.error('Error calculating summary:', aggError);
                // Continue with default summary
            }

            console.log(`Found ${transactions.length} transactions out of ${total} total`);

            res.render('wallet/transactions', {
                title: 'Transaction History',
                user,
                transactions: transactions || [],
                summary,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('Transactions error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });

            req.flash('error_msg', 'Error loading transactions: ' + error.message);
            res.redirect('/wallet');
        }
    }

    // Get wallet balance (API)
    async getBalance(req, res) {
        try {
            const balance = await walletService.getBalance(req.session.user.id);
            res.json({ success: true, balance });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new WalletController();