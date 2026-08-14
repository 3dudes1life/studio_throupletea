# Throuple Tea Studio 4.3 — Guest Ready

Upload/add ONLY these files to the root of `studio_throupletea`:

- `guest.html`
- `guest.js`
- `guest-experience.css` (new)
- `guest-room.html` (new)
- `guest-room.js` (new)
- `guest-goodbye.html` (new)
- `shared-state.js`
- `host.html`
- `host.js`

## What this release does

### Professional guest check-in
- Branded private Guest Lounge
- Guided 4-step flow instead of one giant form
- Camera preview + framing guide
- Microphone meter
- Camera/mic selection
- Headphone/speaker sound test
- Browser and connection readiness
- Clear permission troubleshooting
- Professional guest intro + promo capture
- Clean recording/clip acknowledgement
- Mobile and iPad responsive

### Green room
- Dedicated guest-only page
- Local camera preview
- Mute / camera controls
- Waiting / admitted / recording states
- Host feed placeholder
- Clean leave flow and thank-you page

### Host controls
- Guest readiness/status card in Host Control
- Intro and promo shown to the hosts
- Admit Guest / Return to Green Room controls
- Guest details continue feeding the lower-third state

## Critical architecture note

This release finishes the professional guest EXPERIENCE and shared state contract, but it does **not** yet transmit live guest video/audio between two different devices.

The current repository has no signaling/media server. Browser localStorage/BroadcastChannel only synchronize same-origin tabs on the same browser/device.

The next build should add the actual remote transport:
1. WebRTC signaling
2. Guest ↔ host media connection
3. reconnect handling
4. host composite / OBS Browser Source test

Do not invite a remote guest for a real interview until that transport layer is completed and tested.
