// The phone side: a touch controller for the game on the TV. Opened from the TV's QR code
// (`?pad=CODE`) or on any touch-screen visit to the site. The TV says what to show (lobby, menu
// remote, character and stage select, the fight pad, or "wait your turn"); the phone sends back
// its buttons as the same input bits the keyboard makes, plus menu presses and picks.
// No Phaser here: plain DOM, so the page is small and quick to load.
import { cleanPadCode, connectPad } from '../net/padlink';
import type { PadConn } from '../net/padlink';
import { PAD_VERSION } from '../net/padproto';
import type { PadHello, PhoneView } from '../net/padproto';
import { heroInfo } from '../render/heroInfo';
import { Input } from '../sim/input';
import { PHONE_CSS } from './style';

const PORTRAITS = import.meta.glob('../../assets/heroes/*/sheet_portrait.png', { eager: true, import: 'default' }) as Record<string, string>;
const STAGE_ART = import.meta.glob('../../assets/stages/*.png', { eager: true, import: 'default' }) as Record<string, string>;
const portrait = (id: string): string => PORTRAITS[`../../assets/heroes/${id}/sheet_portrait.png`] ?? '';
const stageArt = (id: string): string => STAGE_ART[`../../assets/stages/${id}.png`] ?? '';
const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
const SEAT_COLORS = ['#3d8bff', '#ff6a3d'];

const { Left, Right, Up, Down, Light, Heavy, Special, Block } = Input;

// ---------- small helpers ----------

type Kids = Array<Node | string | null | undefined | false>;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: Kids): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = String(v);
    else if (k === 'style') e.setAttribute('style', String(v));
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v as EventListener);
    else e.setAttribute(k, String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}

function store(key: string, value?: string): string {
  try {
    if (value !== undefined) localStorage.setItem(key, value);
    return localStorage.getItem(key) ?? '';
  } catch {
    return value ?? '';
  }
}

