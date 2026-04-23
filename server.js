const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { PeerServer } = require('peer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// 🔥 Start Local Peer Server on port 9000
const peerServer = PeerServer({ port: 9000, path: '/myapp' });

app.use(express.static('public'));

// 🔥 Serve PeerJS Library locally
app.get('/peerjs.min.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules', 'peerjs', 'dist', 'peerjs.min.js'));
});

// 🔥 Socket.io Drawing Relay
io.on('connection', (socket) => {
  socket.on('draw-event', (data) => socket.broadcast.emit('draw-event', data));
  socket.on('clear-canvas', () => socket.broadcast.emit('clear-canvas'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'host.html'));
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`TradeSync Pro running on http://localhost:${PORT}`);
  console.log(`📡 Local Peer Server running on port 9000`);
});
