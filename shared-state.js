(function () {
  'use strict';

  const STORAGE_KEY = 'throuple-tea-studio-v1';
  const CHANNEL_NAME = 'throuple-tea-studio-v1-live';
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;

  const DEFAULT_SEGMENTS = [
    { id: 'preshow', name: 'Pre-Show Check-In', minutes: 5, note: 'Guest welcome, final tech check, water and bathroom.' },
    { id: 'intro', name: 'Official Intro', minutes: 2, note: 'Record a clean intro and host name break.' },
    { id: 'catchup', name: 'Life Catch-Up', minutes: 10, note: 'What happened since the last episode?' },
    { id: 'main', name: 'Main Topic', minutes: 30, note: 'Primary episode conversation.' },
    { id: 'guest', name: 'Guest Spotlight', minutes: 15, note: 'Guest story, work, project or perspective.' },
    { id: 'chaos', name: 'Bowl of Chaos', minutes: 12, note: 'A game that does not repeat the main topic.' },
    { id: 'hotline', name: 'Throuple Hotline', minutes: 10, note: 'Listener email or question.' },
    { id: 'wrap', name: 'Wrap-Up', minutes: 5, note: 'Guest plug, final thought and social handles.' },
    { id: 'outro', name: 'Official Outro', minutes: 2, note: 'Record a clean ending.' }
  ];

  const DEFAULT_STATE = {
    schemaVersion: 1,
    revision: 0,
    updatedAt: null,
    show: {
      title: '3Dudes1Life: A Little Throuple Tea',
      tagline: 'Love, chaos, and way too many side hustles collide.',
      intro: 'Welcome to 3Dudes1Life: A Little Throuple Tea — the podcast where love, chaos, and way too many side hustles collide. We’re a real-life throuple sharing unfiltered stories, messy opinions, and plenty of tea.\n\nI’m William.\nI’m Daniel.\nAnd I’m Caleb.\n\nEvery week we’ll drag each other, spill the tea from IG, and break down whatever trash TV we’re obsessed with. This is our life, our love, our chaos. Throuple life… it doesn’t suck.',
      outro: 'Thanks for hanging out with us on 3Dudes1Life: A Little Throuple Tea. Don’t forget to follow, rate, and share the show — and keep those questions coming for Social Media Tea. Until next time… Throuple life, it doesn’t suck.'
    },
    episode: {
      number: '29',
      season: '2',
      title: 'Can a Throuple Actually Get Married?',
      mainTopic: 'Marriage equality, domestic partnership, legal recognition and the ridiculous rules around throuples.',
      recordingDate: '',
      recordingTime: '',
      recordingLink: '',
      exclusionKeywords: 'marriage, wedding, trust, estate planning, domestic partnership',
      questions: [
        'When did you first realize that a throuple cannot legally marry as one unit?',
        'Why does the system understand complicated reality TV relationships better than ours?',
        'What legal protections matter most when three people build one life?',
        'What is funny about this situation—and what is genuinely frustrating?',
        'What would equal recognition actually look like?'
      ],
      backupQuestions: [
        'What is the weirdest assumption people make about your relationship?',
        'What would your relationship reality show be called?',
        'Which one of you would accidentally start a legal fight with a company?',
        'What is one thing people misunderstand about long-term commitment?'
      ],
      segments: DEFAULT_SEGMENTS
    },
    guest: {
      name: 'Guest Name',
      pronouns: '',
      title: 'Guest / Creator / Expert',
      social: '@guest',
      email: '',
      promo: '',
      notes: '',
      releaseAccepted: false,
      ready: false
    },
    studio: {
      mode: 'lounge',
      currentSegment: 0,
      currentQuestion: '',
      currentSpeaker: 'William',
      privateCue: 'Welcome! We’ll begin in a moment.',
      guestRequest: null,
      connectionLabel: 'Prototype connection',
      hostNote: '',
      usedPromptIds: []
    },
    timer: {
      status: 'idle',
      baseElapsed: 0,
      startedAt: null,
      endedAt: null
    },
    media: {
      guestMicMuted: false,
      guestCameraOff: false
    },
    lowerThird: {
      visible: false,
      name: 'Guest Name',
      title: 'Guest / Creator / Expert',
      social: '@guest'
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

  function readState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return clone(DEFAULT_STATE);
      return mergeDefaults(DEFAULT_STATE, JSON.parse(raw));
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
    return replace(clone(DEFAULT_STATE), 'reset');
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

  function startTimer() {
    return update((next) => {
      if (next.timer.status === 'recording') return;
      next.timer.status = 'recording';
      next.timer.startedAt = Date.now();
      next.timer.endedAt = null;
      addActivity(next, 'Recording started');
    }, 'timer-start');
  }

  function pauseTimer() {
    return update((next) => {
      if (next.timer.status !== 'recording') return;
      next.timer.baseElapsed = timerMilliseconds(next);
      next.timer.startedAt = null;
      next.timer.status = 'paused';
      addActivity(next, 'Recording paused');
    }, 'timer-pause');
  }

  function endTimer() {
    return update((next) => {
      next.timer.baseElapsed = timerMilliseconds(next);
      next.timer.startedAt = null;
      next.timer.status = 'ended';
      next.timer.endedAt = Date.now();
      addActivity(next, 'Recording ended');
    }, 'timer-end');
  }

  function resetTimer() {
    return update((next) => {
      next.timer = { status: 'idle', baseElapsed: 0, startedAt: null, endedAt: null };
      addActivity(next, 'Recording timer reset');
    }, 'timer-reset');
  }

  function addActivity(nextState, message) {
    nextState.activity = Array.isArray(nextState.activity) ? nextState.activity : [];
    nextState.activity.unshift({
      id: `activity-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      message,
      at: new Date().toISOString()
    });
    nextState.activity = nextState.activity.slice(0, 60);
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
      addActivity(next, `Graphic: ${headline}`);
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

  function applyUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const mappings = {
      guest: ['guest', 'name'],
      pronouns: ['guest', 'pronouns'],
      title: ['episode', 'title'],
      episode: ['episode', 'number'],
      season: ['episode', 'season'],
      role: ['guest', 'title'],
      social: ['guest', 'social'],
      promo: ['guest', 'promo']
    };
    let changed = false;
    update((next) => {
      Object.entries(mappings).forEach(([param, path]) => {
        if (!params.has(param)) return;
        next[path[0]][path[1]] = params.get(param);
        changed = true;
      });
      if (changed) {
        next.lowerThird.name = next.guest.name;
        next.lowerThird.title = next.guest.title;
        next.lowerThird.social = next.guest.social;
      }
    }, 'url-params');
    return changed;
  }

  window.TTStudio = {
    STORAGE_KEY,
    DEFAULT_STATE: clone(DEFAULT_STATE),
    getState: () => clone(state),
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
    applyUrlParams,
    clone
  };
}());
