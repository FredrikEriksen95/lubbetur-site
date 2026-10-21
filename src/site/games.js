  // ---------- Spillkode: bare Spillhallen, med egne navn ----------
  (function gamesOnly() {
    if (!window.__LUB_GAMES) return;
    const root = document.documentElement; root.classList.add('lub-games');
    try { document.title = 'Spillhallen'; } catch (e) {}
    const NKEY = 'lub-spill-navn';
    const sec = $('arcadeSec'); if (!sec) return; sec.hidden = false;
    try { window.LubArcade && LubArcade.unlock(); } catch (e) {}
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const top = mk('section', 'gm-top'); top.id = 'gamesTop';
    const h1 = mk('h1', '', 'Spillhallen');
    const lead = mk('p', 'gm-lead', 'Legg inn navnet ditt og spill alene eller mot hverandre, hver på sin telefon.');
    const meRow = mk('div', 'gm-me');
    const chips = mk('div', 'gm-chips');
    const form = mk('form', 'gm-add'); form.autocomplete = 'off';
    const inp = mk('input'); inp.type = 'text'; inp.maxLength = 18; inp.placeholder = 'Nytt navn'; inp.setAttribute('aria-label', 'Nytt navn'); inp.autocapitalize = 'words';
    const addB = mk('button', '', 'Legg til'); addB.type = 'submit';
    form.append(inp, addB);
    const sw = mk('button', 'gm-sw', 'Bytt kode / logg ut'); sw.type = 'button'; sw.onclick = () => { try { window.__lubSwitchCode && window.__lubSwitchCode(); } catch (e) {} };
    const ver = mk('p', 'gm-ver', window.__LUB_VER ? 'Versjon ' + window.__LUB_VER : '');
    top.append(h1, lead, meRow, chips, form, sw, ver);
    sec.parentElement.insertBefore(top, sec);
    // Lubben-kort (pakker og album) ligger under Spillhallen
    try { const tc = $('tcgSec'); if (tc) sec.after(tc); } catch (e) {}

    const clean = (n) => String(n || '').replace(/\s+/g, ' ').trim().slice(0, 18);
    const saveLocal = () => { try { localStorage.setItem(NKEY, JSON.stringify(PEOPLE)); } catch (e) {} };
    function setNames(arr) {
      const seen = new Set(); const out = [];
      (arr || []).forEach((n) => { n = clean(n); const k = n.toLowerCase(); if (n && !seen.has(k)) { seen.add(k); out.push(n); } });
      PEOPLE.length = 0; out.forEach((n) => PEOPLE.push(n)); saveLocal(); render();
    }
    function render() {
      meRow.textContent = '';
      if (curWho) { meRow.append(mk('span', '', 'Du spiller som '), mk('b', '', curWho)); }
      else meRow.append(mk('span', '', 'Velg navnet ditt, eller legg til et nytt.'));
      chips.textContent = '';
      PEOPLE.forEach((n) => { const b = mk('button', n === curWho ? 'on' : '', n); b.type = 'button'; b.onclick = () => { pickWho(n); render(); try { toast('Du spiller som ' + n + '.'); } catch (e) {} }; chips.append(b); });
      if (!PEOPLE.length) chips.append(mk('span', 'gm-empty', 'Ingen navn ennå.'));
    }
    let ref = null;
    async function addName(raw) {
      const n = clean(raw); if (!n) return null;
      const hit = PEOPLE.find((x) => x.toLowerCase() === n.toLowerCase());
      if (hit) return hit;
      setNames(PEOPLE.concat([n]));
      if (ref) { try { const s = await ref.get(); const d = s.exists ? s.data() : null; const cur = (d && Array.isArray(d.names)) ? d.names : []; if (!cur.some((x) => String(x).toLowerCase() === n.toLowerCase())) await ref.set({ names: cur.concat([n]) }); } catch (e) {} }
      return n;
    }
    window.__lubAddName = async (raw) => { const n = await addName(raw); if (n) { pickWho(n); render(); } return n; };
    form.addEventListener('submit', async (e) => { e.preventDefault(); const n = await window.__lubAddName(inp.value); if (n) { inp.value = ''; try { toast('Du spiller som ' + n + '.'); } catch (x) {} } });
    render();
    try {
      window.claude.use('db').then((db) => {
        if (!db) return; ref = db.doc('spillere/liste');
        ref.onSnapshot((s) => { const d = s && s.exists ? s.data() : null; if (d && Array.isArray(d.names)) setNames(d.names.concat(PEOPLE.filter((p) => !d.names.some((x) => String(x).toLowerCase() === p.toLowerCase())))); });
        // Navn lagt inn uten nett blir med når nettet er tilbake
        ref.get().then((s) => { const d = s.exists ? s.data() : null; const cur = (d && Array.isArray(d.names)) ? d.names : []; const miss = PEOPLE.filter((p) => !cur.some((x) => String(x).toLowerCase() === p.toLowerCase())); if (miss.length) ref.set({ names: cur.concat(miss) }).catch(() => {}); }).catch(() => {});
      }).catch(() => {});
    } catch (e) {}
    const openHall = () => { const pk = sec.querySelector('.ah-peek'); if (pk && pk.getAttribute('aria-expanded') !== 'true') { pk.click(); setTimeout(() => scrollTo({ top: 0, behavior: 'auto' }), 80); } };
    setTimeout(openHall, 200); setTimeout(openHall, 1200);
  })();

