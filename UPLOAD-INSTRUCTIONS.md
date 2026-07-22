# Podcast Brain 3.1.1 — Mobile UX Fix

Upload these three files to the ROOT of `studio_throupletea`, replacing the current versions:

- `index.html`
- `podcast-brain.css`
- `podcast-brain.js`

Keep the existing `.nojekyll` file.

## Fixed

The Mobile Record View no longer collapses into a tiny strip on the left side of a desktop browser.

It now:

- correctly removes the hidden sidebar column
- centers the remote interface on desktop
- uses the full screen on an actual phone
- keeps the timer on one line
- gives the current question enough room
- uses 4 marker columns on large screens
- uses 3 marker columns on medium screens
- uses 2 large marker columns on phones
- improves button spacing and touch targets
- keeps Full View and recording status visible at the top

Hard refresh after uploading:

- Mac Safari: Command + Option + R
- iPhone Safari: close and reopen the tab
