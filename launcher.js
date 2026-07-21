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

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function renderChecks(items, target, source) {
    target.innerHTML = items.length ? items.map((item) => `
      <label class="check-row${item.done ? ' done' : ''}">
        <input type="checkbox" data-${source}-id="${escapeHtml(item.id)}" ${item.done ? 'checked' : ''}>
        <span>${escapeHtml(item.label || item.text)}</span>
      </label>`).join('') : '<div class="empty-state">Nothing configured.</div>';
  }

  function render(state) {
    const segment = state.episode.segments[state.studio.currentSegment];
    const ready = TTStudio.readiness(state);
    $('#episodeLabel').textContent = `S${state.episode.season} Ep${state.episode.number}: ${state.episode.title}`;
    $('#segmentLabel').textContent = segment ? segment.name : 'Not selected';
    $('#clipCount').textContent = String((state.clips || []).length);
    $('#readyPercent').textContent = `${ready.percent}%`;
    $('#readinessFraction').textContent = `${ready.done} / ${ready.total}`;
    $('#readinessCopy').textContent = ready.ready ? 'Ready to record' : `${ready.total - ready.done} preflight item${ready.total - ready.done === 1 ? '' : 's'} remaining`;
    $('#readinessBar').style.width = `${ready.percent}%`;
    $('#recordingHeading').textContent = `${state.episode.title} · ${state.episode.recordingDate || 'Recording date not set'}`;
    $('#currentSpeaker').textContent = state.studio.currentSpeaker || 'William';
    $('#currentDirection').textContent = state.studio.direction || 'No production direction active.';

    const pill = $('#recordingPill');
    pill.className = `status-pill${state.timer.status === 'recording' ? ' on-air' : state.timer.status === 'paused' ? ' paused' : ''}`;
    pill.innerHTML = `<i class="status-dot"></i>${state.timer.status === 'recording' ? 'Studio timer live' : state.timer.status === 'paused' ? 'Studio timer paused' : ready.ready ? 'Ready to record' : 'Standby'}`;

    renderChecks(state.production.preflight || [], $('#preflightList'), 'preflight');
    renderChecks(state.episode.mustMentions || [], $('#mentionList'), 'mention');
  }

  TTStudio.subscribe(render);
  setInterval(() => {
    $('#timerLabel').textContent = TTStudio.formatTime(TTStudio.timerMilliseconds(), true);
  }, 250);

  $('#preflightList').addEventListener('change', (event) => {
    const input = event.target.closest('[data-preflight-id]');
    if (!input) return;
    TTStudio.update((next) => {
      const item = next.production.preflight.find((entry) => entry.id === input.dataset.preflightId);
      if (item) item.done = input.checked;
      TTStudio.addActivity(next, `${input.checked ? 'Completed' : 'Reopened'} preflight: ${item ? item.label : ''}`);
    }, 'dashboard-preflight');
  });

  $('#mentionList').addEventListener('change', (event) => {
    const input = event.target.closest('[data-mention-id]');
    if (!input) return;
    TTStudio.update((next) => {
      const item = next.episode.mustMentions.find((entry) => entry.id === input.dataset.mentionId);
      if (item) item.done = input.checked;
    }, 'dashboard-mention');
  });

  $('#launchSuite').addEventListener('click', () => {
    ['host.html', 'teleprompter.html', 'graphics.html?debug=1'].forEach((page, index) => {
      setTimeout(() => window.open(page, '_blank', 'noopener'), index * 180);
    });
    showToast('Host Control, Teleprompter and OBS Preview launched. Allow pop-ups if needed.');
  });

  $('#resetStudio').addEventListener('click', () => {
    if (!window.confirm('Reset the hosts-only studio, episode setup, markers and checklists?')) return;
    TTStudio.reset();
    showToast('Hosts-only studio reset to the Episode 29 demo.');
  });
}());
