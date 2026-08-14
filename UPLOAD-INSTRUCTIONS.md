# Throuple Tea Studio 4.5.2 — Host End Session

This fixes the exact issue where the host could mark a guest Complete, but the guest remained connected until they manually left.

Upload these updated root files:

- host.html
- guest-control.js
- guest-control.css
- guest-room.js
- guest-goodbye.html

You can leave every other 4.5.1 file exactly as-is.

## New behavior

On Guest Control:

**End Session**

now does all of the following:

1. Asks the host to confirm.
2. Sends an `end-session` control message through the existing Cloudflare signaling room.
3. Marks the guest Complete.
4. Disconnects the WebRTC host connection.
5. Stops the host camera/audio stream used for the guest call.
6. Clears the guest video on Host Control.
7. Forces the guest side to close its WebRTC/media stream.
8. Sends the guest automatically to the branded Thank You page.

The guest no longer needs to press Leave to end the call.
