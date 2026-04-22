const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.redirect('/viewer'));
app.get('/host', (req, res) => res.sendFile(path.join(__dirname, 'public', 'host.html')));
app.get('/viewer', (req, res) => res.sendFile(path.join(__dirname, 'public', 'viewer.html')));

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

  // Dedicated relay for signals within a room
  socket.on('offer', (data) => {
    const room = rooms.get(currentRoomId);
    if (!room) return;
    const target = socket.id === room.hostId ? room.viewerId : room.hostId;
    if (target) io.to(target).emit('offer', data);
  });

  socket.on('answer', (data) => {
    const room = rooms.get(currentRoomId);
    if (!room) return;
    const target = socket.id === room.hostId ? room.viewerId : room.hostId;
    if (target) io.to(target).emit('answer', data);
  });

  socket.on('ice-candidate', (data) => {
    const room = rooms.get(currentRoomId);
    if (!room) return;
    const target = socket.id === room.hostId ? room.viewerId : room.hostId;
    if (target) io.to(target).emit('ice-candidate', data);
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
      if (currentRole === 'host') {
        if (room.viewerId) io.to(room.viewerId).emit('host-offline');
        rooms.delete(currentRoomId); // Close room if host leaves
      } else if (currentRole === 'viewer') {
        room.viewerId = null;
        if (room.hostId) io.to(room.hostId).emit('peer-disconnected');
      }
    }
    console.log('Disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
