const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');


const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });


app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', 1);
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/lobby', (req, res) => res.sendFile(path.join(__dirname, 'public', 'lobby.html')));
app.get('/host', (req, res) => res.sendFile(path.join(__dirname, 'public', 'host.html')));
app.get('/viewer', (req, res) => res.sendFile(path.join(__dirname, 'public', 'viewer.html')));

// ─── ICE / TURN Config Endpoint ───────────────────────
// Serves reliable free TURN servers over TCP port 443 (works on Render)
app.get('/api/ice', (req, res) => {
  res.json({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      {
        urls: [
          'turn:openrelay.metered.ca:443?transport=tcp',
          'turns:openrelay.metered.ca:443'
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: [
          'turn:freeturn.net:3478',
          'turn:freeturn.net:5349',
          'turns:freeturn.net:5349'
        ],
        username: 'free',
        credential: 'free'
      }
    ]
  });
});


// Room structure: roomId -> { hostId, viewerId }
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);
  let currentRoomId = null;
  let currentRole = null;

  socket.on('register-host', (roomId) => {
    if (!roomId) return;
    currentRoomId = roomId;
    currentRole = 'host';
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { hostId: socket.id, viewerId: null, startTime: null });
    } else {
      const room = rooms.get(roomId);
      room.hostId = socket.id;
    }
    
    socket.join(roomId);
    socket.emit('role-confirmed', 'host');
    
    const room = rooms.get(roomId);
    if (room.viewerId) {
      io.to(room.viewerId).emit('host-online');
      socket.emit('viewer-joined');
    }
    console.log(`Host registered for room: ${roomId}`);
  });

  socket.on('register-viewer', (roomId) => {
    if (!roomId) return;
    currentRoomId = roomId;
    currentRole = 'viewer';
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { hostId: null, viewerId: socket.id, startTime: null });
    } else {
      const room = rooms.get(roomId);
      room.viewerId = socket.id;
    }
    
    socket.join(roomId);
    socket.emit('role-confirmed', 'viewer');
    
    const room = rooms.get(roomId);
    if (room.hostId) {
      socket.emit('host-online');
      if (room.startTime) socket.emit('session-start', room.startTime);
      io.to(room.hostId).emit('viewer-joined');
    }
    console.log(`Viewer registered for room: ${roomId}`);
  });

  socket.on('offer', (data) => {
    const { roomId, offer } = data;
    const room = rooms.get(roomId || currentRoomId);
    if (!room) return;
    const target = socket.id === room.hostId ? room.viewerId : room.hostId;
    if (target) io.to(target).emit('offer', offer);
  });

  socket.on('answer', (data) => {
    const { roomId, answer } = data;
    const room = rooms.get(roomId || currentRoomId);
    if (!room) return;
    const target = socket.id === room.hostId ? room.viewerId : room.hostId;
    if (target) io.to(target).emit('answer', answer);
  });

  socket.on('ice-candidate', (data) => {
    const { roomId, candidate } = data;
    const room = rooms.get(roomId || currentRoomId);
    if (!room) return;
    const target = socket.id === room.hostId ? room.viewerId : room.hostId;
    if (target) io.to(target).emit('ice-candidate', candidate);
  });

  socket.on('draw-event', (data) => {
    const room = rooms.get(currentRoomId);
    if (!room) return;
    const target = socket.id === room.hostId ? room.viewerId : room.hostId;
    if (target) io.to(target).emit('draw-event', data);
  });

  socket.on('clear-canvas', () => {
    if (currentRoomId) io.to(currentRoomId).emit('clear-canvas');
  });

  socket.on('session-start', (timestamp) => {
    const room = rooms.get(currentRoomId);
    if (room) {
      room.startTime = timestamp;
      io.to(currentRoomId).emit('session-start', timestamp);
    }
  });

  socket.on('stop-sharing', () => {
    const room = rooms.get(currentRoomId);
    if (room) {
      room.startTime = null;
      io.to(currentRoomId).emit('stop-sharing');
    }
  });

  socket.on('disconnect', () => {
    if (currentRoomId && rooms.has(currentRoomId)) {
      const room = rooms.get(currentRoomId);
      if (currentRole === 'host' && room.hostId === socket.id) {
        if (room.viewerId) io.to(room.viewerId).emit('host-offline');
        rooms.delete(currentRoomId); 
        console.log(`[ROOM] Closed room ${currentRoomId} because host left.`);
      } else if (currentRole === 'viewer' && room.viewerId === socket.id) {
        room.viewerId = null;
        if (room.hostId) io.to(room.hostId).emit('viewer-disconnected');
      }
    }
    console.log('Disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
