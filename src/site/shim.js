// Lubbetur utenfor Claude: Firebase (Firestore) erstatter Claude sine db-, room- og user-funksjoner.
// Siden kaller window.claude.use('db' | 'room' | 'user') akkurat som før.
(function () {
  if (window.claude && window.claude.use) return;
  window.__LUB_STANDALONE = true;
  const CFG = {
    apiKey: 'AIzaSyBa84gSbdpeS40NEMYIvnMSrUgyPUZaaes',
    authDomain: 'lubbetur.firebaseapp.com',
    projectId: 'lubbetur',
    storageBucket: 'lubbetur.firebasestorage.app',
    messagingSenderId: '1044825417235',
    appId: '1:1044825417235:web:c86a4a3a4e0a55dce541e6'
  };
  let fs = null;
  try {
    firebase.initializeApp(CFG);
    fs = firebase.firestore();
    // Strømsparing: koble fra serveren når appen har vært ute av skjermen i 20 sekunder, og koble til igjen straks den vises
    try { let offT = 0, off = false; document.addEventListener('visibilitychange', () => { clearTimeout(offT); if (document.hidden) offT = setTimeout(() => { if (document.hidden) { off = true; fs.disableNetwork().catch(() => {}); } }, 20000); else if (off) { off = false; fs.enableNetwork().catch(() => {}); } }); } catch (e) {}
    // Ingen lokal database-kopi: den gjorde appen treg på iPhone og kunne vise gammel spilltilstand
  } catch (e) { fs = null; }
  // ---------- Gjengkode: dataene ligger under en sti som bare koden gir ----------
  const GAMES_H = '0011d619e052b9be3685ba0dadeffee5f132b95f0977c3c80eb02a30676b7c56';
  let H = null; try { H = localStorage.getItem('lub-gang'); } catch (e) {}
  window.__LUB_GAMES = H === GAMES_H;
  window.__lubSwitchCode = () => { try { localStorage.removeItem('lub-gang'); } catch (e) {} location.reload(); };
  const P = (p) => 'g/' + H + '/' + p;
  const sha = async (t) => { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); };
  const gateReady = new Promise((res) => {
    if (H) { res(); return; }
    const css = document.createElement('style');
    css.textContent = '#lubGate{position:fixed;inset:0;z-index:2147483647;background:#0b1316;color:#e8edef;display:grid;place-items:center;font:16px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;padding:24px}#lubGate form{width:min(360px,100%);display:grid;gap:14px;text-align:center}#lubGate h1{margin:0;color:#ff6a3d !important;font-size:30px;letter-spacing:.06em;text-transform:uppercase}#lubGate p{margin:0;color:#e8edef !important;opacity:.75;font-size:14px;line-height:1.4}#lubGate input{font:inherit;font-size:18px;padding:14px;border-radius:12px;border:1px solid #2a3b42;background:#121d21;color:#fff;text-align:center}#lubGate button{font:inherit;font-weight:800;font-size:17px;padding:14px;border:0;border-radius:12px;background:#ff6a3d;color:#1b140e}#lubGate .err{color:#ff8a6a;min-height:1.2em}html.lub-locked body{overflow:hidden}';
    const mount = () => {
      document.documentElement.classList.add('lub-locked'); document.head.append(css);
      const g = document.createElement('div'); g.id = 'lubGate';
      g.innerHTML = '<form autocomplete="off"><h1>Lubbetur 2026</h1><p>Skriv inn koden du har fått: gjengkoden for hele appen eller spillkoden for Spillhallen. Du trenger bare gjøre det én gang på denne telefonen.</p><input type="text" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Kode" aria-label="Kode"><button type="submit">Lås opp</button><div class="err" role="status"></div></form>';
      document.body.append(g);
      const f = g.querySelector('form'), inp = g.querySelector('input'), err = g.querySelector('.err');
      setTimeout(() => inp.focus(), 50);
      f.addEventListener('submit', async (ev) => {
        ev.preventDefault(); const v = inp.value.trim().toLowerCase(); if (!v) return;
        err.textContent = 'Sjekker…'; const h = await sha('lubbetur:' + v);
        let ok = true;
        if (fs) { try { await fs.doc('g/' + h + '/meta/ok').get({ source: 'server' }); } catch (e) { if (e && e.code === 'permission-denied') ok = false; } }
        if (!ok) { err.textContent = 'Feil kode.'; inp.select(); return; }
        H = h; try { localStorage.setItem('lub-gang', h); } catch (e) {}
        if ((h === GAMES_H) !== !!window.__LUB_GAMES) { err.textContent = 'Åpner …'; location.reload(); return; }
        g.remove(); document.documentElement.classList.remove('lub-locked'); res();
      });
    };
    if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  });
  const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  let CID = null; try { CID = localStorage.getItem('lub-cid'); if (!CID) { CID = 'u' + rid(); localStorage.setItem('lub-cid', CID); } } catch (e) { CID = 'u' + rid(); }
  const TAB = 't' + rid();
  // Firestore tåler ikke lister i lister, så alt lagres som JSON-tekst
  const enc = (o) => ({ _j: JSON.stringify(o === undefined ? null : o), _t: Date.now() });
  const dec = (d) => { if (!d) return null; if (typeof d._j === 'string') { try { return JSON.parse(d._j); } catch (e) { return null; } } return d; };
  const snapDoc = (s) => { const raw = s.exists ? s.data() : null; return { exists: !!s.exists, id: s.id, data: () => dec(raw) }; };
  function docRef(path) {
    const r = fs.doc(P(path));
    return {
      id: r.id, path,
      get: async () => snapDoc(await r.get()),
      set: (o) => r.set(enc(o)),
      update: async (o) => { const s = await r.get(); const cur = s.exists ? dec(s.data()) || {} : {}; return r.set(enc(Object.assign({}, cur, o))); },
      delete: () => r.delete(),
      onSnapshot: (cb, err) => r.onSnapshot((s) => { try { cb(snapDoc(s)); } catch (e) {} }, err || (() => {}))
    };
  }
  function colRef(path) {
    const c = fs.collection(P(path));
    const wrapQ = (q) => ({ docs: q.docs.map(snapDoc), size: q.size, empty: q.empty });
    return {
      id: c.id, path,
      doc: (id) => docRef(path + '/' + (id || rid())),
      get: async () => wrapQ(await c.get()),
      onSnapshot: (cb, err) => c.onSnapshot((q) => { try { cb(wrapQ(q)); } catch (e) {} }, err || (() => {}))
    };
  }
  const db = fs ? { doc: docRef, collection: colRef } : null;

  // Feilsøking: hver åpning logger enhet, feil og når siden skjules/lukkes, så vi ser hvorfor appen starter på nytt
  (function diag() {
    if (!fs) return;
    try {
      const ref = fs.collection(P('diag')).doc(TAB), t0 = Date.now(), evs = []; let pend = 0;
      const nm = () => { try { return JSON.parse(localStorage.getItem('lubbetur-hvem') || 'null'); } catch (e) { return null; } };
      const flush = () => ref.set({ cid: CID, who: nm(), ua: String(navigator.userAgent).slice(0, 180), sa: !!(navigator.standalone || (matchMedia && matchMedia('(display-mode: standalone)').matches)), t0, last: Date.now(), ver: window.__LUB_VER || '', ev: JSON.stringify(evs) }).catch(() => {});
      const push = (k, v) => { evs.push([Math.round((Date.now() - t0) / 1000), k, String(v == null ? '' : v).slice(0, 160)]); if (evs.length > 40) evs.shift(); clearTimeout(pend); pend = setTimeout(flush, 1200); };
      push('start', (document.referrer ? 'ref ' : '') + 'sw:' + !!(navigator.serviceWorker && navigator.serviceWorker.controller) + ' nav:' + ((performance.getEntriesByType && (performance.getEntriesByType('navigation')[0] || {}).type) || '?'));
      addEventListener('error', (e) => push('err', (e.message || '') + ' @' + (e.lineno || '')));
      addEventListener('unhandledrejection', (e) => push('rej', e.reason && (e.reason.message || e.reason)));
      document.addEventListener('visibilitychange', () => push('vis', document.visibilityState));
      addEventListener('pagehide', (e) => { push('pagehide', e.persisted); flush(); });
      addEventListener('pageshow', (e) => { if (e.persisted) push('pageshow', 'bfcache'); });
      setInterval(() => { if (document.hidden) return; const ar = document.querySelector('.ar'); ref.update({ last: Date.now(), ov: ar ? ((ar.querySelector('.ar-h') || {}).textContent || 'spill').slice(0, 60) : '' }).catch(() => {}); }, 10000);
    } catch (e) {}
  })();

  // Sanntid: hendelser og hvem som er her, via Firestore
  let room = null;
  const mkRoom = () => {
  if (fs) {
    const ev = fs.collection(P('ev')), peersC = fs.collection(P('peers'));
    const handlers = {}; let evSub = null; const t0 = Date.now() - 4000;
    const startEv = () => {
      if (evSub) return;
      evSub = ev.where('ct', '>', t0).onSnapshot((q) => {
        q.docChanges().forEach((ch) => {
          if (ch.type !== 'added') return; const d = ch.doc.data(); if (!d || !handlers[d.tp]) return;
          let data = null; try { data = JSON.parse(d.d); } catch (e) {}
          const m = { topic: d.tp, data, by: d.by, isMe: d.by === CID, sameTab: d.tab === TAB, guest: false };
          handlers[d.tp].forEach((fn) => { try { fn(m); } catch (e) {} });
        });
      }, () => {});
    };
    let myPres = null, hb = null;
    const writePres = () => { if (!myPres || document.hidden) return Promise.resolve(); return peersC.doc(TAB).set({ p: JSON.stringify(myPres), cid: CID, ct: Date.now() }).catch(() => {}); };
    try { addEventListener('pagehide', () => { try { peersC.doc(TAB).delete(); } catch (e) {} }); } catch (e) {}
    // Pålogget = appen er åpen på skjermen. Skjult fane eller app i bakgrunnen regnes som borte.
    try { document.addEventListener('visibilitychange', () => { try { if (document.hidden) peersC.doc(TAB).delete().catch(() => {}); else writePres(); } catch (e) {} }); } catch (e) {}
    room = {
      emit: (topic, data) => ev.add({ tp: String(topic), d: JSON.stringify(data === undefined ? null : data), by: CID, tab: TAB, ct: Date.now() }),
      on: (topic, fn) => { (handlers[topic] = handlers[topic] || []).push(fn); startEv(); return () => { handlers[topic] = (handlers[topic] || []).filter((f) => f !== fn); }; },
      presence: (patch) => { myPres = Object.assign({}, myPres || {}, patch || {}); Object.keys(myPres).forEach((k) => { if (myPres[k] == null) delete myPres[k]; }); if (!hb) hb = setInterval(writePres, 25000); return writePres(); },
      onPeers: (fn, errFn) => {
        let prev = new Set(), docs = [];
        const emitPeers = () => {
          const now = Date.now();
          const peers = docs.filter((d) => now - (d.ct || 0) < 75000).map((d) => { let pr = null; try { pr = JSON.parse(d.p); } catch (e) {} return { id: d.id, peer: d.id, isMe: d.id === TAB, kind: 'viewer', guest: false, presence: pr }; });
          const ids = new Set(peers.map((p) => p.id));
          const joined = peers.filter((p) => !prev.has(p.id)), left = [...prev].filter((id) => !ids.has(id)).map((id) => ({ id, peer: id }));
          prev = ids; try { fn({ peers, joined, left }); } catch (e) {}
        };
        const unsub = peersC.onSnapshot((q) => { docs = q.docs.map((s) => Object.assign({ id: s.id }, s.data())); emitPeers(); }, () => { if (errFn) try { errFn({ code: 'unavailable' }); } catch (e) {} });
        const iv = setInterval(emitPeers, 20000);
        return () => { unsub(); clearInterval(iv); };
      },
      leave: () => { try { return peersC.doc(TAB).delete(); } catch (e) { return Promise.resolve(); } }
    };
  }
  };
  const user = {
    id: async () => CID, isOwner: async () => false, canEdit: async () => false, can: async () => true,
    me: async () => ({ id: CID, name: '', email: null, isOwner: false, canEdit: false, guest: false }),
    profiles: async (ids) => { const o = {}; (ids || []).forEach((i) => { o[i] = { id: i, name: '', email: null }; }); return o; },
    search: async () => []
  };
  window.claude = Object.freeze({ use: (n) => gateReady.then(() => { if (!room && fs) mkRoom(); return n === 'db' ? db : n === 'room' ? room : n === 'user' ? user : null; }) });
})();
// Ingen zoom på iPhone: stopp knipe-zoom (dobbelttrykk stoppes med touch-action i CSS)
try { ['gesturestart', 'gesturechange'].forEach((t) => document.addEventListener(t, (e) => { if (!(e.target && e.target.closest && e.target.closest('.docv'))) e.preventDefault(); }, { passive: false })); } catch (e) {}
