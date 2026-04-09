/**
 * Rats Overlay — tiny standalone Twitch overlay that drops rats on your stream.
 *
 * What it does:
 *   - Serves an HTML overlay at http://localhost:3080/overlay.html for OBS browser source
 *   - Opens a WebSocket on port 3082 that the overlay connects to
 *   - Exposes POST /api/fire to spawn rats programmatically (for channel point webhooks,
 *     dashboard buttons, Streamlabs, Streamer.bot, etc.)
 *   - Optionally connects to Twitch chat via tmi.js and listens for a !rats chat command
 *
 * How to use:
 *   1. npm install
 *   2. Copy .env.example → .env and fill in whatever triggers you want (chat, channel point, or just REST)
 *   3. node server.js
 *   4. Add a Browser Source in OBS pointing at http://localhost:3080/overlay.html
 *   5. Fire rats from chat with !rats or !rats 15, or POST to /api/fire, or hit /fire in your browser
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const PORT = parseInt(process.env.PORT) || 3080;
const WS_PORT = parseInt(process.env.WS_PORT) || 3082;

// Trigger config
const CHAT_COMMAND_ENABLED = (process.env.CHAT_COMMAND_ENABLED ?? 'true').toLowerCase() !== 'false';
const CHAT_COMMAND = (process.env.CHAT_COMMAND || '!rats').toLowerCase();
const CHAT_COMMAND_COOLDOWN_MS = parseInt(process.env.CHAT_COMMAND_COOLDOWN_MS) || 15000;
const DEFAULT_COUNT = parseInt(process.env.DEFAULT_COUNT) || 10;
const MAX_COUNT = parseInt(process.env.MAX_COUNT) || 100;
const CHANNEL_POINT_REWARD_ID = process.env.CHANNEL_POINT_REWARD_ID || '';

const TWITCH_USERNAME = process.env.TWITCH_USERNAME || '';
const TWITCH_TOKEN = process.env.TWITCH_TOKEN || '';
const TWITCH_CHANNEL = process.env.TWITCH_CHANNEL || '';

// ─── Express + WebSocket setup ─────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const wss = new WebSocket.Server({ port: WS_PORT });
const overlayClients = new Set();

wss.on('connection', (ws) => {
  overlayClients.add(ws);
  console.log(`[WS] Overlay connected (${overlayClients.size} total)`);
  ws.on('close', () => {
    overlayClients.delete(ws);
    console.log(`[WS] Overlay disconnected (${overlayClients.size} total)`);
  });
  ws.on('error', () => {});
});

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const ws of overlayClients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

// ─── The core action: drop rats on the overlay ─────────────────────────────

function fireRats(count, user = null) {
  count = Math.max(1, Math.min(parseInt(count) || DEFAULT_COUNT, MAX_COUNT));
  console.log(`[Rats] ${user || 'anonymous'} released ${count} rats`);
  broadcast({ type: 'rats', count, user });
  return count;
}

// ─── HTTP routes ────────────────────────────────────────────────────────────

// POST /api/fire — programmatic trigger. Body: { count?: number, user?: string }
// Also accepts a simple GET for quick browser-bar testing.
app.post('/api/fire', (req, res) => {
  const count = fireRats(req.body?.count, req.body?.user);
  res.json({ ok: true, count });
});
app.get('/fire', (req, res) => {
  const count = fireRats(req.query.count, req.query.user);
  res.json({ ok: true, count });
});

// Simple health + status
app.get('/api/status', (req, res) => {
  res.json({
    ok: true,
    overlayClients: overlayClients.size,
    chatConnected: chatConnected,
    triggers: {
      chatCommand: CHAT_COMMAND_ENABLED ? CHAT_COMMAND : null,
      channelPointRewardId: CHANNEL_POINT_REWARD_ID || null,
      rest: 'POST /api/fire or GET /fire',
    },
  });
});

// Default root → overlay
app.get('/', (req, res) => res.redirect('/overlay.html'));

const server = http.createServer(app);
server.listen(PORT, () => {
  console.log('');
  console.log(`  Rats Overlay running`);
  console.log(`  HTTP:    http://localhost:${PORT}`);
  console.log(`  Overlay: http://localhost:${PORT}/overlay.html  ← use this in OBS`);
  console.log(`  WS:      ws://localhost:${WS_PORT}`);
  console.log('');
  console.log(`  Fire rats:`);
  console.log(`    curl -X POST http://localhost:${PORT}/api/fire -H "Content-Type: application/json" -d '{"count":15,"user":"TestUser"}'`);
  console.log(`    browser: http://localhost:${PORT}/fire?count=15&user=TestUser`);
  if (CHAT_COMMAND_ENABLED && TWITCH_TOKEN) console.log(`    chat:    ${CHAT_COMMAND} or ${CHAT_COMMAND} 20`);
  if (CHANNEL_POINT_REWARD_ID) console.log(`    channel point reward: ${CHANNEL_POINT_REWARD_ID}`);
  console.log('');
});

// ─── Twitch chat trigger (optional) ─────────────────────────────────────────
// If TWITCH_TOKEN is set, connect to chat with tmi.js and listen for:
//   - the configured CHAT_COMMAND (default "!rats")
//   - channel point custom-reward-id matching CHANNEL_POINT_REWARD_ID

let chatConnected = false;
const userCooldowns = new Map();

if (TWITCH_TOKEN && TWITCH_CHANNEL) {
  try {
    const tmi = require('tmi.js');
    const client = new tmi.Client({
      connection: { secure: true, reconnect: true },
      identity: { username: TWITCH_USERNAME || TWITCH_CHANNEL, password: TWITCH_TOKEN },
      channels: [TWITCH_CHANNEL],
    });

    client.on('connected', () => {
      chatConnected = true;
      console.log(`[Chat] Connected to #${TWITCH_CHANNEL}`);
    });

    client.on('disconnected', () => {
      chatConnected = false;
      console.log(`[Chat] Disconnected`);
    });

    client.on('message', (channel, tags, message, self) => {
      if (self) return;
      const user = tags['display-name'] || tags.username || 'anonymous';
      const rewardId = tags['custom-reward-id'];

      // Channel point redemption (Twitch puts the reward ID on the message tag)
      if (rewardId && CHANNEL_POINT_REWARD_ID && rewardId === CHANNEL_POINT_REWARD_ID) {
        // If the user typed a number in the redemption message, use it as the count
        const numMatch = message.match(/(\d+)/);
        const count = numMatch
          ? Math.max(1, Math.min(parseInt(numMatch[1]), MAX_COUNT))
          : DEFAULT_COUNT + Math.floor(Math.random() * 10);
        fireRats(count, user);
        return;
      }

      // Chat command
      if (CHAT_COMMAND_ENABLED) {
        const lower = message.trim().toLowerCase();
        if (lower === CHAT_COMMAND || lower.startsWith(CHAT_COMMAND + ' ')) {
          // Per-user cooldown
          const now = Date.now();
          const last = userCooldowns.get(user.toLowerCase()) || 0;
          if (now - last < CHAT_COMMAND_COOLDOWN_MS) {
            return;  // silently ignore — don't spam chat with "cooldown" messages
          }
          userCooldowns.set(user.toLowerCase(), now);

          // Parse optional count: "!rats 15" → 15
          const parts = lower.split(/\s+/);
          const count = parts[1] ? parseInt(parts[1]) : DEFAULT_COUNT;
          fireRats(count, user);
        }
      }
    });

    client.connect().catch(err => {
      console.error(`[Chat] Connection failed: ${err}`);
      console.error(`[Chat] Chat triggers disabled. REST API still works.`);
    });
  } catch (err) {
    console.error(`[Chat] tmi.js not available or failed to start: ${err.message}`);
    console.error(`[Chat] Chat triggers disabled. REST API still works.`);
  }
} else {
  console.log(`[Chat] No TWITCH_TOKEN/TWITCH_CHANNEL in .env — chat triggers disabled. REST API still works.`);
}
