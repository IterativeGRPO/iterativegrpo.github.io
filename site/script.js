const header = document.querySelector('[data-header]');
const navToggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('#site-nav');
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
let scrollTicking = false;

function updateHeader() {
  header?.classList.toggle('scrolled', window.scrollY > 24);
  scrollTicking = false;
}

updateHeader();
window.addEventListener('scroll', () => {
  if (scrollTicking) return;
  scrollTicking = true;
  window.requestAnimationFrame(updateHeader);
}, { passive: true });

navToggle?.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(isOpen));
});

nav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    nav.classList.remove('open');
    navToggle?.setAttribute('aria-expanded', 'false');
  });
});

const revealObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -35px' })
  : null;

document.querySelectorAll('.reveal').forEach((element) => {
  if (revealObserver) revealObserver.observe(element);
  else element.classList.add('visible');
});

const motionObserver = !reducedMotion && 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle('is-active', entry.isIntersecting);
        if (entry.target.matches('.env-card')) {
          setEnvironmentLoopActive(entry.target, entry.isIntersecting);
        }
      });
    }, { threshold: 0.18 })
  : null;

document.querySelectorAll('[data-motion]').forEach((element) => {
  if (motionObserver) motionObserver.observe(element);
  else {
    element.classList.add('is-active');
  }
});

const pick = (values) => values[Math.floor(Math.random() * values.length)];
const shuffle = (values) => {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};
const roundTo = (value, step = 1) => Math.round(value / step) * step;
const sceneText = (card, key, value) => {
  const node = card.querySelector(`[data-scene="${key}"]`);
  if (node) node.textContent = value;
};

