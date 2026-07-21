(function () {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const form = $('#setupForm');
  const toast = $('#toast');
  let toastTimer;

  function showToast(message, error) {
    toast.textContent = message;
    toast.classList.toggle('error', Boolean(error));
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function lines(value) {
    return String(value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  }

  function parseSegments(value) {
    return lines(value).map((line, index) => {
      const parts = line.split('|').map((part) => part.trim());
      const name = parts[0] || `Segment ${index + 1}`;
      const minutes = Number(parts[1]) || 5;
      const note = parts.slice(2).join(' | ') || '';
      return {
        id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'segment'}-${index + 1}`,
        name,
        minutes,
        note
      };
    });
  }

  function buildGuestUrl(state) {
    const target = new URL('guest.html', window.location.href);
    target.searchParams.set('guest', state.guest.name || 'Guest');
    if (state.guest.pronouns) target.searchParams.set('pronouns', state.guest.pronouns);
    if (state.guest.title) target.searchParams.set('role', state.guest.title);
    if (state.guest.social) target.searchParams.set('social', state.guest.social);
    if (state.guest.promo) target.searchParams.set('promo', state.guest.promo);
    target.searchParams.set('episode', state.episode.number || '');
    target.searchParams.set('season', state.episode.season || '');
    target.searchParams.set('title', state.episode.title || '');
    return target.toString();
  }

  function fill(state) {
    $('#season').value = state.episode.season || '';
    $('#episodeNumber').value = state.episode.number || '';
    $('#recordingDate').value = state.episode.recordingDate || '';
    $('#recordingTime').value = state.episode.recordingTime || '';
    $('#episodeTitle').value = state.episode.title || '';
    $('#mainTopic').value = state.episode.mainTopic || '';
    $('#recordingLink').value = state.episode.recordingLink || '';
    $('#exclusionKeywords').value = state.episode.exclusionKeywords || '';
    $('#guestName').value = state.guest.name || '';
    $('#pronouns').value = state.guest.pronouns || '';
    $('#guestTitle').value = state.guest.title || '';
    $('#social').value = state.guest.social || '';
    $('#email').value = state.guest.email || '';
    $('#promo').value = state.guest.promo || '';
    $('#guestNotes').value = state.guest.notes || '';
    $('#questions').value = (state.episode.questions || []).join('\n');
    $('#backupQuestions').value = (state.episode.backupQuestions || []).join('\n');
    $('#segments').value = (state.episode.segments || []).map((segment) => `${segment.name} | ${segment.minutes} | ${segment.note || ''}`).join('\n');
    $('#intro').value = state.show.intro || '';
    $('#outro').value = state.show.outro || '';
    renderSummary(state);
  }

  function renderSummary(state) {
    $('#guestUrl').textContent = buildGuestUrl(state);
    $('#summaryTitle').textContent = `S${state.episode.season} Ep${state.episode.number}: ${state.episode.title}`;
    $('#summaryGuest').textContent = `${state.guest.name || 'No guest'} · ${state.guest.title || 'Guest'}`;
    $('#summarySegments').textContent = `${(state.episode.segments || []).length} segments · ${(state.episode.questions || []).length} questions`;
  }

  fill(TTStudio.getState());
  TTStudio.subscribe((state, source) => {
    if (source !== 'initial' && source !== 'setup-save') renderSummary(state);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const segments = parseSegments($('#segments').value);
    if (!segments.length) {
      showToast('Add at least one run-of-show segment.', true);
      return;
    }
    const updated = TTStudio.update((next) => {
      next.episode.season = $('#season').value.trim();
      next.episode.number = $('#episodeNumber').value.trim();
      next.episode.recordingDate = $('#recordingDate').value;
      next.episode.recordingTime = $('#recordingTime').value;
      next.episode.title = $('#episodeTitle').value.trim();
      next.episode.mainTopic = $('#mainTopic').value.trim();
      next.episode.recordingLink = $('#recordingLink').value.trim();
      next.episode.exclusionKeywords = $('#exclusionKeywords').value.trim();
      next.episode.questions = lines($('#questions').value);
      next.episode.backupQuestions = lines($('#backupQuestions').value);
      next.episode.segments = segments;
      next.guest.name = $('#guestName').value.trim();
      next.guest.pronouns = $('#pronouns').value.trim();
      next.guest.title = $('#guestTitle').value.trim();
      next.guest.social = $('#social').value.trim();
      next.guest.email = $('#email').value.trim();
      next.guest.promo = $('#promo').value.trim();
      next.guest.notes = $('#guestNotes').value.trim();
      next.show.intro = $('#intro').value.trim();
      next.show.outro = $('#outro').value.trim();
      next.lowerThird.name = next.guest.name;
      next.lowerThird.title = next.guest.title;
      next.lowerThird.social = next.guest.social;
      next.studio.currentSegment = Math.min(next.studio.currentSegment, Math.max(segments.length - 1, 0));
      if (!next.studio.currentQuestion && next.episode.questions.length) next.studio.currentQuestion = next.episode.questions[0];
      TTStudio.addActivity(next, `Episode setup saved: S${next.episode.season} Ep${next.episode.number}`);
    }, 'setup-save');
    renderSummary(updated);
    showToast('Episode setup saved across every studio screen.');
  });

  $('#copyGuestUrl').addEventListener('click', async () => {
    const value = buildGuestUrl(TTStudio.getState());
    try {
      await navigator.clipboard.writeText(value);
      showToast('Personalized guest link copied.');
    } catch (error) {
      showToast('Clipboard access was blocked. Select and copy the link manually.', true);
    }
  });

  $('#openGuestUrl').addEventListener('click', () => window.open(buildGuestUrl(TTStudio.getState()), '_blank', 'noopener'));

  $('#exportJson').addEventListener('click', () => {
    const state = TTStudio.getState();
    const filename = `throuple-tea-s${state.episode.season}-ep${state.episode.number}-setup.json`;
    TTStudio.download(filename, JSON.stringify(state, null, 2), 'application/json;charset=utf-8');
    showToast('Episode setup JSON downloaded.');
  });

  $('#importJson').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      const updated = TTStudio.replace(imported, 'setup-import');
      fill(updated);
      showToast('Episode setup imported and synced.');
    } catch (error) {
      showToast('That file is not a valid studio JSON export.', true);
    } finally {
      event.target.value = '';
    }
  });

  $('#resetAll').addEventListener('click', () => {
    if (!window.confirm('Reset the entire prototype, including clips, cues and episode setup?')) return;
    const reset = TTStudio.reset();
    fill(reset);
    showToast('Prototype reset to the Episode 29 demo.');
  });
}());
