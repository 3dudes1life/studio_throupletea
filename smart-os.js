(function () {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const HOSTS = ['William', 'Daniel', 'Caleb'];

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function elapsed(state) {
    return TTStudio.timerMilliseconds(state);
  }

  function segmentElapsed(state) {
    const segment = state.episode.segments[state.studio.currentSegment];
    if (!segment) return { segment: null, actual: 0, target: 0, ratio: 0 };
    const saved = Number((state.studio.segmentDurations || {})[segment.id] || 0);
    const live = state.timer.status === 'recording'
      ? Math.max(0, elapsed(state) - Number(state.studio.segmentStartedAtMs || 0))
      : 0;
    const actual = saved + live;
    const target = Math.max(0, Number(segment.minutes || 0) * 60000);
    return { segment, actual, target, ratio: target ? actual / target : 0 };
  }

  function speakerTotals(state) {
    const totals = Object.assign({ William: 0, Daniel: 0, Caleb: 0 }, state.studio.speakerDurations || {});
    if (state.timer.status === 'recording' && HOSTS.includes(state.studio.currentSpeaker)) {
      totals[state.studio.currentSpeaker] += Math.max(0, elapsed(state) - Number(state.studio.speakerStartedAtMs || 0));
    }
    return totals;
  }

  function remainingMentions(state) {
    return (state.episode.mustMentions || []).filter((item) => !item.done);
  }

  function incompletePostflight(state) {
    return (state.production.postflight || []).filter((item) => !item.done);
  }

  function confidenceScore(state) {
    const ready = TTStudio.readiness(state);
    const mentions = state.episode.mustMentions || [];
    const mentionDone = mentions.filter((item) => item.done).length;
    const mentionScore = mentions.length ? mentionDone / mentions.length : 1;
    const segment = segmentElapsed(state);
    const timingScore = state.timer.status === 'recording' && segment.target
      ? Math.max(0, 1 - Math.max(0, segment.ratio - 1) * .65)
      : 1;
    const elapsedMinutes = elapsed(state) / 60000;
    const markerTarget = Math.max(1, Math.floor(elapsedMinutes / 12));
    const markerScore = state.timer.status === 'recording' && elapsedMinutes > 12
      ? Math.min(1, (state.clips || []).length / markerTarget)
      : 1;
    const score = ready.percent * .42 + mentionScore * 18 + timingScore * 20 + markerScore * 20;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function analyze(state) {
    const ready = TTStudio.readiness(state);
    const time = elapsed(state);
    const minutes = time / 60000;
    const segment = segmentElapsed(state);
    const mentions = remainingMentions(state);
    const clips = state.clips || [];
    const postflight = incompletePostflight(state);
    const totals = speakerTotals(state);
    const totalTalk = HOSTS.reduce((sum, host) => sum + Number(totals[host] || 0), 0);
    const shares = HOSTS.map((host) => ({
      host,
      milliseconds: Number(totals[host] || 0),
      percent: totalTalk ? Math.round(Number(totals[host] || 0) / totalTalk * 100) : 0
    }));
    const highest = shares.slice().sort((a, b) => b.percent - a.percent)[0];
    const lowest = shares.slice().sort((a, b) => a.percent - b.percent)[0];
    const insights = [];
    let headline = 'Studio is standing by';
    let detail = 'Complete setup, open OBS and the PodTrak, then begin the studio timer.';
    let status = 'Standby';
    let pulse = 'idle';
    let actions = [];

    if (!ready.ready) {
      insights.push({ tone: 'warn', title: `${ready.total - ready.done} preflight item${ready.total - ready.done === 1 ? '' : 's'} open`, text: 'Finish the hardware and recording checks before the first take.' });
    } else {
      insights.push({ tone: 'good', title: 'Recording stack checked', text: 'OBS, PodTrak and microphones are marked ready.' });
    }

    if (state.timer.status === 'idle') {
      if (!ready.ready) {
        headline = 'Finish preflight first';
        detail = 'The smart start gate is holding the session until the real recording stack is checked.';
        status = 'Needs attention';
        pulse = 'warn';
        actions = [{ label: 'Show preflight', command: 'preflight', primary: true }];
      } else {
        headline = 'Ready for the first take';
        detail = 'Start OBS and the PodTrak, then start the Studio timer to sync every marker.';
        status = 'Ready';
        pulse = 'ready';
        actions = [{ label: 'Open Host Control', command: 'host', primary: true }, { label: 'Launch screens', command: 'launch' }];
      }
    }

    if (state.timer.status === 'recording') {
      status = 'Live';
      pulse = 'live';
      if (segment.ratio > 1.15) {
        headline = `${segment.segment.name} is running long`;
        detail = `${TTStudio.formatTime(segment.actual, false)} actual against a ${segment.segment.minutes}-minute target. Land the thought and advance.`;
        actions = [{ label: 'Next segment', command: 'next-segment', primary: true }, { label: 'Show wrap cue', command: 'wrap-cue' }];
        insights.push({ tone: 'danger', title: `${Math.round((segment.ratio - 1) * 100)}% over target`, text: 'The current segment is beginning to push the total episode longer.' });
      } else if (!state.studio.currentQuestion && ['Main Topic', 'Throuple Hotline', 'Bowl of Chaos'].includes(segment.segment && segment.segment.name)) {
        headline = 'The conversation board is empty';
        detail = 'Push a planned question so the shared teleprompter has the next clean direction.';
        actions = [{ label: 'Open questions', command: 'questions', primary: true }];
      } else if (mentions.length && state.studio.currentSegment >= Math.max(0, state.episode.segments.length - 2)) {
        headline = `Do not forget: ${mentions[0].text}`;
        detail = `${mentions.length} must-mention item${mentions.length === 1 ? '' : 's'} remain and the episode is near the wrap.`;
        actions = [{ label: 'Push reminder', command: 'mention', primary: true }];
      } else if (minutes >= 18 && clips.length === 0) {
        headline = 'No edit markers yet';
        detail = 'The episode has been rolling long enough that one strong moment is probably worth marking.';
        actions = [{ label: 'Mark this moment', command: 'marker', primary: true }];
      } else if (minutes >= 10 && highest && highest.percent >= 58 && lowest) {
        headline = `Bring ${lowest.host} into the next answer`;
        detail = `${highest.host} is at roughly ${highest.percent}% of manually tracked airtime. Balance the room before the next segment.`;
        actions = [{ label: `${lowest.host} next`, command: `speaker-${lowest.host.toLowerCase()}`, primary: true }];
      } else {
        const targetText = segment.target ? `${Math.max(0, Math.ceil((segment.target - segment.actual) / 60000))} min left in target` : 'No target set';
        headline = `${segment.segment ? segment.segment.name : 'Episode'} is on track`;
        detail = `${targetText}. ${state.studio.currentQuestion ? 'The next question is already on the teleprompter.' : 'Keep the conversation moving naturally.'}`;
        actions = [{ label: 'Add marker', command: 'marker' }, { label: 'Next segment', command: 'next-segment' }];
      }

      if (segment.ratio >= .85 && segment.ratio <= 1.15) {
        insights.push({ tone: 'info', title: 'Segment checkpoint', text: `${Math.round(segment.ratio * 100)}% of the current target has elapsed.` });
      }
      if (minutes >= 20 && clips.length < Math.max(1, Math.floor(minutes / 15))) {
        insights.push({ tone: 'warn', title: 'Low marker coverage', text: `${clips.length} marker${clips.length === 1 ? '' : 's'} across ${Math.floor(minutes)} minutes. Mark the strongest clean moments.` });
      } else {
        insights.push({ tone: 'good', title: `${clips.length} edit marker${clips.length === 1 ? '' : 's'}`, text: clips.length ? 'Your post-record handoff is being built while you talk.' : 'Markers will become the edit map.' });
      }
      if (highest && minutes >= 5) {
        insights.push({ tone: highest.percent >= 58 ? 'warn' : 'info', title: `${highest.host} currently leads airtime`, text: totalTalk ? `${highest.percent}% by manual speaker tracking.` : 'Tap a host name whenever the floor changes.' });
      }
    }

    if (state.timer.status === 'paused') {
      headline = 'Studio timer is paused';
      detail = 'Resolve the interruption, confirm OBS and PodTrak status, then resume from the same timestamp.';
      status = 'Paused';
      pulse = 'warn';
      actions = [{ label: 'Resume timer', command: 'resume', primary: true }, { label: 'Technical cue', command: 'tech-cue' }];
      insights.unshift({ tone: 'warn', title: 'Recording pause active', text: 'The timer and manual airtime tracking are frozen.' });
    }

    if (state.timer.status === 'ended') {
      headline = postflight.length ? 'Protect the recording files' : 'Episode handoff is complete';
      detail = postflight.length
        ? `${postflight.length} postflight item${postflight.length === 1 ? '' : 's'} remain before the session is safely closed.`
        : 'The recording files, markers and promises are all accounted for.';
      status = postflight.length ? 'Postflight' : 'Complete';
      pulse = postflight.length ? 'warn' : 'ready';
      actions = [{ label: 'Show postflight', command: 'postflight', primary: true }, { label: 'Export notes', command: 'export' }];
      insights.unshift({ tone: postflight.length ? 'warn' : 'good', title: `${postflight.length} postflight item${postflight.length === 1 ? '' : 's'} open`, text: postflight.length ? 'Verify media before closing the browser.' : 'The episode is ready for editing.' });
    }

    if (mentions.length) {
      insights.push({ tone: 'info', title: `${mentions.length} must mention`, text: mentions.map((item) => item.text).slice(0, 2).join(' · ') });
    } else {
      insights.push({ tone: 'good', title: 'All planned mentions covered', text: 'No remaining promotional or listener reminders.' });
    }

    const sensitive = clips.filter((clip) => String(clip.type).includes('Sensitive')).length;
    if (sensitive) insights.push({ tone: 'danger', title: `${sensitive} do-not-publish marker${sensitive === 1 ? '' : 's'}`, text: 'Keep these visible during the edit handoff.' });

    return {
      headline,
      detail,
      status,
      pulse,
      actions,
      insights: insights.slice(0, 4),
      shares,
      score: confidenceScore(state)
    };
  }

  function render(state) {
    const smart = analyze(state);
    const score = $('#smartScore');
    const headline = $('#smartHeadline');
    const detail = $('#smartDetail');
    const status = $('#smartStatus');
    const actions = $('#smartActions');
    const insights = $('#smartInsights');
    const pulse = $('#smartPulse');
    const speakerList = $('#speakerShareList');

    if (score) score.textContent = `${smart.score}%`;
    if (headline) headline.textContent = smart.headline;
    if (detail) detail.textContent = smart.detail;
    if (status) {
      status.textContent = smart.status;
      status.dataset.tone = smart.pulse;
    }
    if (pulse) pulse.dataset.state = smart.pulse;
    if (actions) actions.innerHTML = smart.actions.map((action) => `<button class="btn small${action.primary ? ' primary' : ''}" type="button" data-smart-command="${escapeHtml(action.command)}">${escapeHtml(action.label)}</button>`).join('');
    if (insights) insights.innerHTML = smart.insights.map((item) => `
      <div class="smart-insight" data-tone="${escapeHtml(item.tone)}">
        <i aria-hidden="true"></i><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.text)}</small></span>
      </div>`).join('');
    if (speakerList) speakerList.innerHTML = smart.shares.map((item) => `
      <div class="speaker-share${state.studio.currentSpeaker === item.host ? ' active' : ''}">
        <span><strong>${item.host}</strong><small>${TTStudio.formatTime(item.milliseconds, false)}</small></span>
        <div class="speaker-share-meter"><i style="width:${item.percent}%"></i></div>
        <b>${item.percent}%</b>
      </div>`).join('');
  }

  function scrollTo(selector) {
    const element = $(selector);
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function click(selector, fallback) {
    const element = $(selector);
    if (element) element.click();
    else if (fallback) window.location.href = fallback;
  }

  function command(name) {
    const state = TTStudio.getState();
    const actions = {
      preflight: () => scrollTo('#preflightList'),
      host: () => { window.location.href = 'host.html'; },
      launch: () => click('#launchSuite'),
      'next-segment': () => click('#nextSegment', 'host.html'),
      questions: () => { if ($('#questionList')) scrollTo('#questionList'); else window.location.href = 'host.html'; },
      marker: () => click('#openClipModal', 'host.html'),
      resume: () => click('#startRecording', 'host.html'),
      postflight: () => { if ($('#postflightList')) scrollTo('#postflightList'); else window.location.href = 'host.html'; },
      export: () => click('#exportSession', 'host.html'),
      'wrap-cue': () => TTStudio.update((next) => { next.studio.direction = 'Land the thought and move to the next segment.'; }, 'smart-wrap-cue'),
      'tech-cue': () => TTStudio.update((next) => { next.studio.direction = 'Pause—technical check in progress.'; }, 'smart-tech-cue'),
      mention: () => {
        const item = remainingMentions(state)[0];
        if (!item) return;
        TTStudio.update((next) => {
          next.studio.currentQuestion = `Before we wrap: ${item.text}`;
          next.studio.direction = 'Cover this must-mention before moving on.';
          TTStudio.addActivity(next, `Smart reminder pushed: ${item.text}`);
        }, 'smart-mention');
      },
      'speaker-william': () => click('[data-speaker="William"]', 'host.html'),
      'speaker-daniel': () => click('[data-speaker="Daniel"]', 'host.html'),
      'speaker-caleb': () => click('[data-speaker="Caleb"]', 'host.html')
    };
    if (actions[name]) actions[name]();
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-smart-command]');
    if (button) command(button.dataset.smartCommand);
  });

  TTStudio.subscribe(render);
  window.setInterval(() => { if (!document.hidden) render(TTStudio.getState()); }, 1000);
}());
