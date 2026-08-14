# Throuple Tea Studio 4.4 — Guest First

This update intentionally removes the producer-dashboard focus.

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

Keep your existing `assets/` folder.

## What the root site is now

The main page is a Guest Hub:
- create a guest
- copy their private check-in link
- see their guest journey
- open the guest control page
- manage only guest status

## What was intentionally removed from the main experience

- production readiness dashboard
- marker heatmaps
- internal episode production journey clutter
- OBS timer controls
- editing workflow
- publishing workflow
- producer metrics

You already record in OBS and your podcast recorder. This release treats that as the source of truth.

## Important

The guest UX is professional and focused, but the repository still does not have a real cross-device media/signaling backend. The guest-room page currently shows the guest's local camera preview and admission state.

The next engineering milestone is the actual remote connection:
- WebRTC signaling
- guest video/audio sent to host
- host feed sent to guest
- reconnect logic
- OBS capture/browser-source test
