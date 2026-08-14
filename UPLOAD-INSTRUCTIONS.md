# Guest Studio 4.5.5 — Green Room Alert

This adds the live Green Room alert to Guest Hub.

## IMPORTANT — Worker update required

The Hub now connects to Cloudflare as an `observer`, so it can watch guest presence WITHOUT replacing the real Host Control WebSocket.

Redeploy the included Worker:

```bash
cd "/path/to/cloudflare-signaling-worker"
npm install
npm run deploy
```

Your Worker URL stays the same.

## GitHub files

Upload the updated website files from this ZIP.

After deploy, hard refresh with:

Command + Option + R

Bottom-left must say:

Guest Studio 4.5.5

## New behavior

When a guest reaches Ready / Green Room:

- a pulsing green alert appears across the top of Guest Hub
- it says `<Guest Name> is waiting in the Green Room`
- the Guest Control quick card gets a flashing WAITING badge
- clicking the alert takes you directly into Guest Control for that private room

The Hub watcher is a separate Cloudflare observer connection, so it does not interfere with Host Control.
