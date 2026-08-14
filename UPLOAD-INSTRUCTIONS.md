# Throuple Tea Studio 4.6 — Production Capture

This is the OBS + PodTrak + Guest ISO release.

## Cloudflare — one new storage step

The high-quality guest audio ISO needs private object storage.

In Terminal inside `cloudflare-signaling-worker`:

```bash
npm install
npx wrangler r2 bucket create throuple-tea-guest-iso
npm run deploy
```

Your existing Worker URL stays the same.

After deploy, open:

`https://throuple-tea-live-guest-signal.round-disk-6577.workers.dev/health`

It should show:
- version: 4.6
- isoStorage: true

## GitHub

Upload the updated website files from this ZIP. Keep your existing assets folder.

4.6 adds:
- `guest-obs.html`
- `guest-obs.css`
- `guest-obs.js`
- updated Guest Control production capture
- guest local ISO audio recording/upload
- clean OBS guest feed
- PodTrak guest-output selection/fallback guidance

## Critical first test

Do NOT use a real guest first.

Run a 5-minute test:
1. Connect guest.
2. Admit.
3. Verify clean OBS Browser Source.
4. Verify P4 Track 4 receives guest audio.
5. Start OBS + P4.
6. Start Guest ISO.
7. Talk for 5 minutes.
8. End + Upload ISO.
9. Wait for safely uploaded.
10. Download ISO.
11. Compare/sync all three recordings.
