const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);


app.use(express.static('public'));

let rooms = new Map(); // roomId -> hostSocketId

io.on('connection', (socket) => {
  socket.on('register-host', ({ roomId, peerId }) => {
    socket.join(roomId);
    rooms.set(roomId, { hostId: socket.id, peerId });
    socket.to(roomId).emit('host-online', { peerId });
    console.log(`[SIGNAL] Host online in ${roomId}: ${peerId}`);
  });

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    const room = rooms.get(roomId);
    if (room) {
      socket.emit('host-online', { peerId: room.peerId });
    }
  });

  socket.on('disconnect', () => {
    rooms.forEach((val, key) => {
      if (val.hostId === socket.id) rooms.delete(key);
    });
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`TradeSync Server running on http://localhost:${PORT}`);
});

