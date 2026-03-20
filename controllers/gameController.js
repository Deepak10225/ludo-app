const Game = require('../models/Game');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const walletService = require('../services/walletService');
const ludoKingService = require('../services/ludoKingService');
const path = require('path');
const fs = require('fs');

class GameController {
    // Show available games page
    async index(req, res) {
        try {
            const range = req.query.range || '100-25000';
            let options = [];

            if (range === '100-25000') {
                options = [100, 200, 500, 1000, 2000, 5000, 10000, 15000, 20000, 25000];
            } else {
                options = [25000, 30000, 40000, 50000, 60000, 70000, 80000, 90000, 100000];
            }

            // Get active games waiting for players
            const waitingGames = await Game.find({
                status: 'waiting',
                betRange: range
            }).populate('player1', 'username').limit(10);

            res.render('games/index', {
                title: 'Play Ludo - Choose Game',
                range,
                options,
                waitingGames,
                user: req.session.user
            });
        } catch (error) {
            console.error('Games index error:', error);
            req.flash('error_msg', 'Error loading games');
            res.redirect('/');
        }
    }
    async submitResult(req, res) {
        try {
            const gameId = req.params.id;
            const userId = req.session.user.id;
            const screenshot = req.file;

            if (!screenshot) {
                req.flash('error_msg', 'Please upload a screenshot');
                return res.redirect(`/games/${gameId}/play`);
            }

            const game = await Game.findById(gameId);

            if (!game) {
                req.flash('error_msg', 'Game not found');
                return res.redirect('/games');
            }

            // Check if user is part of this game
            const isPlayer1 = game.player1.toString() === userId;
            const isPlayer2 = game.player2 && game.player2.toString() === userId;

            if (!isPlayer1 && !isPlayer2) {
                req.flash('error_msg', 'You are not part of this game');
                return res.redirect('/games');
            }

            // Check if game is active
            if (game.status !== 'active') {
                req.flash('error_msg', 'Game is not active');
                return res.redirect(`/games/${gameId}`);
            }

            // Save screenshot path
            const screenshotPath = `/uploads/${screenshot.filename}`;

            // Use the complete method from model
            await game.complete(userId, screenshotPath);

            // Update confirmation based on player
            if (isPlayer1) {
                game.player1Confirmed = true;
            } else {
                game.player2Confirmed = true;
            }
            await game.save();

            req.flash('success_msg', '✅ Result submitted successfully! Waiting for opponent confirmation and admin verification.');
            res.redirect(`/games/${gameId}`);

        } catch (error) {
            console.error('Submit result error:', error);
            req.flash('error_msg', 'Error submitting result');
            res.redirect(`/games/${req.params.id}/play`);
        }
    }

