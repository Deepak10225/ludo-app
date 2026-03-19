const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: true,
        unique: true
    },
    player1: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    player2: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    betAmount: {
        type: Number,
        required: true,
        min: 100
    },
    betRange: {
        type: String,
        enum: ['100-25000', '25000-100000'],
        required: true
    },
    status: {
        type: String,
        enum: ['waiting', 'active', 'completed', 'disputed', 'cancelled'],
        default: 'waiting'
    },
    winner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    screenshot: {
        type: String,
        default: null
    },
    player1Confirmed: {
        type: Boolean,
        default: false
    },
    player2Confirmed: {
        type: Boolean,
        default: false
    },
    adminVerified: {
        type: Boolean,
        default: false
    },
    adminNotes: {
        type: String,
        default: ''
    },
    completedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Generate unique room ID
gameSchema.statics.generateRoomId = function () {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Calculate winnings
gameSchema.methods.calculateWinnings = function () {
    return this.betAmount * 2;
};

// Check if both players have joined
gameSchema.methods.isReady = function () {
    return this.player1 && this.player2;
};

// Mark game as completed
gameSchema.methods.complete = async function (winnerId, screenshotPath) {
    this.status = 'completed';
    this.winner = winnerId;
    this.screenshot = screenshotPath;
    this.completedAt = new Date();
    await this.save();
};

module.exports = mongoose.model('Game', gameSchema);