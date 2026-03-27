const socket = io();

// Join game room logic
function joinGameRoom(roomId) {
    socket.emit('join-game', roomId);
    console.log(`Requested to join room: ${roomId}`);
}

// Send chat message
function sendChatMessage(roomId, message, username) {
    socket.emit('send-message', { roomId, message, username });
}

// Receive chat message
socket.on('receive-message', (data) => {
    const { username, message, timestamp } = data;
    // Update chat UI (implementation will be added to the game page)
    const chatBox = document.getElementById('chat-messages');
    if (chatBox) {
        const msgElement = document.createElement('div');
        msgElement.className = 'chat-message';
        msgElement.innerHTML = `<strong>${username}:</strong> ${message}`;
        chatBox.appendChild(msgElement);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
});

// Matchmaking triggers
function joinMatchmaking(userId, betAmount) {
    socket.emit('join-matchmaking', { userId, betAmount });
    // Update matchmaking UI (e.g., show "Searching for match...")
}

socket.on('waiting-for-match', () => {
    alert('Searching for a match...');
    // Show spinner in the UI
});

socket.on('match-found', (data) => {
    const { opponentId, roomId } = data;
    alert(`Match found against player ${opponentId}! Redirecting...`);
    // Redirect functionality to the game room
    // window.location.href = `/games/play/${roomId}`;
});

// Notifications
socket.on('notification', (data) => {
    const { title, message, type } = data;
    // Show a toast notification
    if (typeof Toastify === 'function') {
        Toastify({
            text: `${title}: ${message}`,
            duration: 3000,
            close: true,
            gravity: "top", 
            position: "right", 
            stopOnFocus: true, 
            style: {
                background: type === 'success' ? "linear-gradient(to right, #00b09b, #96c93d)" : "linear-gradient(to right, #ff5f6d, #ffc371)",
            }
        }).showToast();
    } else {
        alert(`${title}: ${message}`);
    }
});
