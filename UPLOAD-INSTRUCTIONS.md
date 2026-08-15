# Throuple Tea Guest Studio 5.0 — Production Hardened

This is a website-only hardening release.

## Upload these files

- index.html
- host.html
- guest-control.js
- guest-control.css
- guest-room.html
- guest-room.js
- guest-room.css
- iso-guard.js (NEW)

No Cloudflare Worker redeploy is required. Keep the existing 4.6 Worker and R2 bucket.

## Why 5.0

4.7 proved the core system works. 5.0 focuses on preventing a real interview from being lost.

Major safeguards:
- recording chunks checkpoint to IndexedDB every 5 seconds
- protected local recovery state if upload fails
- storage preflight
- persistent-storage request
- wake lock
- camera/mic disconnect alerts
- chunk watchdog
- network-offline awareness
- unload/close protection
- 4-attempt exponential upload retry
- audio uploads first
- video uploads second
- host sees partial upload progress
- host can Retry Guest Upload
- local recovery data is deleted ONLY after both cloud uploads succeed

Hard refresh after GitHub deploy. Bottom-left should read Guest Studio 5.0.
