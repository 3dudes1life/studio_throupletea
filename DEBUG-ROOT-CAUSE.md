# 5.1.1 Root Cause

The 5.1 code system generated a brand-new room ID/token in the browser and immediately called `/code/create`.

The Worker then tried to validate that token against the room Durable Object.

Problem: a new room's token was previously written into the Durable Object only when the FIRST WebSocket connection opened. At code-generation time there had not been a WebSocket yet, so the room had no stored token and validation returned 403.

That produced:

`Guest created, but code failed: Invalid private room credentials.`

5.1.1 adds an idempotent internal room-provisioning step:

- first code creation provisions the new room token server-side
- existing rooms cannot be overwritten with a different token
- code creation then proceeds normally
- later WebSocket, ISO, revoke, observer, and OBS operations all validate against that same stored token

This fixes the lifecycle ordering instead of bypassing room security.
