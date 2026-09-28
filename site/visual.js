(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('fig');
  function el(tag, attrs, parent) {
    const element = document.createElementNS(NS, tag);
    if (attrs) for (const key in attrs) element.setAttribute(key, attrs[key]);
    if (parent) parent.appendChild(element);
    return element;
  }

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, u) => a + (b - a) * u;
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const ease = (u) => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  const easeOutBack = (u) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
  };
  const bump = (t, a, b, f) => Math.min(seg(t, a, a + f), 1 - seg(t, b - f, b));

  function mulberry32(a) {
    return function random() {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const SUBS = '₀₁₂₃₄₅₆₇₈₉';
  const sub = (n) => String(n).split('').map((d) => SUBS[+d]).join('');
  const scaleAbout = (cx, cy, s) =>
    'translate(' + cx.toFixed(1) + ',' + cy.toFixed(1) + ') scale(' +
    s.toFixed(3) + ') translate(' + (-cx).toFixed(1) + ',' + (-cy).toFixed(1) + ')';

  function setOp(element, value) {
    value = Math.round(value * 1000) / 1000;
    if (element._op !== value) {
      element._op = value;
      element.setAttribute('opacity', value);
    }
  }

  function setText(element, value) {
    if (element._tx !== value) {
      element._tx = value;
      element.textContent = value;
    }
  }

  function toggleCls(element, className, enabled) {
    if (element.classList.contains(className) !== enabled) {
      element.classList.toggle(className, enabled);
    }
  }

  function setTf(element, value) {
    if (element._tf !== value) {
      element._tf = value;
      if (value) element.setAttribute('transform', value);
      else element.removeAttribute('transform');
    }
  }

  function rich(parent, x, y, parts, options = {}) {
    const size = options.size || 16;
    const text = el('text', { x, y, 'font-size': size }, parent);
    if (options.cls) text.setAttribute('class', options.cls);
    if (options.anchor) text.setAttribute('text-anchor', options.anchor);
    let currentOffset = 0;
    for (const part of parts) {
      const value = part[0];
      const kind = part[1] || 'n';
      const span = el('tspan', {}, text);
      let wantedOffset = 0;
      if (kind === 'sup') {
        wantedOffset = -size * .4;
        span.setAttribute('font-size', (size * .68).toFixed(1));
        span.setAttribute('class', 'math');
      } else if (kind === 'sub') {
        wantedOffset = size * .24;
        span.setAttribute('font-size', (size * .68).toFixed(1));
        span.setAttribute('class', 'math');
      } else if (kind === 'm') {
        span.setAttribute('class', 'math');
      } else if (kind === 'bm') {
        span.setAttribute('class', 'math');
        span.setAttribute('font-weight', '700');
      } else if (kind === 'b') {
        span.setAttribute('font-weight', '700');
      } else if (kind === 'tok') {
        span.setAttribute('class', 'tokfill');
      }
      if (wantedOffset !== currentOffset) {
        span.setAttribute('dy', (wantedOffset - currentOffset).toFixed(2));
        currentOffset = wantedOffset;
      }
      span.textContent = value;
    }
    return text;
  }

  const PHASES = [
    {
      name: 'Collect', t0: 0, t1: 5, show: 4.95,
      title: 'Collect trajectories',
      text: 'Roll out the current policy <i>π</i> in the real environment. Each episode is a multi-turn conversation, and the only reward is a sparse +1 or +0 at the very end.'
    },
    {
      name: 'Regress', t0: 5, t1: 8.5, show: 7.3,
      title: 'Regress on Monte Carlo returns',
      text: 'The final reward sweeps backward so every turn inherits its episode’s return, and <i>Q</i><sup><i>π</i></sup> is fit to predict that return from the conversation so far.'
    },
    {
      name: 'Sample', t0: 8.5, t1: 10.3, show: 10.25,
      title: 'Sample a group of responses',
      text: 'At a single turn, the LLM proposes a group of candidate responses. Nothing beyond this turn gets generated.'
    },
    {
      name: 'Score', t0: 10.3, t1: 14.3, show: 11.8,
      title: 'Score each candidate with <i>Q</i><sup><i>π</i></sup>',
      text: 'The branching futures that <i>Q</i><sup><i>π</i></sup> stands in for flicker into view, then collapse back into a single number. They are never actually rolled out.'
    },
    {
      name: 'Update', t0: 14.3, t1: 17, show: 16.4,
      title: 'Group-relative update (GRPO)',
      text: 'Scores are normalized within the group, and every token of a response receives that response’s advantage: green above the group mean, red below.'
    },
    {
      name: 'Improve', t0: 17, t1: 19, show: 18.6,
      title: 'Improved policy',
      text: 'The policy-gradient step produces <i>π′</i> without simulating the rest of the conversation.'
    },
    {
      name: 'Repeat', t0: 19, t1: 21, show: 19.8,
      title: 'Repeat',
      text: '<i>π</i> ← <i>π′</i>. Fresh rollouts from the better policy refit <i>Q</i><sup><i>π</i></sup> for the next round.'
    }
  ];
  const CYCLE = 21;
  const phaseIndex = (t) => {
    for (let i = PHASES.length - 1; i >= 0; i--) if (t >= PHASES[i].t0) return i;
    return 0;
  };

  const success = (k) => .9 - .6 * Math.pow(.7, k);
  function shuffle(items, random) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  function makeTree(random, rewards) {
    const jitter = (scale) => (random() - .5) * scale;
    return {
      jitterSeed: Math.floor(random() * 1e9),
      stems: [
        {
          head: -9 + jitter(3),
          branches: [
            { head: -12 + jitter(1.6), turns: 1 + Math.floor(random() * 3), r: rewards[0] },
            { head: -3.5 + jitter(2), turns: 1 + Math.floor(random() * 2), r: rewards[1] }
          ]
        },
        {
          head: 8 + jitter(3),
          branches: [
            { head: 3 + jitter(2), turns: 1 + Math.floor(random() * 3), r: rewards[2] },
            { head: 12 + jitter(1.6), turns: 1 + Math.floor(random() * 2), r: rewards[3] }
          ]
        }
      ]
    };
  }

  const IDLE_TREE = {
    jitterSeed: 42,
    stems: [
      { head: -9, branches: [{ head: -12, turns: 2, r: 1 }, { head: -3.5, turns: 1, r: 0 }] },
      { head: 8, branches: [{ head: 3, turns: 2, r: 0 }, { head: 12, turns: 1, r: 0 }] }
    ]
  };

  function generateIteration(k) {
    const random = mulberry32(97 + k * 7919);
    const probability = success(k);
    const episodes = k === 0
      ? [{ turns: 3, r: 0 }, { turns: 4, r: 1 }, { turns: 2, r: 1 }]
      : [0, 1, 2].map(() => ({ turns: 2 + Math.floor(random() * 3), r: random() < probability ? 1 : 0 }));
    const candidates = [];
    for (let i = 0; i < 4; i++) {
      candidates.push({ q: clamp(probability + (random() - .5) * .6, .05, .96) });
    }
    const values = candidates.map((candidate) => candidate.q);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const deviation = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length) || 1;
    candidates.forEach((candidate) => {
      candidate.A = (candidate.q - mean) / deviation;
      const positive = Math.round(candidate.q * 4);
      candidate.tree = makeTree(random, shuffle([0, 1, 2, 3].map((j) => j < positive ? 1 : 0), random));
    });
    return { k, p: probability, pNext: success(k + 1), episodes, candidates, loss0: .24 * Math.pow(.82, k) };
  }

  const defs = el('defs', {}, svg);
  [['ah', 'ahead'], ['ahA', 'aheadA']].forEach(([id, className]) => {
    const marker = el('marker', {
      id, viewBox: '0 0 10 10', refX: '7.5', refY: '5',
      markerWidth: '11', markerHeight: '11', orient: 'auto', markerUnits: 'userSpaceOnUse'
    }, defs);
    el('path', { d: 'M0,1 L10,5 L0,9 z', class: className }, marker);
  });
  const filter = el('filter', { id: 'glow', x: '-100%', y: '-100%', width: '300%', height: '300%' }, defs);
  el('feGaussianBlur', { stdDeviation: '2.6', result: 'b' }, filter);
  const merge = el('feMerge', {}, filter);
  el('feMergeNode', { in: 'b' }, merge);
  el('feMergeNode', { in: 'SourceGraphic' }, merge);
  const gradient = el('linearGradient', { id: 'coneG', x1: '545', y1: '0', x2: '1072', y2: '0', gradientUnits: 'userSpaceOnUse' }, defs);
  [[0, 'var(--or-node)', .92], [.16, 'var(--or-stroke)', .62], [.55, 'var(--or-fill)', .42], [1, 'var(--or-fill)', 0]]
    .forEach(([offset, color, opacity]) => {
      el('stop', { offset, style: 'stop-color:' + color + ';stop-opacity:' + opacity }, gradient);
    });

  const layers = {};
  ['panels', 'cone', 'paths', 'ghosts', 'boxes', 'text', 'episodes', 'rows', 'packets']
    .forEach((name) => { layers[name] = el('g', {}, svg); });

  el('rect', { x: 32, y: 30, width: 999, height: 230, rx: 20, class: 'panel' }, layers.panels);
  el('rect', { x: 36, y: 272, width: 544, height: 238, rx: 20, class: 'panel' }, layers.panels);
  const cone = el('path', {
    d: 'M545,400 C635,322 800,294 1072,288 L1072,510 C800,506 635,478 545,400 Z',
    fill: 'url(#coneG)'
  }, layers.cone);

  rich(layers.text, 48, 64, [
    ['Learn multi-turn ', 'b'], ['Q', 'bm'], ['π', 'sup'], [':', 'b'],
    [' Collect trajectories from ', 'n'], ['π', 'm'],
    [' and regress on Monte Carlo returns to fit ', 'n'], ['Q', 'm'], ['π', 'sup'], ['.', 'n']
  ], { size: 17 });
  [['Turn 1', 505], ['Turn 2', 649.5], ['Turn 3', 794], ['Turn 4', 938.5]]
    .forEach(([label, x]) => {
      const text = el('text', { x, y: 229, 'text-anchor': 'middle', 'font-size': 14 }, layers.text);
      text.textContent = label;
    });
  rich(layers.text, 505, 245, [['(', 'n'], ['■', 'tok'], [' = token)', 'n']], { size: 13, anchor: 'middle' });
  const badge = el('text', { x: 1018, y: 251, 'text-anchor': 'end', 'font-size': 11, class: 'muted' }, layers.text);

  rich(layers.text, 46, 305, [
    ['Iterative GRPO:', 'b'], [' Run token-level GRPO with ', 'n'],
    ['Q', 'm'], ['π', 'sup'], [' as the reward.', 'n']
  ], { size: 15.5 });
  const groupLabel = el('text', { x: 370, y: 337, 'text-anchor': 'middle', 'font-size': 12.5 }, layers.text);
  groupLabel.textContent = 'Group of candidate responses';
  const grpoLabel = el('text', { x: 366, y: 433, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 700 }, layers.text);
  grpoLabel.textContent = 'GRPO';
  const formula = rich(layers.text, 366, 451, [
    ['Â', 'm'], ['i', 'sub'], [' = (', 'n'], ['Q', 'm'], ['i', 'sub'], [' − mean) / std', 'n']
  ], { size: 11, cls: 'muted', anchor: 'middle' });
  const estimatedLabel = el('text', { x: 372, y: 490, 'text-anchor': 'middle', 'font-size': 12.5 }, layers.text);
  estimatedLabel.textContent = 'Forecast expected downstream return';

  rich(layers.text, 600, 284, [
    ['Future turns are implicitly “compressed” into ', 'n'], ['Q', 'm'], ['π', 'sup'], [' model', 'n']
  ], { size: 15.5 });
  const simulatedLabel = el('text', { x: 600, y: 305, 'font-size': 15.5 }, layers.text);
  simulatedLabel.textContent = '(not explicitly generated)';

  const repeatHighlight = el('rect', { x: 1086, y: 296, width: 74, height: 54, rx: 10, class: 'rephi', opacity: 0 }, layers.text);
  const repeatLabel = el('text', { x: 1094, y: 318, 'font-size': 15 }, layers.text);
  repeatLabel.textContent = 'Repeat';
  rich(layers.text, 1094, 341, [['π', 'm'], [' ← ', 'n'], ['π′', 'm']], { size: 18, cls: 'bl-ink' });

  const paths = {};
  function makePath(key, d) {
    const path = el('path', { d, class: 'arrow', 'marker-end': 'url(#ah)' }, layers.paths);
    paths[key] = { el: path, len: path.getTotalLength(), on: false };
  }
  makePath('episode0', 'M357,99 L295,131');
  makePath('episode1', 'M357,145 L292,145');
  makePath('episode2', 'M357,191 L295,160');
  const ROW_Y = [346, 363, 380, 397];
  const ROW_X = 302;
  const ROW_WIDTH = 21;
  const ROW_HEIGHT = 14;
  ROW_Y.forEach((y, i) => {
    const centerY = y + ROW_HEIGHT / 2;
    makePath('fan' + i, 'M259,386 L297,' + centerY);
    makePath('toQ' + i, 'M443,' + centerY + ' L472,' + centerY);
  });
  makePath('return', 'M470,447 Q365,492 262,447');
  makePath('improve', 'M109,458 V541 H657');
  makePath('repeat', 'M896,541 H1083 V145 H1038');

  let clock = 0;
  function setActive(key, active) {
    const path = paths[key];
    if (path.on !== active) {
      path.on = active;
      path.el.classList.toggle('active', active);
      path.el.setAttribute('marker-end', active ? 'url(#ahA)' : 'url(#ah)');
    }
    if (active) path.el.style.strokeDashoffset = (-clock * 16).toFixed(1);
  }

  function makeNetwork(parent, x, y, className) {
    const counts = [3, 4, 4, 2];
    const gapX = 24;
    const gapY = 17.5;
    const radius = 7;
    const height = 3 * gapY;
    const positions = counts.map((count, layer) =>
      Array.from({ length: count }, (_, index) => [
        x + layer * gapX,
        y + (height - (count - 1) * gapY) / 2 + index * gapY
      ])
    );
    const edges = el('g', { class: className + '-edge' }, parent);
    for (let layer = 0; layer < 3; layer++) {
      for (const a of positions[layer]) {
        for (const b of positions[layer + 1]) {
          el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, edges);
        }
      }
    }
    const nodes = [];
    positions.forEach((column, layer) => column.forEach(([cx, cy]) => {
      const ring = el('circle', { cx, cy, r: radius + 2, class: className + '-ring', opacity: 0 }, parent);
      const node = el('circle', { cx, cy, r: radius, class: className + '-node' }, parent);
      nodes.push({ node, ring, layer, radius });
    }));
    return { nodes, last: -1 };
  }

  function activateNetwork(network, level) {
    if (level === 0 && network.last === 0) return;
    network.last = level;
    for (const item of network.nodes) {
      const wave = level * (.5 + .5 * Math.sin(clock * 8.5 - item.layer * 1.25));
      item.node.setAttribute('r', (item.radius * (1 + .22 * wave)).toFixed(2));
      item.ring.setAttribute('r', (item.radius + 2 + 5 * wave).toFixed(2));
      item.ring.setAttribute('opacity', (.55 * wave).toFixed(3));
    }
  }

  const qModelGroup = el('g', {}, layers.boxes);
  el('rect', { x: 50, y: 98, width: 234, height: 91, rx: 12, class: 'orbox' }, qModelGroup);
  const qModelGlow = el('rect', { x: 50, y: 98, width: 234, height: 91, rx: 12, class: 'glow-or', opacity: 0 }, qModelGroup);
  rich(qModelGroup, 62, 152, [['Q', 'm'], ['π', 'sup'], ['-model', 'n']], { size: 23, cls: 'or-ink' });
  const qModelLoss = el('text', { x: 62, y: 177, 'font-size': 10.5, class: 'or-ink', opacity: 0 }, qModelGroup);
  const qModelNetwork = makeNetwork(qModelGroup, 172, 109, 'or');

  const qGroup = el('g', {}, layers.boxes);
  el('rect', { x: 475, y: 340, width: 68, height: 122, rx: 10, class: 'orbox' }, qGroup);
  const qGlow = el('rect', { x: 475, y: 340, width: 68, height: 122, rx: 10, class: 'glow-or', opacity: 0 }, qGroup);
  rich(qGroup, 509, 409, [['Q', 'm'], ['π', 'sup']], { size: 25, cls: 'or-ink', anchor: 'middle' });
  const apex = el('circle', { cx: 546, cy: 400, r: 9, class: 'pk-or', filter: 'url(#glow)', opacity: 0 }, layers.boxes);

  const llmGroup = el('g', {}, layers.boxes);
  el('rect', { x: 50, y: 365, width: 204, height: 90, rx: 12, class: 'blbox' }, llmGroup);
  const llmGlow = el('rect', { x: 50, y: 365, width: 204, height: 90, rx: 12, class: 'glow-bl', opacity: 0 }, llmGroup);
  const llmLabel = el('text', { x: 78, y: 418, 'font-size': 22, class: 'bl-ink' }, llmGroup);
  llmLabel.textContent = 'LLM';
  const llmPolicy = el('text', { x: 80, y: 440, 'font-size': 14, class: 'bl-ink math' }, llmGroup);
  const llmNetwork = makeNetwork(llmGroup, 150, 377, 'bl');

  const improvedGroup = el('g', {}, layers.boxes);
  el('rect', { x: 665, y: 492, width: 229, height: 90, rx: 12, class: 'blbox2' }, improvedGroup);
  const improvedGlow = el('rect', { x: 665, y: 492, width: 229, height: 90, rx: 12, class: 'glow-bl', opacity: 0 }, improvedGroup);
  rich(improvedGroup, 700, 534, [['LLM ', 'n'], ['π′', 'm']], { size: 21, cls: 'bl-ink' });
  const improvedSubtitle = el('text', { x: 697, y: 560, 'font-size': 16, class: 'bl-ink' }, improvedGroup);
  improvedSubtitle.textContent = '(improved)';
  const improvedNetwork = makeNetwork(improvedGroup, 804, 503, 'bl');

  function makeToken(parent, x, y, width, height, tintClass) {
    const group = el('g', { opacity: 0 }, parent);
    el('rect', { x, y, width, height, rx: 1.5, class: 'tok' }, group);
    const tint = el('rect', { x, y, width, height, rx: 1.5, class: tintClass, opacity: 0 }, group);
    return { group, tint, cx: x + width / 2, cy: y + height / 2, scale: -1 };
  }

  function popToken(token, scale) {
    if (token.scale === scale) return;
    token.scale = scale;
    if (scale <= 0) {
      token.group.setAttribute('opacity', 0);
      return;
    }
    token.group.setAttribute('opacity', Math.min(1, scale * 3).toFixed(3));
    setTf(token.group, scale >= 1 ? '' : scaleAbout(token.cx, token.cy, .5 + .5 * easeOutBack(scale)));
  }

  const EPISODE_X = 433;
  const TURN_WIDTH = 144.5;
  const EPISODE_Y = [75, 125, 172.5];
  const BAR_HEIGHT = 41;
  const TOKEN_SIZE = 29.5;
  const TURN_DELAY = .95;
  let episodeElements = [];

  function buildEpisodes(data) {
    layers.episodes.textContent = '';
    episodeElements = [];
    data.episodes.forEach((episode, i) => {
      const y = EPISODE_Y[i];
      const group = el('g', { opacity: 0 }, layers.episodes);
      const label = el('text', { x: 424, y: y + 25.5, 'text-anchor': 'end', 'font-size': 14.5 }, group);
      label.textContent = 'Episode ' + (i + 1);
      const width = episode.turns * TURN_WIDTH;
      const bar = el('rect', { x: EPISODE_X, y, width: 0, height: BAR_HEIGHT, rx: 5, class: 'track' }, group);
      const start = .25 + i * .35;
      const sweep = 5.1 + i * .3;
      const tintClass = episode.r ? 'tint1' : 'tint0';
      const tokens = [];
      const marks = [];
      let chip = null;
      for (let turn = 0; turn < episode.turns; turn++) {
        const x0 = EPISODE_X + turn * TURN_WIDTH;
        const turnStart = start + .25 + turn * TURN_DELAY;
        const last = turn === episode.turns - 1;
        const tokenY = y + (BAR_HEIGHT - TOKEN_SIZE) / 2;
        const addToken = (offset, delay) => {
          const token = makeToken(group, x0 + offset, tokenY, TOKEN_SIZE, TOKEN_SIZE, tintClass);
          token.time = turnStart + delay;
          token.fraction = (x0 + offset + TOKEN_SIZE / 2 - EPISODE_X) / width;
          tokens.push(token);
          return token;
        };
        addToken(6, 0);
        addToken(40, .18);
        const dots = el('text', { x: x0 + 84, y: y + 26, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 700, opacity: 0 }, group);
        dots.textContent = '···';
        marks.push({ el: dots, time: turnStart + .34 });
        if (!last) {
          addToken(99, .5);
        } else {
          const token = addToken(99, .55);
          const reward = el('text', { x: token.cx, y: token.cy + 5.5, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 600, class: 'chiptext' }, token.group);
          reward.textContent = episode.r ? '+1' : '+0';
          token.ring = el('rect', { x: token.cx - TOKEN_SIZE / 2 - 3, y: token.cy - TOKEN_SIZE / 2 - 3, width: TOKEN_SIZE + 6, height: TOKEN_SIZE + 6, rx: 4, class: 'ring1', opacity: 0 }, group);
          chip = token;
        }
        const divider = el('line', { x1: x0 + 140, y1: y + 4, x2: x0 + 140, y2: y + 37, class: 'div', opacity: 0 }, group);
        marks.push({ el: divider, time: turnStart + .72 });
      }
      episodeElements.push({ group, bar, width, start, sweep, tokens, marks, chip, reward: episode.r, index: i });
    });
  }

  const slots = ROW_Y.map((y) => el('rect', { x: ROW_X - 4, y: y - 2.5, width: 96, height: ROW_HEIGHT + 5, rx: 4, class: 'slot' }, layers.rows));
  const rowContent = el('g', {}, layers.rows);
  let rowElements = [];

  function buildRows(data) {
    rowContent.textContent = '';
    rowElements = [];
    data.candidates.forEach((candidate, i) => {
      const y = ROW_Y[i];
      const centerY = y + ROW_HEIGHT / 2;
      const group = el('g', {}, rowContent);
      const tintClass = candidate.A >= 0 ? 'tpos' : 'tneg';
      const start = 8.65 + i * .3;
      const tokens = [[0, 0], [25, .12], [68, .36]].map(([offset, delay]) => {
        const token = makeToken(group, ROW_X + offset, y, ROW_WIDTH, ROW_HEIGHT, tintClass);
        token.time = start + delay;
        return token;
      });
      const dots = el('text', { x: ROW_X + 57, y: centerY + 4, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, opacity: 0 }, group);
      dots.textContent = '···';
      const chipGroup = el('g', { opacity: 0 }, group);
      el('rect', { x: 397, y: y - .5, width: 42, height: ROW_HEIGHT + 1, rx: 3.5, class: 'qchip' }, chipGroup);
      const advantage = el('rect', { x: 397, y: y - .5, width: 42, height: ROW_HEIGHT + 1, rx: 3.5, class: candidate.A >= 0 ? 'apos' : 'aneg', opacity: 0 }, chipGroup);
      const chipText = el('text', { x: 418, y: centerY + 3.6, 'text-anchor': 'middle', 'font-size': 10, class: 'qtext' }, chipGroup);
      rowElements.push({
        tokens,
        dots: { el: dots, time: start + .24 },
        chip: { group: chipGroup, advantage, text: chipText, time: 10.3 + i + .86, cx: 418, cy: centerY },
        candidate,
        index: i
      });
    });
  }

  const APEX = [545, 400];
  function buildGhostSet(tree, parent) {
    const group = el('g', {}, parent);
    const items = [];
    const random = mulberry32(tree.jitterSeed);
    const turnLength = 90;

    function addSegment(startX, startY, headingDegrees, turns, leafReward, initialDistance) {
      const heading = headingDegrees * Math.PI / 180;
      const unitX = Math.cos(heading);
      const unitY = Math.sin(heading);
      for (let turn = 0; turn < turns; turn++) {
        const last = leafReward != null && turn === turns - 1;
        const place = (offset, kind) => {
          const distance = turn * turnLength + offset;
          const item = {
            x: startX + unitX * distance,
            y: startY + unitY * distance,
            distance: initialDistance + distance,
            rotation: headingDegrees + (kind === 'divider' ? 0 : (random() - .5) * 14),
            kind
          };
          const wrapper = el('g', {}, group);
          item.el = wrapper;
          if (kind === 'token') {
            el('rect', { x: -9, y: -9, width: 18, height: 18, rx: 1.5, class: 'ghost' }, wrapper);
          } else if (kind === 'chip') {
            el('rect', { x: -9, y: -9, width: 18, height: 18, rx: 1.5, class: leafReward ? 'ghostc1' : 'ghostc0' }, wrapper);
            const text = el('text', { x: 0, y: 3, 'text-anchor': 'middle', 'font-size': 8.5, class: leafReward ? 'gtext1' : 'gtext0' }, wrapper);
            text.textContent = leafReward ? '+1' : '+0';
          } else if (kind === 'dots') {
            const text = el('text', { x: 0, y: 3.5, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700 }, wrapper);
            text.textContent = '···';
          } else {
            el('line', { x1: 0, y1: -12, x2: 0, y2: 12, class: 'gdiv' }, wrapper);
          }
          items.push(item);
        };
        place(9, 'token');
        place(31, 'token');
        place(52, 'dots');
        place(66, last ? 'chip' : 'token');
        place(80, 'divider');
      }
      return [
        startX + unitX * turns * turnLength,
        startY + unitY * turns * turnLength,
        initialDistance + turns * turnLength
      ];
    }

    for (const stem of tree.stems) {
      const heading = stem.head * Math.PI / 180;
      const [endX, endY, endDistance] = addSegment(
        APEX[0] + Math.cos(heading) * 40,
        APEX[1] + Math.sin(heading) * 40,
        stem.head, 1, null, 40
      );
      stem.branches.forEach((branch, index) => {
        const offset = index === 0 ? -11 : 11;
        const perpendicularX = -Math.sin(heading);
        const perpendicularY = Math.cos(heading);
        addSegment(
          endX + Math.cos(heading) * 6 + perpendicularX * offset,
          endY + Math.sin(heading) * 6 + perpendicularY * offset,
          branch.head, branch.turns, branch.r, endDistance + 6
        );
      });
    }
    return { group, items, hidden: false };
  }

  function hideSet(set) {
    if (!set.hidden) {
      set.hidden = true;
      set.group.style.display = 'none';
    }
  }

  function renderGhosts(set, appear, collapse, alpha, shimmer) {
    if (alpha <= .003) {
      hideSet(set);
      return;
    }
    if (set.hidden) {
      set.hidden = false;
      set.group.style.display = '';
    }
    for (const item of set.items) {
      const start = item.distance / 520 * .75;
      const arrival = ease(seg(appear, start, start + .25));
      const x = APEX[0] + (item.x - APEX[0]) * (1 - collapse);
      const y = APEX[1] + (item.y - APEX[1]) * (1 - collapse);
      const scale = (.55 + .45 * arrival) * (1 - .7 * collapse);
      const fade = clamp(1.08 - item.distance / 500, .1, 1);
      let opacity = alpha * fade * arrival * (1 - collapse);
      if (shimmer) opacity *= .8 + .2 * Math.sin(clock * 1.6 + item.distance * .035);
      item.el.setAttribute('transform',
        'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') rotate(' +
        item.rotation.toFixed(1) + ') scale(' + scale.toFixed(3) + ')'
      );
      item.el.setAttribute('opacity', opacity.toFixed(3));
    }
  }

  const idleSet = buildGhostSet(IDLE_TREE, layers.ghosts);
  const candidateLayer = el('g', {}, layers.ghosts);
  let candidateSets = [];
  function buildCandidateGhosts(data) {
    candidateLayer.textContent = '';
    candidateSets = data.candidates.map((candidate) => {
      const set = buildGhostSet(candidate.tree, candidateLayer);
      hideSet(set);
      return set;
    });
  }

  const packetPool = [];
  for (let i = 0; i < 18; i++) {
    packetPool.push(el('circle', { r: 4.5, filter: 'url(#glow)', opacity: 0 }, layers.packets));
  }
  let packetsUsed = 0;

  function packet(key, progress, className, radius = 4.5) {
    if (progress <= 0 || progress >= 1) return;
    const circle = packetPool[packetsUsed++];
    if (!circle) return;
    const path = paths[key];
    const point = path.el.getPointAtLength(progress * path.len);
    circle.setAttribute('cx', point.x.toFixed(1));
    circle.setAttribute('cy', point.y.toFixed(1));
    circle.setAttribute('r', radius);
    circle.setAttribute('class', className);
    setOp(circle, Math.min(1, progress * 6, (1 - progress) * 6));
  }

  const state = { iteration: 0, time: 0, playing: true, speed: 1, dragging: false };
  let data;

  function setIteration(iteration) {
    state.iteration = iteration;
    data = generateIteration(iteration);
    buildEpisodes(data);
    buildRows(data);
    buildCandidateGhosts(data);
    setText(badge, 'Iteration ' + (iteration + 1) + ': rollouts from π' + sub(iteration));
  }

  function render(time) {
    packetsUsed = 0;
    const iteration = state.iteration;
    const episodeVisibility = 1 - ease(seg(time, 19.9, 20.7));
    const episodeDim = lerp(1, .5, ease(seg(time, 9, 9.8)));
    const tintFade = 1 - ease(seg(time, 8.7, 9.5));

    for (const episode of episodeElements) {
      const alpha = ease(seg(time, episode.start, episode.start + .3)) * episodeVisibility * episodeDim;
      setOp(episode.group, alpha);
      if (alpha <= 0) continue;
      let edge = 8;
      for (const token of episode.tokens) {
        popToken(token, seg(time, token.time, token.time + .22));
        if (token.scale > 0) edge = Math.max(edge, token.cx + TOKEN_SIZE / 2 + 5 - EPISODE_X);
        const start = episode.sweep + (1 - token.fraction) * .9;
        setOp(token.tint, ease(seg(time, start, start + .2)) * tintFade * .9);
      }
      for (const mark of episode.marks) setOp(mark.el, seg(time, mark.time, mark.time + .2));
      const lastMark = episode.marks[episode.marks.length - 1];
      const barWidth = (time >= lastMark.time ? episode.width : Math.min(episode.width, edge)).toFixed(1);
      if (episode.bar._width !== barWidth) {
        episode.bar._width = barWidth;
        episode.bar.setAttribute('width', barWidth);
      }
      const chip = episode.chip;
      if (chip && episode.reward) {
        const progress = seg(time, chip.time, chip.time + .7);
        const live = progress > 0 && progress < 1;
        setOp(chip.ring, live ? (1 - progress) * .9 : 0);
        if (live) setTf(chip.ring, scaleAbout(chip.cx, chip.cy, 1 + .6 * progress));
      }
      for (let packetIndex = 0; packetIndex < 3; packetIndex++) {
        const start = episode.sweep + 1.05 + packetIndex * .22;
        packet('episode' + episode.index, seg(time, start, start + .6), episode.reward ? 'pk-or' : 'pk-zero');
      }
    }

    const regressionActive = time >= 5.9 && time < 8.4;
    for (let i = 0; i < 3; i++) setActive('episode' + i, regressionActive);
    const qModelLevel = bump(time, 5.9, 8.7, .3);
    activateNetwork(qModelNetwork, qModelLevel);
    setOp(qModelGlow, qModelLevel * .85);
    const lossOpacity = bump(time, 5.7, 8.9, .3);
    setOp(qModelLoss, lossOpacity);
    if (lossOpacity > 0) {
      setText(qModelLoss, 'MSE ' + (data.loss0 * (.22 + .78 * Math.exp(-3.2 * seg(time, 6, 8.4)))).toFixed(3));
    }

    const rowVisibility = 1 - ease(seg(time, 19, 19.6));
    setOp(rowContent, rowVisibility);
    let qLevel = 0;
    let apexFlash = 0;
    for (const row of rowElements) {
      const candidate = row.candidate;
      const index = row.index;
      const start = 10.3 + index;
      const elapsed = time - start;
      const hot = elapsed > 0 && elapsed < 1;
      for (const token of row.tokens) popToken(token, seg(time, token.time, token.time + .2));
      setOp(row.dots.el, seg(time, row.dots.time, row.dots.time + .2));
      toggleCls(slots[index], 'hot', hot);
      const rowStart = 8.65 + index * .3;
      packet('fan' + index, seg(time, rowStart - .3, rowStart + .1), 'pk-bl');
      setActive('fan' + index, time >= 8.4 && time < 10.3);
      setActive('toQ' + index, hot);
      packet('toQ' + index, seg(time, start, start + .22), 'pk-or', 4);
      packet('toQ' + index, 1 - seg(time, start + .78, start + .95), 'pk-or', 4);
      qLevel = Math.max(qLevel, bump(time, start + .08, start + .95, .15));
      apexFlash = Math.max(apexFlash, bump(time, start + .7, start + .92, .08));
      const chipScale = seg(time, row.chip.time, row.chip.time + .3);
      setOp(row.chip.group, chipScale > 0 ? Math.min(1, chipScale * 3) : 0);
      setTf(row.chip.group, chipScale > 0 && chipScale < 1
        ? scaleAbout(row.chip.cx, row.chip.cy, .5 + .5 * easeOutBack(chipScale))
        : '');
      const normalized = ease(seg(time, 14.8 + index * .15, 15.3 + index * .15));
      setOp(row.chip.advantage, normalized);
      const isAdvantage = normalized > .5;
      const advantageText = Math.abs(candidate.A) < .005
        ? '0.00'
        : (candidate.A >= 0 ? '+' : '−') + Math.abs(candidate.A).toFixed(2);
      setText(row.chip.text, isAdvantage ? 'A ' + advantageText : 'Q ' + candidate.q.toFixed(2));
      toggleCls(row.chip.text, 'atext', isAdvantage);
      for (const token of row.tokens) {
        setOp(token.tint, normalized * (.35 + .55 * Math.min(1, Math.abs(candidate.A) / 1.4)));
      }
    }
    setOp(qGlow, qLevel * .9);
    setOp(apex, apexFlash);

    const detailedActive = seg(time, 10.1, 10.35) * (1 - seg(time, 14.25, 14.7));
    renderGhosts(idleSet, 1, 0, .9 * (1 - detailedActive), true);
    candidateSets.forEach((set, index) => {
      const elapsed = time - (10.3 + index);
      if (elapsed <= 0 || elapsed >= 1) {
        hideSet(set);
        return;
      }
      renderGhosts(set, seg(elapsed, .1, .55), ease(seg(elapsed, .58, .84)), 1, false);
    });
    setOp(cone, .72 + .28 * detailedActive);

    setOp(formula, bump(time, 14.3, 19.2, .35));
    setActive('return', time >= 15.3 && time < 17.1);
    for (let i = 0; i < 3; i++) {
      const start = 15.4 + i * .28;
      packet('return', seg(time, start, start + .95), 'pk-or', 5);
    }
    const llmLevel = Math.max(
      bump(time, 8.45, 10.3, .25),
      bump(time, 16, 17.5, .3),
      bump(time, 20.3, 21, .2)
    );
    activateNetwork(llmNetwork, llmLevel);
    setOp(llmGlow, Math.max(bump(time, 16.2, 17.5, .3), bump(time, 20.3, 21, .2)) * .9);
    setText(llmPolicy, 'π' + sub(time >= 20.5 ? iteration + 1 : iteration));

    setActive('improve', time >= 17 && time < 18.3);
    packet('improve', seg(time, 17.05, 18), 'pk-bl', 5.5);
    const arrive = ease(seg(time, 17.9, 18.3));
    const leave = ease(seg(time, 20.3, 20.9));
    const visible = arrive * (1 - leave);
    setOp(improvedGroup, lerp(.4, 1, visible));
    setOp(improvedSubtitle, visible);
    const pulse = seg(time, 17.9, 18.45);
    setTf(improvedGroup, pulse > 0 && pulse < 1
      ? scaleAbout(779.5, 537, 1 + .06 * Math.sin(Math.PI * pulse))
      : '');
    activateNetwork(improvedNetwork, bump(time, 17.95, 19.3, .25));
    setOp(improvedGlow, bump(time, 17.9, 19.2, .25) * .9);

    setActive('repeat', time >= 19 && time < 20.4);
    packet('repeat', seg(time, 19.05, 20.25), 'pk-bl', 5.5);
    setOp(repeatHighlight, bump(time, 19, 20.9, .3));
    for (let i = packetsUsed; i < packetPool.length; i++) setOp(packetPool[i], 0);
  }

  const phaseTitle = document.getElementById('phTitle');
  const phaseText = document.getElementById('phText');
  const phasesElement = document.getElementById('phases');
  const chips = PHASES.map((phase, index) => {
    const button = document.createElement('button');
    button.className = 'chip';
    button.type = 'button';
    button.innerHTML = '<span>' + (index + 1) + '. ' + phase.name + '</span>';
    button.addEventListener('click', () => jumpPhase(state.iteration, index));
    phasesElement.appendChild(button);
    return button;
  });
  const scrub = document.getElementById('scrub');
  const iterationElement = document.getElementById('iter');
  const successElement = document.getElementById('succ');
  const spark = document.getElementById('spark');
  const playButton = document.getElementById('play');
  const playIcon = document.getElementById('playIcon');
  const percent = (value) => Math.round(value * 100) + '%';
  let lastPhase = -1;
  let sparkKey = '';

  function drawSpark(iteration, arrive) {
    const key = iteration + '|' + arrive.toFixed(2);
    if (key === sparkKey) return;
    sparkKey = key;
    let markup = '';
    let x = 2;
    for (let j = Math.max(0, iteration - 7); j <= iteration + 1; j++) {
      let height = 4 + success(j) / .9 * 20;
      let className = 'sb';
      if (j === iteration + 1) {
        if (arrive <= 0) break;
        height *= arrive;
        className = 'sb new';
      } else if (j === iteration) {
        className = 'sb cur';
      }
      markup += '<rect x="' + x + '" y="' + (24 - height).toFixed(1) +
        '" width="11" height="' + height.toFixed(1) + '" rx="2" class="' + className + '"/>';
      x += 15;
    }
    spark.innerHTML = markup;
  }

  function updateUI(time) {
    const currentPhase = phaseIndex(time);
    if (currentPhase !== lastPhase) {
      lastPhase = currentPhase;
      phaseTitle.innerHTML = PHASES[currentPhase].title;
      phaseText.innerHTML = PHASES[currentPhase].text;
      chips.forEach((chip, index) => {
        chip.classList.toggle('on', index === currentPhase);
        chip.classList.toggle('done', index < currentPhase);
        chip.setAttribute('aria-current', index === currentPhase ? 'step' : 'false');
      });
    }
    chips.forEach((chip, index) => {
      const progress = index < currentPhase
        ? 1
        : index > currentPhase
          ? 0
          : (time - PHASES[index].t0) / (PHASES[index].t1 - PHASES[index].t0);
      chip.style.setProperty('--p', progress.toFixed(3));
    });
    if (!state.dragging) scrub.value = time.toFixed(2);
    setText(iterationElement, String(state.iteration + 1));
    const arrive = ease(seg(time, 17.9, 18.3));
    setText(successElement, arrive > .5
      ? percent(data.p) + ' to ' + percent(data.pNext)
      : percent(data.p));
    drawSpark(state.iteration, arrive);
  }

  function setPlaying(playing) {
    state.playing = playing;
    playButton.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    playIcon.innerHTML = playing
      ? '<path d="M4 3h3v10H4zM9 3h3v10H9z"/>'
      : '<path d="M4 2.5v11l9.5-5.5z"/>';
  }

  function jump(iteration, time) {
    if (iteration !== state.iteration) setIteration(iteration);
    state.time = time;
  }

  function jumpPhase(iteration, index) {
    jump(iteration, state.playing ? PHASES[index].t0 + .001 : PHASES[index].show);
  }

  function nextPhase() {
    const index = phaseIndex(state.time);
    if (index < PHASES.length - 1) jumpPhase(state.iteration, index + 1);
    else jumpPhase(state.iteration + 1, 0);
  }

  function previousPhase() {
    const index = phaseIndex(state.time);
    if (state.playing && state.time - PHASES[index].t0 > .7) jumpPhase(state.iteration, index);
    else if (index > 0) jumpPhase(state.iteration, index - 1);
    else if (state.iteration > 0) jumpPhase(state.iteration - 1, PHASES.length - 1);
    else jumpPhase(0, 0);
  }

  playButton.addEventListener('click', () => setPlaying(!state.playing));
  document.getElementById('next').addEventListener('click', nextPhase);
  document.getElementById('prev').addEventListener('click', previousPhase);
  document.getElementById('restart').addEventListener('click', () => {
    jump(0, 0);
    sparkKey = '';
  });
  document.querySelectorAll('[data-speed]').forEach((button) => {
    button.addEventListener('click', () => {
      state.speed = +button.dataset.speed;
      document.querySelectorAll('[data-speed]').forEach((candidate) => {
        candidate.setAttribute('aria-pressed', candidate === button ? 'true' : 'false');
      });
    });
  });
  scrub.addEventListener('pointerdown', () => { state.dragging = true; });
  window.addEventListener('pointerup', () => { state.dragging = false; });
  scrub.addEventListener('input', () => { state.time = +scrub.value; });
  document.addEventListener('keydown', (event) => {
    const tag = (event.target.tagName || '').toLowerCase();
    if (event.code === 'Space' && tag !== 'button' && tag !== 'input') {
      event.preventDefault();
      setPlaying(!state.playing);
    } else if (event.key === 'ArrowRight' && tag !== 'input') {
      nextPhase();
    } else if (event.key === 'ArrowLeft' && tag !== 'input') {
      previousPhase();
    }
  });

  function reportHeight() {
    window.parent.postMessage({
      type: 'igrpo-visual-height',
      height: document.documentElement.scrollHeight
    }, window.location.origin);
  }
  if ('ResizeObserver' in window) new ResizeObserver(reportHeight).observe(document.body);
  window.addEventListener('load', reportHeight);

  setIteration(0);
  const reducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    setPlaying(false);
    state.time = PHASES[5].show;
  }
  let lastTimestamp = null;
  function frame(now) {
    if (lastTimestamp == null) lastTimestamp = now;
    const delta = Math.min(.1, (now - lastTimestamp) / 1000);
    lastTimestamp = now;
    if (state.playing && !state.dragging) {
      const elapsed = delta * state.speed;
      clock += elapsed;
      state.time += elapsed;
      if (state.time >= CYCLE) {
        state.time -= CYCLE;
        setIteration(state.iteration + 1);
      }
    }
    render(state.time);
    updateUI(state.time);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
