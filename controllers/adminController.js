const User = require('../models/User');
const Game = require('../models/Game');
const Transaction = require('../models/Transaction');
const walletService = require('../services/walletService');
const mongoose = require('mongoose');

class AdminController {
    // Admin Dashboard
    async dashboard(req, res) {
        try {
            // Get statistics
            const totalUsers = await User.countDocuments();
            const activeUsers = await User.countDocuments({ isActive: true });
            const totalGames = await Game.countDocuments();
            const completedGames = await Game.countDocuments({ status: 'completed' });
            const pendingGames = await Game.countDocuments({ status: 'active' });
            const disputedGames = await Game.countDocuments({ status: 'disputed' });

            // Get financial stats
            const totalDeposits = await Transaction.aggregate([
                { $match: { type: 'deposit', status: 'completed' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);

            const totalWithdrawals = await Transaction.aggregate([
                { $match: { type: 'withdrawal', status: 'completed' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);

            const totalBets = await Transaction.aggregate([
                { $match: { type: 'bet', status: 'completed' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);

            const totalWinnings = await Transaction.aggregate([
                { $match: { type: 'win', status: 'completed' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);

            // Get recent games
            const recentGames = await Game.find()
                .populate('player1', 'username')
                .populate('player2', 'username')
                .populate('winner', 'username')
                .sort({ createdAt: -1 })
                .limit(10);

            // Get pending withdrawals
            const pendingWithdrawals = await Transaction.find({
                type: 'withdrawal',
                status: 'pending'
            })
                .populate('user', 'username email')
                .sort({ createdAt: -1 })
                .limit(10);

            // Get pending verifications
            const pendingVerifications = await Game.find({
                status: 'completed',
                adminVerified: false
            })
                .populate('player1', 'username')
                .populate('player2', 'username')
                .sort({ completedAt: -1 })
                .limit(10);

            res.render('admin/dashboard', {
                title: 'Admin Dashboard',
                stats: {
                    totalUsers,
                    activeUsers,
                    totalGames,
                    completedGames,
                    pendingGames,
                    disputedGames,
                    totalDeposits: totalDeposits[0]?.total || 0,
                    totalWithdrawals: totalWithdrawals[0]?.total || 0,
                    totalBets: totalBets[0]?.total || 0,
                    totalWinnings: totalWinnings[0]?.total || 0,
                    platformRevenue: (totalBets[0]?.total || 0) - (totalWinnings[0]?.total || 0)
                },
                recentGames,
                pendingWithdrawals,
                pendingVerifications
            });
        } catch (error) {
            console.error('Admin dashboard error:', error);
            req.flash('error_msg', 'Error loading dashboard');
            res.redirect('/');
        }
    }

    // List all games with filtering
    async listGames(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = 20;
            const skip = (page - 1) * limit;
            const status = req.query.status || 'all';
            const search = req.query.search || '';

            let query = {};

            // Filter by status
            if (status !== 'all') {
                query.status = status;
            }

            // Search by room ID or username
            if (search) {
                const userQuery = {
                    $or: [
                        { roomId: { $regex: search, $options: 'i' } }
                    ]
                };

                // Try to find users matching search
                const users = await User.find({
                    username: { $regex: search, $options: 'i' }
                }).select('_id');

                if (users.length > 0) {
                    const userIds = users.map(u => u._id);
                    userQuery.$or.push(
                        { player1: { $in: userIds } },
                        { player2: { $in: userIds } }
                    );
                }

                query = { ...query, ...userQuery };
            }

            const games = await Game.find(query)
                .populate('player1', 'username email')
                .populate('player2', 'username email')
                .populate('winner', 'username email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            const total = await Game.countDocuments(query);

            // Get statistics for each status
            const statusCounts = await Game.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]);

            res.render('admin/games/list', {
                title: 'Manage Games',
                games,
                status,
                search,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                },
                statusCounts: statusCounts.reduce((acc, curr) => {
                    acc[curr._id] = curr.count;
                    return acc;
                }, {})
            });
        } catch (error) {
            console.error('List games error:', error);
            req.flash('error_msg', 'Error loading games');
            res.redirect('/admin/dashboard');
        }
    }

    // View single game details
    async viewGame(req, res) {
        try {
            const game = await Game.findById(req.params.id)
                .populate('player1', 'username email phoneNumber walletBalance')
                .populate('player2', 'username email phoneNumber walletBalance')
                .populate('winner', 'username email');

            if (!game) {
                req.flash('error_msg', 'Game not found');
                return res.redirect('/admin/games');
            }

            // Get related transactions
            const transactions = await Transaction.find({ game: game._id })
                .populate('user', 'username')
                .sort({ createdAt: -1 });

            res.render('admin/games/view', {
                title: `Game #${game.roomId}`,
                game,
                transactions
            });
        } catch (error) {
            console.error('View game error:', error);
            req.flash('error_msg', 'Error loading game');
            res.redirect('/admin/games');
        }
    }

    // Verify game and declare winner
    async verifyGame(req, res) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { gameId } = req.params;
            const { winnerId, adminNotes } = req.body;

            const game = await Game.findById(gameId).session(session);

            if (!game) {
                await session.abortTransaction();
                session.endSession();
                req.flash('error_msg', 'Game not found');
                return res.redirect('/admin/games');
            }

            if (game.status !== 'completed') {
                await session.abortTransaction();
                session.endSession();
                req.flash('error_msg', 'Game is not in completed state');
                return res.redirect(`/admin/games/${gameId}`);
            }

            if (game.adminVerified) {
                await session.abortTransaction();
                session.endSession();
                req.flash('error_msg', 'Game already verified');
                return res.redirect(`/admin/games/${gameId}`);
            }

            // Update game with winner
            game.winner = winnerId;
            game.adminVerified = true;
            game.adminNotes = adminNotes;
            await game.save({ session });

            // Calculate winnings (total pot = bet amount * 2)
            const winnings = game.betAmount * 2;

            // Credit winner
            await walletService.creditWinnings(winnerId, game._id, winnings);

            // Update user statistics
            await User.findByIdAndUpdate(
                winnerId,
                {
                    $inc: {
                        totalWins: 1,
                        totalEarnings: winnings
                    }
                },
                { session }
            );

            // Update loser's statistics
            const loserId = game.player1.toString() === winnerId ? game.player2 : game.player1;
            if (loserId) {
                await User.findByIdAndUpdate(
                    loserId,
                    { $inc: { totalLosses: 1 } },
                    { session }
                );
            }

            await session.commitTransaction();
            session.endSession();

            req.flash('success_msg', 'Game verified and winner credited successfully');
            res.redirect(`/admin/games/${gameId}`);
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            console.error('Verify game error:', error);
            req.flash('error_msg', 'Error verifying game');
            res.redirect(`/admin/games/${req.params.gameId}`);
        }
    }

    // Reject game (mark as disputed)
    async rejectGame(req, res) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { gameId } = req.params;
            const { reason } = req.body;

            const game = await Game.findById(gameId).session(session);

            if (!game) {
                await session.abortTransaction();
                session.endSession();
                req.flash('error_msg', 'Game not found');
                return res.redirect('/admin/games');
            }

            // Update game status
            game.status = 'disputed';
            game.adminNotes = `Rejected: ${reason}`;
            await game.save({ session });

            // Refund both players
            await walletService.refundBet(game.player1, game._id, game.betAmount);
            if (game.player2) {
                await walletService.refundBet(game.player2, game._id, game.betAmount);
            }

            await session.commitTransaction();
            session.endSession();

            req.flash('success_msg', 'Game rejected and players refunded');
            res.redirect(`/admin/games/${gameId}`);
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            console.error('Reject game error:', error);
            req.flash('error_msg', 'Error rejecting game');
            res.redirect(`/admin/games/${req.params.gameId}`);
        }
    }

    // List all users
    async listUsers(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = 20;
            const skip = (page - 1) * limit;
            const search = req.query.search || '';
            const filter = req.query.filter || 'all';

            let query = {};

            if (search) {
                query.$or = [
                    { username: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { phoneNumber: { $regex: search, $options: 'i' } }
                ];
            }

            if (filter === 'active') {
                query.isActive = true;
            } else if (filter === 'inactive') {
                query.isActive = false;
            } else if (filter === 'admin') {
                query.isAdmin = true;
            }

            const users = await User.find(query)
                .select('-password')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            const total = await User.countDocuments(query);

            res.render('admin/users/list', {
                title: 'Manage Users',
                users,
                search,
                filter,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            console.error('List users error:', error);
            req.flash('error_msg', 'Error loading users');
            res.redirect('/admin/dashboard');
        }
    }

    // View single user details
    async viewUser(req, res) {
        try {
            const user = await User.findById(req.params.id).select('-password');

            if (!user) {
                req.flash('error_msg', 'User not found');
                return res.redirect('/admin/users');
            }

            // Get user's games
            const games = await Game.find({
                $or: [{ player1: user._id }, { player2: user._id }]
            })
                .populate('player1', 'username')
                .populate('player2', 'username')
                .populate('winner', 'username')
                .sort({ createdAt: -1 })
                .limit(20);

            // Get user's transactions
            const transactions = await Transaction.find({ user: user._id })
                .sort({ createdAt: -1 })
                .limit(20);

            res.render('admin/users/view', {
                title: `User: ${user.username}`,
                user,
                games,
                transactions
            });
        } catch (error) {
            console.error('View user error:', error);
            req.flash('error_msg', 'Error loading user');
            res.redirect('/admin/users');
        }
    }

    // Toggle user status (activate/deactivate)
    async toggleUserStatus(req, res) {
        try {
            const { userId } = req.params;

            const user = await User.findById(userId);

            if (!user) {
                req.flash('error_msg', 'User not found');
                return res.redirect('/admin/users');
            }

            // Don't allow deactivating own account
            if (user._id.toString() === req.session.user.id) {
                req.flash('error_msg', 'Cannot deactivate your own account');
                return res.redirect(`/admin/users/${userId}`);
            }

            user.isActive = !user.isActive;
            await user.save();

            req.flash('success_msg', `User ${user.isActive ? 'activated' : 'deactivated'} successfully`);
            res.redirect(`/admin/users/${userId}`);
        } catch (error) {
            console.error('Toggle user status error:', error);
            req.flash('error_msg', 'Error updating user status');
            res.redirect('/admin/users');
        }
    }

    // Make user admin
    async toggleAdminStatus(req, res) {
        try {
            const { userId } = req.params;

            const user = await User.findById(userId);

            if (!user) {
                req.flash('error_msg', 'User not found');
                return res.redirect('/admin/users');
            }

            // Don't allow changing own admin status
            if (user._id.toString() === req.session.user.id) {
                req.flash('error_msg', 'Cannot change your own admin status');
                return res.redirect(`/admin/users/${userId}`);
            }

            user.isAdmin = !user.isAdmin;
            await user.save();

            req.flash('success_msg', `Admin privileges ${user.isAdmin ? 'granted' : 'revoked'} successfully`);
            res.redirect(`/admin/users/${userId}`);
        } catch (error) {
            console.error('Toggle admin status error:', error);
            req.flash('error_msg', 'Error updating admin status');
            res.redirect('/admin/users');
        }
    }

    // List all withdrawals
    async listWithdrawals(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = 20;
            const skip = (page - 1) * limit;
            const status = req.query.status || 'pending';

            const withdrawals = await Transaction.find({
                type: 'withdrawal',
                status: status
            })
                .populate('user', 'username email phoneNumber walletBalance')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            const total = await Transaction.countDocuments({
                type: 'withdrawal',
                status: status
            });

            // Get counts for each status
            const statusCounts = await Transaction.aggregate([
                { $match: { type: 'withdrawal' } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]);

            res.render('admin/withdrawals/list', {
                title: 'Manage Withdrawals',
                withdrawals,
                status,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                },
                statusCounts: statusCounts.reduce((acc, curr) => {
                    acc[curr._id] = curr.count;
                    return acc;
                }, {})
            });
        } catch (error) {
            console.error('List withdrawals error:', error);
            req.flash('error_msg', 'Error loading withdrawals');
            res.redirect('/admin/dashboard');
        }
    }

    // Approve withdrawal
    async approveWithdrawal(req, res) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { withdrawalId } = req.params;
            const { transactionId, notes } = req.body;

            const withdrawal = await Transaction.findById(withdrawalId).session(session);

            if (!withdrawal) {
                await session.abortTransaction();
                session.endSession();
                req.flash('error_msg', 'Withdrawal not found');
                return res.redirect('/admin/withdrawals');
            }

            if (withdrawal.status !== 'pending') {
                await session.abortTransaction();
                session.endSession();
                req.flash('error_msg', 'Withdrawal already processed');
                return res.redirect('/admin/withdrawals');
            }

            // Update withdrawal status
            withdrawal.status = 'completed';
            withdrawal.paymentDetails = {
                ...withdrawal.paymentDetails,
                transactionId,
                processedBy: req.session.user.id,
                processedAt: new Date(),
                notes
            };
            withdrawal.processedAt = new Date();
            await withdrawal.save({ session });

            await session.commitTransaction();
            session.endSession();

            req.flash('success_msg', 'Withdrawal approved successfully');
            res.redirect('/admin/withdrawals?status=completed');
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            console.error('Approve withdrawal error:', error);
            req.flash('error_msg', 'Error approving withdrawal');
            res.redirect('/admin/withdrawals');
        }
    }

    // Reject withdrawal
    async rejectWithdrawal(req, res) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { withdrawalId } = req.params;
            const { reason } = req.body;

            const withdrawal = await Transaction.findById(withdrawalId).session(session);

            if (!withdrawal) {
                await session.abortTransaction();
                session.endSession();
                req.flash('error_msg', 'Withdrawal not found');
                return res.redirect('/admin/withdrawals');
            }

            if (withdrawal.status !== 'pending') {
                await session.abortTransaction();
                session.endSession();
                req.flash('error_msg', 'Withdrawal already processed');
                return res.redirect('/admin/withdrawals');
            }

            // Update withdrawal status
            withdrawal.status = 'failed';
            withdrawal.paymentDetails = {
                ...withdrawal.paymentDetails,
                reason,
                processedBy: req.session.user.id,
                processedAt: new Date()
            };
            withdrawal.processedAt = new Date();
            await withdrawal.save({ session });

            // Refund the amount back to user's wallet
            const user = await User.findById(withdrawal.user).session(session);
            user.walletBalance += withdrawal.amount;
            await user.save({ session });

            // Create refund transaction record
            const refundTransaction = new Transaction({
                user: withdrawal.user,
                type: 'refund',
                amount: withdrawal.amount,
                balanceBefore: user.walletBalance - withdrawal.amount,
                balanceAfter: user.walletBalance,
                status: 'completed',
                description: `Refund for rejected withdrawal: ${reason}`,
                paymentMethod: 'wallet'
            });
            await refundTransaction.save({ session });

            await session.commitTransaction();
            session.endSession();

            req.flash('success_msg', 'Withdrawal rejected and amount refunded');
            res.redirect('/admin/withdrawals?status=failed');
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            console.error('Reject withdrawal error:', error);
            req.flash('error_msg', 'Error rejecting withdrawal');
            res.redirect('/admin/withdrawals');
        }
    }

    // Generate reports
    async reports(req, res) {
        try {
            const { type, from, to } = req.query;

            let startDate = from ? new Date(from) : new Date();
            startDate.setHours(0, 0, 0, 0);

            let endDate = to ? new Date(to) : new Date();
            endDate.setHours(23, 59, 59, 999);

            if (!from) {
                // Default to last 30 days
                startDate.setDate(startDate.getDate() - 30);
            }

            // User registration report
            const userRegistrations = await User.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]);

            // Game report
            const gamesReport = await Game.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        total: { $sum: 1 },
                        completed: {
                            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                        },
                        active: {
                            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                        },
                        disputed: {
                            $sum: { $cond: [{ $eq: ['$status', 'disputed'] }, 1, 0] }
                        }
                    }
                },
                { $sort: { _id: 1 } }
            ]);

            // Financial report
            const financialReport = await Transaction.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate },
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: {
                            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                            type: '$type'
                        },
                        total: { $sum: '$amount' },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id.date': 1 } }
            ]);

            // Format financial data
            const formattedFinancial = {};
            financialReport.forEach(item => {
                if (!formattedFinancial[item._id.date]) {
                    formattedFinancial[item._id.date] = {
                        date: item._id.date,
                        deposits: 0,
                        withdrawals: 0,
                        bets: 0,
                        wins: 0,
                        refunds: 0
                    };
                }
                formattedFinancial[item._id.date][item._id.type + 's'] = item.total;
            });

            res.render('admin/reports', {
                title: 'Reports',
                userRegistrations,
                gamesReport,
                financialReport: Object.values(formattedFinancial),
                dateRange: {
                    from: startDate.toISOString().split('T')[0],
                    to: endDate.toISOString().split('T')[0]
                }
            });
        } catch (error) {
            console.error('Reports error:', error);
            req.flash('error_msg', 'Error generating reports');
            res.redirect('/admin/dashboard');
        }
    }

    // System settings
    async settings(req, res) {
        try {
            // Get system statistics
            const stats = {
                totalUsers: await User.countDocuments(),
                totalGames: await Game.countDocuments(),
                totalTransactions: await Transaction.countDocuments(),
                totalRevenue: await Transaction.aggregate([
                    { $match: { type: 'bet', status: 'completed' } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ]),
                totalPayout: await Transaction.aggregate([
                    { $match: { type: 'win', status: 'completed' } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ])
            };

            res.render('admin/settings', {
                title: 'System Settings',
                stats: {
                    totalUsers: stats.totalUsers,
                    totalGames: stats.totalGames,
                    totalTransactions: stats.totalTransactions,
                    totalRevenue: stats.totalRevenue[0]?.total || 0,
                    totalPayout: stats.totalPayout[0]?.total || 0,
                    profit: (stats.totalRevenue[0]?.total || 0) - (stats.totalPayout[0]?.total || 0)
                }
            });
        } catch (error) {
            console.error('Settings error:', error);
            req.flash('error_msg', 'Error loading settings');
            res.redirect('/admin/dashboard');
        }
    }
}

module.exports = new AdminController();