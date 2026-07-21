(function () {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const toast = $('#toast');
  let toastTimer;
  let notesTimer;
  let debriefTimer;
  let renderingNotes = false;

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

  function timeOf(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function segmentDuration(state, index, includeLive) {
    const segment = state.episode.segments[index];
    if (!segment) return 0;
    const saved = Number((state.studio.segmentDurations || {})[segment.id] || 0);
    if (includeLive && index === state.studio.currentSegment) {
      return saved + Math.max(0, TTStudio.timerMilliseconds(state) - Number(state.studio.segmentStartedAtMs || 0));
    }
    return saved;
  }

  function finalizeCurrentSegment(source) {
    TTStudio.update((next) => {
      const segment = next.episode.segments[next.studio.currentSegment];
      if (!segment) return;
      const now = TTStudio.timerMilliseconds(next);
      const started = Number(next.studio.segmentStartedAtMs || 0);
      const delta = Math.max(0, now - started);
      next.studio.segmentDurations = next.studio.segmentDurations || {};
      next.studio.segmentDurations[segment.id] = Number(next.studio.segmentDurations[segment.id] || 0) + delta;
      next.studio.segmentStartedAtMs = now;
    }, source || 'host-segment-finalize');
  }

  function renderChecklist(items, target, dataName) {
    target.innerHTML = items.length ? items.map((item) => `
      <label class="check-row${item.done ? ' done' : ''}">
        <input type="checkbox" data-${dataName}-id="${escapeHtml(item.id)}" ${item.done ? 'checked' : ''}>
        <span>${escapeHtml(item.label || item.text)}</span>
      </label>`).join('') : '<div class="empty-state">Nothing configured in Episode Setup.</div>';
  }

  function renderQuestions(questions, current, backup) {
    if (!questions.length) return '<div class="empty-state">No questions configured in Episode Setup.</div>';
    return questions.map((question) => `
      <div class="question-card${question === current ? ' current' : ''}">
        <p>${escapeHtml(question)}</p>
        <button class="btn small${backup ? ' sun' : ' teal'}" type="button" data-question="${encodeURIComponent(question)}">Show</button>
      </div>`).join('');
  }

  function renderClips(state) {
    const clips = state.clips || [];
    $('#clipList').innerHTML = clips.length ? clips.slice().reverse().map((clip) => `
      <div class="list-item">
        <span class="timecode">${escapeHtml(clip.time)}</span>
        <span><strong>${escapeHtml(clip.type)} · ${escapeHtml(clip.speaker)} · ${escapeHtml(clip.rating)}</strong><small>${escapeHtml(clip.note || 'No note')}${clip.tags && clip.tags.length ? ` · ${escapeHtml(clip.tags.join(', '))}` : ''}</small></span>
        <button class="btn small danger" type="button" data-delete-clip="${escapeHtml(clip.id)}">×</button>
      </div>`).join('') : '<div class="empty-state">No markers yet. Press F for funny, X for cut, or M for a detailed marker.</div>';
  }

  function renderPrompt(state) {
    const prompt = state.bowl.currentPrompt;
    $('#promptCategory').textContent = prompt ? prompt.category : 'No prompt drawn';
    $('#currentPrompt').textContent = prompt ? prompt.text : 'The Bowl is waiting.';
    const available = TTStudioPrompts.available(state, $('#promptCategorySelect').value || 'All').length;
    $('#promptStats').textContent = `${available} eligible prompts remain · ${(state.bowl.usedIds || []).length} used this session`;
  }

  function renderActivity(state) {
    const activity = state.activity || [];
    $('#activityList').innerHTML = activity.length ? activity.slice(0, 12).map((item) => `
      <div class="list-item two-col"><span><strong>${escapeHtml(item.message)}</strong><small>${escapeHtml(timeOf(item.at))}</small></span></div>`).join('') : '<div class="empty-state">Activity will appear as the session runs.</div>';
  }

  function renderHotline(state) {
    const hotline = state.episode.hotline || {};
    if (!hotline.enabled) {
      $('#hotlineCard').innerHTML = '<b>Not included tonight.</b><span>Enable it in Episode Setup when a listener question arrives.</span>';
      $('#pushHotline').disabled = true;
      $('#showHotlineGraphic').disabled = true;
      return;
    }
    const listener = hotline.listener || 'Listener email';
    $('#hotlineCard').innerHTML = `<b>${escapeHtml(listener)}</b><span>${escapeHtml(hotline.question || hotline.notes || 'Hotline question has not been pasted yet.')}</span>`;
    $('#pushHotline').disabled = false;
    $('#showHotlineGraphic').disabled = false;
  }

  function renderSegments(state) {
    const now = TTStudio.timerMilliseconds(state);
    $('#segmentList').innerHTML = (state.episode.segments || []).map((segment, index) => {
      const actual = segmentDuration(state, index, true);
      const target = Number(segment.minutes || 0) * 60000;
      const percent = target ? Math.min(140, Math.round((actual / target) * 100)) : 0;
      const status = actual > target && target > 0 ? 'over' : index === state.studio.currentSegment ? 'live' : actual > 0 ? 'complete' : '';
      return `<div class="segment${index === state.studio.currentSegment ? ' active' : ''}">
        <span class="segment-number">${index + 1}</span>
        <span class="segment-main"><strong>${escapeHtml(segment.name)}</strong><small>${escapeHtml(segment.note || '')}</small><span class="segment-times">Target ${segment.minutes}m · Actual ${TTStudio.formatTime(actual, false)}</span><span class="mini-meter ${status}"><i style="width:${Math.min(100, percent)}%"></i></span></span>
        <button class="btn small${index === state.studio.currentSegment ? ' teal' : ''}" type="button" data-segment-index="${index}">${index === state.studio.currentSegment ? 'Live' : 'Go'}</button>
      </div>`;
    }).join('');
    const current = state.episode.segments[state.studio.currentSegment];
    const currentActual = segmentDuration(state, state.studio.currentSegment, true);
    const target = current ? Number(current.minutes || 0) * 60000 : 0;
    const percent = target ? Math.min(100, Math.round((currentActual / target) * 100)) : 0;
    $('#segmentTimer').textContent = TTStudio.formatTime(currentActual, false);
    $('#segmentTargetLabel').textContent = current ? `${current.name} · target ${current.minutes}m` : 'Segment target';
    $('#segmentProgress').style.width = `${percent}%`;
    $('#segmentProgress').classList.toggle('over', target > 0 && currentActual > target);
    void now;
  }

  function render(state) {
    const segment = state.episode.segments[state.studio.currentSegment];
    const readiness = TTStudio.readiness(state);
    $('#headerEpisode').textContent = `S${state.episode.season} Ep${state.episode.number} · Hosts Only`;
    $('#summaryEpisode').textContent = `S${state.episode.season} Ep${state.episode.number}: ${state.episode.title}`;
    $('#summarySegment').textContent = segment ? segment.name : 'Not selected';
    $('#summarySpeaker').textContent = state.studio.currentSpeaker || 'William';
    $('#summaryClips').textContent = String((state.clips || []).length);
    $('#summaryReady').textContent = `${readiness.percent}%`;
    $('#notReadyAlert').hidden = readiness.ready || state.timer.status === 'idle';

    const pill = $('#recordingPill');
    pill.className = `status-pill${state.timer.status === 'recording' ? ' on-air' : state.timer.status === 'paused' ? ' paused' : ''}`;
    pill.innerHTML = `<i class="status-dot"></i>${state.timer.status === 'recording' ? 'Studio timer live' : state.timer.status === 'paused' ? 'Paused' : state.timer.status === 'ended' ? 'Episode ended' : readiness.ready ? 'Ready' : 'Standby'}`;

    renderChecklist(state.production.preflight || [], $('#preflightList'), 'preflight');
    renderChecklist(state.production.postflight || [], $('#postflightList'), 'postflight');
    renderChecklist(state.episode.mustMentions || [], $('#mentionList'), 'mention');
    renderSegments(state);
    $('#liveQuestion').textContent = state.studio.currentQuestion || 'No question selected.';
    $('#questionList').innerHTML = renderQuestions(state.episode.questions || [], state.studio.currentQuestion, false);
    $('#backupQuestionList').innerHTML = renderQuestions(state.episode.backupQuestions || [], state.studio.currentQuestion, true);
    $('#liveDirection').textContent = state.studio.direction || '—';
    renderHotline(state);
    renderClips(state);
    renderPrompt(state);
    renderActivity(state);

    document.querySelectorAll('[data-speaker]').forEach((button) => button.classList.toggle('active-speaker', button.dataset.speaker === state.studio.currentSpeaker));
    $('#quickSpeaker').value = ['William', 'Daniel', 'Caleb', 'All Hosts'].includes(state.studio.currentSpeaker) ? state.studio.currentSpeaker : 'William';

    if (!renderingNotes && $('#hostNotes') !== document.activeElement) $('#hostNotes').value = state.studio.hostNote || '';
    if ($('#debrief') !== document.activeElement) $('#debrief').value = state.production.debrief || '';
    $('#notesSaved').textContent = 'Saved locally';
  }

  function changeSegment(index) {
    const state = TTStudio.getState();
    const safeIndex = Math.max(0, Math.min(index, state.episode.segments.length - 1));
    if (safeIndex === state.studio.currentSegment) return;
    const now = TTStudio.timerMilliseconds(state);
    const old = state.episode.segments[state.studio.currentSegment];
    const nextSegment = state.episode.segments[safeIndex];
    TTStudio.update((next) => {
      next.studio.segmentDurations = next.studio.segmentDurations || {};
      if (old) {
        const delta = Math.max(0, now - Number(next.studio.segmentStartedAtMs || 0));
        next.studio.segmentDurations[old.id] = Number(next.studio.segmentDurations[old.id] || 0) + delta;
      }
      next.studio.currentSegment = safeIndex;
      next.studio.segmentStartedAtMs = now;
      TTStudio.addActivity(next, `Segment changed: ${nextSegment.name}`);
    }, 'host-segment');
    TTStudio.fireGraphic('dark', nextSegment.name, `S${state.episode.season} Ep${state.episode.number}`, 3200);
    showToast(`Now live: ${nextSegment.name}`);
  }

  function pushQuestion(question) {
    TTStudio.update((next) => {
      next.studio.currentQuestion = question;
      TTStudio.addActivity(next, question ? `Teleprompter question: ${question}` : 'Teleprompter question cleared');
    }, 'host-question');
    showToast(question ? 'Question shown on the teleprompter.' : 'Question cleared.');
  }

  function addClip(details) {
    const state = TTStudio.getState();
    const type = details.type || 'Funny';
    const clip = {
      id: `clip-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      milliseconds: TTStudio.timerMilliseconds(state),
      time: TTStudio.formatTime(TTStudio.timerMilliseconds(state), true),
      speaker: details.speaker || state.studio.currentSpeaker || 'William',
      type,
      rating: details.rating || 'Great',
      note: details.note || '',
      tags: details.tags || [],
      createdAt: new Date().toISOString()
    };
    TTStudio.update((next) => {
      next.clips.push(clip);
      if (type === 'On-Air Promise') next.production.onAirPromises.push({ id: clip.id, time: clip.time, note: clip.note || 'Follow up on promise made during recording.' });
      TTStudio.addActivity(next, `Marker at ${clip.time}: ${clip.type}`);
    }, 'host-clip');
    showToast(`${type} marker saved at ${clip.time}.`);
  }

  function buildSessionNotes(state) {
    const lines = [
      '# A Little Throuple Tea — Hosts-Only Recording Notes', '',
      `Episode: S${state.episode.season} Ep${state.episode.number} — ${state.episode.title}`,
      `Recording date: ${state.episode.recordingDate || 'Not set'}`,
      `Studio timer: ${TTStudio.formatTime(TTStudio.timerMilliseconds(state), true)}`, '',
      '## Segment Timing'
    ];
    (state.episode.segments || []).forEach((segment, index) => {
      lines.push(`- ${segment.name}: ${TTStudio.formatTime(segmentDuration(state, index, true), true)} actual / ${segment.minutes}m target`);
    });
    lines.push('', '## Must Mentions');
    (state.episode.mustMentions || []).forEach((item) => lines.push(`- [${item.done ? 'x' : ' '}] ${item.text}`));
    lines.push('', '## Throuple Hotline');
    if (state.episode.hotline && state.episode.hotline.enabled) {
      lines.push(`Listener: ${state.episode.hotline.listener || 'Not entered'}`, `Question: ${state.episode.hotline.question || 'Not entered'}`, `Notes: ${state.episode.hotline.notes || 'None'}`);
    } else lines.push('Not included.');
    lines.push('', '## Host Notes', state.studio.hostNote || 'No notes.', '', '## Clip / Edit Markers');
    if (!(state.clips || []).length) lines.push('No markers.');
    (state.clips || []).forEach((clip) => lines.push(`- ${clip.time} — ${clip.speaker} — ${clip.type} — ${clip.rating}${clip.note ? ` — ${clip.note}` : ''}${clip.tags && clip.tags.length ? ` [${clip.tags.join(', ')}]` : ''}`));
    lines.push('', '## On-Air Promises / Follow-Ups');
    if (!(state.production.onAirPromises || []).length) lines.push('None captured.');
    (state.production.onAirPromises || []).forEach((item) => lines.push(`- ${item.time}: ${item.note}`));
    lines.push('', '## Postflight');
    (state.production.postflight || []).forEach((item) => lines.push(`- [${item.done ? 'x' : ' '}] ${item.label}`));
    lines.push('', '## Debrief', state.production.debrief || 'No debrief entered.', '', '## Final Bowl Prompt', state.bowl.currentPrompt ? `${state.bowl.currentPrompt.category}: ${state.bowl.currentPrompt.text}` : 'No prompt selected.');
    return lines.join('\n');
  }

  function populatePromptCategories() {
    $('#promptCategorySelect').innerHTML = TTStudioPrompts.categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
  }

  populatePromptCategories();
  TTStudio.subscribe(render);
  setInterval(() => {
    const state = TTStudio.getState();
    const time = TTStudio.formatTime(TTStudio.timerMilliseconds(state), true);
    $('#recordingTimer').textContent = time;
    $('#summaryTimer').textContent = time;
    $('#modalTime').textContent = time;
    renderSegments(state);
  }, 250);

  $('#startRecording').addEventListener('click', () => {
    const state = TTStudio.getState();
    if (!TTStudio.readiness(state).ready && !window.confirm('Some preflight items are still unchecked. Start the studio timer anyway?')) return;
    TTStudio.startTimer();
    TTStudio.update((next) => {
      if (!next.studio.segmentStartedAtMs) next.studio.segmentStartedAtMs = TTStudio.timerMilliseconds(next);
    }, 'host-live');
    TTStudio.fireGraphic('dark', 'WE’RE ON AIR', 'A Little Throuple Tea', 2600);
  });
  $('#pauseRecording').addEventListener('click', () => TTStudio.pauseTimer());
  $('#endRecording').addEventListener('click', () => {
    if (!window.confirm('End the studio session? OBS and the podcast recorder must still be stopped separately.')) return;
    finalizeCurrentSegment('host-end-segment');
    TTStudio.endTimer();
    TTStudio.fireGraphic('dark', 'THAT’S A WRAP', 'Throuple life… it doesn’t suck.', 4200);
  });
  $('#resetTimer').addEventListener('click', () => {
    if (!window.confirm('Reset the studio timer and segment timing to zero?')) return;
    TTStudio.resetTimer();
  });

  $('#preflightList').addEventListener('change', (event) => {
    const input = event.target.closest('[data-preflight-id]');
    if (!input) return;
    TTStudio.update((next) => {
      const item = next.production.preflight.find((entry) => entry.id === input.dataset.preflightId);
      if (item) item.done = input.checked;
      TTStudio.addActivity(next, `${input.checked ? 'Completed' : 'Reopened'} preflight: ${item ? item.label : ''}`);
    }, 'host-preflight');
  });
  $('#completePreflight').addEventListener('click', () => TTStudio.update((next) => {
    next.production.preflight.forEach((item) => { item.done = true; });
    TTStudio.addActivity(next, 'All preflight checks marked ready');
  }, 'host-preflight-all'));

  $('#postflightList').addEventListener('change', (event) => {
    const input = event.target.closest('[data-postflight-id]');
    if (!input) return;
    TTStudio.update((next) => {
      const item = next.production.postflight.find((entry) => entry.id === input.dataset.postflightId);
      if (item) item.done = input.checked;
    }, 'host-postflight');
  });

  $('#mentionList').addEventListener('change', (event) => {
    const input = event.target.closest('[data-mention-id]');
    if (!input) return;
    TTStudio.update((next) => {
      const item = next.episode.mustMentions.find((entry) => entry.id === input.dataset.mentionId);
      if (item) item.done = input.checked;
      TTStudio.addActivity(next, `${input.checked ? 'Mention completed' : 'Mention reopened'}: ${item ? item.text : ''}`);
    }, 'host-mention');
  });

  $('#speakerButtons').addEventListener('click', (event) => {
    const button = event.target.closest('[data-speaker]');
    if (!button) return;
    TTStudio.update((next) => { next.studio.currentSpeaker = button.dataset.speaker; }, 'host-speaker');
  });
  $('#segmentList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-segment-index]');
    if (button) changeSegment(Number(button.dataset.segmentIndex));
  });
  $('#previousSegment').addEventListener('click', () => changeSegment(TTStudio.getState().studio.currentSegment - 1));
  $('#nextSegment').addEventListener('click', () => changeSegment(TTStudio.getState().studio.currentSegment + 1));

  function questionClick(event) {
    const button = event.target.closest('[data-question]');
    if (button) pushQuestion(decodeURIComponent(button.dataset.question));
  }
  $('#questionList').addEventListener('click', questionClick);
  $('#backupQuestionList').addEventListener('click', questionClick);
  $('#pushCustomQuestion').addEventListener('click', () => {
    const question = $('#customQuestion').value.trim();
    if (!question) return showToast('Type a question or talking point first.', true);
    pushQuestion(question);
    $('#customQuestion').value = '';
  });
  $('#clearQuestion').addEventListener('click', () => pushQuestion(''));

  $('#directionPresets').addEventListener('click', (event) => {
    const button = event.target.closest('[data-direction]');
    if (!button) return;
    $('#directionText').value = button.dataset.direction;
    $('#sendDirection').click();
  });
  $('#sendDirection').addEventListener('click', () => {
    const direction = $('#directionText').value.trim();
    if (!direction) return showToast('Type a direction first.', true);
    TTStudio.update((next) => {
      next.studio.direction = direction;
      next.cues.unshift({ id: `direction-${Date.now()}`, text: direction, at: new Date().toISOString() });
      next.cues = next.cues.slice(0, 30);
      TTStudio.addActivity(next, `Teleprompter direction: ${direction}`);
    }, 'host-direction');
    $('#directionText').value = '';
  });
  $('#clearDirection').addEventListener('click', () => TTStudio.update((next) => { next.studio.direction = ''; }, 'host-direction-clear'));

  $('#pushHotline').addEventListener('click', () => {
    const hotline = TTStudio.getState().episode.hotline || {};
    const text = [hotline.listener ? `${hotline.listener}:` : 'Throuple Hotline:', hotline.question || hotline.notes].filter(Boolean).join(' ');
    pushQuestion(text);
  });
  $('#showHotlineGraphic').addEventListener('click', () => TTStudio.fireGraphic('teal', 'THROUPLE HOTLINE', 'Your mess. Our opinions.', 5000));

  $('#promptCategorySelect').addEventListener('change', () => renderPrompt(TTStudio.getState()));
  $('#drawPrompt').addEventListener('click', () => {
    const state = TTStudio.getState();
    const prompt = TTStudioPrompts.draw(state, $('#promptCategorySelect').value);
    if (!prompt) return showToast('No eligible prompt was found.', true);
    TTStudio.update((next) => {
      next.bowl.currentPrompt = prompt;
      if (!next.bowl.usedIds.includes(prompt.id)) next.bowl.usedIds.push(prompt.id);
      next.studio.currentQuestion = prompt.text;
      TTStudio.addActivity(next, `Bowl prompt drawn: ${prompt.text}`);
    }, 'host-prompt');
    showToast('Bowl prompt drawn and shown on the teleprompter.');
  });
  $('#showPromptGraphic').addEventListener('click', () => {
    const prompt = TTStudio.getState().bowl.currentPrompt;
    if (!prompt) return showToast('Draw a prompt first.', true);
    TTStudio.fireGraphic('prompt', prompt.text, prompt.category, 7500);
  });
  $('#clearPrompt').addEventListener('click', () => TTStudio.update((next) => { next.bowl.currentPrompt = null; }, 'host-prompt-clear'));

  const lowerPresets = {
    show: { name: '3Dudes1Life', title: 'Hosts of A Little Throuple Tea', social: '@throupletea' },
    William: { name: 'William', title: 'Co-host · A Little Throuple Tea', social: '@3dudes1life' },
    Daniel: { name: 'Daniel', title: 'Co-host · A Little Throuple Tea', social: '@3dudes1life' },
    Caleb: { name: 'Caleb', title: 'Co-host · A Little Throuple Tea', social: '@3dudes1life' }
  };
  function applyLowerPreset(value) {
    const preset = lowerPresets[value];
    if (!preset) return;
    $('#lowerName').value = preset.name;
    $('#lowerTitle').value = preset.title;
    $('#lowerSocial').value = preset.social;
  }
  $('#lowerPreset').addEventListener('change', () => applyLowerPreset($('#lowerPreset').value));
  applyLowerPreset('show');
  $('#showLowerThird').addEventListener('click', () => TTStudio.update((next) => {
    next.lowerThird = { visible: true, name: $('#lowerName').value.trim() || '3Dudes1Life', title: $('#lowerTitle').value.trim(), social: $('#lowerSocial').value.trim() };
    TTStudio.addActivity(next, `Lower third shown: ${next.lowerThird.name}`);
  }, 'host-lower-third'));
  $('#hideLowerThird').addEventListener('click', () => TTStudio.update((next) => { next.lowerThird.visible = false; }, 'host-lower-third-hide'));
  document.querySelectorAll('[data-graphic]').forEach((button) => button.addEventListener('click', () => {
    const [type, headline, subline] = button.dataset.graphic.split('|');
    TTStudio.fireGraphic(type, headline, subline, 4300);
  }));

  $('#quickClipButtons').addEventListener('click', (event) => {
    const button = event.target.closest('[data-type]');
    if (!button) return;
    const type = button.dataset.type;
    addClip({ speaker: $('#quickSpeaker').value, type, rating: type === 'Must-use' ? 'Must-use' : $('#quickRating').value, note: $('#quickNote').value.trim(), tags: type === 'Teaser' ? ['teaser'] : type.includes('Sensitive') ? ['do-not-publish'] : [] });
    $('#quickNote').value = '';
  });
  document.querySelector('.save-that-row').addEventListener('click', (event) => {
    const button = event.target.closest('[data-save-type]');
    if (!button) return;
    const note = $('#quickNote').value.trim();
    addClip({ speaker: $('#quickSpeaker').value, type: button.dataset.saveType, rating: 'Good', note, tags: [button.dataset.saveType.toLowerCase().replace(/\s+/g, '-')] });
    $('#quickNote').value = '';
  });

  function openModal() {
    $('#clipSpeaker').value = $('#quickSpeaker').value;
    $('#clipRating').value = $('#quickRating').value;
    $('#clipNote').value = $('#quickNote').value.trim();
    $('#clipModal').hidden = false;
    $('#clipNote').focus();
  }
  function closeModal() { $('#clipModal').hidden = true; }
  $('#openClipModal').addEventListener('click', openModal);
  $('#closeClipModal').addEventListener('click', closeModal);
  $('#cancelClip').addEventListener('click', closeModal);
  $('#clipModal').addEventListener('click', (event) => { if (event.target === $('#clipModal')) closeModal(); });
  $('#saveClip').addEventListener('click', () => {
    addClip({ speaker: $('#clipSpeaker').value, type: $('#clipType').value, rating: $('#clipRating').value, note: $('#clipNote').value.trim(), tags: $('#clipTags').value.split(',').map((tag) => tag.trim()).filter(Boolean) });
    $('#clipNote').value = '';
    $('#clipTags').value = '';
    closeModal();
  });
  $('#clipList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-delete-clip]');
    if (!button) return;
    TTStudio.update((next) => {
      next.clips = next.clips.filter((clip) => clip.id !== button.dataset.deleteClip);
      next.production.onAirPromises = next.production.onAirPromises.filter((item) => item.id !== button.dataset.deleteClip);
      TTStudio.addActivity(next, 'Marker deleted');
    }, 'host-clip-delete');
  });

  $('#exportClips').addEventListener('click', () => {
    const state = TTStudio.getState();
    TTStudio.download(`throuple-tea-s${state.episode.season}-ep${state.episode.number}-markers.csv`, TTStudio.clipsToCsv(state), 'text/csv;charset=utf-8');
    showToast('Marker CSV downloaded.');
  });
  $('#exportSession').addEventListener('click', () => {
    const state = TTStudio.getState();
    TTStudio.download(`throuple-tea-s${state.episode.season}-ep${state.episode.number}-session-notes.md`, buildSessionNotes(state), 'text/markdown;charset=utf-8');
    showToast('Session notes downloaded.');
  });
  $('#exportState').addEventListener('click', () => {
    const state = TTStudio.getState();
    TTStudio.download(`throuple-tea-s${state.episode.season}-ep${state.episode.number}-full-session.json`, JSON.stringify(state, null, 2), 'application/json;charset=utf-8');
    showToast('Full session JSON downloaded.');
  });

  $('#hostNotes').addEventListener('input', () => {
    renderingNotes = true;
    $('#notesSaved').textContent = 'Saving…';
    clearTimeout(notesTimer);
    notesTimer = setTimeout(() => {
      TTStudio.update((next) => { next.studio.hostNote = $('#hostNotes').value; }, 'host-notes');
      $('#notesSaved').textContent = 'Saved locally';
      renderingNotes = false;
    }, 450);
  });
  $('#debrief').addEventListener('input', () => {
    clearTimeout(debriefTimer);
    debriefTimer = setTimeout(() => TTStudio.update((next) => { next.production.debrief = $('#debrief').value; }, 'host-debrief'), 450);
  });
  $('#finishSession').addEventListener('click', () => {
    const current = TTStudio.getState();
    if (current.timer.status === 'recording' || current.timer.status === 'paused') {
      finalizeCurrentSegment('host-finish-segment');
      TTStudio.endTimer();
    }
    TTStudio.update((next) => { next.production.debrief = $('#debrief').value; }, 'host-finish');
    const state = TTStudio.getState();
    TTStudio.download(`throuple-tea-s${state.episode.season}-ep${state.episode.number}-session-notes.md`, buildSessionNotes(state), 'text/markdown;charset=utf-8');
    showToast('Session finished and notes exported. Stop and verify OBS and PodTrak separately.');
  });

  const obsUrl = new URL('graphics.html', window.location.href).toString();
  $('#obsUrl').textContent = obsUrl;
  $('#copyObsUrl').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(obsUrl); showToast('Transparent OBS URL copied.'); }
    catch (error) { showToast('Clipboard access was blocked. Copy the URL manually.', true); }
  });

  document.addEventListener('keydown', (event) => {
    if (event.target.matches('input, textarea, select')) return;
    const key = event.key.toLowerCase();
    if (key === 'm') openModal();
    if (key === 'f') addClip({ type: 'Funny', rating: 'Great', speaker: TTStudio.getState().studio.currentSpeaker });
    if (key === 'x') addClip({ type: 'Cut / Tighten', rating: 'Good', speaker: TTStudio.getState().studio.currentSpeaker });
    if (key === '1' || key === '2' || key === '3') {
      const speaker = { '1': 'William', '2': 'Daniel', '3': 'Caleb' }[key];
      TTStudio.update((next) => { next.studio.currentSpeaker = speaker; }, 'shortcut-speaker');
    }
    if (event.key === 'ArrowRight') changeSegment(TTStudio.getState().studio.currentSegment + 1);
    if (event.key === 'ArrowLeft') changeSegment(TTStudio.getState().studio.currentSegment - 1);
    if (event.key === ' ') {
      event.preventDefault();
      const state = TTStudio.getState();
      if (state.timer.status === 'recording') TTStudio.pauseTimer(); else TTStudio.startTimer();
    }
  });
}());
