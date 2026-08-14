/*
  Throuple Tea Guest Studio 4.5
  After deploying the included Cloudflare signaling Worker, paste its HTTPS URL below.
  Example: https://throuple-tea-signal.YOUR-SUBDOMAIN.workers.dev
*/
window.TT_LIVE_GUEST_CONFIG = {
  signalingBaseUrl: "",
  rtcConfig: {
    iceServers: [
      { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }
    ]
  }
};
