(function () {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const toast = $('#toast');
  let toastTimer;
  let mediaReady = false;

  if (window.location.search) TTStudio.applyUrlParams();

  const media = new TTMediaController({
    video: $('#previewVideo'),
    meter: $('#audioMeter'),
    cameraSelect: $('#cameraSelect'),
    micSelect: $('#micSelect'),
    onStatus(status) {
      mediaReady = Boolean(status.ready);
      $('#previewEmpty').hidden = mediaReady;
      $('#cameraStatus').textContent = status.camera ? 'Camera ready' : 'Camera unavailable';
      $('#micStatus').textContent = status.microphone ? 'Microphone ready' : 'Microphone unavailable';
      $('#cameraStatus').classList.toggle('ready', Boolean(status.camera));
      $('#micStatus').classList.toggle('ready', Boolean(status.microphone));
      $('#devicePill').innerHTML = `<i class="status-dot"></i>${mediaReady ? 'Devices ready' : 'Devices not ready'}`;
      $('#devicePill').className = `status-pill${mediaReady ? '' : ' paused'}`;
      if (status.error) {
        $('#mediaNotice').hidden = false;
        $('#mediaNoticeText').textContent = status.error;
      } else {
        $('#mediaNotice').hidden = true;
      }
      updateReadiness();
    }
  });

  function showToast(message, error) {
    toast.textContent = message;
    toast.classList.toggle('error', Boolean(error));
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function render(state) {
    $('#welcomeTitle').innerHTML = `Hey, ${escapeHtml(state.guest.name || 'Guest')}.<span>You’re almost on air.</span>`;
    $('#episodeTitle').textContent = `S${state.episode.season} Ep${state.episode.number}: ${state.episode.title}`;
    const date = state.episode.recordingDate ? new Date(`${state.episode.recordingDate}T${state.episode.recordingTime || '12:00'}`) : null;
    $('#episodeMeta').textContent = date && !Number.isNaN(date.getTime()) ? date.toLocaleString([], { dateStyle: 'full', timeStyle: 'short' }) : 'Recording date will be confirmed by the hosts.';
    $('#episodeTopic').textContent = state.episode.mainTopic || '';
    setUnlessEditing('#guestName', state.guest.name || '');
    setUnlessEditing('#pronouns', state.guest.pronouns || '');
    setUnlessEditing('#guestTitle', state.guest.title || '');
    setUnlessEditing('#social', state.guest.social || '');
    setUnlessEditing('#promo', state.guest.promo || '');
    if ($('#releaseAccepted') !== document.activeElement) $('#releaseAccepted').checked = Boolean(state.guest.releaseAccepted);
    updateCountdown(state);
    updateReadiness();
  }


  function setUnlessEditing(selector, value) {
    const element = $(selector);
    if (element !== document.activeElement) element.value = value;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function allChecksComplete() {
    return Array.from(document.querySelectorAll('.prep-check')).every((checkbox) => checkbox.checked);
  }

  function updateReadiness() {
    const accepted = $('#releaseAccepted').checked;
    const ready = mediaReady && accepted && allChecksComplete();
    $('#enterStudio').disabled = !ready;
    $('#readyPill').innerHTML = `<i class="status-dot"></i>${ready ? 'Ready for the studio' : 'Check-in not finished'}`;
    $('#readyPill').className = `status-pill${ready ? '' : ' paused'}`;
  }

  function updateCountdown(state) {
    const date = state.episode.recordingDate;
    const time = state.episode.recordingTime;
    if (!date || !time) {
      $('#countdown').textContent = 'Ready now';
      return;
    }
    const target = new Date(`${date}T${time}`);
    const difference = target.getTime() - Date.now();
    if (Number.isNaN(target.getTime()) || difference <= 0) {
      $('#countdown').textContent = 'Ready now';
      return;
    }
    const totalMinutes = Math.floor(difference / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    $('#countdown').textContent = `${days ? `${days}d ` : ''}${hours ? `${hours}h ` : ''}${minutes}m`;
  }

  TTStudio.subscribe(render);
  setInterval(() => updateCountdown(TTStudio.getState()), 30000);

  $('#testDevices').addEventListener('click', async () => {
    try {
      await media.start();
      showToast('Camera and microphone are ready. Say something to test the meter.');
    } catch (error) {
      showToast('We could not start the camera or microphone. Check browser permissions.', true);
    }
  });

  $('#stopDevices').addEventListener('click', async () => {
    await media.stop();
    mediaReady = false;
    $('#previewEmpty').hidden = false;
    $('#cameraStatus').textContent = 'Camera stopped';
    $('#micStatus').textContent = 'Microphone stopped';
    $('#cameraStatus').classList.remove('ready');
    $('#micStatus').classList.remove('ready');
    updateReadiness();
  });

  $('#saveGuest').addEventListener('click', () => {
    TTStudio.update((next) => {
      next.guest.name = $('#guestName').value.trim() || 'Guest';
      next.guest.pronouns = $('#pronouns').value.trim();
      next.guest.title = $('#guestTitle').value.trim();
      next.guest.social = $('#social').value.trim();
      next.guest.promo = $('#promo').value.trim();
      next.lowerThird.name = next.guest.name;
      next.lowerThird.title = next.guest.title;
      next.lowerThird.social = next.guest.social;
      TTStudio.addActivity(next, `${next.guest.name} confirmed guest details`);
    }, 'guest-details');
    showToast('Guest introduction details saved.');
  });

  document.querySelectorAll('.prep-check').forEach((checkbox) => checkbox.addEventListener('change', updateReadiness));
  $('#releaseAccepted').addEventListener('change', () => {
    TTStudio.update((next) => {
      next.guest.releaseAccepted = $('#releaseAccepted').checked;
    }, 'guest-release');
    updateReadiness();
  });

  $('#enterStudio').addEventListener('click', async () => {
    TTStudio.update((next) => {
      next.guest.ready = true;
      next.studio.mode = 'studio';
      TTStudio.addActivity(next, `${next.guest.name} entered the Guest Studio`);
    }, 'guest-enter');
    await media.stop();
    window.location.href = 'studio.html';
  });

  window.addEventListener('beforeunload', () => media.destroy());
}());
