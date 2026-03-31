const Game = require('../models/Game');

module.exports = (io) => {
    const matchmakingQueue = [];

    io.on('connection', (socket) => {
        console.log('New client connected:', socket.id);

        // Join a specific game room
        socket.on('join-game', (roomId) => {
            try {
                if (!roomId) return;
                socket.join(roomId);
                console.log(`User ${socket.id} joined room: ${roomId}`);
            } catch (err) {
                console.error('Socket join-game error:', err);
            }
        });

        // Handle in-game chat
        socket.on('send-message', (data) => {
            try {
                if (!data) return;
                const { roomId, message, username } = data;
                if (!roomId || !message) return;
                io.to(roomId).emit('receive-message', {
                    username: username || 'Guest',
                    message,
                    timestamp: new Date()
                });
            } catch (err) {
                console.error('Socket send-message error:', err);
            }
        });

        // Simple Matchmaking logic
        socket.on('join-matchmaking', (userData) => {
            try {
                if (!userData) return;
                const { userId, betAmount } = userData;
                if (!userId || !betAmount) return;
                
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
            } catch (err) {
                console.error('Socket join-matchmaking error:', err);
            }
        });

        socket.on('disconnect', () => {
            try {
                console.log('Client disconnected:', socket.id);
                // Remove from matchmaking queue if disconnected
                const index = matchmakingQueue.findIndex(p => p.socketId === socket.id);
                if (index !== -1) matchmakingQueue.splice(index, 1);
            } catch (err) {
                console.error('Socket disconnect error:', err);
            }
        });
    });
};
