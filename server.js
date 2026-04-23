const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mediasoup = require("mediasoup");
const path = require("path");

const app = express();
app.use(express.static("public"));

const server = http.createServer(app);
const io = new Server(server);

let worker, router;
let producer;

(async () => {
  worker = await mediasoup.createWorker({
    logLevel: 'warn',
    rtcMinPort: 2000,
    rtcMaxPort: 3000,
  });

  router = await worker.createRouter({
    mediaCodecs: [
      {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
        parameters: { 'x-google-start-bitrate': 1000 }
      }
    ]
  });

  console.log("🔥 Mediasoup SFU Ready");
})();

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("getRtpCapabilities", (cb) => {
    cb(router.rtpCapabilities);
  });

  socket.on("createTransport", async (cb) => {
    const transport = await router.createWebRtcTransport({
      listenIps: [{ ip: "0.0.0.0", announcedIp: null }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true
    });

    cb({
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters
    });

    socket.transport = transport;
  });

  socket.on("connectTransport", async ({ dtlsParameters }) => {
    if (socket.transport) await socket.transport.connect({ dtlsParameters });
  });

  socket.on("produce", async ({ kind, rtpParameters }, cb) => {
    producer = await socket.transport.produce({ kind, rtpParameters });
    socket.broadcast.emit("new-producer"); // Notify viewers
    cb({ id: producer.id });
  });

  socket.on("consume", async ({ rtpCapabilities }, cb) => {
    if (!producer) return cb({ error: "No producer" });

    const consumer = await socket.transport.consume({
      producerId: producer.id,
      rtpCapabilities,
      paused: false
    });

    cb({
      id: consumer.id,
      producerId: producer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters
    });
  });
});

server.listen(3000, () => console.log("TradeSync SFU running on http://localhost:3000"));
