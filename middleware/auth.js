const User = require('../models/User');

// Check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    }
    req.flash('error_msg', 'Please login to access this page');
    res.redirect('/login');
};

// Check if user is admin
const isAdmin = async (req, res, next) => {
    if (!req.session || !req.session.user) {
        req.flash('error_msg', 'Please login to access this page');
        return res.redirect('/login');
    }

    try {
        const user = await User.findById(req.session.user.id);
        if (user && user.isAdmin) {
            req.session.user.isAdmin = true;
            return next();
        }

        req.flash('error_msg', 'Access denied. Admin only.');
        res.redirect('/');
    } catch (error) {
        console.error('Admin check error:', error);
        req.flash('error_msg', 'Server error');
        res.redirect('/');
    }
};

// Check if user is not authenticated (for login/register pages)
const isGuest = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return next();
    }
    res.redirect('/games');
};

// Check wallet balance for game
const hasSufficientBalance = (requiredAmount) => {
    return async (req, res, next) => {
        try {
            const user = await User.findById(req.session.user.id);
            if (user.walletBalance >= requiredAmount) {
                return next();
            }
            req.flash('error_msg', `Insufficient balance. Need ₹${requiredAmount}`);
            res.redirect('/wallet');
        } catch (error) {
            console.error('Balance check error:', error);
            req.flash('error_msg', 'Error checking balance');
            res.redirect('/games');
        }
    };
};

module.exports = {
    isAuthenticated,
    isAdmin,
    isGuest,
    hasSufficientBalance
};