# Throuple Tea Studio 4.5 — Live Guest Connection

4.5 is the first build with a **real cross-device WebRTC guest connection**.

There are two pieces:

## A. GitHub Pages files

Upload/add these files to the ROOT of `studio_throupletea`:

- index.html
- guest-hub.css
- guest-hub.js
- guest.html
- guest.css
- guest.js
- guest-room.html
- guest-room.css
- guest-room.js
- guest-goodbye.html
- host.html
- guest-control.css
- guest-control.js
- shared-state.js
- media-tools.js
- live-guest-config.js
- live-guest.js

Keep the existing `assets/` folder.

## B. Cloudflare signaling Worker

The folder `cloudflare-signaling-worker/` is NOT uploaded to GitHub Pages.

Deploy it with Wrangler:

1. Open Terminal inside `cloudflare-signaling-worker`
2. `npm install`
3. `npx wrangler login`
4. `npm run deploy`
5. Copy the resulting `https://...workers.dev` URL
6. Put that URL into `live-guest-config.js` as `signalingBaseUrl`
7. Upload the edited `live-guest-config.js` to GitHub

Cloudflare's current Durable Object configuration requires new namespaces to use SQLite-backed Durable Objects, so the included Wrangler config uses `new_sqlite_classes`.

## First test

Use TWO SEPARATE DEVICES / NETWORK PARTICIPANTS:

1. In Guest Hub create a NEW guest invitation after installing 4.5.
   - This generates a new private room ID and room token.
2. Copy the guest link.
3. On the host Mac, open `host.html`.
4. Choose the camera/audio source the guest should receive.
   - For the three-host video later, OBS Virtual Camera can be selected if enabled.
5. Click **Start Live Connection**.
6. On the guest iPhone/iPad/other computer, open the private link.
7. Complete Tech Check → Enter Green Room.
8. The guest's live audio/video should appear on the host page.
9. The host's chosen camera/audio should appear on the guest page.

## What this does NOT change

OBS and your podcast recorder remain your recording source of truth. 4.5 is only the live guest transport.

## Production warning

4.5 uses STUN by default for the first connection test. Some hotel, corporate, cellular or restrictive networks require TURN. Before relying on this for a high-profile guest, the next reliability pass should add TURN and run disconnect/reconnect tests.
