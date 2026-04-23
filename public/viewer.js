import * as mediasoupClient from "https://cdn.skypack.dev/mediasoup-client";

const socket = io();
let device, recvTransport;

async function init() {
  console.log("Initializing Viewer...");

  // 1. Get Router Capabilities
  const rtpCapabilities = await new Promise(r => socket.emit("getRtpCapabilities", r));

  // 2. Load Device
  device = new mediasoupClient.Device();
  await device.load({ routerRtpCapabilities: rtpCapabilities });

  // 3. Create Recv Transport
  const params = await new Promise(r => socket.emit("createTransport", r));
  recvTransport = device.createRecvTransport(params);

  recvTransport.on("connect", ({ dtlsParameters }, cb, err) => {
    socket.emit("connectTransport", { dtlsParameters });
    cb();
  });

  // 4. Consume Producer
  const data = await new Promise(r =>
    socket.emit("consume", { rtpCapabilities: device.rtpCapabilities }, r)
  );

  if (data.error) {
    console.warn("No stream available yet. Waiting...");
    return;
  }

  const consumer = await recvTransport.consume({
    id: data.id,
    producerId: data.producerId,
    kind: data.kind,
    rtpParameters: data.rtpParameters
  });

  const stream = new MediaStream();
  stream.addTrack(consumer.track);

  document.getElementById("video").srcObject = stream;
  console.log("✅ Viewing Live via SFU");
}

// Re-init when a new host starts
socket.on("new-producer", () => {
  console.log("New host detected! Re-connecting...");
  init();
});

init();
