# Podcast Brain 3.4 — Live Recording Ready

Upload these three changed files to the ROOT of `studio_throupletea`:

- `index.html`
- `podcast-brain.css`
- `podcast-brain.js`

Keep the existing `.nojekyll` file.

## New in 3.4

### Safe New Session
- Archives the current session before reset
- Clears timer, markers, pause history and Wrap notes
- Can keep the prepared episode, segments, questions and must-mentions
- Creates a safety snapshot before reset

### OBS Timestamp Sync
- Manual −5, −1, +1 and +5 second controls
- Sync OBS Now button
- Visible export offset
- Editing Notes, CSV, JSON and Marker Report use adjusted timestamps
- Original Studio timestamps remain included for reference

### Live Recording Safety
- Backup when recording starts, pauses, resumes and finishes
- Duplicate marker protection for rapid accidental double taps
- Leave-page warning during an active session
- Recording-health panel includes OBS sync status
- Finish review includes OBS offset

### Expanded Exports
- Editing Notes TXT
- Episode JSON with adjusted timecodes
- Marker CSV
- Marker Report TXT

The Recording Remote remains timer + record control + Undo + marker pad only.

After uploading, hard refresh Safari with Command + Option + R.
