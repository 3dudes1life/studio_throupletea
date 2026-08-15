# Throuple Tea Guest Studio 5.1.1 — Guest Code Fix

## Cloudflare Worker update REQUIRED

Your ZIP is unzipped in Downloads. Open normal Terminal and run:

```bash
cd "/Users/williamzakrajshek/Downloads/Throuple-Tea-Studio-5.1.1-Guest-Code-Fix/cloudflare-signaling-worker"
npm install
npm run deploy
open "https://throuple-tea-live-guest-signal.round-disk-6577.workers.dev/health"
```

Expected health:

```json
{"ok":true,"service":"throuple-tea-live-guest-signal","version":"5.1.1","isoStorage":true,"guestCodes":true,"roomProvisioning":true}
```

## GitHub

Upload ONLY:

- index.html
- guest-hub.js

No other website files need replacing.

## Test the guest already sitting in your Hub

You do NOT need to clear Test 2.

After Worker + GitHub deploy:
1. Hard refresh Guest Hub.
2. Bottom-left should read Guest Studio 5.1.1.
3. The old `Regenerate` button should now say `Generate Code` because Test 2 has no active code.
4. Click Generate Code.
5. A 6-digit code should appear.
6. Open Guest Lounge in another/private browser and enter the code.
7. It should load the correct guest + episode and continue to Tech Check.

Then test:
- Regenerate => previous code stops working
- Revoke => current code stops working
- Clear Guest => code is revoked and guest disappears
