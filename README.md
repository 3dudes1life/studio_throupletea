# Throuple Tea Studio — Hosts-Only V2

A browser-based production control room for **William, Daniel and Caleb’s normal weekly episodes of 3Dudes1Life: A Little Throuple Tea**.

This version is intentionally built around the equipment already used by the show:

- **OBS records the video.**
- **The PodTrak / podcast recorder captures the audio tracks.**
- **Throuple Tea Studio runs the workflow around them.**

It does not attempt to replace OBS, record media or create a Riverside-style call.

## Main screens

- `index.html` — Hosts-only dashboard, readiness and launch controls
- `setup.html` — Episode plan, Hotline, questions, reminders, scripts and checklists
- `host.html` — Complete weekly Host Control Room
- `teleprompter.html` — Shared large-screen display for the three hosts
- `graphics.html` — Transparent OBS browser-source output

The older guest files can remain in the folder for future development, but they are no longer linked from the hosts-only workflow.

## What works now

- Hosts Only is locked as the default mode
- Episode 29 demo configured for Thursday, July 23, 2026
- Preflight checklist for OBS, PodTrak, microphones, phones and recording prep
- Postflight checklist for stopping, verifying and backing up recordings
- Recording timer that follows the real OBS/PodTrak start time
- Run-of-show segment timing with target vs. actual duration
- Shared teleprompter with current segment, question, direction and speaker
- Automatic intro/outro display when those segments are live
- William, Daniel and Caleb speaker tracking
- Main and backup question board
- Custom talking points pushed to the teleprompter
- Throuple Hotline card and OBS graphic
- Must-mention reminders with completion status
- Bowl of Chaos exclusions, no-repeat drawing and OBS prompt display
- Complete 30-card “Whose Chart Is It Anyway?” prompt set
- Host lower-thirds for 3Dudes1Life, William, Daniel and Caleb
- Throuple Tea reaction graphics for OBS
- Quick clip markers: Funny, Chaotic, Emotional, Quote, Teaser and Must-use
- Edit-safety markers: Cut/Tighten and Sensitive/Do Not Publish
- “Save That” markers for future topics, titles, callbacks, merch and on-air promises
- Keyboard shortcuts for the most common live actions
- Clip-marker CSV export
- Full Markdown session-note export
- Complete JSON session backup
- Local browser storage and instant cross-tab synchronization

## Thursday workflow

1. Open `setup.html` and confirm the episode plan.
2. Open `host.html` on the control computer.
3. Open `teleprompter.html` on the shared display or iPad.
4. Add `graphics.html` to OBS as a Browser Source.
5. Start recording in OBS.
6. Start recording on the PodTrak / podcast recorder.
7. Check those two items in Preflight.
8. Start the Throuple Tea Studio timer.
9. Run the episode from Host Control.
10. End the Studio session, then separately stop and verify OBS and PodTrak.
11. Complete Postflight and export the session notes.

## OBS browser source

Use the absolute URL to `graphics.html`.

Recommended settings:

- Width: `1920`
- Height: `1080`
- Background: transparent automatically
- Use `graphics.html?debug=1` only for previewing placement
- Remove `?debug=1` for the live OBS source

## Important limitations

- The timer produces approximate edit timestamps; it does not control or inspect the media files.
- Speaker selection is manual; the app does not listen to or analyze the microphones.
- Data is stored in the current browser until a production database is connected.
- Cross-tab sync works inside the same browser profile.
- The site is not access-controlled merely because it uses `noindex` tags.
