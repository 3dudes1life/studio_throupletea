(function () {
  'use strict';

  const STORAGE_KEY = 'throuple-tea-studio-v2-hosts-only';
  const LEGACY_KEY = 'throuple-tea-studio-v1';
  const CHANNEL_NAME = 'throuple-tea-studio-v2-live';
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;

  const DEFAULT_SEGMENTS = [
    { id: 'preshow', name: 'Pre-Show Checklist', minutes: 5, note: 'Start OBS and the podcast recorder, silence phones, check water and levels.' },
    { id: 'cold-open', name: 'Cold Open', minutes: 3, note: 'Capture a funny or intriguing opening before the official intro.' },
    { id: 'intro', name: 'Official Intro', minutes: 2, note: 'Record a clean intro and the William, Daniel and Caleb name break.' },
    { id: 'catchup', name: 'Life Catch-Up', minutes: 12, note: 'What happened since the previous episode?' },
    { id: 'main', name: 'Main Topic', minutes: 35, note: 'Primary episode conversation and planned questions.' },
    { id: 'hotline', name: 'Throuple Hotline', minutes: 10, note: 'Listener email, question or shoutout.' },
    { id: 'chaos', name: 'Bowl of Chaos', minutes: 12, note: 'A game or prompt that does not repeat the main topic.' },
    { id: 'wrap', name: 'Wrap-Up', minutes: 5, note: 'Final thoughts, must-mentions and calls to action.' },
    { id: 'outro', name: 'Official Outro', minutes: 2, note: 'Record a clean ending.' }
  ];

  const DEFAULT_PREFLIGHT = [
    { id: 'obs-ready', label: 'OBS scene, camera and framing confirmed', done: false },
    { id: 'obs-recording', label: 'OBS recording started', done: false },
    { id: 'audio-recording', label: 'PodTrak / podcast recorder started', done: false },
    { id: 'mic-levels', label: 'All three microphone levels checked', done: false },
    { id: 'phones', label: 'Phones and noisy notifications silenced', done: false },
    { id: 'water', label: 'Water, notes and Bowl of Chaos ready', done: false }
  ];

  const DEFAULT_POSTFLIGHT = [
    { id: 'obs-stopped', label: 'OBS recording stopped and file confirmed', done: false },
    { id: 'audio-stopped', label: 'Podcast recorder stopped and tracks confirmed', done: false },
    { id: 'files-backed-up', label: 'Video and audio copied to the episode folder', done: false },
    { id: 'markers-exported', label: 'Clip markers and session notes exported', done: false },
    { id: 'promises-captured', label: 'On-air promises and follow-ups captured', done: false }
  ];

  const DEFAULT_STATE = {
    schemaVersion: 3,
    revision: 0,
    updatedAt: null,
    mode: 'hosts-only',
    show: {
      title: '3Dudes1Life: A Little Throuple Tea',
      shortTitle: 'A Little Throuple Tea',
      tagline: 'Love, chaos, and way too many side hustles collide.',
      social: '@throupletea',
      intro: 'Welcome to 3Dudes1Life: A Little Throuple Tea — the podcast where love, chaos, and way too many side hustles collide. We’re a real-life throuple sharing unfiltered stories, messy opinions, and plenty of tea.\n\nI’m William.\nI’m Daniel.\nAnd I’m Caleb.\n\nEvery week we’ll drag each other, spill the tea from IG, and break down whatever trash TV we’re obsessed with. This is our life, our love, our chaos. Throuple life… it doesn’t suck.',
      outro: 'Thanks for hanging out with us on 3Dudes1Life: A Little Throuple Tea. Don’t forget to follow, rate, and share the show — and keep those questions coming for Social Media Tea. Until next time… Throuple life, it doesn’t suck.'
    },
    episode: {
      number: '29',
      season: '2',
      title: 'Can a Throuple Actually Get Married?',
      mainTopic: 'Marriage equality, domestic partnership, legal recognition and the ridiculous rules around throuples.',
      recordingDate: '2026-07-23',
      recordingTime: '',
      exclusionKeywords: 'marriage, wedding, trust, estate planning, domestic partnership',
      hotline: {
        enabled: true,
        listener: '',
        question: '',
        notes: 'Give the listener a shoutout and thank them for emailing the show.'
      },
      mustMentions: [
        { id: 'mention-listener-email', text: 'Listener email and shoutout', done: false },
        { id: 'mention-la-blade', text: 'Mention the LA Blade partnership', done: false },
        { id: 'mention-hotline', text: 'Invite listeners to use the Throuple Hotline', done: false }
      ],
      questions: [
        'When did we first realize that a throuple cannot legally marry as one unit?',
        'Why does the system understand complicated reality-TV relationships better than ours?',
        'What legal protections matter most when three people build one life?',
        'What is funny about this situation—and what is genuinely frustrating?',
        'What would equal recognition actually look like?'
      ],
      backupQuestions: [
        'What is the weirdest assumption people make about our relationship?',
        'What would our relationship reality show be called?',
        'Which one of us would accidentally start a legal fight with a company?',
        'What is one thing people misunderstand about long-term commitment?'
      ],
      segments: DEFAULT_SEGMENTS
    },
    production: {
      preflight: DEFAULT_PREFLIGHT,
      postflight: DEFAULT_POSTFLIGHT,
      onAirPromises: [],
      debrief: ''
    },
    guest: {
      name: 'Future Guest',
      pronouns: '',
      title: '',
      social: '',
      email: '',
      promo: '',
      notes: '',
      releaseAccepted: false,
      ready: false
    },
    studio: {
      mode: 'hosts-only',
      currentSegment: 0,
      currentQuestion: '',
      currentSpeaker: 'William',
      speakerDurations: { William: 0, Daniel: 0, Caleb: 0 },
      speakerStartedAtMs: 0,
      direction: '',
      hostNote: '',
      currentMustMention: '',
      usedPromptIds: [],
      segmentStartedAtMs: 0,
      segmentDurations: {}
    },
    timer: {
      status: 'idle',
      baseElapsed: 0,
      startedAt: null,
      endedAt: null
    },
    lowerThird: {
      visible: false,
      name: '3Dudes1Life',
      title: 'Hosts of A Little Throuple Tea',
      social: '@throupletea'
    },
    graphic: {
      id: null,
      visible: false,
      type: '',
      headline: '',
      subline: '',
      expiresAt: null
    },
    bowl: {
      currentPrompt: null,
      usedIds: []
    },
    clips: [],
    cues: [],
    activity: []
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function mergeDefaults(defaultValue, storedValue) {
    if (Array.isArray(defaultValue)) {
      return Array.isArray(storedValue) ? storedValue : clone(defaultValue);
    }
    if (defaultValue && typeof defaultValue === 'object') {
      const result = {};
      const source = storedValue && typeof storedValue === 'object' ? storedValue : {};
      Object.keys(defaultValue).forEach((key) => {
        result[key] = mergeDefaults(defaultValue[key], source[key]);
      });
      Object.keys(source).forEach((key) => {
        if (!(key in result)) result[key] = source[key];
      });
      return result;
    }
    return storedValue === undefined || storedValue === null ? defaultValue : storedValue;
  }

  function migrateLegacy() {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) return null;
      const legacy = JSON.parse(raw);
      const migrated = clone(DEFAULT_STATE);
      if (legacy.show) migrated.show = mergeDefaults(migrated.show, legacy.show);
      if (legacy.episode) {
        ['number', 'season', 'title', 'mainTopic', 'recordingDate', 'recordingTime', 'exclusionKeywords', 'questions', 'backupQuestions'].forEach((key) => {
          if (legacy.episode[key] !== undefined) migrated.episode[key] = clone(legacy.episode[key]);
        });
      }
      if (Array.isArray(legacy.clips)) migrated.clips = clone(legacy.clips);
      if (Array.isArray(legacy.activity)) migrated.activity = clone(legacy.activity);
      if (legacy.studio && legacy.studio.hostNote) migrated.studio.hostNote = legacy.studio.hostNote;
      return migrated;
    } catch (error) {
      console.warn('Could not migrate the earlier studio prototype.', error);
      return null;
    }
  }

  function readState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return mergeDefaults(DEFAULT_STATE, JSON.parse(raw));
      const migrated = migrateLegacy();
      return migrated ? mergeDefaults(DEFAULT_STATE, migrated) : clone(DEFAULT_STATE);
    } catch (error) {
      console.warn('Could not read studio state.', error);
      return clone(DEFAULT_STATE);
    }
  }

  let state = readState();

  function announce(nextState, source) {
    const detail = { state: clone(nextState), source: source || 'local' };
    window.dispatchEvent(new CustomEvent('ttstudio:state', { detail }));
    if (channel) channel.postMessage({ type: 'state', state: detail.state, source: detail.source });
  }

  function saveState(nextState, source) {
    state = mergeDefaults(DEFAULT_STATE, nextState);
    state.mode = 'hosts-only';
    state.studio.mode = 'hosts-only';
    state.schemaVersion = 3;
    state.revision = Number(state.revision || 0) + 1;
    state.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Could not save studio state.', error);
    }
    announce(state, source);
    return clone(state);
  }

  function update(mutator, source) {
    const next = clone(state);
    mutator(next);
    return saveState(next, source || 'update');
  }

  function replace(nextState, source) {
    return saveState(nextState, source || 'replace');
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    state = clone(DEFAULT_STATE);
    return saveState(state, 'reset');
  }

  function subscribe(callback) {
    const handler = (event) => callback(clone(event.detail.state), event.detail.source);
    window.addEventListener('ttstudio:state', handler);
    callback(clone(state), 'initial');
    return function unsubscribe() {
      window.removeEventListener('ttstudio:state', handler);
    };
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const incoming = mergeDefaults(DEFAULT_STATE, JSON.parse(event.newValue));
      if ((incoming.revision || 0) >= (state.revision || 0)) {
        state = incoming;
        window.dispatchEvent(new CustomEvent('ttstudio:state', {
          detail: { state: clone(state), source: 'storage' }
        }));
      }
    } catch (error) {
      console.warn('Could not sync studio state.', error);
    }
  });

  if (channel) {
    channel.addEventListener('message', (event) => {
      if (!event.data || event.data.type !== 'state' || !event.data.state) return;
      const incoming = mergeDefaults(DEFAULT_STATE, event.data.state);
      if ((incoming.revision || 0) >= (state.revision || 0)) {
        state = incoming;
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
          console.warn('Could not persist channel state.', error);
        }
        window.dispatchEvent(new CustomEvent('ttstudio:state', {
          detail: { state: clone(state), source: event.data.source || 'channel' }
        }));
      }
    });
  }

  function timerMilliseconds(inputState) {
    const timer = (inputState || state).timer;
    const base = Number(timer.baseElapsed || 0);
    if (timer.status === 'recording' && timer.startedAt) {
      return base + Math.max(0, Date.now() - Number(timer.startedAt));
    }
    return base;
  }

  function formatTime(milliseconds, includeHours) {
    const total = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    return includeHours || hours > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  function addActivity(nextState, message) {
    nextState.activity = Array.isArray(nextState.activity) ? nextState.activity : [];
    nextState.activity.unshift({
      id: `activity-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      message,
      at: new Date().toISOString()
    });
    nextState.activity = nextState.activity.slice(0, 80);
  }

  function finalizeCurrentSpeaker(next) {
    if (!next || !next.studio) return;
    const speaker = next.studio.currentSpeaker;
    if (!speaker || !['William', 'Daniel', 'Caleb'].includes(speaker)) return;
    const elapsed = timerMilliseconds(next);
    const started = Number(next.studio.speakerStartedAtMs || 0);
    const delta = Math.max(0, elapsed - started);
    next.studio.speakerDurations = next.studio.speakerDurations || { William: 0, Daniel: 0, Caleb: 0 };
    next.studio.speakerDurations[speaker] = Number(next.studio.speakerDurations[speaker] || 0) + delta;
    next.studio.speakerStartedAtMs = elapsed;
  }

  function startTimer() {
    return update((next) => {
      if (next.timer.status === 'recording') return;
      const wasIdle = next.timer.status === 'idle' || next.timer.status === 'ended';
      if (wasIdle && next.timer.status === 'ended') {
        next.timer.baseElapsed = 0;
        next.studio.segmentDurations = {};
        next.studio.segmentStartedAtMs = 0;
        next.studio.speakerDurations = { William: 0, Daniel: 0, Caleb: 0 };
        next.studio.speakerStartedAtMs = 0;
      }
      next.timer.status = 'recording';
      next.timer.startedAt = Date.now();
      next.timer.endedAt = null;
      next.studio.speakerStartedAtMs = timerMilliseconds(next);
      addActivity(next, 'Studio timer started alongside OBS and the podcast recorder');
    }, 'timer-start');
  }

  function pauseTimer() {
    return update((next) => {
      if (next.timer.status !== 'recording') return;
      finalizeCurrentSpeaker(next);
      next.timer.baseElapsed = timerMilliseconds(next);
      next.timer.startedAt = null;
      next.timer.status = 'paused';
      addActivity(next, 'Studio timer paused');
    }, 'timer-pause');
  }

  function endTimer() {
    return update((next) => {
      finalizeCurrentSpeaker(next);
      next.timer.baseElapsed = timerMilliseconds(next);
      next.timer.startedAt = null;
      next.timer.status = 'ended';
      next.timer.endedAt = Date.now();
      addActivity(next, 'Episode session ended');
    }, 'timer-end');
  }

  function resetTimer() {
    return update((next) => {
      next.timer = { status: 'idle', baseElapsed: 0, startedAt: null, endedAt: null };
      next.studio.segmentStartedAtMs = 0;
      next.studio.segmentDurations = {};
      next.studio.speakerDurations = { William: 0, Daniel: 0, Caleb: 0 };
      next.studio.speakerStartedAtMs = 0;
      addActivity(next, 'Studio timer, segment timing and speaker tracking reset');
    }, 'timer-reset');
  }

  function fireGraphic(type, headline, subline, duration) {
    const id = `graphic-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const displayFor = Number(duration || 4500);
    update((next) => {
      next.graphic = {
        id,
        visible: true,
        type,
        headline,
        subline: subline || '',
        expiresAt: Date.now() + displayFor
      };
      addActivity(next, `OBS graphic: ${headline}`);
    }, 'graphic-show');
    window.setTimeout(() => {
      const current = readState();
      if (current.graphic.id !== id) return;
      update((next) => {
        if (next.graphic.id === id) next.graphic.visible = false;
      }, 'graphic-hide');
    }, displayFor + 100);
  }

  function download(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function csvEscape(value) {
    const text = String(value == null ? '' : value);
    return `"${text.replace(/"/g, '""')}"`;
  }

  function clipsToCsv(inputState) {
    const source = inputState || state;
    const header = ['Time', 'Speaker', 'Type', 'Rating', 'Tags', 'Note', 'Created'];
    const rows = (source.clips || []).map((clip) => [
      clip.time,
      clip.speaker,
      clip.type,
      clip.rating,
      (clip.tags || []).join(' | '),
      clip.note,
      clip.createdAt
    ]);
    return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
  }

  function readiness(inputState) {
    const source = inputState || state;
    const all = source.production && Array.isArray(source.production.preflight) ? source.production.preflight : [];
    const done = all.filter((item) => item.done).length;
    return {
      done,
      total: all.length,
      percent: all.length ? Math.round((done / all.length) * 100) : 100,
      ready: all.length === done
    };
  }

  function getState() {
    return clone(state);
  }

  function applyUrlParams() {
    return getState();
  }

  window.TTStudio = {
    STORAGE_KEY,
    DEFAULT_STATE: clone(DEFAULT_STATE),
    getState,
    update,
    replace,
    reset,
    subscribe,
    timerMilliseconds,
    formatTime,
    startTimer,
    pauseTimer,
    endTimer,
    resetTimer,
    addActivity,
    fireGraphic,
    download,
    clipsToCsv,
    readiness,
    applyUrlParams
  };
}());
