# Hosts-Only V2 Update Instructions

This update is supplied as **changed and newly added files only**.

## Replace these existing files

- `index.html`
- `launcher.js`
- `setup.html`
- `setup.js`
- `host.html`
- `host.js`
- `shared-state.js`
- `prompts.js`
- `graphics.html`
- `graphics.js`
- `styles.css`
- `README.md`
- `UPLOAD-INSTRUCTIONS.md`

## Add these new files

- `teleprompter.html`
- `teleprompter.js`

Upload all files into the same existing `studio-prototype/` folder and preserve the filenames exactly.

Do not delete the existing guest files yet. They can stay dormant for a future Guest Episode mode, but the hosts-only dashboard no longer links to them.

## Before Thursday’s recording

1. Open the updated `index.html`.
2. Open Episode Setup and save the current episode once.
3. Use **Launch recording screens** to open Host Control, Teleprompter and the OBS preview.
4. In OBS, create or update a Browser Source pointing to `graphics.html` without `?debug=1`.
5. Confirm the preflight checklist correctly reflects the actual OBS and PodTrak workflow.

## Privacy

This is still a static browser prototype. Do not store private listener details in a publicly accessible version until the route is protected.
