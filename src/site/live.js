  // ---------- Frittstående versjon: felles opplåsing, vær og valutakurs ----------
  (function standaloneLive() {
    if (!window.__LUB_STANDALONE) return;
    const waitDb = (fn) => { const t = setInterval(() => { if (typeof LIVE !== 'undefined' && LIVE && LIVE.db) { clearInterval(t); fn(LIVE.db); } }, 700); };
    // Når noen med koden åpner appen etter opplåsingstidspunktet, låses den opp for alle
    waitDb((db) => { try { db.doc('reveal/key').onSnapshot((s) => { const d = s && s.exists ? s.data() : null; if (d && d.k && !DATA && Date.now() >= REVEAL_AT) unlock(d.k, true); }, () => {}); } catch (e) {} });
    window.__lubShareKey = () => { if (Date.now() < REVEAL_AT || !PASS) return; waitDb((db) => { db.doc('reveal/key').get().then((s) => { if (!(s && s.exists)) return db.doc('reveal/key').set({ k: PASS, at: Date.now() }); }).catch(() => {}); }); };
    const SYM = [['clearsky', 'Sol'], ['fair', 'Lettskyet'], ['partlycloudy', 'Delvis skyet'], ['cloudy', 'Skyet'], ['fog', 'Tåke'], ['heavyrainshowers', 'Kraftige regnbyger'], ['lightrainshowers', 'Lette regnbyger'], ['rainshowers', 'Regnbyger'], ['heavyrain', 'Kraftig regn'], ['lightrain', 'Lett regn'], ['rain', 'Regn'], ['sleetshowers', 'Sluddbyger'], ['sleet', 'Sludd'], ['snowshowers', 'Snøbyger'], ['heavysnow', 'Kraftig snø'], ['lightsnow', 'Lett snø'], ['snow', 'Snø'], ['thunder', 'Torden']];
    const symTxt = (c) => { c = String(c || '').replace(/_(day|night|polartwilight)$/, ''); const f = SYM.find(([k]) => c.includes(k)); return f ? f[1] : 'Skiftende'; };
    const DAYS = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
    async function fetchWx(db) {
      if (!DATA || !Array.isArray(DATA.geo)) return;
      try { const s = await db.doc('vaer/dest').get(); const d = s && s.exists ? s.data() : null; if (d && Date.now() - (Date.parse(d.at) || 0) < 3600e3) return; } catch (e) {}
      const r = await fetch('https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=' + DATA.geo[0].toFixed(3) + '&lon=' + DATA.geo[1].toFixed(3));
      if (!r.ok) return; const j = await r.json(); const ts = (j.properties && j.properties.timeseries) || [];
      const by = {};
      ts.forEach((t) => { const dt = new Date(t.time); const k = dt.toISOString().slice(0, 10); const x = (by[k] = by[k] || { min: 99, max: -99, wind: 0, sym: null, h: 99, dt });
        const det = t.data.instant.details; x.min = Math.min(x.min, det.air_temperature); x.max = Math.max(x.max, det.air_temperature); x.wind = Math.max(x.wind, det.wind_speed || 0);
        const n = t.data.next_6_hours || t.data.next_1_hours; const hh = Math.abs(dt.getUTCHours() - 12); if (n && n.summary && hh < x.h) { x.h = hh; x.sym = n.summary.symbol_code; } });
      const days = Object.keys(by).sort().slice(0, 5).map((k) => { const x = by[k]; return { dag: DAYS[x.dt.getUTCDay()] + ' ' + x.dt.getUTCDate() + '.' + (x.dt.getUTCMonth() + 1), temp: Math.round(x.min) + '° / ' + Math.round(x.max) + '°', vaer: symTxt(x.sym), vind: Math.round(x.wind) + ' m/s' }; });
      if (days.length) await db.doc('vaer/dest').set({ days, at: new Date().toISOString(), src: 'yr.no' });
    }
    async function fetchFx(db) {
      if (!DATA || !DATA.cur) return; const k = 'kurs/' + DATA.cur.toLowerCase();
      try { const s = await db.doc(k).get(); const d = s && s.exists ? s.data() : null; if (d && Date.now() - (Date.parse(d.at) || 0) < 2 * 3600e3) return; } catch (e) {}
      // frankfurter.app er flyttet; prøv flere gratis kilder i tur og orden
      const cur = DATA.cur.toUpperCase(), lc = cur.toLowerCase(); let v = null;
      const tries = [
        async () => { const j = await (await fetch('https://api.frankfurter.dev/v1/latest?base=' + cur + '&symbols=NOK')).json(); return j && j.rates && j.rates.NOK; },
        async () => { const j = await (await fetch('https://open.er-api.com/v6/latest/' + cur)).json(); return j && j.rates && j.rates.NOK; },
        async () => { const j = await (await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/' + lc + '.json')).json(); return j && j[lc] && j[lc].nok; }
      ];
      for (const t of tries) { try { const x = Number(await t()); if (x > 0 && x < 10) { v = x; break; } } catch (e) {} }
      if (v > 0) await db.doc(k).set({ rate: v, at: new Date().toISOString() });
    }
    window.__lubFetchLive = () => { if (!navigator.onLine) return; waitDb((db) => { fetchWx(db).catch(() => {}); fetchFx(db).catch(() => {}); }); };
    setInterval(() => { if (DATA) window.__lubFetchLive(); }, 20 * 60e3);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && DATA) setTimeout(() => window.__lubFetchLive(), 1500); });
  })();

