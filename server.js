const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mediasoup = require('mediasoup');
const path = require('path');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);

app.use(express.static('public'));
// 🔥 Serve mediasoup-client locally to bypass tracking protection
app.get('/mediasoup-client.min.js', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'node_modules/mediasoup-client/dist/mediasoup-client.min.js'));
});

let worker;
let rooms = new Map(); // roomId -> { router, producers: Map, consumers: Map }

const mediaCodecs = [
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {
      'x-google-start-bitrate': 1000
    }
  }
];

// ─── Mediasoup Worker Setup ───────────────────────────
(async () => {
  worker = await mediasoup.createWorker({
    logLevel: 'warn',
    rtcMinPort: 2000,
    rtcMaxPort: 3000,
  });
  console.log('Mediasoup Worker Created');
})();

async function getOrCreateRoom(roomId) {
  if (rooms.has(roomId)) return rooms.get(roomId);
  
  const router = await worker.createRouter({ mediaCodecs });
  const roomState = { router, producers: new Map(), consumers: new Map(), hostId: null };
  rooms.set(roomId, roomState);
  return roomState;
}

// ─── Signaling ────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join', async ({ roomId, role }, cb) => {
    socket.join(roomId);
    const room = await getOrCreateRoom(roomId);
    
    if (role === 'host') room.hostId = socket.id;
    
    cb({ rtpCapabilities: room.router.rtpCapabilities });
  });

  socket.on('createWebRtcTransport', async ({ roomId }, cb) => {
    const room = rooms.get(roomId);
    const transport = await room.router.createWebRtcTransport({
      listenIps: [{ ip: '0.0.0.0', announcedIp: null }], // Set announcedIp if on a public server
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

    socket.transport = transport; // Store for this session
    
    cb({
      params: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      }
    });
  });

  socket.on('connectTransport', async ({ dtlsParameters }, cb) => {
    await socket.transport.connect({ dtlsParameters });
    cb();
  });

  socket.on('produce', async ({ kind, rtpParameters, roomId }, cb) => {
    const room = rooms.get(roomId);
    const producer = await socket.transport.produce({ kind, rtpParameters });
    room.producers.set(socket.id, producer);
    
    // Notify viewers in the room
    socket.to(roomId).emit('new-producer', { producerId: producer.id });
    cb({ id: producer.id });
  });

  socket.on('consume', async ({ rtpCapabilities, producerId, roomId }, cb) => {
    const room = rooms.get(roomId);
    if (!room.router.canConsume({ producerId, rtpCapabilities })) {
      return cb({ error: 'Cannot consume' });
    }

    const consumer = await socket.transport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    });

    cb({
      params: {
        id: consumer.id,
        producerId: consumer.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      }
    });

    socket.consumer = consumer;
  });

  socket.on('resume', async (cb) => {
    await socket.consumer.resume();
    cb();
  });
});

httpServer.listen(3000, () => {
  console.log('Mediasoup SFU Server running on http://localhost:3000');
});
