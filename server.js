const express = require('express');
const path = require('path');
const { AccessToken } = require('livekit-server-sdk');

const app = express();
app.use(express.static('public'));
app.use(express.json());

// 🔥 LiveKit Dev Credentials (Default for livekit-server --dev)
const API_KEY = 'devkey';
const API_SECRET = 'secret';

// 🔥 Endpoint to generate tokens for Host and Viewer
app.get('/getToken', async (req, res) => {
  const room = req.query.room || 'tradesync-room';
  const identity = req.query.identity || `user-${Math.floor(Math.random() * 1000)}`;

  const at = new AccessToken(API_KEY, API_SECRET, {
    identity: identity,
  });

  at.addGrant({ 
    roomJoin: true, 
    room: room, 
    canPublish: true, 
    canSubscribe: true 
  });

  res.send({ token: await at.toJwt() });
});

// Fallback for direct HTML access
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'host.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TradeSync Frontend running on http://localhost:${PORT}`);
  console.log(`🚀 Token endpoint ready: http://localhost:${PORT}/getToken`);
});
