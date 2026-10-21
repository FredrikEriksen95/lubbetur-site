// Spillhallen: Tidslinjen, Først!, Anslaget, Hvem er jeg?, Koblingen, Hvem av oss?, Bløff og Skål.
// Spilles på én telefon (helt uten nett) eller online i samme rom (db + room).
window.LubArcade = (function () {
  'use strict';
  const EV = TL_RAW.map((r, i) => ({ i, y: r[0], c: r[1], d: r[2], t: r[3], ca: !!r[4] }));
  // Startår for tidslinjen: rene årstall som ankerkort (ikke hendelser). Faste indekser, like på alle telefoner.
  const ANCH = [];
  for (let y = -500; y <= 1700; y += 100) ANCH.push(y); ANCH.push(1750); for (let y = 1800; y <= 2020; y += 10) ANCH.push(y);
  ANCH.forEach((y) => EV.push({ i: EV.length, y, c: '_y', d: 0, t: 'Startår', anchor: true }));
  function anchorFor(cfg) {
    const ys = tlPool(cfg).map((i) => EV[i].y).sort((p, q) => p - q); if (!ys.length) return EV.find((e) => e.anchor && e.y === 1950).i;
    const y = ys[Math.floor(ys.length * (.3 + Math.random() * .4))];
    const step = y >= 1800 ? 10 : y >= 1700 ? 50 : 100; let r = Math.round(y / step) * step; if (y >= 1700 && y < 1800) r = y < 1725 ? 1700 : y < 1775 ? 1750 : 1800;
    const best = EV.filter((e) => e.anchor).reduce((b, e) => (Math.abs(e.y - r) < Math.abs(b.y - r) ? e : b));
    return best.i;
  }
  const COLS = ['#ff5b24', '#4df3ff', '#f7dd8f', '#b48cff', '#2bff88', '#ff6ad5', '#ffe600', '#7aa8ff'];
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const mem = store.get('lub-arc', {}) || {};
  const memSet = (k, v) => { mem[k] = v; store.set('lub-arc', mem); };
  const rnd = (n) => Math.floor(Math.random() * n);
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function h(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function btn(txt, cls, fn) { const b = h('button', 'ab' + (cls ? ' ' + cls : ''), txt); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
  const fmtY = (e) => (e.ca ? 'ca. ' : '') + (e.y < 0 ? (-e.y) + ' f.Kr.' : String(e.y));
  const fmtN = (v) => { if (v == null || !isFinite(v)) return '–'; const a = Math.abs(v); const s = a >= 1000 ? Math.round(v).toLocaleString('nb-NO') : (Math.round(v * 100) / 100).toLocaleString('nb-NO'); return s; };
  const parseN = (s) => { s = String(s || '').trim().replace(/\s| /g, '').replace(',', '.'); if (!s) return null; const v = Number(s); return isFinite(v) ? v : null; };

  // ---------- Lyd og effekter (bruker sidens lydsystem) ----------
  const L = (n, ...a) => { try { const s = window.LubSnd; if (s && s[n]) return s[n](...a); } catch (e) {} };
  const fx = {
    tap() { L('key'); },
    sel() { L('pop', false); },
    good() { L('stab', [523.25, 659.25, 783.99], .45, .07); L('pop', true); L('buzz', 30); },
    bad() { L('sub', 120, 40, .45, .55); L('tone', 'sawtooth', 190, 80, .35, .04); L('buzz', [40, 40, 40]); },
    reveal() { L('cymbal', .5, .05, 0, true); },
    bonus() { L('stab', [783.99, 987.77, 1174.66], .6, .06, .15); L('crackle', .6, .2, .1); },
    win() { L('gold'); L('confetti'); L('buzz', [80, 40, 160]); },
    whoosh() { L('noise', .22, 'bandpass', 2200, 500, .02, .28, 1.2); },
    hint() { L('tone', 'sine', 660, 880, .18, .06); },
    toast(t) { L('toast', t); }
  };

  // ---------- Nett ----------
  const NET = { db: null, room: null, ref: null, remote: null, ok: false };
  let OPT = { people: [], who: () => null, setWho: null };
  const who = () => { try { return OPT.who() || null; } catch (e) { return null; } };
  // Beskjed om innlogging: uten Claude-innlogging virker ikke online-spill, felles rekorder eller delte kort
  function loginBanner() {
    try { const t = +localStorage.getItem('lub-loginx2') || 0; if (Date.now() - t < 12 * 3600e3) return; } catch (e) {}
    if (document.querySelector('.login-ban')) return;
    const b = h('div', 'login-ban'); b.setAttribute('role', 'status');
    const ro = !!NET.db && NET.can === false;
    const t = h('div', 'lb-t');
    if (ro) t.append(h('b', '', 'Lenken gir bare lesetilgang'), h('span', '', 'Du er logget inn, men delingen av appen står på «kan se». Da kan du ikke spille online eller lagre i fellesskap. Den som eier appen må endre delingen.'));
    else t.append(h('b', '', 'Logg inn på Claude for å være med online'), h('span', '', 'Gratis konto. Da kan du spille sammen med gjengen, se felles rekorder, legendekort og bilder. Alt annet i appen virker uten. Er du allerede logget inn, åpne lenken på nytt i samme nettleser.'));
    const go = h('a', 'lb-go', ro ? 'OK' : 'Logg inn'); go.href = 'https://claude.ai/login'; go.target = '_blank'; go.rel = 'noopener'; if (ro) { go.removeAttribute('href'); go.onclick = () => b.remove(); }
    const x = h('button', 'lb-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Lukk'); x.onclick = () => { b.remove(); try { localStorage.setItem('lub-loginx2', String(Date.now())); } catch (e) {} };
    b.append(t, go, x); document.body.append(b);
  }
  async function netInit() {
    const use = (n) => { try { return window.claude && window.claude.use ? window.claude.use(n) : Promise.resolve(null); } catch (e) { return Promise.resolve(null); } };
    try { NET.db = await use('db'); } catch (e) { NET.db = null; }
    try { NET.room = await use('room'); } catch (e) { NET.room = null; }
    NET.ok = !!(NET.db && NET.room);
    try { const u = await use('user'); NET.user = !!u; NET.can = u ? await u.can('data.write') : null; NET.owner = u ? await u.isOwner() : false; } catch (e) { NET.can = null; }
    if (navigator.onLine !== false && (!NET.db || NET.can === false)) loginBanner();
    if (NET.db) {
      try {
        NET.ref = true; NET.rooms = [];
        NET.db.collection('rom').onSnapshot((q) => { NET.rooms = (q.docs || []).map((d) => d.data()).filter((r) => r && r.sid && r.code); pickRemote(); onRemote(); }, () => {});
      } catch (e) { NET.ref = null; NET.ok = false; }
    }
    if (NET.room) { try { NET.room.on('arc', onMsg); } catch (e) {} }
    if (NET.db) {
      const hubRe = () => { if (view && !S && !setupState) renderHub(); };
      try { NET.db.collection('rekord').onSnapshot((q) => { RECS = (q.docs || []).map((d) => d.data()).filter((x) => x && x.g && x.name); hubRe(); }, () => {}); } catch (e) {}
      try { NET.db.collection('quiz').onSnapshot((q) => { QUIZZES = (q.docs || []).map((d) => d.data()).filter((x) => x && x.id && !x.deleted && Array.isArray(x.qs)); const gone = new Set((q.docs || []).map((d) => d.data()).filter((x) => x && x.deleted).map((x) => x.id)); if (gone.size) memSet('myQuiz', (mem.myQuiz || []).filter((x) => !gone.has(x.id))); if (view && setupState && setupState.g === 'qz' && !EDIT && !(S && S.ph !== 'closed' && !(S.st && S.st.end))) renderSetup(); }, () => {}); } catch (e) {}
      try { NET.db.collection('tur').onSnapshot((q) => { TUR = (q.docs || []).map((d) => d.data()).filter((x) => x && x.cat && x.name); (mem.turQ || []).forEach((e) => turApply(e)); if (!turLoaded) { turLoaded = true; setTimeout(turFlush, 500); } medPsFix(); hubRe(); }, () => {}); } catch (e) {}
      try { NET.db.collection('seier').onSnapshot((q) => { WINS = (q.docs || []).map((d) => d.data()).filter((x) => x && x.name); hubRe(); }, () => {}); } catch (e) {}
    }
    renderSection();
    if (view) renderHeader();
  }
  function emit(data) { try { if (NET.room) NET.room.emit('arc', data).catch(() => {}); } catch (e) {} }
  function presence(sid) { try { if (NET.room) NET.room.presence({ arc: sid || null, who: who() }).catch(() => {}); } catch (e) {} }
  let DEV = null; try { DEV = localStorage.getItem('lub-dev'); if (!DEV) { DEV = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); localStorage.setItem('lub-dev', DEV); } } catch (e) { DEV = 'd' + Math.random().toString(36).slice(2); }
  // Gruppespill og online åpner torsdag 22.10 kl. 11:30 norsk tid. Spill alene er åpne fra avsløringen.
  const GROUP_AT = Date.parse('2026-10-22T09:30:00Z');
  const groupLocked = () => !window.__LUB_GAMES && Date.now() < GROUP_AT;
  // Bare de rene enspillerspillene er åpne før torsdag; alle spill som kan spilles sammen er låst, også alene
  const SOLO_OPEN = ['ps', 'sn', 'ff', 'st', 'ms', 'kb', 'ko'];
  const LOCK_TXT = 'Gruppespillene åpner torsdag kl. 11:30';
  const roomLive = (R) => R && R.ph !== 'closed' && Date.now() - (R.ts || 0) < 4 * 3600000;

  // ---------- Økt ----------
  let S = null, UI = {}, view = null, hostTimer = null, setupState = null;
  const G = () => GAMES[S.g];
  const isHost = () => !!S && (!S.on || S.host === who());
  function membersOf(p) { return [p.id].concat(p.mem || []); }
  function canBy(pid, by) { if (!S.on) return true; const p = S.pl.find((x) => x.id === pid); return !!p && membersOf(p).includes(by); }
  const can = (pid) => canBy(pid, who());
  const myPids = () => !S.on ? S.pl.map((p) => p.id) : S.pl.filter((p) => membersOf(p).includes(who())).map((p) => p.id);
  const inGame = (by) => !S.on || S.pl.some((p) => membersOf(p).includes(by)) || (S.mem || []).includes(by);
  const pcol = (pid) => { const p = S.pl.find((x) => x.id === pid); return p ? p.col : '#888'; };
  const pname = (pid) => { const p = S.pl.find((x) => x.id === pid); return p ? p.name : pid; };

  function dispatch(a) {
    if (!S) return;
    if (!S.on) { apply(a, null); return; }
    if (S.host === who()) { apply(a, who()); return; }
    emit({ sid: S.sid, a, by: who() });
    // Skjer det ingenting, hent siste tilstand fra rommet (telefonen kan ha vist et utdatert bord)
    const v0 = S.v, sid = S.sid; setTimeout(() => { if (S && S.on && S.sid === sid && S.v === v0) resync(); }, 2500);
  }
  function resync() {
    try { if (!S || !S.on || !NET.db || !S.code) return; const sid = S.sid;
      NET.db.doc('rom/' + S.code).get().then((sn) => { const R = sn && sn.data ? sn.data() : null; if (!R || !S || R.sid !== sid) return; if ((R.v || 0) >= (S.v || 0)) { S = R; UI.key = null; render(); } }).catch(() => {});
    } catch (e) {}
  }
  function apply(a, by) {
    let ok;
    if (S.ph === 'lobby') ok = lobbyAct(a, by);
    else if (a.t === 'close') { if (!S.on || by === S.host) { S.ph = 'closed'; ok = true; } }
    else if (a.t === 'again') { if (!S.on || by === S.host) { S.st = G().init(S); UI = { fresh: true }; ok = true; } }
    else if (a.t === 'finish') { if ((!S.on || by === S.host) && S.ph === 'play' && !S.st.end) { S.st.end = { finished: true }; ok = true; } }
    else if (a.t === 'nextboard') { if ((!S.on || by === S.host) && S.g === 'ko') { const d = new Set(mem.koDone || []); let n = (S.cfg.p || 0) + 1; for (let k = 0; k < CONN.length; k++) { const c = ((S.cfg.p || 0) + 1 + k) % CONN.length; if (!d.has(c)) { n = c; break; } } S.cfg.p = n % CONN.length; S.st = G().init(S); UI = { fresh: true }; ok = true; } }
    else ok = G().act(S, a, by);
    if (!ok) return;
    S.v = (S.v || 0) + 1; S.ts = Date.now();
    if (S.on) save();
    render();
  }
  function save() { try { if (NET.db && S && S.code) NET.db.doc('rom/' + S.code).set(clone(S)).catch(() => {}); } catch (e) {} }
  // Rom med kode: flere rom kan være åpne samtidig
  const liveRooms = () => (NET.rooms || []).filter((r) => roomLive(r) && GAMES[r.g]).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const roomOf = (sid) => (NET.rooms || []).find((r) => r.sid === sid) || null;
  function pickRemote() { const L2 = liveRooms(); NET.remote = (S && S.on && L2.find((r) => r.sid === S.sid)) || L2.find((r) => r.host !== who() && r.ph === 'lobby') || L2[0] || null; }
  function genCode() { const A = 'ABCDEFGHJKLMNPRSTUVWXYZ'; const used = new Set((NET.rooms || []).map((r) => r.code)); let c; do { c = Array.from({ length: 4 }, () => A[rnd(A.length)]).join(''); } while (used.has(c)); return c; }
  function roomsBox(box, inOv) {
    if (groupLocked()) return;
    const L2 = liveRooms();
    L2.forEach((R) => {
      const mine = S && S.on && S.sid === R.sid; const b = h('div', 'ah-live'); const t = h('div');
      t.append(h('b', '', (mine ? 'Du er i ' : R.host + ': ') + GAMES[R.g].name), h('div', 'fine', 'Kode ' + R.code + ' · ' + (R.ph === 'lobby' ? (R.mem || []).length + ' i rommet, venter på start' : 'i gang')));
      b.append(t, btn(mine ? 'Tilbake' : (R.ph === 'lobby' ? 'Bli med' : 'Se på'), 'sm', () => { if (mine) { openOverlay(); UI.key = null; render(); } else joinRoom(R); }));
      box.append(b);
    });
    if (NET.ok) {
      const f = h('form', 'ah-code'); const inp = h('input'); inp.placeholder = 'Har du en romkode?'; inp.maxLength = 4; inp.autocapitalize = 'characters'; inp.autocomplete = 'off'; inp.setAttribute('aria-label', 'Romkode');
      const go = h('button', 'ab sm', 'Bli med'); go.type = 'submit'; const msg = h('span', 'fine', '');
      f.append(inp, go, msg);
      f.addEventListener('submit', (e) => { e.preventDefault(); const c = inp.value.trim().toUpperCase(); const R = (NET.rooms || []).find((r) => r.code === c); if (!R || !roomLive(R)) { msg.textContent = 'Fant ikke et åpent rom med koden ' + (c || '…') + '.'; fx.bad(); return; } fx.good(); joinRoom(R); });
      box.append(f);
    }
  }
  function onMsg(msg) {
    const d = msg && msg.data; if (!d || typeof d !== 'object' || !S || !S.on || d.sid !== S.sid) return;
    const a = d.a; if (!a || typeof a !== 'object' || typeof a.t !== 'string') return;
    if (a.t === 'hover') { if (!(msg.isMe && msg.sameTab)) { UI.hover = Number(a.pos) || 0; patchHover(); } return; }
    if (msg.isMe && msg.sameTab) return;
    if (S.host !== who()) return;
    const by = String(d.by || ''); if (!by) return;
    apply(a, by);
  }
  function onRemote() {
    renderSection();
    const R = S && S.on ? roomOf(S.sid) : null;
    if (!S || !S.on || !R || R.sid !== S.sid) return;
    if (S.host === who() && R.host === who()) return;
    if ((R.v || 0) < (S.v || 0) && R.host === S.host) return;
    S = R; render();
  }

  function startLocal(g, pl, cfg) {
    S = { sid: 's' + Date.now().toString(36) + rnd(1e6).toString(36), g, on: false, host: null, ph: 'play', pl, cfg, v: 0, ts: Date.now() };
    S.st = GAMES[g].init(S); UI = { fresh: true }; render(); hostLoop();
  }
  function createRoom(g, cfg) {
    const me = who(); if (!me || groupLocked()) return;
    S = { sid: 'r' + Date.now().toString(36) + rnd(1e6).toString(36), code: genCode(), g, on: true, host: me, hostDev: DEV, ph: 'lobby', mem: [me], teams: GAMES[g].fixedTeams ? [{ id: 't0', name: 'Lag 1', mem: [me] }, { id: 't1', name: 'Lag 2', mem: [] }] : null, pl: [], cfg, v: 1, ts: Date.now() };
    UI = { fresh: true }; save(); presence(S.sid); render(); hostLoop();
  }
  // To telefoner med samme navn ødelegger rommet: begge tror de er vert
  function sameNameGuard(R) {
    const me = who(); if (!(R && me && R.host === me && R.hostDev && R.hostDev !== DEV)) return false;
    S = null; setupState = null; openOverlay(); renderHeader(); setBack(() => renderHub());
    view.body.innerHTML = ''; const w = h('div', 'ar-w'); view.body.append(w);
    const p = h('div', 'panel'); p.append(h('span', 'lbl', 'Samme navn på to telefoner'), h('h3', '', 'Hvem er du?'), h('p', 'fine', R.host + ' startet dette rommet fra en annen telefon. Denne telefonen er også satt til ' + R.host + ', så velg hvem som spiller her.'));
    const c = h('div', 'chips2'); (OPT.people || []).filter((n) => n !== R.host).forEach((n) => { const b = h('button', '', n); b.type = 'button'; b.onclick = () => { try { OPT.setWho && OPT.setWho(n); } catch (e) {} fx.good(); joinRoom(R); }; c.append(b); }); p.append(c);
    if (window.__lubAddName) { const f = h('form', 'gm-add'); const i = h('input'); i.type = 'text'; i.maxLength = 18; i.placeholder = 'Nytt navn'; const ab = h('button', '', 'Legg til'); ab.type = 'submit'; f.append(i, ab); f.onsubmit = async (e) => { e.preventDefault(); const n = await window.__lubAddName(i.value); if (n && n !== R.host) joinRoom(R); }; p.append(f); }
    w.append(p); fx.bad(); return true;
  }
  function joinRoom(R0) {
    const R = R0 || NET.remote; if (!roomLive(R) || groupLocked()) return;
    if (sameNameGuard(R)) return;
    const me = who();
    S = clone(R); UI = { fresh: true }; setupState = null; EDIT = null; openOverlay(); presence(S.sid);
    if (S.ph === 'lobby' && me && !(S.mem || []).includes(me) && S.host !== me) dispatch({ t: 'join' });
    render(); hostLoop();
  }
  function lobbyAct(a, by) {
    const hostOnly = by === S.host;
    if (a.t === 'join') { if (!by || (S.mem || []).includes(by) || S.mem.length >= 12) return false; S.mem.push(by); if (S.teams) { const tt = G().fixedTeams ? S.teams.slice().sort((x, y) => x.mem.length - y.mem.length)[0] : S.teams[S.mem.length % S.teams.length]; tt.mem.push(by); } return true; }
    if (a.t === 'leave') { S.mem = S.mem.filter((m) => m !== by); if (S.teams) S.teams.forEach((t) => { t.mem = t.mem.filter((m) => m !== by); }); return true; }
    if (!hostOnly) return false;
    if (a.t === 'teams') { if (a.n) { S.teams = Array.from({ length: a.n }, (_, i) => ({ id: 't' + i, name: 'Lag ' + (i + 1), mem: [] })); S.mem.forEach((m, i) => S.teams[i % a.n].mem.push(m)); } else S.teams = null; return true; }
    if (a.t === 'move') { if (!S.teams) return false; const from = S.teams.findIndex((t) => t.mem.includes(a.who)); if (from < 0) return false; S.teams[from].mem = S.teams[from].mem.filter((m) => m !== a.who); S.teams[(from + 1) % S.teams.length].mem.push(a.who); return true; }
    if (a.t === 'start') {
      if (G().fixedTeams && (!S.teams || S.teams.length !== 2 || S.teams.some((t) => t.mem.length < 2))) return false;
      S.pl = S.teams ? S.teams.filter((t) => t.mem.length).map((t, i) => ({ id: t.id, name: t.name, col: COLS[i % COLS.length], mem: t.mem.slice() }))
        : S.mem.map((m, i) => ({ id: m, name: m, col: COLS[i % COLS.length] }));
      if (!S.pl.length) return false;
      S.ph = 'play'; S.st = G().init(S); return true;
    }
    if (a.t === 'close') { S.ph = 'closed'; return true; }
    return false;
  }
  function hostLoop() {
    clearInterval(hostTimer);
    hostTimer = setInterval(() => {
      if (!S) return;
      if (isHost() && S.ph === 'play' && G().tick && G().tick(S)) { S.v++; S.ts = Date.now(); if (S.on) save(); render(); }
      if (S.on && S.host !== who() && view) checkHost();
      if (view && G().clock) G().clock(S, view.body);
    }, 250);
  }
  let hostGoneSince = 0;
  function checkHost() {
    let here = true;
    try { const ps = NET.room ? NET.room.peers() : []; here = ps.some((p) => p.presence && p.presence.who === S.host && p.presence.arc === S.sid); } catch (e) {}
    if (here) { hostGoneSince = 0; const t = view.body.querySelector('.takeover'); if (t) t.remove(); return; }
    if (!hostGoneSince) hostGoneSince = Date.now();
    if (Date.now() - hostGoneSince > 9000 && !view.body.querySelector('.takeover') && inGame(who())) {
      const w = view.body.querySelector('.ar-w'); if (!w) return;
      const p = h('div', 'panel takeover'); p.append(h('p', 'fine', S.host + ' ser ut til å ha forlatt spillet.'), btn('Ta over som vert', 'go', () => { S.host = who(); S.v++; save(); render(); fx.toast('Du er nå vert.'); }));
      w.prepend(p);
    }
  }

  // ---------- Overlay ----------
  function openOverlay() {
    if (view) return;
    const el = h('div', 'ar'); el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Spillhallen');
    const hd = h('header', 'ar-h');
    const x = btn('✕', '', () => { if (view && view.backFn) view.backFn(); else closeOverlay(); }); x.className = 'x'; x.setAttribute('aria-label', 'Lukk');
    const t = h('div', 't'); t.append(h('span', '', 'Spillhallen'), h('b', '', ''));
    const net = h('span', 'net', '');
    const x2 = btn('✕', '', () => closeOverlay()); x2.className = 'x x2'; x2.setAttribute('aria-label', 'Lukk spillhallen');
    hd.append(x, t, net, x2);
    const body = h('main', 'ar-b');
    el.append(hd, body); document.body.append(el);
    el.addEventListener('click', (e) => e.stopPropagation());
    document.documentElement.style.overflow = 'hidden';
    view = { el, body, title: t.querySelector('b'), net, back: x, close: x2, backFn: null };
    renderFloat();
  }
  function setBack(fn) { if (!view) return; view.backFn = fn; view.back.textContent = fn ? '‹' : '✕'; view.back.setAttribute('aria-label', fn ? 'Tilbake' : 'Lukk'); view.close.hidden = !fn; }
  function askConfirm(title, text, yes, fn) {
    if (!view) return; const old = view.el.querySelector('.acf'); if (old) old.remove();
    const d = h('div', 'acf'); const p = h('div', 'panel'); p.append(h('h3', '', title)); if (text) p.append(h('p', 'fine', text));
    const r = h('div', 'arow'); r.append(btn('Avbryt', 'ghost', () => d.remove()), btn(yes, 'go', () => { d.remove(); fn(); })); p.append(r); d.append(p);
    d.addEventListener('click', (e) => { if (e.target === d) d.remove(); }); view.el.append(d);
  }
  function goSetup(g) { S = null; clearInterval(hostTimer); UI = {}; openSetup(g); }
  function leaveGame() {
    if (!S) { renderHub(); return; }
    const g = S.g;
    const done = S.ph === 'closed' || (S.st && S.st.end);
    const out = () => { if (S && S.on) { if (isHost() && S.ph !== 'closed') dispatch({ t: 'close' }); else if (S.ph === 'lobby') dispatch({ t: 'leave' }); presence(null); } goSetup(g); };
    if (done) { out(); return; }
    askConfirm('Avslutte spillet?', S.on ? (isHost() ? 'Rommet stenges for alle som er med.' : 'Du forlater rommet. De andre kan spille videre.') : 'Stillingen blir ikke lagret.', 'Avslutt', out);
  }
  function closeOverlay() {
    if (!view) return;
    view.el.remove(); view = null; setupState = null; EDIT = null; document.documentElement.style.overflow = '';
    if (S && S.on) presence(null);
    if (S && (S.ph === 'closed' || (S.st && S.st.end && !S.on))) { S = null; clearInterval(hostTimer); }
    renderSection();
  }
  function renderHeader() {
    if (!view) return;
    const g = S ? GAMES[S.g] : (setupState ? GAMES[setupState.g] : null);
    view.title.textContent = g ? g.name : 'Spillhallen';
    view.el.style.setProperty('--ag', g ? g.glow : '#163440');
    const on = S && S.on;
    view.net.textContent = on ? 'Online' + (S.host === who() ? ' · vert' : '') : (S ? 'Én telefon' : (NET.ok ? (NET.can === false ? 'Bare lesetilgang' : 'Nett klart') : (navigator.onLine === false ? 'Uten nett' : (NET.db ? 'Delvis tilkoblet' : 'Ikke innlogget'))));
    view.net.classList.toggle('on', !!on);
  }
  function render() {
    if (!view) { renderSection(); return; }
    renderHeader();
    if (!S) return;
    setBack(leaveGame);
    const g = G();
    let key;
    if (S.ph === 'closed') key = 'closed';
    else if (S.ph === 'lobby') key = 'lobby:' + S.v;
    else if (S.st.end) key = 'end:' + S.v;
    else key = 'play:' + g.key(S, UI);
    if (key === UI.key && g.patch && S.ph === 'play' && !S.st.end) { g.patch(S, ctx(), view.body); return; }
    UI.key = key;
    view.body.innerHTML = '';
    const w = h('div', 'ar-w'); view.body.append(w);
    if (S.ph === 'closed') { w.append(h('div', 'watch', 'Spillet er avsluttet.')); w.append(btn('Til spillhallen', 'big', () => { S = null; renderHub(); })); return; }
    if (S.ph === 'lobby') { renderLobby(w); return; }
    if (S.st.end) { if (!S.st.recDone && isHost()) { S.st.recDone = true; try { recordResult(); } catch (e) {} } renderEnd(w); return; }
    UI.endFx = false;
    g.view(S, ctx(), w);
    if (isHost() && g.finish !== false) { const f = h('div', 'arow ar-fin'); f.append(btn(g.finishLabel || 'Avslutt og se stillingen', 'sm ghost', () => askConfirm(g.finishLabel || 'Avslutte nå?', 'Spillet stoppes, og dere ser resultatet.', 'Se resultatet', () => dispatch({ t: 'finish' })))); w.append(f); }
    view.body.scrollTop = UI.keepScroll ? view.body.scrollTop : 0;
  }
  const ctx = () => ({ local: !S.on, host: isHost(), can, d: dispatch, ui: UI, me: who(), mine: myPids() });

  // Overlevering (én telefon, flere spillere)
  function handoff(w, pid, key, sub) {
    if (S.on || S.pl.length < 2 || UI.hand === key) return false;
    const p = S.pl.find((x) => x.id === pid);
    const d = h('div', 'hand'); d.style.setProperty('--pc', p ? p.col : '#ff5b24');
    const inner = h('div'); inner.append(h('span', 'lbl', 'Send telefonen til'), h('b', '', p ? p.name : ''), h('span', 't2', sub || 'Trykk når du er klar'));
    d.append(inner);
    d.addEventListener('click', () => { UI.hand = key; UI.key = null; fx.whoosh(); render(); });
    view.body.style.position = 'relative'; w.append(d); fx.tap();
    return true;
  }
  function scoreboard(w, cur, fmt) {
    if (S.pl.length < 2) return;
    const sb = h('div', 'sb');
    S.pl.forEach((p) => { const c = h('div', 'pc' + (p.id === cur ? ' on' : '')); c.style.setProperty('--pc', p.col); c.append(h('span', '', p.name)); const f = fmt(p); c.append(h('b', '', f[0])); if (f[1]) c.append(h('small', '', f[1])); sb.append(c); });
    w.append(sb);
  }
  function watchLine(w, txt) { const d = h('div', 'watch'); d.textContent = txt; w.append(d); }
  function nextBtn(w, label, a) {
    if (!(isHost() || (a && a.anyone && myPids().length))) { watchLine(w, 'Venter på at ' + S.host + ' går videre'); return null; }
    const b = btn(label || 'Neste', 'go big', () => dispatch({ t: 'next' })); w.append(b); return b;
  }

  // ---------- Lobby ----------
  function renderLobby(w) {
    const g = G(); const me = who(); const host = S.host === me;
    const top = h('div', 'panel');
    top.append(h('span', 'lbl', 'Online-rom'), h('h3', '', g.name), h('p', 'fine', host ? 'Gutta trykker «Bli med» i Spillhallen, eller skriver inn romkoden.' : 'Du er med. ' + S.host + ' starter spillet.'));
    if (S.code) { const cd = h('div', 'room-code'); cd.append(h('span', '', 'Romkode'), h('b', '', S.code)); top.append(cd); }
    w.append(top);
    if (!me) { namePick(w, () => { dispatch({ t: 'join' }); }); }
    if (g.teams !== false && host) {
      const sg = seg([['Alle mot alle', 0], ['2 lag', 2], ['3 lag', 3]], S.teams ? S.teams.length : 0, (v) => dispatch({ t: 'teams', n: v }));
      w.append(sg);
    }
    if (S.teams) {
      const tw = h('div', 'teams2'); if (S.teams.length === 3) tw.style.gridTemplateColumns = '1fr 1fr 1fr';
      S.teams.forEach((t, i) => { const c = h('div', 'tm'); c.style.setProperty('--pc', COLS[i % COLS.length]); c.append(h('b', '', t.name));
        t.mem.forEach((m) => { const b = h('button', '', m + (host ? ' ⇄' : '')); b.type = 'button'; if (host) b.onclick = () => dispatch({ t: 'move', who: m }); else b.disabled = true; c.append(b); }); tw.append(c); });
      w.append(tw); if (host) w.append(h('p', 'fine', 'Trykk på en spiller for å flytte ham til neste lag.'));
    } else {
      const l = h('div', 'lob');
      (S.mem || []).forEach((m, i) => { const r = h('div', 'pr'); const dot = h('i'); dot.style.background = COLS[i % COLS.length]; r.append(dot, h('b', '', m), h('small', '', m === S.host ? 'VERT' : (m === me ? 'DEG' : 'KLAR'))); l.append(r); });
      w.append(l);
    }
    if (host) {
      const bad = g.fixedTeams && (!S.teams || S.teams.some((t) => t.mem.length < 2));
      if (bad) w.append(h('p', 'fine', 'Trenger minst to på hvert lag.'));
      const sbtn = btn('Start spillet', 'go big', () => { fx.good(); dispatch({ t: 'start' }); }); sbtn.disabled = !!bad; w.append(sbtn);
      w.append(btn('Avbryt rommet', 'ghost', () => { dispatch({ t: 'close' }); }));
    } else {
      watchLine(w, 'Venter på ' + S.host + ' …');
      w.append(btn('Forlat rommet', 'ghost', () => { dispatch({ t: 'leave' }); S = null; closeOverlay(); }));
    }
  }
  function namePick(w, done) {
    const p = h('div', 'panel'); p.append(h('h3', '', 'Hvem er du?'));
    const c = h('div', 'chips2');
    (OPT.people || []).forEach((n) => { const b = h('button', '', n); b.type = 'button'; b.onclick = () => { try { OPT.setWho && OPT.setWho(n); } catch (e) {} UI.key = null; if (done) done(); render(); if (setupState) renderSetup(); }; c.append(b); });
    p.append(c); w.append(p);
  }

  // ---------- Slutt ----------
  function renderEnd(w) {
    const g = G();
    if (!UI.endFx) { UI.endFx = true; if (S.st.end && S.st.end.win === false) fx.bad(); else fx.win(); try { checkMedals(); } catch (e) { UI.medal = null; } }
    if (g.endView) g.endView(S, w);
    else {
      const rk = g.rank(S);
      const tie = S.pl.length > 1 && rk[1] && rk[0].n != null && rk[0].n === rk[1].n;
      const tops = tie ? rk.filter((r) => r.n === rk[0].n).map((r) => r.name).join(' og ') : rk[0].name;
      const tr = h('div', 'trophy'); tr.innerHTML = TROPHY; tr.append(h('span', 'lbl', S.pl.length > 1 ? (tie ? 'Uavgjort mellom' : 'Vinneren er') : 'Resultat'), h('b', '', S.pl.length > 1 ? tops : rk[0].val)); if (rk[0].sub) tr.append(h('p', 'fine', rk[0].sub)); if (UI.newRec) tr.append(h('span', 'newrec', 'Ny rekord: ' + UI.newRec)); w.append(tr);
      if (S.pl.length > 1) { const pd = h('div', 'podium'); rk.forEach((r, i) => { const d = h('div', 'pl'); d.style.setProperty('--pc', r.col); d.style.animationDelay = (i * 90) + 'ms'; d.append(h('span', 'r', String(i + 1)), h('b', '', r.name), h('span', '', r.val)); pd.append(d); }); w.append(pd); }
    }
    medalNote(w);
    const row = h('div', 'arow');
    if (isHost() && S.g === 'ko') row.append(btn('Neste brett', 'go', () => dispatch({ t: 'nextboard' })));
    if (isHost()) row.append(btn('Spill igjen', S.g === 'ko' ? 'ghost' : 'go', () => dispatch({ t: 'again' })));
    row.append(btn('Velg annet spill', 'ghost', () => { if (S.on && isHost()) dispatch({ t: 'close' }); S = null; clearInterval(hostTimer); renderHub(); }));
    w.append(row);
  }
  const TROPHY = '<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset="1" stop-color="#c8951f"/></linearGradient></defs><path d="M18 8h28v10c0 10-6 18-14 18S18 28 18 18z" fill="url(#tg)"/><path d="M18 12H9c0 8 4 13 10 14M46 12h9c0 8-4 13-10 14" fill="none" stroke="#f7dd8f" stroke-width="3"/><rect x="28" y="36" width="8" height="10" fill="#c8951f"/><rect x="20" y="46" width="24" height="7" fill="url(#tg)"/></svg>';

  // ---------- Felles UI ----------
  function seg(items, cur, fn, dis) {
    const s = h('div', 'seg');
    items.forEach(([lbl, v]) => { const b = h('button', '', lbl); b.type = 'button'; b.setAttribute('aria-pressed', String(v === cur)); if (dis && dis(v)) b.disabled = true; b.onclick = () => { fx.tap(); fn(v); }; s.append(b); });
    return s;
  }
  function chipsMulti(items, sel, fn) {
    const c = h('div', 'chips2');
    items.forEach(([lbl, v]) => { const b = h('button', '', lbl); b.type = 'button'; b.setAttribute('aria-pressed', String(sel.includes(v))); b.onclick = () => { fx.tap(); fn(v); }; c.append(b); });
    return c;
  }
  function gameCard(e, opt) {
    const c = h('div', 'gc d' + e.d + (opt && opt.cls ? ' ' + opt.cls : ''));
    c.append(h('span', 'cat', TL_CATS[e.c] || ''));
    c.append(h('span', 'tx', e.t));
    if (opt && opt.year) c.append(h('span', 'yr', fmtY(e)));
    return c;
  }

  // ---------- Oppsett ----------
  function openSetup(g) {
    if (groupLocked() && !SOLO_OPEN.includes(g)) { fx.bad(); fx.toast(LOCK_TXT + '.'); return; }
    if (S && S.g === g && S.ph !== 'closed' && !(S.st && S.st.end) && (!S.on || roomLive(roomOf(S.sid)))) { openOverlay(); UI.key = null; render(); return; }
    if (S && !S.on) { S = null; clearInterval(hostTimer); }
    const prev = (mem.setup || {})[g] || {};
    setupState = { g, where: 'local', pl: prev.pl || [OPT.who && who() ? who() : 'Spiller 1'], cfg: Object.assign({}, GAMES[g].defaults(), prev.cfg || {}) };
    openOverlay(); renderSetup();
  }
  function renderSetup() {
    if (!view || !setupState) return;
    const st = setupState, g = GAMES[st.g];
    renderHeader(); setBack(() => { setupState = null; renderHub(); });
    const keepY = st._r ? view.body.scrollTop : 0; st._r = true;
    view.body.innerHTML = '';
    const w = h('div', 'ar-w'); view.body.append(w);
    const intro = h('div', 'panel'); intro.append(h('span', 'lbl', g.kicker), h('h3', '', g.name), h('p', 'fine', g.rules)); w.append(intro);
    const live = NET.remote && roomLive(NET.remote) && GAMES[NET.remote.g] ? NET.remote : null;
    if (live) { const mineR = S && S.on && S.sid === live.sid; const b = h('div', 'ah-live'); const t = h('div'); t.append(h('b', '', live.host === who() ? 'Rommet ditt er åpent' : live.host + ' har et rom åpent'), h('div', 'fine', GAMES[live.g].name + (live.ph === 'lobby' ? ' · venter på spillere' : ' · i gang'))); b.append(t, btn(mineR ? 'Tilbake' : 'Bli med', 'sm', () => { setupState = null; if (mineR) { UI.key = null; render(); } else joinRoom(); })); w.append(b); }
    if (g.onlineOnly) st.where = 'online';
    const lockedNow = groupLocked();
    if (lockedNow) { st.where = 'local'; st.pl = [who() || 'Meg']; w.append(h('p', 'fine lock-note', '🔒 ' + LOCK_TXT + '. Til da kan du spille alene.')); }
    if (g.noOnline || lockedNow) st.where = 'local';
    else {
      w.append(h('span', 'lbl', 'Hvor spiller dere?'));
      w.append(seg([['På én telefon', 'local'], ['Online sammen', 'online']], st.where, (v) => { st.where = v; renderSetup(); }, (v) => (v === 'online' && !NET.ok) || (v === 'local' && !!g.onlineOnly)));
      if (!NET.ok) w.append(h('p', 'fine', navigator.onLine === false ? 'Online krever nett. På én telefon virker alt uten nett.' : 'Online krever at du er logget inn på Claude (gratis konto). På én telefon virker alt uten.'));
    }
    if (st.where === 'local' && g.multi !== false && !lockedNow) {
      const p = h('div', 'panel'); p.append(h('span', 'lbl', 'Spillere eller lag'));
      const pre = h('div', 'chips2');
      const presets = [['Alene', [who() || 'Meg']], ['Gutta', (OPT.people || []).slice()], ['2 lag', ['Lag 1', 'Lag 2']], ['3 lag', ['Lag 1', 'Lag 2', 'Lag 3']]];
      presets.forEach(([n, arr]) => { if (!arr.length) return; const b = h('button', '', n); b.type = 'button'; b.onclick = () => { fx.tap(); st.pl = arr.slice(); renderSetup(); }; pre.append(b); });
      p.append(pre);
      st.pl.forEach((n, i) => {
        const r = h('div', 'prow'); const dot = h('i'); dot.style.background = COLS[i % COLS.length];
        const inp = h('input'); inp.value = n; inp.maxLength = 18; inp.setAttribute('aria-label', 'Navn ' + (i + 1)); inp.oninput = () => { st.pl[i] = inp.value; };
        const x = h('button', '', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Fjern'); x.onclick = () => { st.pl.splice(i, 1); if (!st.pl.length) st.pl = ['Spiller 1']; renderSetup(); };
        r.append(dot, inp, x); p.append(r);
      });
      if (st.pl.length < 8) p.append(btn('+ Legg til', 'sm ghost', () => { st.pl.push(st.pl.some((n) => /^Lag /.test(n)) ? 'Lag ' + (st.pl.length + 1) : 'Spiller ' + (st.pl.length + 1)); renderSetup(); }));
      p.append(h('p', 'fine', st.pl.length === 1 ? g.solo : 'Dere sender telefonen rundt. Spiller dere på lag, skriv lagnavnene.'));
      w.append(p);
    }
    if (st.where === 'online') {
      if (!who()) namePick(w);
      else { const p = h('div', 'panel'); p.append(h('span', 'lbl', 'Online'), h('p', 'fine', 'Du starter et rom som ' + who() + '. De andre blir med fra sin egen telefon, og dere ser samme spillebrett. Lag velger du i rommet.')); w.append(p); }
    }
    const op = h('div', 'panel'); op.append(h('span', 'lbl', 'Innstillinger'));
    g.options(st.cfg, op, () => renderSetup(), st);
    if (op.children.length > 1) w.append(op);
    const go = btn(st.where === 'online' ? 'Start rom' : 'Start spillet', 'go big', () => {
      const all = mem.setup || {}; all[st.g] = { pl: st.pl, cfg: st.cfg }; memSet('setup', all);
      const cfg = clone(st.cfg);
      if (st.where === 'online') {
        if (!who()) return;
        const startIt = () => { setupState = null; fx.good(); createRoom(st.g, cfg); };
        startIt();
      } else {
        const names = (g.multi === false ? [who() || 'Meg'] : st.pl).map((n, i) => String(n || '').trim() || ('Spiller ' + (i + 1)));
        const pl = names.map((n, i) => ({ id: 'p' + i, name: n, col: COLS[i % COLS.length] }));
        setupState = null; fx.good(); startLocal(st.g, pl, cfg);
      }
    });
    if (st.where === 'online' && !who()) go.disabled = true;
    if (st.where === 'local' && g.minP && g.multi !== false && st.pl.length < g.minP && !lockedNow) { go.disabled = true; w.append(h('p', 'fine', 'Legg til minst ' + g.minP + ' spillere for å starte.')); }
    w.append(go);
    view.body.scrollTop = keepY;
  }
  function catEraOptions(cfg, el, re) {
    el.append(h('span', 'lbl', 'Hendelser'));
    el.append(seg([['Kjente', 'known'], ['Alle, også de nerdete', 'all']], cfg.lvl === 'all' ? 'all' : 'known', (v) => { cfg.lvl = v; re(); }));
    el.append(h('span', 'lbl', 'Kategorier'));
    el.append(chipsMulti(Object.entries(TL_CATS).map(([k, v]) => [v, k]), cfg.cats, (v) => { const s = new Set(cfg.cats); s.has(v) ? s.delete(v) : s.add(v); if (!s.size) return; cfg.cats = [...s]; re(); }));
    el.append(h('span', 'lbl', 'Tidsperioder'));
    el.append(chipsMulti(Object.entries(TL_ERAS).map(([k, v]) => [v.n, k]), cfg.eras, (v) => { const s = new Set(cfg.eras); s.has(v) ? s.delete(v) : s.add(v); if (!s.size) return; cfg.eras = [...s]; re(); }));
    const n = tlPool(cfg).length; el.append(h('p', 'fine', n + ' hendelser i utvalget' + (n < 40 ? ' – velg flere for mer variasjon' : '')));
  }

  // ---------- Hendelsesutvalg ----------
  function tlPool(cfg) { const mx = cfg.lvl === 'all' ? 3 : 2; return EV.filter((e) => e.d <= mx && cfg.cats.includes(e.c) && cfg.eras.some((k) => e.y >= TL_ERAS[k].a && e.y <= TL_ERAS[k].b)).map((e) => e.i); }
  function seenGet() { return new Set(mem.seen || []); }
  function seenAdd(i) { const s = mem.seen || []; s.push(i); if (s.length > EV.length * .8) s.splice(0, Math.floor(s.length / 2)); memSet('seen', s); }
  function drawEvent(st, cfg, avoidYears) {
    const pool = tlPool(cfg).filter((i) => !st.used.includes(i));
    const src = pool.length ? pool : tlPool(cfg);
    if (!pool.length) st.used = [];
    const seen = seenGet(); const yrs = new Set(avoidYears || []);
    const score = (i) => (yrs.has(EV[i].y) ? (Math.random() < .35 ? 0 : 2) : 0) + (seen.has(i) ? 1 : 0);
    let best = 9, cand = [];
    src.forEach((i) => { const s = score(i); if (s < best) { best = s; cand = [i]; } else if (s === best) cand.push(i); });
    const pick = cand[rnd(cand.length)];
    st.used.push(pick); seenAdd(pick); return pick;
  }

  // ============ TIDSLINJEN ============
  const TL = {
    name: 'Tidslinjen', kicker: 'Hendelser i tid', glow: '#3a2a12',
    rules: 'Dra hendelsen inn på riktig plass i tidslinjen. Spiller dere flere, bygger alle på samme felles tidslinje: riktig plassering gir poeng, og bommer du, havner kortet likevel på riktig plass. Skjedde to ting samme år, er begge plassene riktige. Først til målet vinner. Gjett eksakt år for en joker, og bruk jokeren til å bytte et kort du ikke kan.',
    solo: 'Alene spiller du til du har brukt opp tre liv. Hvert tiende riktige gir et ekstra liv.',
    defaults: () => ({ cats: Object.keys(TL_CATS).filter((k) => k !== 'isl'), eras: Object.keys(TL_ERAS), target: 8, bonus: true }),
    options(cfg, el, re, st) {
      catEraOptions(cfg, el, re);
      if (!st || st.where === 'online' || st.pl.length > 1) { el.append(h('span', 'lbl', 'Spillebrett')); el.append(seg([['Felles tidslinje', true], ['Hver sin', false]], cfg.shared !== false, (v) => { cfg.shared = v; re(); })); el.append(h('span', 'lbl', cfg.shared !== false ? 'Riktige for å vinne' : 'Kort for å vinne')); el.append(seg([['6', 6], ['8', 8], ['10', 10], ['12', 12], ['∞', 0]], cfg.target, (v) => { cfg.target = v; re(); })); if (!cfg.target) el.append(h('p', 'fine', 'Ingen fast slutt. Trykk «Avslutt og se stillingen» når dere vil.')); }
      el.append(h('span', 'lbl', 'Bonus for eksakt årstall')); el.append(seg([['På', true], ['Av', false]], cfg.bonus, (v) => { cfg.bonus = v; re(); }));
    },
    init(S) {
      const solo = S.pl.length === 1;
      const st = { used: [], lines: {}, jok: {}, pts: {}, turn: 0, ph: 'place', cur: null, last: null, solo, lives: solo ? 3 : 0, sc: 0, streak: 0, shared: !solo && S.cfg.shared !== false };
      const base = anchorFor(S.cfg);
      if (st.shared) st.lines._ = [base];
      S.pl.forEach((p) => { if (!st.shared) st.lines[p.id] = [base]; st.jok[p.id] = 1; st.pts[p.id] = 0; });
      const p0 = S.pl[0].id; st.cur = drawEvent(st, S.cfg, tlLine(st, p0).map((i) => EV[i].y));
      return st;
    },
    act(S, a, by) {
      const st = S.st, pid = S.pl[st.turn].id;
      if (a.t === 'place' && st.ph === 'place' && canBy(pid, by)) {
        const line = tlLine(st, pid), e = EV[st.cur];
        const pos = Math.max(0, Math.min(line.length, Number(a.pos) | 0));
        const ok = (pos === 0 || EV[line[pos - 1]].y <= e.y) && (pos === line.length || e.y <= EV[line[pos]].y);
        let corr = 0; while (corr < line.length && EV[line[corr]].y < e.y) corr++;
        const g = a.g == null || a.g === '' ? null : Number(a.g);
        const bonus = !!(S.cfg.bonus && ok && g != null && g === e.y);
        if (ok) { line.splice(pos, 0, st.cur); if (bonus) st.jok[pid]++; if (st.shared) st.pts[pid]++; if (st.solo) { st.sc++; st.streak++; if (st.sc % 10 === 0 && st.lives < 5) st.lives++; } }
        else if (st.solo) { st.lives--; st.streak = 0; }
        else if (st.shared) st.pend = { e: st.cur, pos: corr };
        st.last = { pid, e: st.cur, ok, pos: ok ? pos : corr, g, bonus };
        st.ph = 'res';
        if (ok && !st.solo && S.cfg.target && (st.shared ? st.pts[pid] : line.length) >= S.cfg.target) st.fin = { win: pid };
        if (st.solo && st.lives <= 0) { st.fin = { solo: true }; if (st.sc > (mem.tlBest || 0)) memSet('tlBest', st.sc); }
        return true;
      }
      if (a.t === 'swap' && st.ph === 'place' && canBy(pid, by) && st.jok[pid] > 0) {
        st.jok[pid]--; st.cur = drawEvent(st, S.cfg, tlLine(st, pid).map((i) => EV[i].y)); return true;
      }
      if (a.t === 'next' && st.ph === 'res' && (canBy(pid, by) || by === S.host || !S.on)) {
        if (st.fin) { st.end = st.fin; return true; }
        st.n = (st.n || 0) + 1;
        if (st.pend) { st.lines._.splice(st.pend.pos, 0, st.pend.e); st.pend = null; }
        st.turn = st.solo ? 0 : (st.turn + 1) % S.pl.length;
        const np = S.pl[st.turn].id; st.cur = drawEvent(st, S.cfg, tlLine(st, np).map((i) => EV[i].y)); st.ph = 'place'; st.last = null;
        return true;
      }
      return false;
    },
    key(S) { const st = S.st; return [st.ph, st.n || 0, st.turn, st.cur, st.last ? st.last.e : '', st.jok[S.pl[st.turn].id]].join(':'); },
    view(S, c, w) {
      const st = S.st, p = S.pl[st.turn], pid = p.id, line = tlLine(st, pid), e = EV[st.cur];
      const mine = c.can(pid);
      if (st.ph === 'place' && !st.shared && handoff(w, pid, 'tl' + (st.n || 0), 'Din tur i Tidslinjen')) return;
      if (st.solo) {
        const r = h('div', 'arow'); r.style.justifyContent = 'space-between';
        const lv = h('span', 'lives', '♥'.repeat(Math.max(0, st.lives)) + '♡'.repeat(Math.max(0, 3 - st.lives)));
        r.append(lv, h('span', 'lbl', 'Riktige: ' + st.sc + ' · Rekord: ' + Math.max(mem.tlBest || 0, st.sc)));
        w.append(r);
      } else if (st.shared) { scoreboard(w, pid, (q) => [S.cfg.target ? st.pts[q.id] + '/' + S.cfg.target : st.pts[q.id] + ' p', '🃏 ' + st.jok[q.id]]); w.append(h('span', 'lbl', 'Felles tidslinje · ' + p.name + ' sin tur')); }
      else scoreboard(w, pid, (q) => [S.cfg.target ? st.lines[q.id].length + '/' + S.cfg.target : st.lines[q.id].length + ' kort', '🃏 ' + st.jok[q.id]]);
      const lay = h('div', 'tl-lay'); const cardBox = h('div', 'tl-cardbox'); const tlBox = h('div', 'tl-box'); const ctrl = h('div', 'tl-ctrl');
      lay.append(cardBox, tlBox, ctrl); w.append(lay);
      const bar = h('div', 'tl-bar'); const cap = h('span', 'tl-cap', ''); UI.capEl = cap;
      const zm = h('div', 'tl-zoom');
      const zb = (lbl, d, title) => { const b = h('button', '', lbl); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title); b.onclick = () => { UI.zoom = Math.max(0, Math.min(2, (UI.zoom || 0) + d)); fx.tap(); refit(); zm.querySelector('.zl').textContent = ZOOMS[UI.zoom || 0]; }; return b; };
      zm.append(zb('−', -1, 'Zoom ut'), h('span', 'zl', ZOOMS[UI.zoom || 0]), zb('+', 1, 'Zoom inn'));
      bar.append(cap, zm); tlBox.append(bar);
      const wrap = h('div', 'tlh-wrap'); const strip = h('div', 'tlh'); wrap.append(strip); tlBox.append(wrap);
      UI.strip = strip; UI.line = line;
      if (line.length >= 5) tlBox.append(h('div', 'tl-rot', 'Snu telefonen for en bredere tidslinje · trykk på et kort for å forstørre'));
      else tlBox.append(h('div', 'tl-rot tl-rot-any', 'Trykk på et kort for å forstørre det'));
      if (st.ph === 'place') {
        if (UI.posFor !== st.cur) { UI.posFor = st.cur; UI.pos = Math.round(line.length / 2); UI.guess = ''; UI.hover = UI.pos; }
        const card = gameCard(e, { cls: 'pop' }); const bd = h('span', 'badge', '?'); card.append(bd); cardBox.append(card);
        if (!mine) cardBox.append(h('div', 'watch', p.name + ' plasserer kortet …'));
        const gp = mine ? UI.pos : (UI.hover == null ? UI.pos : UI.hover);
        buildStrip(strip, line, { ghost: gp, interactive: mine }); cap.textContent = capText(line, gp);
        if (mine) {
          const r = h('div', 'arow');
          r.append(btn('◀', '', () => { if (UI.pos > 0) { UI.pos--; fx.tap(); rebuild(); } }), btn('▶', '', () => { if (UI.pos < line.length) { UI.pos++; fx.tap(); rebuild(); } }));
          const place = btn('Plasser', 'go', () => { fx.whoosh(); dispatch({ t: 'place', pos: UI.pos, g: S.cfg.bonus ? parseN(UI.guess) : null }); });
          place.style.flex = '3 1 auto'; r.append(place); ctrl.append(r);
          const opt = h('div', 'arow');
          if (S.cfg.bonus) { const gi = h('input', 'ain'); gi.inputMode = 'numeric'; gi.placeholder = 'Årstall for bonus (valgfritt)'; gi.value = UI.guess || ''; gi.style.fontSize = '16px'; gi.style.padding = '11px'; gi.style.flex = '2 1 140px'; gi.oninput = () => { UI.guess = gi.value; }; opt.append(gi); }
          const jb = btn('🃏 Bytt (' + st.jok[pid] + ')', 'ghost', () => { fx.whoosh(); dispatch({ t: 'swap' }); }); jb.disabled = !(st.jok[pid] > 0); jb.title = 'Bruk en joker til å bytte kortet'; opt.append(jb);
          ctrl.append(opt);
          if (S.cfg.bonus) ctrl.append(h('p', 'fine', 'Gjett eksakt år for en joker. F.Kr. skrives negativt, for eksempel -44.'));
        }
      } else {
        const L2 = st.last, ev = EV[L2.e];
        const card = gameCard(ev, { year: true, cls: L2.ok ? 'ok' : 'bad' }); cardBox.append(card);
        const res = h('div', 'res ' + (L2.ok ? 'okr' : 'badr'));
        res.append(h('b', '', L2.ok ? (L2.bonus ? 'Eksakt år!' : 'Riktig!') : 'Feil'));
        res.append(h('span', '', L2.ok ? (L2.bonus ? 'Joker vunnet. ' : '') + (st.shared ? p.name + ' får et poeng' : '') + (st.solo && st.streak >= 3 ? st.streak + ' på rad' : '') : 'Det skjedde i ' + fmtY(ev) + (st.shared ? '. Kortet legges inn på riktig plass.' : '')));
        { const twin = line.filter((x) => x !== L2.e && EV[x].y === ev.y && !EV[x].anchor); if (twin.length) res.append(h('span', 'tl-twin', 'Samme år som «' + EV[twin[0]].t + '». Begge plassene er riktige.')); }
        ctrl.append(res);
        buildStrip(strip, line, L2.ok ? { newE: L2.e } : { miss: { pos: L2.pos, e: L2.e } });
        cap.textContent = line.length + ' kort i ' + (st.shared ? 'den felles tidslinjen' : 'tidslinjen' + (st.solo ? '' : ' til ' + p.name));
        if (UI.fxDone !== st.turn + ':' + L2.e) { UI.fxDone = st.turn + ':' + L2.e; if (L2.ok) { fx.good(); if (L2.bonus) { fx.bonus(); } if (st.solo && st.streak && st.streak % 5 === 0) { L('gold'); fx.toast(st.streak + ' på rad!'); } } else fx.bad(); }
        if (mine || c.host) ctrl.append(btn(st.fin ? 'Se resultatet' : 'Neste', 'go big', () => dispatch({ t: 'next' })));
        else ctrl.append(h('div', 'watch', 'Venter på ' + p.name));
      }
    },
    rank(S) {
      const st = S.st;
      if (st.solo) return [{ id: S.pl[0].id, name: S.pl[0].name, col: S.pl[0].col, val: st.sc + ' riktige', sub: 'Rekord: ' + Math.max(mem.tlBest || 0, st.sc) }];
      if (st.shared) return S.pl.map((p) => ({ id: p.id, name: p.name, col: p.col, val: st.pts[p.id] + ' riktige', n: st.pts[p.id] })).sort((a, b) => b.n - a.n);
      return S.pl.map((p) => ({ id: p.id, name: p.name, col: p.col, val: st.lines[p.id].length + ' kort', n: st.lines[p.id].length })).sort((a, b) => (b.id === (st.end || {}).win) - (a.id === (st.end || {}).win) || b.n - a.n);
    }
  };

  const tlLine = (st, pid) => st.shared ? st.lines._ : st.lines[pid];
  const ZOOMS = ['Hele', 'Middels', 'Stor'];
  function capText(line, pos) {
    if (!line.length) return '';
    if (pos <= 0) return 'Før ' + fmtY(EV[line[0]]);
    if (pos >= line.length) return 'Etter ' + fmtY(EV[line[line.length - 1]]);
    return 'Mellom ' + fmtY(EV[line[pos - 1]]) + ' og ' + fmtY(EV[line[pos]]);
  }
  function rebuild() { if (!S || !UI.strip || !UI.strip.isConnected || S.g !== 'tl' || S.st.ph !== 'place') return; const st = S.st; const line = tlLine(st, S.pl[st.turn].id); buildStrip(UI.strip, line, { ghost: UI.pos, interactive: true }); if (UI.capEl) UI.capEl.textContent = capText(line, UI.pos); sendHover(); }
  let hoverT = 0;
  function sendHover() { if (!S || !S.on) return; const now = Date.now(); if (now - hoverT < 120) { clearTimeout(sendHover.t); sendHover.t = setTimeout(sendHover, 130); return; } hoverT = now; emit({ sid: S.sid, a: { t: 'hover', pos: UI.pos }, by: who() }); }
  function patchHover() {
    if (!S || S.g !== 'tl' || !UI.strip || !UI.strip.isConnected) return;
    const st = S.st; if (st.ph !== 'place') return; const pid = S.pl[st.turn].id; if (can(pid)) return;
    buildStrip(UI.strip, tlLine(st, pid), { ghost: UI.hover, interactive: false }); if (UI.capEl) UI.capEl.textContent = capText(tlLine(st, pid), UI.hover);
  }
  function tlCard(e, cls) {
    if (e.anchor) { const c = h('div', 'tl-c anchor' + (cls ? ' ' + cls : '')); const yt = fmtY(e); c.append(h('span', 'y' + (yt.length > 5 ? ' lg' : ''), yt), h('span', 's', 'Startår')); c.setAttribute('aria-label', 'Startår ' + yt); return c; }
    const c = h('div', 'tl-c d' + e.d + (cls ? ' ' + cls : '')); const yt = fmtY(e);
    c.append(h('span', 'y' + (yt.length > 9 ? ' xl' : yt.length > 5 ? ' lg' : ''), yt), h('span', 's', e.t));
    c.dataset.ev = String(e.i); c.setAttribute('role', 'button'); c.tabIndex = 0; c.setAttribute('aria-label', yt + ': ' + e.t + '. Trykk for å forstørre');
    c.addEventListener('click', () => magnify(e)); c.addEventListener('keydown', (k) => { if (k.key === 'Enter') magnify(e); });
    return c;
  }
  function magnify(e) {
    if (!view) return; fx.sel();
    const m = h('div', 'tl-mag'); const card = gameCard(e, { year: true, cls: 'pop' }); m.append(card, h('div', 'tl-hint', 'Trykk for å lukke'));
    m.addEventListener('click', () => m.remove()); view.el.append(m);
  }
  function refit() { if (UI.strip && UI.strip.isConnected) layoutTl(UI.strip, true); }
  addEventListener('resize', () => { clearTimeout(refit.t); refit.t = setTimeout(refit, 120); });
  // Horisontal tidslinje: én linje bortover, boksene annenhver over og under, festet med en strek ned til linjen
  function buildStrip(strip, line, o) {
    strip.innerHTML = '';
    const inner = h('div', 'tlh-in'); const axis = h('div', 'tlh-axis'); inner.append(axis); strip.append(inner);
    const n = line.length; const gpos = o.ghost == null ? null : Math.max(0, Math.min(n, o.ghost));
    const add = (box, kind) => { const it = h('div', 'tlh-it' + (kind ? ' ' + kind : '')); it.append(h('i', 'tlh-dot'), h('i', 'tlh-stem'), box); inner.append(it); return it; };
    let ghostIt = null;
    for (let i = 0; i <= n; i++) {
      if (gpos === i) { const g = h('div', 'tl-ghost' + (o.interactive ? '' : ' ro')); g.append(h('b', '', '?'), h('span', '', o.interactive ? 'Dra' : '…')); ghostIt = add(g, 'gh'); }
      else if (o.miss && o.miss.pos === i) { const m = add(tlCard(EV[o.miss.e], 'miss'), 'ms'); setTimeout(() => m.classList.add('out'), 2400); }
      if (i < n) { const it = add(tlCard(EV[line[i]], line[i] === o.newE ? 'new' : ''), 'cd'); it.dataset.i = String(i); }
    }
    layoutTl(strip, false);
    requestAnimationFrame(() => layoutTl(strip, false));
    if (ghostIt && o.interactive) dragGhost(strip, ghostIt);
  }
  function layoutTl(strip, keep) {
    const inner = strip.querySelector('.tlh-in'); if (!inner) return;
    const items = [...inner.querySelectorAll('.tlh-it')].filter((it) => !it.classList.contains('gone'));
    const k = Math.max(1, items.length), z = UI.zoom || 0;
    const avail = Math.max(240, strip.clientWidth - 8);
    const cap = z === 0 ? 100 : z === 1 ? 118 : 164;
    let sp = z === 0 ? (avail + 8) / (k + 1) : (z === 1 ? 64 : 92);
    const bw = Math.round(Math.max(42, Math.min(cap, sp * 2 - 10)));
    if (z === 0 && bw >= cap) sp = Math.min((avail - bw) / Math.max(1, k - 1), bw * .62);
    const size = bw < 60 ? 'xs' : bw < 90 ? 'sm' : z === 2 ? 'lg' : 'md';
    const bh = { xs: 32, sm: 54, md: 64, lg: 108 }[size], stem = size === 'lg' ? 16 : 11, ax = 10;
    const W = Math.ceil(bw + sp * (k - 1)) + 2;
    inner.style.width = W + 'px';
    inner.style.height = (2 * (bh + stem) + ax) + 'px';
    strip.dataset.size = size;
    strip.style.setProperty('--bw', bw + 'px'); strip.style.setProperty('--bh', bh + 'px'); strip.style.setProperty('--st', stem + 'px');
    const axisY = bh + stem + ax / 2;
    inner.style.setProperty('--ay', axisY + 'px');
    items.forEach((it, i) => { it.classList.toggle('up', i % 2 === 0); it.classList.toggle('dn', i % 2 === 1); it.style.left = (bw / 2 + 1 + sp * i) + 'px'; });
    if (z !== 0 && !keep) { const f = inner.querySelector('.tlh-it.gh, .tlh-it.ms, .tlh-it .new'); const el = f ? f.closest('.tlh-it') : null; if (el) { strip.style.scrollBehavior = 'auto'; strip.scrollLeft = parseFloat(el.style.left) - strip.clientWidth / 2; strip.style.scrollBehavior = ''; } }
  }
  function dragGhost(strip, it) {
    const g = it.querySelector('.tl-ghost'); let on = false, x = 0, raf = 0;
    const inner = strip.querySelector('.tlh-in');
    const loop = () => { if (!on || !it.isConnected || S.st.ph !== 'place') { on = false; return; } const r = strip.getBoundingClientRect(); if ((UI.zoom || 0) !== 0) { if (x < r.left + 36) strip.scrollLeft -= 8; else if (x > r.right - 36) strip.scrollLeft += 8; } place(); raf = requestAnimationFrame(loop); };
    const place = () => {
      if (!it.isConnected || !S || S.st.ph !== 'place') return;
      const cards = [...inner.querySelectorAll('.tlh-it.cd')];
      let idx = 0; cards.forEach((c) => { const r = c.getBoundingClientRect(); if (r.left + r.width / 2 < x) idx++; });
      if (idx !== UI.pos) { UI.pos = idx; fx.tap(); if (idx >= cards.length) inner.append(it); else inner.insertBefore(it, cards[idx]); layoutTl(strip, true); if (UI.capEl && UI.line) UI.capEl.textContent = capText(UI.line, idx); sendHover(); }
    };
    g.addEventListener('pointerdown', (e) => { e.preventDefault(); on = true; x = e.clientX; it.classList.add('drag'); try { g.setPointerCapture(e.pointerId); } catch (er) {} raf = requestAnimationFrame(loop); });
    g.addEventListener('pointermove', (e) => { if (on) x = e.clientX; });
    const up = () => { if (!on) return; on = false; cancelAnimationFrame(raf); it.classList.remove('drag'); rebuild(); };
    g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
    // Trykk eller dra langs selve linjen flytter også kortet
    strip.onpointerdown = (e) => { if (e.target.closest('.tl-c') || e.target.closest('.tl-ghost')) return; const r = inner.getBoundingClientRect(); const ay = r.top + parseFloat(getComputedStyle(inner).getPropertyValue('--ay')); if (Math.abs(e.clientY - ay) > 40) return; x = e.clientX; place(); rebuild(); };
  }

  // ============ FØRST! ============
  const GAPS = [250, 120, 60, 30, 16, 8, 4, 2, 1, 1, 0];
  function yearGroups(pool) { const m = {}; pool.forEach((i) => { (m[EV[i].y] = m[EV[i].y] || []).push(i); }); return Object.values(m).filter((a) => a.length > 1); }
  function makePair(st, cfg, level) {
    const pool = tlPool(cfg).filter((i) => !st.used.includes(i));
    if (pool.length < 6) st.used = [];
    const P = pool.length >= 6 ? pool : tlPool(cfg);
    const gmin = GAPS[Math.min(level, GAPS.length - 1)];
    if (level >= 3 && Math.random() < .14) { const grp = yearGroups(P); if (grp.length) { const g = shuffle(grp[rnd(grp.length)]); st.used.push(g[0], g[1]); return [g[0], g[1]]; } }
    for (let tries = 0; tries < 60; tries++) {
      const a = P[rnd(P.length)];
      const cand = P.filter((b) => b !== a && Math.abs(EV[b].y - EV[a].y) >= Math.max(1, gmin) && Math.abs(EV[b].y - EV[a].y) <= Math.max(gmin * 3, 3));
      if (cand.length) { const b = cand[rnd(cand.length)]; st.used.push(a, b); return Math.random() < .5 ? [a, b] : [b, a]; }
    }
    const a = P[rnd(P.length)]; let b = P[rnd(P.length)]; let k = 0; while ((b === a || EV[b].y === EV[a].y) && k++ < 50) b = P[rnd(P.length)];
    st.used.push(a, b); return [a, b];
  }
  const FO = {
    name: 'Først!', kicker: 'Hva skjedde først?', glow: '#123a2a',
    rules: 'To hendelser. Trykk på den som skjedde først, eller «Samme år» hvis de skjedde samme år. Det blir vanskeligere for hver runde. Raskeste riktige svar får et ekstrapoeng.',
    solo: 'Alene spiller du til første feil. Hvor langt kommer du?',
    defaults: () => ({ cats: Object.keys(TL_CATS).filter((k) => k !== 'isl'), eras: Object.keys(TL_ERAS), rounds: 10, timer: 15 }),
    options(cfg, el, re, st) {
      catEraOptions(cfg, el, re);
      if (!st || st.where === 'online' || st.pl.length > 1) { el.append(h('span', 'lbl', 'Runder')); el.append(seg([['5', 5], ['10', 10], ['15', 15], ['∞', 0]], cfg.rounds, (v) => { cfg.rounds = v; re(); })); }
      el.append(h('span', 'lbl', 'Tidspress')); el.append(seg([['Av', 0], ['10 s', 10], ['15 s', 15], ['25 s', 25]], cfg.timer, (v) => { cfg.timer = v; re(); }));
    },
    init(S) {
      const solo = S.pl.length === 1;
      const st = { used: [], round: 0, solo, ph: 'ask', ans: {}, sc: {}, t0: Date.now() };
      S.pl.forEach((p) => { st.sc[p.id] = 0; });
      st.pair = makePair(st, S.cfg, 0); return st;
    },
    act(S, a, by) {
      const st = S.st;
      if (a.t === 'ans' && st.ph === 'ask') {
        const pid = a.pid; if (!S.pl.some((p) => p.id === pid) || !canBy(pid, by) || st.ans[pid]) return false;
        st.ans[pid] = { p: ['a', 'b', 's'].includes(a.p) ? a.p : null, ms: Math.max(0, Math.min(120000, Number(a.ms) || 0)) };
        if (S.pl.every((p) => st.ans[p.id])) FO.reveal(S);
        return true;
      }
      if (a.t === 'reveal' && st.ph === 'ask' && (by === S.host || !S.on)) { S.pl.forEach((p) => { if (!st.ans[p.id]) st.ans[p.id] = { p: null, ms: 0 }; }); FO.reveal(S); return true; }
      if (a.t === 'next' && st.ph === 'rev' && (by === S.host || !S.on)) {
        if (st.over) { st.end = {}; return true; }
        st.round++; st.ph = 'ask'; st.ans = {}; st.t0 = Date.now(); st.pair = makePair(st, S.cfg, st.round); return true;
      }
      return false;
    },
    reveal(S) {
      const st = S.st, [A, B] = st.pair, ya = EV[A].y, yb = EV[B].y;
      const c = ya < yb ? 'a' : ya > yb ? 'b' : 's'; st.corr = c; st.ph = 'rev';
      const right = S.pl.filter((p) => st.ans[p.id] && st.ans[p.id].p === c);
      right.forEach((p) => { st.sc[p.id]++; });
      st.fast = null;
      if (S.pl.length > 1 && right.length > 1) { const f = right.slice().sort((x, y) => st.ans[x.id].ms - st.ans[y.id].ms)[0]; st.sc[f.id]++; st.fast = f.id; }
      if (st.solo) { if (!right.length) { st.over = true; const s = st.sc[S.pl[0].id]; if (s > (mem.foBest || 0)) memSet('foBest', s); } }
      else if (S.cfg.rounds && st.round + 1 >= S.cfg.rounds) st.over = true;
    },
    tick(S) {
      const st = S.st; if (!S.on || st.ph !== 'ask' || !S.cfg.timer) return false;
      if (Date.now() > st.t0 + S.cfg.timer * 1000 + 1200) { S.pl.forEach((p) => { if (!st.ans[p.id]) st.ans[p.id] = { p: null, ms: 0 }; }); FO.reveal(S); return true; }
      return false;
    },
    key(S) { const st = S.st; return [st.ph, st.round, S.on ? '' : Object.keys(st.ans).length].join(':'); },
    patch(S, c, body) {
      const st = S.st; const l = body.querySelector('.ansl'); if (!l) return;
      l.querySelectorAll('span').forEach((s) => { s.classList.toggle('done', !!st.ans[s.dataset.p]); });
    },
    clock(S, body) {
      const bar = body.querySelector('.timer i'); if (!bar || !S.cfg.timer) return;
      const t0 = S.on ? S.st.t0 : (UI.t0 || Date.now());
      const left = Math.max(0, 1 - (Date.now() - t0) / (S.cfg.timer * 1000));
      bar.style.transform = 'scaleX(' + left + ')';
      if (left <= 0 && !S.on && UI.foPid && !UI.foSent) { UI.foSent = true; dispatch({ t: 'ans', pid: UI.foPid, p: null, ms: S.cfg.timer * 1000 }); }
    },
    view(S, c, w) {
      const st = S.st, [A, B] = st.pair;
      if (st.solo) { const sk = h('div', 'streak'); sk.append(h('b', '', String(st.sc[S.pl[0].id])), h('span', '', 'PÅ RAD · REKORD ' + Math.max(mem.foBest || 0, st.sc[S.pl[0].id]))); w.append(sk); }
      else { w.append(h('span', 'lbl', 'Runde ' + (st.round + 1) + (S.cfg.rounds ? ' av ' + S.cfg.rounds : ''))); scoreboard(w, null, (p) => [String(st.sc[p.id]), '']); }
      let me = null;
      if (st.ph === 'ask') {
        if (!S.on) { const nxt = S.pl.find((p) => !st.ans[p.id]); me = nxt ? nxt.id : null; if (me && handoff(w, me, 'fo' + st.round + ':' + me, 'Din tur i Først!')) return; }
        else me = c.mine.find((pid) => !st.ans[pid]) || null;
        if (UI.foKey !== st.round + ':' + me) { UI.foKey = st.round + ':' + me; UI.t0 = Date.now(); UI.foSent = false; }
        UI.foPid = me;
      }
      if (S.cfg.timer && st.ph === 'ask') { const t = h('div', 'timer'); t.append(h('i')); w.append(t); }
      const vs = h('div', 'vs');
      const mk = (idx, k) => {
        const e = EV[idx]; const b = h('button', 'gc d' + e.d + ' pop'); b.type = 'button';
        b.append(h('span', 'cat', TL_CATS[e.c]), h('span', 'tx', e.t));
        if (st.ph === 'rev') { b.append(h('span', 'yr', fmtY(e))); b.disabled = true; if (st.corr === k) b.classList.add('win'); else if (st.corr !== 's') b.classList.add('lose'); const who2 = S.pl.filter((p) => st.ans[p.id] && st.ans[p.id].p === k).map((p) => p.name); if (who2.length && S.pl.length > 1) { b.classList.add('pick'); b.dataset.who = who2.join(', '); } }
        else if (me) b.onclick = () => { fx.sel(); dispatch({ t: 'ans', pid: me, p: k, ms: Date.now() - UI.t0 }); };
        else b.disabled = true;
        return b;
      };
      const mid = h('div', 'mid');
      const same = btn('Samme år', 'sm ghost'); if (st.ph === 'ask' && me) same.onclick = () => { fx.sel(); dispatch({ t: 'ans', pid: me, p: 's', ms: Date.now() - UI.t0 }); }; else same.disabled = true;
      if (st.ph === 'rev' && st.corr === 's') { same.classList.remove('ghost'); same.classList.add('go'); }
      mid.append(h('span', 'vsb', 'VS'), same);
      vs.append(mk(A, 'a'), mid, mk(B, 'b')); w.append(vs);
      if (st.ph === 'ask') {
        if (S.on) {
          if (!me) watchLine(w, myPids().length ? 'Svar låst. Venter på de andre …' : 'Du ser på');
          const l = h('div', 'ansl'); S.pl.forEach((p) => { const s = h('span', st.ans[p.id] ? 'done' : '', p.name); s.dataset.p = p.id; l.append(s); }); w.append(l);
          if (c.host) w.append(btn('Avslør nå', 'ghost', () => dispatch({ t: 'reveal' })));
        } else if (me && S.pl.length > 1) w.append(h('div', 'tl-hint', pname(me) + ' svarer'));
      } else {
        if (UI.fxR !== st.round) { UI.fxR = st.round; const mineRight = (S.on ? c.mine : S.pl.map((p) => p.id)).some((pid) => st.ans[pid] && st.ans[pid].p === st.corr); fx.reveal(); setTimeout(() => (mineRight || (!S.on && S.pl.length > 1) ? fx.good() : fx.bad()), 120); }
        const res = h('div', 'res'); const right = S.pl.filter((p) => st.ans[p.id] && st.ans[p.id].p === st.corr);
        if (st.solo) { res.className = 'res ' + (right.length ? 'okr' : 'badr'); res.append(h('b', '', right.length ? 'Riktig!' : 'Feil')); res.append(h('span', '', st.corr === 's' ? 'De skjedde samme år' : 'Forskjell: ' + Math.abs(EV[A].y - EV[B].y) + ' år')); }
        else { res.append(h('b', '', st.corr === 's' ? 'Samme år!' : (right.length ? right.length + ' av ' + S.pl.length + ' riktig' : 'Ingen hadde rett'))); res.append(h('span', '', st.fast ? 'Raskest: ' + pname(st.fast) + ' (+1)' : 'Forskjell: ' + Math.abs(EV[A].y - EV[B].y) + ' år')); }
        w.append(res);
        if (c.host) w.append(btn(st.over ? 'Se resultatet' : 'Neste', 'go big', () => dispatch({ t: 'next' }))); else watchLine(w, 'Venter på ' + S.host);
      }
    },
    rank(S) {
      const st = S.st;
      if (st.solo) { const s = st.sc[S.pl[0].id]; return [{ id: S.pl[0].id, name: S.pl[0].name, col: S.pl[0].col, val: s + ' på rad', sub: 'Rekord: ' + Math.max(mem.foBest || 0, s) }]; }
      return S.pl.map((p) => ({ id: p.id, name: p.name, col: p.col, val: st.sc[p.id] + ' p', n: st.sc[p.id] })).sort((a, b) => b.n - a.n);
    }
  };

  // ============ ANSLAGET ============
  function estPick(n) { const seen = new Set(mem.estSeen || []); let ids = EST.map((_, i) => i); let fresh = shuffle(ids.filter((i) => !seen.has(i))); if (fresh.length < n) { memSet('estSeen', []); fresh = fresh.concat(shuffle(ids.filter((i) => !fresh.includes(i)))); } const out = fresh.slice(0, n); memSet('estSeen', [...(mem.estSeen || []), ...out]); return out; }
  const logErr = (v, a) => (v > 0 && a > 0) ? Math.abs(Math.log10(v / a)) : 9;
  const AN = {
    name: 'Anslaget', kicker: 'Nærmest vinner', glow: '#2a1240',
    rules: 'Ingen vet svaret nøyaktig, men hvem kommer nærmest? Alle gjetter et tall. Nærmest får ett poeng, og treffer du innenfor 5 prosent får du ett til.',
    solo: 'Alene får du opptil 10 poeng per spørsmål etter hvor nær du er.',
    defaults: () => ({ rounds: 8 }),
    options(cfg, el, re) { el.append(h('span', 'lbl', 'Spørsmål')); el.append(seg([['5', 5], ['8', 8], ['12', 12], ['∞', 0]], cfg.rounds, (v) => { cfg.rounds = v; re(); })); },
    init(S) { const st = { qs: estPick(S.cfg.rounds || 8), round: 0, ph: 'ask', ans: {}, sc: {}, last: null, solo: S.pl.length === 1, done: 0 }; S.pl.forEach((p) => { st.sc[p.id] = 0; }); return st; },
    act(S, a, by) {
      const st = S.st;
      if (a.t === 'ans' && st.ph === 'ask') { const pid = a.pid; if (!S.pl.some((p) => p.id === pid) || !canBy(pid, by) || st.ans[pid] != null) return false; const v = Number(a.v); if (!isFinite(v)) return false; st.ans[pid] = v; if (S.pl.every((p) => st.ans[p.id] != null)) AN.reveal(S); return true; }
      if (a.t === 'reveal' && st.ph === 'ask' && (by === S.host || !S.on)) { AN.reveal(S); return true; }
      if (a.t === 'next' && st.ph === 'rev' && (by === S.host || !S.on)) { st.round++; if (st.round >= st.qs.length && !S.cfg.rounds) st.qs = st.qs.concat(estPick(8)); if (st.round >= st.qs.length) { st.end = {}; if (st.solo) { const s = st.sc[S.pl[0].id]; if (s > (mem.anBest || 0)) memSet('anBest', s); } return true; } st.ph = 'ask'; st.ans = {}; st.last = null; return true; }
      return false;
    },
    reveal(S) {
      const st = S.st, q = EST[st.qs[st.round]], A = q[1]; const pts = {};
      const ids = S.pl.map((p) => p.id).filter((id) => st.ans[id] != null);
      if (st.solo) { ids.forEach((id) => { pts[id] = Math.max(0, Math.round(10 - 14 * logErr(st.ans[id], A))); }); }
      else if (ids.length) { const best = Math.min(...ids.map((id) => logErr(st.ans[id], A))); ids.forEach((id) => { const e = logErr(st.ans[id], A); pts[id] = 0; if (e <= best + 1e-9) pts[id] = 1; if (Math.abs(st.ans[id] - A) <= Math.abs(A) * .05) pts[id] += 1; }); }
      Object.keys(pts).forEach((id) => { st.sc[id] += pts[id]; }); st.last = { pts }; st.ph = 'rev'; st.done = (st.done || 0) + 1;
    },
    key(S) { const st = S.st; return [st.ph, st.round, S.on ? '' : Object.keys(st.ans).length].join(':'); },
    patch(S, c, body) { const l = body.querySelector('.ansl'); if (!l) return; l.querySelectorAll('span').forEach((s) => s.classList.toggle('done', S.st.ans[s.dataset.p] != null)); },
    view(S, c, w) {
      const st = S.st, q = EST[st.qs[st.round]];
      w.append(h('span', 'lbl', 'Spørsmål ' + (st.round + 1) + (S.cfg.rounds ? ' av ' + st.qs.length : '') + ' · ' + q[3]));
      scoreboard(w, null, (p) => [String(st.sc[p.id]), '']);
      const card = h('div', 'gc pop'); card.append(h('span', 'cat', 'Anslaget'), h('span', 'tx', q[0]), h('span', 'cat', 'Svar i ' + q[2])); w.append(card);
      if (st.ph === 'ask') {
        let me;
        if (!S.on) { const nx = S.pl.find((p) => st.ans[p.id] == null); me = nx ? nx.id : null; if (me && handoff(w, me, 'an' + st.round + ':' + me, 'Gi ditt anslag uten at de andre ser')) return; }
        else me = c.mine.find((pid) => st.ans[pid] == null) || null;
        if (me) {
          const p = h('div', 'panel'); if (S.pl.length > 1) p.append(h('span', 'lbl', pname(me) + ' sitt anslag'));
          const inp = h('input', 'ain'); inp.inputMode = 'decimal'; inp.placeholder = 'Ditt anslag (' + q[2] + ')'; inp.autocomplete = 'off';
          const go = btn('Lås svaret', 'go big', () => { const v = parseN(inp.value); if (v == null) { inp.focus(); return; } fx.sel(); dispatch({ t: 'ans', pid: me, v }); });
          inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go.click(); });
          p.append(inp, go); w.append(p); setTimeout(() => { try { inp.focus({ preventScroll: true }); } catch (e) {} }, 60);
        } else if (S.on) watchLine(w, c.mine.length ? 'Svar låst. Venter på de andre …' : 'Du ser på');
        if (S.on) { const l = h('div', 'ansl'); S.pl.forEach((p) => { const s = h('span', st.ans[p.id] != null ? 'done' : '', p.name); s.dataset.p = p.id; l.append(s); }); w.append(l); if (c.host) w.append(btn('Avslør nå', 'ghost', () => dispatch({ t: 'reveal' }))); }
      } else {
        const A = q[1];
        if (UI.fxA !== st.round) { UI.fxA = st.round; fx.reveal(); setTimeout(() => L('thud'), 700); }
        const big = h('div', 'res okr'); big.append(h('span', 'lbl', 'Riktig svar'), h('b', '', fmtN(A) + ' ' + q[2])); w.append(big);
        const ids = S.pl.map((p) => p.id).filter((id) => st.ans[id] != null);
        if (ids.length) {
          const vals = ids.map((id) => st.ans[id]).concat([A]).map((v) => Math.max(v, A / 1000)).filter((v) => v > 0);
          let lo = Math.log10(Math.min(...vals)), hi = Math.log10(Math.max(...vals)); if (hi - lo < .1) { lo -= .1; hi += .1; } const pad = (hi - lo) * .12; lo -= pad; hi += pad;
          const xp = (v) => (Math.log10(Math.max(v, Math.pow(10, lo))) - lo) / (hi - lo) * 100;
          const nl = h('div', 'nl'); nl.append(h('div', 'ax'));
          const sorted = ids.slice().sort((a, b) => st.ans[a] - st.ans[b]);
          sorted.forEach((id, k) => { const m = h('div', 'mk'); m.style.setProperty('--pc', pcol(id)); m.style.top = (k % 2 ? 26 : 0) + 'px'; m.append(h('span', '', S.pl.length > 1 ? pname(id) : fmtN(st.ans[id])), h('i')); m.style.left = '50%'; nl.append(m); requestAnimationFrame(() => requestAnimationFrame(() => { m.style.left = xp(st.ans[id]) + '%'; })); });
          const am = h('div', 'mk ans'); am.append(h('i'), h('b', '', fmtN(A))); am.style.left = xp(A) + '%'; nl.append(am);
          w.append(nl);
          const list = h('div', 'alist');
          sorted.slice().sort((a, b) => logErr(st.ans[a], A) - logErr(st.ans[b], A)).forEach((id) => {
            const r = h('div', (st.last.pts[id] || 0) > 0 && !st.solo ? 'best' : ''); r.style.setProperty('--pc', pcol(id));
            const off = A ? Math.round((st.ans[id] - A) / A * 100) : 0;
            r.append(h('span', '', (S.pl.length > 1 ? pname(id) + ': ' : '') + fmtN(st.ans[id])), h('small', '', (off > 0 ? '+' : '') + off + ' %'), h('em', '', '+' + (st.last.pts[id] || 0)));
            list.append(r);
          });
          w.append(list);
        }
        if (c.host) w.append(btn(S.cfg.rounds && st.round + 1 >= st.qs.length ? 'Se resultatet' : 'Neste spørsmål', 'go big', () => dispatch({ t: 'next' }))); else watchLine(w, 'Venter på ' + S.host);
      }
    },
    rank(S) {
      const st = S.st;
      if (st.solo) { const s = st.sc[S.pl[0].id]; return [{ id: S.pl[0].id, name: S.pl[0].name, col: S.pl[0].col, val: s + ' av ' + (st.done || 0) * 10, sub: (st.done || 0) + ' spørsmål' }]; }
      return S.pl.map((p) => ({ id: p.id, name: p.name, col: p.col, val: st.sc[p.id] + ' p', n: st.sc[p.id] })).sort((a, b) => b.n - a.n);
    }
  };

  // ============ HVEM ER JEG? ============
  const ALTS = { 'Roald Amundsen': ['amundsen'], 'Eiffeltårnet': ['eiffel', 'eiffel tower'], 'Leonardo da Vinci': ['leonardo', 'da vinci'], 'Mount Everest': ['everest'], 'Albert Einstein': ['einstein'], 'Magnus Carlsen': ['carlsen', 'magnus'], 'Den kinesiske muren': ['kinesiske muren', 'muren', 'kinamuren'], 'Edvard Grieg': ['grieg'], 'Månen': ['manen', 'moon', 'mane'], 'Napoleon Bonaparte': ['napoleon'], 'Nelson Mandela': ['mandela'], 'Henrik Ibsen': ['ibsen'], 'Amazonas': ['amazon', 'amazonaselven'], 'Marie Curie': ['curie'], 'Usain Bolt': ['bolt'], 'Mona Lisa': ['la gioconda'], 'Fridtjof Nansen': ['nansen'], 'Den store pyramiden i Giza': ['pyramiden', 'cheopspyramiden', 'keopspyramiden', 'giza', 'khufu', 'pyramidene'], 'Michael Jackson': ['jackson'], 'Venezia': ['venice', 'venedig'], 'Kong Harald V': ['harald', 'kong harald', 'kongen'], 'Charles Darwin': ['darwin'], 'Wolfgang Amadeus Mozart': ['mozart'], 'Grete Waitz': ['waitz'], 'Julius Cæsar': ['caesar', 'cesar', 'cæsar'], 'Frihetsgudinnen': ['statue of liberty', 'frihetsstatuen'], 'Sonja Henie': ['henie'], 'Steve Jobs': ['jobs'], 'Elon Musk': ['musk'], 'Bjørn Dæhlie': ['dæhlie', 'daehlie'] };
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9æøß ]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^(den|det|de|kong) /, (m) => m);
  function lev(a, b) { const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9; const d = Array.from({ length: m + 1 }, (_, i) => [i]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; }
  function matchAns(txt, ans) {
    const t = norm(txt); if (!t) return false;
    const cands = [ans].concat(ALTS[ans] || []).map(norm);
    return cands.some((c) => t === c || (c.length >= 5 && lev(t, c) <= (c.length >= 9 ? 2 : 1)) || (c.length >= 5 && (' ' + t + ' ').includes(' ' + c + ' ')));
  }
  function whoPick(n) { const seen = new Set(mem.whoSeen || []); const ids = WHO.map((_, i) => i); let f = shuffle(ids.filter((i) => !seen.has(i))); if (f.length < n) { memSet('whoSeen', []); f = f.concat(shuffle(ids.filter((i) => !f.includes(i)))); } const out = f.slice(0, n); memSet('whoSeen', [...(mem.whoSeen || []), ...out]); return out; }
  const HV = {
    name: 'Hvem er jeg?', kicker: 'Fem hint', glow: '#3a1220',
    rules: 'Hintene kommer ett og ett, fra vanskeligst til lettest. Skriv inn svaret: jo tidligere du har rett, jo flere poeng, 5 for første hint og 1 for siste. På én telefon velger dere hvem som svarer; feil svar stenger deg ute resten av runden. Online skriver alle inn sitt eget svar.',
    solo: 'Alene skriver du svaret. Feil svar koster ingenting, men neste hint kommer og gir færre poeng.',
    defaults: () => ({ rounds: 6 }),
    options(cfg, el, re) { el.append(h('span', 'lbl', 'Antall runder')); el.append(seg([['4', 4], ['6', 6], ['8', 8], ['∞', 0]], cfg.rounds, (v) => { cfg.rounds = v; re(); })); },
    init(S) { const style = S.pl.length === 1 && !S.on ? 'solo' : (S.on ? 'type' : 'master'); const st = { list: whoPick(S.cfg.rounds || 6), round: 0, hint: 0, ph: 'hint', sc: {}, locks: {}, got: null, style, done: 0 }; S.pl.forEach((p) => { st.sc[p.id] = 0; }); return st; },
    act(S, a, by) {
      const st = S.st, hostOk = by === S.host || !S.on;
      if (a.t === 'more' && st.ph === 'hint' && hostOk && st.hint < 4) { st.hint++; return true; }
      if (st.style === 'master' && a.t === 'got' && st.ph === 'hint' && S.pl.some((p) => p.id === a.pid)) { st.sc[a.pid] += 5 - st.hint; st.got = a.pid; st.ph = 'rev'; return true; }
      if ((a.t === 'none' || a.t === 'giveup') && st.ph === 'hint' && hostOk) { st.got = null; st.ph = 'rev'; HV.score(S); return true; }
      if (st.style !== 'type' && a.t === 'guess' && st.ph === 'hint') {
        const pid = st.style === 'solo' ? S.pl[0].id : a.pid; if (!S.pl.some((p) => p.id === pid) || (st.outs || {})[pid]) return false;
        const txt = String(a.txt || '').trim().slice(0, 60); if (!txt) return false;
        if (matchAns(txt, WHO[st.list[st.round]][0])) { st.sc[pid] += 5 - st.hint; st.got = pid; st.miss = null; st.ph = 'rev'; return true; }
        st.miss = { pid, txt, h: st.hint, n: (st.miss ? st.miss.n : 0) + 1 };
        if (st.style === 'solo') { if (st.hint < 4) st.hint++; else { st.got = null; st.ph = 'rev'; } }
        else { st.outs = Object.assign({}, st.outs || {}, { [pid]: true }); if (S.pl.every((p) => st.outs[p.id])) { st.got = null; st.ph = 'rev'; } }
        return true;
      }
      if (st.style !== 'type' && a.t === 'ovr' && st.miss && !st.got) { const m = st.miss; st.sc[m.pid] += 5 - m.h; st.got = m.pid; st.gotH = m.h; st.miss = null; st.ph = 'rev'; return true; }
      if (st.style === 'solo' && a.t === 'know' && st.ph === 'hint') { st.ph = 'check'; return true; }
      if (st.style === 'solo' && a.t === 'self' && st.ph === 'check') { if (a.ok) { st.sc[S.pl[0].id] += 5 - st.hint; st.got = S.pl[0].id; } st.ph = 'rev'; return true; }
      if (st.style === 'type' && a.t === 'lock' && st.ph === 'hint') { const pid = a.pid; if (!S.pl.some((p) => p.id === pid) || !canBy(pid, by) || st.locks[pid]) return false; const txt = String(a.txt || '').slice(0, 60); st.locks[pid] = { txt, h: st.hint, ok: matchAns(txt, WHO[st.list[st.round]][0]) }; if (S.pl.every((p) => st.locks[p.id])) { st.ph = 'rev'; HV.score(S); } return true; }
      if (st.style === 'type' && a.t === 'reveal' && st.ph === 'hint' && hostOk) { st.ph = 'rev'; HV.score(S); return true; }
      if (st.style === 'type' && a.t === 'judge' && st.ph === 'rev' && hostOk && st.locks[a.pid]) { const L2 = st.locks[a.pid]; if (L2.ok !== !!a.ok) { L2.ok = !!a.ok; st.sc[a.pid] += (L2.ok ? 1 : -1) * (5 - L2.h); } return true; }
      if (a.t === 'next' && st.ph === 'rev' && hostOk) { st.round++; st.done = (st.done || 0) + 1; if (st.round >= st.list.length && !S.cfg.rounds) st.list = st.list.concat(whoPick(6)); if (st.round >= st.list.length) { st.end = {}; return true; } st.hint = 0; st.ph = 'hint'; st.locks = {}; st.got = null; st.gotH = null; st.miss = null; st.outs = {}; return true; }
      return false;
    },
    score(S) { const st = S.st; if (st.style !== 'type' || st.scored === st.round) return; st.scored = st.round; Object.entries(st.locks).forEach(([pid, L2]) => { if (L2.ok) st.sc[pid] += 5 - L2.h; }); },
    key(S) { const st = S.st; return [st.ph, st.round, st.hint, st.miss ? st.miss.n : 0].join(':'); },
    patch(S, c, body) { const l = body.querySelector('.ansl'); if (!l) return; l.querySelectorAll('span').forEach((s) => s.classList.toggle('done', !!S.st.locks[s.dataset.p])); },
    view(S, c, w) {
      const st = S.st, item = WHO[st.list[st.round]];
      w.append(h('span', 'lbl', 'Runde ' + (st.round + 1) + (S.cfg.rounds ? ' av ' + st.list.length : '')));
      scoreboard(w, null, (p) => [String(st.sc[p.id]), '']);
      if (false) { const d = h('div', 'hand'); d.style.setProperty('--pc', '#ff5b24'); const inner = h('div'); inner.append(h('span', 'lbl', 'Runde ' + (st.round + 1)), h('b', '', 'Oppleser'), h('span', 't2', 'Én holder telefonen og leser hintene høyt. De andre roper ut svaret. Trykk for å starte.')); d.append(inner); d.onclick = () => { UI.hvRead = st.round; UI.key = null; render(); }; view.body.style.position = 'relative'; w.append(d); return; }
      const pts = 5 - st.hint;
      const top = h('div', 'res'); top.append(h('b', '', st.ph === 'rev' ? 'Svaret' : pts + (pts === 1 ? ' poeng' : ' poeng')), h('span', '', st.ph === 'rev' ? '' : 'Hint ' + (st.hint + 1) + ' av 5')); w.append(top);
      if (st.ph === 'rev' || st.ph === 'check') { const an = h('div', 'who-ans', item[0]); w.append(an); if (UI.fxH !== st.round + st.ph) { UI.fxH = st.round + st.ph; fx.reveal(); if (st.ph === 'rev' && (st.got || Object.values(st.locks).some((x) => x.ok))) setTimeout(fx.good, 150); } }
      const hl = h('div', 'hints');
      item[1].forEach((t, i) => { const shown = i <= st.hint || st.ph === 'rev'; const d = h('div', 'hint' + (i === st.hint && st.ph === 'hint' ? ' cur' : '') + (shown ? '' : ' lock')); d.dataset.p = String(5 - i); d.append(h('span', '', shown ? t : 'Skjult hint som kommer senere')); hl.append(d); });
      if (st.ph === 'hint' && UI.fxHint !== st.round + ':' + st.hint) { UI.fxHint = st.round + ':' + st.hint; fx.hint(); }
      if (st.ph === 'hint') {
        if (st.style === 'master' || st.style === 'solo') {
          w.append(hl);
          const outs = st.outs || {};
          if (st.miss) { const m = h('div', 'hv-miss'); m.append(h('span', '', (st.style === 'solo' ? '' : pname(st.miss.pid) + ': ') + '«' + st.miss.txt + '» var feil')); m.append(btn('Godkjenn likevel', 'sm ghost', () => dispatch({ t: 'ovr' }))); w.append(m); if (UI.hvMiss !== st.miss.n) { UI.hvMiss = st.miss.n; fx.bad(); } }
          const p = h('div', 'panel');
          if (st.style === 'master') {
            const avail = S.pl.filter((x) => !outs[x.id]); if (!avail.some((x) => x.id === UI.hvWho)) UI.hvWho = avail.length ? avail[0].id : null;
            p.append(h('span', 'lbl', 'Hvem svarer?'));
            const ch = h('div', 'chips2'); S.pl.forEach((x) => { const b = h('button', '', x.name); b.type = 'button'; b.style.borderColor = x.col; b.setAttribute('aria-pressed', String(x.id === UI.hvWho)); if (outs[x.id]) { b.disabled = true; b.title = 'Ute denne runden'; } b.onclick = () => { fx.tap(); UI.hvWho = x.id; ch.querySelectorAll('button').forEach((y) => y.setAttribute('aria-pressed', String(y === b))); inp.focus(); }; ch.append(b); }); p.append(ch);
          }
          const inp = h('input', 'ain'); inp.placeholder = 'Hvem eller hva er det?'; inp.autocomplete = 'off'; inp.autocapitalize = 'words'; inp.value = UI.hvTxt || ''; inp.oninput = () => { UI.hvTxt = inp.value; };
          const go = btn('Svar for ' + pts + (pts === 1 ? ' poeng' : ' poeng'), 'go big', () => { const t = inp.value.trim(); if (!t) { inp.focus(); return; } if (st.style === 'master' && !UI.hvWho) return; fx.sel(); UI.hvTxt = ''; dispatch({ t: 'guess', pid: UI.hvWho, txt: t }); });
          inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go.click(); });
          p.append(inp, go); w.append(p);
          const r = h('div', 'arow'); if (st.hint < 4) r.append(btn('Neste hint', '', () => dispatch({ t: 'more' }))); r.append(btn(st.style === 'solo' ? 'Gi opp' : (st.hint < 4 ? 'Ingen vet det' : 'Vis svaret'), 'ghost', () => dispatch({ t: 'giveup' }))); w.append(r);
        } else {
          w.append(hl);
          const me = c.mine.find((pid) => !st.locks[pid]);
          if (me) { const p = h('div', 'panel'); const inp = h('input', 'ain'); inp.placeholder = 'Hvem eller hva er det?'; inp.autocomplete = 'off'; inp.value = UI.hvTxt || ''; inp.oninput = () => { UI.hvTxt = inp.value; }; const go = btn('Lås svaret for ' + pts + ' poeng', 'go big', () => { if (!inp.value.trim()) return; fx.sel(); dispatch({ t: 'lock', pid: me, txt: inp.value }); UI.hvTxt = ''; }); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go.click(); }); p.append(inp, go); w.append(p); }
          else watchLine(w, c.mine.length ? 'Svar låst. Venter på de andre …' : 'Du ser på');
          const l = h('div', 'ansl'); S.pl.forEach((p) => { const s = h('span', st.locks[p.id] ? 'done' : '', p.name); s.dataset.p = p.id; l.append(s); }); w.append(l);
          if (c.host) { const r = h('div', 'arow'); if (st.hint < 4) r.append(btn('Neste hint', '', () => dispatch({ t: 'more' }))); r.append(btn('Avslør', 'ghost', () => dispatch({ t: 'reveal' }))); w.append(r); }
        }
      } else if (st.ph === 'check') {
        w.append(h('p', 'fine', 'Var det det du tenkte?'));
        const r = h('div', 'arow'); r.append(btn('Ja, riktig', 'go', () => dispatch({ t: 'self', ok: true })), btn('Nei', 'ghost', () => dispatch({ t: 'self', ok: false }))); w.append(r);
      } else {
        if (st.style === 'type') {
          const list = h('div', 'alist');
          S.pl.forEach((p) => { const L2 = st.locks[p.id]; const r = h('div', L2 && L2.ok ? 'best' : ''); r.style.setProperty('--pc', p.col); r.append(h('span', '', p.name + ': ' + (L2 ? '«' + L2.txt + '»' : '–')), h('small', '', L2 ? 'hint ' + (L2.h + 1) : ''), h('em', '', L2 && L2.ok ? '+' + (5 - L2.h) : '0'));
            if (c.host && L2) { r.style.cursor = 'pointer'; r.title = 'Trykk for å godkjenne eller underkjenne'; r.onclick = () => dispatch({ t: 'judge', pid: p.id, ok: !L2.ok }); }
            list.append(r); });
          w.append(list); if (c.host) w.append(h('p', 'fine', 'Trykk på et svar for å godkjenne eller underkjenne det.'));
        } else if (st.got) watchLine(w, (S.pl.length > 1 ? pname(st.got) + ' får ' : 'Riktig! ') + (5 - (st.gotH != null ? st.gotH : st.hint)) + ' poeng');
        else if (st.style !== 'type') watchLine(w, 'Ingen poeng denne runden');
        w.append(hl);
        if (c.host) w.append(btn(S.cfg.rounds && st.round + 1 >= st.list.length ? 'Se resultatet' : 'Neste runde', 'go big', () => dispatch({ t: 'next' }))); else watchLine(w, 'Venter på ' + S.host);
      }
    },
    rank(S) {
      const st = S.st;
      if (S.pl.length === 1) { const s = st.sc[S.pl[0].id]; const n = Math.max(1, (st.done || 0) + (st.ph === 'rev' ? 1 : 0)); return [{ id: S.pl[0].id, name: S.pl[0].name, col: S.pl[0].col, val: s + ' av ' + n * 5 }]; }
      return S.pl.map((p) => ({ id: p.id, name: p.name, col: p.col, val: st.sc[p.id] + ' p', n: st.sc[p.id] })).sort((a, b) => b.n - a.n);
    }
  };

  // ============ KOBLINGEN ============
  const KO = {
    name: 'Koblingen', kicker: 'Fire og fire', glow: '#241240', multi: false, teams: false, finishLabel: 'Gi opp brettet',
    rules: 'Seksten ord som hører sammen fire og fire. Finn gruppene. Noen ord passer i flere grupper, men bare én løsning går opp. Fire feil, og det er over. Spill alene eller sammen.',
    solo: '',
    defaults: () => ({ p: null }),
    options(cfg, el, re) {
      const done = new Set(mem.koDone || []);
      const nx0 = CONN.findIndex((_, i) => !done.has(i)); const open2 = (i) => done.has(i) || nx0 < 0 || i <= nx0;
      if (cfg.p == null || !open2(cfg.p)) cfg.p = nx0 < 0 ? 0 : nx0;
      const go = (i) => { cfg.p = i; fx.sel(); re(); setTimeout(() => { const g2 = [...document.querySelectorAll('.ar .ab.go.big')].pop(); if (g2 && !g2.disabled) g2.click(); }, 0); };
      const nx = CONN.findIndex((_, i) => !done.has(i));
      el.append(h('p', 'fine', done.size + ' av ' + CONN.length + ' brett løst. Løs et brett for å låse opp det neste. Trykk på et brett for å starte.'));
      if (nx >= 0) el.append(btn('Spill neste uløste: brett ' + (nx + 1), 'go', () => go(nx)));
      const l = h('div', 'ko-grid');
      CONN.forEach((p, i) => { const lk = !open2(i); const b = h('button', 'kt' + (done.has(i) ? ' done' : '') + (i === nx ? ' nx' : '') + (lk ? ' lk' : '')); b.type = 'button'; b.append(h('b', '', String(i + 1)), h('span', '', done.has(i) ? '✓' : lk ? '🔒' : p.n)); b.title = lk ? 'Løs brett ' + (nx + 1) + ' først' : p.n; b.onclick = () => { if (lk) { fx.bad(); fx.toast('Løs brett ' + (nx + 1) + ' først.'); return; } go(i); }; l.append(b); });
      el.append(l);
    },
    init(S) { const P = CONN[S.cfg.p || 0]; return { words: shuffle(P.g.flatMap((g) => g[1])), found: [], sel: [], miss: 0, wr: 0, one: false, ph: 'play' }; },
    act(S, a, by) {
      const st = S.st, P = CONN[S.cfg.p || 0]; if (!inGame(by) && S.on) return false; if (st.end) return false;
      if (a.t === 'tog') { const w = String(a.w); if (!st.words.includes(w)) return false; const i = st.sel.indexOf(w); if (i >= 0) st.sel.splice(i, 1); else if (st.sel.length < 4) st.sel.push(w); else return false; return true; }
      if (a.t === 'clr') { st.sel = []; return true; }
      if (a.t === 'shuf') { st.words = shuffle(st.words); return true; }
      if (a.t === 'sub' && st.sel.length === 4) {
        const gi = P.g.findIndex((g, k) => !st.found.includes(k) && st.sel.every((w) => g[1].includes(w)));
        if (gi >= 0) { st.found.push(gi); st.words = st.words.filter((w) => !st.sel.includes(w)); st.sel = []; st.one = false; if (st.found.length === 4) { st.end = { win: true }; const d = new Set(mem.koDone || []); d.add(S.cfg.p || 0); memSet('koDone', [...d]); } }
        else { st.miss++; st.wr++; st.one = P.g.some((g, k) => !st.found.includes(k) && st.sel.filter((w) => g[1].includes(w)).length === 3); if (st.miss >= 4) st.end = { win: false }; }
        return true;
      }
      return false;
    },
    key(S) { const st = S.st; return [st.found.length, st.wr, st.words.join('|')].join(':'); },
    patch(S, c, body) {
      const st = S.st; body.querySelectorAll('.kg button').forEach((b) => { b.setAttribute('aria-pressed', String(st.sel.includes(b.dataset.w))); });
      const sub = body.querySelector('.ko-sub'); if (sub) sub.disabled = st.sel.length !== 4;
    },
    view(S, c, w) {
      const st = S.st, P = CONN[S.cfg.p || 0];
      w.append(h('span', 'lbl', 'Brett ' + ((S.cfg.p || 0) + 1) + ' · ' + P.n));
      st.found.forEach((gi) => { const g = P.g[gi]; const f = h('div', 'kf g' + gi); f.append(h('b', '', g[0]), h('span', '', g[1].join(' · '))); w.append(f); });
      if (UI.koF !== st.found.length) { if (UI.koF != null && st.found.length > UI.koF) { fx.good(); if (st.found.length === 4) {} } UI.koF = st.found.length; }
      if (UI.koW !== st.wr) { if (UI.koW != null) { fx.bad(); if (st.one) fx.toast('Én unna!'); } UI.koW = st.wr; }
      const grid = h('div', 'kg' + (UI.koShake !== st.wr && st.wr ? ' shake' : '')); UI.koShake = st.wr;
      st.words.forEach((wd) => { const b = h('button', '', wd); b.type = 'button'; b.dataset.w = wd; b.setAttribute('aria-pressed', String(st.sel.includes(wd))); b.onclick = () => { fx.tap(); dispatch({ t: 'tog', w: wd }); }; grid.append(b); });
      w.append(grid);
      const dots = h('div', 'dots'); dots.append(h('span', '', 'Feil igjen:')); for (let i = 0; i < 4; i++) dots.append(h('i', i < 4 - st.miss ? '' : 'gone')); w.append(dots);
      const r = h('div', 'arow'); r.append(btn('Stokk', 'ghost', () => dispatch({ t: 'shuf' })), btn('Fjern valg', 'ghost', () => dispatch({ t: 'clr' })));
      const sub = btn('Sjekk', 'go ko-sub', () => dispatch({ t: 'sub' })); sub.disabled = st.sel.length !== 4; sub.style.flex = '2 1 auto'; r.append(sub); w.append(r);
      if (S.on) w.append(h('p', 'fine', 'Dere spiller sammen. Alle kan velge ord og sjekke.'));
    },
    endView(S, w) {
      const st = S.st, P = CONN[S.cfg.p || 0];
      const tr = h('div', 'trophy'); tr.innerHTML = st.end.win ? TROPHY : ''; tr.append(h('span', 'lbl', P.n), h('b', '', st.end.win ? (st.miss === 0 ? 'Perfekt!' : 'Løst!') : 'Ikke denne gangen')); tr.append(h('p', 'fine', st.end.win ? st.miss + ' feil underveis' : st.found.length + ' av 4 grupper funnet')); w.append(tr);
      const kf = (gi) => { const g = P.g[gi]; const f = h('div', 'kf g' + gi); f.append(h('b', '', g[0]), h('span', '', g[1].join(' · '))); return f; };
      if (st.end.win) { P.g.forEach((g, gi) => w.append(kf(gi))); return; }
      st.found.forEach((gi) => w.append(kf(gi)));
      const rest = P.g.map((g, gi) => gi).filter((gi) => !st.found.includes(gi));
      if (rest.length) { const box = h('div', ''); const b = btn('Vis fasit', 'ghost', () => { b.remove(); rest.forEach((gi) => box.append(kf(gi))); }); box.append(b); w.append(box); }
    },
    rank() { return []; }
  };

  // ============ FELLES: plukk uten gjentak ============
  function pickFresh(key, len, n) { const seen = new Set(mem[key] || []); const ids = Array.from({ length: len }, (_, i) => i); let f = shuffle(ids.filter((i) => !seen.has(i))); if (f.length < n) { memSet(key, []); f = f.concat(shuffle(ids.filter((i) => !f.includes(i)))); } const out = f.slice(0, n); memSet(key, [...(mem[key] || []), ...out]); return out; }
  const nextVoter = (st, field) => S.pl.find((p) => st[field][p.id] == null);

  // ============ HVEM AV OSS? ============
  const VO = {
    name: 'Hvem av oss?', kicker: 'Hemmelig avstemning', glow: '#3a1232', teams: false, minP: 2,
    rules: 'Et spørsmål om gjengen. Alle stemmer i hemmelighet på den som passer best, og så kommer fasiten. Den som får flest stemmer, får tittelen. Til slutt ser dere hvem som samlet flest titler.',
    solo: 'Spillet trenger minst to. Legg inn gutta.',
    defaults: () => ({ rounds: 10, anon: true, drink: false }),
    options(cfg, el, re) {
      el.append(h('span', 'lbl', 'Spørsmål')); el.append(seg([['10', 10], ['15', 15], ['∞', 0]], cfg.rounds, (v) => { cfg.rounds = v; re(); }));
      el.append(h('span', 'lbl', 'Vis hvem som stemte')); el.append(seg([['Hemmelig', true], ['Åpent', false]], cfg.anon, (v) => { cfg.anon = v; re(); }));
      el.append(h('span', 'lbl', 'Skål-modus')); el.append(seg([['Av', false], ['På', true]], cfg.drink, (v) => { cfg.drink = v; re(); }));
      if (cfg.drink) el.append(h('p', 'fine', 'Den som får flest stemmer, tar en slurk. Vann teller.'));
    },
    init(S) { const st = { qs: pickFresh('voteSeen', VOTE.length, S.cfg.rounds || 10), round: 0, ph: 'vote', votes: {}, tit: {}, done: 0 }; S.pl.forEach((p) => { st.tit[p.id] = []; }); return st; },
    act(S, a, by) {
      const st = S.st, hostOk = by === S.host || !S.on;
      if (a.t === 'vote' && st.ph === 'vote') { const pid = a.pid; if (!S.pl.some((p) => p.id === pid) || !canBy(pid, by) || st.votes[pid] != null || !S.pl.some((p) => p.id === a.to)) return false; st.votes[pid] = a.to; if (S.pl.every((p) => st.votes[p.id] != null)) VO.reveal(S); return true; }
      if (a.t === 'reveal' && st.ph === 'vote' && hostOk && Object.keys(st.votes).length) { VO.reveal(S); return true; }
      if (a.t === 'next' && st.ph === 'rev' && hostOk) { st.round++; st.done++; if (st.round >= st.qs.length && !S.cfg.rounds) st.qs = st.qs.concat(pickFresh('voteSeen', VOTE.length, 8)); if (st.round >= st.qs.length) { st.end = {}; return true; } st.ph = 'vote'; st.votes = {}; return true; }
      return false;
    },
    reveal(S) {
      const st = S.st, cnt = {}; S.pl.forEach((p) => { cnt[p.id] = 0; }); Object.values(st.votes).forEach((to) => { cnt[to] = (cnt[to] || 0) + 1; });
      const mx = Math.max(...Object.values(cnt)); const top = S.pl.filter((p) => cnt[p.id] === mx && mx > 0).map((p) => p.id);
      top.forEach((pid) => st.tit[pid].push(st.qs[st.round])); st.cnt = cnt; st.top = top; st.ph = 'rev';
    },
    key(S) { const st = S.st; return [st.ph, st.round, S.on ? '' : Object.keys(st.votes).length].join(':'); },
    patch(S, c, body) { const l = body.querySelector('.ansl'); if (!l) return; l.querySelectorAll('span').forEach((s) => s.classList.toggle('done', S.st.votes[s.dataset.p] != null)); },
    view(S, c, w) {
      const st = S.st, q = VOTE[st.qs[st.round]];
      w.append(h('span', 'lbl', 'Spørsmål ' + (st.round + 1) + (S.cfg.rounds ? ' av ' + st.qs.length : '')));
      let me = null;
      if (st.ph === 'vote') {
        if (!S.on) { const n = nextVoter(st, 'votes'); me = n ? n.id : null; if (me && handoff(w, me, 'vo' + st.round + ':' + me, 'Hemmelig stemme')) return; }
        else me = c.mine.find((pid) => st.votes[pid] == null) || null;
      }
      const card = h('div', 'vo-q'); card.append(h('b', '', q)); w.append(card);
      if (st.ph === 'vote') {
        if (me) {
          if (S.pl.length > 1 && !S.on) w.append(h('div', 'tl-hint', pname(me) + ' stemmer'));
          const g = h('div', 'vo-pick'); S.pl.forEach((p) => { const b = h('button', '', p.name); b.type = 'button'; b.style.setProperty('--pc', p.col); b.onclick = () => { fx.sel(); dispatch({ t: 'vote', pid: me, to: p.id }); }; g.append(b); }); w.append(g);
        } else if (S.on) watchLine(w, myPids().length ? 'Stemmen er levert. Venter på de andre …' : 'Du ser på');
        if (S.on) { const l = h('div', 'ansl'); S.pl.forEach((p) => { const s = h('span', st.votes[p.id] != null ? 'done' : '', p.name); s.dataset.p = p.id; l.append(s); }); w.append(l); if (c.host) w.append(btn('Avslør nå', 'ghost', () => dispatch({ t: 'reveal' }))); }
        return;
      }
      if (UI.fxV !== st.round) { UI.fxV = st.round; fx.reveal(); setTimeout(fx.good, 160); }
      const mx = Math.max(1, ...Object.values(st.cnt));
      const bars = h('div', 'vbars');
      S.pl.slice().sort((a, b) => st.cnt[b.id] - st.cnt[a.id]).forEach((p, i) => {
        const r = h('div', 'vb' + (st.top.includes(p.id) ? ' top' : '')); r.style.setProperty('--pc', p.col); r.style.setProperty('--w', (st.cnt[p.id] / mx * 100) + '%'); r.style.animationDelay = (i * 80) + 'ms';
        r.append(h('b', '', p.name), h('span', 'n', String(st.cnt[p.id])));
        if (!S.cfg.anon) { const by = S.pl.filter((x) => st.votes[x.id] === p.id).map((x) => x.name); if (by.length) r.append(h('small', '', by.join(', '))); }
        bars.append(r);
      });
      w.append(bars);
      const res = h('div', 'res'); res.append(h('b', '', st.top.length ? st.top.map(pname).join(' og ') : 'Ingen stemmer'), h('span', '', S.cfg.drink && st.top.length ? 'Skål! Tar en slurk.' : (st.top.length > 1 ? 'Delt tittel' : 'Får tittelen'))); w.append(res);
      if (c.host) w.append(btn(S.cfg.rounds && st.round + 1 >= st.qs.length ? 'Se titlene' : 'Neste spørsmål', 'go big', () => dispatch({ t: 'next' }))); else watchLine(w, 'Venter på ' + S.host);
    },
    rank(S) { const st = S.st; return S.pl.map((p) => ({ id: p.id, name: p.name, col: p.col, val: st.tit[p.id].length + ' titler', n: st.tit[p.id].length })).sort((a, b) => b.n - a.n); },
    endView(S, w) {
      const st = S.st, rk = VO.rank(S);
      const tr = h('div', 'trophy'); tr.innerHTML = TROPHY; tr.append(h('span', 'lbl', 'Flest titler'), h('b', '', rk[0] && rk[0].n ? rk.filter((r) => r.n === rk[0].n).map((r) => r.name).join(' og ') : 'Ingen'), h('p', 'fine', (st.done + (st.ph === 'rev' ? 1 : 0)) + ' spørsmål')); w.append(tr);
      rk.forEach((r) => { if (!r.n) return; const p = h('div', 'panel vo-tit'); p.style.setProperty('--pc', r.col); p.append(h('b', '', r.name + ' · ' + r.val)); const ul = h('ul'); st.tit[r.id].slice(-6).forEach((qi) => ul.append(h('li', '', VOTE[qi].replace(/^Hvem av oss (er|har|ville|blir|kommer)? ?/i, '').replace(/\?$/, '')))); p.append(ul); w.append(p); });
    }
  };

  // ============ BLØFF ============
  const isTruth = (txt, q) => { if (q.length > 2) return [q[1]].concat(q[2] || []).some((a) => matchAns(txt, a)); const a = norm(txt), b = norm(q[1]); return a === b || (a.length > 12 && lev(a.slice(0, 60), b.slice(0, 60)) <= 4); };
  const BL = {
    name: 'Bløff', kicker: 'Lur de andre', glow: '#12303a', teams: false, minP: 2,
    rules: 'Et rart spørsmål med et sant svar. Alle skriver et troverdig svar i en hel setning. Så blandes svarene med det riktige, og alle velger det de tror er sant. 2 poeng for å finne sannheten, 1 poeng for hver kompis du lurer.',
    solo: 'Spillet trenger minst to. Best med tre eller flere.',
    defaults: () => ({ rounds: 8 }),
    options(cfg, el, re) { el.append(h('span', 'lbl', 'Runder')); el.append(seg([['5', 5], ['8', 8], ['12', 12], ['∞', 0]], cfg.rounds, (v) => { cfg.rounds = v; re(); })); },
    init(S) { const st = { qs: pickFresh('bluffOpenSeen', BLUFF_OPEN.length, S.cfg.rounds || 8), round: 0, ph: 'write', fakes: {}, picks: {}, opts: [], sc: {}, gain: {}, done: 0 }; S.pl.forEach((p) => { st.sc[p.id] = 0; }); return st; },
    act(S, a, by) {
      const st = S.st, hostOk = by === S.host || !S.on, q = BLUFF_OPEN[st.qs[st.round]];
      if (a.t === 'fake' && st.ph === 'write') { const pid = a.pid; if (!S.pl.some((p) => p.id === pid) || !canBy(pid, by) || st.fakes[pid] != null) return false; let t = String(a.txt || '').trim().slice(0, 140); if (!t || isTruth(t, q)) return false; t = t.charAt(0).toUpperCase() + t.slice(1); if (!/[.!?]$/.test(t)) t += '.'; st.fakes[pid] = t; if (S.pl.every((p) => st.fakes[p.id] != null)) BL.toPick(S); return true; }
      if (a.t === 'reveal' && st.ph === 'write' && hostOk && Object.keys(st.fakes).length) { BL.toPick(S); return true; }
      if (a.t === 'pick' && st.ph === 'pick') { const pid = a.pid; if (!S.pl.some((p) => p.id === pid) || !canBy(pid, by) || st.picks[pid] != null) return false; const o = st.opts[a.o]; if (!o || o.by.includes(pid)) return false; st.picks[pid] = a.o; if (S.pl.every((p) => st.picks[p.id] != null || !BL.canPick(st, p.id))) BL.score(S); return true; }
      if (a.t === 'reveal' && st.ph === 'pick' && hostOk) { BL.score(S); return true; }
      if (a.t === 'next' && st.ph === 'rev' && hostOk) { st.round++; st.done++; if (st.round >= st.qs.length && !S.cfg.rounds) st.qs = st.qs.concat(pickFresh('bluffOpenSeen', BLUFF_OPEN.length, 6)); if (st.round >= st.qs.length) { st.end = {}; return true; } st.ph = 'write'; st.fakes = {}; st.picks = {}; st.opts = []; st.gain = {}; return true; }
      return false;
    },
    canPick(st, pid) { return st.opts.some((o) => !o.by.includes(pid)); },
    toPick(S) {
      const st = S.st, q = BLUFF_OPEN[st.qs[st.round]]; const map = new Map();
      Object.entries(st.fakes).forEach(([pid, t]) => { const k = norm(t); if (!map.has(k)) map.set(k, { t, by: [] }); map.get(k).by.push(pid); });
      st.opts = shuffle([{ t: q[1], by: [], truth: true }].concat([...map.values()]));
      st.ph = 'pick';
    },
    score(S) {
      const st = S.st, gain = {}; S.pl.forEach((p) => { gain[p.id] = 0; });
      Object.entries(st.picks).forEach(([pid, oi]) => { const o = st.opts[oi]; if (o.truth) gain[pid] += 2; else o.by.forEach((a) => { if (a !== pid) gain[a] += 1; }); });
      Object.keys(gain).forEach((pid) => { st.sc[pid] += gain[pid]; }); st.gain = gain; st.ph = 'rev';
    },
    key(S) { const st = S.st; return [st.ph, st.round, S.on ? '' : Object.keys(st.fakes).length + '/' + Object.keys(st.picks).length].join(':'); },
    patch(S, c, body) { const st = S.st, l = body.querySelector('.ansl'); if (!l) return; l.querySelectorAll('span').forEach((s) => s.classList.toggle('done', (st.ph === 'write' ? st.fakes : st.picks)[s.dataset.p] != null)); },
    view(S, c, w) {
      const st = S.st, q = BLUFF_OPEN[st.qs[st.round]];
      w.append(h('span', 'lbl', 'Runde ' + (st.round + 1) + (S.cfg.rounds ? ' av ' + st.qs.length : '')));
      scoreboard(w, null, (p) => [String(st.sc[p.id]), st.ph === 'rev' && st.gain[p.id] ? '+' + st.gain[p.id] : '']);
      let me = null;
      if (st.ph === 'write' || st.ph === 'pick') {
        const field = st.ph === 'write' ? 'fakes' : 'picks';
        if (!S.on) { const n = S.pl.find((p) => st[field][p.id] == null && (st.ph === 'write' || BL.canPick(st, p.id))); me = n ? n.id : null; if (me && handoff(w, me, 'bl' + st.ph + st.round + ':' + me, st.ph === 'write' ? 'Skriv bløffen din' : 'Finn sannheten')) return; }
        else me = c.mine.find((pid) => st[field][pid] == null && (st.ph === 'write' || BL.canPick(st, pid))) || null;
      }
      const card = h('div', 'vo-q bl-q'); card.append(h('b', '', q[0])); if (st.ph === 'rev') card.append(h('p', 'bl-truth', q[1])); w.append(card);
      if (st.ph === 'write') {
        if (me) {
          if (!S.on) w.append(h('div', 'tl-hint', pname(me) + ' skriver'));
          const p = h('div', 'panel'); const inp = h('textarea', 'ain bl-ta'); inp.rows = 3; inp.placeholder = 'Skriv et troverdig svar i en hel setning'; inp.maxLength = 140; inp.autocomplete = 'off'; inp.value = UI.blTxt || ''; inp.oninput = () => { UI.blTxt = inp.value; msg.textContent = ''; };
          const msg = h('p', 'fine bl-msg', '');
          const go = btn('Send bløffen', 'go big', () => { const t = inp.value.trim(); if (!t) return; if (isTruth(t, q)) { msg.textContent = 'Det er faktisk riktig svar. Finn på noe annet.'; fx.bad(); return; } fx.sel(); UI.blTxt = ''; dispatch({ t: 'fake', pid: me, txt: t }); });
          inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go.click(); } });
          p.append(inp, msg, go); w.append(p);
        } else if (S.on) watchLine(w, myPids().length ? 'Bløffen er sendt. Venter på de andre …' : 'Du ser på');
      } else if (st.ph === 'pick') {
        if (me && !S.on) w.append(h('div', 'tl-hint', pname(me) + ' velger'));
        const l = h('div', 'bl-opts');
        st.opts.forEach((o, i) => { const b = h('button', '', o.t); b.type = 'button'; if (!me || o.by.includes(me)) { b.disabled = true; if (me && o.by.includes(me)) b.classList.add('own'); } else b.onclick = () => { fx.sel(); dispatch({ t: 'pick', pid: me, o: i }); }; l.append(b); });
        w.append(l);
        if (!me && S.on) watchLine(w, myPids().length ? 'Valget er gjort. Venter på de andre …' : 'Du ser på');
      } else {
        if (UI.fxB !== st.round) { UI.fxB = st.round; fx.reveal(); setTimeout(fx.good, 150); }
        const l = h('div', 'bl-opts rev');
        st.opts.forEach((o, i) => { const d = h('div', 'bo' + (o.truth ? ' truth' : '')); d.style.animationDelay = (i * 90) + 'ms'; d.append(h('b', '', o.t)); const pickers = S.pl.filter((p) => st.picks[p.id] === i).map((p) => p.name); d.append(h('small', '', (o.truth ? 'SANT' : 'Bløff av ' + o.by.map(pname).join(' og ')) + (pickers.length ? ' · valgt av ' + pickers.join(', ') : ''))); l.append(d); });
        w.append(l);
      }
      if (S.on && st.ph !== 'rev') { const field = st.ph === 'write' ? 'fakes' : 'picks'; const l = h('div', 'ansl'); S.pl.forEach((p) => { const s = h('span', st[field][p.id] != null ? 'done' : '', p.name); s.dataset.p = p.id; l.append(s); }); w.append(l); if (c.host) w.append(btn(st.ph === 'write' ? 'Videre med svarene som er inne' : 'Avslør nå', 'ghost', () => dispatch({ t: 'reveal' }))); }
      if (st.ph === 'rev') { if (c.host) w.append(btn(S.cfg.rounds && st.round + 1 >= st.qs.length ? 'Se resultatet' : 'Neste runde', 'go big', () => dispatch({ t: 'next' }))); else watchLine(w, 'Venter på ' + S.host); }
    },
    rank(S) { const st = S.st; return S.pl.map((p) => ({ id: p.id, name: p.name, col: p.col, val: st.sc[p.id] + ' p', n: st.sc[p.id] })).sort((a, b) => b.n - a.n); }
  };

  // ============ SKÅL (quiz med slurker) ============
  const SK_T = { aar: 'Hvilket år?', forst: 'Hva kom først?', anslag: 'Anslaget', hvem: 'Hvem er jeg?', fakta: 'Fyll inn', regel: 'Pausekort' };
  function skPair() {
    for (let t = 0; t < 40; t++) { const a = rnd(EV.length), b = rnd(EV.length); const d = Math.abs(EV[a].y - EV[b].y); if (a !== b && !EV[a].anchor && !EV[b].anchor && d >= 3 && d <= 80) return [a, b]; }
    return [0, 1];
  }
  function skDraw(st, S) {
    const r = Math.random(); const k = r < .26 ? 'aar' : r < .46 ? 'forst' : r < .64 ? 'anslag' : r < .77 ? 'hvem' : r < .91 ? 'fakta' : 'regel';
    let i = 0;
    if (k === 'aar') i = pickFresh('skAar', EV.length, 1)[0];
    else if (k === 'forst') i = skPair();
    else if (k === 'anslag') i = pickFresh('skEst', EST.length, 1)[0];
    else if (k === 'hvem') i = pickFresh('skWho', WHO.length, 1)[0];
    else if (k === 'fakta') i = pickFresh('skBl', BLUFF.length, 1)[0];
    else i = rnd(SKAL.regel.length);
    let p = rnd(S.pl.length); if (S.pl.length > 1 && st.card && p === st.card.p) p = (p + 1) % S.pl.length;
    return { k, i, p };
  }
  const SK = {
    name: 'Skål', kicker: 'Quiz med slurker', glow: '#3a2412', teams: false, minP: 2, finishLabel: 'Ferdig for i kveld',
    rules: 'Quiz rundt bordet. Kortet sier hvem som skal svare: årstall, hva som kom først, anslag, hvem er jeg og rare fakta. Riktig svar deler ut slurker, bom koster. Trykk «Vis svar» når noen har svart. Vann teller like mye, og den som vil, sier pass.',
    solo: 'Legg inn navnene, så trekker kortene ut hvem som skal svare.',
    defaults: () => ({}),
    options() {},
    init(S) { const st = { n: 0, card: null, rev: false, h: 1, est: {}, sc: {} }; S.pl.forEach((p) => { st.sc[p.id] = 0; }); st.card = skDraw(st, S); return st; },
    estRev(S) {
      const st = S.st; st.rev = true; if (!st.card || st.card.k !== 'anslag') return;
      const A = EST[st.card.i][1], ids = Object.keys(st.est || {}); if (!ids.length) return;
      const e = (id) => logErr(st.est[id], A), best = Math.min(...ids.map(e)), worst = Math.max(...ids.map(e));
      st.estRes = { best: ids.filter((id) => e(id) <= best + 1e-9), worst: ids.length > 1 ? ids.filter((id) => e(id) >= worst - 1e-9) : [] };
      st.sc = st.sc || {}; st.estRes.best.forEach((id) => { st.sc[id] = (st.sc[id] || 0) + 1; });
    },
    act(S, a, by) {
      const st = S.st; if (S.on && !inGame(by)) return false;
      if (a.t === 'draw') { st.card = skDraw(st, S); st.n++; st.rev = false; st.h = 1; st.est = {}; st.estRes = null; return true; }
      if (a.t === 'rev' && !st.rev) { SK.estRev(S); return true; }
      if (a.t === 'est' && !st.rev && st.card.k === 'anslag') { const pid = a.pid, v = Number(a.v); st.est = st.est || {}; if (!S.pl.some((p) => p.id === pid) || !canBy(pid, by) || st.est[pid] != null || !isFinite(v)) return false; st.est[pid] = v; if (S.pl.every((p) => st.est[p.id] != null)) SK.estRev(S); return true; }
      if (a.t === 'hint' && !st.rev && st.card.k === 'hvem' && st.h < 5) { st.h++; return true; }
      return false;
    },
    key(S) { const st = S.st; return [st.n, st.rev, st.h, Object.keys(st.est || {}).length].join(':'); },
    view(S, c, w) {
      const st = S.st, cd = st.card, nm = S.pl[cd.p] ? S.pl[cd.p].name : '';
      w.append(h('span', 'lbl', 'Kort ' + (st.n + 1)));
      const k = h('div', 'sk-card k-' + cd.k); k.append(h('span', 'sk-t', SK_T[cd.k]));
      const who2 = () => k.append(h('span', 'sk-who', nm));
      const ans = (txt, cls) => { const d = h('div', 'sk-ans' + (cls ? ' ' + cls : '')); d.textContent = txt; k.append(d); };
      if (cd.k === 'aar') {
        const e = EV[cd.i]; who2(); k.append(h('b', 'sm', e.t), h('span', 'sk-cat', TL_CATS[e.c] || ''));
        if (st.rev) ans(fmtY(e)); else k.append(h('p', '', 'Innenfor fem år: del ut to slurker. Bom: ta én.'));
      } else if (cd.k === 'forst') {
        const [A, B] = cd.i.map((x) => EV[x]); who2();
        const first = A.y <= B.y ? 0 : 1;
        const l = h('div', 'sk-vs'); [A, B].forEach((e, j) => { const d = h('div', 'sv' + (st.rev ? (j === first ? ' win' : ' lose') : '')); d.append(h('b', '', e.t)); if (st.rev) d.append(h('span', '', fmtY(e))); l.append(d); if (j === 0) l.append(h('i', '', 'eller')); }); k.append(l);
        if (!st.rev) k.append(h('p', '', 'Riktig: del ut én slurk. Feil: ta én.'));
      } else if (cd.k === 'anslag') {
        const q = EST[cd.i]; k.append(h('span', 'sk-who', 'Alle gjetter'), h('b', 'sm', q[0]));
        if (st.rev) ans(fmtN(q[1]) + ' ' + (q[2] || '')); else k.append(h('p', '', 'Skriv anslaget ditt' + (q[2] ? ' (' + q[2] + ')' : '') + ' uten at de andre ser. Nærmest får et poeng og deler ut to slurker, lengst unna tar to.'));
      } else if (cd.k === 'hvem') {
        const q = WHO[cd.i]; k.append(h('span', 'sk-who', 'Først til å svare'));
        const ul = h('ol', 'sk-hints'); q[1].slice(0, st.rev ? 5 : st.h).forEach((t) => ul.append(h('li', '', t))); k.append(ul);
        if (st.rev) ans(q[0]); else k.append(h('p', '', 'Riktig svar deler ut like mange slurker som det er hint igjen. Feil gjetning: ta én.'));
      } else if (cd.k === 'fakta') {
        const q = BLUFF[cd.i]; who2(); const parts = q[0].split('___'); const b = h('b', 'sm'); b.append(parts[0], h('span', 'gap', st.rev ? q[1] : '?'), parts.slice(1).join('___')); k.append(b);
        if (!st.rev) k.append(h('p', '', 'Riktig: del ut tre slurker. Feil: ta én.'));
      } else { const R = SKAL.regel[cd.i]; k.append(h('b', '', R[0]), h('p', '', R[1])); }
      w.append(k);
      if (cd.k === 'anslag') {
        const st2 = st; st2.est = st2.est || {};
        if (!st.rev) {
          let me = null;
          if (!S.on) { const nx = S.pl.find((p) => st2.est[p.id] == null); me = nx ? nx.id : null; if (me && S.pl.length > 1 && handoff(w, me, 'ske' + st.n + ':' + me, 'Skriv anslaget ditt uten at de andre ser')) return; }
          else me = myPids().find((pid) => st2.est[pid] == null) || null;
          if (me) {
            const p = h('div', 'panel sk-in'); if (S.pl.length > 1) p.append(h('span', 'lbl', pname(me) + ' sitt anslag'));
            const inp = h('input', 'ain'); inp.inputMode = 'decimal'; inp.autocomplete = 'off'; inp.placeholder = 'Ditt anslag' + (EST[cd.i][2] ? ' (' + EST[cd.i][2] + ')' : '');
            const go = btn('Lås svaret', 'go', () => { const v = parseN(inp.value); if (v == null) { inp.focus(); return; } fx.sel(); dispatch({ t: 'est', pid: me, v }); });
            inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go.click(); });
            p.append(inp, go); w.append(p); setTimeout(() => { try { inp.focus({ preventScroll: true }); } catch (e) {} }, 60);
          } else if (S.on) watchLine(w, myPids().length ? 'Svar låst. Venter på de andre …' : 'Du ser på');
          const l = h('div', 'ansl'); S.pl.forEach((p) => l.append(h('span', st2.est[p.id] != null ? 'done' : '', p.name))); w.append(l);
        } else if (st.estRes) {
          const A = EST[cd.i][1], ids = Object.keys(st2.est).sort((a, b) => logErr(st2.est[a], A) - logErr(st2.est[b], A));
          const l = h('div', 'sk-est');
          ids.forEach((id) => { const best = st.estRes.best.includes(id), worst = st.estRes.worst.includes(id) && !best; const r = h('div', best ? 'b' : worst ? 'w' : ''); r.append(h('b', '', pname(id)), h('span', '', fmtN(st2.est[id]) + (EST[cd.i][2] ? ' ' + EST[cd.i][2] : '')), h('small', '', best ? 'Nærmest · +1 poeng · del ut 2' : worst ? 'Lengst unna · ta 2' : '')); l.append(r); });
          w.append(l);
        }
      }
      if (S.pl.length > 1 && Object.values(st.sc || {}).some((x) => x > 0)) scoreboard(w, null, (p) => [String((st.sc || {})[p.id] || 0), 'anslag']);
      // Skriv svaret: sjekkes automatisk for hvem er jeg, fyll inn og årstall
      const chk = { hvem: (t) => matchAns(t, WHO[cd.i][0]), fakta: (t) => [BLUFF[cd.i][1]].concat(BLUFF[cd.i][2] || []).some((x) => matchAns(t, x)), aar: (t) => { const v = parseN(t); return v != null && Math.abs(v - EV[cd.i].y) <= 5; } }[cd.k];
      const res = UI.skRes && UI.skRes.n === st.n ? UI.skRes : null;
      if (chk && st.rev && res) { const d = h('div', 'res ' + (res.ok ? 'okr' : 'badr')); d.append(h('b', '', res.ok ? 'Riktig!' : 'Feil'), h('span', '', '«' + res.txt + '»' + (res.ok ? ' · del ut slurker' : ' · ta en slurk'))); w.append(d); }
      if (chk && !st.rev && (!S.on || inGame(who()))) {
        const p = h('div', 'panel sk-in'); const inp = h('input', 'ain'); inp.placeholder = cd.k === 'aar' ? 'Skriv årstallet' : 'Skriv svaret'; inp.autocomplete = 'off'; if (cd.k === 'aar') inp.inputMode = 'numeric';
        const go = btn('Sjekk svaret', 'go', () => { const t = inp.value.trim(); if (!t) { inp.focus(); return; } const ok = chk(t); UI.skRes = { n: st.n, ok, txt: t }; if (ok) fx.good(); else fx.bad(); dispatch({ t: 'rev' }); });
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go.click(); });
        p.append(inp, go); w.append(p);
      }
      if (UI.skN !== st.n) { UI.skN = st.n; fx.whoosh(); }
      if (UI.skR !== st.n + ':' + st.rev) { if (st.rev && UI.skR) fx.reveal(); UI.skR = st.n + ':' + st.rev; }
      if (S.on && !inGame(who())) { watchLine(w, 'Du ser på'); return; }
      const r = h('div', 'arow');
      if (cd.k === 'hvem' && !st.rev && st.h < 5) r.append(btn('Neste hint', 'ghost', () => { fx.hint(); dispatch({ t: 'hint' }); }));
      if (cd.k !== 'regel' && !st.rev) r.append(btn('Vis svar', chk ? 'ghost' : 'go', () => dispatch({ t: 'rev' })));
      if (r.children.length) { [...r.children].forEach((b) => { b.style.flex = '1'; }); w.append(r); }
      if (st.rev || cd.k === 'regel') w.append(btn('Neste kort', 'go big', () => { fx.tap(); dispatch({ t: 'draw' }); }));
      else w.append(btn('Hopp over kortet', 'sm ghost', () => dispatch({ t: 'draw' })));
    },
    endView(S, w) { const tr = h('div', 'trophy'); tr.innerHTML = TROPHY; tr.append(h('span', 'lbl', 'Skål'), h('b', '', (S.st.n + 1) + ' kort'), h('p', 'fine', 'Drikk et glass vann før dere legger dere.')); w.append(tr); },
    rank() { return []; }
  };

  // ============ TURENS TOPPLISTE ============
  // Hvert spill er en gren. I hver gren rangeres gjengen: best får like mange poeng som det er folk i gjengen (5), neste ett mindre osv.
  // Den som ikke har spilt grenen, får 0. Delt plass deler poengene. Summen over alle grener avgjør.
  const TUR_CATS = [
    ['ps', 'Postsortereren', 'best'], ['sn', 'Slange', 'best'], ['ff', 'Flappy-fly', 'best'], ['st', 'Stableren', 'best'], ['ms', 'Minesveiper', 'best'],
    ['tl', 'Tidslinjen alene', 'best'], ['an', 'Anslaget alene', 'best'], ['ky', 'Kryptert alene', 'best'], ['ko', 'Koblingen', 'inc'], ['kb', 'Kabal', 'inc'],
    ['w:qz', 'Quiz', 'inc'], ['w:an', 'Anslaget', 'inc'], ['w:tl', 'Tidslinjen', 'inc'], ['w:bl', 'Bløff', 'inc'], ['w:kr', 'Kodeknekker', 'inc'],
    ['w:ky', 'Kryptert', 'inc'], ['w:sv', '7-eren', 'inc'], ['w:ld', 'Bløffterninger', 'inc'], ['w:sb', 'Senke slagskip', 'inc']
  ];
  const TUR_ADMIN = '42da8ce8ad6a330a0e17e30fc3a67a1a98e38fa79553001c7fcc81a714fa571a';
  let TUR = [];
  const turKey = (cat, name) => cat.replace(':', '_') + '-' + String(name).toLowerCase().replace(/[^a-z0-9æøå]+/g, '_');
  // Resultater legges først i en lokal kø på telefonen, og sendes når det er nett (også etter at appen har vært lukket)
  function turAdd(cat, name, v, label) {
    const C = TUR_CATS.find((c) => c[0] === cat); if (!C || !name || !(OPT.people || []).includes(name)) return;
    const q = mem.turQ || []; q.push({ cat, name, v: v == null ? null : v, label: label || null, at: Date.now() }); memSet('turQ', q);
    turApply({ cat, name, v, label }); turFlush();
  }
  function turApply(e) {
    const C = TUR_CATS.find((c) => c[0] === e.cat); if (!C) return null;
    const cur = TUR.find((x) => x.cat === e.cat && x.name === e.name); let nv;
    if (C[2] === 'inc') nv = ((cur && cur.v) || 0) + 1; else { if (cur && cur.v >= e.v) return null; nv = e.v; }
    const doc = { cat: e.cat, name: e.name, v: nv, label: C[2] === 'inc' ? nv + (e.cat.startsWith('w:') ? (nv === 1 ? ' seier' : ' seire') : ' løst') : (e.label || String(nv)), at: Date.now() };
    if (cur) Object.assign(cur, doc); else TUR.push(doc); return doc;
  }
  let turBusy = false, turLoaded = false;
  async function turFlush() {
    if (turBusy || !NET.db || !turLoaded || navigator.onLine === false) return;
    const q = (mem.turQ || []).slice(); if (!q.length) return; turBusy = true;
    try {
      for (const e of q) {
        const C = TUR_CATS.find((c) => c[0] === e.cat); if (!C) continue;
        const ref = NET.db.doc('tur/' + turKey(e.cat, e.name)); const sn = await ref.get(); const cur = sn && sn.exists ? sn.data() : null;
        let nv = C[2] === 'inc' ? ((cur && cur.v) || 0) + 1 : e.v;
        if (C[2] !== 'inc' && cur && cur.v >= nv) { /* allerede bedre */ }
        else await ref.set({ cat: e.cat, name: e.name, v: nv, label: C[2] === 'inc' ? nv + (e.cat.startsWith('w:') ? (nv === 1 ? ' seier' : ' seire') : ' løst') : (e.label || String(nv)), at: e.at });
        memSet('turQ', (mem.turQ || []).filter((x) => !(x.at === e.at && x.cat === e.cat && x.name === e.name)));
      }
    } catch (x) {} finally { turBusy = false; }
  }
  try { addEventListener('online', () => setTimeout(turFlush, 1500)); setInterval(turFlush, 60000); } catch (e) {}
  function turSolo() {
    const st = S.st, p0 = S.pl[0] && S.pl[0].id, name = who(); if (!p0 || !name) return;
    if (['sn', 'ff', 'st'].includes(S.g) && st.score > 0) turAdd(S.g, name, st.score, st.score + ' ' + G().unit);
    else if (S.g === 'ps' && st.scores[p0] > 0) turAdd('ps', name, st.scores[p0], st.scores[p0] + ' poeng');
    else if (S.g === 'ms' && st.win) turAdd('ms', name, st.score, fmtSec(st.time) + ' (' + (MS_LV[S.cfg.lvl] || MS_LV.lett).n.toLowerCase() + ')');
    else if (S.g === 'tl' && st.solo && st.sc > 0) turAdd('tl', name, st.sc, st.sc + ' riktige');
    else if (S.g === 'an' && st.solo && (st.done || 0) >= 5) { const a = Math.round(st.sc[p0] / st.done * 10) / 10; turAdd('an', name, a, String(a).replace('.', ',') + ' p i snitt'); }
    else if (S.g === 'ky' && st.sc && st.sc[p0] > 0) turAdd('ky', name, st.sc[p0], st.sc[p0] + ' knekt');
    else if (S.g === 'ko' && st.end && st.end.win) turAdd('ko', name);
    else if (S.g === 'kb' && st.end && st.end.win === true) turAdd('kb', name);
  }
  // Minesveiper: poeng vektes etter nivå, så et vanskelig brett slår et lett
  const MS_W = { lett: 1, mid: 3, hard: 8 };
  // Bare de BEST_K beste grenene til hver person teller, og en gren gir poeng først når minst to har spilt den
  const TUR_K = 6;
  function turStand() {
    const people = OPT.people || [], N = people.length || 5, tot = {}, per = {}, mine = {}, cnt = {};
    people.forEach((p) => { tot[p] = 0; mine[p] = []; });
    TUR_CATS.forEach(([cat, nm]) => {
      const rows = TUR.filter((x) => x.cat === cat && people.includes(x.name) && x.v > 0).sort((a, b) => b.v - a.v);
      if (!rows.length) return;
      const pts = {}; let i = 0;
      if (rows.length >= 2) while (i < rows.length) { let j = i; while (j + 1 < rows.length && rows[j + 1].v === rows[i].v) j++; let s2 = 0; for (let k = i; k <= j; k++) s2 += N - k; for (let k = i; k <= j; k++) pts[rows[k].name] = Math.round(s2 / (j - i + 1) * 10) / 10; i = j + 1; }
      per[cat] = { nm, alone: rows.length < 2, rows: rows.map((r) => ({ name: r.name, label: r.label, p: pts[r.name] || 0 })) };
      Object.keys(pts).forEach((n) => { mine[n].push({ cat, p: pts[n] }); });
    });
    people.forEach((n) => { const top = mine[n].sort((a, b) => b.p - a.p).slice(0, TUR_K); tot[n] = Math.round(top.reduce((a, x) => a + x.p, 0) * 10) / 10; cnt[n] = mine[n].length; top.forEach((x) => { const r = per[x.cat].rows.find((y) => y.name === n); if (r) r.counts = true; }); });
    const order = people.slice().sort((a, b) => tot[b] - tot[a]);
    return { tot, per, order, cnt };
  }
  function turBoard(w) {
    if (!(OPT.people || []).length) return;
    const p = h('div', 'panel tur'); p.append(h('span', 'lbl', 'Turens toppliste'));
    const T = turStand(); const n = Object.keys(T.per).length;
    p.append(h('p', 'fine', 'Hvert spill er en gren. I hver gren får beste ' + OPT.people.length + ' poeng, nestbeste ett mindre osv. En gren gir poeng når minst to har spilt den. Dine ' + TUR_K + ' beste grener teller – du trenger ikke spille alt.'));
    const medal = ['🥇', '🥈', '🥉'];
    const list = h('div', 'tur-l');
    T.order.forEach((nm, i) => { const r = h('div', 'tur-r' + (nm === who() ? ' me' : '')); const nmw = h('div', 'tn'); nmw.append(h('b', '', nm), h('small', '', Math.min(T.cnt[nm], TUR_K) + ' av ' + TUR_K + ' grener teller' + (T.cnt[nm] > TUR_K ? ' (' + T.cnt[nm] + ' spilt)' : ''))); r.append(h('span', 'pos', medal[i] && T.tot[nm] > 0 ? medal[i] : String(i + 1)), nmw, h('span', 'pts', String(T.tot[nm]).replace('.', ',') + ' p')); list.append(r); });
    p.append(list);
    if (n) {
      // Grenene: trykk på en gren for å se alles skår
      p.append(h('span', 'lbl', 'Grenene – trykk for å se alle'));
      const gg = h('div', 'tur-gg'); const box = h('div', 'tur-gd');
      const showCat = (cat) => {
        box.textContent = ''; if (UI.turOpen !== cat) { UI.turOpen = null; [...gg.children].forEach((b) => b.classList.remove('on')); return; }
        const c = T.per[cat], people = OPT.people || [];
        const hd = h('div', 'tur-gh'); hd.append(h('b', '', c.nm), h('small', '', c.alone ? 'Gir poeng når minst to har spilt' : 'Beste får ' + people.length + ' poeng')); box.append(hd);
        c.rows.forEach((r, i) => { const d = h('div', 'rec-r' + (r.counts || c.alone ? '' : ' nc') + (r.name === who() ? ' me' : '')); d.append(h('span', 'pos', ['🥇', '🥈', '🥉'][i] || String(i + 1)), h('span', 'nm', r.name), h('span', 'v', r.label + (c.alone ? '' : ' · ' + String(r.p).replace('.', ',') + ' p'))); box.append(d); });
        people.filter((n) => !c.rows.some((r) => r.name === n)).forEach((n) => { const d = h('div', 'rec-r nc'); d.append(h('span', 'pos', '–'), h('span', 'nm', n), h('span', 'v', 'ikke spilt')); box.append(d); });
      };
      TUR_CATS.forEach(([cat]) => { const c = T.per[cat]; if (!c) return; const top = c.rows[0];
        const b = h('button', 'tur-gb' + (UI.turOpen === cat ? ' on' : '')); b.type = 'button'; b.append(h('b', '', c.nm), h('span', '', top.name + ' · ' + top.label), h('small', '', c.rows.length + (c.rows.length === 1 ? ' har spilt' : ' har spilt')));
        b.onclick = () => { fx.tap(); UI.turOpen = UI.turOpen === cat ? null : cat; [...gg.children].forEach((x) => x.classList.toggle('on', x === b && UI.turOpen === cat)); showCat(cat); if (UI.turOpen) setTimeout(() => { try { box.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {} }, 30); };
        gg.append(b); });
      p.append(gg, box); if (UI.turOpen && T.per[UI.turOpen]) showCat(UI.turOpen);
    }
    const adm = h('button', 'tur-adm', 'Nullstill (admin)'); adm.type = 'button';
    adm.onclick = () => {
      if (p.querySelector('.tur-f')) return;
      const f = h('form', 'gm-add tur-f'); const i2 = h('input'); i2.type = 'password'; i2.placeholder = 'Adminpassord'; i2.autocomplete = 'off'; const go = h('button', '', 'Nullstill'); go.type = 'submit'; const msg = h('p', 'fine', 'Sletter turens toppliste, rekordtavla og seirene for hele gjengen.');
      f.append(i2, go); p.append(f, msg); i2.focus();
      f.onsubmit = async (e) => {
        e.preventDefault(); const hh = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('lubbetur-admin:' + i2.value.trim())); const hx = [...new Uint8Array(hh)].map((x) => x.toString(16).padStart(2, '0')).join('');
        if (hx !== TUR_ADMIN) { msg.textContent = 'Feil passord.'; fx.bad(); return; }
        if (!NET.db) { msg.textContent = 'Krever nett.'; return; }
        msg.textContent = 'Nullstiller …';
        try { for (const col of ['tur', 'rekord', 'seier']) { const q = await NET.db.collection(col).get(); await Promise.all((q.docs || []).map((d) => NET.db.doc(col + '/' + d.id).delete())); } TUR = []; RECS = []; WINS = []; memSet('turQ', []); fx.good(); fx.toast('Topplista er nullstilt.'); renderHub(); }
        catch (x) { msg.textContent = 'Klarte ikke å nullstille. Prøv igjen med nett.'; }
      };
    };
    p.append(adm);
    w.append(p);
  }

  // ============ REKORDER OG SEIRE ============
  let RECS = [], WINS = [];
  const REC_G = { tl: 'Tidslinjen alene', an: 'Anslaget, snitt', ko: 'Koblingen, brett løst', ps: 'Postsortereren', sn: 'Slange', ff: 'Flappy-fly', st: 'Stableren' };
  function soloRec() {
    const st = S.st, p0 = S.pl[0] && S.pl[0].id; if (!p0) return null;
    const one = (v, label) => ({ v, label });
    if (S.g === 'tl' && st.solo) return one(st.sc, st.sc + ' riktige');
    if (S.g === 'fo' && st.solo) return one(st.sc[p0], st.sc[p0] + ' på rad');
    if (S.g === 'an' && st.solo && (st.done || 0) >= 5) { const a = Math.round(st.sc[p0] / st.done * 10) / 10; return one(a, String(a).replace('.', ',') + ' p i snitt (' + st.done + ' spm.)'); }
    if (S.g === 'hv' && st.style === 'solo') { const n = (st.done || 0) + (st.ph === 'rev' ? 1 : 0); if (n < 4) return null; const a = Math.round(st.sc[p0] / n * 10) / 10; return one(a, String(a).replace('.', ',') + ' av 5 i snitt'); }
    if (S.g === 'ps') { const v = st.scores[p0] || 0; return one(v, v + ' poeng (' + PS_LEVELS[S.cfg.lvl || 'klassisk'].name + ')'); }
    if (['sn', 'ff', 'st'].includes(S.g) && st.score != null) return one(st.score, st.score + ' ' + G().unit);
    if (S.g === 'ko' && st.end && st.end.win) { const n = (mem.koDone || []).length; return one(n, n + ' brett løst'); }
    return null;
  }
  function recordResult() {
    UI.newRec = null; if (!S || !S.st) return;
    const people = OPT.people || [];
    if (S.pl.length === 1) {
      try { turSolo(); } catch (e) {}
      const r = soloRec(); if (!r || !(r.v > 0)) return;
      const name = who() || S.pl[0].name;
      const best = mem.best || {}; const prevLocal = best[S.g] || 0;
      const prevDb = (RECS.find((x) => x.g === S.g && x.name === name) || {}).v || 0;
      if (r.v > prevLocal) { best[S.g] = r.v; memSet('best', best); }
      const top = Math.max(0, ...RECS.filter((x) => x.g === S.g).map((x) => x.v));
      if (r.v > Math.max(prevLocal, prevDb)) UI.newRec = r.label + (RECS.length && r.v > top ? ' · gjengens beste' : '');
      if (NET.db && people.includes(name) && r.v > prevDb) { try { NET.db.doc('rekord/' + S.g + '-' + name.toLowerCase()).set({ g: S.g, name, v: r.v, label: r.label, at: Date.now() }).catch(() => {}); } catch (e) {} }
      return;
    }
    const g = G(); if (!g.rank || ['vo', 'sk', 'kb'].includes(S.g)) return;
    if (S.pl.some((p) => p.bot)) return;
    if (S.pl.filter((p) => !p.bot).length < 2) return;
    const rk = g.rank(S); if (!rk.length || rk[0].n == null || !(rk[0].n > 0)) return;
    const tops = rk.filter((r) => r.n === rk[0].n);
    const names = new Set(); tops.forEach((r) => { const p = S.pl.find((x) => x.id === r.id); if (!p) return; [p.name].concat(p.mem || []).forEach((n) => { if (people.includes(n)) names.add(n); }); });
    if (!NET.db) return;
    names.forEach((n) => { try { turAdd('w:' + S.g, n); } catch (e) {} });
    names.forEach((n) => { const cur = (WINS.find((x) => x.name === n) || {}).n || 0; try { NET.db.doc('seier/' + n.toLowerCase()).set({ name: n, n: cur + 1, at: Date.now() }).catch(() => {}); } catch (e) {} });
  }
  function recBoard(w) {
    const p = h('div', 'panel rec'); p.append(h('span', 'lbl', 'Rekordtavle'));
    p.append(h('p', 'fine net-diag', 'Tilkobling: database ' + (NET.db ? 'ja' : 'nei') + ' · sanntid ' + (NET.room ? 'ja' : 'nei') + ' · bruker ' + (NET.user ? 'ja' : 'nei') + ' · skrivetilgang ' + (NET.can === true ? 'ja' : NET.can === false ? 'nei' : 'ukjent') + (NET.owner ? ' · eier' : '')));
    if (!NET.db) { p.append(h('p', 'fine', 'Den felles tavla krever at du er logget inn på Claude (gratis). Her er dine rekorder på denne telefonen.')); }
    const best = mem.best || {};
    Object.keys(REC_G).forEach((gk) => {
      const rows = RECS.filter((x) => x.g === gk).sort((a, b) => b.v - a.v).slice(0, 3);
      const mine = best[gk];
      if (!rows.length && !mine) return;
      const r = h('div', 'rec-g'); r.append(h('b', '', REC_G[gk]));
      if (rows.length) rows.forEach((x, i) => { const d = h('div', 'rec-r'); d.append(h('span', 'pos', String(i + 1)), h('span', 'nm', x.name), h('span', 'v', x.label)); r.append(d); });
      else { const d = h('div', 'rec-r'); d.append(h('span', 'pos', '–'), h('span', 'nm', 'Deg'), h('span', 'v', String(mine).replace('.', ','))); r.append(d); }
      p.append(r);
    });
    if (WINS.length) {
      const r = h('div', 'rec-g'); r.append(h('b', '', 'Seire mot hverandre'));
      WINS.slice().sort((a, b) => b.n - a.n).forEach((x, i) => { const d = h('div', 'rec-r'); d.append(h('span', 'pos', String(i + 1)), h('span', 'nm', x.name), h('span', 'v', x.n + (x.n === 1 ? ' seier' : ' seire'))); r.append(d); });
      p.append(r);
    }
    if (!p.querySelector('.rec-g')) p.append(h('p', 'fine', 'Ingen rekorder ennå. Spill alene for personlig rekord, eller mot hverandre for seire.'));
    w.append(p);
  }

  // ============ MEDALJER: bronse, sølv, gull og legendarisk per spill ============
  const MED_N = ['Bronse', 'Sølv', 'Gull', 'Legendarisk'];
  const MED = {
    tl: { u: 'riktige i én runde alene', t: [5, 10, 15, 25] },
    an: { u: 'poeng i snitt alene (minst 5 spørsmål)', t: [5, 6.5, 7.5, 8.5] },
    ko: { u: 'brett løst', t: [1, 5, 12, 25] },
    qz: { u: 'quizer fullført', u1: 'quiz fullført', t: [1, 5, 15, 30], cum: true },
    bl: { u: 'seire i Bløff', u1: 'seier i Bløff', t: [1, 3, 8, 20], cum: true },
    sv: { u: 'seire i 7-eren', u1: 'seier i 7-eren', t: [1, 5, 15, 30], cum: true },
    kb: { u: 'kabaler som gikk opp', u1: 'kabal som gikk opp', t: [1, 5, 15, 40], cum: true },
    ld: { u: 'seire i Bløffterninger', u1: 'seier i Bløffterninger', t: [1, 5, 15, 30], cum: true },
    sb: { u: 'seire i Senke slagskip', u1: 'seier i Senke slagskip', t: [1, 3, 10, 25], cum: true },
    ps: { u: 'poeng på én vakt', t: [1000, 3000, 6000, 10000] },
    sn: { u: 'epler på én runde', t: [10, 25, 45, 70] },
    ff: { u: 'fjell på én tur', t: [5, 15, 30, 50] },
    st: { u: 'etasjer i ett tårn', t: [10, 25, 45, 70] },
    ms: { u: 'brett ryddet', u1: 'brett ryddet', t: [1, 5, 15, 30], cum: true }
  };
  const fmtM = (v) => String(v).replace('.', ',');
  const unitM = (D2, v) => (v === 1 && D2.u1 ? D2.u1 : D2.u);
  function meP() {
    if (!S || !S.pl) return null; if (S.pl.length === 1) return S.pl[0];
    const hum = S.pl.filter((p) => !p.bot); if (hum.length === 1) return hum[0];
    const n = who(); return n ? S.pl.find((p) => p.name === n || (p.mem || []).includes(n)) || null : null;
  }
  function medalVal() {
    const g = S.g, st = S.st, D2 = MED[g]; if (!D2) return null; const me = meP(); if (!me) return null;
    if (D2.cum) {
      let ok = false;
      if (g === 'qz') ok = true;
      else if (g === 'kb') ok = !!(st.end && st.end.win === true);
      else if (g === 'sb') ok = !!(st.end && st.end.win === me.id);
      else if (g === 'ms') ok = !!st.win;
      else { const rk = G().rank(S); ok = rk.length > 1 && rk[0].id === me.id && !(rk[1] && rk[1].n === rk[0].n); }
      const c = mem.medCnt || {}; if (ok) { c[g] = (c[g] || 0) + 1; memSet('medCnt', c); } return c[g] || 0;
    }
    if (g === 'ps') return st.scores[me.id] || 0;
    if (S.pl.length !== 1) return null;
    const r = soloRec(); return r ? r.v : null;
  }
  // Postsortereren fikk nye grenser (legendarisk = 10 000). Gamle medaljer regnes om én gang, og beste vakt på turens toppliste teller.
  function medPsFix() {
    try {
      const all = mem.medal || {}, was = all.ps || 0; let lv = was;
      if (!mem.medPs2) { const oldT = [250, 700, 1500, 3000]; lv = lv ? MED.ps.t.filter((x) => oldT[lv - 1] >= x).length : 0; memSet('medPs2', 1); }
      const r = TUR.find((x) => x.cat === 'ps' && x.name === who()); if (r) lv = Math.max(lv, MED.ps.t.filter((x) => r.v >= x).length);
      if (lv !== was) { all.ps = lv; memSet('medal', all); }
    } catch (e) {}
  }
  function checkMedals() {
    UI.medal = null; const D2 = MED[S.g]; if (!D2) return;
    const v = medalVal(); if (v == null) return;
    const lvl = D2.t.filter((x) => v >= x).length; const all = mem.medal || {}; const prev = all[S.g] || 0;
    if (lvl > prev) { all[S.g] = lvl; memSet('medal', all); UI.medal = { g: S.g, lvl, v }; setTimeout(() => { try { fx.bonus(); if (lvl === 4) L('gold'); } catch (e) {} }, 500); }
  }
  function coin(lvl, big) { const c = h('span', 'medal m' + lvl + (big ? ' big' : '')); c.setAttribute('aria-label', MED_N[lvl - 1]); c.append(h('i', '', lvl === 4 ? '★' : '')); return c; }
  function medalNote(w) {
    const m = UI.medal; if (!m) return; const D2 = MED[m.g];
    const b = h('div', 'medal-new'); b.append(coin(m.lvl, true));
    const t = h('div'); t.append(h('span', 'lbl', 'Ny medalje'), h('b', '', MED_N[m.lvl - 1] + ' i ' + GAMES[m.g].name), h('p', 'fine', fmtM(m.v) + ' ' + unitM(D2, m.v) + (m.lvl < 4 ? '. Neste: ' + MED_N[m.lvl] + ' ved ' + fmtM(D2.t[m.lvl]) + '.' : '. Høyere enn dette kommer du ikke.')));
    b.append(t); w.append(b);
  }
  function medalBoard(w) {
    const p = h('div', 'panel rec medals'); p.append(h('span', 'lbl', 'Medaljer'), h('p', 'fine', 'Bronse, sølv, gull og legendarisk i hvert spill. Lagres på denne telefonen.'));
    const all = mem.medal || {}, cnt = mem.medCnt || {};
    Object.keys(MED).forEach((g) => {
      const D2 = MED[g], lvl = all[g] || 0; const r = h('div', 'med-r');
      const cs2 = h('span', 'coins'); for (let i = 1; i <= 4; i++) { const c = coin(i); if (i > lvl) c.classList.add('dim'); cs2.append(c); }
      const t = h('div'); t.append(h('b', '', GAMES[g].name), h('small', '', lvl < 4 ? MED_N[lvl] + ': ' + fmtM(D2.t[lvl]) + ' ' + unitM(D2, D2.t[lvl]) + (D2.cum && cnt[g] ? ' (har ' + cnt[g] + ')' : '') : 'Legendarisk! Alt er tatt.'));
      r.append(t, cs2); p.append(r);
    });
    w.append(p);
  }

  // ============ HUB I OVERLEGGET ============
  function tileGrid(onPick) {
    const grid = h('div', 'ah-tiles');
    TILES.forEach(([g, cls, a1, a2, k, name, d, ic2]) => {
      const t = h('button', 'ah-tile' + (cls ? ' ' + cls : '')); t.type = 'button'; t.style.setProperty('--a1', a1); t.style.setProperty('--a2', a2);
      const icw = h('span', 'ic'); icw.innerHTML = ic2; t.append(icw, h('span', 'k', k), h('b', '', name), h('span', 'd', d));
      const ml = (mem.medal || {})[g]; if (ml) { const c = coin(ml); c.classList.add('tile-m'); t.append(c); }
      if (g === 'al') { if (!OPT.openAlbum) return; t.onclick = () => { fx.sel(); closeOverlay(); try { OPT.openAlbum(); } catch (e) {} }; grid.append(t); return; }
      if (g === 'pk') { if (!OPT.openPacks) return; t.onclick = () => { fx.sel(); closeOverlay(); try { OPT.openPacks(); } catch (e) {} }; grid.append(t); return; }
      if (groupLocked() && !SOLO_OPEN.includes(g)) { t.classList.add('locked'); t.append(h('span', 'lk', '🔒 Torsdag 11:30')); t.onclick = () => { fx.bad(); fx.toast(LOCK_TXT + '.'); }; }
      else t.onclick = () => { fx.sel(); onPick(g); };
      grid.append(t);
    });
    return grid;
  }
  function renderHub() {
    setupState = null;
    if (S && (S.ph === 'closed' || (S.st && S.st.end))) { S = null; clearInterval(hostTimer); }
    openOverlay(); renderHeader(); setBack(null); UI.key = null;
    view.body.innerHTML = '';
    const w = h('div', 'ar-w'); view.body.append(w);
    roomsBox(w, true);
    if (S && !S.on && S.ph === 'play' && !S.st.end) {
      const b = h('div', 'ah-live'); const t = h('div'); t.append(h('b', '', 'Fortsett ' + GAMES[S.g].name), h('div', 'fine', 'Spillet du holdt på med'));
      b.append(t, btn('Fortsett', 'sm', () => { UI.key = null; render(); })); w.append(b);
    }
    w.append(tileGrid((g) => openSetup(g)));
    turBoard(w);
    recBoard(w);
    medalBoard(w);
    if (window.__lubSwitchCode) { const lo = h('div', 'panel ah-logout'); lo.append(h('span', 'lbl', 'Innlogging'), h('p', 'fine', 'Vil du bytte mellom gjengkoden og spillkoden, eller logge inn på nytt?'), btn('Logg inn på nytt / bytt kode', 'ghost', () => { askConfirm('Logge inn på nytt?', 'Du kommer tilbake til kodeskjermen. Rekorder og kort ligger trygt i databasen.', 'Logg inn på nytt', () => { try { window.__lubSwitchCode(); } catch (e) {} }); })); w.append(lo); }
    if (window.__LUB_VER) w.append(h('p', 'fine ah-ver', 'Versjon ' + window.__LUB_VER));
    view.body.scrollTop = 0;
  }

  // ============ KORTSTOKK (felles for 7-eren og kabalene) ============
  const SUITS = ['S', 'H', 'D', 'C'], SYM = { S: '♠', H: '♥', D: '♦', C: '♣' }, SNAME = { S: 'spar', H: 'hjerter', D: 'ruter', C: 'kløver' };
  const RANK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const isRed = (s) => s === 'H' || s === 'D';
  const cs = (c) => c[0], cr = (c) => Number(c.slice(1));
  const newDeck = () => shuffle(SUITS.flatMap((s) => Array.from({ length: 13 }, (_, i) => s + (i + 1))));
  const sortHand = (a) => a.slice().sort((x, y) => SUITS.indexOf(cs(x)) - SUITS.indexOf(cs(y)) || cr(x) - cr(y));
  function pcEl(c, o) {
    o = o || {};
    const back = o.back || !c;
    const d = h(o.tag || 'div', 'kort' + (back ? ' back' : (isRed(cs(c)) ? ' red' : ' blk')) + (o.cls ? ' ' + o.cls : ''));
    if (o.tag === 'button') d.type = 'button';
    if (!back) { const r = RANK[cr(c)], sy = SYM[cs(c)]; const tl = h('span', 'tl'); tl.append(h('b', '', r), h('i', '', sy)); d.append(tl, h('span', 'mid', sy)); d.setAttribute('aria-label', SNAME[cs(c)] + ' ' + r); }
    else d.setAttribute('aria-label', 'Kort med baksiden opp');
    return d;
  }

  // ============ 7-EREN ============
  const BOTN = ['Bot-Bjarne', 'Robo-Randi', 'Data-Dagfinn', 'Chip-Charlotte', 'Silisium-Sverre'];
  const svLegal = (st, c) => { const s = cs(c), r = cr(c), row = st.rows[s]; if (st.n === 0) return c === 'H7'; if (r === 7) return !row; if (!row) return false; return r === row[0] - 1 || r === row[1] + 1; };
  const svMoves = (st, pid) => (st.hands[pid] || []).filter((c) => svLegal(st, c));
  function svBotPick(st, pid, lvl) {
    const L = svMoves(st, pid); if (!L.length) return null;
    if (lvl === 'lett') return L[rnd(L.length)];
    const hand = st.hands[pid];
    let best = null, bs = -1e9;
    L.forEach((c) => {
      const s = cs(c), r = cr(c), dir = r > 7 ? 1 : r < 7 ? -1 : 0;
      const own = hand.filter((x) => cs(x) === s && x !== c);
      const beyond = own.filter((x) => dir > 0 ? cr(x) > r : dir < 0 ? cr(x) < r : true).length;
      const next = dir ? hand.includes(s + (r + dir)) : own.some((x) => Math.abs(cr(x) - 7) === 1);
      let sc = beyond * 3 + (next ? 2 : 0) - (dir && !next ? 1.5 : 0) + Math.random() * .6;
      if (r === 7 && !own.length) sc -= 2;
      if (sc > bs) { bs = sc; best = c; }
    });
    return best;
  }
  // Fargekort i 7-eren: firefargestokk (spar blå, hjerter rød, ruter oransje, kløver grønn)
  const svVal = (c) => { const r = cr(c); return r >= 11 ? 10 : r; };
  function ucEl(c, o) {
    o = o || {};
    const d = h(o.tag || 'div', 'uc s-' + cs(c) + (o.cls ? ' ' + o.cls : '')); if (o.tag === 'button') d.type = 'button';
    const r = RANK[cr(c)], sy = SYM[cs(c)];
    const c1 = h('span', 'ci'); c1.append(h('b', '', r), h('i', '', sy));
    const ov = h('span', 'ov'); const inner = h('span', 'oi'); inner.append(h('b', '', r), h('i', '', sy)); ov.append(inner);
    const c2 = h('span', 'ci br'); c2.append(h('b', '', r), h('i', '', sy));
    d.append(c1, ov, c2); d.setAttribute('aria-label', SNAME[cs(c)] + ' ' + r);
    return d;
  }
  function svDeal(S, st) {
    const deck = newDeck(), hands = {}; S.pl.forEach((p) => { hands[p.id] = []; });
    deck.forEach((c, i) => hands[S.pl[(i + (st.round || 1) - 1) % S.pl.length].id].push(c));
    Object.keys(hands).forEach((k) => { hands[k] = sortHand(hands[k]); });
    Object.assign(st, { hands, rows: { S: null, H: null, D: null, C: null }, turn: S.pl.findIndex((p) => hands[p.id].includes('H7')), out: [], n: 0, last: null, t: Date.now(), ph: 'play', rp: null, win: null });
  }
  const SV = {
    name: '7-eren', kicker: 'Kortspill', glow: '#0f3a24', teams: false, minP: 1, finishLabel: 'Avslutt og se stillingen',
    rules: 'Sjuerne er startkortene, og den som har hjerter 7 begynner. Bygg radene oppover mot konge og nedover mot ess. Kan du ikke legge, står du over. Den som først blir kvitt kortene, vinner runden og får minus 10. De andre får poeng for kortene de sitter igjen med: ess 1, tallkort pålydende, bildekort 10. Spillet slutter når noen når poenggrensen, og den med lavest sum vinner.',
    solo: 'Du spiller mot computeren. Velg antall motstandere, nivå og poenggrense under.',
    defaults: () => ({ bots: 3, lvl: 'smart', limit: 100 }),
    options(cfg, el, re, st) {
      el.append(h('span', 'lbl', 'Computer-motstandere'));
      el.append(seg([['0', 0], ['1', 1], ['2', 2], ['3', 3], ['4', 4]], cfg.bots, (v) => { cfg.bots = v; re(); }));
      el.append(h('span', 'lbl', 'Nivå')); el.append(seg([['Lett', 'lett'], ['Smart', 'smart']], cfg.lvl, (v) => { cfg.lvl = v; re(); }));
      el.append(h('span', 'lbl', 'Spill til')); el.append(seg([['50 p', 50], ['100 p', 100], ['150 p', 150], ['∞', 0]], cfg.limit == null ? 100 : cfg.limit, (v) => { cfg.limit = v; re(); })); el.append(h('p', 'fine', cfg.limit === 0 ? 'Ingen slutt. Trykk «Avslutt og se stillingen» når dere vil.' : 'Spillet slutter etter runden der noen når ' + (cfg.limit == null ? 100 : cfg.limit) + ' poeng. Lavest sum vinner.'));
      if (st && st.where === 'local' && st.pl.length + cfg.bots < 2) el.append(h('p', 'fine', 'Dere trenger minst to spillere. Én computer legges til automatisk.'));
      if (st && st.where === 'online') el.append(h('p', 'fine', 'Online ser hver spiller bare sin egen hånd. Computerne fyller opp bordet.'));
    },
    init(S) {
      S.pl = S.pl.filter((p) => !p.bot);
      let nb = Math.max(0, Math.min(6 - S.pl.length, S.cfg.bots || 0)); if (S.pl.length + nb < 2) nb = 2 - S.pl.length;
      const names = shuffle(BOTN);
      for (let i = 0; i < nb; i++) S.pl.push({ id: 'b' + i, name: names[i], col: COLS[(S.pl.length) % COLS.length], bot: true });
      const st = { round: 1, tot: {}, hist: [] }; S.pl.forEach((p) => { st.tot[p.id] = 0; });
      svDeal(S, st); return st;
    },
    play(S, pid, c) {
      const st = S.st; st.hands[pid] = st.hands[pid].filter((x) => x !== c);
      const s = cs(c), r = cr(c); if (r === 7) st.rows[s] = [7, 7]; else if (r < st.rows[s][0]) st.rows[s][0] = r; else st.rows[s][1] = r;
      st.last = { pid, c }; st.n++; st.t = Date.now();
      if (!st.hands[pid].length) { SV.roundEnd(S, pid); return; }
      SV.next(S);
    },
    pass(S, pid) { const st = S.st; st.last = { pid, pass: true }; st.n++; st.t = Date.now(); SV.next(S); },
    next(S) { const st = S.st; st.turn = (st.turn + 1) % S.pl.length; },
    roundEnd(S, win) {
      const st = S.st, rp = {};
      S.pl.forEach((p) => { rp[p.id] = p.id === win ? -10 : st.hands[p.id].reduce((n, c) => n + svVal(c), 0); st.tot[p.id] += rp[p.id]; });
      st.rp = rp; st.win = win; st.hist.push(rp); st.ph = 'rev'; st.out = [win];
      const lim = S.cfg.limit == null ? 100 : S.cfg.limit; st.over = !!(lim && S.pl.some((p) => st.tot[p.id] >= lim));
    },
    act(S, a, by) {
      const st = S.st; if (st.end) return false;
      if (a.t === 'nextround') { if (st.ph !== 'rev' || !(by === S.host || !S.on)) return false; if (st.over) { st.end = {}; return true; } st.round++; svDeal(S, st); return true; }
      const cur = S.pl[st.turn]; if (st.ph !== 'play' || !cur || cur.bot || !canBy(cur.id, by)) return false;
      if (a.t === 'play') { const c = String(a.c); if (!st.hands[cur.id].includes(c) || !svLegal(st, c)) return false; SV.play(S, cur.id, c); return true; }
      if (a.t === 'pass') { if (svMoves(st, cur.id).length) return false; SV.pass(S, cur.id); return true; }
      return false;
    },
    tick(S) {
      const st = S.st, cur = S.pl[st.turn]; if (st.ph !== 'play' || !cur || !cur.bot || st.end) return false;
      if (Date.now() - st.t < 1000) return false;
      const c = svBotPick(st, cur.id, S.cfg.lvl); if (c) SV.play(S, cur.id, c); else SV.pass(S, cur.id); return true;
    },
    key(S) { return S.st.round + ':' + S.st.n + ':' + S.st.turn + ':' + S.st.ph; },
    view(S, c, w) {
      const st = S.st, cur = S.pl[st.turn];
      const humans = S.pl.filter((p) => !p.bot);
      let me = null;
      if (S.on) me = S.pl.find((p) => !p.bot && membersOf(p).includes(who())) || null;
      else if (humans.length === 1) me = humans[0];
      else if (st.ph === 'play' && cur && !cur.bot) { if (handoff(w, cur.id, 'sv' + st.round + ':' + st.n + cur.id, 'Din tur i 7-eren')) return; me = cur; }
      w.classList.add('sv-table');
      const mine = st.ph === 'play' && me && cur && cur.id === me.id;
      // Topplinje: runde og stilling
      const tb = h('div', 'sv-top'); const lim = S.cfg.limit == null ? 100 : S.cfg.limit; tb.append(h('span', '', 'Runde ' + st.round), h('span', '', lim ? 'Spill til ' + lim + ' p · lavest vinner' : 'Uendelig · lavest vinner')); w.append(tb);
      // Motspillere
      const opp = h('div', 'sv-opp');
      S.pl.forEach((p, i) => {
        if (me && p.id === me.id) return;
        const d = h('div', 'op' + (st.ph === 'play' && i === st.turn ? ' on' : '')); d.style.setProperty('--pc', p.col);
        const av = h('span', 'av', p.bot ? '🤖' : p.name.charAt(0).toUpperCase());
        const nm = h('b', '', p.name); const n = st.hands[p.id].length;
        const fan = h('span', 'fan'); for (let k = 0; k < Math.min(n, 6); k++) { const bk = h('i'); bk.style.setProperty('--k', k); fan.append(bk); }
        const meta = h('span', 'meta'); meta.append(fan, h('span', '', n + ' · ' + st.tot[p.id] + ' p'));
        d.append(av, nm, meta);
        if (st.last && st.last.pid === p.id && st.last.pass && st.ph === 'play') d.append(h('span', 'bub', 'Står over'));
        opp.append(d);
      });
      w.append(opp);
      // Bordet
      const bd = h('div', 'sv-felt');
      SUITS.forEach((s) => {
        const row = h('div', 'lane s-' + s); row.append(h('span', 'ls', SYM[s]));
        const R = st.rows[s], cells = h('div', 'cells');
        for (let r = 1; r <= 13; r++) {
          const on = R && r >= R[0] && r <= R[1];
          const cell = h('span', 'cell' + (r === 7 ? ' seven' : '') + (on ? ' on' : '') + (st.last && st.last.c === s + r ? ' new' : ''));
          if (on) { cell.append(h('b', '', RANK[r])); } else if (r === 7) cell.append(h('b', '', '7'));
          cells.append(cell);
        }
        row.append(cells); bd.append(row);
      });
      w.append(bd);
      // Status
      const ban = h('div', 'sv-ban' + (mine ? ' me' : ''));
      if (st.ph === 'play') {
        if (mine) { ban.style.setProperty('--pc', me.col); ban.append(h('b', '', 'Din tur!')); ban.append(h('span', '', svMoves(st, me.id).length ? 'Trykk på et kort som lyser' : 'Du har ingenting å legge')); }
        else if (cur) { ban.style.setProperty('--pc', cur.col); ban.append(h('b', '', cur.bot ? cur.name + ' tenker' : cur.name + ' sin tur')); if (cur.bot) { const dots = h('span', 'dots'); dots.append(h('i'), h('i'), h('i')); ban.append(dots); } }
        if (st.last && !st.last.pass) { const lp = h('div', 'lastp'); lp.append(h('span', '', pname(st.last.pid) + ' la'), ucEl(st.last.c, { cls: 'xs' })); ban.append(lp); }
        else if (!st.last && cur) ban.append(h('span', 'sub', cur.name + ' har hjerter 7 og begynner'));
      }
      if (st.ph === 'play') w.append(ban);
      if (UI.svN !== st.round + ':' + st.n) { if (UI.svN != null && st.last) { if (st.last.pass) L('tone', 'sine', 300, 220, .12, .05); else { fx.sel(); L('noise', .08, 'highpass', 2500, 1200, .001, .12, .7); } } UI.svN = st.round + ':' + st.n; }
      // Rundeslutt
      if (st.ph === 'rev') {
        if (UI.svR !== st.round) { UI.svR = st.round; if (me && st.win === me.id) fx.win(); else fx.reveal(); }
        const sum = h('div', 'sv-sum');
        sum.append(h('h3', '', pname(st.win) + ' vant runde ' + st.round)); if (st.over) { const lim2 = S.cfg.limit == null ? 100 : S.cfg.limit; const hit = S.pl.filter((p) => st.tot[p.id] >= lim2).map((p) => p.name).join(' og '); sum.append(h('p', 'fine', hit + ' har passert ' + lim2 + ' poeng. Spillet er over.')); }
        S.pl.slice().sort((a, b) => st.tot[a.id] - st.tot[b.id]).forEach((p) => {
          const r = h('div', 'sr' + (p.id === st.win ? ' win' : '')); r.style.setProperty('--pc', p.col);
          const left = h('div', 'left'); st.hands[p.id].forEach((cc) => left.append(ucEl(cc, { cls: 'xs' }))); if (!st.hands[p.id].length) left.append(h('span', 'none', 'Tom hånd'));
          r.append(h('b', '', p.name), left, h('span', 'rp', (st.rp[p.id] > 0 ? '+' : '') + st.rp[p.id]), h('span', 'tp', st.tot[p.id] + ' p'));
          sum.append(r);
        });
        w.append(sum);
        if (isHost()) w.append(btn(st.over ? 'Se resultatet' : 'Neste runde', 'go big', () => dispatch({ t: 'nextround' }))); else watchLine(w, 'Venter på ' + S.host);
        return;
      }
      // Hånden: vifte
      if (me) {
        const hand = st.hands[me.id] || [], legal = mine ? svMoves(st, me.id) : [];
        const W = Math.min(w.clientWidth || 360, 560), cw = 58;
        const rows = hand.length > 13 ? [hand.slice(0, Math.ceil(hand.length / 2)), hand.slice(Math.ceil(hand.length / 2))] : [hand];
        const hb = h('div', 'sv-hand');
        rows.forEach((rw) => {
          const fan = h('div', 'hfan'); const n = rw.length; const step = n > 1 ? Math.min(cw + 6, (W - cw - 8) / (n - 1)) : 0; const total = step * (n - 1) + cw; const x0 = (W - total) / 2; const mid = (n - 1) / 2;
          rw.forEach((cc, i) => {
            const ok = legal.includes(cc);
            const el = ucEl(cc, { tag: 'button', cls: mine ? (ok ? 'ok' : 'no') : '' });
            const rot = (i - mid) * (n > 8 ? 2.2 : 3.5), dy = Math.pow(Math.abs(i - mid), 2) * (n > 8 ? .45 : .9);
            el.style.left = (x0 + i * step) + 'px'; el.style.setProperty('--r', rot + 'deg'); el.style.setProperty('--y', dy + 'px'); el.style.zIndex = i + 1;
            if (ok) el.onclick = () => { fx.tap(); el.classList.add('fly'); setTimeout(() => dispatch({ t: 'play', c: cc }), 140); };
            else if (mine) el.onclick = () => { fx.bad(); el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); };
            fan.append(el);
          });
          hb.append(fan);
        });
        if (!hand.length) hb.append(h('p', 'fine', 'Tom hånd'));
        const hl = h('div', 'sv-hl'); hl.style.setProperty('--pc', me.col); hl.append(h('b', '', me.name), h('span', '', hand.length + ' kort · ' + hand.reduce((n, x) => n + svVal(x), 0) + ' poeng på hånden · ' + st.tot[me.id] + ' p totalt'));
        w.append(hl, hb);
        if (mine && !legal.length) w.append(btn('Stå over', 'go big sv-pass', () => { fx.whoosh(); dispatch({ t: 'pass' }); }));
      } else if (!S.on) watchLine(w, 'Computeren spiller …');
      else watchLine(w, 'Du ser på');
    },
    rank(S) {
      const st = S.st;
      return S.pl.slice().sort((a, b) => st.tot[a.id] - st.tot[b.id]).map((p) => ({ id: p.id, name: p.name, col: p.col, val: st.tot[p.id] + ' poeng', n: 1000 - st.tot[p.id], sub: st.hist.length + (st.hist.length === 1 ? ' runde spilt' : ' runder spilt') }));
    }
  };

  // ============ KABAL ============
  const canTab = (c, pile, anyOnEmpty) => { if (!pile.length) return anyOnEmpty || cr(c) === 13; const t = pile[pile.length - 1]; return t.u !== false && isRed(cs(t.c)) !== isRed(cs(c)) && cr(t.c) === cr(c) + 1; };
  const canFd = (c, fd) => fd[cs(c)].length === cr(c) - 1;
  const flipTop = (p) => { if (p.length && !p[p.length - 1].u) p[p.length - 1].u = true; };
  const fdFull = (fd) => SUITS.every((s) => fd[s].length === 13);
  function tabDest(tab, from, cards, anyOnEmpty, capFn) {
    const order = tab.map((_, k) => k).filter((k) => k !== from);
    const ne = order.filter((k) => tab[k].length && canTab(cards[0], tab[k], anyOnEmpty) && (!capFn || cards.length <= capFn(false)));
    if (ne.length) return ne[0];
    const em = order.filter((k) => !tab[k].length && canTab(cards[0], tab[k], anyOnEmpty) && (!capFn || cards.length <= capFn(true)));
    return em.length ? em[0] : -1;
  }
  const KBT = {
    kl: {
      name: 'Klondike',
      init(cfg) { const d = newDeck(); const tab = []; for (let i = 0; i < 7; i++) { tab.push([]); for (let j = 0; j <= i; j++) tab[i].push({ c: d.pop(), u: j === i }); } return { tab, stock: d, waste: [], fd: { S: [], H: [], D: [], C: [] } }; },
      act(st, a, cfg) {
        if (a.t === 'stock') { if (st.stock.length) { const n = Math.min(cfg.draw || 1, st.stock.length); for (let k = 0; k < n; k++) st.waste.push(st.stock.pop()); return true; } if (st.waste.length) { st.stock = st.waste.reverse(); st.waste = []; return true; } return false; }
        if (a.t === 'tap') {
          if (a.z === 'w') { const c = st.waste[st.waste.length - 1]; if (!c) return false; if (canFd(c, st.fd)) { st.fd[cs(c)].push(st.waste.pop()); return true; } const k = tabDest(st.tab, -1, [c]); if (k < 0) return false; st.tab[k].push({ c: st.waste.pop(), u: true }); return true; }
          if (a.z === 'f') { const f = st.fd[a.i]; const c = f[f.length - 1]; if (!c) return false; const k = tabDest(st.tab, -1, [c]); if (k < 0) return false; st.tab[k].push({ c: f.pop(), u: true }); return true; }
          if (a.z === 't') { const p = st.tab[a.i]; const j = a.j; if (!p || !p[j] || !p[j].u) return false; const seq = p.slice(j).map((x) => x.c);
            if (seq.length === 1 && canFd(seq[0], st.fd)) { st.fd[cs(seq[0])].push(p.pop().c); flipTop(p); return true; }
            const k = tabDest(st.tab, a.i, seq); if (k < 0) return false; st.tab[k].push(...p.splice(j)); flipTop(p); return true; }
        }
        if (a.t === 'auto') { let any = false, go = true; while (go) { go = false; const w = st.waste[st.waste.length - 1]; if (w && canFd(w, st.fd)) { st.fd[cs(w)].push(st.waste.pop()); go = any = true; continue; } for (const p of st.tab) { const t = p[p.length - 1]; if (t && t.u && canFd(t.c, st.fd)) { st.fd[cs(t.c)].push(p.pop().c); flipTop(p); go = any = true; break; } } } return any; }
        return false;
      },
      canAuto(st) { return !st.stock.length && !st.waste.length && st.tab.every((p) => p.every((x) => x.u)); },
      left(st) { return 52 - SUITS.reduce((n, s) => n + st.fd[s].length, 0); }
    },
    fc: {
      name: 'FreeCell',
      init() { const d = newDeck(); const tab = Array.from({ length: 8 }, () => []); d.forEach((c, i) => tab[i % 8].push({ c, u: true })); return { tab, cells: [null, null, null, null], fd: { S: [], H: [], D: [], C: [] } }; },
      cap(st, toEmpty) { const free = st.cells.filter((x) => !x).length; const em = st.tab.filter((p) => !p.length).length - (toEmpty ? 1 : 0); return (free + 1) * Math.pow(2, Math.max(0, em)); },
      seqOk(p, j) { for (let k = j; k < p.length - 1; k++) { const a = p[k].c, b = p[k + 1].c; if (isRed(cs(a)) === isRed(cs(b)) || cr(a) !== cr(b) + 1) return false; } return true; },
      act(st, a) {
        const capFn = (te) => KBT.fc.cap(st, te);
        if (a.t === 'tap') {
          if (a.z === 'c') { const c = st.cells[a.i]; if (!c) return false; if (canFd(c, st.fd)) { st.fd[cs(c)].push(c); st.cells[a.i] = null; return true; } const k = tabDest(st.tab, -1, [c], true); if (k < 0) return false; st.tab[k].push({ c, u: true }); st.cells[a.i] = null; return true; }
          if (a.z === 'f') { const f = st.fd[a.i]; const c = f[f.length - 1]; if (!c) return false; const k = tabDest(st.tab, -1, [c], true); if (k < 0) return false; st.tab[k].push({ c: f.pop(), u: true }); return true; }
          if (a.z === 't') { const p = st.tab[a.i]; const j = a.j; if (!p || !p[j]) return false;
            if (j === p.length - 1) { const c = p[j].c; if (canFd(c, st.fd)) { st.fd[cs(c)].push(p.pop().c); return true; } const k = tabDest(st.tab, a.i, [c], true); if (k >= 0) { st.tab[k].push(p.pop()); return true; } const fi = st.cells.indexOf(null); if (fi >= 0) { st.cells[fi] = p.pop().c; return true; } return false; }
            if (!KBT.fc.seqOk(p, j)) return false; const seq = p.slice(j).map((x) => x.c); const k = tabDest(st.tab, a.i, seq, true, capFn); if (k < 0) return false; st.tab[k].push(...p.splice(j)); return true; }
        }
        if (a.t === 'auto') { let any = false, go = true; while (go) { go = false; for (let i = 0; i < 4; i++) { const c = st.cells[i]; if (c && canFd(c, st.fd)) { st.fd[cs(c)].push(c); st.cells[i] = null; go = any = true; } } for (const p of st.tab) { const t = p[p.length - 1]; if (t && canFd(t.c, st.fd)) { st.fd[cs(t.c)].push(p.pop().c); go = any = true; } } } return any; }
        return false;
      },
      canAuto(st) { return st.tab.every((p) => KBT.fc.seqOk(p, 0) && p.every((x, k) => k === 0 || cr(p[k - 1].c) > cr(x.c))) && st.tab.some((p) => p.length); },
      left(st) { return 52 - SUITS.reduce((n, s) => n + st.fd[s].length, 0); }
    },
    go: {
      name: 'Golf',
      init() { const d = newDeck(); const tab = []; for (let i = 0; i < 7; i++) tab.push(d.splice(0, 5).map((c) => ({ c, u: true }))); const waste = [d.pop()]; return { tab, stock: d, waste }; },
      act(st, a) {
        if (a.t === 'stock') { if (!st.stock.length) return false; st.waste.push(st.stock.pop()); return true; }
        if (a.t === 'tap' && a.z === 't') { const p = st.tab[a.i]; if (!p || !p.length || a.j !== p.length - 1) return false; const c = p[p.length - 1].c, w = st.waste[st.waste.length - 1]; if (Math.abs(cr(c) - cr(w)) !== 1) return false; st.waste.push(p.pop().c); return true; }
        return false;
      },
      stuck(st) { if (st.stock.length) return false; const w = st.waste[st.waste.length - 1]; return !st.tab.some((p) => p.length && Math.abs(cr(p[p.length - 1].c) - cr(w)) === 1); },
      canAuto() { return false; },
      left(st) { return st.tab.reduce((n, p) => n + p.length, 0); }
    }
  };
  const fmtT = (ms) => { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function kbStats(type) { const k = mem.kab || {}; return k[type] || { p: 0, w: 0, best: 0 }; }
  function kbSave(type, f) { const k = mem.kab || {}; k[type] = f(kbStats(type)); memSet('kab', k); }
  const KB = {
    name: 'Kabal', kicker: 'Alene', glow: '#0f2f3a', teams: false, multi: false, noOnline: true, finishLabel: 'Gi opp',
    rules: 'Tre klassiske kabaler. Trykk på et kort, så flyttes det dit det passer: først til bunkene øverst, ellers til en annen stabel. Angre så mye du vil.',
    solo: '',
    defaults: () => ({ type: 'kl', draw: 1 }),
    options(cfg, el, re) {
      el.append(h('span', 'lbl', 'Kabal'));
      el.append(seg([['Klondike', 'kl'], ['FreeCell', 'fc'], ['Golf', 'go']], cfg.type, (v) => { cfg.type = v; re(); }));
      const tx = { kl: 'Den klassiske. Bygg fire bunker fra ess til konge. Stablene bygges nedover i annenhver farge.', fc: 'Alle kort ligger åpent. Bruk de fire ledige rutene smart. Nesten alle spill kan gå opp.', go: 'Rask og enkel. Ta kort fra bunnen av stablene som er én høyere eller lavere enn kortet i potten.' };
      el.append(h('p', 'fine', tx[cfg.type]));
      if (cfg.type === 'kl') { el.append(h('span', 'lbl', 'Trekk')); el.append(seg([['Ett kort', 1], ['Tre kort', 3]], cfg.draw, (v) => { cfg.draw = v; re(); })); }
      const s = kbStats(cfg.type); el.append(h('p', 'fine', 'Spilt ' + s.p + ' · gått opp ' + s.w + (s.best ? ' · raskeste ' + fmtT(s.best) : '')));
    },
    init(S) { const T = KBT[S.cfg.type || 'kl']; const st = T.init(S.cfg); st.mv = 0; st.k = 0; st.t0 = Date.now(); st.undo = []; kbSave(S.cfg.type, (x) => Object.assign(x, { p: x.p + 1 })); return st; },
    act(S, a) {
      const st = S.st, T = KBT[S.cfg.type]; if (st.end) return false;
      if (a.t === 'undo') { const u = st.undo.pop(); if (!u) return false; const o = JSON.parse(u); const keep = { undo: st.undo, k: st.k + 1, t0: st.t0 }; S.st = Object.assign(o, keep); return true; }
      const snap = JSON.stringify(Object.assign({}, st, { undo: null }));
      if (!T.act(st, a, S.cfg)) return false;
      st.undo.push(snap); if (st.undo.length > 400) st.undo.shift(); st.mv++; st.k++;
      if (T.left(st) === 0 && (S.cfg.type === 'go' || fdFull(st.fd))) { st.end = { win: true }; const ms = Date.now() - st.t0; st.ms = ms; kbSave(S.cfg.type, (x) => Object.assign(x, { w: x.w + 1, best: x.best ? Math.min(x.best, ms) : ms })); }
      else if (S.cfg.type === 'go' && T.stuck(st)) st.end = { win: false };
      return true;
    },
    try(S, a) { const c = JSON.parse(JSON.stringify(Object.assign({}, S.st, { undo: null }))); return KBT[S.cfg.type].act(c, a, S.cfg); },
    key(S) { return String(S.st.k); },
    clock(S, body) { const t = body.querySelector('.kb-time'); if (t && S.st && !S.st.end) t.textContent = fmtT(Date.now() - S.st.t0); },
    view(S, c, w) {
      const st = S.st, type = S.cfg.type, T = KBT[type];
      const cols = type === 'fc' ? 8 : 7, gap = type === 'fc' ? 4 : 5;
      const cw = Math.max(30, Math.floor((Math.min(w.clientWidth || 360, 560) - gap * (cols - 1)) / cols));
      w.style.setProperty('--cw', cw + 'px'); w.style.setProperty('--gap', gap + 'px'); w.classList.add('kb');
      const bar = h('div', 'kb-bar'); bar.append(h('span', '', T.name + (type === 'kl' ? ' · trekk ' + (S.cfg.draw || 1) : '')), h('span', 'kb-time', fmtT(Date.now() - st.t0)), h('span', '', st.mv + ' trekk')); w.append(bar);
      const tryTap = (a, el) => { if (KB.try(S, a)) { fx.tap(); dispatch(a); } else { fx.bad(); if (el) { el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); } } };
      const top = h('div', 'kb-top');
      const slot = (child, cls) => { const s = h('div', 'kb-slot' + (cls ? ' ' + cls : '')); if (child) s.append(child); return s; };
      if (type === 'kl' || type === 'go') {
        const stk = st.stock.length ? pcEl(null, { tag: 'button', back: true }) : h('button', 'kort empty', type === 'kl' && st.waste.length ? '↻' : '');
        stk.type = 'button'; stk.onclick = () => { if (KB.try(S, { t: 'stock' })) { fx.whoosh(); dispatch({ t: 'stock' }); } };
        const sk = slot(stk, 'stock'); if (st.stock.length) sk.append(h('span', 'kb-n', String(st.stock.length))); top.append(sk);
        const ws = slot(null, 'waste' + (type === 'kl' && (S.cfg.draw || 1) === 3 ? ' fan' : ''));
        const show = type === 'kl' && (S.cfg.draw || 1) === 3 ? st.waste.slice(-3) : st.waste.slice(-1);
        show.forEach((wc, i) => { const last = i === show.length - 1; const e = pcEl(wc, { tag: last && type === 'kl' ? 'button' : 'div' }); e.style.setProperty('--i', i); if (last && type === 'kl') e.onclick = () => tryTap({ t: 'tap', z: 'w' }, e); ws.append(e); });
        if (!show.length) ws.append(h('div', 'kort empty'));
        top.append(ws);
        if (type === 'go') { top.append(h('div', 'kb-gl', T.left(st) + ' kort igjen i stablene')); }
      }
      if (type === 'fc') st.cells.forEach((cc, i) => { const e = cc ? pcEl(cc, { tag: 'button' }) : h('div', 'kort empty'); if (cc) e.onclick = () => tryTap({ t: 'tap', z: 'c', i }, e); top.append(slot(e, 'cell')); });
      if (type !== 'go') {
        if (type === 'kl') top.append(h('div', 'kb-sp'));
        SUITS.forEach((s) => { const f = st.fd[s]; const tc = f[f.length - 1]; const e = tc ? pcEl(tc, { tag: 'button' }) : h('div', 'kort empty fd', SYM[s]); if (tc) e.onclick = () => tryTap({ t: 'tap', z: 'f', i: s }, e); top.append(slot(e, 'fd')); });
      }
      w.append(top);
      const tb = h('div', 'kb-tab');
      const dOff = Math.round(cw * .16), uOff = Math.round(cw * (type === 'kl' ? .36 : .34));
      st.tab.forEach((p, i) => {
        const col = h('div', 'kb-col'); let y = 0;
        if (!p.length) col.append(h('div', 'kort empty'));
        p.forEach((x, j) => { const e = x.u ? pcEl(x.c, { tag: 'button' }) : pcEl(null, { back: true }); e.style.top = y + 'px'; e.style.zIndex = j + 1;
          if (x.u) e.onclick = () => tryTap({ t: 'tap', z: 't', i, j }, e);
          if (type === 'go' && j !== p.length - 1) e.classList.add('dim');
          col.append(e); y += x.u ? uOff : dOff; });
        col.style.height = (y - (p.length ? (p[p.length - 1].u ? uOff : dOff) : 0) + Math.round(cw * 1.4)) + 'px';
        tb.append(col);
      });
      w.append(tb);
      const r = h('div', 'arow kb-ctl');
      const ub = btn('Angre', 'ghost', () => { fx.tap(); dispatch({ t: 'undo' }); }); ub.disabled = !st.undo.length; r.append(ub);
      if (type !== 'go') { const ab = btn(T.canAuto(st) ? 'Fullfør' : 'Til bunkene', T.canAuto(st) ? 'go' : 'ghost', () => { if (KB.try(S, { t: 'auto' })) { fx.good(); dispatch({ t: 'auto' }); } else fx.bad(); }); r.append(ab); }
      w.append(r);
    },
    endView(S, w) {
      const st = S.st, T = KBT[S.cfg.type], win = st.end && st.end.win;
      const tr = h('div', 'trophy'); tr.innerHTML = win ? TROPHY : ''; tr.append(h('span', 'lbl', T.name), h('b', '', win ? 'Gikk opp!' : 'Ikke denne gangen'));
      tr.append(h('p', 'fine', win ? st.mv + ' trekk på ' + fmtT(st.ms || 0) : T.left(st) + ' kort igjen'));
      const s = kbStats(S.cfg.type); tr.append(h('p', 'fine', 'Gått opp ' + s.w + ' av ' + s.p + (s.best ? ' · raskeste ' + fmtT(s.best) : ''))); w.append(tr);
    },
    rank() { return []; }
  };

  // ============ QUIZ (ferdige og egne) ============
  let QUIZZES = [];
  const qzAll = () => { const m = new Map(); (mem.myQuiz || []).forEach((q) => m.set(q.id, q)); QUIZZES.forEach((q) => m.set(q.id, q)); return [...m.values()].filter((q) => q && q.qs && q.qs.length).sort((a, b) => (b.at || 0) - (a.at || 0)); };
  const QZ_SH = ['▲', '◆', '●', '■'];
  const roundNice = (v) => { if (v === 0) return 0; const a = Math.abs(v); const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(a)) - 1)); return Math.round(v / p) * p; };
  function qzGen(n) {
    return pickFresh('qzSeen', QZ_BANK.length, n).map((k) => { const r = QZ_BANK[k]; const o = shuffle(r.slice(1, 5)); return { q: r[0], s: r[5], o, a: o.indexOf(r[1]) }; });
  }
  const qzOk = (Q, txt) => (Q.ans || []).some((a) => matchAns(txt, a));
  const QZ = {
    name: 'Quiz', kicker: 'Fire svar', glow: '#26124a', teams: true,
    rules: 'Svar så fort du kan: riktig gir ett poeng, raskeste riktige får ett til. Lubben-mix har over 160 spørsmål om geografi, vitenskap, sport, film, mat og mer. Eller spill en quiz som noen i gjengen har laget, med svaralternativer eller fritekst.',
    solo: 'Alene får du poeng for hvert riktige svar.',
    defaults: () => ({ src: 'mix', n: 10, timer: 20 }),
    options(cfg, el, re, st) {
      el.append(h('span', 'lbl', 'Velg quiz'));
      const l = h('div', 'qz-list');
      const item = (id, title, sub, own) => { const b = h('button', 'qz-item' + (cfg.src === id ? ' on' : '')); b.type = 'button'; b.append(h('b', '', title), h('span', '', sub)); b.onclick = () => { cfg.src = id; re(); }; if (own) { const x = h('span', 'qz-del', 'Slett'); x.onclick = (e) => { e.stopPropagation(); askConfirm('Slette quizen?', '«' + title + '» blir borte for alle.', 'Slett', () => { qzDelete(id); if (cfg.src === id) cfg.src = 'mix'; re(); }); }; b.append(x); } l.append(b); };
      item('mix', 'Lubben-mix', QZ_BANK.length + ' spørsmål om geografi, vitenskap, sport, film, mat og mer.');
      qzAll().forEach((q) => item(q.id, q.title, q.qs.length + ' spørsmål · laget av ' + (q.by || 'ukjent'), q.by && q.by === who()));
      el.append(l);
      el.append(btn('+ Lag din egen quiz', 'ghost', () => { fx.sel(); openEditor(null); }));
      if (cfg.src === 'mix') { el.append(h('span', 'lbl', 'Spørsmål')); el.append(seg([['10', 10], ['15', 15], ['25', 25], ['∞', 0]], cfg.n, (v) => { cfg.n = v; re(); })); }
      el.append(h('span', 'lbl', 'Tid per spørsmål')); el.append(seg([['Av', 0], ['10 s', 10], ['20 s', 20], ['30 s', 30]], cfg.timer, (v) => { cfg.timer = v; re(); }));
      if (!NET.db) el.append(h('p', 'fine', 'Uten innlogging lagres egne quizer bare på denne telefonen.'));
    },
    init(S) {
      let qs, title = 'Lubben-mix';
      if (S.cfg.src && S.cfg.src !== 'mix') { const Q = qzAll().find((q) => q.id === S.cfg.src); if (Q) { title = Q.title; qs = Q.qs.map((x) => { if (x.t === 'text') return { q: x.q, text: true, ans: String(x.ans || '').split('/').map((a) => a.trim()).filter(Boolean) }; const idx = shuffle([0, 1, 2, 3].filter((i) => x.o[i] != null && String(x.o[i]).trim() !== '')); return { q: x.q, o: idx.map((i) => x.o[i]), a: idx.indexOf(x.a) }; }); } }
      if (!qs) qs = qzGen(S.cfg.n || 10);
      const st = { title, qs, round: 0, ph: 'ask', ans: {}, sc: {}, t0: Date.now(), mix: !(S.cfg.src && S.cfg.src !== 'mix') }; S.pl.forEach((p) => { st.sc[p.id] = 0; }); return st;
    },
    act(S, a, by) {
      const st = S.st, hostOk = by === S.host || !S.on;
      if (a.t === 'ans' && st.ph === 'ask') { const pid = a.pid; if (!S.pl.some((p) => p.id === pid) || !canBy(pid, by) || st.ans[pid]) return false; const Qa = st.qs[st.round]; st.ans[pid] = Qa.text ? { txt: String(a.txt || '').slice(0, 80), ok: qzOk(Qa, a.txt || ''), ms: Math.max(0, Math.min(120000, Number(a.ms) || 0)) } : { i: Number(a.i), ms: Math.max(0, Math.min(120000, Number(a.ms) || 0)) }; if (S.pl.every((p) => st.ans[p.id])) QZ.reveal(S); return true; }
      if (a.t === 'reveal' && st.ph === 'ask' && hostOk) { QZ.reveal(S); return true; }
      if (a.t === 'judge' && st.ph === 'rev' && hostOk && st.ans[a.pid] && st.qs[st.round].text) { const A2 = st.ans[a.pid]; A2.ok = !A2.ok; st.sc[a.pid] += A2.ok ? 1 : -1; return true; }
      if (a.t === 'next' && st.ph === 'rev' && hostOk) { st.round++; if (st.round >= st.qs.length && st.mix && !S.cfg.n) st.qs = st.qs.concat(qzGen(10)); if (st.round >= st.qs.length) { st.end = {}; return true; } st.ph = 'ask'; st.ans = {}; st.t0 = Date.now(); return true; }
      return false;
    },
    reveal(S) {
      const st = S.st, Q = st.qs[st.round]; const right = S.pl.filter((p) => st.ans[p.id] && (Q.text ? st.ans[p.id].ok : st.ans[p.id].i === Q.a));
      right.forEach((p) => { st.sc[p.id]++; }); st.fast = null;
      if (right.length > 1) { const f = right.slice().sort((x, y) => st.ans[x.id].ms - st.ans[y.id].ms)[0]; st.sc[f.id]++; st.fast = f.id; }
      st.ph = 'rev';
    },
    tick(S) { const st = S.st; if (!S.on || st.ph !== 'ask' || !S.cfg.timer) return false; if (Date.now() > st.t0 + S.cfg.timer * 1000 + 1200) { QZ.reveal(S); return true; } return false; },
    key(S) { const st = S.st; return [st.ph, st.round, S.on ? '' : Object.keys(st.ans).length, st.ph === 'rev' ? Object.values(st.ans).map((x) => x.ok ? 1 : 0).join('') : ''].join(':'); },
    patch(S, c, body) { const l = body.querySelector('.ansl'); if (!l) return; l.querySelectorAll('span').forEach((s) => s.classList.toggle('done', !!S.st.ans[s.dataset.p])); },
    clock(S, body) {
      const bar = body.querySelector('.timer i'); if (!bar || !S.cfg.timer) return;
      const t0 = S.on ? S.st.t0 : (UI.t0 || Date.now()); const left = Math.max(0, 1 - (Date.now() - t0) / (S.cfg.timer * 1000)); bar.style.transform = 'scaleX(' + left + ')';
      if (left <= 0 && !S.on && UI.qzPid && !UI.qzSent) { UI.qzSent = true; const tx = body.querySelector('.qz-text input'); dispatch({ t: 'ans', pid: UI.qzPid, i: -1, txt: tx ? tx.value : '', ms: S.cfg.timer * 1000 }); }
    },
    view(S, c, w) {
      const st = S.st, Q = st.qs[st.round];
      w.append(h('span', 'lbl', st.title + ' · ' + (st.round + 1) + (st.mix && !S.cfg.n ? '' : ' av ' + st.qs.length)));
      scoreboard(w, null, (p) => [String(st.sc[p.id]), '']);
      let me = null;
      if (st.ph === 'ask') {
        if (!S.on) { const n = S.pl.find((p) => !st.ans[p.id]); me = n ? n.id : null; if (me && S.pl.length > 1 && handoff(w, me, 'qz' + st.round + ':' + me, 'Din tur i quizen')) return; }
        else me = c.mine.find((pid) => !st.ans[pid]) || null;
        if (UI.qzKey !== st.round + ':' + me) { UI.qzKey = st.round + ':' + me; UI.t0 = Date.now(); UI.qzSent = false; }
        UI.qzPid = me;
      }
      const card = h('div', 'qz-q'); card.append(h('b', '', Q.q)); if (Q.s) card.append(h('p', '', Q.s)); w.append(card);
      if (S.cfg.timer && st.ph === 'ask') { const t = h('div', 'timer'); t.append(h('i')); w.append(t); }
      if (Q.text) {
        if (st.ph === 'ask' && me) {
          const p = h('form', 'panel qz-text'); const inp = h('input', 'ain'); inp.placeholder = 'Skriv svaret'; inp.autocomplete = 'off'; inp.value = UI.qzTxt || ''; inp.oninput = () => { UI.qzTxt = inp.value; };
          const go = h('button', 'ab go big', 'Svar'); go.type = 'submit'; p.append(inp, go);
          p.addEventListener('submit', (e) => { e.preventDefault(); const t = inp.value.trim(); if (!t) { inp.focus(); return; } fx.sel(); UI.qzTxt = ''; dispatch({ t: 'ans', pid: me, txt: t, ms: Date.now() - UI.t0 }); });
          w.append(p);
        }
        if (st.ph === 'rev') {
          const an = h('div', 'who-ans', Q.ans[0] || ''); w.append(an);
          if (S.pl.length > 1 || S.on) { const list = h('div', 'alist'); S.pl.forEach((p) => { const A2 = st.ans[p.id]; const r = h('div', A2 && A2.ok ? 'best' : ''); r.style.setProperty('--pc', p.col); r.append(h('span', '', p.name + ': ' + (A2 && A2.txt ? '«' + A2.txt + '»' : '–')), h('small', '', ''), h('em', '', A2 && A2.ok ? '✓' : '✗')); if (c.host && A2) { r.style.cursor = 'pointer'; r.onclick = () => dispatch({ t: 'judge', pid: p.id }); } list.append(r); }); w.append(list); if (c.host) w.append(h('p', 'fine', 'Trykk på et svar for å godkjenne eller underkjenne det.')); }
          else { const A2 = st.ans[S.pl[0].id]; if (A2 && A2.txt) { const m = h('div', 'hv-miss' + (A2.ok ? ' ok' : '')); m.append(h('span', '', 'Du svarte «' + A2.txt + '»')); if (!A2.ok) m.append(btn('Godkjenn likevel', 'sm ghost', () => dispatch({ t: 'judge', pid: S.pl[0].id }))); w.append(m); } }
        }
      }
      const g = h('div', 'qz-opts' + (Q.long ? ' long' : '')); if (Q.text) g.hidden = true;
      (Q.o || []).forEach((o, i) => {
        const b = h('button', 'qo c' + i); b.type = 'button'; b.append(h('span', 'sh', QZ_SH[i]), h('span', 'tx', o));
        if (st.ph === 'rev') { b.disabled = true; b.classList.add(i === Q.a ? 'right' : 'wrong'); if (Q.ex) b.append(h('span', 'ex', Q.ex[i])); const who2 = S.pl.filter((p) => st.ans[p.id] && st.ans[p.id].i === i).map((p) => p.name); if (who2.length && S.pl.length > 1) b.append(h('span', 'who', who2.join(', '))); }
        else if (me) b.onclick = () => { fx.sel(); dispatch({ t: 'ans', pid: me, i, ms: Date.now() - UI.t0 }); };
        else b.disabled = true;
        g.append(b);
      });
      w.append(g);
      if (st.ph === 'ask') {
        if (S.on) { if (!me) watchLine(w, c.mine.length ? 'Svaret er låst. Venter på de andre …' : 'Du ser på'); const l = h('div', 'ansl'); S.pl.forEach((p) => { const s = h('span', st.ans[p.id] ? 'done' : '', p.name); s.dataset.p = p.id; l.append(s); }); w.append(l); if (c.host) w.append(btn('Avslør nå', 'ghost', () => dispatch({ t: 'reveal' }))); }
        else if (me && S.pl.length > 1) w.append(h('div', 'tl-hint', pname(me) + ' svarer'));
      } else {
        if (UI.qzR !== st.round) { UI.qzR = st.round; const mineOk = (S.on ? c.mine : S.pl.map((p) => p.id)).some((pid) => st.ans[pid] && (Q.text ? st.ans[pid].ok : st.ans[pid].i === Q.a)); fx.reveal(); setTimeout(() => (mineOk ? fx.good() : fx.bad()), 120); }
        const right = S.pl.filter((p) => st.ans[p.id] && (Q.text ? st.ans[p.id].ok : st.ans[p.id].i === Q.a));
        const res = h('div', 'res ' + (S.pl.length === 1 ? (right.length ? 'okr' : 'badr') : '')); res.append(h('b', '', S.pl.length === 1 ? (right.length ? 'Riktig!' : 'Feil') : right.length + ' av ' + S.pl.length + ' riktig')); if (st.fast) res.append(h('span', '', 'Raskest: ' + pname(st.fast) + ' (+1)')); w.append(res);
        if (c.host) w.append(btn(st.round + 1 >= st.qs.length && !(st.mix && !S.cfg.n) ? 'Se resultatet' : 'Neste spørsmål', 'go big', () => dispatch({ t: 'next' }))); else watchLine(w, 'Venter på ' + S.host);
      }
    },
    rank(S) { const st = S.st; return S.pl.map((p) => ({ id: p.id, name: p.name, col: p.col, val: st.sc[p.id] + ' p', n: st.sc[p.id] })).sort((a, b) => b.n - a.n); }
  };
  // Lagre og slette egne quizer: i databasen for alle, og lokalt som reserve
  function qzSave(Q) {
    const mine = (mem.myQuiz || []).filter((x) => x.id !== Q.id); mine.unshift(Q); memSet('myQuiz', mine.slice(0, 40));
    try { if (NET.db) NET.db.doc('quiz/' + Q.id).set(clone(Q)).catch(() => {}); } catch (e) {}
  }
  function qzDelete(id) {
    memSet('myQuiz', (mem.myQuiz || []).filter((x) => x.id !== id)); QUIZZES = QUIZZES.filter((x) => x.id !== id);
    try { if (NET.db) NET.db.doc('quiz/' + id).set({ id, deleted: true, at: Date.now() }).catch(() => {}); } catch (e) {}
  }
  let EDIT = null;
  function openEditor(Q) {
    EDIT = Q ? clone(Q) : { id: 'q' + Date.now().toString(36) + rnd(1e5).toString(36), title: '', by: who() || '', qs: [{ t: 'mc', q: '', o: ['', '', '', ''], a: 0, ans: '' }], at: 0 };
    renderEditor();
  }
  function renderEditor() {
    if (!view || !EDIT) return; const Q = EDIT;
    view.title.textContent = 'Lag quiz'; setBack(() => { EDIT = null; renderSetup(); });
    const keepY = view.body.scrollTop; view.body.innerHTML = ''; const w = h('div', 'ar-w qz-ed'); view.body.append(w);
    const top = h('div', 'panel'); top.append(h('span', 'lbl', 'Navn på quizen'));
    const ti = h('input', 'ain'); ti.placeholder = 'For eksempel «Hvor godt kjenner du Lubben?»'; ti.value = Q.title; ti.maxLength = 60; ti.oninput = () => { Q.title = ti.value; }; top.append(ti);
    top.append(h('p', 'fine', 'Velg for hvert spørsmål om det skal ha svaralternativer eller tekstsvar. Med alternativer trykker du på det som er riktig. Med tekstsvar skriver du fasiten, og flere godkjente svar skilles med /.'));
    w.append(top);
    Q.qs.forEach((x, k) => {
      const p = h('div', 'panel qe'); const hd = h('div', 'qe-h'); hd.append(h('span', 'lbl', 'Spørsmål ' + (k + 1)));
      if (Q.qs.length > 1) { const del = btn('Fjern', 'sm ghost', () => { Q.qs.splice(k, 1); renderEditor(); }); hd.append(del); }
      p.append(hd);
      p.append(seg([['Svaralternativer', 'mc'], ['Tekstsvar', 'text']], x.t === 'text' ? 'text' : 'mc', (v) => { x.t = v; renderEditor(); }));
      const qi = h('textarea', 'ain'); qi.rows = 2; qi.placeholder = 'Spørsmålet'; qi.value = x.q; qi.maxLength = 200; qi.oninput = () => { x.q = qi.value; }; p.append(qi);
      if (x.t === 'text') { const ai = h('input', 'ain qe-ans'); ai.placeholder = 'Riktig svar, f.eks. Vetle / Vetle K'; ai.value = x.ans || ''; ai.maxLength = 120; ai.oninput = () => { x.ans = ai.value; }; p.append(ai); }
      if (x.t !== 'text') x.o.forEach((o, i) => {
        const r = h('div', 'qe-o c' + i + (x.a === i ? ' on' : ''));
        const mark = h('button', 'mk', x.a === i ? '✓' : QZ_SH[i]); mark.type = 'button'; mark.setAttribute('aria-label', 'Merk som riktig'); mark.onclick = () => { x.a = i; fx.tap(); renderEditor(); };
        const oi = h('input'); oi.placeholder = i < 2 ? 'Svaralternativ ' + (i + 1) : 'Svaralternativ ' + (i + 1) + ' (valgfritt)'; oi.value = o; oi.maxLength = 80; oi.oninput = () => { x.o[i] = oi.value; };
        r.append(mark, oi); p.append(r);
      });
      w.append(p);
    });
    if (Q.qs.length < 50) w.append(btn('+ Legg til spørsmål', 'ghost', () => { const last = Q.qs[Q.qs.length - 1]; Q.qs.push({ t: last && last.t === 'text' ? 'text' : 'mc', q: '', o: ['', '', '', ''], a: 0, ans: '' }); renderEditor(); setTimeout(() => { view.body.scrollTop = view.body.scrollHeight; }, 0); }));
    const msg = h('p', 'fine bl-msg', ''); w.append(msg);
    w.append(btn('Lagre quizen', 'go big', () => {
      const qs = Q.qs.filter((x) => x.q.trim() && (x.t === 'text' ? String(x.ans || '').trim() : x.o.filter((o) => o.trim()).length >= 2 && String(x.o[x.a] || '').trim()));
      if (!Q.title.trim()) { msg.textContent = 'Gi quizen et navn.'; fx.bad(); return; }
      if (!qs.length) { msg.textContent = 'Lag minst ett spørsmål med fasit.'; fx.bad(); return; }
      const out = { id: Q.id, title: Q.title.trim(), by: who() || Q.by || 'Ukjent', at: Date.now(), qs: qs.map((x) => x.t === 'text' ? { t: 'text', q: x.q.trim(), ans: String(x.ans).trim() } : { q: x.q.trim(), o: x.o.map((o) => o.trim()), a: x.a }) };
      qzSave(out); fx.good(); fx.toast('Quizen er lagret. Nå kan de andre spille den.');
      EDIT = null; if (setupState) { setupState.cfg.src = out.id; } renderSetup();
    }));
    view.body.scrollTop = keepY;
  }
  // ============ BLØFFTERNINGER (Liar's Dice) ============
  const DIE_PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function dieEl(v, cls) { const d = h('span', 'die' + (cls ? ' ' + cls : '')); d.setAttribute('aria-label', 'Terning ' + v); for (let i = 0; i < 9; i++) d.append(h('i', DIE_PIPS[v] && DIE_PIPS[v].includes(i) ? 'p' : '')); return d; }
  const ldAlive = (st, S) => S.pl.filter((p) => st.cnt[p.id] > 0);
  const ldTotal = (st) => Object.values(st.cnt).reduce((a, b) => a + b, 0);
  const ldHigher = (b, q, f) => !b || q > b.q || (q === b.q && f > b.f);
  const ldMatch = (v, f, wild) => v === f || (wild && v === 1 && f !== 1);
  function ldRoll(S, st) { S.pl.forEach((p) => { st.dice[p.id] = Array.from({ length: st.cnt[p.id] }, () => 1 + rnd(6)).sort(); }); st.bid = null; st.hist = []; st.ph = 'bid'; st.rev = null; st.t = Date.now(); st.n = (st.n || 0) + 1; }
  function ldNext(S, st, from) { let i = from; for (let k = 0; k < S.pl.length; k++) { i = (i + 1) % S.pl.length; if (st.cnt[S.pl[i].id] > 0) return i; } return from; }
  function ldBot(S, st, pid) {
    const wild = S.cfg.wild !== false, mine = st.dice[pid], unknown = ldTotal(st) - mine.length, p = wild ? 1 / 3 : 1 / 6;
    const exp = (f) => mine.filter((v) => ldMatch(v, f, wild)).length + unknown * (wild && f === 1 ? 1 / 6 : p);
    const slack = S.cfg.lvl === 'lett' ? 1.2 + Math.random() * 1.5 : 0.35 + Math.random() * .5;
    const b = st.bid;
    if (b && b.q > exp(b.f) + slack) return { t: 'call' };
    const faces = wild ? [2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6];
    let best = null, bs = -1e9;
    faces.forEach((f) => { let q = b ? (f > b.f ? b.q : b.q + 1) : Math.max(1, Math.floor(exp(f) - .3)); if (!ldHigher(b, q, f)) q = b.q + 1; const sc = exp(f) - q + Math.random() * .4 + (mine.includes(f) ? .2 : 0); if (sc > bs) { bs = sc; best = { t: 'bid', q, f }; } });
    if (b && bs < -1.3) return { t: 'call' };
    return best;
  }
  const LD = {
    name: 'Bløffterninger', kicker: 'Liar’s Dice', glow: '#3a1d0e', teams: false, minP: 1,
    rules: 'Alle har fem skjulte terninger. Etter tur byr du på hvor mange terninger av et tall det finnes på hele bordet, for eksempel «fire femmere». Neste må by høyere eller si «Tvil!». Da vises alle terninger. Stemmer budet, mister den som tvilte en terning, ellers mister den som bød. Enere er jokere. Sist med terninger vinner.',
    solo: 'Du spiller mot computeren. Velg antall motstandere og nivå under.',
    defaults: () => ({ bots: 3, lvl: 'smart', wild: true }),
    options(cfg, el, re, st) {
      el.append(h('span', 'lbl', 'Computer-motstandere')); el.append(seg([['0', 0], ['1', 1], ['2', 2], ['3', 3], ['4', 4]], cfg.bots, (v) => { cfg.bots = v; re(); }));
      el.append(h('span', 'lbl', 'Nivå')); el.append(seg([['Lett', 'lett'], ['Smart', 'smart']], cfg.lvl, (v) => { cfg.lvl = v; re(); }));
      el.append(h('span', 'lbl', 'Enere er jokere')); el.append(seg([['Ja', true], ['Nei', false]], cfg.wild !== false, (v) => { cfg.wild = v; re(); }));
      if (st && st.where === 'local' && st.pl.length + cfg.bots < 2) el.append(h('p', 'fine', 'Dere trenger minst to spillere. Én computer legges til automatisk.'));
    },
    init(S) {
      S.pl = S.pl.filter((p) => !p.bot);
      let nb = Math.max(0, Math.min(6 - S.pl.length, S.cfg.bots || 0)); if (S.pl.length + nb < 2) nb = 2 - S.pl.length;
      const names = shuffle(BOTN); for (let i = 0; i < nb; i++) S.pl.push({ id: 'b' + i, name: names[i], col: COLS[S.pl.length % COLS.length], bot: true });
      const st = { dice: {}, cnt: {}, out: [], turn: rnd(S.pl.length), n: 0 }; S.pl.forEach((p) => { st.cnt[p.id] = 5; }); ldRoll(S, st); return st;
    },
    move(S, pid, a) {
      const st = S.st, wild = S.cfg.wild !== false;
      if (a.t === 'bid') { const q = Math.max(1, Math.min(ldTotal(st), a.q | 0)), f = a.f | 0; if (f < 1 || f > 6 || (wild && f === 1) || !ldHigher(st.bid, q, f)) return false; st.bid = { q, f, pid }; st.hist.push(st.bid); st.turn = ldNext(S, st, st.turn); st.t = Date.now(); return true; }
      if (a.t === 'call') {
        const b = st.bid; if (!b) return false;
        const all = []; S.pl.forEach((p) => (st.dice[p.id] || []).forEach((v) => all.push(v)));
        const count = all.filter((v) => ldMatch(v, b.f, wild)).length;
        const loser = count >= b.q ? pid : b.pid;
        st.cnt[loser]--; if (st.cnt[loser] <= 0 && !st.out.includes(loser)) st.out.push(loser);
        st.rev = { count, bid: b, caller: pid, loser }; st.ph = 'rev'; st.t = Date.now();
        st.over = ldAlive(st, S).length <= 1;
        return true;
      }
      return false;
    },
    act(S, a, by) {
      const st = S.st; if (st.end) return false;
      if (a.t === 'next') { if (st.ph !== 'rev' || !(by === S.host || !S.on)) return false; if (st.over) { st.end = {}; return true; } const L2 = S.pl.findIndex((p) => p.id === st.rev.loser); st.turn = st.cnt[st.rev.loser] > 0 ? L2 : ldNext(S, st, L2); ldRoll(S, st); return true; }
      const cur = S.pl[st.turn]; if (st.ph !== 'bid' || !cur || cur.bot || !canBy(cur.id, by)) return false;
      return LD.move(S, cur.id, a);
    },
    tick(S) {
      const st = S.st, cur = S.pl[st.turn]; if (st.end || st.ph !== 'bid' || !cur || !cur.bot) return false;
      if (Date.now() - st.t < 1300) return false;
      const a = ldBot(S, st, cur.id); if (!a || !LD.move(S, cur.id, a)) LD.move(S, cur.id, { t: 'call' }); return true;
    },
    key(S) { const st = S.st; return [st.n, st.ph, st.turn, st.hist.length].join(':'); },
    view(S, c, w) {
      const st = S.st, cur = S.pl[st.turn], wild = S.cfg.wild !== false;
      const humans = S.pl.filter((p) => !p.bot);
      let me = null;
      if (S.on) me = S.pl.find((p) => !p.bot && membersOf(p).includes(who())) || null;
      else if (humans.length === 1) me = humans[0];
      else if (st.ph === 'bid' && cur && !cur.bot) { if (handoff(w, cur.id, 'ld' + st.n + ':' + st.hist.length + cur.id, 'Din tur i Bløffterninger')) return; me = cur; }
      w.classList.add('ld-table');
      const mine = st.ph === 'bid' && me && cur && cur.id === me.id;
      // Spillere med kopper
      const pr = h('div', 'ld-pl');
      S.pl.forEach((p, i) => {
        const d = h('div', 'lp' + (st.ph === 'bid' && i === st.turn ? ' on' : '') + (st.cnt[p.id] <= 0 ? ' out' : '')); d.style.setProperty('--pc', p.col);
        const cup = h('span', 'cup'); cup.append(h('b', '', String(st.cnt[p.id])));
        d.append(cup, h('span', 'nm', p.name + (me && p.id === me.id ? ' (deg)' : '')));
        const lb = st.hist.slice().reverse().find((x) => x.pid === p.id); if (lb && st.ph === 'bid') { const bb = h('span', 'lb'); bb.append(h('b', '', lb.q + '×'), dieEl(lb.f, 'xs')); d.append(bb); }
        pr.append(d);
      });
      w.append(pr);
      // Budet
      const bd = h('div', 'ld-bid');
      const b = st.ph === 'rev' ? st.rev.bid : st.bid;
      if (b) { bd.append(h('span', 'k', pname(b.pid) + ' byr')); const v = h('div', 'v'); v.append(h('b', '', String(b.q)), h('span', 'x', '×'), dieEl(b.f, 'lg')); bd.append(v); bd.append(h('span', 'k2', 'av ' + ldTotal(st) + (st.ph === 'rev' ? '' : '') + ' terninger på bordet' + (wild ? ' · enere er jokere' : ''))); }
      else { bd.append(h('span', 'k', 'Nytt kast')); bd.append(h('b', 'v0', (cur ? cur.name : '') + ' byr først')); bd.append(h('span', 'k2', ldTotal(st) + ' terninger på bordet')); }
      w.append(bd);
      if (UI.ldH !== st.n + ':' + st.hist.length) { if (UI.ldH != null) fx.sel(); UI.ldH = st.n + ':' + st.hist.length; }
      if (st.ph === 'rev') {
        if (UI.ldR !== st.n) { UI.ldR = st.n; const lost = !!(me && st.rev.loser === me.id); L('noise', .5, 'lowpass', 400, 2000, .01, .4, 1); setTimeout(() => (lost ? fx.bad() : fx.good()), 500); }
        const R = st.rev; const res = h('div', 'ld-rev');
        res.append(h('b', '', pname(R.caller) + ' tvilte!'));
        res.append(h('span', '', 'Det var ' + R.count + ' ' + (R.count === 1 ? 'terning' : 'terninger') + ' som teller. ' + pname(R.loser) + ' mister en terning' + (st.cnt[R.loser] <= 0 ? ' og er ute.' : '.')));
        w.append(res);
        const all = h('div', 'ld-all');
        S.pl.forEach((p) => { if (!(st.dice[p.id] || []).length) return; const r = h('div', 'ar2'); r.style.setProperty('--pc', p.col); r.append(h('span', 'nm', p.name)); const ds = h('span', 'ds'); st.dice[p.id].forEach((v, k) => { const e = dieEl(v, ldMatch(v, R.bid.f, wild) ? 'hit' : 'dim'); e.style.animationDelay = (k * 60) + 'ms'; ds.append(e); }); r.append(ds); all.append(r); });
        w.append(all);
        if (isHost()) w.append(btn(st.over ? 'Se resultatet' : 'Neste kast', 'go big', () => dispatch({ t: 'next' }))); else watchLine(w, 'Venter på ' + S.host);
        return;
      }
      // Mine terninger
      if (me) {
        const md = h('div', 'ld-mine'); md.style.setProperty('--pc', me.col); md.append(h('span', 'k', 'Dine terninger'));
        const ds = h('div', 'ds'); (st.dice[me.id] || []).forEach((v, k) => { const e = dieEl(v, 'big'); e.style.animationDelay = (k * 70) + 'ms'; ds.append(e); }); if (!(st.dice[me.id] || []).length) ds.append(h('span', 'fine', 'Du er ute. Se hvem som vinner.'));
        md.append(ds); w.append(md);
      }
      if (mine) {
        const fs = wild ? [2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6];
        if (UI.ldKey !== st.n + ':' + st.hist.length) { UI.ldKey = st.n + ':' + st.hist.length; const bb = st.bid; UI.ldF = bb ? bb.f : fs[0]; UI.ldQ = bb ? bb.q : 1; if (!ldHigher(bb, UI.ldQ, UI.ldF)) UI.ldQ = (bb ? bb.q : 0) + 1; }
        const pick = h('div', 'ld-pick');
        const qrow = h('div', 'qrow'); const minus = btn('−', 'ghost', () => { if (UI.ldQ > 1) { UI.ldQ--; fx.tap(); UI.key = null; render(); } }); const plus = btn('+', 'ghost', () => { if (UI.ldQ < ldTotal(st)) { UI.ldQ++; fx.tap(); UI.key = null; render(); } });
        qrow.append(minus, h('b', '', String(UI.ldQ)), plus); pick.append(qrow);
        const frow = h('div', 'frow'); fs.forEach((f) => { const fb = h('button', 'fb' + (UI.ldF === f ? ' on' : '')); fb.type = 'button'; fb.append(dieEl(f)); fb.onclick = () => { UI.ldF = f; fx.tap(); UI.key = null; render(); }; frow.append(fb); }); pick.append(frow);
        w.append(pick);
        const ok = ldHigher(st.bid, UI.ldQ, UI.ldF);
        const r = h('div', 'arow');
        const bidb = btn('By ' + UI.ldQ + ' × ' + UI.ldF + (UI.ldF === 1 ? '' : (UI.ldQ === 1 ? '' : 'ere')), 'go', () => { fx.whoosh(); dispatch({ t: 'bid', q: UI.ldQ, f: UI.ldF }); }); bidb.disabled = !ok; bidb.style.flex = '2 1 auto';
        r.append(bidb);
        if (st.bid) { const cb = btn('Tvil!', 'ld-call', () => { askConfirm('Tvile på budet?', pname(st.bid.pid) + ' byr ' + st.bid.q + ' × ' + st.bid.f + '. Alle terninger vises.', 'Tvil!', () => dispatch({ t: 'call' })); }); cb.style.flex = '1 1 auto'; r.append(cb); }
        w.append(r);
        if (!ok) w.append(h('p', 'fine', 'Budet må være høyere: flere terninger, eller like mange med høyere tall.'));
      } else if (cur) { const wl = h('div', 'watch'); wl.textContent = cur.bot ? cur.name + ' tenker …' : cur.name + ' sin tur'; w.append(wl); }
    },
    rank(S) {
      const st = S.st; const alive = S.pl.filter((p) => st.cnt[p.id] > 0).sort((a, b) => st.cnt[b.id] - st.cnt[a.id]);
      const order = alive.concat(st.out.slice().reverse().map((id) => S.pl.find((p) => p.id === id)));
      return order.map((p, i) => ({ id: p.id, name: p.name, col: p.col, val: st.cnt[p.id] > 0 ? st.cnt[p.id] + (st.cnt[p.id] === 1 ? ' terning igjen' : ' terninger igjen') : (i + 1) + '. plass', n: S.pl.length - i }));
    }
  };

  // ============ SENKE SLAGSKIP ============
  const SB_N = 8, SB_FLEET = [4, 3, 3, 2, 2];
  // Gyldig flåte: riktige lengder, rette linjer innenfor brettet, ingen overlapp og ingen som ligger inntil hverandre
  function sbValid(ships) {
    if (!Array.isArray(ships) || ships.length !== SB_FLEET.length) return false;
    const lens = ships.map((s) => (Array.isArray(s) ? s.length : 0)).sort((p, q) => q - p); const want = SB_FLEET.slice().sort((p, q) => q - p);
    if (lens.some((l, i) => l !== want[i])) return false;
    const owner = new Map();
    for (let k = 0; k < ships.length; k++) {
      const s = ships[k].map((i) => i | 0); if (s.some((i) => i < 0 || i >= SB_N * SB_N)) return false;
      const hz = s.length < 2 || s[1] - s[0] === 1;
      for (let j = 1; j < s.length; j++) { if (hz ? (s[j] - s[j - 1] !== 1 || Math.floor(s[j] / SB_N) !== Math.floor(s[0] / SB_N)) : s[j] - s[j - 1] !== SB_N) return false; }
      for (const i of s) { if (owner.has(i)) return false; owner.set(i, k); }
    }
    for (const [i, k] of owner) { const r = Math.floor(i / SB_N), c = i % SB_N; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const r2 = r + dr, c2 = c + dc; if (r2 < 0 || r2 >= SB_N || c2 < 0 || c2 >= SB_N) continue; const o = owner.get(r2 * SB_N + c2); if (o != null && o !== k) return false; } }
    return true;
  }
  function sbCells(i, len, hz) {
    let r = Math.floor(i / SB_N), c = i % SB_N;
    if (hz) c = Math.min(c, SB_N - len); else r = Math.min(r, SB_N - len);
    return Array.from({ length: len }, (_, k) => (hz ? r * SB_N + c + k : (r + k) * SB_N + c));
  }
  // Plasser flåten selv
  function sbPlacer(S, w, me, foe) {
    const key = S.st.t + ':' + me.id;
    if (!UI.sbd || UI.sbd.k !== key) UI.sbd = { k: key, ships: [], hz: true };
    const D2 = UI.sbd; const placed = D2.ships.map((s) => s.length).slice();
    const queue = SB_FLEET.slice(); placed.forEach((l) => { const j = queue.indexOf(l); if (j >= 0) queue.splice(j, 1); });
    const nextLen = queue[0];
    const head = h('div', 'sb-place');
    head.append(h('span', 'lbl', queue.length ? 'Sett ut skip: ' + nextLen + ' ruter, ' + (D2.hz ? 'vannrett' : 'loddrett') : 'Hele flåten er på plass'));
    const q = h('div', 'sb-q'); SB_FLEET.forEach((l, i) => { const used = i < SB_FLEET.length - queue.length; const s = h('span', 'sb-qs' + (used ? ' used' : '') + (!used && i === SB_FLEET.length - queue.length ? ' cur' : '')); for (let k = 0; k < l; k++) s.append(h('i')); q.append(s); }); head.append(q);
    w.append(head);
    const fake = { ships: { [me.id]: D2.ships }, shots: {}, last: null };
    const g = SB.grid(fake, me.id, foe.id, { showShips: true, click: (i) => {
      const hit = D2.ships.findIndex((s) => s.includes(i));
      if (hit >= 0) { D2.ships.splice(hit, 1); fx.tap(); UI.key = null; render(); return; }
      if (!queue.length) return;
      const cells = sbCells(i, nextLen, D2.hz); const test = D2.ships.concat([cells]);
      const okSoFar = (() => { const pad = test.slice(); const tmp = SB_FLEET.slice(); pad.forEach((s) => { const j = tmp.indexOf(s.length); if (j >= 0) tmp.splice(j, 1); }); return sbValidPartial(test); })();
      if (!okSoFar) { fx.bad(); fx.toast('Ikke plass der. Skipene kan ikke ligge inntil hverandre.'); return; }
      D2.ships.push(cells); L('noise', .2, 'lowpass', 600, 200, .01, .25, 1); L('buzz', 15); UI.key = null; render();
    } });
    g.classList.add('placing'); w.append(g);
    const r = h('div', 'arow');
    r.append(btn('↻ Roter', 'ghost', () => { D2.hz = !D2.hz; fx.tap(); UI.key = null; render(); }));
    r.append(btn('Tilfeldig', 'ghost', () => { D2.ships = sbPlace(); fx.whoosh(); UI.key = null; render(); }));
    if (D2.ships.length) r.append(btn('Tøm', 'ghost', () => { D2.ships = []; fx.tap(); UI.key = null; render(); }));
    w.append(r);
    const go = btn('Klar!', 'go big', () => { if (!sbValid(D2.ships)) return; fx.good(); dispatch({ t: 'setships', pid: me.id, ships: D2.ships }); });
    go.disabled = !sbValid(D2.ships); w.append(go);
    w.append(h('p', 'fine', 'Trykk på en rute for å sette ut neste skip. Trykk på et skip for å ta det opp igjen.'));
  }
  function sbValidPartial(ships) {
    const owner = new Map();
    for (let k = 0; k < ships.length; k++) for (const i of ships[k]) { if (owner.has(i)) return false; owner.set(i, k); }
    for (const [i, k] of owner) { const r = Math.floor(i / SB_N), c = i % SB_N; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const r2 = r + dr, c2 = c + dc; if (r2 < 0 || r2 >= SB_N || c2 < 0 || c2 >= SB_N) continue; const o = owner.get(r2 * SB_N + c2); if (o != null && o !== k) return false; } }
    return true;
  }
  function sbPlace() {
    for (let tries = 0; tries < 200; tries++) {
      const occ = new Set(), ships = []; let ok = true;
      for (const len of SB_FLEET) {
        let placed = false;
        for (let t = 0; t < 200 && !placed; t++) {
          const hz = Math.random() < .5, r = rnd(hz ? SB_N : SB_N - len + 1), c = rnd(hz ? SB_N - len + 1 : SB_N);
          const cells = Array.from({ length: len }, (_, k) => hz ? r * SB_N + c + k : (r + k) * SB_N + c);
          // ikke rør hverandre
          const near = (i) => { const rr = Math.floor(i / SB_N), cc = i % SB_N; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const r2 = rr + dr, c2 = cc + dc; if (r2 >= 0 && r2 < SB_N && c2 >= 0 && c2 < SB_N && occ.has(r2 * SB_N + c2)) return true; } return false; };
          if (cells.some(near)) continue;
          cells.forEach((i) => occ.add(i)); ships.push(cells); placed = true;
        }
        if (!placed) { ok = false; break; }
      }
      if (ok) return ships;
    }
    return [];
  }
  const sbSunk = (ship, shots) => ship.every((i) => shots.includes(i));
  function sbAi(st, me, foe) {
    const shots = st.shots[me], ships = st.ships[foe];
    const hit = (i) => ships.some((s) => s.includes(i));
    const open = (i) => i >= 0 && i < SB_N * SB_N && !shots.includes(i);
    const live = shots.filter((i) => hit(i) && !ships.find((s) => s.includes(i) && sbSunk(s, shots)));
    const nb = (i) => { const r = Math.floor(i / SB_N), c = i % SB_N; return [r > 0 ? i - SB_N : -1, r < SB_N - 1 ? i + SB_N : -1, c > 0 ? i - 1 : -1, c < SB_N - 1 ? i + 1 : -1].filter(open); };
    if (live.length >= 2) { const sameRow = live.every((i) => Math.floor(i / SB_N) === Math.floor(live[0] / SB_N)); const sorted = live.slice().sort((a, b) => a - b); const step = sameRow ? 1 : SB_N; const ends = [sorted[0] - step, sorted[sorted.length - 1] + step].filter((i) => open(i) && (!sameRow || Math.floor(i / SB_N) === Math.floor(sorted[0] / SB_N))); if (ends.length) return ends[rnd(ends.length)]; }
    if (live.length) { const c = live.flatMap(nb); if (c.length) return c[rnd(c.length)]; }
    const cand = []; for (let i = 0; i < SB_N * SB_N; i++) if (open(i) && ((Math.floor(i / SB_N) + i) % 2 === 0)) cand.push(i);
    const pool = cand.length ? cand : Array.from({ length: SB_N * SB_N }, (_, i) => i).filter(open);
    return pool[rnd(pool.length)];
  }
  const SB = {
    name: 'Senke slagskip', kicker: 'Én mot én', glow: '#0e2a4a', teams: false, minP: 1, finishLabel: 'Gi opp',
    rules: 'To flåter på hvert sitt hav, 8 × 8 ruter. Trykk på en rute i motstanderens hav for å skyte. Treffer du, får du skyte igjen. Den som først senker hele flåten til den andre, vinner. Før start plasserer du skipene selv: trykk på en rute for å sette ut neste skip, snu det med «Roter», og trykk på et skip for å flytte det. Skipene kan ikke ligge inntil hverandre.',
    solo: 'Du spiller mot computeren. Skal dere være to, legg til en spiller til.',
    defaults: () => ({ lvl: 'smart', again: true }),
    options(cfg, el, re, st) {
      el.append(h('span', 'lbl', 'Computerens nivå')); el.append(seg([['Lett', 'lett'], ['Smart', 'smart']], cfg.lvl, (v) => { cfg.lvl = v; re(); }));
      el.append(h('span', 'lbl', 'Treff gir nytt skudd')); el.append(seg([['Ja', true], ['Nei', false]], cfg.again !== false, (v) => { cfg.again = v; re(); }));
      if (st && st.where === 'local' && st.pl.length > 2) el.append(h('p', 'fine', 'Bare de to første spiller. Fjern noen for å spille én mot én.'));
      if (st && st.where === 'online') el.append(h('p', 'fine', 'De to første i rommet spiller. Er du alene i rommet, spiller du mot computeren.'));
    },
    init(S) {
      S.pl = S.pl.filter((p) => !p.bot).slice(0, 2);
      if (S.pl.length < 2) S.pl.push({ id: 'b0', name: shuffle(BOTN)[0], col: COLS[1], bot: true });
      const st = { ships: {}, shots: {}, ready: {}, ph: 'place', turn: rnd(2), last: null, n: 0, t: Date.now() };
      S.pl.forEach((p) => { st.ships[p.id] = p.bot ? sbPlace() : []; st.shots[p.id] = []; st.ready[p.id] = !!p.bot; });
      return st;
    },
    act(S, a, by) {
      const st = S.st; if (st.end) return false;
      if (a.t === 'shuffle' && st.ph === 'place') { const p = S.pl.find((x) => x.id === a.pid); if (!p || p.bot || !canBy(p.id, by) || st.ready[p.id]) return false; st.ships[p.id] = sbPlace(); st.n++; return true; }
      if (a.t === 'setships' && st.ph === 'place') { const p = S.pl.find((x) => x.id === a.pid); if (!p || p.bot || !canBy(p.id, by) || st.ready[p.id] || !sbValid(a.ships)) return false; st.ships[p.id] = a.ships.map((s) => s.map((i) => i | 0)); st.ready[p.id] = true; if (S.pl.every((x) => st.ready[x.id])) { st.ph = 'play'; st.t = Date.now(); } st.n++; return true; }
      if (a.t === 'ready' && st.ph === 'place') { const p = S.pl.find((x) => x.id === a.pid); if (!p || p.bot || !canBy(p.id, by) || !sbValid(st.ships[p.id])) return false; st.ready[p.id] = true; if (S.pl.every((x) => st.ready[x.id])) { st.ph = 'play'; st.t = Date.now(); } st.n++; return true; }
      const cur = S.pl[st.turn]; if (st.ph !== 'play' || !cur || cur.bot || !canBy(cur.id, by)) return false;
      if (a.t === 'shoot') return SB.shoot(S, cur.id, a.i | 0);
      return false;
    },
    shoot(S, pid, i) {
      const st = S.st, foe = S.pl.find((p) => p.id !== pid).id; if (i < 0 || i >= SB_N * SB_N || st.shots[pid].includes(i)) return false;
      st.shots[pid].push(i); const ship = st.ships[foe].find((s) => s.includes(i)); const hit = !!ship; const sunk = hit && sbSunk(ship, st.shots[pid]);
      st.last = { pid, i, hit, sunk: sunk ? ship.length : 0 }; st.n++; st.t = Date.now();
      if (st.ships[foe].every((s) => sbSunk(s, st.shots[pid]))) { st.end = { win: pid }; st.winner = pid; return true; }
      if (!hit || S.cfg.again === false) st.turn = 1 - st.turn;
      return true;
    },
    tick(S) {
      const st = S.st, cur = S.pl[st.turn]; if (st.end || st.ph !== 'play' || !cur || !cur.bot) return false;
      if (Date.now() - st.t < 900) return false;
      const foe = S.pl.find((p) => p.id !== cur.id).id; let i = S.cfg.lvl === 'lett' && Math.random() < .5 ? (() => { const o = []; for (let k = 0; k < SB_N * SB_N; k++) if (!st.shots[cur.id].includes(k)) o.push(k); return o[rnd(o.length)]; })() : sbAi(st, cur.id, foe);
      SB.shoot(S, cur.id, i); return true;
    },
    key(S) { const st = S.st; return [st.ph, st.n, st.turn].join(':'); },
    grid(st, owner, viewer, opt) {
      const g = h('div', 'sb-grid' + (opt.small ? ' small' : '')); const shots = st.shots[viewer] || [], ships = st.ships[owner] || [];
      for (let i = 0; i < SB_N * SB_N; i++) {
        const cell = h(opt.click ? 'button' : 'span', 'sc'); if (opt.click) cell.type = 'button';
        const ship = ships.find((s) => s.includes(i)); const shot = shots.includes(i);
        if (opt.showShips && ship) { cell.classList.add('ship'); const k = ship.indexOf(i), hz = ship.length > 1 && ship[1] - ship[0] === 1; if (k === 0) cell.classList.add(hz ? 'l' : 't'); if (k === ship.length - 1) cell.classList.add(hz ? 'r' : 'b'); }
        if (shot && ship) { cell.classList.add('hit'); if (sbSunk(ship, shots)) cell.classList.add('sunk'); }
        else if (shot) cell.classList.add('miss');
        if (st.last && st.last.i === i && st.last.pid === viewer) cell.classList.add('new');
        if (opt.click && !shot) cell.onclick = () => opt.click(i); else if (opt.click) cell.disabled = true;
        g.append(cell);
      }
      return g;
    },
    view(S, c, w) {
      const st = S.st, cur = S.pl[st.turn];
      const humans = S.pl.filter((p) => !p.bot);
      let me = null;
      if (S.on) me = S.pl.find((p) => !p.bot && membersOf(p).includes(who())) || null;
      else if (humans.length === 1) me = humans[0];
      else if (st.ph === 'place') { const nx = humans.find((p) => !st.ready[p.id]); if (nx) { if (handoff(w, nx.id, 'sbp' + nx.id, 'Plasser flåten din')) return; me = nx; } }
      else if (cur && !cur.bot) { if (handoff(w, cur.id, 'sb' + st.n + cur.id, 'Din tur å skyte')) return; me = cur; }
      w.classList.add('sb-sea');
      const foe = me ? S.pl.find((p) => p.id !== me.id) : null;
      const left = (pid) => { const o = S.pl.find((p) => p.id !== pid).id; return st.ships[pid].filter((s) => !sbSunk(s, st.shots[o])).length; };
      const top = h('div', 'sb-top'); S.pl.forEach((p, i) => { const d = h('div', 'sp' + (st.ph === 'play' && i === st.turn ? ' on' : '')); d.style.setProperty('--pc', p.col); d.append(h('b', '', p.name), h('span', '', st.ph === 'place' ? (st.ready[p.id] ? 'Klar' : 'Plasserer flåten') : left(p.id) + ' av ' + SB_FLEET.length + ' skip igjen')); top.append(d); }); w.append(top);
      if (st.ph === 'place') {
        if (me && !st.ready[me.id]) {
          sbPlacer(S, w, me, foe);
        } else watchLine(w, 'Venter på at ' + S.pl.filter((p) => !st.ready[p.id]).map((p) => p.name).join(' og ') + ' plasserer flåten …');
        return;
      }
      if (UI.sbN !== st.n) { if (UI.sbN != null && st.last) { if (st.last.hit) { L('noise', .35, 'lowpass', 900, 120, .005, .6, 1); L('buzz', [60, 30, 90]); if (st.last.sunk) setTimeout(() => fx.toast((st.last.pid === (me && me.id) ? 'Du senket et skip på ' : pname(st.last.pid) + ' senket et skip på ') + st.last.sunk + '!'), 200); } else L('noise', .25, 'bandpass', 1800, 600, .01, .2, 1.4); } UI.sbN = st.n; }
      const mine = me && cur && cur.id === me.id;
      const ban = h('div', 'sv-ban' + (mine ? ' me' : '')); ban.style.setProperty('--pc', cur ? cur.col : '#888');
      ban.append(h('b', '', mine ? 'Skyt!' : (cur ? (cur.bot ? cur.name + ' sikter' : cur.name + ' skyter') : '')));
      if (st.last) ban.append(h('span', '', pname(st.last.pid) + (st.last.hit ? (st.last.sunk ? ' senket et skip!' : ' traff!') : ' bommet.')));
      w.append(ban);
      if (me) {
        w.append(h('span', 'lbl', 'Fiendens hav · ' + foe.name));
        w.append(SB.grid(st, foe.id, me.id, { showShips: false, click: mine ? (i) => { dispatch({ t: 'shoot', i }); } : null }));
        w.append(h('span', 'lbl', 'Ditt hav'));
        w.append(SB.grid(st, me.id, foe.id, { showShips: true, small: true }));
      } else { S.pl.forEach((p) => { const o = S.pl.find((x) => x.id !== p.id); w.append(h('span', 'lbl', p.name + ' sitt hav')); w.append(SB.grid(st, p.id, o.id, { showShips: false, small: true })); }); }
    },
    endView(S, w) {
      const st = S.st, win = st.end && st.end.win; const tr = h('div', 'trophy'); tr.innerHTML = win ? TROPHY : ''; tr.append(h('span', 'lbl', 'Senke slagskip'), h('b', '', win ? pname(win) + ' vant!' : 'Avsluttet'));
      if (win) { const o = S.pl.find((p) => p.id !== win).id; const sh = st.shots[win].length; tr.append(h('p', 'fine', sh + ' skudd, ' + Math.round(17 / sh * 100) + ' % treff')); }
      w.append(tr);
      S.pl.forEach((p) => { const o = S.pl.find((x) => x.id !== p.id); w.append(h('span', 'lbl', p.name + ' sin flåte')); w.append(SB.grid(st, p.id, o.id, { showShips: true, small: true })); });
    },
    rank(S) { const st = S.st, win = st.end && st.end.win; return S.pl.map((p) => ({ id: p.id, name: p.name, col: p.col, val: p.id === win ? 'Vinner' : '', n: p.id === win ? 1 : 0 })).sort((a, b) => b.n - a.n); }
  };

  // ============ POSTSORTEREREN ============
  const PS_PLACES = [['0150', 'OSLO'], ['0560', 'OSLO'], ['1366', 'LYSAKER'], ['1601', 'FREDRIKSTAD'], ['1701', 'SARPSBORG'], ['2000', 'LILLESTRØM'], ['2317', 'HAMAR'], ['2609', 'LILLEHAMMER'], ['2815', 'GJØVIK'], ['3015', 'DRAMMEN'], ['3110', 'TØNSBERG'], ['3510', 'HØNEFOSS'], ['3715', 'SKIEN'], ['3920', 'PORSGRUNN'], ['4006', 'STAVANGER'], ['4306', 'SANDNES'], ['4608', 'KRISTIANSAND'], ['4836', 'ARENDAL'], ['5003', 'BERGEN'], ['5221', 'NESTTUN'], ['5300', 'KLEPPESTØ'], ['5411', 'STORD'], ['5700', 'VOSS'], ['6002', 'ÅLESUND'], ['6413', 'MOLDE'], ['6100', 'VOLDA'], ['7010', 'TRONDHEIM'], ['7500', 'STJØRDAL'], ['7713', 'STEINKJER'], ['8006', 'BODØ'], ['8300', 'SVOLVÆR'], ['8514', 'NARVIK'], ['9008', 'TROMSØ'], ['9405', 'HARSTAD'], ['9600', 'HAMMERFEST'], ['9900', 'KIRKENES']];
  const PS_NAMES = ['Kari Nordmann', 'Ola Hansen', 'Ingrid Berg', 'Per Olsen', 'Sigrid Lie', 'Lars Dahl', 'Astrid Moen', 'Knut Bakke', 'Fredrik', 'Elias', 'Vetle', 'Lasse', 'Eirik', 'Styret i Lubben', 'Bestemor Gunvor', 'Skatteetaten', 'Den som tok siste ølen', 'Hr. Pedersen', 'Fru Haugen', 'Naboen'];
  const PS_STREETS = ['Storgata 1', 'Kirkeveien 12', 'Fjordvegen 7', 'Bakkeløkka 3', 'Sjøgata 22', 'Torget 5', 'Skolevegen 9', 'Postboks 100', 'Lubbeveien 26', 'Fjellstien 4'];
  const PS_FLAGS = { 'Europa': 'NO SE DK FI DE FR GB IE NL BE ES PT IT CH AT PL CZ GR HR UA EE LV LT HU RO', 'Asia': 'JP CN KR IN TH VN ID PH MY SA AE IL PK NP SG', 'Afrika': 'ZA EG NG KE MA GH ET TN SN TZ', 'Nord-Amerika': 'US CA MX CU JM PA CR', 'Sør-Amerika': 'BR AR CL CO PE UY VE EC', 'Oseania': 'AU NZ FJ PG WS' };
  const flagEmoji = (cc) => String.fromCodePoint(...[...cc].map((c) => 0x1F1E6 + c.charCodeAt(0) - 65));
  const PS_LEVELS = {
    klassisk: { name: 'Klassisk', slots: [] },
    flagg: { name: 'Flagg', slots: Object.keys(PS_FLAGS).map((k) => [k, '']), t0: 3800 },
    lett: { name: 'Lett', slots: [['OSLO', 'OSLO'], ['BERGEN', 'BERGEN'], ['STAVANGER', 'STAVANGER'], ['TRONDHEIM', 'TRONDHEIM'], ['TROMSØ', 'TROMSØ'], ['KRISTIANSAND', 'KRISTIANSAND']], t0: 3600 },
    norm: { name: 'Postnummer', slots: [['0–2', 'Østlandet'], ['3–4', 'Sør og sørvest'], ['5', 'Vestland'], ['6–7', 'Møre og Trøndelag'], ['8', 'Nordland'], ['9', 'Troms og Finnmark']], t0: 3600 },
    kaos: { name: 'Kaos', slots: [['0–3', 'Øst'], ['4–5', 'Sør og vest'], ['6–7', 'Møre og Trøndelag'], ['8–9', 'Nord'], ['EKSPRESS', 'Rødt stempel'], ['RETUR', 'Uten frimerke']], t0: 3300 }
  };
  function psSlotFor(lvl, L) {
    if (lvl === 'flagg') return Object.keys(PS_FLAGS).indexOf(L.cont);
    if (lvl === 'lett') return PS_LEVELS.lett.slots.findIndex((s) => s[0] === L.city);
    if (lvl === 'kaos') { if (!L.stamp) return 5; if (L.express) return 4; const d = +L.zip[0]; return d <= 3 ? 0 : d <= 5 ? 1 : d <= 7 ? 2 : 3; }
    const d = +L.zip[0]; return d <= 2 ? 0 : d <= 4 ? 1 : d === 5 ? 2 : d <= 7 ? 3 : d === 8 ? 4 : 5;
  }
  function psLetter(lvl) {
    const pool = lvl === 'lett' ? PS_PLACES.filter((p) => PS_LEVELS.lett.slots.some((s) => s[0] === p[1])) : PS_PLACES;
    const p = pool[rnd(pool.length)];
    const L = { zip: p[0], city: p[1], name: PS_NAMES[rnd(PS_NAMES.length)], street: PS_STREETS[rnd(PS_STREETS.length)], stamp: true, express: false, tilt: (Math.random() - .5) * 8, hue: rnd(4) };
    if (lvl === 'kaos') { const r = Math.random(); if (r < .14) L.stamp = false; else if (r < .3) L.express = true; }
    if (lvl === 'flagg') { const ks = Object.keys(PS_FLAGS); const cont = ks[rnd(ks.length)]; const cs2 = PS_FLAGS[cont].split(' '); L.cont = cont; L.flag = cs2[rnd(cs2.length)]; }
    return L;
  }
  // Klassisk postsortering i verkstedstil: trekasser med sekk og flaggskilt på rullebåndet, blått sorteringsbord, brev med adresse og malt flagg
  const PSC_ORDER = ['NO', 'DK', 'SE', 'FI', 'DE', 'GB', 'NL', 'FR', 'IT', 'ES', 'CH', 'US'];
  const PSC_ADR = {
    NO: { land: 'Norway', f: ['Kari', 'Ole', 'Ingrid', 'Arne', 'Solveig', 'Knut', 'Ragnhild', 'Torbjørn', 'Gunnhild', 'Sverre'], e: ['Haugen', 'Bakke', 'Lunde', 'Myklebust', 'Fossum', 'Rønning', 'Solberg', 'Tveit', 'Moe', 'Brekke'], p: [['0578', 'Oslo'], ['1061', 'Oslo'], ['1395', 'Hvalstad'], ['5003', 'Bergen'], ['7010', 'Trondheim'], ['4006', 'Stavanger'], ['9008', 'Tromsø'], ['6002', 'Ålesund'], ['2609', 'Lillehammer'], ['8006', 'Bodø']] },
    DK: { land: 'Denmark', f: ['Laila', 'Vidar', 'Mette', 'Søren', 'Birgitte', 'Jens', 'Lone', 'Mads', 'Hanne', 'Niels'], e: ['Rasmussen', 'Kjærgaard', 'Holm', 'Bech', 'Mortensen', 'Lund', 'Dahl', 'Krogh', 'Juhl', 'Skov'], p: [['9700', 'Brønderslev'], ['2880', 'Bagsværd'], ['8000', 'Aarhus C'], ['5000', 'Odense C'], ['9000', 'Aalborg'], ['6700', 'Esbjerg'], ['1050', 'København K'], ['7100', 'Vejle'], ['4000', 'Roskilde'], ['3000', 'Helsingør']] },
    SE: { land: 'Sweden', f: ['Anders', 'Cecilie', 'Henning', 'Britt', 'Göran', 'Agneta', 'Lennart', 'Margareta', 'Sven', 'Ulla'], e: ['Lindqvist', 'Bergström', 'Sjöberg', 'Nyström', 'Holmgren', 'Ek', 'Wallin', 'Forsberg', 'Åberg', 'Lund'], p: [['981 10', 'Kiruna'], ['451 30', 'Uddevalla'], ['111 52', 'Stockholm'], ['411 03', 'Göteborg'], ['211 20', 'Malmö'], ['753 10', 'Uppsala'], ['903 26', 'Umeå'], ['831 30', 'Östersund'], ['652 24', 'Karlstad'], ['352 30', 'Växjö']] },
    FI: { land: 'Finland', f: ['Oskari', 'Onni', 'Jarkko', 'Aino', 'Pirjo', 'Matti', 'Tuula', 'Juha', 'Riitta', 'Eero'], e: ['Hakkinen', 'Hämäläinen', 'Toivonen', 'Virtanen', 'Korhonen', 'Nieminen', 'Laine', 'Heikkinen', 'Koskinen', 'Salo'], p: [['65800', 'Raippaluoto'], ['60800', 'Ilmajoki'], ['33400', 'Tampere'], ['00100', 'Helsinki'], ['20100', 'Turku'], ['90100', 'Oulu'], ['96100', 'Rovaniemi'], ['40100', 'Jyväskylä'], ['70100', 'Kuopio'], ['15100', 'Lahti']] },
    DE: { land: 'Germany', f: ['Klaus', 'Ursula', 'Dieter', 'Heike', 'Jürgen', 'Monika', 'Wolfgang', 'Sabine'], e: ['Müller', 'Schneider', 'Fischer', 'Weber', 'Becker', 'Hoffmann', 'Wagner', 'Schulz'], p: [['10115', 'Berlin'], ['20095', 'Hamburg'], ['80331', 'München'], ['50667', 'Köln'], ['60311', 'Frankfurt'], ['24103', 'Kiel']] },
    GB: { land: 'England', f: ['Margaret', 'Nigel', 'Pamela', 'Colin', 'Gillian', 'Trevor'], e: ['Whitfield', 'Ashby', 'Pemberton', 'Hughes', 'Thornton', 'Bramley'], p: [['SW1A 1AA', 'London'], ['M1 1AE', 'Manchester'], ['YO1 7HH', 'York'], ['B1 1BB', 'Birmingham'], ['BS1 4DJ', 'Bristol']], gb: true },
    NL: { land: 'Netherlands', f: ['Henk', 'Ineke', 'Joost', 'Marieke', 'Pieter', 'Anouk'], e: ['de Vries', 'Jansen', 'Bakker', 'Visser', 'Smit', 'van Dijk'], p: [['1012 AB', 'Amsterdam'], ['3011 AD', 'Rotterdam'], ['3511 LX', 'Utrecht'], ['9711 LM', 'Groningen']] },
    FR: { land: 'France', f: ['Jacques', 'Monique', 'Pierre', 'Sylvie', 'Michel', 'Brigitte'], e: ['Martin', 'Bernard', 'Dubois', 'Lefèvre', 'Moreau', 'Laurent'], p: [['75001', 'Paris'], ['69001', 'Lyon'], ['13001', 'Marseille'], ['33000', 'Bordeaux'], ['06000', 'Nice']] },
    IT: { land: 'Italy', f: ['Giuseppe', 'Maria', 'Luigi', 'Rosa', 'Franco', 'Giulia'], e: ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano'], p: [['00184', 'Roma'], ['20121', 'Milano'], ['50122', 'Firenze'], ['80132', 'Napoli'], ['30124', 'Venezia']] },
    ES: { land: 'Spain', f: ['José', 'Carmen', 'Antonio', 'Dolores', 'Manuel', 'Pilar'], e: ['García', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Romero'], p: [['28013', 'Madrid'], ['08002', 'Barcelona'], ['41004', 'Sevilla'], ['46001', 'Valencia'], ['29015', 'Málaga']] },
    CH: { land: 'Switzerland', f: ['Urs', 'Heidi', 'Beat', 'Vreni', 'Reto', 'Ruth'], e: ['Meier', 'Brunner', 'Keller', 'Zürcher', 'Baumann', 'Huber'], p: [['8001', 'Zürich'], ['3011', 'Bern'], ['1201', 'Genève'], ['4051', 'Basel']] },
    US: { land: 'U.S.A.', f: ['Bob', 'Linda', 'Gary', 'Susan', 'Earl', 'Peggy'], e: ['Johnson', 'Miller', 'Anderson', 'Olson', 'Larson', 'Peterson'], p: [['TX 78701', 'Austin'], ['MN 55401', 'Minneapolis'], ['IL 60601', 'Chicago'], ['NY 10001', 'New York'], ['WA 98101', 'Seattle']], us: true }
  };
  // Malte flagg som SVG (ser likt ut på alle enheter, også uten flagg-emoji)
  function flagSvg(cc) {
    const cross = (bg, c1, c2) => '<rect width="30" height="20" fill="' + bg + '"/>' + (c2 ? '<rect x="8" width="6" height="20" fill="' + c1 + '"/><rect y="7" width="30" height="6" fill="' + c1 + '"/><rect x="9.5" width="3" height="20" fill="' + c2 + '"/><rect y="8.5" width="30" height="3" fill="' + c2 + '"/>' : '<rect x="8.5" width="4" height="20" fill="' + c1 + '"/><rect y="8" width="30" height="4" fill="' + c1 + '"/>');
    const h3 = (a, b, c) => '<rect width="30" height="20" fill="' + b + '"/><rect width="30" height="6.67" fill="' + a + '"/><rect y="13.33" width="30" height="6.67" fill="' + c + '"/>';
    const v3 = (a, b, c) => '<rect width="30" height="20" fill="' + b + '"/><rect width="10" height="20" fill="' + a + '"/><rect x="20" width="10" height="20" fill="' + c + '"/>';
    const F = {
      NO: cross('#ba0c2f', '#fff', '#00205b'), DK: cross('#c8102e', '#fff'), SE: cross('#006aa7', '#fecc00'), FI: cross('#fff', '#003580'),
      DE: h3('#000', '#dd0000', '#ffce00'), NL: h3('#ae1c28', '#fff', '#21468b'), FR: v3('#002395', '#fff', '#ed2939'), IT: v3('#009246', '#fff', '#ce2b37'),
      ES: '<rect width="30" height="20" fill="#aa151b"/><rect y="5" width="30" height="10" fill="#f1bf00"/>',
      CH: '<rect width="30" height="20" fill="#d52b1e"/><rect x="13" y="4" width="4" height="12" fill="#fff"/><rect x="9" y="8" width="12" height="4" fill="#fff"/>',
      GB: '<rect width="30" height="20" fill="#012169"/><path d="M0 0L30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0L30 20M30 0L0 20" stroke="#c8102e" stroke-width="1.6"/><path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6"/><path d="M15 0v20M0 10h30" stroke="#c8102e" stroke-width="3.4"/>',
      US: '<rect width="30" height="20" fill="#fff"/>' + [0, 2, 4, 6, 8, 10, 12].map((i) => '<rect y="' + (i * 20 / 13) + '" width="30" height="' + (20 / 13) + '" fill="#b22234"/>').join('') + '<rect width="13" height="10.8" fill="#3c3b6e"/>'
    };
    return '<svg viewBox="0 0 30 20" preserveAspectRatio="none" aria-hidden="true">' + (F[cc] || '<rect width="30" height="20" fill="#ccc"/>') + '</svg>';
  }
  function gearSvg(r, n, hole) {
    let d = ''; const ri = r * .82;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, s = Math.PI / n; const pts = [[ri, a - s * .9], [r, a - s * .45], [r, a + s * .45], [ri, a + s * .9]]; pts.forEach(([rr, aa], k) => { d += (i === 0 && k === 0 ? 'M' : 'L') + (r + rr * Math.cos(aa)).toFixed(1) + ' ' + (r + rr * Math.sin(aa)).toFixed(1); }); }
    d += 'Z';
    return '<svg viewBox="0 0 ' + 2 * r + ' ' + 2 * r + '" aria-hidden="true"><path d="' + d + '" fill="#3a3632" stroke="#1d1a17" stroke-width="2"/><circle cx="' + r + '" cy="' + r + '" r="' + ri * .78 + '" fill="none" stroke="#24211e" stroke-width="' + ri * .12 + '"/>' + [0, 1, 2, 3, 4, 5].map((k) => '<line x1="' + r + '" y1="' + r + '" x2="' + (r + ri * .7 * Math.cos(k * Math.PI / 3)) + '" y2="' + (r + ri * .7 * Math.sin(k * Math.PI / 3)) + '" stroke="#2c2926" stroke-width="' + ri * .14 + '"/>').join('') + '<circle cx="' + r + '" cy="' + r + '" r="' + hole + '" fill="#57514a" stroke="#1d1a17" stroke-width="2"/></svg>';
  }
  function pscAddress(cc) {
    const A = PSC_ADR[cc]; const pl = A.p[rnd(A.p.length)];
    const city = A.gb ? pl[1] + ' ' + pl[0] : A.us ? pl[1] + ', ' + pl[0] : pl[0] + ' ' + pl[1];
    return { name: A.f[rnd(A.f.length)] + ' ' + A.e[rnd(A.e.length)], city, land: A.land };
  }
  const PSC_CAP = 4;
  function psClassic(S, w, p) {
    const st = S.st;
    w.classList.add('psc-room');
    const top = h('div', 'ps-top'); top.append(h('span', 'ps-who', S.pl.length > 1 ? 'Vakt: ' + p.name : 'Postsorteringen')); w.append(top);
    const stage = h('div', 'psc-stage'); w.append(stage);
    stage.innerHTML = '<div class="psc-wall"><i class="g1">' + gearSvg(60, 18, 9) + '</i><i class="g2">' + gearSvg(44, 14, 7) + '</i><i class="g3">' + gearSvg(30, 10, 5) + '</i></div>'
      + '<div class="psc-cnt"><div class="lamps">' + '<i></i>'.repeat(8) + '</div><div class="dig"><b>0</b><b>0</b></div></div>'
      + '<div class="psc-wheel"></div>'
      + '<div class="psc-belt"><div class="psc-belt-top"></div><i class="leg a"></i><i class="leg b"></i><i class="leg c"></i></div>'
      + '<div class="psc-drop"></div>'
      + '<div class="psc-desk"><div class="psc-score"></div></div><div class="psc-chute"><i></i></div>';
    const beltTop = stage.querySelector('.psc-belt-top'), desk = stage.querySelector('.psc-desk'), chute = stage.querySelector('.psc-chute');
    const lamps = [...stage.querySelectorAll('.lamps i')], digs = [...stage.querySelectorAll('.dig b')], gears = [...stage.querySelectorAll('.psc-wall i')];
    const scoreEl = stage.querySelector('.psc-score'); const scoreDig = []; for (let i = 0; i < 7; i++) { const b = h('b', '', '0'); scoreEl.append(b); scoreDig.push(b); }
    const start = h('div', 'ps-start'); start.append(h('b', '', 'Postsorteringen'), h('span', '', 'Brevene ramler ned på sorteringsbordet. Legg dem gjerne i bunker per land mens du venter. Nye sekker kommer med jevne mellomrom og dytter båndet ett hakk. Fyll sekkene med brev som har samme flagg, så blir de hentet. Trykk på et brev, så går det rett i den ytterste sekken med samme flagg. Du kan også dra brevene rundt på bordet eller opp i en bestemt sekk. Gullkort fyller en sekk med én gang. Gullsekken tar alle brev og fyller alle sekkene på båndet. Faller en sekk utfor kanten, er vakta over.'), h('span', 'psc-go', 'Trykk for å starte')); stage.append(start);
    let W = 360, H = 600, beltY = 140, D = { x: 8, y: 200, w: 344, h: 280 };
    const LIMIT = 20, LW = 108, LH = 60;
    let level = 1, sorted = 0, score = 0, shown = 0, fullN = 0, over = false, running = false, nextLetter = 0, nextBurst = 0, nextStep = 0, raf = 0, zTop = 30, SLOTS = 5, SW = 64, SKW = 60, gearA = 0;
    const sacks = []; const items = []; let sel = null, dragIt = null;
    // Gradvis vanskeligere: flere og flere land; tiden mellom sekkene krymper bare litt, og sakte
    const lv = () => { const step = Math.max(7000, 10000 - sorted * 15); return { countries: Math.min(2 + Math.floor(sorted / 20), PSC_ORDER.length), step, every: step / 4.3, burst: sorted >= 30 }; };
    const pool = PSC_ORDER.slice(0, 4).concat(shuffle(PSC_ORDER.slice(4)));
    const active = () => pool.slice(0, lv().countries);
    function updScore() { const s = String(Math.max(0, score)).padStart(7, '0').slice(-7); scoreDig.forEach((b, i) => { if (b.textContent !== s[i]) { b.textContent = s[i]; b.classList.remove('flip'); void b.offsetWidth; b.classList.add('flip'); } }); }
    function updFull() { const s = String(fullN % 100).padStart(2, '0'); digs.forEach((b, i) => { if (b.textContent !== s[i]) { b.textContent = s[i]; b.classList.remove('flip'); void b.offsetWidth; b.classList.add('flip'); } }); }
    function measure() {
      const r = stage.getBoundingClientRect(); W = r.width || 360; H = r.height || 600;
      const belt = stage.querySelector('.psc-belt'); beltY = belt.offsetTop + 2;
      D = { x: desk.offsetLeft + 6, y: desk.offsetTop + 30, w: desk.offsetWidth - 12, h: desk.offsetHeight - 36 };
      SLOTS = 5; SW = (belt.offsetWidth - 8) / SLOTS; SKW = Math.min(84, SW - 4); stage.style.setProperty('--skw', SKW + 'px'); sacks.forEach(place);
    }
    function spawnSack() {
      const act = active();
      const want = [...new Set(items.map((l) => l.cc))].filter((cc) => act.includes(cc) && !sacks.some((s) => s.cc === cc && !s.full));
      const gold = sorted >= 15 && sacks.length >= 3 && !sacks.some((x) => x.gold) && Math.random() < .03;
      const cc = gold ? '*' : want.length && Math.random() < .8 ? want[rnd(want.length)] : act[rnd(act.length)];
      const el = h('div', 'psc-sack' + (gold ? ' gold' : '')); el.dataset.cc = cc;
      el.innerHTML = '<div class="crate"><div class="sackb"><span class="peeks"></span><svg viewBox="0 0 60 80" preserveAspectRatio="none" aria-hidden="true"><defs><pattern id="jute" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="3" fill="#c9a56c"/><path d="M0 1.5h3M1.5 0v3" stroke="#a8854f" stroke-width=".7"/></pattern><linearGradient id="juteSh" x1="0" x2="1"><stop offset="0" stop-color="#3a2208" stop-opacity=".45"/><stop offset=".35" stop-color="#fff2d0" stop-opacity=".18"/><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#3a2208" stop-opacity=".5"/></linearGradient></defs><path class="body" d="M5 80 C0 58 2 36 10 24 C14 18 18 15 20 12 L40 12 C42 15 46 18 50 24 C58 36 60 58 55 80 Z" fill="url(#jute)" stroke="#6e4f27" stroke-width="1.2"/><path d="M5 80 C0 58 2 36 10 24 C14 18 18 15 20 12 L40 12 C42 15 46 18 50 24 C58 36 60 58 55 80 Z" fill="url(#juteSh)"/><path d="M22 30 C20 45 21 60 24 76 M37 28 C40 44 39 60 36 77" fill="none" stroke="#7a5a2c" stroke-width=".8" opacity=".55"/><g class="open"><ellipse cx="30" cy="11.5" rx="11" ry="3.2" fill="#2b1a08"/><path d="M17 12 Q19 6 23 10 Q26 4 30 9 Q34 4 37 10 Q41 6 43 12 Q30 17.5 17 12Z" fill="#b8925a" stroke="#6e4f27" stroke-width=".8"/></g><g class="tied"><path d="M21 14 Q24 2 30 6 Q36 2 39 14 Z" fill="#c2a066" stroke="#6e4f27" stroke-width=".8"/><rect x="21" y="12" width="18" height="3.2" rx="1.4" fill="#7a5426"/></g></svg></div><div class="lip"></div><div class="front"><span class="plate">' + (gold ? '<b>★</b>' : flagSvg(cc)) + '</span></div></div>';
      if (gold) L('stab', [1046.5, 1318.5, 1568], .4, .05);
      stage.append(el); const s = { el, cc, gold, slot: -1, n: 0, fill: el.querySelector('.sackb'), vis: 0 }; sacks.push(s); place(s); void el.offsetWidth; s.slot = 0; place(s); return s;
    }
    function place(s) { const belt = stage.querySelector('.psc-belt'); s.x = belt.offsetLeft + 4 + s.slot * SW + (SW - SKW) / 2; s.el.style.transform = 'translate(' + s.x + 'px,' + (beltY - SKW * .78) + 'px)'; }
    function step() {
      // ny sekk dytter inn fra venstre: bare sekkene som står tett i rekke fra start blir skjøvet ett hakk (mellomrom fylles opp først)
      const L3 = lv(); beltTop.classList.remove('jerk'); void beltTop.offsetWidth; beltTop.classList.add('jerk'); L('sub', 70, 40, .2, .25); L('noise', .2, 'lowpass', 500, 200, .01, .25, 1);
      gearA += 40; gears.forEach((g, i) => { g.style.transform = 'rotate(' + (i % 2 ? -gearA * 1.3 : gearA) + 'deg)'; });
      const open = sacks.filter((s) => !s.full); let run = 0; while (open.some((s) => s.slot === run)) run++;
      open.forEach((s) => { if (s.slot < run) s.slot++; });
      const off = open.find((s) => s.slot >= SLOTS);
      sacks.forEach(place);
      if (off) { off.el.classList.add('tip'); spill(off); edgeOver(off); return; }
      spawnSack(); markEdge();
      nextStep = performance.now() + L3.step;
    }
    // Det skal alltid stå sekker på båndet: blir det for få, kommer en ny med en gang
    function refill() {
      if (!running || over) return; const open = sacks.filter((x) => !x.full);
      const need = 1;
      if (open.length >= need) return;
      if (sacks.some((x) => x.slot === 0 && !x.full)) return;
      spawnSack(); markEdge(); if (open.length === 0) nextStep = performance.now() + lv().step;
      if (sacks.filter((x) => !x.full).length < need) setTimeout(refill, 650);
    }
    function markEdge() { const open = sacks.filter((s) => !s.full); const packed = open.length >= SLOTS && Array.from({ length: SLOTS }, (_, i) => i).every((i) => open.some((s) => s.slot === i)); sacks.forEach((s) => s.el.classList.toggle('edge', packed && !s.full && s.slot === SLOTS - 1)); refreshBtns(); }
    function refreshBtns() {}
    // Trykk på et brev: det går rett i den ytterste sekken med samme flagg (eller gullsekken)
    function autoSend(it) {
      const open = sacks.filter((x) => !x.full && x.slot >= 0 && x.slot < SLOTS);
      const m = open.filter((x) => x.cc === it.cc).sort((p, q) => q.slot - p.slot)[0] || open.filter((x) => x.gold).sort((p, q) => q.slot - p.slot)[0];
      if (m) { tryDrop(it, m); return; }
      it.el.classList.remove('nope'); void it.el.offsetWidth; it.el.classList.add('nope'); L('tone', 'square', 160, 120, .12, .03);
      it.el.style.left = it.x + 'px'; it.el.style.top = it.y + 'px'; it.el.style.zIndex = ++zTop;
    }
    function bubble(t, cls, x, y, ms) { const b = h('span', 'psc-bubble' + (cls ? ' ' + cls : ''), t); b.style.left = Math.max(4, Math.min(W - 150, x)) + 'px'; b.style.top = y + 'px'; stage.append(b); setTimeout(() => b.remove(), ms || 1000); }
    function newItem(cc, card, tx, ty, delay, gold, legend) {
      const a = pscAddress(cc);
      const el = h('div', 'psc-letter' + (card ? ' card' : '') + (gold ? ' gold' : '') + (legend ? ' legend' : '')); el.dataset.cc = cc;
      el.innerHTML = (card ? '<i class="pic"></i>' : '') + '<i class="pm"></i><span class="stampf">' + flagSvg(cc) + '</span><span class="adr"><em></em><b></b><b></b></span>';
      const ad = el.querySelector('.adr'); ad.children[0].textContent = a.name; ad.children[1].textContent = a.city; ad.children[2].textContent = a.land;
      const it = { el, cc, gold: !!gold, legend: !!legend, rot: (Math.random() * 14 - 7), x: tx, y: ty }; if (gold || legend) el.append(h('i', 'glint')); if (legend) { el.append(h('i', 'lgstar', '★')); el.querySelector('.adr').children[0].textContent = 'Legendarisk post'; }
      el.style.setProperty('--rot', it.rot + 'deg'); el.style.left = tx + 'px'; el.style.top = ty + 'px'; el.style.zIndex = ++zTop;
      el.style.setProperty('--fx', (chute.offsetLeft + 10 - tx) + 'px'); el.style.setProperty('--fy', (chute.offsetTop - ty) + 'px');
      el.style.animationDelay = (delay || 0) + 'ms'; el.classList.add('fall');
      items.push(it); stage.append(el); bindDrag(it);
      return it;
    }
    const clampX = (x) => Math.max(D.x, Math.min(D.x + D.w - LW, x));
    const clampY = (y) => Math.max(D.y, Math.min(D.y + D.h - LH, y));
    function spot(nearPiles) {
      // tilfeldig sted på bordet, eller oppå en eksisterende bunke (skurene legger seg gjerne over sorteringen)
      if (nearPiles && items.length && Math.random() < .6) { const t = items[rnd(items.length)]; return [clampX(t.x + rnd(50) - 25), clampY(t.y + rnd(36) - 18)]; }
      return [clampX(D.x + Math.random() * (D.w - LW)), clampY(D.y + Math.random() * (D.h - LH))];
    }
    function dropLetter() {
      // Balansert post: mest brev til sekkene som står på båndet, vektet etter hvor mye plass de har igjen minus brev som allerede ligger klare
      const act = active(); const need = {};
      sacks.filter((s) => !s.full && !s.gold).forEach((s) => { need[s.cc] = (need[s.cc] || 0) + (PSC_CAP - s.n); });
      items.forEach((it) => { if (need[it.cc] != null) need[it.cc] -= 1; });
      const lack = Object.keys(need).filter((k) => need[k] > 0); let cc;
      if (lack.length && Math.random() < .7) { const tot = lack.reduce((t, k) => t + need[k], 0); let r = Math.random() * tot; cc = lack.find((k) => (r -= need[k]) < 0) || lack[0]; }
      else cc = act[rnd(act.length)];
      const [x, y] = spot(false);
      // Legendarisk post: svært sjelden (ca. 1 av 250 brev etter 25 sorterte, maks én om gangen). Sorteres den, ryddes hele bordet.
      if (sorted >= 25 && !items.some((x) => x.legend) && Math.random() < .004) { newItem(cc, false, x, y, 0, false, true); L('stab', [1046.5, 1318.5, 1568, 2093, 2637], .5, .07); L('buzz', [40, 40, 40, 40, 160]); bubble('Legendarisk post!', 'big legend', x - 20, y - 26, 1500); }
      else { const g = sorted >= 8 && Math.random() < .02; newItem(cc, !g && Math.random() < .2, x, y, 0, g); if (g) L('stab', [1318.5, 1568, 2093], .35, .05); }
      L('noise', .18, 'bandpass', 1400, 500, .01, .12, 1.2); setTimeout(() => L('pop', false), 380);
      check();
    }
    function burst() {
      const act = active(); const n = 3 + rnd(Math.min(4, 1 + Math.floor(sorted / 20)));
      chute.classList.remove('rumble'); void chute.offsetWidth; chute.classList.add('rumble');
      for (let i = 0; i < n; i++) { const [x, y] = spot(true); newItem(act[rnd(act.length)], true, x, y, i * 90); }
      L('noise', .5, 'bandpass', 900, 400, .02, .5, 1.4); L('buzz', [30, 30, 30]);
      check();
    }
    function check() {
      // ingen grense for antall brev på bordet; vakta er bare over når en sekk faller utfor kanten
    }
    function bindDrag(it) {
      let off = null, p0 = null;
      it.el.addEventListener('pointerdown', (e) => {
        if (!running || over || it.gone) return; e.preventDefault(); e.stopPropagation(); p0 = [e.clientX, e.clientY]; dragIt = it;
        try { it.el.setPointerCapture(e.pointerId); } catch (x) {}
        const r = it.el.getBoundingClientRect(); off = [e.clientX - r.left, e.clientY - r.top];
        it.el.classList.remove('fall'); it.el.classList.add('drag'); it.el.style.zIndex = 200; fx.tap();
      });
      it.el.addEventListener('pointermove', (e) => {
        if (!off || it.gone) return; const sr = stage.getBoundingClientRect();
        it.el.style.left = (e.clientX - sr.left - off[0]) + 'px'; it.el.style.top = (e.clientY - sr.top - off[1]) + 'px';
        const hit = sackAt(e.clientX, e.clientY); sacks.forEach((s) => s.el.classList.toggle('hover', s === hit));
      });
      const up = (e) => {
        if (!off) return; const o = off; off = null; if (dragIt === it) dragIt = null; if (it.gone) return; it.el.classList.remove('drag'); sacks.forEach((s) => s.el.classList.remove('hover'));
        const moved = p0 ? Math.hypot(e.clientX - p0[0], e.clientY - p0[1]) : 99;
        if (it.legend && (moved <= 8 || sackAt(e.clientX, e.clientY))) { legendClear(it); return; }
        if (moved <= 8) { autoSend(it); return; }
        const hit = sackAt(e.clientX, e.clientY);
        if (hit) { tryDrop(it, hit); return; }
        const sr = stage.getBoundingClientRect(); moveTo(it, e.clientX - sr.left - o[0], e.clientY - sr.top - o[1]);
      };
      it.el.addEventListener('pointerup', up); it.el.addEventListener('pointercancel', up);
    }
    function moveTo(it, x, y) { it.x = clampX(x); it.y = clampY(y); it.el.style.left = it.x + 'px'; it.el.style.top = it.y + 'px'; it.el.style.zIndex = ++zTop; L('pop', false); }
    function select(it) { if (sel) sel.el.classList.remove('sel'); sel = it; if (sel) sel.el.classList.add('sel'); }
    function sackAt(x, y) { let best = null, bd = 1e9; for (const s of sacks) { if (s.full) continue; const r = s.el.getBoundingClientRect(); if (x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 24 && y <= r.bottom + 14) { const d = Math.abs(x - (r.left + r.width / 2)); if (d < bd) { bd = d; best = s; } } } return best; }
    function legendClear(it) {
      // Legendarisk post: alle brev og kort på bordet forsvinner, 5 poeng per brev
      const rest = items.filter((x) => x !== it && !x.gone); items.length = 0; if (sel) sel = null; it.gone = true;
      [it].concat(rest).forEach((x, k) => { x.gone = true; const el = x.el; el.classList.remove('fall', 'drag', 'sel'); el.style.pointerEvents = 'none';
        setTimeout(() => { try { const an = el.animate([{ transform: 'rotate(' + (x.rot || 0) + 'deg) scale(1)', opacity: 1, filter: 'brightness(1)' }, { transform: 'translateY(-40px) rotate(' + ((x.rot || 0) + 200) + 'deg) scale(.1)', opacity: 0, filter: 'brightness(3)' }], { duration: 520, easing: 'ease-in', fill: 'forwards' }); an.onfinish = () => el.remove(); } catch (e) { el.remove(); } }, Math.min(900, k * 25)); });
      const pts = 25 + rest.length * 5; score += pts; sorted++; updScore();
      stage.classList.remove('legendrush'); void stage.offsetWidth; stage.classList.add('legendrush'); setTimeout(() => stage.classList.remove('legendrush'), 1600);
      L('gold'); L('confetti'); L('buzz', [80, 40, 80, 40, 200]);
      bubble('Bordet ryddet! +' + pts, 'big legend', W * .2, D.y + D.h * .35, 1700);
    }
    function tryDrop(it, s) {
      if (it.legend) { legendClear(it); return; }
      if (s.gold || s.cc === it.cc) {
        items.splice(items.indexOf(it), 1); if (sel === it) sel = null;
        const sr = s.el.getBoundingClientRect(), stg = stage.getBoundingClientRect();
        flyInto(it, sr, stg);
        sorted++; score += 10; L('pop', true); L('buzz', 12);
        if (s.gold) {
          // Gullsekk: alle kassene på båndet blir fulle og hentes
          const all = sacks.filter((x) => !x.full); stage.classList.remove('goldrush'); void stage.offsetWidth; stage.classList.add('goldrush'); setTimeout(() => stage.classList.remove('goldrush'), 1200);
          all.forEach((x, k) => setTimeout(() => complete(x), k * 110));
          L('gold'); L('confetti'); L('buzz', [60, 30, 60, 30, 120]);
          bubble('Gullsekk! ' + all.length + ' fulle', 'big gold', W * .2, beltY + 34, 1400);
        } else {
          if (it.gold) { s.n = PSC_CAP; L('gold'); bubble('Gullkort!', 'big gold', s.x - 10, beltY + 40, 1100); } else s.n++;
          const nn = s.n; setTimeout(() => { setFill(s, nn); s.el.classList.remove('gulp'); void s.el.offsetWidth; s.el.classList.add('gulp'); L('noise', .12, 'lowpass', 700, 300, .005, .12, 1); }, FLY);
          if (s.n >= PSC_CAP) complete(s, FLY + 60);
        }
        updScore();
        if (sorted % 10 === 0) level++;
        check();
      } else {
        s.el.classList.remove('nei'); void s.el.offsetWidth; s.el.classList.add('nei'); fx.bad(); score = Math.max(0, score - 5); updScore();
        bubble('Feil land!', '', s.x, beltY + 24, 900);
        it.el.style.left = it.x + 'px'; it.el.style.top = it.y + 'px'; it.el.style.zIndex = ++zTop;
      }
    }
    // Brevet flyr i en bue opp og ned i sekken
    const FLY = 380;
    function flyInto(it, sr, stg) {
      const el = it.el; el.classList.remove('fall', 'drag', 'sel'); el.style.transition = 'none'; el.style.pointerEvents = 'none'; el.style.zIndex = 260;
      const x0 = parseFloat(el.style.left) || it.x, y0 = parseFloat(el.style.top) || it.y;
      const dx = sr.left - stg.left + sr.width / 2 - LW / 2 - x0, dy = sr.top - stg.top + sr.height * .18 - LH / 2 - y0, r = it.rot || 0;
      const k = [{ transform: 'rotate(' + r + 'deg) scale(1)', opacity: 1 }, { transform: 'translate(' + dx * .5 + 'px,' + (dy * .5 - 60) + 'px) rotate(' + (r + 80) + 'deg) scale(.62)', opacity: 1, offset: .5 }, { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (r + 170) + 'deg) scale(.16)', opacity: .85 }];
      try { const an = el.animate(k, { duration: FLY, easing: 'cubic-bezier(.35,.05,.6,1)', fill: 'forwards' }); an.onfinish = () => el.remove(); } catch (e) { setTimeout(() => el.remove(), FLY); }
      L('noise', .1, 'highpass', 2500, 800, .005, .2, 1);
    }
    // Sekken fylles gradvis: den buler seg opp over kassekanten og brevkanter stikker opp
    function setFill(s, n) {
      n = Math.min(PSC_CAP, n); s.fill.style.setProperty('--f', (n / PSC_CAP).toFixed(3));
      const pk = s.fill.querySelector('.peeks');
      while (s.vis < n) { s.vis++; const p = h('i', 'peek'); p.style.left = (36 + Math.random() * 28) + '%'; p.style.setProperty('--pr', (Math.random() * 50 - 25).toFixed(0) + 'deg'); p.style.animationDelay = (pk.children.length ? 40 : 0) + 'ms'; pk.append(p); }
    }
    function complete(s, delay) {
      if (s.full) return; s.full = true; s.n = PSC_CAP; refreshBtns();
      const pts = 30 + Math.max(0, SLOTS - 1 - s.slot) * 5; score += pts; updScore(); fullN++;
      setTimeout(() => {
        setFill(s, PSC_CAP); s.el.classList.add('full'); updFull(); fx.bonus(); L('pop', true);
        bubble('+' + pts, 'ok', s.x + 6, beltY + 24, 1000);
        setTimeout(() => { s.el.classList.add('away'); fx.whoosh(); setTimeout(() => { s.el.remove(); const i = sacks.indexOf(s); if (i >= 0) sacks.splice(i, 1); markEdge(); }, 650); }, 650);
      }, delay || 0);
      setTimeout(refill, 120);
    }
    function loop(now) {
      if (!w.isConnected) { cancelAnimationFrame(raf); return; }
      if (!running || over) return;
      const L3 = lv();
      if (now >= nextStep) { step(); if (over) return; }
      const left = Math.max(0, nextStep - now) / L3.step; const lit = Math.ceil(left * 8);
      lamps.forEach((l, i) => { l.classList.toggle('on', i < lit); l.classList.toggle('red', lit <= 2 && i < lit); });
      if (now >= nextLetter) { dropLetter(); const crowd = items.length > 16 ? 1.4 : items.length > 11 ? 1.15 : 1; nextLetter = now + L3.every * crowd * (.75 + Math.random() * .5); }
      if (L3.burst && now >= nextBurst) { if (nextBurst) burst(); nextBurst = now + Math.max(30000, 60000 - sorted * 200) * (.7 + Math.random() * .6); }
      raf = requestAnimationFrame(loop);
    }
    function spill(s) {
      // brevene fra sekken drysser utfor kanten
      for (let i = 0; i < 6; i++) { const f = h('i', 'psc-spill'); f.style.left = (s.x + SKW / 2) + 'px'; f.style.top = (beltY - 10) + 'px'; f.style.setProperty('--dx', (20 + Math.random() * 40) + 'px'); f.style.setProperty('--r', (Math.random() * 360) + 'deg'); f.style.animationDelay = (250 + i * 60) + 'ms'; stage.append(f); }
    }
    function edgeOver() { L('sub', 90, 30, .5, .7); L('tone', 'square', 220, 70, .5, .05); gameOver('Sekken falt utfor kanten!'); }
    function gameOver(why) {
      if (over) return; over = true; running = false; cancelAnimationFrame(raf);
      stage.classList.add('flood'); L('sub', 160, 50, .6, .6);
      setTimeout(() => {
        const o = h('div', 'ps-over'); o.append(h('b', '', why || 'Vakta er over'), h('span', '', sorted + ' brev sortert · ' + fullN + ' fulle sekker · ' + score + ' poeng'));
        const best = (mem.psBest || {}).klassisk || 0; if (score > best && S.pl.length === 1) o.append(h('span', 'newrec', 'Ny rekord!'));
        o.append(btn(S.pl.length > 1 && st.turn + 1 < S.pl.length ? 'Neste vakt' : 'Se resultatet', 'go big', () => dispatch({ t: 'done', score, n: sorted })));
        stage.append(o); fx.win();
      }, 900);
    }
    start.onclick = () => { start.remove(); measure(); running = true; const t0 = performance.now(); nextLetter = t0 + 600; nextBurst = 0; spawnSack(); markEdge(); nextStep = t0 + lv().step; fx.whoosh(); raf = requestAnimationFrame(loop); };
    requestAnimationFrame(measure);
  }
  const PS = {
    name: 'Postsortereren', kicker: 'Alene mot klokka', glow: '#3a2a0e', teams: false, multi: false, noOnline: true,
    rules: 'Klassisk: brev og postkort ramler ned på sorteringsbordet, der du kan legge dem i bunker per land. Nye sekker med flagg kommer med faste mellomrom og dytter båndet ett hakk. Fyll sekkene: trykk på et brev, så går det rett i den ytterste sekken med samme flagg, eller dra det dit du vil. Fulle sekker blir hentet. Gullkort fyller sekken med én gang, og et hvilket som helst brev i gullsekken fyller alle sekkene på båndet. Faller en sekk utfor kanten, er vakta over. Andre nivåer: brevene kommer på løpende bånd. Trykk på riktig hylle før tiden går ut: verdensdel etter flagget på frimerket, by, postnummer eller regler, alt etter nivå. Det går fortere og fortere. Ti riktige på rad gir dobbel poeng. Tre feil, og skiftet er over.',
    solo: 'Et enspillerspill. Jakt rekord og medaljer, og sammenlign på rekordtavla.',
    defaults: () => ({ lvl: 'klassisk' }),
    options(cfg, el, re) {
      el.append(h('span', 'lbl', 'Nivå'));
      el.append(seg([['Klassisk', 'klassisk'], ['Flagg', 'flagg'], ['By', 'lett'], ['Postnr.', 'norm'], ['Kaos', 'kaos']], cfg.lvl, (v) => { cfg.lvl = v; re(); }));
      const tx = { klassisk: 'Som i gamle dager: sorter brevene i bunker på bordet, og fyll sekkene før båndet dytter dem utfor kanten. Flere og flere flagg etter hvert.', flagg: 'Brev fra hele verden. Se på flagget på frimerket og send brevet til riktig verdensdel.', lett: 'Sorter på bynavn. Seks byer.', norm: 'Sorter på første siffer i postnummeret. 0–2 Østlandet, 3–4 Sør og sørvest, 5 Vestland, 6–7 Møre og Trøndelag, 8 Nordland, 9 Troms og Finnmark.', kaos: 'Fire landsdeler etter postnummer, men brev med rødt ekspress-stempel skal i EKSPRESS, og brev uten frimerke skal i RETUR.' };
      el.append(h('p', 'fine', tx[cfg.lvl]));
      const b = (mem.psBest || {})[cfg.lvl]; if (b) el.append(h('p', 'fine', 'Rekorden din på dette nivået: ' + b + ' poeng'));
    },
    init(S) { const st = { turn: 0, scores: {}, sorted: {} }; S.pl.forEach((p) => { st.scores[p.id] = null; }); return st; },
    act(S, a) {
      const st = S.st;
      if (a.t === 'done') { const p = S.pl[st.turn]; if (!p || st.scores[p.id] != null) return false; st.scores[p.id] = Math.max(0, a.score | 0); st.sorted[p.id] = a.n | 0; const best = mem.psBest || {}; if (st.scores[p.id] > (best[S.cfg.lvl] || 0)) { best[S.cfg.lvl] = st.scores[p.id]; memSet('psBest', best); } st.turn++; if (st.turn >= S.pl.length) st.end = {}; return true; }
      return false;
    },
    key(S) { return String(S.st.turn); },
    view(S, c, w) {
      const st = S.st, p = S.pl[st.turn]; if (!p) return;
      if (S.pl.length > 1 && handoff(w, p.id, 'ps' + st.turn, 'Din vakt på postkontoret')) return;
      const lvl = S.cfg.lvl || 'klassisk', LV = PS_LEVELS[lvl];
      if (lvl === 'klassisk') { psClassic(S, w, p); return; }
      w.classList.add('ps-room');
      const top = h('div', 'ps-top'); const sc = h('b', 'ps-sc', '0'); const lives = h('span', 'ps-lv', '✉✉✉'); const cmb = h('span', 'ps-cmb', ''); top.append(h('span', 'ps-who', S.pl.length > 1 ? p.name : LV.name), sc, cmb, lives); w.append(top);
      const belt = h('div', 'ps-belt'); const timer = h('div', 'ps-timer'); const tb = h('i'); timer.append(tb); belt.append(timer); w.append(belt);
      const shelf = h('div', 'ps-shelf');
      const slots = LV.slots.map((s, i) => { const b = h('button', 'ps-slot k' + i); b.type = 'button'; b.append(h('b', '', s[0]), h('span', '', s[1])); b.onclick = () => sortTo(i); shelf.append(b); return b; });
      w.append(shelf);
      const start = h('div', 'ps-start'); start.append(h('b', '', 'Klar for vakt?'), h('span', '', 'Trykk for å starte båndet')); belt.append(start);
      let score = 0, life = 3, combo = 0, n = 0, cur = null, el = null, tLim = LV.t0, t0 = 0, running = false, over = false, raf = 0;
      const env = (L) => {
        const d = h('div', 'ps-env h' + L.hue); d.style.setProperty('--tilt', L.tilt + 'deg');
        if (L.flag) { const stp = h('span', 'ps-stamp fl'); stp.textContent = flagEmoji(L.flag); d.append(stp); d.append(h('span', 'ps-air', 'PAR AVION · LUFTPOST')); }
        else if (L.stamp) { const stp = h('span', 'ps-stamp' + (L.express ? ' ex' : '')); stp.textContent = L.express ? 'EKSPRESS' : 'NORGE'; d.append(stp); }
        const pm = h('span', 'ps-pm'); d.append(pm);
        const ad = h('div', 'ps-ad'); if (L.flag) ad.append(h('span', '', L.name), h('b', '', 'Til utlandet')); else ad.append(h('span', '', L.name), h('span', '', L.street), h('b', '', L.zip + ' ' + L.city)); d.append(ad);
        return d;
      };
      function next() {
        if (over) return; cur = psLetter(lvl); el = env(cur); el.classList.add('in'); belt.append(el); t0 = performance.now();
      }
      function hud() { sc.textContent = String(score); lives.textContent = '✉'.repeat(life) + '·'.repeat(3 - life); cmb.textContent = combo >= 10 ? '×2' : combo >= 5 ? combo + ' på rad' : ''; cmb.classList.toggle('hot', combo >= 10); }
      function miss(i) {
        life--; combo = 0; fx.bad(); belt.classList.remove('shake'); void belt.offsetWidth; belt.classList.add('shake');
        const right = psSlotFor(lvl, cur); if (right >= 0) { slots[right].classList.add('hint'); setTimeout(() => slots[right].classList.remove('hint'), 600); }
        if (i != null && slots[i]) { slots[i].classList.add('bad'); setTimeout(() => slots[i].classList.remove('bad'), 400); }
        const e = el; if (e) { e.classList.add('drop'); setTimeout(() => e.remove(), 500); } el = null;
        hud(); if (life <= 0) return end(); setTimeout(next, 450);
      }
      function sortTo(i) {
        if (!running || !el || over) return;
        const right = psSlotFor(lvl, cur);
        if (i !== right) return miss(i);
        combo++; n++; const pts = (10 + Math.round(Math.max(0, 1 - (performance.now() - t0) / tLim) * 10)) * (combo >= 10 ? 2 : 1); score += pts;
        tLim = Math.max(1050, tLim * .975);
        L('pop', true); L('buzz', 10); if (combo === 10) { fx.bonus(); fx.toast('Dobbel poeng!'); }
        const e = el; el = null; const sr = slots[i].getBoundingClientRect(), er = e.getBoundingClientRect();
        e.style.transition = 'transform .22s ease-in, opacity .22s'; e.style.transform = 'translate(' + (sr.left + sr.width / 2 - er.left - er.width / 2) + 'px,' + (sr.top + sr.height / 2 - er.top - er.height / 2) + 'px) scale(.25) rotate(' + (cur.tilt * 3) + 'deg)'; e.style.opacity = '0';
        slots[i].classList.add('ok'); setTimeout(() => slots[i].classList.remove('ok'), 250);
        setTimeout(() => e.remove(), 240); hud(); setTimeout(next, 120);
      }
      function loop(now) {
        if (!w.isConnected || over) return;
        if (running && el) { const left = 1 - (now - t0) / tLim; tb.style.transform = 'scaleX(' + Math.max(0, left) + ')'; tb.classList.toggle('low', left < .3); if (left <= 0) miss(null); }
        raf = requestAnimationFrame(loop);
      }
      function end() {
        over = true; running = false; cancelAnimationFrame(raf);
        const o = h('div', 'ps-over'); o.append(h('b', '', 'Skiftet er over'), h('span', '', n + ' brev sortert · ' + score + ' poeng'));
        const best = (mem.psBest || {})[lvl] || 0; if (score > best && S.pl.length === 1) o.append(h('span', 'newrec', 'Ny rekord!'));
        o.append(btn(S.pl.length > 1 && st.turn + 1 < S.pl.length ? 'Neste vakt' : 'Se resultatet', 'go big', () => dispatch({ t: 'done', score, n })));
        belt.append(o); fx.win();
      }
      start.onclick = () => { start.remove(); running = true; fx.whoosh(); next(); raf = requestAnimationFrame(loop); };
      addEventListener('keydown', function kd(e) { if (!w.isConnected || over) { removeEventListener('keydown', kd); return; } const k = parseInt(e.key, 10); if (k >= 1 && k <= slots.length) sortTo(k - 1); });
    },
    rank(S) { const st = S.st; return S.pl.map((p) => ({ id: p.id, name: p.name, col: p.col, val: (st.scores[p.id] || 0) + ' poeng', n: st.scores[p.id] || 0, sub: (st.sorted[p.id] || 0) + ' brev sortert' })).sort((a, b) => b.n - a.n); }
  };

  // ============ KRYPTERT (kodeknekking for to lag) ============
  const KR_WORDS = ('ananas anker apekatt appelsin arm badekar ball ballong banan bank bart batteri bensin berg bibel bie bil bjørn blekksprut blomst blyant bok bombe bonde bord borg bowling brann brev bro brød bryllup buss byste bølge båt dame diamant dinosaur doktor drage dragkamp drakt dronning dukke dusj dyne edderkopp egg eik elefant elg eple fallskjerm fiolin fisk fjell fjernkontroll flagg flaske fly fotball fyrtårn gaffel gitar glass gorilla gravstein gris gull hai hammer hane hatt hav helikopter hest hjerte hjelm hodepine honning hotell hund hval hytte igloo is isbjørn jakke jeger jernbane joker juletre kaffe kake kamel kamera kanin kanon kirke kniv kokk konge kopp korn krabbe kran krone krokodille kråke ku kule kyss lampe laks lam lege lenke lommebok lommelykt løve maler maske melk mobil mos motorsykkel mus måne nese nisse nøkkel olje ost papegøye paraply pass pengar pepper pingvin pirat pizza planet politi pose post prest pyramide pølse radio rakett regn ring robot rose rulletrapp safari sag saks sal sang sau seil sekk sirkus sjokolade sjørøver ski skje sko skog skole skorstein sky slange slott smykke snø sol sopp spade speil spion sprøyte stein stjerne storm strand stråle sukker svane sverd sykkel såpe tann taxi telt tiger tog tomat tre troll trommel tunnel tyv ugle ulv underbukse vaffel vampyr vann vegg vulkan vind vinter vulkan zebra øks øl øre ørn øy ').replace('pengar', 'penger').trim().split(/\s+/);
  const KR_POOL = [...new Set(KR_WORDS)];
  const KR_ROUNDS = 8;
  function krCode() { const d = shuffle([1, 2, 3, 4]); return d.slice(0, 3); }
  const krSame = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === 3 && a.every((x, i) => x === b[i]);
  const krOpp = (S, tid) => S.pl.find((p) => p.id !== tid);
  const KR = {
    name: 'Kodeknekker', kicker: 'Knekk koden', glow: '#0f2a2f', teams: false, fixedTeams: true, onlineOnly: true, minP: 4, finishLabel: 'Avslutt spillet',
    rules: 'To lag har hvert sitt sett med fire hemmelige ord, nummerert 1–4. Hver runde får én på laget en kode, for eksempel 3-1-4, og gir tre hint som peker på ordene i den rekkefølgen. Laget ditt skal gjette koden, mens motstanderne prøver å avskjære den fra og med runde 2. To avskjæringer vinner, to misforståelser taper. Hintene blir stående, så det blir vanskeligere å være utydelig uten å avsløre ordene. Bygget på brettspillet Decrypto.',
    solo: 'Kodeknekker spilles online med to lag på minst to hver.',
    defaults: () => ({}),
    options(cfg, el) { el.append(h('p', 'fine', 'Spilles online, hver på sin telefon. Lagene settes opp i rommet, minst to på hvert lag. Snakk sammen på laget i det stille.')); },
    init(S) {
      const w = shuffle(KR_POOL.slice());
      const st = { round: 1, ph: 'clue', kw: {}, code: {}, cl: {}, gs: {}, tk: {}, hist: {}, res: null, tb: {} };
      S.pl.forEach((p, i) => { st.kw[p.id] = w.slice(i * 4, i * 4 + 4); st.code[p.id] = krCode(); st.tk[p.id] = { i: 0, m: 0 }; st.hist[p.id] = [[], [], [], []]; st.gs[p.id] = {}; });
      return st;
    },
    enc(S, tid) { const p = S.pl.find((x) => x.id === tid); if (!p || !p.mem || !p.mem.length) return null; return p.mem[(S.st.round - 1) % p.mem.length]; },
    teamOf(S, by) { const p = S.pl.find((x) => (x.mem || []).includes(by)); return p ? p.id : null; },
    needs(S) { // hvilke gjetninger som mangler: [kodens lag, lag som gjetter]
      const st = S.st, out = [];
      S.pl.forEach((T) => { if (!st.gs[T.id][T.id]) out.push([T.id, T.id]); const O = krOpp(S, T.id); if (st.round >= 2 && O && !st.gs[T.id][O.id]) out.push([T.id, O.id]); });
      return out;
    },
    act(S, a, by) {
      const st = S.st, hostOk = by === S.host || !S.on;
      if (a.t === 'clue' && st.ph === 'clue') {
        const tid = a.tid; if (!st.code[tid] || st.cl[tid] || KR.enc(S, tid) !== by) return false;
        const cl = (Array.isArray(a.cl) ? a.cl : []).slice(0, 3).map((x) => String(x || '').trim().slice(0, 40));
        if (cl.length !== 3 || cl.some((x) => !x)) return false;
        st.cl[tid] = cl; if (S.pl.every((p) => st.cl[p.id])) st.ph = 'guess'; return true;
      }
      if (a.t === 'guess' && st.ph === 'guess') {
        const tid = a.tid, gid = KR.teamOf(S, by); if (!gid || !st.code[tid] || st.gs[tid][gid]) return false;
        if (gid === tid && KR.enc(S, tid) === by) return false;
        if (gid !== tid && st.round < 2) return false;
        const c = (Array.isArray(a.c) ? a.c : []).map(Number); if (c.length !== 3 || new Set(c).size !== 3 || c.some((x) => !(x >= 1 && x <= 4))) return false;
        st.gs[tid][gid] = c; if (!KR.needs(S).length) KR.score(S); return true;
      }
      if (a.t === 'next' && st.ph === 'rev' && hostOk) {
        if (st.res && st.res.win) { st.end = { win: st.res.win }; return true; }
        if (st.round >= KR_ROUNDS) { st.ph = 'tb'; return true; }
        st.round++; st.ph = 'clue'; st.cl = {}; S.pl.forEach((p) => { st.code[p.id] = krCode(); st.gs[p.id] = {}; }); st.res = null; return true;
      }
      if (a.t === 'tb' && st.ph === 'tb') {
        const gid = KR.teamOf(S, by); if (!gid || st.tb[gid]) return false;
        st.tb[gid] = (Array.isArray(a.w) ? a.w : []).slice(0, 4).map((x) => String(x || '').trim().slice(0, 30));
        if (S.pl.every((p) => st.tb[p.id])) {
          const hits = {}; S.pl.forEach((p) => { const O = krOpp(S, p.id); hits[p.id] = st.tb[p.id].filter((x, i) => x && norm(x) === norm(st.kw[O.id][i])).length; });
          const [A, B] = S.pl; st.tbHits = hits; st.end = { win: hits[A.id] === hits[B.id] ? null : (hits[A.id] > hits[B.id] ? A.id : B.id), tb: true };
        }
        return true;
      }
      return false;
    },
    score(S) {
      const st = S.st, res = { rows: {} };
      S.pl.forEach((T) => {
        const O = krOpp(S, T.id), code = st.code[T.id], own = st.gs[T.id][T.id], icp = O ? st.gs[T.id][O.id] : null;
        const okOwn = krSame(own, code), okIcp = !!icp && krSame(icp, code);
        if (!okOwn) st.tk[T.id].m++;
        if (okIcp && O) st.tk[O.id].i++;
        code.forEach((n, i) => st.hist[T.id][n - 1].push(st.cl[T.id][i]));
        res.rows[T.id] = { okOwn, okIcp, icp: !!icp };
      });
      const [A, B] = S.pl; const won = (T, O) => st.tk[T.id].i >= 2 || st.tk[O.id].m >= 2;
      const wa = won(A, B), wb = won(B, A);
      if (wa && !wb) res.win = A.id; else if (wb && !wa) res.win = B.id;
      else if (wa && wb) { const sa = st.tk[A.id].i - st.tk[A.id].m, sb2 = st.tk[B.id].i - st.tk[B.id].m; if (sa !== sb2) res.win = sa > sb2 ? A.id : B.id; }
      st.res = res; st.ph = 'rev';
    },
    patch() {},
    key(S) { const st = S.st; return [st.round, st.ph, Object.keys(st.cl).length, JSON.stringify(st.gs), Object.keys(st.tb).length, UI.krK || 0].join(':'); },
    tokens(S, w) {
      const st = S.st, sb = h('div', 'kr-tk');
      S.pl.forEach((p) => { const c = h('div', 'kt'); c.style.setProperty('--pc', p.col); c.append(h('b', '', p.name)); const r = h('span', ''); r.append(h('i', 'ti', '●'.repeat(st.tk[p.id].i) + '○'.repeat(Math.max(0, 2 - st.tk[p.id].i))), h('i', 'tm', '●'.repeat(st.tk[p.id].m) + '○'.repeat(Math.max(0, 2 - st.tk[p.id].m)))); c.append(r, h('small', '', (p.mem || []).join(', '))); sb.append(c); });
      w.append(sb);
      const lg = h('p', 'fine kr-lg'); lg.append(h('i', 'ti', '●'), ' avskjæring  ', h('i', 'tm', '●'), ' misforståelse'); w.append(lg);
    },
    words(S, tid, w) {
      const st = S.st, l = h('div', 'kr-kw');
      st.kw[tid].forEach((x, i) => { const d = h('div', 'kw'); d.append(h('span', 'n', String(i + 1)), h('b', '', x)); l.append(d); });
      w.append(l);
    },
    notes(S, tid, mine, w) {
      const st = S.st, p = S.pl.find((x) => x.id === tid); const box = h('div', 'kr-notes'); box.style.setProperty('--pc', p.col);
      box.append(h('span', 'lbl', (mine === true ? 'Våre hint' : 'Hintene til ' + p.name)));
      const g = h('div', 'kn');
      st.hist[tid].forEach((col, i) => { const c = h('div', 'kc'); c.append(h('b', '', mine ? (i + 1) + ' · ' + st.kw[tid][i] : String(i + 1))); if (!col.length) c.append(h('span', 'e', '–')); col.forEach((x) => c.append(h('span', '', x))); g.append(c); });
      box.append(g); w.append(box);
    },
    picker(S, key, w, onSend, label) {
      UI.krP = UI.krP || {}; const cur = UI.krP[key] || [0, 0, 0];
      const p = h('div', 'panel kr-pick'); p.append(h('span', 'lbl', label));
      const row = h('div', 'kp');
      [0, 1, 2].forEach((pos) => { const col = h('div', 'kpc'); col.append(h('small', '', 'Hint ' + (pos + 1)));
        [1, 2, 3, 4].forEach((n) => { const b = h('button', cur[pos] === n ? 'on' : '', String(n)); b.type = 'button'; b.disabled = cur.some((x, j) => j !== pos && x === n);
          b.onclick = () => { fx.tap(); const nx = cur.slice(); nx[pos] = n; UI.krP[key] = nx; UI.krK = (UI.krK || 0) + 1; const y = view ? view.body.scrollTop : 0; UI.key = null; render(); if (view) view.body.scrollTop = y; }; col.append(b); });
        row.append(col); });
      p.append(row);
      const ok = cur.every((x) => x) && new Set(cur).size === 3;
      const go = btn(ok ? 'Send ' + cur.join('-') : 'Velg tre ulike tall', 'go big', () => { if (!ok) return; fx.sel(); onSend(cur.slice()); }); go.disabled = !ok; p.append(go);
      w.append(p);
    },
    clueSet(S, tid, w, opt) {
      const st = S.st, p = S.pl.find((x) => x.id === tid), d = h('div', 'kr-cs'); d.style.setProperty('--pc', p.col);
      d.append(h('span', 'lbl', (opt && opt.title) || ('Hintene til ' + p.name)));
      const r = h('ol', ''); (st.cl[tid] || []).forEach((x, i) => { const li = h('li', ''); li.append(h('b', '', x)); if (opt && opt.code) li.append(h('span', 'cn', String(opt.code[i]))); r.append(li); }); d.append(r);
      if (opt && opt.extra) d.append(opt.extra);
      w.append(d);
    },
    view(S, c, w) {
      const st = S.st, me = c.me, myT = KR.teamOf(S, me), opp = myT ? krOpp(S, myT) : null;
      w.append(h('span', 'lbl', 'Runde ' + st.round + ' av ' + KR_ROUNDS));
      KR.tokens(S, w);
      if (st.ph === 'clue') {
        if (myT && KR.enc(S, myT) === me && !st.cl[myT]) {
          const code = st.code[myT]; const p = h('div', 'panel kr-enc');
          p.append(h('span', 'lbl', 'Du gir hint. Koden din er'));
          const cd = h('div', 'kr-code'); code.forEach((n) => cd.append(h('b', '', String(n)))); p.append(cd);
          UI.krC = UI.krC && UI.krC.r === st.round ? UI.krC : { r: st.round, v: ['', '', ''] };
          const ins = code.map((n, i) => { const lab = h('label', 'kr-in'); lab.append(h('span', '', n + ' · ' + st.kw[myT][n - 1])); const inp = h('input', 'ain'); inp.maxLength = 40; inp.autocomplete = 'off'; inp.placeholder = 'Hint for ' + st.kw[myT][n - 1]; inp.value = UI.krC.v[i]; inp.oninput = () => { UI.krC.v[i] = inp.value; }; lab.append(inp); p.append(lab); return inp; });
          p.append(h('p', 'fine', 'Ett eller noen få ord per hint. Ikke si selve ordet. Laget ditt må kunne knekke koden, men motstanderne ser alle hintene dine fra før.'));
          const msg = h('p', 'fine bl-msg', '');
          p.append(msg, btn('Send hintene', 'go big', () => { const v = ins.map((x) => x.value.trim()); if (v.some((x) => !x)) { msg.textContent = 'Skriv alle tre hintene.'; fx.bad(); return; } if (v.some((x, i) => norm(x).split(' ').includes(norm(st.kw[myT][code[i] - 1])))) { msg.textContent = 'Et hint inneholder selve ordet.'; fx.bad(); return; } fx.good(); UI.krC = null; dispatch({ t: 'clue', tid: myT, cl: v }); }));
          w.append(p);
        } else {
          const l = h('div', 'ansl'); S.pl.forEach((p) => { l.append(h('span', st.cl[p.id] ? 'done' : '', KR.enc(S, p.id) + (st.cl[p.id] ? ' er klar' : ' lager hint'))); }); w.append(l);
          watchLine(w, myT ? 'Venter på hintene …' : 'Du ser på');
        }
      } else if (st.ph === 'guess') {
        if (myT) {
          const iEnc = KR.enc(S, myT) === me;
          if (!st.gs[myT][myT]) {
            if (iEnc) { KR.clueSet(S, myT, w, { title: 'Dine hint', code: st.code[myT] }); watchLine(w, 'Laget ditt gjetter koden din …'); }
            else { KR.clueSet(S, myT, w, { title: 'Hint fra ' + KR.enc(S, myT) }); KR.picker(S, 'own' + st.round, w, (cd) => dispatch({ t: 'guess', tid: myT, c: cd }), 'Hvilken kode mente ' + KR.enc(S, myT) + '?'); }
          } else KR.clueSet(S, myT, w, { title: 'Laget har svart på egen kode', extra: h('p', 'fine', 'Gjettet ' + st.gs[myT][myT].join('-')) });
          if (st.round >= 2 && opp) {
            if (!st.gs[opp.id][myT]) { KR.clueSet(S, opp.id, w, { title: 'Avskjær ' + opp.name }); KR.picker(S, 'icp' + st.round, w, (cd) => dispatch({ t: 'guess', tid: opp.id, c: cd }), 'Hva er koden til ' + opp.name + '?'); }
            else KR.clueSet(S, opp.id, w, { title: 'Avskjæring sendt', extra: h('p', 'fine', 'Dere gjettet ' + st.gs[opp.id][myT].join('-')) });
          } else if (opp) KR.clueSet(S, opp.id, w, { title: 'Hintene til ' + opp.name + ' (ingen avskjæring i runde 1)' });
        } else S.pl.forEach((p) => KR.clueSet(S, p.id, w));
        const l = h('div', 'ansl'); KR.needs(S).forEach(([tid, gid]) => l.append(h('span', '', pname(gid) + (tid === gid ? ' gjetter egen kode' : ' avskjærer')))); w.append(l);
      } else if (st.ph === 'rev') {
        if (UI.krFx !== st.round) { UI.krFx = st.round; fx.reveal(); }
        S.pl.forEach((T) => {
          const O = krOpp(S, T.id), r = st.res.rows[T.id], ex = h('div', 'kr-res');
          ex.append(h('span', r.okOwn ? 'ok' : 'bad', T.name + ' gjettet ' + st.gs[T.id][T.id].join('-') + (r.okOwn ? ' ✓' : ' ✗ misforståelse')));
          if (r.icp) ex.append(h('span', r.okIcp ? 'bad' : 'ok', O.name + ' avskjærte ' + st.gs[T.id][O.id].join('-') + (r.okIcp ? ' ✓ avskjæring!' : ' ✗')));
          KR.clueSet(S, T.id, w, { title: T.name + ' · koden var ' + st.code[T.id].join('-'), code: st.code[T.id], extra: ex });
        });
        if (st.res.win) { const d = h('div', 'kr-win'); d.append(h('b', '', pname(st.res.win) + ' vinner!')); w.append(d); }
        if (c.host) w.append(btn(st.res.win ? 'Se resultatet' : (st.round >= KR_ROUNDS ? 'Til tiebreak' : 'Neste runde'), 'go big', () => dispatch({ t: 'next' }))); else watchLine(w, 'Venter på ' + S.host);
      } else if (st.ph === 'tb') {
        w.append(h('div', 'panel', 'Ingen vinner etter åtte runder. Gjett de fire ordene til motstanderne. Flest riktige vinner.'));
        if (myT && !st.tb[myT]) {
          UI.krT = UI.krT || ['', '', '', '']; const p = h('div', 'panel');
          const ins = [0, 1, 2, 3].map((i) => { const lab = h('label', 'kr-in'); lab.append(h('span', '', 'Ord ' + (i + 1))); const inp = h('input', 'ain'); inp.value = UI.krT[i]; inp.oninput = () => { UI.krT[i] = inp.value; }; lab.append(inp); p.append(lab); return inp; });
          p.append(btn('Send gjetningene', 'go big', () => { fx.sel(); dispatch({ t: 'tb', w: ins.map((x) => x.value) }); UI.krT = null; })); w.append(p);
        } else watchLine(w, 'Venter på det andre laget …');
      }
      if (myT) { w.append(h('span', 'lbl', 'Ordene deres')); KR.words(S, myT, w); KR.notes(S, myT, true, w); if (opp) KR.notes(S, opp.id, false, w); }
      else S.pl.forEach((p) => KR.notes(S, p.id, false, w));
    },
    endView(S, w) {
      const st = S.st, tr = h('div', 'trophy'); tr.innerHTML = TROPHY;
      tr.append(h('span', 'lbl', st.end.win ? 'Vinneren er' : 'Uavgjort'), h('b', '', st.end.win ? pname(st.end.win) : 'Ingen vinner'));
      if (st.end.tb && st.tbHits) tr.append(h('p', 'fine', S.pl.map((p) => p.name + ': ' + st.tbHits[p.id] + ' riktige ord').join(' · ')));
      w.append(tr);
      S.pl.forEach((p) => { const d = h('div', 'panel'); d.append(h('span', 'lbl', 'Ordene til ' + p.name)); KR.words(S, p.id, d); w.append(d); KR.notes(S, p.id, 'all', w); });
    },
    rank(S) { const st = S.st; return S.pl.map((p) => ({ id: p.id, name: p.name, col: p.col, val: st.tk[p.id].i + ' avskj. · ' + st.tk[p.id].m + ' misf.', n: st.end && st.end.win === p.id ? 1 : 0 })).sort((a, b) => b.n - a.n); }
  };

  // ============ KRYPTERT (les det rare høyt til det gir mening) ============
  // [kryptert tekst, løsning, kategori]
  const KY_EASY = [
    ['Sjø Kål Ade', 'Sjokolade', 'ord'], ['Pan Nek Ake', 'Pannekake', 'ord'], ['Tann Bør Ste', 'Tannbørste', 'ord'], ['Kjøl Esk Ap', 'Kjøleskap', 'ord'],
    ['Støv Su Ger', 'Støvsuger', 'ord'], ['Has Jel Nøtt', 'Hasselnøtt', 'ord'], ['Kaf Fe Trak Tår', 'Kaffetrakter', 'ord'], ['Vann Kokk Er', 'Vannkoker', 'ord'],
    ['Mo Bil Tele Fon', 'Mobiltelefon', 'ord'], ['Fjern Kon Troll', 'Fjernkontroll', 'ord'], ['Sol Bril Le Ne', 'Solbrillene', 'ord'], ['Bad Ekar Et', 'Badekaret', 'ord'],
    ['Snø Mann N', 'Snømann', 'ord'], ['Jule Nis Sen', 'Julenissen', 'ord'], ['Sov E Pose', 'Sovepose', 'ord'], ['Rygg Sekk', 'Ryggsekk', 'ord'],
    ['Kar Bonna Dee', 'Karbonade', 'ord'], ['Brun Nost', 'Brunost', 'ord'], ['Fiske Bål Ler', 'Fiskeboller', 'ord'], ['Lut Te Fisk', 'Lutefisk', 'ord'],
    ['Pin Ne Kjøtt', 'Pinnekjøtt', 'ord'], ['Vaff El Jern', 'Vaffeljern', 'ord'], ['Burs Dags Ka Ke', 'Bursdagskake', 'ord'], ['Sønd Ags Tur', 'Søndagstur', 'ord'],
    ['Kjæ Res Te', 'Kjæreste', 'ord'], ['Svi Germ Or', 'Svigermor', 'ord'], ['Best Eve N', 'Bestevenn', 'ord'], ['Hjem Me Kon Tor', 'Hjemmekontor', 'ord'],
    ['Mann Dags Mø Te', 'Mandagsmøte', 'ord'], ['Lønns Ø Kning', 'Lønnsøkning', 'ord'], ['Reg Ne Ark', 'Regneark', 'ord'], ['Fe Rie Peng Er', 'Feriepenger', 'ord'],
    ['Skat Te Mel Ding', 'Skattemelding', 'ord'], ['Bank Av Stem Ming', 'Bankavstemming', 'ord'], ['Års Regn Skap', 'Årsregnskap', 'ord'], ['Moms Opp Gjør', 'Momsoppgjør', 'ord'],
    ['Taco Fre Da', 'Tacofredag', 'ord'], ['Kjøtt Kak Er', 'Kjøttkaker', 'ord'], ['Is Krem Båt Tt', 'Iskrembåt', 'ord'], ['Pøl Se Me Brø', 'Pølse med brød', 'ord'],
    ['Fot Bal Kamp', 'Fotballkamp', 'ord'], ['Straf Fe Spark', 'Straffespark', 'ord'], ['Hatt Trikk', 'Hattrick', 'ord'], ['Rød Tko Rt', 'Rødt kort', 'ord'],
    ['Lang Ren N', 'Langrenn', 'ord'], ['Ski Hopp Bak Ken', 'Skihoppbakken', 'ord'], ['Trampo Lin E', 'Trampoline', 'ord'], ['Grill Pøl Se', 'Grillpølse', 'ord'],
    ['Fly Plas Sen', 'Flyplassen', 'tur'], ['Bår Ding Kor Tet', 'Boardingkortet', 'tur'], ['Sik Ker Hets Kon Troll', 'Sikkerhetskontroll', 'tur'], ['Pass Kon Troll', 'Passkontroll', 'tur'],
    ['Bag Asje Bånd', 'Bagasjebånd', 'tur'], ['Hot Ell Rom Met', 'Hotellrommet', 'tur'], ['Lei E Bil', 'Leiebil', 'tur'], ['Kre Ditt Kort', 'Kredittkort', 'tur'],
    ['Taks Fri Han Del', 'Taxfreehandel', 'tur'], ['Bil Le Tt Kon Troll', 'Billettkontroll', 'tur'], ['Vind Us Plass', 'Vindusplass', 'tur'], ['Mid Tgang', 'Midtgang', 'tur'],
    ['Ut Drik Nings Lag', 'Utdrikningslag', 'kveld'], ['Gut Te Tur', 'Guttetur', 'kveld'], ['Ut Te Pils', 'Utepils', 'kveld'], ['Fyl Le Syk', 'Fyllesyk', 'kveld'],
    ['Nak Spill', 'Nachspiel', 'kveld'], ['For Spill', 'Vorspiel', 'kveld'], ['Fill Le Angst', 'Fylleangst', 'kveld'], ['Bak Ruse', 'Bakrus', 'kveld'],
    ['En Till', 'Én til', 'kveld'], ['Siss Te Runn De', 'Siste runde', 'kveld'], ['Hall Ve Lit Er', 'Halvliter', 'kveld'], ['Kar Rao Kei', 'Karaoke', 'kveld'],
    ['Snu Sbåks', 'Snusboks', 'kveld'], ['Tak Si Kø En', 'Taxikøen', 'kveld'], ['Ke Babb Ve Fire Tid En', 'Kebab ved firetiden', 'kveld'], ['Øl Ma Ge', 'Ølmage', 'kveld'],
    ['Sjekk Ere Plikk', 'Sjekkereplikk', 'kveld'], ['Dans Egg Ul Vet', 'Dansegulvet', 'kveld'], ['Dør Vakt En', 'Dørvakten', 'kveld'], ['Bråk Mak Er', 'Bråkmaker', 'kveld'],
    ['Skoll Får Gut Ta', 'Skål for gutta', 'kveld'], ['Ung Kars Liv', 'Ungkarsliv', 'kveld'], ['Hode Pi Ne', 'Hodepine', 'kveld'], ['Vann Til Na Tten', 'Vann til natten', 'kveld'],
    ['Bed Re Sent Enn Al Dri', 'Bedre sent enn aldri', 'uttrykk'], ['Mår Gens Tun Ha Gul Lim Mun', 'Morgenstund har gull i munn', 'uttrykk'], ['Al Dris I Al Dri', 'Aldri si aldri', 'uttrykk'],
    ['Sto Reg Ut Ter Gri Ner Ikke', 'Store gutter griner ikke', 'uttrykk'], ['Hip Hipp Hur Ra', 'Hipp hipp hurra', 'uttrykk'], ['Grat Tul Le Rer', 'Gratulerer', 'uttrykk'],
    ['Tad E Med Ro', 'Ta det med ro', 'uttrykk'], ['Hel Tsy Kt', 'Helt sykt', 'uttrykk'], ['De Tår Dner Sei', 'Det ordner seg', 'uttrykk'], ['Barre Hyggel Li', 'Bare hyggelig', 'uttrykk'],
    ['Fris Kfra Fjøs Et', 'Frisk fra fjøset', 'uttrykk'], ['Ut Tea Kjø Re', 'Ute å kjøre', 'uttrykk'], ['Takk Fårs Ist', 'Takk for sist', 'uttrykk'], ['Gå Påsk Ke', 'God påske', 'uttrykk'],
    ['Gå Djul', 'God jul', 'uttrykk'], ['Gått Nytt År', 'Godt nytt år', 'uttrykk'], ['Ha Debb Ra', 'Ha det bra', 'uttrykk'], ['Så Vgått', 'Sov godt', 'uttrykk'],
    ['Dett Ers Ånn Livv Er', 'Det er sånn livet er', 'uttrykk'], ['Plu Sog Min Us', 'Pluss og minus', 'uttrykk'], ['Kast Tinn Hån Kle Et', 'Kaste inn håndkleet', 'uttrykk'], ['Hel Tål Rait', 'Helt all right', 'uttrykk'],
    ['Dag Gen Dær På', 'Dagen derpå', 'uttrykk'], ['Vær Dens Bæs Te', 'Verdens beste', 'uttrykk'], ['Sånn Ers Det', 'Sånn er det', 'uttrykk'], ['Hvaf Fårn Oe', 'Hva for noe', 'uttrykk'],
    ['Kånga Rall', 'Kong Harald', 'navn'], ['Ærl Ing Hå Land', 'Erling Haaland', 'navn'], ['Olle Gun Nars Ol Sjær', 'Ole Gunnar Solskjær', 'navn'], ['Mang Nus Karl Sen', 'Magnus Carlsen', 'navn'],
    ['Ma Rit Bjør Gen', 'Marit Bjørgen', 'navn'], ['Pet Ter Nårt Hugg', 'Petter Northug', 'navn'], ['Kar Stein Var Holm', 'Karsten Warholm', 'navn'], ['Henn Rikk Ibb Sen', 'Henrik Ibsen', 'navn'],
    ['Ed Varr Mung', 'Edvard Munch', 'navn'], ['Teik Ån Mi', 'Take On Me', 'navn'], ['Flå Kly Pagran Pri', 'Flåklypa Grand Prix', 'navn'], ['Olls Enb And En', 'Olsenbanden', 'navn'],
    ['Tit An Nikk', 'Titanic', 'navn'], ['Hær Ri Pått Er', 'Harry Potter', 'navn'], ['Rin Genes Hær Re', 'Ringenes herre', 'navn'], ['Sta Vårs', 'Star Wars', 'navn'],
    ['Bånd Sjeims Bånd', 'Bond, James Bond', 'navn'], ['Gu Dfar En', 'Gudfaren', 'navn'], ['Elv Is Pres Li', 'Elvis Presley', 'navn'], ['Mai Kel Sjekk Sen', 'Michael Jackson', 'navn'],
    ['Bran Stad Ion', 'Brann stadion', 'steder'], ['Brygg Gen', 'Bryggen', 'steder'], ['Fløy En', 'Fløyen', 'steder'], ['Ull Rik Ken', 'Ulriken', 'steder'],
    ['Lill Leh Ammer', 'Lillehammer', 'steder'], ['Hamm Er Fest', 'Hammerfest', 'steder'], ['Krist Jan Sann', 'Kristiansand', 'steder'], ['Bær Gens Ban En', 'Bergensbanen', 'steder'],
    ['Hurt Ig Rut En', 'Hurtigruten', 'steder'], ['Nordk App', 'Nordkapp', 'steder'], ['Gar Dermo En', 'Gardermoen', 'steder'], ['Flæs Lan', 'Flesland', 'steder'],
    ['Eiff El Tår Net', 'Eiffeltårnet', 'steder'], ['Mal Jork A', 'Mallorca', 'steder'], ['Grann Kan Aria', 'Gran Canaria', 'steder'], ['Lass Ve Gass', 'Las Vegas', 'steder'],
    ['Nju Jårk', 'New York', 'steder'], ['Trond Hei Mm', 'Trondheim', 'steder'], ['Stav Ang Er', 'Stavanger', 'steder'], ['Tromm Sø', 'Tromsø', 'steder']
  ];
  const KY_HARD = [
    ["Mår Genst Unna Gull Imm Un", "Morgenstund har gull i munn", "uttrykk"],
    ["Dæ Rin Gens Ak", "Det er ingen sak", "uttrykk"],
    ["Bår Te Bram Enn Jem Mebb Est", "Borte bra, men hjemme best", "uttrykk"],
    ["Ut Påt Ural Dris Ur", "Ut på tur, aldri sur", "uttrykk"],
    ["Smim Ens Jærn Eter Var Mt", "Smi mens jernet er varmt", "uttrykk"],
    ["Al Leg Åde Tin Ger Tre", "Alle gode ting er tre", "uttrykk"],
    ["Gamm Elv Ane Ærv Ånå Vend E", "Gammel vane er vond å vende", "uttrykk"],
    ["Lit Entu Evel Tærs Tårt Las", "Liten tue velter stort lass", "uttrykk"],
    ["Mang Ebekk Ersm Åjør Ens Tårå", "Mange bekker små gjør en stor å", "uttrykk"],
    ["Dens Åmint Et Våg Erint Et Vinn Er", "Den som intet våger intet vinner", "uttrykk"],
    ["Nårk Att Ener Bårt Edan Sær Mus Ene", "Når katten er borte, danser musene", "uttrykk"],
    ["Tad Emedd Ro", "Ta det med ro", "uttrykk"],
    ["Bar Ehygg Eli", "Bare hyggelig", "uttrykk"],
    ["Dæ Tår Dnær Sei", "Det ordner seg", "uttrykk"],
    ["Takf År Sist", "Takk for sist", "uttrykk"],
    ["Had Ebra", "Ha det bra", "uttrykk"],
    ["Hel Tæk Sas", "Helt Texas", "uttrykk"],
    ["Ikk Etal Eåm", "Ikke tale om", "uttrykk"],
    ["Snak Kåmf Laks", "Snakk om flaks", "uttrykk"],
    ["Rett Ifl Eis En", "Rett i fleisen", "uttrykk"],
    ["Ing Enfa Re", "Ingen fare", "uttrykk"],
    ["Gåd Egam Led Ager", "Gode gamle dager", "uttrykk"],
    ["Gratt Tull Lærer Medd Agen", "Gratulerer med dagen", "uttrykk"],
    ["Ja Vie Ls Kerd Ette Lann Ne", "Ja, vi elsker dette landet", "uttrykk"],
    ["Hur Raf Ord Ei Så Mfy Lerd It Tår", "Hurra for deg som fyller ditt år", "uttrykk"],
    ["Sjem Peb Ra", "Kjempebra", "uttrykk"],
    ["Lykk Etil", "Lykke til", "uttrykk"],
    ["Åt Tetuss En Fem Hun Dr Åsytt Isj U", "Åtte tusen fem hundre og syttisju", "uttrykk"],
    ["Hakk Ebakk Esk Ågen", "Hakkebakkeskogen", "navn"],
    ["Karr Dem Åm Meby", "Kardemomme by", "navn"],
    ["Pipp Pilang Strøm Pe", "Pippi Langstrømpe", "navn"],
    ["Kapp Tein Saab Elt Ann", "Kaptein Sabeltann", "navn"],
    ["Kar Ius Såbb Akt Us", "Karius og Baktus", "navn"],
    ["Rei Sent Ilju Lest Jær Nen", "Reisen til julestjernen", "navn"],
    ["Trenn Øtt Ert Ill Ask Ep Ått", "Tre nøtter til Askepott", "navn"],
    ["Rin Genn Esh Ærre", "Ringenes herre", "navn"],
    ["Olleb Rum", "Ole Brumm", "navn"],
    ["Då Nald Dakk", "Donald Duck", "navn"],
    ["Ærl Ingbr Aut Hål And", "Erling Braut Haaland", "navn"],
    ["Ol Egun Nars Åls Jær", "Ole Gunnar Solskjær", "navn"],
    ["Drå Nings Ån Ja", "Dronning Sonja", "navn"],
    ["Krån Prin Shåk Ån", "Kronprins Haakon", "navn"],
    ["Mang Nusk Arl Sen", "Magnus Carlsen", "navn"],
    ["Mar Ritt Bjørr Gen", "Marit Bjørgen", "navn"],
    ["Hænr Ik Kibb Sen", "Henrik Ibsen", "navn"],
    ["Edv Ard Grig", "Edvard Grieg", "navn"],
    ["Rå Al Damm Un Sen", "Roald Amundsen", "navn"],
    ["Tårr Hei Er Dal", "Thor Heyerdahl", "navn"],
    ["Tei Kån Mi", "Take On Me", "navn"],
    ["Hæi Sjud", "Hey Jude", "navn"],
    ["Bå Him Ian Rapp Så Di", "Bohemian Rhapsody", "navn"],
    ["Våt Ær Lu", "Waterloo", "navn"],
    ["Lett Ibi", "Let It Be", "navn"],
    ["Jell Åsabb Marin", "Yellow Submarine", "navn"],
    ["Hai Veitu Hell", "Highway to Hell", "navn"],
    ["Pørp Elrein", "Purple Rain", "navn"],
    ["Bil Lisjin", "Billie Jean", "navn"],
    ["Hær Ripp Åtter", "Harry Potter", "navn"],
    ["Sju Ræs Sikk Park", "Jurassic Park", "navn"],
    ["Delai An King", "The Lion King", "navn"],
    ["Åls Enb And En", "Olsenbanden", "navn"],
    ["Flåk Lyp Agran Pri", "Flåklypa Grand Prix", "navn"],
    ["Mest Ærn Esm Ester", "Mesternes mester", "navn"],
    ["Syt Tienng Rad Ernor", "71° nord", "navn"],
    ["Nårk App", "Nordkapp", "steder"],
    ["Lå Fot Ten", "Lofoten", "steder"],
    ["Geir Ang Erfj Oren", "Geirangerfjorden", "steder"],
    ["Prei Kest Ål En", "Preikestolen", "steder"],
    ["Tråll Tung Ga", "Trolltunga", "steder"],
    ["Hål Menk All En", "Holmenkollen", "steder"],
    ["Brygg Eni Bær Gen", "Bryggen i Bergen", "steder"],
    ["Fløy Bann En", "Fløibanen", "steder"],
    ["Akk Ersh Usf Est Ning", "Akershus festning", "steder"],
    ["Vig El Ans Par Ken", "Vigelandsparken", "steder"],
    ["Åp Pera Hus Et", "Operahuset", "steder"],
    ["Gard Ærm Åen", "Gardermoen", "steder"],
    ["Kristj Ans Ann Dyr Epark", "Kristiansand dyrepark", "steder"],
    ["Tus Enfr Yd", "Tusenfryd", "steder"],
    ["Hurt Igr Uten", "Hurtigruten", "steder"],
    ["Lil Leh Amm Ær", "Lillehammer", "steder"],
    ["Tråm Søb Rua", "Tromsøbrua", "steder"],
    ["Tannb Ørst E", "Tannbørste", "ord"],
    ["Sjøl Es Kap", "Kjøleskap", "ord"],
    ["Støfs Ug Er", "Støvsuger", "ord"],
    ["Åpp Vas Kmas Sjin", "Oppvaskmaskin", "ord"],
    ["Vask Emas Sjin", "Vaskemaskin", "ord"],
    ["Mik Robøl Geåvn", "Mikrobølgeovn", "ord"],
    ["Fjærnk Ånt Råll", "Fjernkontroll", "ord"],
    ["Sål Bril Ler", "Solbriller", "ord"],
    ["Parr Ap Ly", "Paraply", "ord"],
    ["Snøm Ann", "Snømann", "ord"],
    ["Pin Ne Sjøtt", "Pinnekjøtt", "ord"],
    ["Lut Efisk", "Lutefisk", "ord"],
    ["Bru Nost", "Brunost", "ord"],
    ["Får Ikk Ål", "Fårikål", "ord"],
    ["Sjøt Kak Erib Run Saus", "Kjøttkaker i brun saus", "ord"],
    ["Pøls Emmel Åmpe", "Pølse med lompe", "ord"],
    ["Tak Åfr Edag", "Tacofredag", "ord"],
    ["Pits Agran Di Åsa", "Pizza Grandiosa", "ord"],
    ["Kaff Emas Sjin", "Kaffemaskin", "ord"],
    ["Jul Ebor", "Julebord", "ord"],
    ["Bank Afst Emm Ing", "Bankavstemming", "ord"],
    ["Skatt Emel Ding", "Skattemelding", "ord"],
    ["Man Dagsm Øte", "Mandagsmøte", "ord"],
    ["Jem Mek Ånt År", "Hjemmekontor", "ord"],
    ["Fer Iep Eng Er", "Feriepenger", "ord"],
    ["Lønsf Årh And Ling", "Lønnsforhandling", "ord"],
    ["Hod Epin E", "Hodepine", "ord"],
    ["Bad Ebass Eng", "Badebasseng", "ord"],
    ["Flyp Las", "Flyplass", "tur"],
    ["Sikk Ærh Etsk Ånt Råll", "Sikkerhetskontroll", "tur"],
    ["Pas Skånt Råll", "Passkontroll", "tur"],
    ["Bag Gasj Ebånn", "Bagasjebånd", "tur"],
    ["Bår Dink Årt", "Boardingkort", "tur"],
    ["Vin Dus Plas", "Vindusplass", "tur"],
    ["Nødd Utg Ang", "Nødutgang", "tur"],
    ["Set Ebel Te", "Setebelte", "tur"],
    ["Turb Ul Ens", "Turbulens", "tur"],
    ["Flyv Ærtin Ne", "Flyvertinne", "tur"],
    ["Sjett Lag", "Jetlag", "tur"],
    ["Hot Elfr Åk Åst", "Hotellfrokost", "tur"],
    ["Lei Ebil Nøk Kel", "Leiebilnøkkel", "tur"],
    ["Bakk Russ", "Bakrus", "kveld"],
    ["Utd Rikk Nings Lag", "Utdrikningslag", "kveld"],
    ["Nak Spil", "Nachspiel", "kveld"],
    ["Fårs Pil", "Vorspiel", "kveld"],
    ["Sist Erunn De", "Siste runde", "kveld"],
    ["Ent Il", "Én til", "kveld"],
    ["Dør Vakkt", "Dørvakt", "kveld"],
    ["Karr Rao Ke", "Karaoke", "kveld"],
    ["Hal Vlit Er", "Halvliter", "kveld"],
    ["Fyll Esyk", "Fyllesyk", "kveld"],
    ["Fyll Eang St", "Fylleangst", "kveld"],
    ["Tak Sik Ø", "Taxikø", "kveld"],
    ["Skål Fårg Utta", "Skål for gutta", "kveld"],
    ["Gut Tet Ur", "Guttetur", "kveld"],
    ["Fred Agsp Ils", "Fredagspils", "kveld"],
    ["Ke Babb Ved Fir Etid En", "Kebab ved firetiden", "kveld"],
    ["Sjekk Ærr Epl Ikk", "Sjekkereplikk", "kveld"],
    ["Dan Seg Ulv Et", "Dansegulvet", "kveld"],
    ["Ølm Agge", "Ølmage", "kveld"],
    ["Vann Tiln Att En", "Vann til natten", "kveld"]
  ];
  const KY_X = [
    ["Morge Nstu Nnhargg Ulli Munn", "Morgenstund har gull i munn", "uttrykk"],
    ["Deæ Ringe Ns Ak", "Det er ingen sak", "uttrykk"],
    ["Bo Rtebb Ramenj Emm Ebest", "Borte bra, men hjemme best", "uttrykk"],
    ["Utt Påt Urald Risur", "Ut på tur, aldri sur", "uttrykk"],
    ["Smim Ensj Er Netæ Rvar Mtt", "Smi mens jernet er varmt", "uttrykk"],
    ["Al Lego Dett Ingæ Rtre", "Alle gode ting er tre", "uttrykk"],
    ["Gamm Elva Neæ Rvon Nåv Ende", "Gammel vane er vond å vende", "uttrykk"],
    ["Lite Nt Uevv Eltæ Rs To Rtlass", "Liten tue velter stort lass", "uttrykk"],
    ["Mang Ebe Kkærs Måjø Renn Storå", "Mange bekker små gjør en stor å", "uttrykk"],
    ["De Nsomi Ntt Etvv Ågæri Nte Tvin Nær", "Den som intet våger intet vinner", "uttrykk"],
    ["Nårka Tten Ærb Orted Ansæ Rmu Sene", "Når katten er borte, danser musene", "uttrykk"],
    ["Tad Emed Ro", "Ta det med ro", "uttrykk"],
    ["Bareh Ygge Li", "Bare hyggelig", "uttrykk"],
    ["Deo Rdnæ Rsæi", "Det ordner seg", "uttrykk"],
    ["Takkf Orsi St", "Takk for sist", "uttrykk"],
    ["Had Eb Ra", "Ha det bra", "uttrykk"],
    ["Hell Ttek Sas", "Helt Texas", "uttrykk"],
    ["Ikkett Aleo M", "Ikke tale om", "uttrykk"],
    ["Sna Kkomf Laks", "Snakk om flaks", "uttrykk"],
    ["Retti Fll Æisenn", "Rett i fleisen", "uttrykk"],
    ["Ingenf Are", "Ingen fare", "uttrykk"],
    ["Godd Egaml Eda Gær", "Gode gamle dager", "uttrykk"],
    ["Grat Ulerr Ærm Edda Genn", "Gratulerer med dagen", "uttrykk"],
    ["Jav Ielss Kærd Ett Elann Det", "Ja, vi elsker dette landet", "uttrykk"],
    ["Hurr Afo Rdæis Omff Yll Ærd Ittårr", "Hurra for deg som fyller ditt år", "uttrykk"],
    ["Sj Em Pebra", "Kjempebra", "uttrykk"],
    ["Lyk Ketil", "Lykke til", "uttrykk"],
    ["Åttet Usenn Fe Mhun Dreå Sytt Isju", "Åtte tusen fem hundre og syttisju", "uttrykk"],
    ["Hakk Eba Kke Skog En", "Hakkebakkeskogen", "navn"],
    ["Kar Demo Mm Eby", "Kardemomme by", "navn"],
    ["Pippil An Gs Trøm Pe", "Pippi Langstrømpe", "navn"],
    ["Kap Tæ Insa Bell Tann", "Kaptein Sabeltann", "navn"],
    ["Kari Usåba Ktt Uss", "Karius og Baktus", "navn"],
    ["Ræi Sent Ilju Le Stje Rnen", "Reisen til julestjernen", "navn"],
    ["Tr Enøt Tærti La Skepo Tt", "Tre nøtter til Askepott", "navn"],
    ["Ringe Nes Her Re", "Ringenes herre", "navn"],
    ["Oleb Rumm", "Ole Brumm", "navn"],
    ["Don Alld Ukk", "Donald Duck", "navn"],
    ["Err Ling Brau Thå La Nn", "Erling Braut Haaland", "navn"],
    ["Oleg Unn Ars Olss Jærr", "Ole Gunnar Solskjær", "navn"],
    ["Dro Nnin Gsonn Ja", "Dronning Sonja", "navn"],
    ["Kro Nprr Inn Shå Kon", "Kronprins Haakon", "navn"],
    ["Mag Nusk Arlss En", "Magnus Carlsen", "navn"],
    ["Mari Tbj Ørgen", "Marit Bjørgen", "navn"],
    ["Henn Riki Bsenn", "Henrik Ibsen", "navn"],
    ["Edv Argg Riæi", "Edvard Grieg", "navn"],
    ["Roal Lamu Nds En", "Roald Amundsen", "navn"],
    ["Torhe Yerdd Ahl", "Thor Heyerdahl", "navn"],
    ["Take Onme", "Take On Me", "navn"],
    ["Heyj Ude", "Hey Jude", "navn"],
    ["Bohe Mian Rhapp Sody", "Bohemian Rhapsody", "navn"],
    ["Vate Rlu", "Waterloo", "navn"],
    ["Letit Be", "Let It Be", "navn"],
    ["Yell Ovs Ubmm Ari Ne", "Yellow Submarine", "navn"],
    ["Highvv Aytoh Ell", "Highway to Hell", "navn"],
    ["Pu Rplerr Ain", "Purple Rain", "navn"],
    ["Billi Ej Eann", "Billie Jean", "navn"],
    ["Harr Ypott Ær", "Harry Potter", "navn"],
    ["Jurr Assi Spa Rkk", "Jurassic Park", "navn"],
    ["Tell Io Nking", "The Lion King", "navn"],
    ["Ol Senbb Andenn", "Olsenbanden", "navn"],
    ["Flå Kly Pag Rannp Rikss", "Flåklypa Grand Prix", "navn"],
    ["Mes Ter Nes Mess Tærr", "Mesternes mester", "navn"],
    ["Nord Kapp", "Nordkapp", "steder"],
    ["Lofott Enn", "Lofoten", "steder"],
    ["Gæira Nge Rfjo Rd En", "Geirangerfjorden", "steder"],
    ["Præ Ikest Olen", "Preikestolen", "steder"],
    ["Trol Ltunn Ga", "Trolltunga", "steder"],
    ["Hol Menko Ll Enn", "Holmenkollen", "steder"],
    ["Brygg Gen Iberr Genn", "Bryggen i Bergen", "steder"],
    ["Fløib Ann En", "Fløibanen", "steder"],
    ["Akk Ersh Usf Es Tning", "Akershus festning", "steder"],
    ["Vige Lan Dspp Ark Enn", "Vigelandsparken", "steder"],
    ["Ope Ra Huset", "Operahuset", "steder"],
    ["Gard Erm Oen", "Gardermoen", "steder"],
    ["Kris Tian Sa Nndd Yrepa Rk", "Kristiansand dyrepark", "steder"],
    ["Tusen Frydd", "Tusenfryd", "steder"],
    ["Hurt Igr Utt Enn", "Hurtigruten", "steder"],
    ["Li Lleh Am Mærr", "Lillehammer", "steder"],
    ["Trom Søb Rua", "Tromsøbrua", "steder"],
    ["Tann Nbø Rste", "Tannbørste", "ord"],
    ["Sjøl Eskap", "Kjøleskap", "ord"],
    ["Stø Vsugær", "Støvsuger", "ord"],
    ["Opp Vas Kmaskk In", "Oppvaskmaskin", "ord"],
    ["Vas Kema Skinn", "Vaskemaskin", "ord"],
    ["Mikro Bølge Ovn", "Mikrobølgeovn", "ord"],
    ["Fj Ernk Ontro Ll", "Fjernkontroll", "ord"],
    ["So Lbr Ill Ærr", "Solbriller", "ord"],
    ["Parr Aply", "Paraply", "ord"],
    ["Sn Ømann", "Snømann", "ord"],
    ["Pinn Esjøtt", "Pinnekjøtt", "ord"],
    ["Lute Fiskk", "Lutefisk", "ord"],
    ["Brun Ost", "Brunost", "ord"],
    ["Fåri Kåll", "Fårikål", "ord"],
    ["Sjø Ttka Kæri Bru Nsaus", "Kjøttkaker i brun saus", "ord"],
    ["Pøls Emedll Ompe", "Pølse med lompe", "ord"],
    ["Tak Ofre Dag", "Tacofredag", "ord"],
    ["Piss Agr Andio Sa", "Pizza Grandiosa", "ord"],
    ["Kaffe Ma Skin", "Kaffemaskin", "ord"],
    ["Ju Lebor", "Julebord", "ord"],
    ["Ba Nkav Ste Mmi Ngg", "Bankavstemming", "ord"],
    ["Skatt Em Eldingg", "Skattemelding", "ord"],
    ["Manda Gs Mø Te", "Mandagsmøte", "ord"],
    ["Je Mmekk Ontor", "Hjemmekontor", "ord"],
    ["Fe Riep Engærr", "Feriepenger", "ord"],
    ["Løn Nsfo Rha Ndli Ng", "Lønnsforhandling", "ord"],
    ["Hodd Epine", "Hodepine", "ord"],
    ["Ba Deb Asse Ngg", "Badebasseng", "ord"],
    ["Flypp Lass", "Flyplass", "tur"],
    ["Si Kker Hetsk Ontro Ll", "Sikkerhetskontroll", "tur"],
    ["Pa Sskk Ontr Oll", "Passkontroll", "tur"],
    ["Ba Ga Sjebå Nn", "Bagasjebånd", "tur"],
    ["Bo Ardi Ngkortt", "Boardingkort", "tur"],
    ["Vind Uspla Ss", "Vindusplass", "tur"],
    ["Nødd Utga Ng", "Nødutgang", "tur"],
    ["Sete Bel Te", "Setebelte", "tur"],
    ["Tu Rbull Ens", "Turbulens", "tur"],
    ["Flyv Ertin Ne", "Flyvertinne", "tur"],
    ["Jetl Ag", "Jetlag", "tur"],
    ["Hot Ell Lfrr Okost", "Hotellfrokost", "tur"],
    ["Læi Ebilnn Øk Kell", "Leiebilnøkkel", "tur"],
    ["Ba Krus", "Bakrus", "kveld"],
    ["Utt Drikn Ingsl Agg", "Utdrikningslag", "kveld"],
    ["Nash Spi El", "Nachspiel", "kveld"],
    ["Vo Rsp Iel", "Vorspiel", "kveld"],
    ["Sis Ter Unde", "Siste runde", "kveld"],
    ["Ntil", "Én til", "kveld"],
    ["Dørr Vakt", "Dørvakt", "kveld"],
    ["Kara Oke", "Karaoke", "kveld"],
    ["Hal Vlitær", "Halvliter", "kveld"],
    ["Fylle Syk", "Fyllesyk", "kveld"],
    ["Fylle Angg St", "Fylleangst", "kveld"],
    ["Tak Sikø", "Taxikø", "kveld"],
    ["Skk Ålfo Rgutt Ta", "Skål for gutta", "kveld"],
    ["Gutte Turr", "Guttetur", "kveld"],
    ["Fre Dag Spi Ls", "Fredagspils", "kveld"],
    ["Ke Bab Ve Dfire Tid En", "Kebab ved firetiden", "kveld"],
    ["Sjek Ke Rep Likk", "Sjekkereplikk", "kveld"],
    ["Dan Segul Vet", "Dansegulvet", "kveld"],
    ["Ølmm Age", "Ølmage", "kveld"],
    ["Va Nnti Lnatt En", "Vann til natten", "kveld"],
    ["Sjo Ko La De", "Sjokolade", "ord"],
    ["Pann Ekake", "Pannekake", "ord"],
    ["Hass Eln Øtt", "Hasselnøtt", "ord"],
    ["Kaffe Trakk Tær", "Kaffetrakter", "ord"],
    ["Vann Kok Ær", "Vannkoker", "ord"],
    ["Mobi Lt Elefon", "Mobiltelefon", "ord"],
    ["So Lbri Lle Ne", "Solbrillene", "ord"],
    ["Bade Karet", "Badekaret", "ord"],
    ["Ju Leni Ssen", "Julenissen", "ord"],
    ["Sove Po Se", "Sovepose", "ord"],
    ["Rygg Sekk", "Ryggsekk", "ord"],
    ["Kar Bonade", "Karbonade", "ord"],
    ["Fiskk Ebol Lær", "Fiskeboller", "ord"],
    ["Vaffe Lje Rn", "Vaffeljern", "ord"],
    ["Bu Rsda Gskake", "Bursdagskake", "ord"],
    ["Sønd Agst Ur", "Søndagstur", "ord"],
    ["Sjære Ste", "Kjæreste", "ord"],
    ["Sv Ige Rm Or", "Svigermor", "ord"],
    ["Best Eve Nn", "Bestevenn", "ord"],
    ["Lønn Søkn Ing", "Lønnsøkning", "ord"],
    ["Re Gne Ark", "Regneark", "ord"],
    ["Årsre Gnskapp", "Årsregnskap", "ord"],
    ["Moms Opp Gjør", "Momsoppgjør", "ord"],
    ["Sjøt Tka Kær", "Kjøttkaker", "ord"],
    ["Isk Re Mbåt", "Iskrembåt", "ord"],
    ["Pøl Se Medbb Rødd", "Pølse med brød", "ord"],
    ["Fot Ball Kampp", "Fotballkamp", "ord"],
    ["Stra Ff Esp Arkk", "Straffespark", "ord"],
    ["Hattr Ikk", "Hattrick", "ord"],
    ["Rødtkk Ort", "Rødt kort", "ord"],
    ["Lan Gre Nn", "Langrenn", "ord"],
    ["Sk Ihopp Pbakk Ken", "Skihoppbakken", "ord"],
    ["Tram Pol Ine", "Trampoline", "ord"],
    ["Grr Ill Pølse", "Grillpølse", "ord"],
    ["Flypl Ass En", "Flyplassen", "tur"],
    ["Boa Rdd Ingk Ortt Et", "Boardingkortet", "tur"],
    ["Hotel Lrom Met", "Hotellrommet", "tur"],
    ["Læie Bil", "Leiebil", "tur"],
    ["Kre Ditt Kortt", "Kredittkort", "tur"],
    ["Taks Fri Handel", "Taxfreehandel", "tur"],
    ["Bi Llett Kontt Roll", "Billettkontroll", "tur"],
    ["Midtgg Ang", "Midtgang", "tur"],
    ["Ut Epils", "Utepils", "kveld"],
    ["Snu Sbo Ks", "Snusboks", "kveld"],
    ["Taks Ikøen", "Taxikøen", "kveld"],
    ["Dørv Akt En", "Dørvakten", "kveld"],
    ["Br Åk Ma Kærr", "Bråkmaker", "kveld"],
    ["Ungka Rsliv", "Ungkarsliv", "kveld"],
    ["Bedr Ese Nten Nall Dri", "Bedre sent enn aldri", "uttrykk"],
    ["Aldd Ri Sia Ldri", "Aldri si aldri", "uttrykk"],
    ["Sto Reg Ut Tæ Rgri Nærik Ke", "Store gutter griner ikke", "uttrykk"],
    ["Hip Phipph Ur Ra", "Hipp hipp hurra", "uttrykk"],
    ["Gr At Uler Ærr", "Gratulerer", "uttrykk"],
    ["Hel Tsy Kt", "Helt sykt", "uttrykk"],
    ["Fr Is Kf Raf Jøsett", "Frisk fra fjøset", "uttrykk"],
    ["Uteåss Jøre", "Ute å kjøre", "uttrykk"],
    ["Go Dpå Ske", "God påske", "uttrykk"],
    ["Go Djul", "God jul", "uttrykk"],
    ["God Tny Ttå R", "Godt nytt år", "uttrykk"],
    ["Sovg Odt", "Sov godt", "uttrykk"],
    ["Deærss Ånnli Ve Tærr", "Det er sånn livet er", "uttrykk"],
    ["Plus Såmi Nus", "Pluss og minus", "uttrykk"],
    ["Kaste Innh Åndkk Lit", "Kaste inn håndkleet", "uttrykk"],
    ["Hel Ta Llri Ght", "Helt all right", "uttrykk"],
    ["Dag End Erpå", "Dagen derpå", "uttrykk"],
    ["Ve Rde Nsbe Ste", "Verdens beste", "uttrykk"],
    ["Sån Næ Rde", "Sånn er det", "uttrykk"],
    ["Vaf Ornoe", "Hva for noe", "uttrykk"],
    ["Kon Ghara Ll", "Kong Harald", "navn"],
    ["Erlin Ghål Ann", "Erling Haaland", "navn"],
    ["Pett Ærno Rtugg", "Petter Northug", "navn"],
    ["Kars Tenv Arho Lmm", "Karsten Warholm", "navn"],
    ["Ed Varm Unsh", "Edvard Munch", "navn"],
    ["Ti Tann Is", "Titanic", "navn"],
    ["Sta Rvars", "Star Wars", "navn"],
    ["Bon Njame Sbo Nn", "Bond, James Bond", "navn"],
    ["Gudf Aren", "Gudfaren", "navn"],
    ["El Visp Resll Ey", "Elvis Presley", "navn"],
    ["Miss Haelj Ak Kson", "Michael Jackson", "navn"],
    ["Bran Nstadd Ion", "Brann stadion", "steder"],
    ["Brygg En", "Bryggen", "steder"],
    ["Flø Yenn", "Fløyen", "steder"],
    ["Ulrik En", "Ulriken", "steder"],
    ["Ha Mme Rfe St", "Hammerfest", "steder"],
    ["Kri Sti Ansann", "Kristiansand", "steder"],
    ["Ber Gen Sba Nen", "Bergensbanen", "steder"],
    ["Fless Lann", "Flesland", "steder"],
    ["Æiff Eltå Rnet", "Eiffeltårnet", "steder"],
    ["Mall Lor Ka", "Mallorca", "steder"],
    ["Gr Ankan Aria", "Gran Canaria", "steder"],
    ["Lass Veg As", "Las Vegas", "steder"],
    ["Nevyo Rk", "New York", "steder"],
    ["Tron Dhæim", "Trondheim", "steder"],
    ["Stava Ngærr", "Stavanger", "steder"],
    ["Tr Omsø", "Tromsø", "steder"]
  ];
  const KY_CARDS = KY_X.map((c) => c.concat('x')).concat(KY_HARD.map((c) => c.concat('h'))).concat(KY_EASY.map((c) => c.concat('e')));
  const KY_CATS = { ord: 'Ord', tur: 'På tur', kveld: 'Kvelden', uttrykk: 'Uttrykk', navn: 'Kjente navn', steder: 'Steder' };
  function kyPool(cfg) { const cats = cfg.cats && cfg.cats.length ? cfg.cats : Object.keys(KY_CATS); const lv = cfg.lv2 || 'x'; return KY_CARDS.map((c, i) => [c, i]).filter(([c]) => cats.includes(c[2]) && (lv === 'mix' || c[3] === lv)).map(([, i]) => i); }
  const KY = {
    name: 'Kryptert', kicker: 'Les det rart', glow: '#2a0f3a', teams: true, minP: 1,
    rules: 'Den som har tur, får en kryptert tekst som ser ut som tull, for eksempel «Sjø Kål Ade». Les den høyt, fort og om igjen til den blir til noe som gir mening: sjokolade. Knekk så mange du klarer på ett minutt. De andre kan gi hint. Online ser de andre løsningen og trykker riktig.',
    solo: 'Alene: se hvor mange du knekker på ett minutt.',
    defaults: () => ({ secs: 60, turns: 3, cats: [], sip: true, lv2: 'x' }),
    options(cfg, el, re) {
      el.append(h('span', 'lbl', 'Tid per tur')); el.append(seg([['45 s', 45], ['60 s', 60], ['90 s', 90]], cfg.secs, (v) => { cfg.secs = v; re(); }));
      el.append(h('span', 'lbl', 'Turer hver')); el.append(seg([['1', 1], ['3', 3], ['5', 5]], cfg.turns, (v) => { cfg.turns = v; re(); }));
      el.append(h('span', 'lbl', 'Vanskelighet')); el.append(seg([['Ekstrem', 'x'], ['Vanskelig', 'h'], ['Lett', 'e'], ['Blandet', 'mix']], cfg.lv2 || 'x', (v) => { cfg.lv2 = v; re(); }));
      el.append(h('span', 'lbl', 'Kort')); const sel = cfg.cats && cfg.cats.length ? cfg.cats : Object.keys(KY_CATS);
      el.append(chipsMulti(Object.entries(KY_CATS).map(([k, v]) => [v, k]), sel, (v) => { const s = new Set(sel); s.has(v) ? s.delete(v) : s.add(v); if (!s.size) return; cfg.cats = s.size === Object.keys(KY_CATS).length ? [] : [...s]; re(); }));
      el.append(h('span', 'lbl', 'Slurker')); el.append(seg([['Med slurker', true], ['Uten', false]], !!cfg.sip, (v) => { cfg.sip = v; re(); }));
      el.append(h('p', 'fine', kyPool(cfg).length + ' kort i bunken.'));
    },
    init(S) { const st = { turn: 0, ph: 'ready', deck: shuffle(kyPool(S.cfg)), di: 0, t0: 0, got: [], skip: [], sc: {}, hint: 0, seen: false }; S.pl.forEach((p) => { st.sc[p.id] = 0; }); return st; },
    cur(S) { return S.pl[S.st.turn % S.pl.length]; },
    card(S) { const st = S.st; return KY_CARDS[st.deck[st.di % st.deck.length]]; },
    total(S) { return S.pl.length * (S.cfg.turns || 3); },
    act(S, a, by) {
      const st = S.st; if (S.on && !inGame(by)) return false;
      if (a.t === 'go' && st.ph === 'ready') { st.ph = 'play'; st.t0 = Date.now(); st.got = []; st.skip = []; st.hint = 0; return true; }
      if ((a.t === 'ok' || a.t === 'skip') && st.ph === 'play' && a.di === st.di) {
        if (S.on && a.t === 'ok' && KY.cur(S) && canBy(KY.cur(S).id, by) && S.pl.length > 1) return false; // de andre dømmer
        (a.t === 'ok' ? st.got : st.skip).push(st.deck[st.di % st.deck.length]); if (a.t === 'ok') st.sc[KY.cur(S).id]++;
        st.di++; st.hint = 0; return true;
      }
      if (a.t === 'hint' && st.ph === 'play' && st.hint < 2) { st.hint++; return true; }
      if (a.t === 'next' && st.ph === 'sum' && (by === S.host || !S.on || canBy(KY.cur(S).id, by))) { st.turn++; if (st.turn >= KY.total(S)) { st.end = {}; return true; } st.ph = 'ready'; return true; }
      return false;
    },
    tick(S) { const st = S.st; if (st.ph === 'play' && Date.now() - st.t0 >= S.cfg.secs * 1000) { st.ph = 'sum'; return true; } return false; },
    clock(S, body) {
      const st = S.st, t = body.querySelector('.ky-time'); if (!t || st.ph !== 'play') return;
      const left = Math.max(0, S.cfg.secs - (Date.now() - st.t0) / 1000); t.textContent = String(Math.ceil(left)); t.classList.toggle('low', left <= 10);
      const bar = body.querySelector('.ky-bar i'); if (bar) bar.style.width = (left / S.cfg.secs * 100) + '%';
      if (left <= 5 && Math.ceil(left) !== UI.kyB) { UI.kyB = Math.ceil(left); fx.tap(); }
    },
    patch() {},
    key(S) { const st = S.st; return [st.turn, st.ph, st.di, st.hint].join(':'); },
    hintTxt(c, n) { const words = c[1].split(/\s+/).length; const a = [KY_CATS[c[2]] + ' · ' + words + ' ord, ' + c[1].replace(/[^A-Za-zÆØÅæøåé]/g, '').length + ' bokstaver']; if (n >= 2) a.push('Begynner på «' + c[1].slice(0, 2) + '»'); return a; },
    view(S, c, w) {
      const st = S.st, P = KY.cur(S), mine = !S.on || (P && c.mine.includes(P.id)), judge = S.on && !mine && myPids().length;
      w.append(h('span', 'lbl', 'Tur ' + (st.turn + 1) + ' av ' + KY.total(S)));
      scoreboard(w, P && P.id, (p) => [String(st.sc[p.id]), '']);
      if (st.ph === 'ready') {
        const d = h('div', 'ky-ready'); d.append(h('span', 'lbl', 'Neste ut'), h('b', '', P.name), h('p', 'fine', S.on ? (mine ? 'Du leser. De andre ser løsningen og trykker riktig.' : P.name + ' leser. Du ser løsningen og trykker riktig når han knekker den.') : 'Les høyt, fort og om igjen. Trykk «Knekt!» når det sitter.'));
        w.append(d);
        if (mine || !S.on || c.host) w.append(btn('Start ' + S.cfg.secs + ' sekunder', 'go big', () => { fx.good(); dispatch({ t: 'go' }); })); else watchLine(w, 'Venter på at ' + P.name + ' starter');
        return;
      }
      if (st.ph === 'play') {
        const card = KY.card(S);
        const top = h('div', 'ky-top'); const tm = h('b', 'ky-time', String(S.cfg.secs)); const bar = h('div', 'ky-bar'); bar.append(h('i')); top.append(tm, bar); w.append(top);
        const k = h('div', 'ky-card' + (judge ? ' judge' : '')); k.append(h('span', 'ky-cat', judge ? KY_CATS[card[2]] : 'Kryptert'));
        k.append(h('b', 'ky-enc', card[0]));
        if (judge) k.append(h('div', 'ky-sol', card[1]));
        else if (st.hint) KY.hintTxt(card, st.hint).forEach((x) => k.append(h('p', 'ky-hint', x)));
        w.append(k);
        const row = h('div', 'ky-row'); const di = st.di;
        if (!S.on || judge || S.pl.length === 1) row.append(btn(judge ? 'Riktig!' : 'Knekt!', 'go', () => { fx.good(); dispatch({ t: 'ok', di }); }));
        row.append(btn('Hopp over', 'ghost', () => { fx.whoosh(); dispatch({ t: 'skip', di }); }));
        w.append(row);
        if (!judge && st.hint < 2) w.append(btn('Hint', 'sm ghost', () => { fx.tap(); dispatch({ t: 'hint' }); }));
        if (mine && S.on && S.pl.length > 1) watchLine(w, 'Si det høyt – de andre trykker riktig');
        if (st.got.length) { const l = h('div', 'ansl'); st.got.forEach((i) => l.append(h('span', 'done', KY_CARDS[i][1]))); w.append(l); }
        return;
      }
      // sum
      if (UI.kySum !== st.turn) { UI.kySum = st.turn; fx.reveal(); }
      const n = st.got.length, d = h('div', 'ky-ready');
      d.append(h('span', 'lbl', 'Tiden er ute'), h('b', '', P.name + ' knakk ' + n));
      if (S.cfg.sip) d.append(h('p', 'ky-sip', n ? P.name + ' deler ut ' + n + (n === 1 ? ' slurk' : ' slurker') + '.' : 'Ingen knekt. ' + P.name + ' tar en shot – eller en stor slurk.'));
      w.append(d);
      const l = h('div', 'ky-list'); st.got.forEach((i) => { const r = h('div', 'ok'); r.append(h('span', '', KY_CARDS[i][0]), h('b', '', KY_CARDS[i][1])); l.append(r); }); st.skip.forEach((i) => { const r = h('div', 'no'); r.append(h('span', '', KY_CARDS[i][0]), h('b', '', KY_CARDS[i][1])); l.append(r); }); w.append(l);
      if (!S.on || c.host || mine) w.append(btn(st.turn + 1 >= KY.total(S) ? 'Se resultatet' : 'Neste spiller', 'go big', () => dispatch({ t: 'next' }))); else watchLine(w, 'Venter på neste tur');
    },
    rank(S) { const st = S.st; return S.pl.map((p) => ({ id: p.id, name: p.name, col: p.col, val: st.sc[p.id] + ' knekt', n: st.sc[p.id] })).sort((a, b) => b.n - a.n); }
  };

  // ============ ARKADE: SLANGE, FLAPPY-FLY, MINESVEIPER ============
  // Felles ramme for enspillerspill som kjører i egen løkke og melder poeng når det er slutt.
  function arcSolo(id, o) {
    return Object.assign({
      teams: false, multi: false, noOnline: true, minP: 1, finish: false,
      solo: 'Et enspillerspill. Jakt rekord og medaljer.',
      defaults: () => ({}), options() {},
      init() { return { score: null, n: 0 }; },
      act(S, a) {
        const st = S.st;
        if (a.t === 'done' && st.score == null) {
          st.score = Math.max(0, a.score | 0); st.n = a.n | 0; st.win = !!a.win; st.time = a.time || 0;
          const b = mem.arcBest || {}; const k = id + (S.cfg.lvl ? ':' + S.cfg.lvl : '');
          if (o.lowBest) { if (st.win && (!b[k] || st.time < b[k])) { b[k] = st.time; memSet('arcBest', b); st.rec = true; } }
          else if (st.score > (b[k] || 0)) { b[k] = st.score; memSet('arcBest', b); st.rec = true; }
          st.end = { win: o.lowBest ? st.win : undefined }; return true;
        }
        return false;
      },
      key(S) { return 'arc:' + (S.st.score == null ? 'p' : 'd'); },
      patch() {},
      rank(S) { const st = S.st; return S.pl.map((p) => ({ id: p.id, name: p.name, col: p.col, val: o.lowBest ? (st.win ? fmtSec(st.time) : 'Ikke klart') : (st.score || 0) + ' ' + (o.unit || 'poeng'), n: st.score || 0 })); },
      endView(S, w) {
        const st = S.st, tr = h('div', 'trophy'); tr.innerHTML = TROPHY;
        const b = (mem.arcBest || {})[id + (S.cfg.lvl ? ':' + S.cfg.lvl : '')];
        if (o.lowBest) { tr.append(h('span', 'lbl', st.win ? 'Klarte det!' : 'Boom'), h('b', '', st.win ? fmtSec(st.time) : 'Mine')); if (b) tr.append(h('p', 'fine', 'Beste tid: ' + fmtSec(b))); }
        else { tr.append(h('span', 'lbl', o.name), h('b', '', (st.score || 0) + ' ' + (o.unit || 'poeng'))); if (b) tr.append(h('p', 'fine', 'Rekorden din: ' + b)); }
        if (st.rec) tr.append(h('span', 'newrec', 'Ny personlig rekord!')); else if (UI.newRec) tr.append(h('span', 'newrec', 'Ny rekord: ' + UI.newRec));
        w.append(tr);
      }
    }, o);
  }
  const fmtSec = (s) => { s = Math.round(s); return s >= 60 ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : s + ' s'; };
  // Lerret som følger pikseltettheten
  function arcCanvas(wrap, ratio) {
    const cv = h('canvas', 'arc-cv'); wrap.append(cv); const ctx = cv.getContext('2d');
    const fit = () => { const W = Math.min(wrap.clientWidth || 340, 520), H2 = Math.round(W * ratio), d = Math.min(2.5, window.devicePixelRatio || 1); cv.width = Math.round(W * d); cv.height = Math.round(H2 * d); cv.style.width = W + 'px'; cv.style.height = H2 + 'px'; ctx.setTransform(d, 0, 0, d, 0, 0); return { W, H: H2 }; };
    return { cv, ctx, fit };
  }
  function arcOver(w, title, sub, label, fn) {
    const o = h('div', 'arc-ov'); o.append(h('b', '', title)); if (sub) o.append(h('span', '', sub)); if (label) o.append(btn(label, 'go big', fn)); w.append(o); return o;
  }

  // ---------- Slange ----------
  const SN = arcSolo('sn', {
    name: 'Slange', kicker: 'Klassiker', glow: '#0e3a1a', unit: 'epler',
    rules: 'Styr slangen med sveip på brettet eller pilene under. Spis eplene for å vokse – det går fortere jo lengre du blir. Gulleplet gir fem, men forsvinner fort. Treffer du veggen eller deg selv, er det slutt.',
    view(S, c, w) {
      if (S.st.score != null) return;
      w.classList.add('arc-room');
      const top = h('div', 'arc-top'); const sc = h('b', '', '0'); const best = (mem.arcBest || {}).sn || 0; top.append(h('span', '', 'Epler'), sc, h('span', 'arc-best', best ? 'Rekord ' + best : '')); w.append(top);
      const box = h('div', 'arc-box sn-box'); w.append(box); const { cv, ctx, fit } = arcCanvas(box, 1);
      const pad = h('div', 'arc-pad'); [['↑', 0, -1], ['←', -1, 0], ['↓', 0, 1], ['→', 1, 0]].forEach(([t, dx, dy]) => { const b = h('button', 'k' + t.charCodeAt(0), t); b.type = 'button'; b.addEventListener('pointerdown', (e) => { e.preventDefault(); turn(dx, dy); }); pad.append(b); }); w.append(pad);
      const N = 15; let dim = fit(); let W = dim.W, cell = W / N;
      let snake, prev, dir, queue, apple, gold, goldT, score, alive = false, started = false, dead = false, last = 0, acc = 0, grow = 0, tAll = 0, shake = 0, deadT = 0;
      let parts = [], pops = [], bgc = null;
      const free = () => { for (let t = 0; t < 400; t++) { const p = [rnd(N), rnd(N)]; if (!snake.some((s) => s[0] === p[0] && s[1] === p[1]) && !(apple && apple[0] === p[0] && apple[1] === p[1]) && !(gold && gold[0] === p[0] && gold[1] === p[1])) return p; } return [0, 0]; };
      function reset() { snake = [[7, 7], [6, 7], [5, 7], [4, 7]]; prev = snake.map((s) => s.slice()); dir = [1, 0]; queue = []; score = 0; grow = 0; apple = null; gold = null; apple = free(); goldT = 0; sc.textContent = '0'; parts = []; pops = []; }
      function turn(dx, dy) {
        if (dead) return; if (!started) start();
        const lastD = queue.length ? queue[queue.length - 1] : dir;
        if ((dx === -lastD[0] && dy === -lastD[1]) || (dx === lastD[0] && dy === lastD[1])) return;
        if (queue.length < 2) queue.push([dx, dy]); fx.tap();
      }
      const speed = () => Math.max(62, 165 - snake.length * 3.2);
      function burst(p, col, n2) { for (let i = 0; i < n2; i++) { const a = Math.random() * Math.PI * 2, v = (Math.random() * 2.5 + 1.2) * cell; parts.push({ x: (p[0] + .5) * cell, y: (p[1] + .5) * cell, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, col, r: cell * (.06 + Math.random() * .08) }); } }
      function step() {
        if (queue.length) dir = queue.shift();
        const hd = [snake[0][0] + dir[0], snake[0][1] + dir[1]];
        if (hd[0] < 0 || hd[1] < 0 || hd[0] >= N || hd[1] >= N || snake.some((s, i) => i < snake.length - (grow ? 0 : 1) && s[0] === hd[0] && s[1] === hd[1])) { die(); return; }
        prev = snake.map((s) => s.slice());
        snake.unshift(hd);
        if (hd[0] === apple[0] && hd[1] === apple[1]) { score++; grow += 1; burst(apple, '#ff5a5a', 14); pops.push({ x: (apple[0] + .5) * cell, y: apple[1] * cell, t: '+1', life: 1, col: '#fff' }); apple = free(); fx.sel(); if (!gold && Math.random() < .2) { gold = free(); goldT = 50; } }
        else if (gold && hd[0] === gold[0] && hd[1] === gold[1]) { score += 5; grow += 3; burst(gold, '#ffd84d', 26); pops.push({ x: (gold[0] + .5) * cell, y: gold[1] * cell, t: '+5', life: 1, col: '#ffd84d' }); gold = null; fx.good(); }
        if (grow > 0) { grow--; prev.push(prev[prev.length - 1].slice()); } else snake.pop();
        while (prev.length < snake.length) prev.push(prev[prev.length - 1].slice());
        if (gold && --goldT <= 0) { burst(gold, '#ffd84d', 8); gold = null; }
        sc.textContent = String(score);
      }
      function bg() {
        bgc = document.createElement('canvas'); const d = cv.width / W; bgc.width = cv.width; bgc.height = cv.height; const b = bgc.getContext('2d'); b.setTransform(d, 0, 0, d, 0, 0);
        const g = b.createRadialGradient(W / 2, W / 2, W * .1, W / 2, W / 2, W * .75); g.addColorStop(0, '#12361f'); g.addColorStop(1, '#06170d'); b.fillStyle = g; b.fillRect(0, 0, W, W);
        for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) { b.fillStyle = (x + y) % 2 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.06)'; b.fillRect(x * cell, y * cell, cell, cell); }
        for (let i = 0; i < 70; i++) { b.fillStyle = 'rgba(120,255,170,' + (Math.random() * .07) + ')'; const x = Math.random() * W, y = Math.random() * W; b.beginPath(); b.ellipse(x, y, cell * .05, cell * .14, Math.random() * 3, 0, Math.PI * 2); b.fill(); }
        const v = b.createRadialGradient(W / 2, W / 2, W * .45, W / 2, W / 2, W * .75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.45)'); b.fillStyle = v; b.fillRect(0, 0, W, W);
        b.strokeStyle = 'rgba(43,255,136,.35)'; b.lineWidth = 2; b.strokeRect(1, 1, W - 2, W - 2);
      }
      function appleDraw(p, gold2) {
        const bob = Math.sin(tAll * 4 + p[0]) * cell * .04, x = (p[0] + .5) * cell, y = (p[1] + .52) * cell + bob, r = cell * (gold2 ? .36 : .33) * (1 + Math.sin(tAll * 6) * .03);
        ctx.save(); ctx.shadowColor = gold2 ? 'rgba(255,216,77,.9)' : 'rgba(255,70,70,.7)'; ctx.shadowBlur = cell * .6;
        const g = ctx.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r); g.addColorStop(0, gold2 ? '#fff6c2' : '#ff9a8a'); g.addColorStop(.45, gold2 ? '#ffd84d' : '#ff3b3b'); g.addColorStop(1, gold2 ? '#b8860b' : '#9e1010');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x - r * .18, y, r, 0, Math.PI * 2); ctx.arc(x + r * .18, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = cell * .06; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y - r * .8); ctx.quadraticCurveTo(x + r * .1, y - r * 1.2, x + r * .2, y - r * 1.35); ctx.stroke();
        ctx.fillStyle = '#3ddc6a'; ctx.beginPath(); ctx.ellipse(x + r * .45, y - r * 1.05, r * .38, r * .16, -.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(x - r * .45, y - r * .35, r * .18, r * .1, -.7, 0, Math.PI * 2); ctx.fill();
        if (gold2) { ctx.save(); ctx.translate(x, y); ctx.rotate(tAll * 2); ctx.strokeStyle = 'rgba(255,240,180,' + (.5 + .5 * Math.sin(tAll * 8)) + ')'; ctx.lineWidth = 1.5; for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(r * 1.25, 0); ctx.lineTo(r * 1.6, 0); ctx.stroke(); } ctx.restore();
          ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect((p[0]) * cell + 2, (p[1] + 1) * cell - 4, (cell - 4) * Math.max(0, goldT / 50), 2); }
      }
      function pts(f) { return snake.map((s, i) => { const p = prev[i] || prev[prev.length - 1]; return [((p[0] + (s[0] - p[0]) * f) + .5) * cell, ((p[1] + (s[1] - p[1]) * f) + .5) * cell]; }); }
      function snakeDraw(f) {
        const P = pts(f), n2 = P.length, wd = cell * .78;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // skygge
        ctx.save(); ctx.translate(cell * .08, cell * .12); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = wd; ctx.beginPath(); P.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); ctx.restore();
        // kant
        ctx.strokeStyle = dead ? '#3a3a3a' : '#0a4a22'; ctx.lineWidth = wd + cell * .1; ctx.beginPath(); P.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
        // kropp, segment for segment med fargeskifte og smalere hale
        for (let i = n2 - 1; i > 0; i--) { const t = i / (n2 - 1), a = P[i], b = P[i - 1]; ctx.strokeStyle = dead ? `hsl(0,0%,${45 - t * 15}%)` : `hsl(${145 - t * 35}, 85%, ${55 - t * 18}%)`; ctx.lineWidth = wd * (1 - t * .35); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
        // mønster
        for (let i = 1; i < n2; i += 1) { const t = i / (n2 - 1), p = P[i]; ctx.fillStyle = dead ? 'rgba(255,255,255,.08)' : `rgba(10,60,30,${.35 - t * .15})`; ctx.beginPath(); ctx.ellipse(p[0], p[1], wd * .18 * (1 - t * .3), wd * .18 * (1 - t * .3), 0, 0, Math.PI * 2); ctx.fill(); }
        // glans langs ryggen
        ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = wd * .18; ctx.beginPath(); P.slice(0, Math.max(2, n2 - 1)).forEach((p, i) => (i ? ctx.lineTo(p[0] - wd * .15, p[1] - wd * .15) : ctx.moveTo(p[0] - wd * .15, p[1] - wd * .15))); ctx.stroke();
        // hode
        const hd = P[0], dx = queue.length && !dead ? dir[0] : dir[0], dy = dir[1];
        ctx.save(); ctx.translate(hd[0], hd[1]); ctx.rotate(Math.atan2(dy, dx));
        const hg = ctx.createRadialGradient(-wd * .1, -wd * .2, wd * .1, 0, 0, wd * .7); hg.addColorStop(0, dead ? '#888' : '#8dffb8'); hg.addColorStop(1, dead ? '#444' : '#18a24a');
        ctx.fillStyle = dead ? '#333' : '#0a4a22'; ctx.beginPath(); ctx.ellipse(wd * .08, 0, wd * .62, wd * .56, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(wd * .08, 0, wd * .56, wd * .5, 0, 0, Math.PI * 2); ctx.fill();
        if (!dead && Math.sin(tAll * 5) > .6) { ctx.strokeStyle = '#ff3b6b'; ctx.lineWidth = cell * .06; ctx.beginPath(); ctx.moveTo(wd * .6, 0); ctx.lineTo(wd * .95, 0); ctx.lineTo(wd * 1.08, -wd * .1); ctx.moveTo(wd * .95, 0); ctx.lineTo(wd * 1.08, wd * .1); ctx.stroke(); }
        const blink = (tAll % 3.2) < .12;
        [-1, 1].forEach((sg) => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(wd * .22, sg * wd * .24, wd * .17, blink ? wd * .03 : wd * .15, 0, 0, Math.PI * 2); ctx.fill(); if (!blink) { ctx.fillStyle = dead ? '#000' : '#04110c'; if (dead) { ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(wd * .14, sg * wd * .24 - 4); ctx.lineTo(wd * .3, sg * wd * .24 + 4); ctx.moveTo(wd * .3, sg * wd * .24 - 4); ctx.lineTo(wd * .14, sg * wd * .24 + 4); ctx.stroke(); } else { ctx.beginPath(); ctx.arc(wd * .27, sg * wd * .24, wd * .075, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(wd * .3, sg * wd * .24 - wd * .04, wd * .025, 0, Math.PI * 2); ctx.fill(); } } });
        ctx.restore();
      }
      function draw(f) {
        ctx.save(); if (shake > 0) { ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake); }
        if (bgc) ctx.drawImage(bgc, 0, 0, W, W); else { ctx.fillStyle = '#071a10'; ctx.fillRect(0, 0, W, W); }
        appleDraw(apple, false); if (gold && (goldT > 12 || Math.floor(tAll * 8) % 2)) appleDraw(gold, true);
        snakeDraw(f);
        parts.forEach((p) => { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }); ctx.globalAlpha = 1;
        pops.forEach((p) => { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.col; ctx.font = '700 ' + Math.round(cell * .6) + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(p.t, p.x, p.y - (1 - p.life) * cell * 1.2); }); ctx.globalAlpha = 1;
        if (dead) { ctx.fillStyle = `rgba(255,40,40,${Math.max(0, .35 - deadT * .5)})`; ctx.fillRect(0, 0, W, W); }
        ctx.restore();
      }
      function loop(t) {
        if (!cv.isConnected) return;
        const dms = Math.min(60, t - last || 0), dt = dms / 1000; last = t; tAll += dt;
        if (alive) { acc += dms; let k = 0; while (acc >= speed() && alive && k++ < 3) { acc -= speed(); step(); } }
        if (dead) deadT += dt;
        parts.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .92; p.vy *= .92; p.life -= dt * 1.6; }); parts = parts.filter((p) => p.life > 0);
        pops.forEach((p) => { p.life -= dt * 1.4; }); pops = pops.filter((p) => p.life > 0);
        if (shake > 0) shake = Math.max(0, shake - dt * 40);
        draw(alive ? Math.min(1, acc / speed()) : 1);
        requestAnimationFrame(loop);
      }
      let ov = null;
      function start() { if (started) return; started = true; alive = true; if (ov) { ov.remove(); ov = null; } acc = 0; }
      function die() { alive = false; dead = true; shake = 14; fx.bad(); setTimeout(() => { if (!cv.isConnected) return; arcOver(box, score + (score === 1 ? ' eple' : ' epler'), score > best && best ? 'Ny rekord!' : 'Slangen krasjet', 'Se resultatet', () => dispatch({ t: 'done', score, n: score })); }, 900); }
      reset();
      let sx = 0, sy = 0, swiped = false;
      cv.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; swiped = false; if (!started && !dead) start(); });
      cv.addEventListener('pointermove', (e) => { if (swiped || !e.buttons && e.pointerType === 'mouse') return; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return; swiped = true; if (Math.abs(dx) > Math.abs(dy)) turn(Math.sign(dx), 0); else turn(0, Math.sign(dy)); });
      box.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
      const key = (e) => { if (!cv.isConnected) { removeEventListener('keydown', key); return; } const m = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key]; if (m) { e.preventDefault(); turn(m[0], m[1]); } }; addEventListener('keydown', key);
      requestAnimationFrame(() => { dim = fit(); W = dim.W; cell = W / N; bg(); ov = arcOver(box, 'Klar?', 'Sveip eller trykk en pil for å starte', null); last = performance.now(); requestAnimationFrame(loop); });
    }
  });

  // ---------- Flappy-fly ----------
  const FF = arcSolo('ff', {
    name: 'Flappy-fly', kicker: 'Ett trykk', glow: '#0e2240', unit: 'fjell',
    rules: 'Trykk hvor som helst for å gi flyet fart oppover. Fly mellom fjelltoppene og skyene. Hvert fjell du passerer gir et poeng, og åpningene blir trangere etter hvert.',
    view(S, c, w) {
      if (S.st.score != null) return;
      w.classList.add('arc-room');
      const top = h('div', 'arc-top'); const sc = h('b', '', '0'); const best = (mem.arcBest || {}).ff || 0; top.append(h('span', '', 'Fjell'), sc, h('span', 'arc-best', best ? 'Rekord ' + best : '')); w.append(top);
      const box = h('div', 'arc-box'); w.append(box); const { cv, ctx, fit } = arcCanvas(box, 1.35);
      let dim = fit(), W = dim.W, H = dim.H;
      let y, vy, pipes, score, alive = false, started = false, dead = false, last = 0, raf = 0, tAll = 0, stars = [];
      const G = () => H * 2.4, JUMP = () => -H * .7, SPD = () => W * (.52 + Math.min(.4, score * .012)), GAP = () => H * Math.max(.19, .28 - score * .004);
      function reset() { y = H * .45; vy = 0; pipes = []; score = 0; sc.textContent = '0'; stars = Array.from({ length: 40 }, () => [Math.random() * W, Math.random() * H * .6, Math.random() * 1.4 + .3]); }
      function addPipe(x) { const g = GAP(), cy = H * .2 + Math.random() * (H * .6 - g) + g / 2; pipes.push({ x, cy, cy0: cy, g, done: false, seed: Math.random(), mv: score >= 6 ? H * Math.min(.12, .03 + score * .004) : 0 }); }
      function flap() { if (dead) return; if (!started) { started = true; alive = true; if (ov) { ov.remove(); ov = null; } addPipe(W * 1.1); last = performance.now(); } vy = JUMP(); fx.tap(); }
      function plane(px, py, ang) {
        ctx.save(); ctx.translate(px, py); ctx.rotate(ang); const s = W / 340;
        ctx.fillStyle = '#e8edef'; ctx.beginPath(); ctx.ellipse(0, 0, 22 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff5b24'; ctx.beginPath(); ctx.moveTo(-4 * s, 0); ctx.lineTo(6 * s, 0); ctx.lineTo(-6 * s, 16 * s); ctx.lineTo(-12 * s, 16 * s); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-14 * s, -2 * s); ctx.lineTo(-20 * s, -14 * s); ctx.lineTo(-24 * s, -14 * s); ctx.lineTo(-21 * s, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#4df3ff'; ctx.fillRect(4 * s, -3.5 * s, 10 * s, 3 * s); ctx.restore();
      }
      function peak(x, w2, ytop, flip) {
        ctx.save(); if (flip) { ctx.translate(0, H); ctx.scale(1, -1); ytop = H - ytop; }
        ctx.fillStyle = flip ? '#cfd8e8' : '#1d3b4a'; ctx.beginPath(); ctx.moveTo(x - w2 * .15, H); ctx.lineTo(x + w2 * .35, ytop); ctx.lineTo(x + w2 * .5, ytop + 4); ctx.lineTo(x + w2 * .65, ytop); ctx.lineTo(x + w2 * 1.15, H); ctx.closePath(); ctx.fill();
        if (!flip) { ctx.fillStyle = '#e8f2f6'; ctx.beginPath(); ctx.moveTo(x + w2 * .2, ytop + (H - ytop) * .14); ctx.lineTo(x + w2 * .35, ytop); ctx.lineTo(x + w2 * .65, ytop); ctx.lineTo(x + w2 * .8, ytop + (H - ytop) * .14); ctx.closePath(); ctx.fill(); }
        ctx.restore();
      }
      function draw() {
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#071022'); g.addColorStop(1, '#16314a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        stars.forEach((s) => { ctx.fillStyle = 'rgba(255,255,255,' + (.35 + .3 * Math.sin(tAll * 2 + s[0])) + ')'; ctx.fillRect(s[0], s[1], s[2], s[2]); });
        ctx.globalAlpha = .18; ctx.fillStyle = '#2bff88'; ctx.beginPath(); ctx.moveTo(0, H * .22); for (let x = 0; x <= W; x += 10) ctx.lineTo(x, H * .22 + Math.sin(x / 40 + tAll * .8) * 14); ctx.lineTo(W, H * .32); for (let x = W; x >= 0; x -= 10) ctx.lineTo(x, H * .32 + Math.sin(x / 50 + tAll) * 10); ctx.fill(); ctx.globalAlpha = 1;
        const pw = W * .22;
        pipes.forEach((p) => { peak(p.x, pw, p.cy + p.g / 2, false); peak(p.x, pw, p.cy - p.g / 2, true); });
        ctx.fillStyle = '#0b1a21'; ctx.fillRect(0, H - 6, W, 6);
        plane(W * .28, y, Math.max(-.5, Math.min(.9, vy / (H * 1.2))));
      }
      function surf(p, px, ytop) { const pw = W * .22, x0 = p.x - pw * .15, x1 = p.x + pw * .35, x2 = p.x + pw * .65, x3 = p.x + pw * 1.15; if (px <= x0 || px >= x3) return H * 2; if (px >= x1 && px <= x2) return ytop; return px < x1 ? H - (H - ytop) * (px - x0) / (x1 - x0) : H - (H - ytop) * (x3 - px) / (x3 - x2); }
      function hit(p) { const px = W * .28, r = W * .04; const bot = surf(p, px, p.cy + p.g / 2); const topd = H - surf(p, px, H - (p.cy - p.g / 2)); return y + r > bot || y - r < topd; }
      function loop(t) {
        if (!cv.isConnected) return;
        const dt = Math.min(.04, (t - last) / 1000 || 0); last = t; tAll += dt;
        if (alive) {
          vy += G() * dt; y += vy * dt;
          pipes.forEach((p) => { p.x -= SPD() * dt; if (p.mv) p.cy = Math.max(H * .12 + p.g / 2, Math.min(H * .88 - p.g / 2, p.cy0 + Math.sin(tAll * 1.8 + p.seed * 6) * p.mv)); if (!p.done && p.x + W * .22 < W * .28) { p.done = true; score++; sc.textContent = String(score); fx.sel(); } });
          if (pipes.length && pipes[pipes.length - 1].x < W * (score >= 10 ? .56 : .5)) addPipe(W * 1.05);
          pipes = pipes.filter((p) => p.x > -W * .3);
          if (y > H - 10 || y < 0 || pipes.some(hit)) die();
        } else if (!started) { y = H * .45 + Math.sin(tAll * 3) * 8; }
        draw(); raf = requestAnimationFrame(loop);
      }
      let ov = null;
      function die() { alive = false; dead = true; fx.bad(); setTimeout(() => { if (!cv.isConnected) return; arcOver(box, score + (score === 1 ? ' fjell' : ' fjell'), score > best && best ? 'Ny rekord!' : 'Flyet traff', 'Se resultatet', () => dispatch({ t: 'done', score, n: score })); }, 500); }
      reset(); ov = arcOver(box, 'Klar for take-off?', 'Trykk for å fly', null);
      box.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; e.preventDefault(); flap(); });
      const key = (e) => { if (!cv.isConnected) { removeEventListener('keydown', key); return; } if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); flap(); } }; addEventListener('keydown', key);
      requestAnimationFrame(() => { dim = fit(); W = dim.W; H = dim.H; reset(); last = performance.now(); raf = requestAnimationFrame(loop); });
    }
  });

  // ---------- Minesveiper ----------
  const MS_LV = { lett: { c: 8, r: 10, m: 10, n: 'Lett' }, mid: { c: 10, r: 14, m: 24, n: 'Middels' }, hard: { c: 12, r: 18, m: 45, n: 'Vanskelig' } };
  const MS = arcSolo('ms', {
    name: 'Minesveiper', kicker: 'Finn minene', glow: '#1a2a3a', lowBest: true,
    rules: 'Trykk for å åpne en rute. Tallet viser hvor mange miner som ligger rundt. Hold inne, eller slå på flagg-modus, for å sette flagg. Trykk på et tall som har riktig antall flagg rundt seg, så åpnes resten. Første trykk er alltid trygt.',
    defaults: () => ({ lvl: 'lett' }),
    options(cfg, el, re) {
      el.append(h('span', 'lbl', 'Nivå')); el.append(seg(Object.entries(MS_LV).map(([k, v]) => [v.n, k]), cfg.lvl, (v) => { cfg.lvl = v; re(); }));
      const L2 = MS_LV[cfg.lvl]; const b = (mem.arcBest || {})['ms:' + cfg.lvl]; el.append(h('p', 'fine', L2.c + ' × ' + L2.r + ' ruter, ' + L2.m + ' miner.' + (b ? ' Beste tid: ' + fmtSec(b) + '.' : '')));
    },
    view(S, c, w) {
      if (S.st.score != null) return;
      const L2 = MS_LV[S.cfg.lvl] || MS_LV.lett, C2 = L2.c, R2 = L2.r, M = L2.m;
      w.classList.add('arc-room');
      const top = h('div', 'arc-top ms-top'); const mc = h('b', '', '💣 ' + M); const tm = h('b', 'ms-t', '0'); const fb = h('button', 'ms-flag', '🚩 Flagg: av'); fb.type = 'button'; top.append(mc, tm, fb); w.append(top);
      const grid = h('div', 'ms-grid'); grid.style.gridTemplateColumns = 'repeat(' + C2 + ', 1fr)'; w.append(grid);
      let mines = null, open = new Set(), flags = new Set(), over = false, t0 = 0, tick = 0, flagMode = false;
      const idx = (x, y) => y * C2 + x, nb = (i) => { const x = i % C2, y = (i / C2) | 0, o = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < C2 && Y < R2) o.push(idx(X, Y)); } return o; };
      const cnt = (i) => nb(i).filter((j) => mines.has(j)).length;
      const cells = [];
      for (let i = 0; i < C2 * R2; i++) { const b = h('button', 'mc'); b.type = 'button'; cells.push(b); grid.append(b);
        let lp = 0, longed = false;
        b.addEventListener('pointerdown', () => { longed = false; clearTimeout(lp); lp = setTimeout(() => { longed = true; toggleFlag(i); try { navigator.vibrate && navigator.vibrate(25); } catch (e) {} }, 380); });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, () => clearTimeout(lp)));
        b.addEventListener('click', (e) => { e.preventDefault(); if (longed) return; if (flagMode) toggleFlag(i); else reveal(i); });
        b.addEventListener('contextmenu', (e) => { e.preventDefault(); });
      }
      fb.onclick = () => { flagMode = !flagMode; fb.textContent = '🚩 Flagg: ' + (flagMode ? 'på' : 'av'); fb.classList.toggle('on', flagMode); fx.tap(); };
      function place(safe) { mines = new Set(); const no = new Set([safe].concat(nb(safe))); while (mines.size < M) { const j = rnd(C2 * R2); if (!no.has(j)) mines.add(j); } t0 = performance.now(); tick = setInterval(() => { if (!grid.isConnected) { clearInterval(tick); return; } if (!over) tm.textContent = String(Math.floor((performance.now() - t0) / 1000)); }, 250); }
      function toggleFlag(i) { if (over || open.has(i)) return; if (flags.has(i)) flags.delete(i); else flags.add(i); paint(i); mc.textContent = '💣 ' + (M - flags.size); fx.tap(); }
      function reveal(i) {
        if (over || flags.has(i)) return;
        if (!mines) place(i);
        if (open.has(i)) { const n2 = cnt(i); const f = nb(i).filter((j) => flags.has(j)).length; if (n2 && f === n2) nb(i).forEach((j) => { if (!open.has(j) && !flags.has(j)) reveal(j); }); return; }
        if (mines.has(i)) { boom(i); return; }
        const q = [i]; while (q.length) { const k = q.pop(); if (open.has(k) || flags.has(k)) continue; open.add(k); paint(k); if (!cnt(k)) nb(k).forEach((j) => { if (!open.has(j) && !mines.has(j)) q.push(j); }); }
        fx.tap();
        if (open.size === C2 * R2 - M) win();
      }
      function paint(i) { const b = cells[i]; b.className = 'mc'; b.textContent = ''; if (open.has(i)) { b.classList.add('o'); const n2 = cnt(i); if (n2) { b.textContent = String(n2); b.classList.add('n' + n2); } } else if (flags.has(i)) { b.classList.add('f'); b.textContent = '🚩'; } }
      function boom(i) { over = true; clearInterval(tick); fx.bad(); mines.forEach((j) => { const b = cells[j]; b.classList.add('m'); b.textContent = '💣'; }); cells[i].classList.add('hit'); flags.forEach((j) => { if (!mines.has(j)) cells[j].classList.add('wrong'); });
        const t = (performance.now() - t0) / 1000; setTimeout(() => { if (!grid.isConnected) return; const o = arcOver(w, 'Boom!', 'Du åpnet ' + open.size + ' av ' + (C2 * R2 - M) + ' ruter', 'Se resultatet', () => dispatch({ t: 'done', score: 0, n: open.size, win: false, time: t })); o.classList.add('ms-ov'); }, 700); }
      function win() { over = true; clearInterval(tick); const t = (performance.now() - t0) / 1000; fx.win(); mines.forEach((j) => { if (!flags.has(j)) { flags.add(j); paint(j); } });
        setTimeout(() => { if (!grid.isConnected) return; const o = arcOver(w, fmtSec(t), 'Alle minene funnet', 'Se resultatet', () => dispatch({ t: 'done', score: Math.max(1, Math.round(({ lett: 1, mid: 3, hard: 8 }[S.cfg.lvl] || 1) * 100000 / Math.max(1, t))), n: open.size, win: true, time: t })); o.classList.add('ms-ov'); }, 500); }
    }
  });

  // ---------- Stableren (isometrisk, som moderne stablespill) ----------
  const ST = arcSolo('st', {
    name: 'Stableren', kicker: 'Perfekt timing', glow: '#2a1a3a', unit: 'etasjer',
    rules: 'Blokken glir inn fra siden, annenhver gang fra venstre og høyre. Trykk for å slippe den på tårnet. Det som stikker utenfor, faller av, og blokken blir mindre. Treffer du perfekt, beholder du størrelsen – tre perfekte på rad gjør den større igjen.',
    view(S, c, w) {
      if (S.st.score != null) return;
      w.classList.add('arc-room');
      const top = h('div', 'arc-top'); const sc = h('b', '', '0'); const best = (mem.arcBest || {}).st || 0; top.append(h('span', '', 'Etasjer'), sc, h('span', 'arc-best', best ? 'Rekord ' + best : '')); w.append(top);
      const box = h('div', 'arc-box st-box'); w.append(box); const { cv, ctx, fit } = arcCanvas(box, 1.45);
      let dim = fit(), W = dim.W, H = dim.H, U, BH = .16, CX, CY;
      let blocks, cur, ax, t0, score, streak, alive = false, started = false, dead = false, last = 0, tAll = 0, cam = 0, camT = 0, falls = [], ripples = [], sparks = [], hue0 = rnd(360), msg = null;
      const hueAt = (i) => (hue0 + i * 9) % 360;
      const P = (x, y, z) => [CX + (x - z) * U * .866, CY + (x + z) * U * .5 - (y - cam) * U];
      function reset() { blocks = [{ x: -.5, z: -.5, w: 1, d: 1, y: 0, hue: hueAt(0) }]; for (let i = 1; i < 4; i++) blocks.unshift({ x: -.5, z: -.5, w: 1, d: 1, y: -i * BH, hue: hueAt(-i) }); score = 0; streak = 0; cam = 0; camT = 0; falls = []; ripples = []; sparks = []; spawn(); sc.textContent = '0'; }
      function topB() { return blocks[blocks.length - 1]; }
      function spawn() { const T = topB(); ax = score % 2 ? 'z' : 'x'; cur = { x: T.x, z: T.z, w: T.w, d: T.d, y: T.y + BH, hue: hueAt(score + 1) }; t0 = tAll; }
      const spd = () => 1.6 + Math.min(1.6, score * .05);
      function curPos() { const T = topB(), a = Math.sin((tAll - t0) * spd() - Math.PI / 2) * 1.35; if (ax === 'x') cur.x = T.x + a; else cur.z = T.z + a; }
      function drop() {
        if (dead) return; if (!started) { started = true; alive = true; if (ov) { ov.remove(); ov = null; } t0 = tAll; return; }
        const T = topB(), k = ax === 'x' ? 'x' : 'z', L = ax === 'x' ? 'w' : 'd';
        const lo = Math.max(cur[k], T[k]), hi = Math.min(cur[k] + cur[L], T[k] + T[L]), ov2 = hi - lo;
        if (ov2 <= 0) { falls.push(Object.assign({}, cur, { vy: 0, rot: 0, vr: (Math.random() - .5) * 3 })); die(); return; }
        if (Math.abs(cur[k] - T[k]) < .035) {
          cur[k] = T[k]; streak++; fx.good(); ripples.push({ b: Object.assign({}, cur), t: 0 }); msg = { t: streak >= 3 ? 'Perfekt ×' + streak : 'Perfekt!', life: 1 };
          if (streak >= 3) { const g = Math.min(1 - cur.w, .06), g2 = Math.min(1 - cur.d, .06); cur.x -= g / 2; cur.w += g; cur.z -= g2 / 2; cur.d += g2; }
          for (let i = 0; i < 18; i++) sparks.push({ x: cur.x + Math.random() * cur.w, z: cur.z + Math.random() * cur.d, y: cur.y + BH, vy: Math.random() * 1.5 + .5, life: 1 });
        } else {
          streak = 0; fx.tap();
          const cut = Object.assign({}, cur, { vy: 0, rot: 0, vr: (cur[k] < T[k] ? -1 : 1) * (1 + Math.random()) });
          if (cur[k] < T[k]) { cut[L] = T[k] - cur[k]; } else { cut[k] = hi; cut[L] = cur[k] + cur[L] - hi; }
          falls.push(cut); cur[k] = lo; cur[L] = ov2;
        }
        blocks.push(Object.assign({}, cur)); score++; sc.textContent = String(score); camT = Math.max(0, score - 4) * BH; spawn();
      }
      function shade(hue, l) { return `hsl(${hue}, 70%, ${l}%)`; }
      function boxDraw(b, alpha, glow) {
        const x0 = b.x, x1 = b.x + b.w, z0 = b.z, z1 = b.z + b.d, y0 = b.y, y1 = b.y + BH;
        const q = (pts, col) => { ctx.fillStyle = col; ctx.beginPath(); pts.forEach((p, i) => { const s = P(p[0], p[1], p[2]); if (i) ctx.lineTo(s[0], s[1]); else ctx.moveTo(s[0], s[1]); }); ctx.closePath(); ctx.fill(); };
        ctx.globalAlpha = alpha == null ? 1 : alpha;
        q([[x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [x1, y0, z0]], shade(b.hue, 42));
        q([[x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1]], shade(b.hue, 33));
        const t = [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)];
        const g = ctx.createLinearGradient(t[0][0], t[0][1], t[2][0], t[2][1]); g.addColorStop(0, shade(b.hue, 70)); g.addColorStop(1, shade(b.hue, 58));
        ctx.fillStyle = g; ctx.beginPath(); t.forEach((s, i) => (i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]))); ctx.closePath(); ctx.fill();
        if (glow) { ctx.strokeStyle = `rgba(255,255,255,${glow})`; ctx.lineWidth = 2; ctx.stroke(); }
        ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(t[1][0], t[1][1]); ctx.lineTo(t[2][0], t[2][1]); ctx.lineTo(t[3][0], t[3][1]); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      function draw() {
        const hh = hueAt(score);
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `hsl(${(hh + 200) % 360}, 55%, 18%)`); g.addColorStop(.6, `hsl(${(hh + 230) % 360}, 50%, 30%)`); g.addColorStop(1, `hsl(${(hh + 260) % 360}, 45%, 42%)`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const r = ctx.createRadialGradient(W / 2, H * .55, 10, W / 2, H * .55, W * .9); r.addColorStop(0, 'rgba(255,255,255,.12)'); r.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 24; i++) { const x = (i * 97.3 + tAll * 6 * ((i % 3) + 1)) % W, y = (i * 53.7) % H; ctx.fillStyle = 'rgba(255,255,255,' + (.06 + (i % 4) * .03) + ')'; ctx.beginPath(); ctx.arc(x, y, 1 + (i % 3), 0, Math.PI * 2); ctx.fill(); }
        blocks.forEach((b, i) => boxDraw(b, null, b.glow));
        ripples.forEach((rp) => { const b = rp.b, e = rp.t * .5; const t = [P(b.x - e, b.y + BH, b.z - e), P(b.x + b.w + e, b.y + BH, b.z - e), P(b.x + b.w + e, b.y + BH, b.z + b.d + e), P(b.x - e, b.y + BH, b.z + b.d + e)]; ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, .8 - rp.t)})`; ctx.lineWidth = 2; ctx.beginPath(); t.forEach((s, i) => (i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]))); ctx.closePath(); ctx.stroke(); });
        if (!dead) boxDraw(cur, 1);
        falls.forEach((f) => boxDraw(f, Math.max(0, 1 - f.vy * .25)));
        sparks.forEach((p) => { const s = P(p.x, p.y, p.z); ctx.fillStyle = `rgba(255,255,255,${p.life})`; ctx.fillRect(s[0] - 1.5, s[1] - 1.5, 3, 3); });
        ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.font = '800 ' + Math.round(W * .2) + 'px system-ui, -apple-system, sans-serif'; ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 12; ctx.fillText(String(score), W / 2, H * .17); ctx.shadowBlur = 0;
        if (msg && msg.life > 0) { ctx.globalAlpha = msg.life; ctx.font = '700 ' + Math.round(W * .065) + 'px system-ui, sans-serif'; ctx.fillText(msg.t, W / 2, H * .24); ctx.globalAlpha = 1; }
      }
      function loop(t) {
        if (!cv.isConnected) return;
        const dt = Math.min(.05, (t - last) / 1000 || 0); last = t; tAll += dt;
        if (!dead) curPos();
        cam += (camT - cam) * Math.min(1, dt * 5);
        falls.forEach((f) => { f.vy += 3.2 * dt; f.y -= f.vy * dt; }); falls = falls.filter((f) => f.y > cam - 3);
        ripples.forEach((r2) => { r2.t += dt * 1.6; }); ripples = ripples.filter((r2) => r2.t < 1);
        sparks.forEach((p) => { p.y += p.vy * dt; p.life -= dt * 1.5; }); sparks = sparks.filter((p) => p.life > 0);
        if (msg) msg.life -= dt * 1.2;
        blocks.forEach((b) => { if (b.glow) b.glow = Math.max(0, b.glow - dt * 2); });
        draw(); requestAnimationFrame(loop);
      }
      let ov = null;
      function die() { alive = false; dead = true; fx.bad(); camT = Math.max(0, score * BH * .5 - 1); setTimeout(() => { if (!cv.isConnected) return; arcOver(box, score + (score === 1 ? ' etasje' : ' etasjer'), score > best && best ? 'Ny rekord!' : 'Tårnet er ferdig', 'Se resultatet', () => dispatch({ t: 'done', score, n: score })); }, 900); }
      box.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; e.preventDefault(); drop(); });
      const key = (e) => { if (!cv.isConnected) { removeEventListener('keydown', key); return; } if (e.key === ' ') { e.preventDefault(); drop(); } }; addEventListener('keydown', key);
      requestAnimationFrame(() => { dim = fit(); W = dim.W; H = dim.H; U = W * .34; CX = W / 2; CY = H * .62; reset(); ov = arcOver(box, 'Bygg høyt', 'Trykk for å starte, trykk igjen for å slippe blokken', null); ov.classList.add('soft'); last = performance.now(); requestAnimationFrame(loop); });
    }
  });

  const GAMES = { sn: SN, ff: FF, st: ST, ms: MS, ky: KY, kr: KR, tl: TL, qz: QZ, fo: FO, an: AN, hv: HV, ko: KO, vo: VO, bl: BL, sk: SK, sv: SV, kb: KB, ld: LD, sb: SB, ps: PS };
  const TILES = [
    ['pk', 'wide', '#f4d27a', '#b48cff', 'Lubben-kort', 'Pakkeåpning', 'Riv opp en pakke og jakt gull- og legendekort av gjengen.', '<svg viewBox="0 0 48 48" fill="none" stroke-width="2.5"><rect x="12" y="6" width="24" height="36" fill="#0b1a21" stroke="#f4d27a"/><path d="M12 12h24" stroke="#f4d27a" stroke-width="5"/><path d="M24 20l2.5 5 5.5.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.5-.8z" fill="#f4d27a" stroke="none"/></svg>'],
    ['al', 'wide', '#b48cff', '#f4d27a', 'Lubben-kort', 'Kortalbum', 'Se samlingen din, hvilke kort du mangler og trykk på et kort for å se det stort.', '<svg viewBox="0 0 48 48" fill="none" stroke-width="2.5"><rect x="6" y="8" width="36" height="32" stroke="#b48cff"/><path d="M24 8v32" stroke="#b48cff"/><rect x="10" y="13" width="10" height="9" fill="#f4d27a" stroke="none"/><rect x="28" y="13" width="10" height="9" fill="#d39a62" stroke="none"/><rect x="10" y="26" width="10" height="9" fill="#eef1f3" stroke="none"/><rect x="28" y="26" width="10" height="9" stroke="#8fa6ae" stroke-dasharray="2 2"/></svg>'],
    ['ps', 'wide', '#ffd36e', '#ff5b24', 'Raskt og riktig', 'Postsortereren', 'Brev fra hele verden. Sorter etter flagget, byen eller postnummeret, fortere og fortere.', '<svg viewBox="0 0 48 48" fill="none" stroke="#ffd36e" stroke-width="2.5"><rect x="6" y="12" width="36" height="24"/><path d="M6 12l18 14 18-14"/><path d="M30 30h8M30 26h5" stroke-width="2"/></svg>'],
    ['tl', 'wide', '#f7dd8f', '#ff5b24', 'Hendelser i tid', 'Tidslinjen', 'Dra hendelser inn på riktig plass. Over ' + Math.floor(EV.length / 50) * 50 + ' hendelser fra pyramidene til i år.', '<svg viewBox="0 0 48 48" fill="none" stroke="#f7dd8f" stroke-width="2.5"><path d="M4 30h40"/><circle cx="10" cy="30" r="4" fill="#0b1a21"/><circle cx="24" cy="30" r="4" fill="#ff5b24" stroke="#ff5b24"/><circle cx="38" cy="30" r="4" fill="#0b1a21"/><path d="M24 22V10m-5 5 5-5 5 5"/></svg>'],
    ['qz', 'wide', '#ff6ad5', '#4df3ff', 'Fire svar', 'Quiz', 'Lubben-mix uten slutt, eller lag din egen quiz som gjengen kan spille.', '<svg viewBox="0 0 48 48" fill="none" stroke-width="2.5"><path d="M6 8h16l-8 14z" stroke="#ff5b5b"/><path d="M34 6l8 8-8 8-8-8z" stroke="#4d8bff"/><circle cx="14" cy="34" r="7" stroke="#ffe600"/><rect x="27" y="27" width="14" height="14" stroke="#2bff88"/></svg>'],
    ['ky', 'wide', '#ff6ad5', '#ffe600', 'Les det rart', 'Kryptert', 'Les tullet høyt til det blir noe: «Morge Nstu Nnhargg Ulli Munn». ' + KY_CARDS.length + ' kort, ett minutt per tur.', '<svg viewBox="0 0 48 48" fill="none" stroke="#ff6ad5" stroke-width="2.5"><path d="M8 14h32v20H22l-8 7v-7H8z"/><path d="M14 22h4M21 22h6M30 22h4M16 28h8M27 28h5" stroke="#ffe600" stroke-width="3"/></svg>'],
    ['kr', 'wide', '#2bff88', '#4df3ff', 'Lag mot lag', 'Kodeknekker', 'Gi hint til laget ditt uten at motstanderne knekker koden. To lag, hver på sin telefon.', '<svg viewBox="0 0 48 48" fill="none" stroke="#2bff88" stroke-width="2.5"><rect x="8" y="20" width="32" height="22" rx="0"/><path d="M15 20v-6a9 9 0 0 1 18 0v6"/><path d="M17 31h3M23 31h3M29 31h3" stroke="#4df3ff" stroke-width="3"/></svg>'],
    ['sn', '', '#2bff88', '#4df3ff', 'Klassiker', 'Slange', 'Sveip for å styre, spis eplene, ikke bit deg selv.', '<svg viewBox="0 0 48 48" fill="none" stroke="#2bff88" stroke-width="4" stroke-linecap="square"><path d="M8 38h14V24h14V12"/><circle cx="40" cy="10" r="3" fill="#ff4d4d" stroke="none"/></svg>'],
    ['ff', '', '#4df3ff', '#ff5b24', 'Ett trykk', 'Flappy-fly', 'Hold flyet i lufta mellom fjelltoppene.', '<svg viewBox="0 0 48 48" fill="none" stroke-width="2.5"><path d="M4 44l10-16 6 8 8-14 16 22z" fill="#1d3b4a" stroke="#4df3ff"/><path d="M10 14h18l6-4h3l-3 6H10z" fill="#e8edef" stroke="none"/><path d="M18 14l-4 6h4l6-6z" fill="#ff5b24" stroke="none"/></svg>'],
    ['st', '', '#ff6ad5', '#ffe600', 'Perfekt timing', 'Stableren', 'Slipp blokkene presist og bygg tårnet så høyt du kan.', '<svg viewBox="0 0 48 48"><rect x="10" y="36" width="28" height="7" fill="#7aa8ff"/><rect x="12" y="28" width="24" height="7" fill="#b48cff"/><rect x="15" y="20" width="18" height="7" fill="#ff6ad5"/><rect x="22" y="9" width="18" height="7" fill="#ffe600"/></svg>'],
    ['ms', '', '#7aa8ff', '#ff5a4a', 'Finn minene', 'Minesveiper', 'Klassikeren på mobilen. Tre nivåer, beste tid lagres.', '<svg viewBox="0 0 48 48" fill="none" stroke="#e8edef" stroke-width="2"><rect x="6" y="6" width="36" height="36"/><path d="M18 6v36M30 6v36M6 18h36M6 30h36"/><circle cx="24" cy="24" r="4" fill="#ff5a4a" stroke="none"/><path d="M33 9v7M33 9l5 2-5 2" stroke="#ffe600"/></svg>'],
    ['an', '', '#b48cff', '#ff6ad5', 'Nærmest vinner', 'Anslaget', 'Hvor høyt, hvor langt, hvor mange? Gjett nærmest.', '<svg viewBox="0 0 48 48" fill="none" stroke="#b48cff" stroke-width="2.5"><path d="M8 34a16 16 0 0 1 32 0"/><path d="M24 34l9-11"/><circle cx="24" cy="34" r="3" fill="#b48cff"/></svg>'],
    ['ko', '', '#c9a8ff', '#4df3ff', 'Fire og fire', 'Koblingen', 'Seksten ord, fire grupper og noen lumske feller. 62 brett.', '<svg viewBox="0 0 48 48" fill="#c9a8ff"><rect x="6" y="6" width="16" height="16"/><rect x="26" y="6" width="16" height="16" opacity=".6"/><rect x="6" y="26" width="16" height="16" opacity=".6"/><rect x="26" y="26" width="16" height="16" opacity=".35"/></svg>'],
    ['vo', '', '#ff6ad5', '#ffe600', 'Hemmelig avstemning', 'Hvem av oss?', 'Hvem blir først fyllesyk? Stem i hemmelighet.', '<svg viewBox="0 0 48 48" fill="none" stroke="#ff6ad5" stroke-width="2.5"><path d="M8 40V28M18 40V16M28 40V22M38 40V10"/><path d="M4 40h40"/></svg>'],
    ['bl', '', '#4df3ff', '#2bff88', 'Lur de andre', 'Bløff', 'Finn på et svar som lurer gutta. Finn sannheten selv.', '<svg viewBox="0 0 48 48" fill="none" stroke="#4df3ff" stroke-width="2.5"><path d="M8 12h32v20H22l-8 7v-7H8z"/><path d="M17 22h14"/></svg>'],
    ['sk', 'wide', '#ffb648', '#ff5b24', 'Quiz med slurker', 'Skål', 'Quizkort rundt bordet: årstall, hva kom først, anslag og hvem er jeg. Bom koster en slurk.', '<svg viewBox="0 0 48 48" fill="none" stroke="#ffb648" stroke-width="2.5"><path d="M10 8h12l-1 14a5 5 0 0 1-10 0zM26 8h12l-1 14a5 5 0 0 1-10 0z"/><path d="M16 27v12M32 27v12M11 40h10M27 40h10"/></svg>'],
    ['sv', '', '#2bff88', '#f7dd8f', 'Kortspill', '7-eren', 'Mot computeren eller hverandre online.', '<svg viewBox="0 0 48 48" fill="none" stroke="#2bff88" stroke-width="2.5"><rect x="8" y="8" width="20" height="28" transform="rotate(-10 18 22)"/><rect x="20" y="10" width="20" height="28" transform="rotate(8 30 24)" fill="#0b1a21"/><path d="M26 18h8l-5 12" /></svg>'],
    ['kb', '', '#4df3ff', '#b48cff', 'Alene', 'Kabal', 'Klondike, FreeCell og Golf. Trykk for å flytte.', '<svg viewBox="0 0 48 48" fill="none" stroke="#4df3ff" stroke-width="2.5"><rect x="5" y="8" width="11" height="15"/><rect x="18.5" y="8" width="11" height="15"/><rect x="32" y="8" width="11" height="15"/><rect x="5" y="27" width="11" height="15"/><rect x="18.5" y="31" width="11" height="12"/></svg>'],
    ['ld', '', '#ffb648', '#ff5b24', 'Liar’s Dice', 'Bløffterninger', 'Skjulte terninger, frekke bud og «Tvil!».', '<svg viewBox="0 0 48 48" fill="none" stroke="#ffb648" stroke-width="2.5"><rect x="6" y="14" width="18" height="18" rx="3"/><rect x="24" y="20" width="18" height="18" rx="3" transform="rotate(12 33 29)"/><circle cx="11" cy="19" r="1.6" fill="#ffb648"/><circle cx="19" cy="27" r="1.6" fill="#ffb648"/><circle cx="33" cy="29" r="1.6" fill="#ffb648"/></svg>'],
    ['sb', '', '#4df3ff', '#7aa8ff', 'Én mot én', 'Senke slagskip', 'Skjult flåte, ett skudd om gangen.', '<svg viewBox="0 0 48 48" fill="none" stroke="#4df3ff" stroke-width="2.5"><path d="M6 30h36l-5 8H11z"/><path d="M16 30v-8h12v8M22 22v-8"/><path d="M4 42c4 0 4-2 8-2s4 2 8 2 4-2 8-2 4 2 8 2 4-2 8-2"/></svg>'],
  ];

  // ---------- Seksjonen på siden ----------
  let SEC = null, unlocked = false;
  // Flytende varsel når noen har åpnet et rom, uansett hvor i appen du er
  let FLOAT = null, floatGone = null;
  function renderFloat() {
    const R = NET.remote;
    const show = unlocked && !groupLocked() && !view && roomLive(R) && GAMES[R.g] && R.host !== who() && !(S && S.on && S.sid === R.sid) && floatGone !== R.sid && R.ph === 'lobby';
    if (!show) { if (FLOAT) { FLOAT.remove(); FLOAT = null; } return; }
    if (!FLOAT) { FLOAT = h('div', 'ah-float'); FLOAT.setAttribute('role', 'status'); document.body.append(FLOAT); FLOAT.addEventListener('click', (e) => e.stopPropagation()); try { L('pop', true); } catch (e) {} }
    FLOAT.innerHTML = ''; const t = h('div'); t.append(h('b', '', R.host + ' har åpnet ' + GAMES[R.g].name), h('span', '', 'Kode ' + R.code + ' · ' + (R.mem || []).length + ' i rommet'));
    const x = h('button', 'fx', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Skjul'); x.onclick = () => { floatGone = R.sid; renderFloat(); };
    FLOAT.append(t, btn('Bli med', 'go sm', () => { floatGone = R.sid; renderFloat(); joinRoom(R); }), x);
  }
  function renderSection() {
    renderFloat();
    if (!SEC) return;
    SEC.hidden = !unlocked;
    if (!unlocked) return;
    const liveBox = SEC.querySelector('.ah-livebox'); liveBox.innerHTML = '';
    const nR = liveRooms().length;
    if (SEC._badge) { SEC._badge.textContent = nR ? (nR === 1 ? 'Rom åpent' : nR + ' rom åpne') : (S && !S.on && S.ph === 'play' && !S.st.end ? 'Pågår' : ''); SEC._badge.hidden = !SEC._badge.textContent; }
    roomsBox(liveBox, false);
    if (S && !S.on && S.ph === 'play' && !S.st.end) {
      const b = h('div', 'ah-live'); const t = h('div'); t.append(h('b', '', 'Fortsett ' + GAMES[S.g].name), h('div', 'fine', 'Spillet ditt på denne telefonen'));
      b.append(t, btn('Fortsett', 'sm', () => { openOverlay(); UI.key = null; render(); })); liveBox.append(b);
    }
  }
  let OPEN = false;
  function mount(o) {
    if ((mem.catsV || 1) < 2) { const su = mem.setup || {}; Object.values(su).forEach((x) => { if (x && x.cfg) delete x.cfg.cats; }); memSet('setup', su); memSet('catsV', 2); }
    OPT = Object.assign(OPT, o || {});
    const sec = o && o.el; if (!sec) return;
    SEC = sec;
    sec.innerHTML = '';
    // Diskré inngang: en liten stripe nederst på siden som foldes ut
    const peek = h('button', 'ah-peek'); peek.type = 'button'; peek.setAttribute('aria-expanded', 'false');
    const ic = h('span', 'pk-ic'); ic.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="7" width="19" height="11" rx="0"/><path d="M7 10.5v4M5 12.5h4"/><circle cx="16" cy="11.5" r="1" fill="currentColor"/><circle cx="18.5" cy="14" r="1" fill="currentColor"/></svg>';
    const tx = h('span', 'pk-t'); tx.append(h('b', '', 'Spillhallen'), h('span', '', 'Atten spill til flyet og kvelden'));
    const badge = h('span', 'pk-b', ''); const chev = h('span', 'pk-c', '▾');
    peek.append(ic, tx, badge, chev); sec.append(peek);
    const body = h('div', 'ah-body'); body.hidden = true; sec.append(body);
    body.append(h('p', 'fine', 'Spillene virker på én telefon uten nett, så de kan spilles i flymodus hvis siden er åpnet før dere går om bord. Med nett kan dere spille online, hver på sin telefon.'));
    const lb = h('div', 'ah-livebox'); body.append(lb);
    body.append(tileGrid((g) => openSetup(g)));
    body.append(btn('Turens toppliste', 'ghost ah-recbtn', () => { fx.sel(); renderHub(); setTimeout(() => { const r = view && view.body.querySelector('.tur') || view.body.querySelector('.rec'); if (r) r.scrollIntoView({ block: 'start' }); }, 30); }));
    peek.onclick = () => { OPEN = !OPEN; body.hidden = !OPEN; peek.setAttribute('aria-expanded', String(OPEN)); peek.classList.toggle('open', OPEN); fx.tap(); if (OPEN) setTimeout(() => { try { peek.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} }, 30); };
    SEC._badge = badge;
    renderSection();
    netInit();
  }
  function unlock() { unlocked = true; renderSection(); }
  // Ekstra innhold om reisemålet: kommer kryptert og legges til etter opplåsning
  let packed = false;
  function addPack(P) {
    if (packed || !P) return; packed = true;
    TL_CATS.isl = P.name || 'Reisemålet';
    (P.tl || []).forEach((r) => { EV.push({ i: EV.length, y: r[0], c: 'isl', d: r[1], t: r[2], ca: !!r[3] }); });
    // Bare et lite dryss av reisemålet i de andre spillene, og ingenting i Koblingen: for nisje til å være gøy
    (P.est || []).slice(0, 4).forEach((r) => EST.push(r));
    (P.who || []).slice(0, 3).forEach((r) => WHO.push(r));
    (P.bluff || []).slice(0, 5).forEach((r) => BLUFF_OPEN.push(r));
    if (mem.islV === 1) { const su = mem.setup || {}; Object.values(su).forEach((s) => { if (s && s.cfg && Array.isArray(s.cfg.cats)) { s.cfg.cats = s.cfg.cats.filter((c) => c !== 'isl'); if (!s.cfg.cats.length) delete s.cfg.cats; } }); memSet('setup', su); memSet('koDone', (mem.koDone || []).map((i) => i - (P.conn || []).length).filter((i) => i >= 0)); }
    if ((mem.islV || 0) < 2) memSet('islV', 2);
  }
  return { mount, unlock, addPack, _dbg: () => ({ S, UI, NET }) };
})();
