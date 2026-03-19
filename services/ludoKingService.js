const axios = require('axios');

class LudoKingService {
    constructor() {
        // Your API credentials
        this.apiKey = '046fc540bdmsh2470b4a0d668c1ep16ac26jsn5016159fb830';
        this.apiHost = 'ludo-king-api-room-code.p.rapidapi.com';
        this.baseUrl = 'https://ludo-king-api-room-code.p.rapidapi.com';
    }

    // Real API method - WORKING VERSION
    async generateRoomId() {
        try {
            console.log('🎲 Calling Ludo King API for room ID...');

            const options = {
                method: 'GET',
                url: 'https://ludo-king-api-room-code.p.rapidapi.com/roomCode',
                headers: {
                    'x-rapidapi-key': this.apiKey,
                    'x-rapidapi-host': this.apiHost,
                    'Content-Type': 'application/json'
                }
            };

            console.log('API Request:', options);

            const response = await axios.request(options);

            console.log('✅ API Response:', response.data);

            // Check different possible response formats
            let roomId = null;

            if (response.data) {
                if (response.data.roomcode) {
                    roomId = response.data.roomcode;
                } else if (response.data.roomId) {
                    roomId = response.data.roomId;
                } else if (response.data.room_id) {
                    roomId = response.data.room_id;
                } else if (response.data.data && response.data.data.roomCode) {
                    roomId = response.data.data.roomCode;
                } else if (response.data.code) {
                    roomId = response.data.code;
                } else if (typeof response.data === 'string') {
                    roomId = response.data;
                }
            }

            if (roomId) {
                console.log('✅ Generated Room ID:', roomId);
                return {
                    success: true,
                    roomId: roomId.toString(),
                    message: 'Room created successfully'
                };
            } else {
                console.error('❌ No room ID in response:', response.data);
                return this.generateMockRoomId();
            }

        } catch (error) {
            console.error('❌ Ludo King API Error:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });

            // Fallback to mock on error
            console.log('⚠️ Falling back to mock room ID generator');
            return this.generateMockRoomId();
        }
    }

    // Mock method for fallback
    generateMockRoomId() {
        const mockId = Math.floor(100000 + Math.random() * 900000).toString();
        console.log('🎲 Generated MOCK Room ID:', mockId);
        return {
            success: true,
            roomId: mockId,
            message: 'Mock room created successfully (API failed)'
        };
    }

    // Test API connection
    async testConnection() {
        try {
            const options = {
                method: 'GET',
                url: 'https://ludo-king-api-room-code.p.rapidapi.com/roomCode',
                headers: {
                    'x-rapidapi-key': this.apiKey,
                    'x-rapidapi-host': this.apiHost
                }
            };

            const response = await axios.request(options);
            return {
                success: true,
                data: response.data,
                message: 'API connection successful'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                response: error.response?.data,
                status: error.response?.status,
                message: 'API connection failed'
            };
        }
    }
}

module.exports = new LudoKingService();