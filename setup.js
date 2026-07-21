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

  function lines(value) {
    return String(value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  }

  function slug(value, index) {
    return `${String(value || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item'}-${index + 1}`;
  }

  function parseSegments(value) {
    return lines(value).map((line, index) => {
      const parts = line.split('|').map((part) => part.trim());
      return { id: slug(parts[0], index), name: parts[0] || `Segment ${index + 1}`, minutes: Number(parts[1]) || 5, note: parts.slice(2).join(' | ') || '' };
    });
  }

  function preserveChecks(textLines, current, labelKey) {
    const lookup = new Map((current || []).map((item) => [String(item[labelKey] || '').toLowerCase(), item]));
    return textLines.map((text, index) => {
      const existing = lookup.get(text.toLowerCase());
      return { id: existing ? existing.id : slug(text, index), [labelKey]: text, done: existing ? Boolean(existing.done) : false };
    });
  }

  function populate(state) {
    $('#season').value = state.episode.season || '';
    $('#episodeNumber').value = state.episode.number || '';
    $('#recordingDate').value = state.episode.recordingDate || '';
    $('#recordingTime').value = state.episode.recordingTime || '';
    $('#episodeTitle').value = state.episode.title || '';
    $('#mainTopic').value = state.episode.mainTopic || '';
    $('#exclusionKeywords').value = state.episode.exclusionKeywords || '';
    $('#mustMentions').value = (state.episode.mustMentions || []).map((item) => item.text).join('\n');
    $('#hotlineEnabled').checked = Boolean(state.episode.hotline && state.episode.hotline.enabled);
    $('#hotlineListener').value = state.episode.hotline ? state.episode.hotline.listener || '' : '';
    $('#hotlineQuestion').value = state.episode.hotline ? state.episode.hotline.question || '' : '';
    $('#hotlineNotes').value = state.episode.hotline ? state.episode.hotline.notes || '' : '';
    $('#questions').value = (state.episode.questions || []).join('\n');
    $('#backupQuestions').value = (state.episode.backupQuestions || []).join('\n');
    $('#segments').value = (state.episode.segments || []).map((item) => `${item.name} | ${item.minutes} | ${item.note || ''}`).join('\n');
    $('#preflight').value = (state.production.preflight || []).map((item) => item.label).join('\n');
    $('#postflight').value = (state.production.postflight || []).map((item) => item.label).join('\n');
    $('#intro').value = state.show.intro || '';
    $('#outro').value = state.show.outro || '';
    renderSummary(state);
  }

  function renderSummary(state) {
    const readiness = TTStudio.readiness(state);
    $('#readinessScore').textContent = `${readiness.percent}%`;
    $('#readinessBar').style.width = `${readiness.percent}%`;
    $('#summaryTitle').textContent = `S${state.episode.season} Ep${state.episode.number}: ${state.episode.title}`;
    $('#summaryDate').textContent = state.episode.recordingDate ? `Records ${state.episode.recordingDate}${state.episode.recordingTime ? ` at ${state.episode.recordingTime}` : ''}` : 'Recording date not set';
    $('#summarySegments').textContent = `${(state.episode.segments || []).length} segments · ${(state.episode.questions || []).length} main questions`;
  }

  TTStudio.subscribe((state, source) => {
    if (source === 'setup-save') return renderSummary(state);
    if (document.activeElement && document.activeElement.matches('input, textarea')) return renderSummary(state);
    populate(state);
  });

  $('#setupForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const current = TTStudio.getState();
    const segments = parseSegments($('#segments').value);
    if (!segments.length) return showToast('Add at least one run-of-show segment.', true);
    TTStudio.update((next) => {
      next.mode = 'hosts-only';
      next.studio.mode = 'hosts-only';
      next.episode.season = $('#season').value.trim() || '2';
      next.episode.number = $('#episodeNumber').value.trim() || '1';
      next.episode.recordingDate = $('#recordingDate').value;
      next.episode.recordingTime = $('#recordingTime').value;
      next.episode.title = $('#episodeTitle').value.trim();
      next.episode.mainTopic = $('#mainTopic').value.trim();
      next.episode.exclusionKeywords = $('#exclusionKeywords').value.trim();
      next.episode.questions = lines($('#questions').value);
      next.episode.backupQuestions = lines($('#backupQuestions').value);
      next.episode.segments = segments;
      next.episode.mustMentions = preserveChecks(lines($('#mustMentions').value), current.episode.mustMentions, 'text');
      next.episode.hotline = {
        enabled: $('#hotlineEnabled').checked,
        listener: $('#hotlineListener').value.trim(),
        question: $('#hotlineQuestion').value.trim(),
        notes: $('#hotlineNotes').value.trim()
      };
      next.production.preflight = preserveChecks(lines($('#preflight').value), current.production.preflight, 'label');
      next.production.postflight = preserveChecks(lines($('#postflight').value), current.production.postflight, 'label');
      next.show.intro = $('#intro').value.trim();
      next.show.outro = $('#outro').value.trim();
      next.studio.currentSegment = Math.min(next.studio.currentSegment || 0, Math.max(0, segments.length - 1));
      TTStudio.addActivity(next, `Hosts-only setup saved for S${next.episode.season} Ep${next.episode.number}`);
    }, 'setup-save');
    showToast('Hosts-only episode setup saved.');
  });

  $('#exportJson').addEventListener('click', () => {
    const state = TTStudio.getState();
    TTStudio.download(`throuple-tea-s${state.episode.season}-ep${state.episode.number}-setup.json`, JSON.stringify(state, null, 2), 'application/json;charset=utf-8');
    showToast('Episode setup downloaded.');
  });

  $('#importJson').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      TTStudio.replace(parsed, 'setup-import');
      populate(TTStudio.getState());
      showToast('Episode setup imported.');
    } catch (error) {
      showToast('That JSON file could not be imported.', true);
    } finally {
      event.target.value = '';
    }
  });

  $('#freshSession').addEventListener('click', () => {
    if (!window.confirm('Clear timer, markers, completed checkboxes, prompts, directions and activity while keeping the episode plan?')) return;
    TTStudio.update((next) => {
      next.timer = { status: 'idle', baseElapsed: 0, startedAt: null, endedAt: null };
      next.studio.currentSegment = 0;
      next.studio.currentQuestion = '';
      next.studio.currentSpeaker = 'William';
      next.studio.direction = '';
      next.studio.currentMustMention = '';
      next.studio.segmentStartedAtMs = 0;
      next.studio.segmentDurations = {};
      next.bowl.currentPrompt = null;
      next.bowl.usedIds = [];
      next.clips = [];
      next.cues = [];
      next.activity = [];
      next.production.preflight.forEach((item) => { item.done = false; });
      next.production.postflight.forEach((item) => { item.done = false; });
      next.episode.mustMentions.forEach((item) => { item.done = false; });
      next.production.onAirPromises = [];
      next.production.debrief = '';
      next.lowerThird.visible = false;
      next.graphic.visible = false;
      TTStudio.addActivity(next, 'Fresh recording session created');
    }, 'setup-fresh-session');
    showToast('Fresh recording session ready.');
  });

  $('#resetAll').addEventListener('click', () => {
    if (!window.confirm('Reset the entire Throuple Tea Studio to its default Episode 29 demo?')) return;
    TTStudio.reset();
    populate(TTStudio.getState());
    showToast('Entire studio reset.');
  });

  populate(TTStudio.getState());
}());
