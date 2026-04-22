# TradeSync — Setup & Deploy Guide

## What This Does
- **Yash** opens `/host` → shares his TradingView screen
- **You** open `/viewer` → see his screen live + draw on it
- Your drawings appear on Yash's screen instantly
- Both can draw simultaneously

---

## Step 1 — Install Node.js (one time)
Download from: https://nodejs.org (LTS version)

---

## Step 2 — Run Locally (to test on same network)

```bash
cd trading-collab
npm install
node server.js
```

- Yash: http://localhost:3000/host
- You:  http://localhost:3000/viewer

---

## Step 3 — Deploy Free on Render.com (different networks)

1. Create free account → https://render.com
2. Upload folder to a GitHub repo
3. Render → New Web Service → connect repo
4. Build Command: `npm install`
5. Start Command: `node server.js`
6. Plan: Free → Deploy

Your URL: `https://your-app.onrender.com`

- Yash: `https://your-app.onrender.com/host`
- You:  `https://your-app.onrender.com/viewer`

---

## How to Use

**Yash (Host):**
1. Open /host in Chrome
2. Click ▶ Start Sharing → select TradingView tab
3. Wait for viewer (status turns green)

**You (Viewer):**
1. Open /viewer in Chrome
2. Yash's screen appears automatically
3. Draw on it → Yash sees it instantly

---

## Notes
- Use Chrome/Edge for best results
- Free Render plan sleeps after 15min idle — just refresh to wake
- Video is peer-to-peer (Yash→You direct), drawings go via server
