# Throuple Tea Studio 5.0 — Guest First

This is the reset the project needed.

Upload these files to the ROOT of `studio_throupletea`:

- `.nojekyll`
- `index.html`
- `guest-desk.css` (new)
- `guest-desk.js` (new)
- `shared-state.js`
- `guest.html`
- `guest.js`
- `guest-experience.css`
- `guest-room.html`
- `guest-room.js`
- `guest-goodbye.html`
- `host.html`
- `host.js`

Keep the existing `assets/` folder and existing media helper files.

## What changed

The root Studio is no longer a giant producer dashboard.

It is now a simple Guest Desk:

1. Enter guest + episode information
2. Create/copy the private guest link
3. Watch the guest state
4. Open Host Control
5. Record with OBS + your podcast recorder exactly like you already do

Removed from the ROOT experience:
- OBS sync controls
- fake duplicate recording timer
- marker heatmaps
- publishing workflow
- production journey clutter
- recording health dashboard
- editing/publishing cards

## Guest experience

Guest links now carry the guest name, title, social, promo, episode number/title and topic into the Private Guest Lounge.

The Guest Lounge includes:
- camera preview
- microphone meter
- device selection
- speaker/headphone sound test
- browser/network readiness
- host-intro information
- promo capture
- final readiness checklist
- branded green room
- waiting/admitted states
- mute/camera controls
- thank-you exit

## Important next step

Separate-device live guest audio/video still needs a WebRTC/signaling transport. The UI and state contract are now intentionally isolated so the next engineering update can focus ONLY on:
- guest-to-host live media
- reconnect
- host feed
- OBS capture/browser source

That should be the next build after this page is confirmed live.
