# Throuple Tea Guest Studio 5.1 — Guest Codes

5.1 changes the guest entrance without touching the proven 5.0 recording architecture.

## Cloudflare Worker update REQUIRED

Open normal Terminal and run exactly:

```bash
cd "/Users/williamzakrajshek/Downloads/Throuple-Tea-Studio-5.1-Guest-Codes/cloudflare-signaling-worker"
npm install
npm run deploy
open "https://throuple-tea-live-guest-signal.round-disk-6577.workers.dev/health"
```

Expected health:

```json
{"ok":true,"service":"throuple-tea-live-guest-signal","version":"5.1","isoStorage":true}
```

No new R2 bucket is required.

## GitHub files to upload

Upload these updated root files:

- index.html
- guest-hub.css
- guest-hub.js
- guest.html
- guest.css
- guest.js
- guest-room.js
- shared-state.js
- live-guest-config.js

Keep every other 5.0 file unchanged.

## New browser flow

Host:
Invite Guest → 6-digit code generated automatically → Copy Code / Copy Invite

Guest:
guest.html → Enter Code → Tech Check → Green Room → recording workflow

## Security behavior

- actual room token is no longer in the guest invitation URL
- code resolves server-side into room credentials
- credentials are kept in sessionStorage after entry, not shown in the address bar
- codes expire after 48 hours by default
- Regenerate revokes the old code
- Revoke immediately disables the code
- Clear Guest revokes the code before clearing the host session
- code lookup is rate-limited per client
- invalid code responses are intentionally generic
- codes are tied to one private room/session
- reconnects are still allowed while the code remains active
