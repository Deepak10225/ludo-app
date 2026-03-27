const User = require('../models/User');
const mongoose = require('mongoose');

// Add this debug function
console.log('MongoDB Connection State:', mongoose.connection.readyState);
const { validationResult } = require('express-validator');

class AuthController {
    // Show login page
    showLogin(req, res) {
        res.render('auth/login', {
            title: 'Login - Ludo Gaming'
        });
    }

    // Process login
    async login(req, res) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('auth/login', {
                title: 'Login - Ludo Gaming',
                errors: errors.array(),
                email: req.body.email
            });
        }

        try {
            const { email, password } = req.body;

            // Find user by email
            const user = await User.findOne({ email });
            if (!user) {
                req.flash('error_msg', 'Invalid email or password');
                return res.redirect('/login');
            }

            // Check password
            const isMatch = await user.comparePassword(password);
            if (!isMatch) {
                req.flash('error_msg', 'Invalid email or password');
                return res.redirect('/login');
            }

            // Check if user is active
            if (!user.isActive) {
                req.flash('error_msg', 'Your account has been deactivated');
                return res.redirect('/login');
            }

            // Update last login
            user.lastLogin = new Date();
            await user.save();

            // Set session
            req.session.user = {
                id: user._id,
                username: user.username,
                email: user.email,
                isAdmin: user.isAdmin,
                walletBalance: user.walletBalance
            };

            req.flash('success_msg', 'Login successful!');

            // Redirect based on role
            if (user.isAdmin) {
                res.redirect('/admin/dashboard');
            } else {
                res.redirect('/games');
            }
        } catch (error) {
            console.error('Login error:', error);
            req.flash('error_msg', 'Server error. Please try again.');
            res.redirect('/login');
        }
    }

    // Show register page
    showRegister(req, res) {
        res.render('auth/register', {
            title: 'Register - Ludo Gaming'
        });
    }

    // Process registration
    async register(req, res) {
        try {
            const { username, email, password, phoneNumber, fullName, dob, gender, referral } = req.body;
            console.log(req.body);

            // Validate required fields
            if (!username || !email || !password) {
                req.flash('error_msg', 'Please fill all required fields');
                return res.redirect('/register');
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                req.flash('error_msg', 'Please enter a valid email address');
                return res.redirect('/register');
            }

            // Validate password length
            if (password.length < 6) {
                req.flash('error_msg', 'Password must be at least 6 characters');
                return res.redirect('/register');
            }

            // Check if user exists
            const existingUser = await User.findOne({
                $or: [{ email }, { username }]
            });

            if (existingUser) {
                if (existingUser.email === email) {
                    req.flash('error_msg', 'Email already registered');
                } else {
                    req.flash('error_msg', 'Username already taken');
                }
                return res.redirect('/register');
            }

            // Create new user
            console.log('askhfkdjfa');

            const user = new User({
                username: username.trim(),
                email: email.toLowerCase().trim(),
                password: password, // Will be hashed by pre-save hook
                phoneNumber: phoneNumber ? phoneNumber.trim() : '',
                fullName: fullName ? fullName.trim() : '',
                dob: dob || null,
                gender: gender || '',
                referralCode: referral ? referral.trim() : '',
                walletBalance: 0,
                isActive: true,
                isAdmin: false
            });
            console.log(user);

            // Save user to database
            await user.save();

            console.log('User registered successfully:', user.email);

            // Create welcome transaction (optional)
            try {
                const Transaction = require('../models/Transaction');
                const welcomeTransaction = new Transaction({
                    user: user._id,
                    type: 'deposit',
                    amount: 0,
                    balanceBefore: 0,
                    balanceAfter: 0,
                    status: 'completed',
                    description: 'Welcome to Ludo Gaming Platform'
                });
                await welcomeTransaction.save();
            } catch (transError) {
                console.error('Welcome transaction error:', transError);
                // Continue even if welcome transaction fails
            }

            req.flash('success_msg', 'Registration successful! Please login.');
            res.redirect('/login');

        } catch (error) {
            console.error('Registration error:', error);

            // Handle duplicate key error
            if (error.code === 11000) {
                const field = Object.keys(error.keyPattern)[0];
                req.flash('error_msg', `${field} already exists`);
                return res.redirect('/register');
            }

            // Handle validation errors
            if (error.name === 'ValidationError') {
                const messages = Object.values(error.errors).map(err => err.message);
                req.flash('error_msg', messages.join(', '));
                return res.redirect('/register');
            }

            // Generic error message for users
            req.flash('error_msg', 'Registration failed. Please try again.');
            res.redirect('/register');
        }
    }

    // Logout
    logout(req, res) {
        req.session.destroy((err) => {
            if (err) {
                console.error('Logout error:', err);
            }
            res.redirect('/');
        });
    }

    // Show profile
    async showProfile(req, res) {
        try {
            const user = await User.findById(req.session.user.id)
                .select('-password');

            res.render('auth/profile', {
                title: 'My Profile',
                user
            });
        } catch (error) {
            console.error('Profile error:', error);
            req.flash('error_msg', 'Error loading profile');
            res.redirect('/');
        }
    }

    // Update profile
    async updateProfile(req, res) {
        try {
            const { username, phoneNumber } = req.body;

            const user = await User.findById(req.session.user.id);

            user.username = username || user.username;
            user.phoneNumber = phoneNumber || user.phoneNumber;

            await user.save();

            // Update session
            req.session.user.username = user.username;

            req.flash('success_msg', 'Profile updated successfully');
            res.redirect('/profile');
        } catch (error) {
            console.error('Profile update error:', error);
            req.flash('error_msg', 'Error updating profile');
            res.redirect('/profile');
        }
    }

    // Update avatar
    async updateAvatar(req, res) {
        try {
            if (!req.file) {
                req.flash('error_msg', 'Please select an image to upload');
                return res.redirect('/profile');
            }

            const avatarPath = `/uploads/${req.file.filename}`;
            const user = await User.findById(req.session.user.id);
            user.avatar = avatarPath;
            await user.save();

            req.flash('success_msg', 'Avatar updated successfully');
            res.redirect('/profile');
        } catch (error) {
            console.error('Avatar update error:', error);
            req.flash('error_msg', 'Error uploading avatar');
            res.redirect('/profile');
        }
    }
}

module.exports = new AuthController();