const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const { isAuthenticated } = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');
const catchAsync = require('../middleware/catchAsync');

// All game routes require authentication
router.use(isAuthenticated);

// Games listing
router.get('/', catchAsync((req, res) => gameController.index(req, res)));

// Create new game
router.post('/create', catchAsync((req, res) => gameController.create(req, res)));

// Join game
router.post('/join', catchAsync((req, res) => gameController.join(req, res)));

// View specific game
router.get('/:id', catchAsync((req, res) => gameController.show(req, res)));

// Play game
router.get('/:id/play', catchAsync((req, res) => gameController.play(req, res)));

// Leaderboard
router.get('/leaderboard', catchAsync((req, res) => gameController.leaderboard(req, res)));

// Submit result (screenshot)
router.post('/:id/result',
    upload.single('screenshot'),
    handleUploadError,
    catchAsync((req, res) => gameController.submitResult(req, res))
);

// Confirm result
router.post('/:id/confirm', catchAsync((req, res) => gameController.confirmResult(req, res)));

// Get game status
const Game = require('../models/Game'); // Ensure Game is imported for the status route
router.get('/status/:id', catchAsync(async (req, res) => {
    const game = await Game.findById(req.params.id)
        .populate('player1', 'username')
        .populate('player2', 'username')
        .populate('winnerClaim', 'username');

    if (!game) {
        return res.status(404).json({ success: false, error: 'Game not found' });
    }

    res.json({
        success: true,
        game: {
            status: game.status,
            player1Confirmed: game.player1Confirmed,
            player2Confirmed: game.player2Confirmed,
            bothConfirmed: game.player1Confirmed && game.player2Confirmed,
            winnerClaim: game.winnerClaim?.username || null,
            screenshot: game.screenshot,
            adminVerified: game.adminVerified
        }
    });
}));
// Game history
router.get('/history/all', catchAsync((req, res) => gameController.history(req, res)));

module.exports = router;