function myId(): string {
  // `&pid=` gives tabs of one browser different ids, for testing several phones at once.
  const forced = new URLSearchParams(location.search).get('pid');
  if (forced) return forced.slice(0, 40);
  let id = store('afterhours.phoneId');
  if (!id) id = store('afterhours.phoneId', `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);
  return id;
}

/** A short shake under the thumb (Android; iPhones have no vibration for web pages). */
function buzz(ms: number): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Not supported.
  }
}

// ---------- the connection ----------

const id = myId();
let code = cleanPadCode(new URLSearchParams(location.search).get('pad') ?? '');
let name = store('afterhours.phoneName');
let conn: PadConn | null = null;
let hello: PadHello | null = null;
let view: PhoneView | null = null;
let status: 'join' | 'connecting' | 'live' | 'lost' | 'full' | 'old' = 'join';
let error = '';
let heardAt = 0;
let reconnectTimer = 0;

// Inputs: what is held now, and a count of presses so the TV never misses a quick tap.
let held = 0;
let presses = 0;
let recent: Array<[number, number]> = [];
let seq = 0;
let sentAt = 0;

function send(m: Record<string, unknown>): void {
  conn?.send(m);
}

function sendInput(): void {
  seq += 1;
  sentAt = performance.now();
  send({ t: 'in', q: seq, b: held, n: presses, p: recent });
}

function setHeld(bits: number): void {
  if (bits === held) return;
  const fresh = bits & ~held;
  held = bits;
  if (fresh) {
    presses += 1;
    recent = [...recent.slice(-5), [presses, fresh]];
  }
  sendInput();
}

function menu(a: string): void {
  send({ t: 'm', a });
  buzz(8);
}

function cmd(c: string, v?: unknown): void {
  send({ t: 'cmd', c, v });
  buzz(8);
}

async function join(): Promise<void> {
  if (code.length !== 4) {
    error = 'Type the 4-letter code shown on the TV.';
    render();
    return;
  }
  store('afterhours.phoneName', name);
  status = 'connecting';
  error = '';
  render();
  keepAwake();
  try {
    attach(await connectPad(code));
    try {
      const u = new URL(location.href);
      u.searchParams.set('pad', code);
      history.replaceState(null, '', u.toString());
    } catch {
      // Fine without it.
    }
  } catch (e) {
    status = 'join';
    error = (e as Error)?.message ?? 'Could not connect.';
    render();
  }
}

function attach(c: PadConn): void {
  conn = c;
  heardAt = performance.now();
  c.onData(onMessage);
  c.onClose(() => {
    if (conn !== c) return;
    conn = null;
    lost();
  });
  sayHi(c);
  status = 'live';
  render();
}

/** This page, this visit: lets the TV tell a reload from the same page on another route. */
const sid = Math.random().toString(36).slice(2, 10);

function sayHi(c: PadConn | null = conn): void {
  c?.send({ t: 'hi', v: PAD_VERSION, id, sid, name, n: presses });
}

function lost(): void {
  if (status === 'full' || status === 'old' || status === 'join') return;
  status = 'lost';
  held = 0;
  render();
  window.clearTimeout(reconnectTimer);
  reconnectTimer = window.setTimeout(retry, 1200);
}

async function retry(): Promise<void> {
  if (status !== 'lost') return;
  try {
    attach(await connectPad(code, 8000));
  } catch {
    reconnectTimer = window.setTimeout(retry, 2500);
  }
}

function onMessage(m: Record<string, unknown>): void {
  heardAt = performance.now();
  if (m.t === 'hello') {
    const h = m as unknown as PadHello;
    if (h.v !== PAD_VERSION) {
      status = 'old';
      conn?.close();
      render();
      return;
    }
    hello = h;
    name = h.name;
    document.documentElement.style.setProperty('--me', h.color);
    render();
  } else if (m.t === 'view') {
    view = m.v as PhoneView;
    render();
  } else if (m.t === 'buzz') {
    buzz(Number(m.ms) || 30);
  } else if (m.t === 'full') {
    status = 'full';
    render();
  } else if (m.t === 'who') {
    sayHi();
  }
}

// Keep-alive both ways: the TV lets go of a quiet phone's buttons, and a quiet TV means the link is gone.
window.setInterval(() => {
  if (status !== 'live' || !conn) return;
  const now = performance.now();
  const fast = view?.screen === 'fight';
  if (now - sentAt > (fast ? 100 : 900)) sendInput();
  if (now - heardAt > 6000) {
    conn.close();
    conn = null;
    lost();
  }
}, 50);

let wake: { release(): Promise<void> } | null = null;
function keepAwake(): void {
  const n = navigator as unknown as { wakeLock?: { request(t: string): Promise<{ release(): Promise<void> }> } };
  if (!n.wakeLock || wake) return;
  n.wakeLock.request('screen').then(
    (w) => {
      wake = w;
      (w as unknown as EventTarget).addEventListener?.('release', () => (wake = null));
    },
    () => undefined,
  );
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    setHeld(0);
    return;
  }
  keepAwake();
  // Back from a locked screen: the link may have died meanwhile.
  if (status === 'live' && performance.now() - heardAt > 3000) {
    conn?.close();
    conn = null;
    lost();
  } else if (status === 'lost') {
    window.clearTimeout(reconnectTimer);
    void retry();
  }
});

// ---------- screens ----------

const root = el('div', { id: 'phone' });
let mounted: { key: string; update(v: PhoneView): void; unmount?(): void } | null = null;

function render(): void {
  if (status !== 'live' || !hello || !view) {
    mounted?.unmount?.();
    mounted = null;
    root.className = '';
    root.replaceChildren(status === 'join' ? joinScreen() : status === 'connecting' || (status === 'live' && (!hello || !view)) ? waitingScreen() : status === 'lost' ? lostScreen() : status === 'full' ? fullScreen() : oldScreen());
    return;
  }
  const v = view;
  document.documentElement.style.setProperty('--seat', SEAT_COLORS[v.seat] ?? hello.color);
  const key = v.screen;
  if (!mounted || mounted.key !== key) {
    mounted?.unmount?.();
    root.replaceChildren();
    root.className = key === 'fight' ? 'in-fight' : '';
    mounted = SCREENS[key](root);
  }
  mounted.update(v);
}

function joinScreen(): HTMLElement {
  const codeBox = el('input', { class: 'code-input', maxlength: 4, autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'CODE', value: code });
  codeBox.addEventListener('input', () => {
    code = cleanPadCode(codeBox.value);
    codeBox.value = code;
  });
  const nameBox = el('input', { maxlength: 12, autocomplete: 'nickname', placeholder: 'YOUR NAME', value: name });
  nameBox.addEventListener('input', () => {
    name = nameBox.value.toUpperCase().slice(0, 12);
  });
  const go = el('button', { class: 'big', onclick: () => void join() }, 'JOIN GAME');
  for (const box of [codeBox, nameBox]) box.addEventListener('keydown', (e) => (e as KeyboardEvent).key === 'Enter' && void join());
  const hasCode = code.length === 4;
  return el(
    'div',
    { class: 'center' },
    el('div', { class: 'h1' }, 'AFTER HOURS'),
    el('div', { class: 'muted' }, hasCode ? `Joining the game on the TV  ·  code ${code}` : 'Use your phone as the controller for the game on the TV.'),
    el(
      'div',
      { class: 'card' },
      !hasCode && el('div', { class: 'field' }, el('label', {}, 'CODE ON THE TV'), codeBox),
      el('div', { class: 'field' }, el('label', {}, 'YOUR NAME'), nameBox),
      go,
      el('div', { class: 'err' }, error),
    ),
    el('a', { class: 'link', href: `${location.pathname}?tv=1` }, 'Play on this screen instead'),
  );
}

function waitingScreen(): HTMLElement {
  return el('div', { class: 'center' }, el('div', { class: 'spin' }), el('div', { class: 'h2' }, status === 'live' ? 'CONNECTED' : 'CONNECTING TO THE TV'), el('div', { class: 'muted' }, `Code ${code}`));
}

function lostScreen(): HTMLElement {
  return el(
    'div',
    { class: 'center' },
    el('div', { class: 'spin' }),
    el('div', { class: 'h2' }, 'RECONNECTING…'),
    el('div', { class: 'muted' }, 'Lost the TV for a moment. Keep this page open, you keep your spot.'),
    el('button', { class: 'ghost', onclick: () => ((status = 'join'), (error = ''), render()) }, 'CHANGE CODE'),
  );
}

function fullScreen(): HTMLElement {
  return el('div', { class: 'center' }, el('div', { class: 'h2' }, 'THE GAME IS FULL'), el('div', { class: 'muted' }, 'Twelve phones are already in. Ask the host to clear players who left.'));
}

function oldScreen(): HTMLElement {
  return el('div', { class: 'center' }, el('div', { class: 'h2' }, 'UPDATE NEEDED'), el('div', { class: 'muted' }, 'The TV runs a newer version.'), el('button', { class: 'big', onclick: () => location.reload() }, 'RELOAD'));
}

/** The top bar: the headline, and this player's name chip (tap to rename). */
function topBar(): { bar: HTMLElement; say: HTMLElement; chip: HTMLElement } {
  const say = el('div', { class: 'say' });
  const label = el('span', {}, name);
  const chip = el('button', { class: 'chip', onclick: rename }, el('span', { class: 'dot' }), label);
  const bar = el('div', { class: 'bar' }, chip, say);
  return { bar, say, chip: label };
}

function rename(): void {
  const next = window.prompt('Your name', name);
  if (next === null) return;
  const clean = next.toUpperCase().replace(/[^A-Z0-9 .!?'_-]/g, '').trim().slice(0, 12);
  if (!clean) return;
  name = clean;
  store('afterhours.phoneName', name);
  send({ t: 'name', v: name });
}

type Mounted = { key: string; update(v: PhoneView): void; unmount?(): void };

const SCREENS: Record<PhoneView['screen'], (root: HTMLElement) => Mounted> = {
  lobby(r) {
    const { bar, say, chip } = topBar();
    const sub = el('div', { class: 'muted' });
    const list = el('div', { class: 'players' });
    const starts = el('div', { class: 'starts' });
    r.append(
      bar,
      el(
        'div',
        { class: 'center' },
        el('div', { class: 'h1 pop' }, "YOU'RE IN!"),
        sub,
        list,
        starts,
        el('div', { class: 'tip' }, 'Tip: turn your phone sideways for the fight. Tap your name to change it.'),
      ),
    );
    return {
      key: 'lobby',
      update(v) {
        say.textContent = '';
        chip.textContent = name;
        sub.textContent = v.sub ?? v.say;
        list.replaceChildren(
          ...(v.players ?? []).map((p) =>
            el('div', { class: `chip${p.on ? '' : ' off'}${p.me ? ' me' : ''}` }, el('span', { class: 'dot', style: `background:${p.color};box-shadow:0 0 10px ${p.color}` }), p.name),
          ),
        );
        const opts = v.starts ?? [];
        const key = opts.map((o) => `${o.id}:${o.label}`).join('|');
        if (starts.dataset.key !== key) {
          starts.dataset.key = key;
          starts.replaceChildren(
            ...opts.map((o, i) => el('button', { class: i === 0 ? 'big' : 'big alt', onclick: () => cmd('start', o.id) }, o.label)),
          );
        }
      },
    };
  },

  wait(r) {
    const { bar, chip } = topBar();
    const big = el('div', { class: 'h1 pop' });
    const sub = el('div', { class: 'muted' });
    const tip = el('div', { class: 'tip' }, 'Your controller switches on when it is your turn.');
    r.append(bar, el('div', { class: 'center' }, big, sub, tip));
    return {
      key: 'wait',
      update(v) {
        chip.textContent = name;
        if (big.textContent !== v.say) {
          big.textContent = v.say;
          big.classList.remove('pop');
          void big.offsetWidth;
          big.classList.add('pop');
        }
        sub.textContent = v.sub ?? '';
        // Still to play: the controller comes back. Out, or the champion: nothing to wait for.
        tip.style.display = ['CHAMPION!', 'GG', 'KNOCKED OUT', 'WATCHING'].includes(v.say) ? 'none' : '';
      },
    };
  },

  remote(r) {
    const { bar, say, chip } = topBar();
    const sub = el('div', { class: 'muted', style: 'text-align:center;padding:0 12px' });
    const repeat = new Map<string, number>();
    const press = (b: HTMLElement, a: string): void => {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        b.classList.add('on');
        menu(a);
        if (['up', 'down', 'left', 'right'].includes(a)) {
          // Hold to keep moving.
          let t = window.setTimeout(function again() {
            menu(a);
            t = window.setTimeout(again, 110);
            repeat.set(a, t);
          }, 380);
          repeat.set(a, t);
        }
      });
      const up = (): void => {
        b.classList.remove('on');
        window.clearTimeout(repeat.get(a));
      };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
    };
    const btn = (label: string, a: string, cls = '', style = ''): HTMLElement => {
      const b = el('button', { class: cls, style }, label);
      press(b, a);
      return b;
    };
    const cross = el(
      'div',
      { class: 'cross' },
      btn('▲', 'up', '', 'grid-column:2;grid-row:1'),
      btn('◀', 'left', '', 'grid-column:1;grid-row:2'),
      btn('▶', 'right', '', 'grid-column:3;grid-row:2'),
      btn('▼', 'down', '', 'grid-column:2;grid-row:3'),
    );
    const okback = el('div', { class: 'okback' }, btn('MENU', 'pause', 'pause'), btn('BACK', 'back', 'back'), btn('OK', 'confirm', 'ok'));
    r.append(bar, sub, el('div', { class: 'remote' }, cross, okback));
    return {
      key: 'remote',
      update(v) {
        chip.textContent = name;
        say.textContent = v.say;
        sub.textContent = v.sub ?? '';
      },
      unmount() {
        for (const t of repeat.values()) window.clearTimeout(t);
      },
    };
  },

  select(r) {
    const { bar, say, chip } = topBar();
    const roster = hello?.roster ?? [];
    const grid = el('div', { class: 'grid' });
    let current: PhoneView | null = null;
    const tiles = [...roster, '?'].map((hid, k) => {
      const isRand = k >= roster.length;
      const info = isRand ? null : heroInfo(hid);
      const t = el(
        'button',
        { class: `tile${isRand ? ' rand' : ''}`, style: isRand ? '' : `background-image:url(${portrait(hid)})` },
        isRand ? '?' : el('div', { class: 'nm' }, info?.name ?? hid),
      );
      t.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (!current || current.locked) return;
        // A second tap on the fighter already picked locks them in.
        if (current.cursor === k) cmd('lock');
        else cmd('hero', k);
      });
      grid.append(t);
      return t;
    });
    const slots = [0, 1].map((k) => el('div', { class: 'slot' }, el('span', {}, k === 0 ? 'POINT' : 'PARTNER')));
    const heroName = el('div', { class: 'hero-name' });
    const heroTitle = el('div', { class: 'hero-title' });
    const lock = el('button', { class: 'big', onclick: () => cmd('lock') }, 'LOCK IN');
    const back = el('button', { class: 'ghost', onclick: () => cmd('back') }, 'BACK');
    const simple = el('button', { class: 'ghost', onclick: () => cmd('simple') }, '');
    const side = el('div', { class: 'side' }, el('div', { class: 'slots' }, ...slots), heroName, heroTitle, lock, el('div', { class: 'row' }, back, simple));
    r.append(bar, el('div', { class: 'select' }, grid, side));
    return {
      key: 'select',
      update(v) {
        current = v;
        chip.textContent = name;
        say.textContent = v.say;
        const sideColor = SEAT_COLORS[v.side ?? v.seat] ?? SEAT_COLORS[0];
        document.documentElement.style.setProperty('--seat', sideColor);
        tiles.forEach((t, k) => {
          t.classList.toggle('hover', v.cursor === k);
          t.classList.toggle('taken', v.first === k);
        });
        const team = v.team !== false;
        slots[1].style.display = team ? '' : 'none';
        const picks = team ? [v.first ?? -1, v.locked ? (v.cursor ?? -1) : -1] : [v.locked ? (v.cursor ?? -1) : -1];
        slots.forEach((s, k) => {
          const h = picks[k] ?? -1;
          s.classList.toggle('full', h >= 0);
          s.classList.toggle('next', h < 0 && !v.locked && k === (team && (v.first ?? -1) >= 0 ? 1 : 0));
          s.style.backgroundImage = h >= 0 && roster[h] ? `url(${portrait(roster[h])})` : '';
        });
        const c = v.cursor ?? 0;
        const info = c < roster.length ? heroInfo(roster[c]) : null;
        heroName.textContent = info ? info.name : 'RANDOM';
        heroTitle.textContent = info ? info.archetype : 'Let fate pick';
        heroName.style.color = info ? hex(info.color) : '';
        lock.textContent = v.locked ? 'READY!' : team && (v.first ?? -1) < 0 ? `PICK ${info ? info.name : 'RANDOM'}` : `LOCK IN ${info ? info.name : 'RANDOM'}`;
        lock.disabled = !!v.locked;
        simple.textContent = v.simple ? 'EASY MOVES: ON' : 'EASY MOVES: OFF';
        simple.style.display = v.simple === undefined ? 'none' : '';
      },
    };
  },

  stage(r) {
    const { bar, say, chip } = topBar();
    const stages = hello?.stages ?? [];
    const list = el('div', { class: 'stages' });
    const cards = stages.map((s, k) => {
      const c = el('button', { class: 'stage', style: `background-image:url(${stageArt(s.id)})` }, el('span', {}, s.name));
      c.addEventListener('click', () => cmd('stage', k));
      list.append(c);
      return c;
    });
    const go = el('button', { class: 'big', onclick: () => cmd('lock') }, 'FIGHT!');
    const back = el('button', { class: 'ghost', onclick: () => cmd('back') }, 'BACK');
    r.append(bar, list, el('div', { class: 'foot' }, back, go));
    let last = -1;
    return {
      key: 'stage',
      update(v) {
        chip.textContent = name;
        say.textContent = v.say;
        cards.forEach((c, k) => c.classList.toggle('hover', v.stage === k));
        if (v.stage !== undefined && v.stage !== last) {
          last = v.stage;
          cards[v.stage]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      },
    };
  },

  fight: fightScreen,
};

// ---------- the fight pad ----------

interface Btn {
  label: string;
  sub?: string;
  bits: number;
  color: string;
}

const MAIN: Btn[] = [
  { label: 'HEAVY', bits: Heavy, color: '#ff5a3d' },
  { label: 'SPECIAL', bits: Special, color: '#8a5cff' },
  { label: 'SUPER', sub: 'H + S', bits: Heavy | Special, color: '#e0a000' },
  { label: 'LIGHT', bits: Light, color: '#2f7bff' },
  { label: 'BLOCK', bits: Block, color: '#56607f' },
  { label: 'ASSIST', sub: 'PARTNER', bits: Block | Light, color: '#1fae7a' },
];
const SMALL: Btn[] = [
  { label: 'THROW', bits: Light | Heavy, color: '' },
  { label: 'HEAT', bits: Light | Special, color: '' },
  { label: 'LAUNCH', bits: Block | Heavy, color: '' },
  { label: 'TAG', bits: Block | Special, color: '' },
];

function fightScreen(r: HTMLElement): Mounted {
  const seat = el('div', { class: 'seat' });
  const teamline = el('div', { class: 'teamline' });
  const pause = el('button', { class: 'pausebtn', onclick: () => menu('pause') }, 'PAUSE');
  const say = el('div', { class: 'say', style: 'flex:none' });
  const bar = el('div', { class: 'bar' }, seat, teamline, say, pause);

  const arrows: Array<[string, number, number, number]> = [
    ['▲', Up, 50, 15],
    ['▼', Down, 50, 85],
    ['◀', Left, 15, 50],
    ['▶', Right, 85, 50],
  ];
  const arrowEls = arrows.map(([t, , x, y]) => el('div', { class: 'arr', style: `left:${x}%;top:${y}%` }, t));
  const knob = el('div', { class: 'knob' });
  const dpad = el('div', { class: 'dpad' }, el('div', { class: 'lbl' }, '▲ JUMP   ▼ CROUCH'), ...arrowEls, knob);
  const dzone = el('div', { class: 'dzone' }, dpad);

  const mk = (b: Btn, cls: string): HTMLElement => {
    const e = el('button', { class: cls, 'data-bits': b.bits, style: b.color ? `--c:${b.color}` : '' }, b.label, b.sub ? el('small', {}, b.sub) : null);
    return e;
  };
  const smalls = el('div', { class: 'smalls' }, ...SMALL.map((b) => mk(b, '')));
  const btns = el('div', { class: 'btns' }, ...MAIN.map((b) => mk(b, 'btn')));
  const bzone = el('div', { class: 'bzone' }, smalls, btns);
  const pad = el('div', { class: 'pad' }, dzone, bzone);
  // Portrait has room to spare above the pad: your team, big.
  const teamcard = el('div', { class: 'teamcard' });
  const fight = el('div', { class: 'fight' }, bar, teamcard, pad, el('div', { class: 'tip portrait-tip' }, 'Turn sideways for bigger buttons'));
  let shownTeam = '';
  r.append(fight);

  // Every finger on the pad: the d-pad finger, and which button each other finger is on.
  let dpadTouch: number | null = null;
  let dirBits = 0;
  const fingers = new Map<number, HTMLElement | null>();

  const dirFrom = (x: number, y: number): number => {
    const box = dpad.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.hypot(dx, dy);
    if (dist < box.width * 0.13) return 0;
    // Eight ways: straight directions get 50 degrees each, diagonals 40.
    const a = (Math.atan2(-dy, dx) * 180) / Math.PI;
    const ang = (a + 360) % 360;
    const near = (c: number): boolean => Math.abs(((ang - c + 540) % 360) - 180) <= 25;
    if (near(0)) return Right;
    if (near(90)) return Up;
    if (near(180)) return Left;
    if (near(270)) return Down;
    if (ang < 90) return Up | Right;
    if (ang < 180) return Up | Left;
    if (ang < 270) return Down | Left;
    return Down | Right;
  };

  const showDir = (bits: number): void => {
    arrows.forEach(([, b], k) => arrowEls[k].classList.toggle('on', (bits & b) !== 0));
    const x = (bits & Right ? 1 : 0) - (bits & Left ? 1 : 0);
    const y = (bits & Down ? 1 : 0) - (bits & Up ? 1 : 0);
    const k = x !== 0 && y !== 0 ? 0.7 : 1;
    knob.style.transform = `translate(calc(-50% + ${x * k * 55}%), calc(-50% + ${y * k * 55}%))`;
  };

  const update = (): void => {
    let bits = dirBits;
    const on = new Set<HTMLElement>();
    for (const b of fingers.values()) {
      if (!b) continue;
      bits |= Number(b.dataset.bits) || 0;
      on.add(b);
    }
    for (const b of [...Array.from(smalls.children), ...Array.from(btns.children)] as HTMLElement[]) b.classList.toggle('on', on.has(b));
    const before = held;
    setHeld(bits);
    if (held & ~before & (Light | Heavy | Special | Block)) buzz(10);
  };

  const buttonAt = (x: number, y: number): HTMLElement | null => {
    const t = document.elementFromPoint(x, y) as HTMLElement | null;
    const b = t?.closest('[data-bits]') as HTMLElement | null;
    return b && bzone.contains(b) ? b : null;
  };

  const down = (e: PointerEvent): void => {
    if ((e.target as HTMLElement).closest('.pausebtn')) return;
    e.preventDefault();
    keepAwake();
    if (dpadTouch === null && dzone.contains(e.target as Node)) {
      dpadTouch = e.pointerId;
      dirBits = dirFrom(e.clientX, e.clientY);
      showDir(dirBits);
    } else fingers.set(e.pointerId, buttonAt(e.clientX, e.clientY));
    update();
  };
  const move = (e: PointerEvent): void => {
    if (e.pointerId === dpadTouch) {
      const d = dirFrom(e.clientX, e.clientY);
      if (d !== dirBits) {
        dirBits = d;
        showDir(d);
        update();
      }
    } else if (fingers.has(e.pointerId)) {
      // Slide from one button to the next.
      const b = buttonAt(e.clientX, e.clientY);
      if (b !== fingers.get(e.pointerId)) {
        fingers.set(e.pointerId, b);
        update();
      }
    }
    e.preventDefault();
  };
  const up = (e: PointerEvent): void => {
    if (e.pointerId === dpadTouch) {
      dpadTouch = null;
      dirBits = 0;
      showDir(0);
    }
    fingers.delete(e.pointerId);
    update();
  };
  pad.addEventListener('pointerdown', down);
  pad.addEventListener('pointermove', move);
  pad.addEventListener('pointerup', up);
  pad.addEventListener('pointercancel', up);
  const noMenu = (e: Event): void => e.preventDefault();
  pad.addEventListener('contextmenu', noMenu);

  return {
    key: 'fight',
    update(v) {
      seat.textContent = v.seat === 1 ? 'P2' : 'P1';
      const team = v.teams?.[v.seat === 1 ? 1 : 0] ?? [];
      const roster = hello?.roster ?? [];
      teamline.textContent = team.map((h) => heroInfo(roster[h] ?? '')?.name ?? '').filter(Boolean).join(' + ') || name;
      say.textContent = v.say;
      const key = team.join(',');
      if (key !== shownTeam) {
        shownTeam = key;
        teamcard.replaceChildren(
          ...team.map((h, k) =>
            el('div', { class: 'tc' }, el('div', { class: 'tcimg', style: `background-image:url(${portrait(roster[h] ?? '')})` }), el('div', { class: 'tcname' }, heroInfo(roster[h] ?? '')?.name ?? ''), el('div', { class: 'tcrole' }, k === 0 ? 'POINT' : 'PARTNER')),
          ),
        );
      }
    },
    unmount() {
      dpadTouch = null;
      dirBits = 0;
      fingers.clear();
      setHeld(0);
    },
  };
}

// ---------- start ----------

export function startPhone(): void {
  const meta = document.querySelector('meta[name=viewport]');
  meta?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
  document.title = 'After Hours · Controller';
  const style = document.createElement('style');
  style.textContent = PHONE_CSS;
  document.head.append(style);
  document.body.append(root);
  // No pinch zoom or double-tap zoom on the controller (iOS ignores the viewport setting).
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  render();
  if (code.length === 4 && name) void join();
}
