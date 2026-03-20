const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

router.get('/check-withdrawals', async (req, res) => {
    try {
        // Check if there are any withdrawals
        const allWithdrawals = await Transaction.find({ type: 'withdrawal' })
            .populate('user', 'username email walletBalance')
            .sort({ createdAt: -1 });

        // Check pending withdrawals specifically
        const pendingWithdrawals = await Transaction.find({
            type: 'withdrawal',
            status: 'pending'
        }).populate('user', 'username');

        res.json({
            totalWithdrawals: allWithdrawals.length,
            pendingCount: pendingWithdrawals.length,
            allWithdrawals: allWithdrawals.map(w => ({
                id: w._id,
                user: w.user?.username,
                amount: w.amount,
                status: w.status,
                type: w.type,
                createdAt: w.createdAt
            })),
            pendingWithdrawals: pendingWithdrawals.map(w => ({
                id: w._id,
                user: w.user?.username,
                amount: w.amount
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Test specific withdrawal ID
router.get('/check-withdrawal/:id', async (req, res) => {
    try {
        const id = req.params.id;

        // Check if ID is valid
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.json({
                valid: false,
                error: 'Invalid ObjectId format'
            });
        }

        const withdrawal = await Transaction.findById(id)
            .populate('user', 'username');

        if (!withdrawal) {
            return res.json({
                found: false,
                message: 'Withdrawal not found'
            });
        }

        res.json({
            found: true,
            withdrawal: {
                id: withdrawal._id,
                user: withdrawal.user?.username,
                amount: withdrawal.amount,
                status: withdrawal.status,
                type: withdrawal.type
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;