const environmentFactories = {
  'env-craigslist': (card) => {
    const item = pick(['road bike', 'desk chair', 'phone', 'camera', 'coffee table', 'monitor']);
    const list = pick([40, 60, 80, 100, 150, 240, 400]);
    const target = roundTo(list * pick([.58, .62, .67, .7, .74]), 5);
    const opening = roundTo(target + (list - target) * pick([.12, .2, .28]), 5);
    const counter = roundTo(list - (list - target) * pick([.34, .43, .51]), 5);
    const deal = roundTo((opening + counter) / 2, 5);
    sceneText(card, 'list-price', `LIST $${list}`);
    sceneText(card, 'buyer-target', `TARGET $${target}`);
    sceneText(card, 'agreed-price', `AGREED $${deal}`);
    return [
      { speaker: 'VENDOR', side: 'left', text: `I'm selling this ${item} for $${list}. Interested?`, status: 'OPENING' },
      { speaker: 'CUSTOMER', side: 'right', text: `I could do $${opening}. Would that work?`, status: 'OFFER 1' },
      { speaker: 'VENDOR', side: 'left', text: `I can come down to $${counter}.`, status: 'COUNTEROFFER' },
      { speaker: 'CUSTOMER', side: 'right', text: `Let's meet at $${deal}. AGREED.`, status: `AGREED · $${deal}`, terminal: true },
    ];
  },
  'env-ultimatum': (card) => {
    const pool = pick([100, 500, 1000, 5000, 10000]);
    const rounds = pick([4, 6, 8]);
    const step = pool >= 5000 ? 500 : pool >= 1000 ? 100 : pool >= 500 ? 25 : 5;
    const first = roundTo(pool * pick([.62, .65, .68]), step);
    const response = roundTo(pool * pick([.48, .5, .52]), step);
    const deal = roundTo((first + response) / 2, step);
    sceneText(card, 'ultimatum-pool', `POOL $${pool.toLocaleString()} · ${rounds} ROUNDS · ACCEPTANCE RISK`);
    const updateSplit = (share) => {
      const compact = (value) => value >= 1000 ? `${value / 1000}k` : String(value);
      sceneText(card, 'proposer-share', compact(share));
      sceneText(card, 'responder-share', compact(pool - share));
    };
    updateSplit(first);
    return [
      { speaker: 'PROPOSER', side: 'left', text: `I propose $${first.toLocaleString()} for me and $${(pool - first).toLocaleString()} for you.`, status: 'PROPOSAL', apply: () => updateSplit(first) },
      { speaker: 'RESPONDER', side: 'right', text: `Too uneven. I can accept if your share is $${response.toLocaleString()}.`, status: 'COUNTEROFFER', apply: () => updateSplit(response) },
      { speaker: 'PROPOSER', side: 'left', text: `How about $${deal.toLocaleString()} for me?`, status: 'FINAL OFFER', apply: () => updateSplit(deal) },
      { speaker: 'RESPONDER', side: 'right', text: 'Accepted. The pool is divided.', status: 'ACCEPTED · POOL PRESERVED', terminal: true },
    ];
  },
  'env-dond': (card) => {
    const names = ['BOOK', 'HAT', 'BALL'];
    const [counts, values] = pick([
      [[2, 2, 1], [1, 3, 2]],
      [[1, 1, 3], [4, 3, 1]],
      [[3, 1, 1], [1, 5, 2]],
      [[1, 3, 1], [4, 1, 3]],
      [[2, 1, 2], [2, 4, 1]],
    ]);
    const favoriteIndex = values.indexOf(Math.max(...values));
    const favorite = names[favoriteIndex];
    const theirIndices = names.map((_, index) => index).filter((index) => index !== favoriteIndex);
    const theirs = theirIndices.map((index) => names[index]);
    const itemLabel = (index) => `${counts[index]} ${names[index]}${counts[index] === 1 ? '' : 'S'}`;
    sceneText(card, 'dond-pool', `POOL: ${counts[0]} BOOKS · ${counts[1]} HATS · ${counts[2]} BALLS`);
    sceneText(card, 'book-value', `BOOK ${values[0]}`);
    sceneText(card, 'hat-value', `HAT ${values[1]}`);
    sceneText(card, 'ball-value', `BALL ${values[2]}`);
    sceneText(card, 'mine-allocation', `MINE: ${itemLabel(favoriteIndex)}`);
    sceneText(card, 'their-allocation', `THEIRS: ${theirIndices.map(itemLabel).join(' + ')}`);
    const itemCenters = [225, 287, 350];
    card.querySelectorAll('.item-pool .item').forEach((node, index) => {
      const target = index === favoriteIndex ? 126 : 434;
      node.style.setProperty('--allocation-x', `${target - itemCenters[index]}px`);
    });
    return [
      { speaker: 'AGENT 1', side: 'left', text: 'Which items matter most to you?', status: 'DISCOVER PREFERENCES' },
      { speaker: 'AGENT 2', side: 'right', text: `I care most about ${theirs[0].toLowerCase()}s. What about you?`, status: 'PRIVATE VALUES REVEALED' },
      { speaker: 'AGENT 1', side: 'left', text: `I value ${favorite.toLowerCase()}s most. I take all ${counts[favoriteIndex]}; you take the ${theirs.join(' and ').toLowerCase()}s.`, status: 'VALID PROPOSAL' },
      { speaker: 'AGENT 2', side: 'right', text: 'ACCEPT. Every item is allocated.', status: 'BILATERAL ACCEPT', terminal: true },
    ];
  },
  'env-casino': (card) => {
    const supplies = ['FOOD', 'WATER', 'FIREWOOD'];
    const prioritiesA = shuffle(supplies);
    let prioritiesB = shuffle(supplies);
    if (prioritiesB[0] === prioritiesA[0]) prioritiesB = [prioritiesB[1], prioritiesB[0], prioritiesB[2]];
    [['high', 0], ['medium', 1], ['low', 2]].forEach(([level, index]) => {
      sceneText(card, `camper-a-${level}`, `${level === 'medium' ? 'MED ' : level.toUpperCase()}  ${prioritiesA[index]}`);
      sceneText(card, `camper-b-${level}`, `${level === 'medium' ? 'MED ' : level.toUpperCase()}  ${prioritiesB[index]}`);
    });
    card.querySelectorAll('.supply').forEach((node) => node.classList.remove('trade-to-a', 'trade-to-b'));
    card.querySelector(`.supply-${prioritiesA[0] === 'FIREWOOD' ? 'fire' : prioritiesA[0].toLowerCase()}`)?.classList.add('trade-to-a');
    card.querySelector(`.supply-${prioritiesB[0] === 'FIREWOOD' ? 'fire' : prioritiesB[0].toLowerCase()}`)?.classList.add('trade-to-b');
    return [
      { speaker: 'CAMPER A', side: 'left', text: `I need ${prioritiesA[0].toLowerCase()} most. What is essential for you?`, status: 'SHARE PRIORITIES' },
      { speaker: 'CAMPER B', side: 'right', text: `${prioritiesB[0]} is my high priority; ${prioritiesB[2].toLowerCase()} matters least.`, status: 'FIND COMPLEMENTARITY' },
      { speaker: 'CAMPER A', side: 'left', text: `You take more ${prioritiesB[0].toLowerCase()}; I take more ${prioritiesA[0].toLowerCase()}. We split the remainder.`, status: 'LOGROLLING TRADE' },
      { speaker: 'CAMPER B', side: 'right', text: 'Agreed. That covers both of our highest needs.', status: 'AGREED · 9 PACKAGES SPLIT', terminal: true },
    ];
  },
  'env-job': (card) => {
    const salary = pick([31, 34, 37, 40, 43, 46]);
    const holiday = pick([3, 4, 5, 6]);
    const workplace = pick(['TOKYO', 'SEOUL', 'BEIJING', 'SYDNEY']);
    const company = pick(['GOOGLE', 'FACEBOOK', 'APPLE', 'AMAZON']);
    const position = pick(['ENGINEER', 'MANAGER', 'DESIGNER', 'SALES']);
    sceneText(card, 'job-workplace', workplace);
    sceneText(card, 'job-company', company);
    sceneText(card, 'job-position', position);
    const salaryDot = card.querySelector('.row-salary circle');
    const holidayDot = card.querySelector('.row-holiday circle');
    salaryDot?.setAttribute('cx', String(200 + ((salary - 20) / 31) * 264));
    holidayDot?.setAttribute('cx', String(200 + ((holiday - 2) / 5) * 264));
    return [
      { speaker: 'RECRUITER', side: 'left', text: 'Which terms matter most in your offer?', status: 'DISCOVER PRIORITIES' },
      { speaker: 'CANDIDATE', side: 'right', text: `Position and time off matter most. I prefer ${holiday} holiday days.`, status: 'CANDIDATE PRIORITIES' },
      { speaker: 'RECRUITER', side: 'left', text: `$${salary}K, ${holiday} holiday days, ${workplace}. ${position} at ${company}?`, status: 'FIVE-ISSUE OFFER' },
      { speaker: 'CANDIDATE', side: 'right', text: 'Agreed. The linked offer works for me.', status: 'ALL FIVE TERMS AGREED', terminal: true },
    ];
  },
  'env-alliance': (card) => {
    const options = [pick([1, 2]), pick([1, 2, 3]), pick([1, 2, 3, 4]), pick([1, 2, 3, 4]), pick([1, 2, 3, 4, 5])];
    const scoreA = pick([58, 62, 67, 71, 76]);
    const scoreB = pick([55, 60, 64, 69, 73]);
    const batnaA = pick([35, 40, 45, 50]);
    const batnaB = pick([34, 39, 44, 49]);
    sceneText(card, 'alliance-deal-1', `A${options[0]} · B${options[1]}`);
    sceneText(card, 'alliance-deal-2', `C${options[2]} · D${options[3]}`);
    sceneText(card, 'alliance-deal-3', `E${options[4]}`);
    const setGauge = (selector, start, width, score, batna) => {
      const gauge = card.querySelector(selector);
      const thresholdX = start + (batna / 100) * width;
      const scoreX = start + (score / 100) * width;
      gauge?.querySelector('line')?.setAttribute('x1', String(thresholdX));
      gauge?.querySelector('line')?.setAttribute('x2', String(thresholdX));
      gauge?.querySelector('circle')?.setAttribute('cx', String(scoreX));
    };
    setGauge('.batna-a', 102, 165, scoreA, batnaA);
    setGauge('.batna-b', 368, 164, scoreB, batnaB);
    return [
      { speaker: 'STAKEHOLDER A', side: 'left', text: 'Infrastructure and employment are most important to us.', status: 'SURFACE PRIORITIES' },
      { speaker: 'STAKEHOLDER B', side: 'right', text: 'Our focus is environment and compensation.', status: 'PRIVATE SCORES DIFFER' },
      { speaker: 'STAKEHOLDER A', side: 'left', text: `Proposal A${options[0]} B${options[1]} C${options[2]} D${options[3]} E${options[4]}. My score is ${scoreA}; BATNA ${batnaA}.`, status: 'CHECK BOTH BATNAS' },
      { speaker: 'STAKEHOLDER B', side: 'right', text: `My score is ${scoreB} against BATNA ${batnaB}. Agreed.`, status: 'FEASIBLE AGREEMENT', terminal: true },
    ];
  },
};

