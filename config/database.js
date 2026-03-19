const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Remove deprecated options - they're now default in newer MongoDB drivers
        const conn = await mongoose.connect(process.env.MONGODB_URI);

        console.log(`MongoDB Connected: ${conn.connection.host}`);
        console.log(`Database: ${conn.connection.name}`);
    } catch (error) {
        console.error('Database connection error:', error.message);
        console.error('Please make sure MongoDB is running and the connection string is correct');

        // More descriptive error for common issues
        if (error.message.includes('ECONNREFUSED')) {
            console.error('\n❌ MongoDB connection refused. Please check:');
            console.error('1. Is MongoDB installed? Run: brew install mongodb-community (for macOS)');
            console.error('2. Is MongoDB running? Run: brew services start mongodb-community');
            console.error('3. Is the connection string correct? Current: ' + process.env.MONGODB_URI);
        } else if (error.message.includes('Authentication failed')) {
            console.error('\n❌ MongoDB authentication failed. Check username/password in connection string');
        }

        // Exit with failure
        process.exit(1);
    }
};

// Handle connection events
mongoose.connection.on('connected', () => {
    console.log('✅ Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('❌ Mongoose disconnected from MongoDB');
});

// Handle application termination
process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('Mongoose connection closed due to app termination');
    process.exit(0);
});

module.exports = connectDB;