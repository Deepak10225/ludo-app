const Game = require('../models/Game');

module.exports = (io) => {
    const matchmakingQueue = [];

    io.on('connection', (socket) => {
        console.log('New client connected:', socket.id);

        // Join a specific game room
        socket.on('join-game', (roomId) => {
            socket.join(roomId);
            console.log(`User ${socket.id} joined room: ${roomId}`);
        });

        // Handle in-game chat
        socket.on('send-message', (data) => {
            const { roomId, message, username } = data;
            io.to(roomId).emit('receive-message', {
                username,
                message,
                timestamp: new Date()
            });
        });

        // Simple Matchmaking logic
        socket.on('join-matchmaking', (userData) => {
            const { userId, betAmount } = userData;
            
            // Check if someone with same bet is already waiting
            const matchIndex = matchmakingQueue.findIndex(p => p.betAmount === betAmount && p.userId !== userId);
            
            if (matchIndex !== -1) {
                const opponent = matchmakingQueue.splice(matchIndex, 1)[0];
                // Notify both players that a match is found
                io.to(socket.id).emit('match-found', { opponentId: opponent.userId, roomId: 'TBD' });
                io.to(opponent.socketId).emit('match-found', { opponentId: userId, roomId: 'TBD' });
            } else {
                matchmakingQueue.push({ socketId: socket.id, userId, betAmount });
                socket.emit('waiting-for-match');
            }
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
            // Remove from matchmaking queue if disconnected
            const index = matchmakingQueue.findIndex(p => p.socketId === socket.id);
            if (index !== -1) matchmakingQueue.splice(index, 1);
        });
    });
};
