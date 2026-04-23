const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { AccessToken } = require('livekit-server-sdk');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// 🔥 Files in public/ are served automatically (including livekit-client.js)
app.use(express.static('public'));
app.use(express.json());

// 🔥 LiveKit Dev Credentials
const API_KEY = 'devkey';
const API_SECRET = 'secret';

// 🔥 Socket.io Drawing Relay
io.on('connection', (socket) => {
  console.log('⚡ User connected to drawing bridge');
  socket.on('draw-event', (data) => socket.broadcast.emit('draw-event', data));
  socket.on('clear-canvas', () => socket.broadcast.emit('clear-canvas'));
});

// 🔥 Hardened Token Generator
app.get('/getToken', async (req, res) => {
  try {
    const room = req.query.room || 'tradesync-room';
    const identity = req.query.identity || `user-${Math.floor(Math.random() * 1000)}`;

    const at = new AccessToken(API_KEY, API_SECRET, { identity });
    at.addGrant({ roomJoin: true, room: room, canPublish: true, canSubscribe: true });

    const token = await at.toJwt();
    res.send({ token });
    console.log(`✅ Token generated for: ${identity}`);
  } catch (err) {
    console.error("❌ Token generation failed:", err);
    res.status(500).send({ error: "Failed to generate token" });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'host.html'));
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`TradeSync Server Live on http://localhost:${PORT}`);
  console.log(`🚀 Token Route: /getToken`);
});
