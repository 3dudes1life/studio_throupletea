(function () {
  'use strict';
  const $ = (selector) => document.querySelector(selector);

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function currentSegmentElapsed(state) {
    const segment = state.episode.segments[state.studio.currentSegment];
    if (!segment) return 0;
    const saved = Number((state.studio.segmentDurations || {})[segment.id] || 0);
    return saved + Math.max(0, TTStudio.timerMilliseconds(state) - Number(state.studio.segmentStartedAtMs || 0));
  }

  function render(state) {
    const segment = state.episode.segments[state.studio.currentSegment];
    const elapsed = currentSegmentElapsed(state);
    const target = segment ? Number(segment.minutes || 0) * 60000 : 0;
    const percent = target ? Math.min(100, Math.round((elapsed / target) * 100)) : 0;
    $('#episodeLabel').textContent = `S${state.episode.season} Ep${state.episode.number} · ${state.episode.title}`;
    $('#speakerBadge').textContent = `${state.studio.currentSpeaker || 'William'} has the floor`;
    $('#segmentName').textContent = segment ? segment.name : 'No segment selected';
    $('#segmentTiming').textContent = segment ? `Target ${segment.minutes}m · ${TTStudio.formatTime(elapsed, false)} elapsed` : '';
    $('#segmentProgress').style.width = `${percent}%`;
    $('#segmentProgress').classList.toggle('over', target > 0 && elapsed > target);

    const direction = state.studio.direction || '';
    $('#directionBox').hidden = !direction;
    $('#directionText').textContent = direction;

    const prompt = state.bowl.currentPrompt;
    $('#questionLabel').textContent = prompt && prompt.text === state.studio.currentQuestion ? prompt.category.toUpperCase() : 'CURRENT QUESTION';
    $('#currentQuestion').textContent = state.studio.currentQuestion || 'No question selected yet.';

    const segmentId = segment ? segment.id : '';
    const isIntro = segmentId.includes('intro');
    const isOutro = segmentId.includes('outro');
    $('#scriptBox').hidden = !(isIntro || isOutro);
    $('#scriptLabel').textContent = isIntro ? 'OFFICIAL INTRO' : 'OFFICIAL OUTRO';
    $('#scriptText').innerHTML = escapeHtml(isIntro ? state.show.intro : state.show.outro).replace(/\n/g, '<br>');

    const mentions = state.episode.mustMentions || [];
    $('#mentionList').innerHTML = mentions.length ? mentions.map((item) => `<div class="${item.done ? 'done' : ''}"><span>${item.done ? '✓' : '○'}</span>${escapeHtml(item.text)}</div>`).join('') : '<div>No reminders tonight.</div>';

    const hotline = state.episode.hotline || {};
    $('#hotline').innerHTML = hotline.enabled
      ? `<b>${escapeHtml(hotline.listener || 'Listener email')}</b><span>${escapeHtml(hotline.question || hotline.notes || 'Question not pasted yet.')}</span>`
      : '<span>Not included tonight.</span>';
  }

  TTStudio.subscribe(render);
  setInterval(() => {
    const state = TTStudio.getState();
    $('#timer').textContent = TTStudio.formatTime(TTStudio.timerMilliseconds(state), true);
    render(state);
  }, 350);

  $('#fullscreenButton').addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (error) {
      // Fullscreen can be blocked by the browser; the page remains usable.
    }
  });

  function changeSegment(delta) {
    const state = TTStudio.getState();
    const nextIndex = Math.max(0, Math.min(state.studio.currentSegment + delta, state.episode.segments.length - 1));
    if (nextIndex === state.studio.currentSegment) return;
    const now = TTStudio.timerMilliseconds(state);
    const old = state.episode.segments[state.studio.currentSegment];
    TTStudio.update((next) => {
      next.studio.segmentDurations = next.studio.segmentDurations || {};
      if (old) {
        const elapsed = Math.max(0, now - Number(next.studio.segmentStartedAtMs || 0));
        next.studio.segmentDurations[old.id] = Number(next.studio.segmentDurations[old.id] || 0) + elapsed;
      }
      next.studio.currentSegment = nextIndex;
      next.studio.segmentStartedAtMs = now;
      TTStudio.addActivity(next, `Segment changed from teleprompter: ${next.episode.segments[nextIndex].name}`);
    }, 'teleprompter-segment');
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') changeSegment(1);
    if (event.key === 'ArrowLeft') changeSegment(-1);
    if (['1', '2', '3'].includes(event.key)) {
      const speaker = { '1': 'William', '2': 'Daniel', '3': 'Caleb' }[event.key];
      TTStudio.update((next) => { next.studio.currentSpeaker = speaker; }, 'teleprompter-speaker');
    }
  });
}());
