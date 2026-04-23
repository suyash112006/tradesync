const express = require('express');
const path = require('path');

const app = express();

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// 🔥 Serve PeerJS locally with strict MIME type
app.get('/peerjs.min.js', (req, res) => {
  const scriptPath = path.join(__dirname, 'node_modules', 'peerjs', 'dist', 'peerjs.min.js');
  res.type('application/javascript');
  res.sendFile(scriptPath);
});

// Fallback for direct HTML access
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'host.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TradeSync Simple Server running on http://localhost:${PORT}`);
  console.log(`✅ PeerJS Library Linked: http://localhost:${PORT}/peerjs.min.js`);
});
