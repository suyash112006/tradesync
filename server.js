const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { AccessToken } = require('livekit-server-sdk');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));
app.use(express.json());

// 🔥 Pre-load the LiveKit Engine for injection
const lkEngineCode = fs.readFileSync(path.join(__dirname, 'public', 'livekit-client.js'), 'utf8');

// 🔥 Injection Route for Host
app.get('/host.html', (req, res) => {
  let html = fs.readFileSync(path.join(__dirname, 'public', 'host.html'), 'utf8');
  // Replace the script tag with the actual code
  html = html.replace('<script src="/livekit-client.js?v=1"></script>', `<script>${lkEngineCode}</script>`);
  res.send(html);
});

// 🔥 Injection Route for Viewer
app.get('/viewer.html', (req, res) => {
  let html = fs.readFileSync(path.join(__dirname, 'public', 'viewer.html'), 'utf8');
  html = html.replace('<script src="/livekit-client.js?v=1"></script>', `<script>${lkEngineCode}</script>`);
  res.send(html);
});

// 🔥 LiveKit Token Generator
const API_KEY = 'devkey';
const API_SECRET = 'secret';

app.get('/getToken', async (req, res) => {
  try {
    const identity = req.query.identity || `user-${Math.floor(Math.random() * 1000)}`;
    const at = new AccessToken(API_KEY, API_SECRET, { identity });
    at.addGrant({ roomJoin: true, room: 'tradesync-room', canPublish: true, canSubscribe: true });
    res.send({ token: await at.toJwt() });
  } catch (err) {
    res.status(500).send({ error: "Token failed" });
  }
});

// Socket.io Drawing Relay
io.on('connection', (socket) => {
  socket.on('draw-event', (data) => socket.broadcast.emit('draw-event', data));
  socket.on('clear-canvas', () => socket.broadcast.emit('clear-canvas'));
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`TradeSync INJECTION Server Live on http://localhost:${PORT}`);
});
