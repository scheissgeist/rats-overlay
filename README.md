# Rats Overlay

Drop rats on your Twitch stream. A tiny OBS browser-source overlay that spawns emoji rats running across the screen when your viewers trigger it. Comes with squeak sounds, random colors, and a rare lion easter egg.

Built for [BroTeamPill](https://twitch.tv/broteam)'s stream. Shared because it rules.

## What it does

- Viewers type `!rats` in chat (or `!rats 15` for a custom count) and a swarm of rats runs across your screen with squeaks
- Or they redeem a Twitch channel point reward and get the same thing
- Or you hit a REST endpoint from your dashboard, Streamer.bot, Streamlabs, or anything else that speaks HTTP
- Rats have random colors, random sizes, random directions, and random squeak pitches
- Every rat has a 1 in 1000 chance of being a lion instead
- If 3+ rats are released, a label shows who sent them

## Quick start

```bash
git clone <this repo>
cd rats-overlay
npm install
cp .env.example .env     # fill in your triggers — see below
node server.js
```

Then add a **Browser Source** in OBS pointing at:

```
http://localhost:3080/overlay.html
```

Set the width/height to match your canvas (usually 1920×1080). Make sure "Control audio via OBS" is checked if you want the squeaks routed through your audio scene.

That's it. Fire a test run by opening this in your browser:

```
http://localhost:3080/fire?count=15&user=TestUser
```

You should see rats running across your OBS preview.

## Triggers

Three ways to fire rats. Enable any combination you want by filling in `.env`.

### 1. Twitch chat command

Anyone in your chat can type `!rats` or `!rats 15` to drop rats on screen. Has a per-user cooldown (default 15 seconds) so it can't be spammed.

To enable, set these in `.env`:

```env
TWITCH_USERNAME=yourbotname
TWITCH_TOKEN=oauth:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWITCH_CHANNEL=yourchannelname
CHAT_COMMAND_ENABLED=true
CHAT_COMMAND=!rats
CHAT_COMMAND_COOLDOWN_MS=15000
```

**To get a Twitch token:**

1. Go to [twitchtokengenerator.com](https://twitchtokengenerator.com/)
2. Click **Custom Scope Token**
3. Check `chat:read` and `chat:edit`
4. Log in as your bot account (or your own account — either works)
5. Copy the **Access Token** and put it in `.env` with the `oauth:` prefix

You can change the command name by setting `CHAT_COMMAND=!ratattack` or whatever you want.

### 2. Twitch channel point reward

Create a custom channel point reward in your Twitch dashboard (e.g. "🐀 Release the rats"). Optionally enable "Require viewer to enter text" so they can specify a count.

Grab the reward's UUID (find it in your reward list URL or in the chat tags on a test redemption) and add it to `.env`:

```env
CHANNEL_POINT_REWARD_ID=6dd5bf20-2f25-44f9-b7c9-c07c7281c451
```

Requires `TWITCH_TOKEN` to be set too, because channel point redemptions arrive through chat tags.

If the viewer types a number in their redemption message (e.g. `15`), that becomes the count. Otherwise a random number is rolled.

### 3. REST API (always on)

No config needed. Anything that can make an HTTP request can fire rats.

```bash
# JSON POST
curl -X POST http://localhost:3080/api/fire \
  -H "Content-Type: application/json" \
  -d '{"count":15,"user":"CoolViewer"}'

# Simple GET (easier to test from a browser bar)
curl "http://localhost:3080/fire?count=15&user=CoolViewer"
```

Wire this up to:

- **Streamer.bot** — add an HTTP action that POSTs to `/api/fire`
- **Streamlabs** — hook a donation or follow alert to an HTTP action
- **StreamElements** — same
- **Your own dashboard button** — a plain `<button onclick="fetch('/api/fire', ...)">Release rats</button>`
- **Hotkey** — map a global hotkey to a `curl` command

## Configuration reference

All options live in `.env` (copy from `.env.example`).

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `3080` | HTTP server port (overlay + API) |
| `WS_PORT` | `3082` | WebSocket server port (overlay connection) |
| `DEFAULT_COUNT` | `10` | Rat count when viewer doesn't specify one |
| `MAX_COUNT` | `100` | Hard cap on rats per fire (prevents browser lag) |
| `TWITCH_USERNAME` | — | Your bot account username (or your own) |
| `TWITCH_TOKEN` | — | OAuth token with `oauth:` prefix, scopes `chat:read` and `chat:edit` |
| `TWITCH_CHANNEL` | — | Channel name to join (no `#`) |
| `CHAT_COMMAND_ENABLED` | `true` | Set to `false` to disable chat triggers |
| `CHAT_COMMAND` | `!rats` | The command viewers type |
| `CHAT_COMMAND_COOLDOWN_MS` | `15000` | Per-user cooldown in milliseconds |
| `CHANNEL_POINT_REWARD_ID` | — | UUID of the custom reward that fires rats |

## Customization

Want pink rats only? Different emoji? Longer trails? Edit [public/overlay.html](public/overlay.html) — the CSS and the `spawnRat()` function are right there and well commented.

Want to change the squeak pitch? Edit `playSqueak()` in the same file.

Want a different sound entirely? Drop in an MP3 and play it with `new Audio(...)` instead of the oscillator.

## Status endpoint

`GET /api/status` returns a JSON blob with how many overlay clients are connected, whether chat is connected, and which triggers are configured. Good for dashboards or monitoring.

```json
{
  "ok": true,
  "overlayClients": 1,
  "chatConnected": true,
  "triggers": {
    "chatCommand": "!rats",
    "channelPointRewardId": null,
    "rest": "POST /api/fire or GET /fire"
  }
}
```

## Troubleshooting

**Rats don't show up in OBS but they work in my browser.**
OBS Browser Source caches aggressively. Right-click the source → **Properties** → **Refresh cache of current page**. If that doesn't work, delete and re-add the source.

**"Rats overlay: reconnecting…" stays visible on the overlay.**
The WebSocket can't reach the server. Check that `node server.js` is actually running and that `WS_PORT` in `.env` matches what the overlay connects to. If the overlay is on a different machine than the server, open port 3082 on the server's firewall.

**Chat command does nothing.**
Check the server console for `[Chat] Connected to #yourchannel`. If you don't see that line, your `TWITCH_TOKEN` is bad — regenerate it at [twitchtokengenerator.com](https://twitchtokengenerator.com/) with the right scopes. The per-user cooldown will also silently skip if the same user fires too fast — wait 15 seconds and try again from a different account.

**Rats are lagging OBS.**
Lower `MAX_COUNT` in `.env`. 100 is the upper limit that still performs OK on most hardware. Chromium-based browser sources don't love hundreds of animated emoji.

**Squeaks don't play.**
Browser autoplay policy. OBS Browser Source should allow autoplay by default, but if you're testing in a real browser, you need to click the page once before audio will play.

## License

MIT. Do whatever you want with it. Credit would be nice but isn't required.

---

Made with 🐀 for [BroTeam](https://twitch.tv/broteam).
