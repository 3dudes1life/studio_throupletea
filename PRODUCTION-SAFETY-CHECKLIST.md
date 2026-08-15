# Guest Studio 5.0 — Production Safety Checklist

Before a real guest:

1. Guest joins on power, not low battery.
2. Guest has at least 1 GB free device storage.
3. Guest uses headphones.
4. Guest camera and microphone pass Tech Check.
5. Host sees Green Room alert.
6. Host connects/admit guest.
7. Host verifies live audio both ways.
8. OBS studio camera is recording the hosts only.
9. PodTrak records the three local host microphones.
10. Host presses Start Guest AV ISO.
11. Host must see Guest Capture Guard = Recording protected.
12. Guest screen must say LOCAL BACKUP ACTIVE / local master recording.
13. Record a clap or clear sync phrase.
14. If internet drops, keep talking if possible: the local guest master continues.
15. At end, press End + Upload Guest AV.
16. DO NOT close the guest tab.
17. Wait until Audio safely received and Video safely received.
18. Download both guest masters.
19. Only then stop/clear the guest workflow.

5.0 protections:
- five-second audio/video chunks saved into IndexedDB during capture
- persistent-storage request
- device storage preflight
- wake-lock request
- camera/mic disconnect watchdog
- recording-chunk watchdog
- offline warning while local recording continues
- unload protection while recording/uploading
- sequential audio then video upload
- exponential upload retry
- local recovery copy retained after upload failure
- host Retry Guest Upload control
