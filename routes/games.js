const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const { isAuthenticated } = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');

// All game routes require authentication
router.use(isAuthenticated);

// Games listing
router.get('/', (req, res) => gameController.index(req, res));

// Create new game
router.post('/create', (req, res) => gameController.create(req, res));

// Join game
router.post('/join', (req, res) => gameController.join(req, res));

// View specific game
router.get('/:id', (req, res) => gameController.show(req, res));

// Play game
router.get('/:id/play', (req, res) => gameController.play(req, res));

// Submit result (screenshot)
router.post('/:id/result',
    upload.single('screenshot'),
    handleUploadError,
    (req, res) => gameController.submitResult(req, res)
);

// Confirm result
router.post('/:id/confirm', (req, res) => gameController.confirmResult(req, res));
// Submit result (screenshot)
router.post('/:id/result',
    upload.single('screenshot'),
    handleUploadError,
    (req, res) => gameController.submitResult(req, res)
);

// Confirm result
router.post('/:id/confirm', (req, res) => gameController.confirmResult(req, res));

// Get game status
router.get('/status/:id', async (req, res) => {
    try {
        const game = await Game.findById(req.params.id)
            .populate('player1', 'username')
            .populate('player2', 'username')
            .populate('winnerClaim', 'username');

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
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Game history
router.get('/history/all', (req, res) => gameController.history(req, res));

module.exports = router;