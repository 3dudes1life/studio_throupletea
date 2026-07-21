# Throuple Tea Guest Studio — First-Upload Prototype

A browser-based production prototype for **3Dudes1Life: A Little Throuple Tea**.

This package is intentionally much more than a visual mockup. It lets the hosts test the full episode workflow before adding authentication, databases, remote WebSockets or actual recording infrastructure.

## Included screens

- `index.html` — Studio Launcher and live session summary
- `setup.html` — Episode, guest, questions, scripts and run-of-show builder
- `guest.html` — Personalized Guest Lounge with real camera/microphone testing
- `studio.html` — Guest-facing recording screen
- `host.html` — Host Control Room
- `graphics.html` — Transparent OBS browser-source output

## What works in this prototype

- Personalized guest links using URL parameters
- Browser camera preview and microphone level meter
- Camera and microphone device selectors
- Guest prep checklist and prototype release acknowledgement
- Saved episode configurations in local browser storage
- Import/export of complete episode JSON
- Live synchronization between browser tabs using `BroadcastChannel` and `localStorage`
- Recording timer simulation with start, pause, end and reset
- Current segment and current question pushed to the guest screen
- Private host-to-guest cues
- Guest request buttons and host acknowledgement
- Active-speaker highlighting
- Bowl of Chaos prompt drawing with main-topic keyword exclusions and no repeats
- Lower thirds and animated OBS reaction graphics
- Clip timestamps with speaker, type, rating, tags and editing notes
- CSV clip export, Markdown session notes and full JSON export
- Responsive phone, tablet and desktop layouts

## What is deliberately simulated

- The host camera tiles are branded placeholders.
- The timer creates editing timestamps but does not record media.
- Cross-screen synchronization works between tabs/windows sharing the same browser profile.
- The release acknowledgement is not a legal signature system.
- Guest access is not authenticated.
- Data is stored in the browser, not in Cloudflare D1/KV or another backend.

## Fast test

1. Serve this folder over HTTPS, GitHub Pages or localhost.
2. Open `index.html`.
3. Open **Episode Setup** and save the demo episode.
4. Use **Launch all screens** or manually open:
   - `host.html`
   - `studio.html`
   - `graphics.html?debug=1`
5. Start the timer in Host Control.
6. Change a segment, push a question, send a cue and trigger a graphic.
7. Confirm the Guest Studio and OBS Preview change immediately.
8. Mark several clips and export the CSV.

## OBS setup

Add a Browser Source using the absolute URL to `graphics.html`.

Recommended settings:

- Width: `1920`
- Height: `1080`
- Transparent background: enabled automatically
- Use `graphics.html?debug=1` only while testing
- Remove `?debug=1` for the clean transparent output

## Production roadmap

After this workflow is approved, the static synchronization layer can be replaced with:

1. Cloudflare Access or one-time signed guest links
2. Cloudflare Worker API
3. Durable Object/WebSocket room synchronization
4. D1 episode, guest, release and marker records
5. R2 guest asset uploads
6. Dashboard episode integration
7. Email/calendar guest invitations
8. Riverside, Zoom, StreamYard or another recording-platform handoff
9. Optional OBS WebSocket control

The HTML structure is separated by screen so these upgrades can be added without redesigning the prototype.
