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
    winnerClaim: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    screenshotUploadedAt: {
        type: Date,
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

// ✅ Calculate winnings - 90% of total pot
gameSchema.methods.calculateWinnings = function () {
    const totalPot = this.betAmount * 2;
    const winnerShare = totalPot * 0.9; // 90% for winner
    const platformCommission = totalPot * 0.1; // 10% for platform
    return {
        totalPot,
        winnerShare,
        platformCommission
    };
};

// Generate unique room ID
gameSchema.statics.generateRoomId = function () {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Check if both players have joined
gameSchema.methods.isReady = function () {
    return this.player1 && this.player2;
};

// Mark game as completed
gameSchema.methods.complete = async function (winnerId, screenshotPath) {
    this.winnerClaim = winnerId;
    this.screenshot = screenshotPath;
    this.screenshotUploadedAt = new Date();
    this.status = 'completed';
    this.completedAt = new Date();
    await this.save();
};

// Admin verify winner
gameSchema.methods.verifyWinner = async function (adminId, notes) {
    this.winner = this.winnerClaim;
    this.adminVerified = true;
    this.adminNotes = notes || 'Verified by admin';
    await this.save();
};

// Reject winner claim
gameSchema.methods.rejectWinner = async function (adminId, reason) {
    this.status = 'disputed';
    this.adminNotes = `Rejected: ${reason}`;
    this.adminVerified = false;
    await this.save();
};

module.exports = mongoose.model('Game', gameSchema);