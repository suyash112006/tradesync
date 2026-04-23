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
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.relay.metered.ca:80' },
      // GLOBAL METERED RELAY (TCP/UDP)
      {
        urls: [
          'turn:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:443',
          'turn:openrelay.metered.ca:443?transport=tcp',
          'turns:openrelay.metered.ca:443',
          'turns:openrelay.metered.ca:443?transport=tcp'
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      // GLOBAL VIAGENIE RELAY
      {
        urls: 'turn:numb.viagenie.ca',
        username: 'numb@viagenie.ca',
        credential: 'numb'
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
      rooms.set(roomId, { hostId: socket.id, viewers: new Set(), startTime: null });
    } else {
      const room = rooms.get(roomId);
      room.hostId = socket.id;
    }
    
    socket.join(roomId);
    socket.emit('role-confirmed', 'host');
    
    const room = rooms.get(roomId);
    if (room.viewers.size > 0) {
      room.viewers.forEach(vid => io.to(vid).emit('host-online'));
      room.viewers.forEach(vid => socket.emit('viewer-joined', { viewerId: vid }));
    }
    console.log(`Host registered for room: ${roomId}`);
  });

  socket.on('register-viewer', (roomId) => {
    if (!roomId) return;
    currentRoomId = roomId;
    currentRole = 'viewer';
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { hostId: null, viewers: new Set([socket.id]), startTime: null });
    } else {
      const room = rooms.get(roomId);
      room.viewers.add(socket.id);
    }
    
    socket.join(roomId);
    socket.emit('role-confirmed', 'viewer');
    
    const room = rooms.get(roomId);
    if (room.hostId) {
      if (room.startTime) socket.emit('session-start', room.startTime);
      io.to(room.hostId).emit('viewer-joined', { viewerId: socket.id });
    }

    console.log(`Viewer registered for room: ${roomId}`);
  });

  socket.on('offer', (data) => {
    // data: { roomId, target, offer }
    if (data.target) {
      io.to(data.target).emit('offer', { offer: data.offer, from: socket.id });
    }
  });

  socket.on('answer', (data) => {
    // data: { roomId, target, answer }
    if (data.target) {
      io.to(data.target).emit('answer', { answer: data.answer, from: socket.id });
    }
  });

  socket.on('ice-candidate', (data) => {
    // data: { roomId, target, candidate }
    if (data.target) {
      io.to(data.target).emit('ice-candidate', { candidate: data.candidate, from: socket.id });
    }
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
