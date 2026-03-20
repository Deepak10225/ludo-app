const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import database connection
const connectDB = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/games');
const walletRoutes = require('./routes/wallet');
const adminRoutes = require('./routes/admin');

// Initialize express
const app = express();

// Connect to database
connectDB();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(helmet({
    contentSecurityPolicy: false,
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(morgan('dev'));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// Flash messages
app.use(flash());

// Global variables for flash messages
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    res.locals.user = req.session.user || null;
    next();
});

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Routes
app.use('/', authRoutes);
app.use('/games', gameRoutes);
app.use('/wallet', walletRoutes);
app.use('/admin', adminRoutes);

// Home route
app.get('/', (req, res) => {
    res.render('index', {
        title: 'Ludo Gaming Platform - Play & Earn'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('404', {
        title: 'Page Not Found'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('500', {
        title: 'Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
});
app.use((req, res) => {
    res.status(404).render('404', {
        title: 'Page Not Found'
    });
});

// Error handler - This should be LAST
app.use((err, req, res, next) => {
    console.error('Server Error:', err.stack);

    // Set status code
    const statusCode = err.status || 500;
    res.status(statusCode);

    // Check if it's an AJAX request
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.json({
            error: true,
            message: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
        });
    }

    // Render error page
    res.render('500', {
        title: 'Server Error',
        error: process.env.NODE_ENV === 'development' ? err.stack : null,
        message: err.message
    });
});


// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to view the application`);
});
require('./jobs/cleanup');
const debugRoutes = require('./routes/debug');
app.use('/debug', debugRoutes);