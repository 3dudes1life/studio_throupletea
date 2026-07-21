(function () {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const toast = $('#toast');
  let toastTimer;

  function showToast(message, error) {
    toast.textContent = message;
    toast.classList.toggle('error', Boolean(error));
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function render(state) {
    $('#episodeLabel').textContent = `S${state.episode.season} Ep${state.episode.number}: ${state.episode.title}`;
    $('#guestLabel').textContent = state.guest.name || 'No guest set';
    const segment = state.episode.segments[state.studio.currentSegment];
    $('#segmentLabel').textContent = segment ? segment.name : 'Not selected';
    $('#clipCount').textContent = String((state.clips || []).length);
    const pill = $('#syncPill');
    pill.className = `status-pill${state.timer.status === 'recording' ? ' on-air' : state.timer.status === 'paused' ? ' paused' : ''}`;
    pill.innerHTML = `<i class="status-dot"></i>${state.timer.status === 'recording' ? 'Recording simulation live' : state.timer.status === 'paused' ? 'Recording paused' : 'Cross-tab sync ready'}`;
  }

  TTStudio.subscribe(render);
  setInterval(() => {
    $('#timerLabel').textContent = TTStudio.formatTime(TTStudio.timerMilliseconds(), true);
  }, 250);

  $('#launchSuite').addEventListener('click', () => {
    const pages = ['host.html', 'studio.html', 'graphics.html?debug=1'];
    pages.forEach((page, index) => setTimeout(() => window.open(page, '_blank', 'noopener'), index * 180));
    showToast('Host, guest and OBS preview launched. Allow pop-ups if your browser blocked them.');
  });

  $('#resetStudio').addEventListener('click', () => {
    if (!window.confirm('Reset all episode settings, clips, cues and studio state?')) return;
    TTStudio.reset();
    showToast('Prototype reset to the Episode 29 demo.');
  });
}());
