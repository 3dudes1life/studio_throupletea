(function () {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const toast = $('#toast');
  let toastTimer;
  let notesTimer;
  let renderingNotes = false;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function showToast(message, error) {
    toast.textContent = message;
    toast.classList.toggle('error', Boolean(error));
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function timeOf(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  }

  function render(state) {
    const segment = state.episode.segments[state.studio.currentSegment];
    $('#headerEpisode').textContent = `S${state.episode.season} Ep${state.episode.number} · ${state.episode.title}`;
    $('#summaryEpisode').textContent = `S${state.episode.season} Ep${state.episode.number}: ${state.episode.title}`;
    $('#summarySegment').textContent = segment ? segment.name : 'No segment';
    $('#summaryGuest').textContent = `${state.guest.name || 'Guest'}${state.guest.ready ? ' · ready' : ' · not checked in'}`;
    $('#summaryClips').textContent = String((state.clips || []).length);
    $('#currentQuestion').textContent = state.studio.currentQuestion || 'No question pushed yet.';
    $('#liveCue').textContent = state.studio.privateCue || 'No cue active.';
    $('#introScript').innerHTML = escapeHtml(state.show.intro || '').replace(/\n/g, '<br>');
    $('#outroScript').innerHTML = escapeHtml(state.show.outro || '').replace(/\n/g, '<br>');

    const status = state.timer.status;
    $('#recordingPill').className = `status-pill${status === 'recording' ? ' on-air' : status === 'paused' ? ' paused' : ''}`;
    $('#recordingPill').innerHTML = `<i class="status-dot"></i>${status === 'recording' ? 'Recording simulation live' : status === 'paused' ? 'Paused' : status === 'ended' ? 'Ended' : 'Standby'}`;
    $('#startRecording').disabled = status === 'recording';
    $('#pauseRecording').disabled = status !== 'recording';
    $('#endRecording').disabled = status === 'idle' || status === 'ended';

    document.querySelectorAll('[data-speaker]').forEach((button) => {
      button.classList.toggle('teal', button.dataset.speaker === state.studio.currentSpeaker);
    });
    $('#quickSpeaker').value = state.studio.currentSpeaker === 'Guest' ? 'Guest' : state.studio.currentSpeaker;

    $('#segmentList').innerHTML = (state.episode.segments || []).map((item, index) => `
      <div class="segment${index === state.studio.currentSegment ? ' active' : ''}">
        <span class="segment-number">${index + 1}</span>
        <span><strong>${escapeHtml(item.name)}</strong><small>${item.minutes} min · ${escapeHtml(item.note || '')}</small></span>
        <button class="btn small${index === state.studio.currentSegment ? ' teal' : ''}" type="button" data-segment-index="${index}">${index === state.studio.currentSegment ? 'Live' : 'Go'}</button>
      </div>`).join('');

    $('#questionList').innerHTML = renderQuestions(state.episode.questions || [], state.studio.currentQuestion, false);
    $('#backupQuestionList').innerHTML = renderQuestions(state.episode.backupQuestions || [], state.studio.currentQuestion, true);
    renderClips(state);
    renderPrompt(state);
    renderGuestRequest(state);
    renderActivity(state);

    $('#lowerName').value = state.lowerThird.name || state.guest.name || '';
    $('#lowerTitle').value = state.lowerThird.title || state.guest.title || '';
    $('#lowerSocial').value = state.lowerThird.social || state.guest.social || '';

    if (!renderingNotes && $('#hostNotes') !== document.activeElement) {
      $('#hostNotes').value = state.studio.hostNote || '';
    }
    $('#notesSaved').textContent = 'Saved locally';
  }

  function renderQuestions(questions, current, backup) {
    if (!questions.length) return '<div class="empty-state">No questions configured in Episode Setup.</div>';
    return questions.map((question, index) => `
      <div class="question-card${question === current ? ' current' : ''}">
        <p>${escapeHtml(question)}</p>
        <button class="btn small${backup ? ' sun' : ' teal'}" type="button" data-question="${encodeURIComponent(question)}">Push</button>
      </div>`).join('');
  }

  function renderClips(state) {
    const clips = state.clips || [];
    $('#clipList').innerHTML = clips.length ? clips.slice().reverse().map((clip) => `
      <div class="list-item">
        <span class="timecode">${escapeHtml(clip.time)}</span>
        <span><strong>${escapeHtml(clip.type)} · ${escapeHtml(clip.speaker)} · ${escapeHtml(clip.rating)}</strong><small>${escapeHtml(clip.note || 'No note')}${clip.tags && clip.tags.length ? ` · ${escapeHtml(clip.tags.join(', '))}` : ''}</small></span>
        <button class="btn small danger" type="button" data-delete-clip="${escapeHtml(clip.id)}">×</button>
      </div>`).join('') : '<div class="empty-state">No clip markers yet. Tap a quick marker when somebody says something worth saving.</div>';
  }

  function renderPrompt(state) {
    const prompt = state.bowl.currentPrompt;
    $('#promptCategory').textContent = prompt ? prompt.category : 'No prompt drawn';
    $('#currentPrompt').textContent = prompt ? prompt.text : 'The Bowl is waiting.';
    const available = TTStudioPrompts.available(state, $('#promptCategorySelect').value || 'All').length;
    $('#promptStats').textContent = `${available} eligible prompts remain after topic exclusions · ${(state.bowl.usedIds || []).length} used this session`;
  }

  function renderGuestRequest(state) {
    const request = state.studio.guestRequest;
    const visible = request && !request.acknowledged;
    $('#guestRequestAlert').hidden = !visible;
    if (!visible) return;
    $('#guestRequestText').textContent = `${state.guest.name || 'Guest'}: ${request.message}`;
    $('#guestRequestTime').textContent = timeOf(request.at);
  }

  function renderActivity(state) {
    const activity = state.activity || [];
    $('#activityList').innerHTML = activity.length ? activity.slice(0, 12).map((item) => `
      <div class="list-item two-col"><span><strong>${escapeHtml(item.message)}</strong><small>${escapeHtml(timeOf(item.at))}</small></span></div>`).join('') : '<div class="empty-state">Activity will appear as the session runs.</div>';
  }

  function pushQuestion(question) {
    TTStudio.update((next) => {
      next.studio.currentQuestion = question;
      TTStudio.addActivity(next, `Question pushed: ${question}`);
    }, 'host-question');
    showToast('Question pushed to the Guest Studio.');
  }

  function changeSegment(index) {
    const state = TTStudio.getState();
    const safeIndex = Math.max(0, Math.min(index, state.episode.segments.length - 1));
    const segment = state.episode.segments[safeIndex];
    if (!segment) return;
    TTStudio.update((next) => {
      next.studio.currentSegment = safeIndex;
      TTStudio.addActivity(next, `Segment changed: ${segment.name}`);
    }, 'host-segment');
    TTStudio.fireGraphic('dark', segment.name, `S${state.episode.season} Ep${state.episode.number}`, 3200);
    showToast(`Now live: ${segment.name}`);
  }

  function addClip(details) {
    const state = TTStudio.getState();
    const clip = {
      id: `clip-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      milliseconds: TTStudio.timerMilliseconds(state),
      time: TTStudio.formatTime(TTStudio.timerMilliseconds(state), true),
      speaker: details.speaker || state.studio.currentSpeaker || 'William',
      type: details.type || 'Funny',
      rating: details.rating || 'Great',
      note: details.note || '',
      tags: details.tags || [],
      createdAt: new Date().toISOString()
    };
    TTStudio.update((next) => {
      next.clips.push(clip);
      TTStudio.addActivity(next, `Clip marked at ${clip.time}: ${clip.type}`);
    }, 'host-clip');
    showToast(`Clip marked at ${clip.time}.`);
  }

  function buildSessionNotes(state) {
    const segment = state.episode.segments[state.studio.currentSegment];
    const lines = [
      '# A Little Throuple Tea — Recording Session Notes',
      '',
      `Episode: S${state.episode.season} Ep${state.episode.number} — ${state.episode.title}`,
      `Guest: ${state.guest.name} (${state.guest.title}) ${state.guest.social}`,
      `Recording time: ${TTStudio.formatTime(TTStudio.timerMilliseconds(state), true)}`,
      `Final segment: ${segment ? segment.name : 'None'}`,
      '',
      '## Host Notes',
      state.studio.hostNote || 'No notes.',
      '',
      '## Clip Markers'
    ];
    if (!(state.clips || []).length) lines.push('No clip markers.');
    (state.clips || []).forEach((clip) => {
      lines.push(`- ${clip.time} — ${clip.speaker} — ${clip.type} — ${clip.rating}${clip.note ? ` — ${clip.note}` : ''}${clip.tags && clip.tags.length ? ` [${clip.tags.join(', ')}]` : ''}`);
    });
    lines.push('', '## Questions Used', state.studio.currentQuestion || 'No final question.', '', '## Bowl of Chaos', state.bowl.currentPrompt ? `${state.bowl.currentPrompt.category}: ${state.bowl.currentPrompt.text}` : 'No prompt selected.');
    return lines.join('\n');
  }

  function populatePromptCategories() {
    $('#promptCategorySelect').innerHTML = TTStudioPrompts.categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
  }

  populatePromptCategories();
  TTStudio.subscribe(render);
  setInterval(() => {
    const time = TTStudio.formatTime(TTStudio.timerMilliseconds(), true);
    $('#recordingTimer').textContent = time;
    $('#summaryTimer').textContent = time;
    $('#modalTime').textContent = time;
  }, 180);

  $('#startRecording').addEventListener('click', () => {
    TTStudio.startTimer();
    TTStudio.update((next) => { next.studio.mode = 'studio'; }, 'host-live');
    TTStudio.fireGraphic('dark', 'WE’RE ON AIR', 'A Little Throuple Tea', 2600);
  });
  $('#pauseRecording').addEventListener('click', () => TTStudio.pauseTimer());
  $('#endRecording').addEventListener('click', () => {
    if (!window.confirm('End the recording simulation? The timer will stop but all markers stay saved.')) return;
    TTStudio.endTimer();
    TTStudio.fireGraphic('dark', 'THAT’S A WRAP', 'Throuple life… it doesn’t suck.', 4200);
  });
  $('#resetTimer').addEventListener('click', () => {
    if (!window.confirm('Reset only the recording timer to zero?')) return;
    TTStudio.resetTimer();
  });

  $('#speakerButtons').addEventListener('click', (event) => {
    const button = event.target.closest('[data-speaker]');
    if (!button) return;
    TTStudio.update((next) => { next.studio.currentSpeaker = button.dataset.speaker; }, 'host-speaker');
  });

  $('#segmentList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-segment-index]');
    if (!button) return;
    changeSegment(Number(button.dataset.segmentIndex));
  });
  $('#previousSegment').addEventListener('click', () => changeSegment(TTStudio.getState().studio.currentSegment - 1));
  $('#nextSegment').addEventListener('click', () => changeSegment(TTStudio.getState().studio.currentSegment + 1));

  function questionClick(event) {
    const button = event.target.closest('[data-question]');
    if (!button) return;
    pushQuestion(decodeURIComponent(button.dataset.question));
  }
  $('#questionList').addEventListener('click', questionClick);
  $('#backupQuestionList').addEventListener('click', questionClick);
  $('#pushCustomQuestion').addEventListener('click', () => {
    const question = $('#customQuestion').value.trim();
    if (!question) return showToast('Type a custom question first.', true);
    pushQuestion(question);
    $('#customQuestion').value = '';
  });
  $('#clearQuestion').addEventListener('click', () => pushQuestion(''));

  document.querySelectorAll('[data-cue]').forEach((button) => button.addEventListener('click', () => {
    $('#cueText').value = button.dataset.cue;
    $('#sendCue').click();
  }));
  $('#sendCue').addEventListener('click', () => {
    const cue = $('#cueText').value.trim();
    if (!cue) return showToast('Type a cue first.', true);
    TTStudio.update((next) => {
      next.studio.privateCue = cue;
      next.cues.unshift({ id: `cue-${Date.now()}`, text: cue, at: new Date().toISOString() });
      next.cues = next.cues.slice(0, 30);
      TTStudio.addActivity(next, `Private cue sent: ${cue}`);
    }, 'host-cue');
    $('#cueText').value = '';
    showToast('Private cue sent to the Guest Studio.');
  });
  $('#clearCue').addEventListener('click', () => {
    TTStudio.update((next) => { next.studio.privateCue = ''; }, 'host-cue-clear');
  });

  $('#acknowledgeRequest').addEventListener('click', () => {
    TTStudio.update((next) => {
      if (next.studio.guestRequest) next.studio.guestRequest.acknowledged = true;
      next.studio.privateCue = 'We saw your message.';
      TTStudio.addActivity(next, 'Guest request acknowledged');
    }, 'host-request-ack');
  });

  $('#promptCategorySelect').addEventListener('change', () => renderPrompt(TTStudio.getState()));
  $('#drawPrompt').addEventListener('click', () => {
    const state = TTStudio.getState();
    const category = $('#promptCategorySelect').value;
    const prompt = TTStudioPrompts.draw(state, category);
    if (!prompt) return showToast('No eligible prompt was found.', true);
    TTStudio.update((next) => {
      next.bowl.currentPrompt = prompt;
      if (!next.bowl.usedIds.includes(prompt.id)) next.bowl.usedIds.push(prompt.id);
      TTStudio.addActivity(next, `Bowl prompt drawn: ${prompt.text}`);
    }, 'host-prompt');
    showToast('New Bowl of Chaos prompt pushed to the guest.');
  });
  $('#showPromptGraphic').addEventListener('click', () => {
    const prompt = TTStudio.getState().bowl.currentPrompt;
    if (!prompt) return showToast('Draw a prompt first.', true);
    TTStudio.fireGraphic('prompt', prompt.text, prompt.category, 7500);
  });
  $('#clearPrompt').addEventListener('click', () => {
    TTStudio.update((next) => { next.bowl.currentPrompt = null; }, 'host-prompt-clear');
  });

  $('#showLowerThird').addEventListener('click', () => {
    TTStudio.update((next) => {
      next.lowerThird = {
        visible: true,
        name: $('#lowerName').value.trim() || next.guest.name,
        title: $('#lowerTitle').value.trim() || next.guest.title,
        social: $('#lowerSocial').value.trim() || next.guest.social
      };
      TTStudio.addActivity(next, `Lower third shown: ${next.lowerThird.name}`);
    }, 'host-lower-third');
  });
  $('#hideLowerThird').addEventListener('click', () => TTStudio.update((next) => { next.lowerThird.visible = false; }, 'host-lower-third-hide'));

  document.querySelectorAll('[data-graphic]').forEach((button) => button.addEventListener('click', () => {
    const [type, headline, subline] = button.dataset.graphic.split('|');
    TTStudio.fireGraphic(type, headline, subline, 4300);
  }));

  $('#quickClipButtons').addEventListener('click', (event) => {
    const button = event.target.closest('[data-type]');
    if (!button) return;
    const type = button.dataset.type;
    addClip({
      speaker: $('#quickSpeaker').value,
      type,
      rating: type === 'Must-use' ? 'Must-use' : $('#quickRating').value,
      note: $('#quickNote').value.trim(),
      tags: type === 'Teaser' ? ['teaser'] : type === 'Must-use' ? ['must-use'] : []
    });
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
    addClip({
      speaker: $('#clipSpeaker').value,
      type: $('#clipType').value,
      rating: $('#clipRating').value,
      note: $('#clipNote').value.trim(),
      tags: $('#clipTags').value.split(',').map((tag) => tag.trim()).filter(Boolean)
    });
    $('#clipNote').value = '';
    $('#clipTags').value = '';
    closeModal();
  });

  $('#clipList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-delete-clip]');
    if (!button) return;
    TTStudio.update((next) => {
      next.clips = next.clips.filter((clip) => clip.id !== button.dataset.deleteClip);
      TTStudio.addActivity(next, 'Clip marker deleted');
    }, 'host-clip-delete');
  });

  $('#exportClips').addEventListener('click', () => {
    const state = TTStudio.getState();
    TTStudio.download(`throuple-tea-s${state.episode.season}-ep${state.episode.number}-clips.csv`, TTStudio.clipsToCsv(state), 'text/csv;charset=utf-8');
    showToast('Clip marker CSV downloaded.');
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

  const obsUrl = new URL('graphics.html', window.location.href).toString();
  $('#obsUrl').textContent = obsUrl;
  $('#copyObsUrl').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(obsUrl);
      showToast('Transparent OBS URL copied.');
    } catch (error) {
      showToast('Clipboard access was blocked. Copy the URL manually.', true);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.target.matches('input, textarea, select')) return;
    if (event.key.toLowerCase() === 'm') openModal();
    if (event.key === ' ') {
      event.preventDefault();
      const state = TTStudio.getState();
      if (state.timer.status === 'recording') TTStudio.pauseTimer(); else TTStudio.startTimer();
    }
  });
}());
