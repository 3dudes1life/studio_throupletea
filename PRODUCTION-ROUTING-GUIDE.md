# Throuple Tea 4.6 — Production Routing Guide

## The recording stack

The browser connection is for the live conversation. Your recording masters remain:

- OBS: video master
- Zoom PodTrak P4: local host audio + live guest return
- Guest Studio ISO: separate high-quality audio recorded locally on the guest device

## PodTrak P4 guest audio

Zoom's P4 manual documents that:

- the P4 is a 2-in/2-out USB audio interface
- USB audio return can be used on channel 4
- USB Mix Minus prevents the channel-4 USB return from being sent back to the remote participant

For the intended setup:

1. Connect the P4 USB audio port to the host Mac.
2. On the P4, configure Channel 4 for USB audio return.
3. Turn USB Mix Minus ON.
4. In Guest Capture, choose the PodTrak P4 under **Guest audio output / PodTrak** when the browser exposes output-device selection.
5. If Safari does not allow direct output selection, set the P4 as the relevant macOS audio output instead.
6. Monitor through the P4 headphones.
7. Make a short test recording and verify that Track 4 contains the remote guest while Tracks 1–3 remain the three local hosts.

Do not assume routing is correct without a test recording.

## OBS

1. From Guest Capture click **Copy OBS Guest Feed**.
2. OBS → Sources → + → Browser.
3. Paste the copied URL.
4. Set 1920 × 1080.
5. The Browser Source contains only the guest video—no Guest Control interface.
6. Keep Guest Control open separately for admission and capture health.

## Starting the interview

You still manually start OBS and the P4.

Recommended order:

1. Guest is admitted and connected.
2. Confirm P4 Track 4 receives the guest.
3. Confirm OBS clean guest feed is visible.
4. Start OBS recording.
5. Start P4 recording.
6. Click **Start Guest ISO** in Guest Capture.

The guest's browser then creates a local 192 kbps audio ISO independent of internet quality.

## Ending the interview

1. Click **End + Upload ISO** in Guest Capture.
2. Leave OBS and P4 running while the guest ISO finishes.
3. Wait until Host Control says **Safely uploaded ✓**.
4. Stop OBS.
5. Stop the P4.
6. Click **Download Guest ISO** to save the guest's local master into the episode folder.
7. Return to Guest Hub and Clear Guest.

Never clear the guest before the ISO says it was safely uploaded.
