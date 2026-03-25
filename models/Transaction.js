const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    type: {
        type: String,
        enum: ['deposit', 'withdrawal', 'bet', 'win', 'refund', 'commission'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    balanceBefore: {
        type: Number,
        required: true
    },
    balanceAfter: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'cancelled'],
        default: 'pending'
    },
    game: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Game'
    },
    description: {
        type: String
    },
    paymentMethod: {
        type: String,
        enum: ['razorpay', 'paytm', 'phonepe', 'wallet', 'bank'],
        required: function () {
            return this.type === 'deposit' || this.type === 'withdrawal';
        }
    },
    paymentDetails: {
        type: Map,
        of: String
    },
    razorpayOrderId: {
        type: String
    },
    razorpayPaymentId: {
        type: String
    },
    razorpaySignature: {
        type: String
    },
    bankDetails: {
        accountNumber: String,
        ifscCode: String,
        accountHolderName: String
    },
    upiId: {
        type: String
    },
    processedAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Update wallet balance after transaction
transactionSchema.methods.process = async function () {
    const User = mongoose.model('User');
    const user = await User.findById(this.user);

    if (!user) throw new Error('User not found');

    this.balanceBefore = user.walletBalance;

    if (this.type === 'deposit' || this.type === 'win' || this.type === 'refund') {
        user.walletBalance += this.amount;
    } else if (this.type === 'withdrawal' || this.type === 'bet') {
        if (user.walletBalance < this.amount) {
            throw new Error('Insufficient balance');
        }
        user.walletBalance -= this.amount;
    }

    this.balanceAfter = user.walletBalance;
    this.status = 'completed';
    this.processedAt = new Date();

    await user.save();
    await this.save();

    return this;
};

module.exports = mongoose.model('Transaction', transactionSchema);