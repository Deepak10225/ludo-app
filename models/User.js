const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters']
    },
    phoneNumber: {
        type: String,
        trim: true,
        default: ''
    },
    fullName: {
        type: String,
        trim: true,
        default: ''
    },
    dob: {
        type: Date,
        default: null
    },
    gender: {
        type: String,
        enum: ['', 'male', 'female', 'other'],
        default: ''
    },
    referralCode: {
        type: String,
        default: ''
    },
    walletBalance: {
        type: Number,
        default: 0,
        min: 0
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    totalGames: {
        type: Number,
        default: 0
    },
    totalWins: {
        type: Number,
        default: 0
    },
    totalLosses: {
        type: Number,
        default: 0
    },
    totalEarnings: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date
    }
}, {
    timestamps: true
});

// CORRECT ASYNC MIDDLEWARE - NO NEXT() PARAMETER
userSchema.pre('save', async function () {
    try {
        // Only hash if password is modified
        if (!this.isModified('password')) {
            return;
        }

        // Generate salt and hash password
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
        throw error; // Mongoose will catch this
    }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

module.exports = mongoose.model('User', userSchema);