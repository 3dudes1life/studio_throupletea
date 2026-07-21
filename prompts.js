(function () {
  'use strict';

  const PROMPTS = [
    { id: 'p01', category: 'Rapid Fire', text: 'What is the dumbest hill you would absolutely die on?', tags: ['opinions', 'chaos'] },
    { id: 'p02', category: 'Rapid Fire', text: 'Which household chore reveals the worst version of you?', tags: ['home', 'habits'] },
    { id: 'p03', category: 'Rapid Fire', text: 'What food opinion would get you removed from the group chat?', tags: ['food', 'opinions'] },
    { id: 'p04', category: 'Rapid Fire', text: 'What app knows too much about you?', tags: ['technology', 'habits'] },
    { id: 'p05', category: 'Rapid Fire', text: 'Who would survive longest in a reality show house?', tags: ['reality tv', 'ranking'] },
    { id: 'p06', category: 'Rapid Fire', text: 'What is your most irrational pet peeve?', tags: ['confession', 'habits'] },
    { id: 'p07', category: 'Rapid Fire', text: 'What is a completely random green flag?', tags: ['attraction', 'opinions'] },
    { id: 'p08', category: 'Rapid Fire', text: 'Who is most likely to accidentally join a cult?', tags: ['ranking', 'chaos'] },

    { id: 'p09', category: 'Confession', text: 'What is something you pretend to understand but absolutely do not?', tags: ['confession'] },
    { id: 'p10', category: 'Confession', text: 'What purchase did you defend way harder than it deserved?', tags: ['money', 'confession'] },
    { id: 'p11', category: 'Confession', text: 'What is the last lie you told to avoid leaving the house?', tags: ['confession', 'social'] },
    { id: 'p12', category: 'Confession', text: 'What is your most embarrassing comfort show?', tags: ['television', 'confession'] },
    { id: 'p13', category: 'Confession', text: 'What personal flaw have you decided is now part of your brand?', tags: ['confession', 'personality'] },
    { id: 'p14', category: 'Confession', text: 'What is the pettiest reason you have disliked someone?', tags: ['confession', 'social'] },
    { id: 'p15', category: 'Confession', text: 'What skill do you confidently claim despite having no evidence?', tags: ['confession', 'skills'] },
    { id: 'p16', category: 'Confession', text: 'What is one thing you secretly judge people for?', tags: ['confession', 'opinions'] },

    { id: 'p17', category: 'Would You Rather', text: 'Would you rather narrate your thoughts out loud or have your search history projected once a week?', tags: ['would you rather', 'technology'] },
    { id: 'p18', category: 'Would You Rather', text: 'Would you rather lose your phone for a month or share one phone with everyone in your house?', tags: ['would you rather', 'technology'] },
    { id: 'p19', category: 'Would You Rather', text: 'Would you rather be famous for something embarrassing or unknown for something brilliant?', tags: ['would you rather', 'fame'] },
    { id: 'p20', category: 'Would You Rather', text: 'Would you rather only communicate through voice notes or only through reaction GIFs?', tags: ['would you rather', 'social'] },
    { id: 'p21', category: 'Would You Rather', text: 'Would you rather have unlimited vacations with terrible Wi-Fi or stay home with perfect Wi-Fi forever?', tags: ['would you rather', 'travel'] },
    { id: 'p22', category: 'Would You Rather', text: 'Would you rather know every secret or never hear gossip again?', tags: ['would you rather', 'gossip'] },
    { id: 'p23', category: 'Would You Rather', text: 'Would you rather be overdressed everywhere or underdressed everywhere?', tags: ['would you rather', 'style'] },
    { id: 'p24', category: 'Would You Rather', text: 'Would you rather relive your most awkward date or your most awkward family dinner?', tags: ['would you rather', 'awkward'] },

    { id: 'p25', category: 'Rank It', text: 'Rank these from worst to best: being late, cancelling last-minute, or showing up too early.', tags: ['ranking', 'social'] },
    { id: 'p26', category: 'Rank It', text: 'Rank the hosts by who would be best in a zombie apocalypse.', tags: ['ranking', 'survival'] },
    { id: 'p27', category: 'Rank It', text: 'Rank these vacation problems: bad hotel, bad food, bad weather.', tags: ['ranking', 'travel'] },
    { id: 'p28', category: 'Rank It', text: 'Rank the hosts by who is most likely to start a business after one compliment.', tags: ['ranking', 'business'] },
    { id: 'p29', category: 'Rank It', text: 'Rank these apology styles: flowers, food, money, or pretending nothing happened.', tags: ['ranking', 'conflict'] },
    { id: 'p30', category: 'Rank It', text: 'Rank the most dangerous phrases: “This will be quick,” “Trust me,” and “I have an idea.”', tags: ['ranking', 'chaos'] },
    { id: 'p31', category: 'Rank It', text: 'Rank your ability to cook, decorate, navigate and keep a secret.', tags: ['ranking', 'skills'] },
    { id: 'p32', category: 'Rank It', text: 'Rank the hosts by who would accidentally become internet-famous first.', tags: ['ranking', 'internet'] },

    { id: 'p33', category: 'Pure Chaos', text: 'Give everyone a warning label in five words or fewer.', tags: ['chaos', 'group'] },
    { id: 'p34', category: 'Pure Chaos', text: 'Invent a fake scandal about the person to your left.', tags: ['chaos', 'improv'] },
    { id: 'p35', category: 'Pure Chaos', text: 'Pitch the worst possible reality show starring everyone here.', tags: ['chaos', 'improv', 'television'] },
    { id: 'p36', category: 'Pure Chaos', text: 'Choose one person to plan the trip, one to manage the money and one to handle a crisis.', tags: ['chaos', 'ranking', 'travel'] },
    { id: 'p37', category: 'Pure Chaos', text: 'What would the group chat be called if honesty were required?', tags: ['chaos', 'group'] },
    { id: 'p38', category: 'Pure Chaos', text: 'Assign everyone a job in a deeply unsuccessful heist.', tags: ['chaos', 'improv'] },
    { id: 'p39', category: 'Pure Chaos', text: 'What product would each person be banned from endorsing?', tags: ['chaos', 'improv'] },
    { id: 'p40', category: 'Pure Chaos', text: 'Describe the person across from you as a suspicious online marketplace listing.', tags: ['chaos', 'improv'] },

    { id: 'p41', category: 'Whose Chart?', text: 'Needs to be right even when they are asking a question.', tags: ['astrology', 'personality'] },
    { id: 'p42', category: 'Whose Chart?', text: 'Loves chaos until it is time to clean it up—then suddenly becomes a Virgo.', tags: ['astrology', 'chaos'] },
    { id: 'p43', category: 'Whose Chart?', text: 'Can plan an entire trip in five minutes, but takes three weeks to unpack.', tags: ['astrology', 'travel'] },
    { id: 'p44', category: 'Whose Chart?', text: 'Uses humor as both armor and weapon—often in the same sentence.', tags: ['astrology', 'humor'] },
    { id: 'p45', category: 'Whose Chart?', text: 'Starts every project with “This will be quick”—famous last words.', tags: ['astrology', 'business'] },
    { id: 'p46', category: 'Whose Chart?', text: 'Acts chill, secretly keeps receipts like a Scorpio with Wi-Fi.', tags: ['astrology', 'personality'] },
    { id: 'p47', category: 'Whose Chart?', text: 'Gives great advice they do not personally follow.', tags: ['astrology', 'personality'] },
    { id: 'p48', category: 'Whose Chart?', text: 'Attracts weird coincidences and blames it on the universe doing bits.', tags: ['astrology', 'universe'] }
  ];

  function tokenize(value) {
    return String(value || '')
      .toLowerCase()
      .split(/[\s,;|/]+/)
      .map((token) => token.replace(/[^a-z0-9-]/g, ''))
      .filter((token) => token.length > 3);
  }

  function available(state, category) {
    const current = state || (window.TTStudio && TTStudio.getState());
    const used = new Set((current && current.bowl && current.bowl.usedIds) || []);
    const excluded = new Set([
      ...tokenize(current && current.episode && current.episode.mainTopic),
      ...tokenize(current && current.episode && current.episode.exclusionKeywords)
    ]);

    return PROMPTS.filter((prompt) => {
      if (used.has(prompt.id)) return false;
      if (category && category !== 'All' && prompt.category !== category) return false;
      const searchable = `${prompt.text} ${(prompt.tags || []).join(' ')}`.toLowerCase();
      for (const token of excluded) {
        if (searchable.includes(token)) return false;
      }
      return true;
    });
  }

  function draw(state, category) {
    let choices = available(state, category);
    if (!choices.length) {
      choices = PROMPTS.filter((prompt) => !category || category === 'All' || prompt.category === category);
    }
    if (!choices.length) return null;
    return choices[Math.floor(Math.random() * choices.length)];
  }

  window.TTStudioPrompts = {
    all: PROMPTS.slice(),
    categories: ['All', ...Array.from(new Set(PROMPTS.map((prompt) => prompt.category)))],
    available,
    draw
  };
}());
