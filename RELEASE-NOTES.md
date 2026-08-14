# 4.7 — Guest Video ISO

- Adds local guest video master recording
- Keeps separate local guest audio master
- Records both from guest-device camera/mic tracks
- Uploads both privately to existing Cloudflare R2
- Host waits for both uploads before ending safely
- Adds Download Guest Audio
- Adds Download Guest Video
- No Cloudflare Worker redeploy required
