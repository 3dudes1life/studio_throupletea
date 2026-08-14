# Throuple Tea Guest Studio 4.7 — Guest Video ISO

This is the missing production-test piece.

## Upload ONLY these website files

- index.html
- host.html
- guest-control.js
- guest-control.css
- guest-room.html
- guest-room.js
- guest-room.css

## Cloudflare

NO Worker redeploy is required.

Your existing 4.6 Worker + R2 bucket already accepts both audio and video objects.

Health can continue to report:

`"version":"4.6","isoStorage":true`

That is correct. 4.7 is the website/capture layer.

## What 4.7 adds

When the host clicks **Start Guest AV ISO**, the guest device records TWO independent local masters:

1. Guest Audio ISO
2. Guest Video + Audio ISO

Both are created from the guest's local camera/microphone tracks — not from the internet/WebRTC return.

When the host clicks **End + Upload Guest AV**:

- both local recorders stop
- both files upload privately to the existing R2 bucket
- Host Control waits for BOTH uploads
- two download buttons appear:
  - Download Guest Audio
  - Download Guest Video
- only when both are safely received does the host get the safe-to-stop message

## Test workflow

1. Guest connects.
2. Host admits guest.
3. OBS records ONLY your full-screen studio camera.
4. PodTrak records your normal host audio.
5. Click Start Guest AV ISO.
6. Record 2–5 minutes.
7. Click End + Upload Guest AV.
8. DO NOT stop/clear anything until BOTH Audio and Video say Safely uploaded.
9. Download both guest files.
10. Stop OBS/P4 and compare/sync the files.

No guest Browser source needs to be visible on the OBS canvas for the final recording.
