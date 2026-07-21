(function () {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const debug = new URLSearchParams(window.location.search).get('debug') === '1';
  if (debug) {
    document.body.classList.add('obs-debug');
    $('#debugLabel').style.opacity = '1';
  }

  function render(state) {
    const recording = state.timer.status === 'recording';
    $('#watermark').classList.toggle('show', recording || state.lowerThird.visible || state.graphic.visible);
    $('#onAir').classList.toggle('show', recording);

    $('#lowerName').textContent = state.lowerThird.name || state.guest.name || 'Guest';
    $('#lowerTitle').textContent = state.lowerThird.title || state.guest.title || 'Guest';
    $('#lowerSocial').textContent = state.lowerThird.social || state.guest.social || '';
    $('#lowerThird').classList.toggle('show', Boolean(state.lowerThird.visible));

    const graphic = state.graphic || {};
    const visible = Boolean(graphic.visible) && (!graphic.expiresAt || graphic.expiresAt > Date.now());
    const isPrompt = graphic.type === 'prompt';

    $('#promptGraphic').classList.toggle('show', visible && isPrompt);
    $('#reactionGraphic').classList.toggle('show', visible && !isPrompt);

    if (isPrompt) {
      $('#promptCategory').textContent = graphic.subline || 'Bowl of Chaos';
      $('#promptHeadline').textContent = graphic.headline || '';
    } else {
      $('#reactionHeadline').textContent = graphic.headline || '';
      $('#reactionSubline').textContent = graphic.subline || '';
      $('#reactionGraphic').className = 'obs-reaction';
      if (visible) $('#reactionGraphic').classList.add('show');
      if (['teal', 'gold', 'dark'].includes(graphic.type)) $('#reactionGraphic').classList.add(graphic.type);
    }
  }

  TTStudio.subscribe(render);
  setInterval(() => {
    const state = TTStudio.getState();
    $('#onAirText').textContent = `ON AIR · ${TTStudio.formatTime(TTStudio.timerMilliseconds(state), true)}`;
    if (state.graphic.visible && state.graphic.expiresAt && state.graphic.expiresAt <= Date.now()) render(state);
  }, 160);
}());
