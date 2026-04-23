import * as mediasoupClient from "https://cdn.skypack.dev/mediasoup-client";

const socket = io();
let device, sendTransport;

window.startSharing = async () => {
  console.log("Starting Screen Share...");
  
  // 1. Get Screen Stream
  const stream = await navigator.mediaDevices.getDisplayMedia({ 
    video: { frameRate: { ideal: 30 } } 
  });
  document.getElementById("video").srcObject = stream;
  const track = stream.getVideoTracks()[0];

  // 2. Get Router Capabilities
  const rtpCapabilities = await new Promise(r => socket.emit("getRtpCapabilities", r));

  // 3. Load Device
  device = new mediasoupClient.Device();
  await device.load({ routerRtpCapabilities: rtpCapabilities });

  // 4. Create Send Transport
  const params = await new Promise(r => socket.emit("createTransport", r));
  sendTransport = device.createSendTransport(params);

  sendTransport.on("connect", ({ dtlsParameters }, cb, err) => {
    socket.emit("connectTransport", { dtlsParameters });
    cb();
  });

  sendTransport.on("produce", ({ kind, rtpParameters }, cb, err) => {
    socket.emit("produce", { kind, rtpParameters }, ({ id }) => {
      cb({ id });
    });
  });

  // 5. Start Producing
  await sendTransport.produce({ track });
  console.log("✅ Streaming Live via SFU");
};
