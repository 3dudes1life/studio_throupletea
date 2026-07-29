# Podcast Brain 4.0 — Studio

Upload these three files to the ROOT of `studio_throupletea`:

- `index.html`
- `podcast-brain.css`
- `podcast-brain.js`

Keep the existing:

- `.nojekyll`
- `assets/` folder

After GitHub Pages finishes deploying, hard refresh Safari:

`Command + Option + R`

## What changed

### Apple-inspired Studio UX
- calmer glass interface
- stronger visual hierarchy
- larger episode focus
- fewer competing actions
- responsive desktop and mobile layouts
- dedicated Studio command center

### Stable recording workflow
- Prepare → Record → Wrap remains the core
- Recording Remote stays timer + controls + marker pad
- safe New Session archive/reset
- backups and recovery
- duplicate marker protection
- OBS timestamp offset tools
- leave-page protection during active sessions

### Production Packet
The top-right button now generates one JSON handoff containing:

- episode plan
- run of show
- questions
- must-mentions
- duration and pause data
- OBS-adjusted markers
- Wrap notes
- editing status
- publishing checklist

This becomes the contract between Studio 4.0 and the future Dashboard.

## Important

Studio 4.0 does not control OBS yet. It is prepared for the next connection test after this version loads successfully.
