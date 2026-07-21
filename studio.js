(function () {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const toast = $('#toast');
  let toastTimer;
  let mediaConnected = false;

  if (window.location.search) TTStudio.applyUrlParams();

  const media = new TTMediaController({
    video: $('#guestVideo'),
    meter: $('#audioMeter'),
    onStatus(status) {
      mediaConnected = Boolean(status.ready);
      $('#guestPlaceholder').hidden = mediaConnected;
      $('#toggleMic').disabled = !mediaConnected;
      $('#toggleCamera').disabled = !mediaConnected;
      $('#cameraConnection').textContent = mediaConnected ? 'Camera connected' : 'Camera not connected';
      $('#cameraConnection').classList.toggle('ready', mediaConnected);
      if (status.error) showToast(status.error, true);
    }
  });

  function showToast(message, error) {
    toast.textContent = message;
    toast.classList.toggle('error', Boolean(error));
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function render(state) {
    const segment = state.episode.segments[state.studio.currentSegment];
    $('#headerEpisode').textContent = `S${state.episode.season} Ep${state.episode.number} · ${state.episode.title}`;
    $('#segmentName').textContent = segment ? segment.name : 'No segment selected';
    $('#currentQuestion').textContent = state.studio.currentQuestion || 'The hosts have not pushed a question yet.';
    $('#privateCue').textContent = state.studio.privateCue || 'No private cue right now.';
    $('#guestCameraName').textContent = state.guest.name || 'Guest';
    $('#guestLabel').textContent = state.guest.name || 'Guest';
    $('#guestInitial').textContent = (state.guest.name || 'G').trim().charAt(0).toUpperCase();
    $('#guestReadyStatus').textContent = state.guest.ready ? 'Guest checked in' : 'Guest not checked in';
    $('#guestReadyStatus').classList.toggle('ready', Boolean(state.guest.ready));

    const status = state.timer.status;
    $('#onAirBox').textContent = status === 'recording' ? 'ON AIR' : status === 'paused' ? 'PAUSED' : status === 'ended' ? 'ENDED' : 'STANDBY';
    $('#onAirBox').classList.toggle('idle', status !== 'recording');
    $('#recordingPill').className = `status-pill${status === 'recording' ? ' on-air' : status === 'paused' ? ' paused' : ''}`;
    $('#recordingPill').innerHTML = `<i class="status-dot"></i>${status === 'recording' ? 'Recording simulation live' : status === 'paused' ? 'Hosts paused recording' : status === 'ended' ? 'Recording ended' : 'Waiting for hosts'}`;

    document.querySelectorAll('.camera-tile').forEach((tile) => {
      const speaker = tile.dataset.speaker === 'Guest' ? state.guest.name : tile.dataset.speaker;
      tile.classList.toggle('active-speaker', speaker === state.studio.currentSpeaker || (tile.dataset.speaker === 'Guest' && state.studio.currentSpeaker === 'Guest'));
    });

    const micMuted = Boolean(state.media.guestMicMuted);
    const cameraOff = Boolean(state.media.guestCameraOff);
    $('#toggleMic').textContent = micMuted ? '🔇 Mic muted' : '🎙️ Mic on';
    $('#toggleMic').classList.toggle('off', micMuted);
    $('#toggleCamera').textContent = cameraOff ? '🚫 Camera off' : '📹 Camera on';
    $('#toggleCamera').classList.toggle('off', cameraOff);
    $('#guestMicDot').classList.toggle('muted', micMuted);
    media.setMicMuted(micMuted);
    media.setCameraOff(cameraOff);
    $('#guestPlaceholder').hidden = mediaConnected && !cameraOff;

    if (state.episode.recordingLink) {
      $('#externalRoom').hidden = false;
      $('#externalRoom').href = state.episode.recordingLink;
    } else {
      $('#externalRoom').hidden = true;
    }

    $('#segmentList').innerHTML = (state.episode.segments || []).map((item, index) => `
      <div class="segment${index === state.studio.currentSegment ? ' active' : ''}">
        <span class="segment-number">${index + 1}</span>
        <span><strong>${escapeHtml(item.name)}</strong><small>${item.minutes} min</small></span>
        <small>${index < state.studio.currentSegment ? 'Done' : index === state.studio.currentSegment ? 'Now' : 'Next'}</small>
      </div>`).join('');

    const prompt = state.bowl.currentPrompt;
    $('#promptCategory').textContent = prompt ? prompt.category : 'Waiting for the hosts';
    $('#currentPrompt').textContent = prompt ? prompt.text : 'No prompt has been drawn yet.';
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  TTStudio.subscribe(render);
  setInterval(() => {
    $('#recordingTimer').textContent = TTStudio.formatTime(TTStudio.timerMilliseconds(), true);
  }, 200);

  $('#connectMedia').addEventListener('click', async () => {
    try {
      await media.start();
      showToast('Camera and microphone connected to this preview.');
    } catch (error) {
      showToast('Camera or microphone access was blocked.', true);
    }
  });

  $('#toggleMic').addEventListener('click', () => {
    TTStudio.update((next) => {
      next.media.guestMicMuted = !next.media.guestMicMuted;
      TTStudio.addActivity(next, `${next.guest.name} ${next.media.guestMicMuted ? 'muted' : 'unmuted'} their microphone`);
    }, 'guest-mic');
  });

  $('#toggleCamera').addEventListener('click', () => {
    TTStudio.update((next) => {
      next.media.guestCameraOff = !next.media.guestCameraOff;
      TTStudio.addActivity(next, `${next.guest.name} turned camera ${next.media.guestCameraOff ? 'off' : 'on'}`);
    }, 'guest-camera');
  });

  document.querySelectorAll('[data-request]').forEach((button) => button.addEventListener('click', () => {
    const message = button.dataset.request;
    TTStudio.update((next) => {
      next.studio.guestRequest = { id: `request-${Date.now()}`, message, at: new Date().toISOString(), acknowledged: false };
      TTStudio.addActivity(next, `${next.guest.name}: ${message}`);
    }, 'guest-request');
    $('#requestNotice').hidden = false;
    setTimeout(() => { $('#requestNotice').hidden = true; }, 2500);
  }));

  $('#leaveStudio').addEventListener('click', async () => {
    await media.stop();
    TTStudio.update((next) => {
      next.studio.mode = 'lounge';
      next.guest.ready = false;
      TTStudio.addActivity(next, `${next.guest.name} left the Guest Studio`);
    }, 'guest-leave');
    window.location.href = 'guest.html';
  });

  window.addEventListener('beforeunload', () => media.destroy());
}());
