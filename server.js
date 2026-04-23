const express = require('express');
const path = require('path');

const app = express();

// Serve static files from the 'public' directory
app.use(express.static('public'));

// 🔥 Serve PeerJS locally to bypass Tracking Prevention
app.get('/peerjs.min.js', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'node_modules/peerjs/dist/peerjs.min.js'));
});

// Fallback for direct HTML access
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'host.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TradeSync Simple Server running on http://localhost:${PORT}`);
});