const environmentRuntime = new WeakMap();

function environmentFactoryFor(card) {
  return Object.entries(environmentFactories).find(([className]) => card.classList.contains(className))?.[1];
}

function buildDialogueTrack(card, count) {
  const track = card.querySelector('[data-dialogue-track]');
  if (!track) return;
  track.replaceChildren(...Array.from({ length: count }, () => document.createElement('i')));
}

function appendDialogueTurn(card, turn, index, count) {
  turn.apply?.();
  const log = card.querySelector('[data-dialogue-log]');
  const status = card.querySelector('[data-dialogue-status]');
  if (!log || !status) return;
  log.querySelectorAll('.current').forEach((node) => node.classList.remove('current'));
  const row = document.createElement('div');
  row.className = `dialogue-turn ${turn.side} current${turn.terminal ? ' terminal' : ''}`;
  const speaker = document.createElement('span');
  speaker.textContent = turn.speaker;
  const message = document.createElement('p');
  message.textContent = turn.text;
  row.append(speaker, message);
  log.append(row);
  while (log.children.length > 3) log.firstElementChild.remove();
  status.textContent = turn.status || `TURN ${index + 1} / ${count}`;
  card.querySelectorAll('[data-dialogue-track] i').forEach((node, dotIndex) => {
    node.classList.toggle('done', dotIndex <= index);
    node.classList.toggle('current', dotIndex === index);
  });
}

