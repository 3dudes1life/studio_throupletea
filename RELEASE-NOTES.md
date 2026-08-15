# 5.1.1 — Guest Code Lifecycle Fix

- fixes Invalid private room credentials during first code generation
- provisions a new room token before code creation
- preserves token ownership and rejects conflicting room tokens
- adds health flags for guest-code binding and room provisioning
- failed 5.1 guests now show Generate Code instead of Regenerate
- no recording, WebRTC, OBS, R2, or Guest Studio 5.0 safeguards were removed