    // Confirm opponent's result
    async confirmResult(req, res) {
        try {
            const gameId = req.params.id;
            const userId = req.session.user.id;

            const game = await Game.findById(gameId);

            if (!game) {
                return res.status(404).json({ error: 'Game not found' });
            }

            // Check if user is the opponent
            const isPlayer1 = game.player1.toString() === userId;
            const isPlayer2 = game.player2 && game.player2.toString() === userId;

            if (!isPlayer1 && !isPlayer2) {
                return res.status(403).json({ error: 'Not authorized' });
            }

            // Mark confirmation
            if (isPlayer1) {
                game.player1Confirmed = true;
            } else {
                game.player2Confirmed = true;
            }

            await game.save();

            res.json({
                success: true,
                message: 'Result confirmed',
                bothConfirmed: game.player1Confirmed && game.player2Confirmed
            });

        } catch (error) {
            console.error('Confirm result error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }

    // Create new game - FIXED METHOD
    // Create new game
    // Create new game - FIXED VERSION
    async create(req, res) {
        try {
            const { betAmount, betRange } = req.body;
            const userId = req.session.user.id;

            console.log('🎮 Creating game with:', { betAmount, betRange, userId });

            // Validate bet amount within range
            if (!this.validateBetRange(parseFloat(betAmount), betRange)) {
                req.flash('error_msg', 'Invalid bet amount for selected range');
                return res.redirect('/games');
            }

            // Check user balance
            const user = await User.findById(userId);
            if (!user) {
                req.flash('error_msg', 'User not found');
                return res.redirect('/login');
            }

            if (user.walletBalance < parseFloat(betAmount)) {
                req.flash('error_msg', 'Insufficient balance');
                return res.redirect('/wallet');
            }

            // ✅ FIX - Pehle check kar ki koi waiting game hai ya nahi same amount ki
            const waitingGame = await Game.findOne({
                betAmount: parseFloat(betAmount),
                status: 'waiting',
                player2: null  // Jisme player2 nahi hai
            }).populate('player1');

            if (waitingGame) {
                // ✅ Agar waiting game mil gayi to use join karo
                console.log('✅ Found waiting game for ₹' + betAmount + ':', waitingGame.roomId);

                // Check ki user apna game join to nahi kar raha
                if (waitingGame.player1._id.toString() === userId) {
                    req.flash('error_msg', 'You already have a waiting game');
                    return res.redirect('/games');
                }

                // Game mein player2 add kar
                waitingGame.player2 = userId;
                waitingGame.status = 'active';
                await waitingGame.save();

                // Player2 ka bet deduct kar
                await walletService.placeBet(userId, waitingGame._id, parseFloat(betAmount));

                req.flash('success_msg', `✅ Opponent found! Game ready. Room ID: ${waitingGame.roomId}`);
                return res.redirect(`/games/${waitingGame._id}`);
            }

            // ❌ Koi waiting game nahi mila to naya bana
            console.log('🆕 No waiting game found, creating new for ₹' + betAmount);

            // API se room ID lo
            const roomResult = await ludoKingService.generateRoomId();

            if (!roomResult.success) {
                req.flash('error_msg', 'Failed to create game room');
                return res.redirect('/games');
            }

            // Naya game create kar
            const game = new Game({
                roomId: roomResult.roomId,
                player1: userId,
                betAmount: parseFloat(betAmount),
                betRange,
                status: 'waiting',
                player1Confirmed: false,
                player2Confirmed: false,
                createdAt: new Date()
            });

            await game.save();

            // Player1 ka bet deduct kar
            await walletService.placeBet(userId, game._id, parseFloat(betAmount));

            req.flash('success_msg', `✅ Game created! Room ID: ${game.roomId}. Waiting for opponent...`);
            res.redirect(`/games/${game._id}`);

        } catch (error) {
            console.error('❌ Game creation error:', error);
            req.flash('error_msg', 'Error creating game: ' + error.message);
            res.redirect('/games');
        }
    }

    // Join existing game
    async join(req, res) {
        try {
            const { roomId } = req.body;
            const userId = req.session.user.id;

            // Game find kar
            const game = await Game.findOne({
                roomId: roomId.trim(),
                status: 'waiting'
            });

            if (!game) {
                req.flash('error_msg', 'Invalid room ID');
                return res.redirect('/games');
            }

            // ✅ Check - Agar user already waiting game mein hai to use join na karne de
            const userWaitingGame = await Game.findOne({
                $or: [
                    { player1: userId, status: 'waiting' },
                    { player2: userId, status: 'waiting' }
                ]
            });

            if (userWaitingGame) {
                req.flash('error_msg', 'You already have a waiting game. Complete or cancel it first.');
                return res.redirect('/games');
            }

            // Check user balance
            const user = await User.findById(userId);
            if (user.walletBalance < game.betAmount) {
                req.flash('error_msg', 'Insufficient balance');
                return res.redirect('/wallet');
            }

            // Game join kar
            game.player2 = userId;
            game.status = 'active';
            await game.save();

            await walletService.placeBet(userId, game._id, game.betAmount);

            req.flash('success_msg', '✅ Joined game successfully!');
            res.redirect(`/games/${game._id}/play`);

        } catch (error) {
            console.error('❌ Join error:', error);
            req.flash('error_msg', 'Error joining game');
            res.redirect('/games');
        }
    }

    // Show game details
    async show(req, res) {
        try {
            const game = await Game.findById(req.params.id)
                .populate('player1', 'username')
                .populate('player2', 'username');

            if (!game) {
                req.flash('error_msg', 'Game not found');
                return res.redirect('/games');
            }

            // Check if user is part of this game
            const userId = req.session.user.id;
            const isPlayer = game.player1._id.toString() === userId ||
                (game.player2 && game.player2._id.toString() === userId);

            if (!isPlayer && !req.session.user.isAdmin) {
                req.flash('error_msg', 'You are not part of this game');
                return res.redirect('/games');
            }

            res.render('games/show', {
                title: `Game #${game.roomId}`,
                game,
                isPlayer1: game.player1._id.toString() === userId,
                isPlayer2: game.player2 && game.player2._id.toString() === userId
            });
        } catch (error) {
            console.error('Show game error:', error);
            req.flash('error_msg', 'Error loading game');
            res.redirect('/games');
        }
    }

    // Play game page
    async play(req, res) {
        try {
            console.log('ahssfdhga');

            const game = await Game.findById(req.params.id)
                .populate('player1', 'username')
                .populate('player2', 'username');

            if (!game) {
                req.flash('error_msg', 'Game not found');
                return res.redirect('/games');
            }

            // Check if user is part of this game
            const userId = req.session.user.id;
            const isPlayer = game.player1._id.toString() === userId ||
                (game.player2 && game.player2._id.toString() === userId);

            if (!isPlayer) {
                req.flash('error_msg', 'You are not part of this game');
                return res.redirect('/games');
            }

            // Check if game is ready to play
            if (game.status !== 'active') {
                if (game.status === 'waiting') {
                    req.flash('info_msg', 'Waiting for second player to join');
                } else {
                    req.flash('error_msg', 'Game is not active');
                }
                return res.redirect(`/games/${game._id}`);
            }

            res.render('games/play', {
                title: `Play Game - Room: ${game.roomId}`,
                game
            });
        } catch (error) {
            console.error('Play game error:', error);
            req.flash('error_msg', 'Error loading game');
            res.redirect('/games');
        }
    }

    // Submit game result (screenshot)
    async submitResult(req, res) {
        try {
            const gameId = req.params.id;
            const userId = req.session.user.id;
            const screenshot = req.file;

            if (!screenshot) {
                req.flash('error_msg', 'Please upload a screenshot');
                return res.redirect(`/games/${gameId}/play`);
            }

            const game = await Game.findById(gameId);

            if (!game) {
                req.flash('error_msg', 'Game not found');
                return res.redirect('/games');
            }

            // Check if user is part of this game
            const isPlayer1 = game.player1.toString() === userId;
            const isPlayer2 = game.player2 && game.player2.toString() === userId;

            if (!isPlayer1 && !isPlayer2) {
                req.flash('error_msg', 'You are not part of this game');
                return res.redirect('/games');
            }

            // Check if game is active
            if (game.status !== 'active') {
                req.flash('error_msg', 'Game is not active');
                return res.redirect(`/games/${gameId}`);
            }

            // Save screenshot path
            const screenshotPath = `/uploads/${screenshot.filename}`;

            // Update confirmation based on player
            if (isPlayer1) {
                game.player1Confirmed = true;
            } else {
                game.player2Confirmed = true;
            }

            // Save screenshot if not already saved
            if (!game.screenshot) {
                game.screenshot = screenshotPath;
            }

            // If both players confirmed, mark as completed
            if (game.player1Confirmed && game.player2Confirmed) {
                game.status = 'completed';
                game.completedAt = new Date();
            }

            await game.save();

            req.flash('success_msg', 'Result submitted successfully. Waiting for verification.');
            res.redirect(`/games/${gameId}`);
        } catch (error) {
            console.error('Submit result error:', error);
            req.flash('error_msg', 'Error submitting result');
            res.redirect(`/games/${req.params.id}/play`);
        }
    }

    // Confirm opponent's result
    async confirmResult(req, res) {
        try {
            const gameId = req.params.id;
            const userId = req.session.user.id;

            const game = await Game.findById(gameId);

            if (!game) {
                return res.status(404).json({ error: 'Game not found' });
            }

            // Check if user is the opponent who hasn't confirmed yet
            const isPlayer1 = game.player1.toString() === userId;
            const isPlayer2 = game.player2 && game.player2.toString() === userId;

            if (!isPlayer1 && !isPlayer2) {
                return res.status(403).json({ error: 'Not authorized' });
            }

            // Mark confirmation
            if (isPlayer1) {
                game.player1Confirmed = true;
            } else {
                game.player2Confirmed = true;
            }

            await game.save();

            res.json({
                success: true,
                message: 'Result confirmed',
                bothConfirmed: game.player1Confirmed && game.player2Confirmed
            });
        } catch (error) {
            console.error('Confirm result error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }

    // Get game history for user
    async history(req, res) {
        try {
            const userId = req.session.user.id;
            const page = parseInt(req.query.page) || 1;
            const limit = 10;
            const skip = (page - 1) * limit;

            // Get user with stats
            const user = await User.findById(userId);

            // Get games
            const games = await Game.find({
                $or: [{ player1: userId }, { player2: userId }]
            })
                .populate('player1', 'username totalWins')
                .populate('player2', 'username totalWins')
                .populate('winner', 'username')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            const total = await Game.countDocuments({
                $or: [{ player1: userId }, { player2: userId }]
            });

            res.render('games/history', {
                title: 'Game History',
                user,
                games,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            console.error('Game history error:', error);
            req.flash('error_msg', 'Error loading game history');
            res.redirect('/');
        }
    }

    // Validate bet amount against range - FIXED METHOD
    validateBetRange(amount, range) {
        console.log('Validating bet:', { amount, range });

        // Convert to number if it's a string
        const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

        if (range === '100-25000') {
            return numAmount >= 100 && numAmount <= 25000;
        } else if (range === '25000-100000') {
            return numAmount >= 25000 && numAmount <= 100000;
        }
        return false;
    }
}


module.exports = new GameController();