function beginEnvironmentScenario(card, staticMode = false) {
  const factory = environmentFactoryFor(card);
  if (!factory) return;
  const runtime = environmentRuntime.get(card) || {};
  const turns = factory(card);
  runtime.turns = turns;
  runtime.index = 0;
  card.querySelector('[data-dialogue-log]')?.replaceChildren();
  buildDialogueTrack(card, turns.length);
  if (staticMode) {
    card.classList.remove('scenario-playing');
    turns.forEach((turn, index) => appendDialogueTurn(card, turn, index, turns.length));
    environmentRuntime.set(card, runtime);
    return;
  }
  card.classList.remove('scenario-playing');
  void card.offsetWidth;
  card.classList.add('scenario-playing');
  appendDialogueTurn(card, turns[0], 0, turns.length);
  runtime.index = 1;
  runtime.timer = window.setTimeout(() => advanceEnvironmentScenario(card), 1450);
  environmentRuntime.set(card, runtime);
}

function advanceEnvironmentScenario(card) {
  const runtime = environmentRuntime.get(card);
  if (!runtime?.running || !card.classList.contains('is-active')) return;
  if (runtime.index >= runtime.turns.length) {
    beginEnvironmentScenario(card);
    return;
  }
  appendDialogueTurn(card, runtime.turns[runtime.index], runtime.index, runtime.turns.length);
  runtime.index += 1;
  runtime.timer = runtime.index >= runtime.turns.length
    ? window.setTimeout(() => beginEnvironmentScenario(card), 2350)
    : window.setTimeout(() => advanceEnvironmentScenario(card), 1450);
}

function setEnvironmentLoopActive(card, active) {
  const runtime = environmentRuntime.get(card) || {};
  window.clearTimeout(runtime.timer);
  runtime.running = active;
  environmentRuntime.set(card, runtime);
  if (active) beginEnvironmentScenario(card);
  else card.classList.remove('scenario-playing');
}

if (reducedMotion) {
  document.querySelectorAll('.env-card').forEach((card) => beginEnvironmentScenario(card, true));
} else if (!motionObserver) {
  document.querySelectorAll('.env-card').forEach((card) => setEnvironmentLoopActive(card, true));
}

const copyButton = document.querySelector('[data-copy]');
const copyLabel = document.querySelector('[data-copy-label]');
const bibtex = document.querySelector('#bibtex');

const methodVisual = document.querySelector('[data-method-visual]');
window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return;
  if (event.data?.type !== 'igrpo-visual-height' || !methodVisual) return;
  const height = Number(event.data.height);
  if (Number.isFinite(height) && height > 0) {
    methodVisual.style.height = `${Math.ceil(height)}px`;
  }
});

copyButton?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(bibtex.textContent.trim());
    copyLabel.textContent = 'Copied';
    window.setTimeout(() => { copyLabel.textContent = 'Copy BibTeX'; }, 1800);
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(bibtex);
    selection.removeAllRanges();
    selection.addRange(range);
    copyLabel.textContent = 'Select & copy';
  }
});
