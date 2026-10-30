# Leak sweep — 2026-10-27

Repo: `scheissgeist/rats-overlay` (public).
Scope: current tree plus full git history on every ref.

**Result: no secrets and no copyrighted assets, in the tree or in history.** The one personal-info item is the author email in commit metadata. No key rotation is needed.

## Findings

| # | Path / commit | Type | Still in HEAD | Recommended action |
|---|---|---|---|---|
| 1 | `be83d4f` (author + committer fields) | Personal info: Sean's personal Gmail address (`s***@gmail.com`) in commit metadata | y (metadata of the only commit) | Optional. For future commits, use the GitHub `noreply` address (`git config user.email <id>+<user>@users.noreply.github.com`) and turn on GitHub's "Keep my email addresses private" and "Block command line pushes that expose my email" settings. Removing it from this commit would need a **history purge** (rewriting `be83d4f`), which is Sean's call. Low value, because the address is already exposed wherever this commit has been fetched or forked. |
| 2 | `README.md:78` (`be83d4f`) | Info only, not a secret: example `CHANNEL_POINT_REWARD_ID` UUID `6dd5…` | y | No action required. A channel-point reward ID is not a credential: Twitch sends it in IRC tags to everyone in chat, and it grants nothing. If it is the real BroTeam reward, it can be swapped for a placeholder whenever convenient. |

Checked and **not** findings:

| Path | What it is |
|---|---|
| `README.md:54` `TWITCH_TOKEN=oauth:xxxx…` | All-`x` placeholder, not a token |
| `.env.example:30` `TWITCH_TOKEN=oauth:` | Empty template value |
| `package-lock.json` `"integrity": "sha512-…"` (75 entries) | Public npm package checksums. They match long-random-string regexes, but they are not secrets. All 75 `resolved` URLs point to `https://registry.npmjs.org` with no auth tokens. |
| `server.js` | Already reads every credential from env (`process.env.TWITCH_TOKEN`, etc.) via `dotenv`. Nothing is hard-coded. |
| `public/overlay.html` | WebSocket URL is built from `location.hostname` + port `3082`. No tokens in query strings, no third-party widget URLs (StreamElements, Streamlabs, etc.). |
| `https://twitch.tv/broteam`, "BroTeamPill" in `README.md` / `LICENSE` | Public stream handle, intentionally published |

## Copyrighted material

None. The repo contains no binary files at all, in HEAD or in history (8 text files, largest is `package-lock.json` at 32 KB).

- The rats and lion are Unicode emoji (`🐀`, `🦁`) drawn by the viewer's system font, not image files.
- The squeak is generated at runtime with a Web Audio oscillator (`playSqueak()` in `public/overlay.html`). There are no audio files.
- No fonts are bundled. The CSS uses the system font stack.

## What was scanned

History: 1 commit (`be83d4f`, "Initial release: Rats Overlay") on `main`. This is the only commit reachable from any ref. `git ls-remote origin` lists only `HEAD` and `refs/heads/main`: no other branches, no tags, no `refs/pull/*`. The clone is complete (not shallow), and `git fsck` reports no dangling or unreachable objects.

| Pass | Tool / command | Result |
|---|---|---|
| Secrets, all history | `gitleaks 8.21.2`: `gitleaks git --log-opts="--all" --redact` (default ruleset, which covers Twitch, GitHub, Slack, Discord webhooks, AWS, GCP, JWT, private keys and generic API keys) | 1 commit scanned, no leaks |
| Secrets, working tree incl. untracked | `gitleaks dir --redact .` | no leaks |
| Secrets, all history | `trufflehog 3.88.0`: `trufflehog git file://… --no-verification` (all detectors) | 0 verified, 0 unverified |
| Secrets, working tree | `trufflehog filesystem . --no-verification` (excluding `.git/`) | 0 verified, 0 unverified |
| Secrets, regex over every diff | `git log -p --all -i -G` with: `oauth:[a-z0-9]{10,}`, `\b[a-z0-9]{30}\b` (Twitch token shape), `client_?secret`, `api[_-]?key`, `access_?token`, `refresh_?token`, `jwt`, `eyJ[A-Za-z0-9_-]{10,}`, `password\s*[:=]`, `passwd`, `secret\s*[:=]`, `bearer\s+…`, `discord(app)?\.com/api/webhooks`, `hooks\.slack\.com`, `streamelements`, `streamlabs`, `socket_?token`, `AKIA[0-9A-Z]{16}`, `ghp_`, `github_pat_`, `sk-[A-Za-z0-9]{20}`, `xox[bpa]-`, `AIza…`, `-----BEGIN` | Only the placeholder, the npm integrity hashes, the `password: TWITCH_TOKEN` env lookup in `server.js`, and product names in README prose |
| Tokens in URLs / query strings | `git grep` over all revisions for `https?://…`, `wss?://…` and `?param=<16+ alnum>` | Only `localhost` examples, `twitchtokengenerator.com` and `twitch.tv/broteam` |
| Secret filenames, all history | `git log --all --name-only` matched against `.env*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `credential*`, `secret*`, `id_rsa`, `.npmrc`, `.netrc`, `config.json` | Only `.env.example` (template with blank values) |
| Binary / asset files, all history | `git log --all --numstat` (binary rows) plus extension match: images, audio, video, fonts, `psd`/`aseprite`, archives | none |
| Personal info, all revisions | `git grep` for emails, US phone numbers, IPv4 addresses, street addresses / ZIP codes, plus `git log --format='%an <%ae> %cn <%ce>'` | Author/committer email only (finding 1) |
| Lockfile registries | `resolved` hosts and `_authToken` in `package-lock.json` | all 75 from `registry.npmjs.org`, no auth tokens |

## Changes in this PR (tree only)

- `.gitignore`: on top of the existing `.env`, now also ignores `.env.*` (keeping `.env.example` tracked), `*.pem`, `*.key`, `*.p12`, `*.pfx`, `credentials*` and `secrets*`, so a stray copy like `.env.local` or `.env.prod` can't be committed.
- No source changes were needed. `server.js` already loads every credential from env.

## Out of scope, noted for later

Not a leak: the HTTP API (`/api/fire`, `GET /fire`, port 3080) and the WebSocket (port 3082) have no auth and listen on all interfaces. Anyone who can reach those ports, such as others on the same LAN, or anyone if the ports are forwarded, can trigger rats or connect as an overlay. That's fine for a local OBS setup, but don't expose these ports to the internet.
