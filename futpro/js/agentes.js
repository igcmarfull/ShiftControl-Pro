/* Representantes persistentes (fase 1 de docs/PROPUESTA_REPRESENTANTES.md).
   Mundo de agentes con identidad, experiencia, reputación, especialidad y contactos por mercado, guardado en S.agents.
   Se genera de forma determinista desde S.seed (no consume el RNG de la partida) y se completa al cargar partidas antiguas.
   Fase 1: el agente contratado sigue actuando solo con h.agent.lvl (multiplicador de sueldo, M.negotiate) y h.agent.com (comisión), igual que antes;
   los contactos y las especialidades todavía NO modifican visibilidad, ofertas ni precontratos (fases siguientes). */
(function () {
  var U = FP.U, Agents = FP.Agents = {};
  var VER = 1;
  var COM = { 1: 3, 2: 4, 3: 6, 4: 8, 5: 10 };            // comisión por nivel (1, 3 y 5 son los valores históricos; 2 y 4 interpolan)
  var PROFILES = ['promesas', 'veteranos', 'delanteros', 'defensas y porteros', 'todos'];
  var STYLES = ['dinero', 'desarrollo', 'equilibrado'];
  var TOP5 = ['ENG', 'ESP', 'GER', 'ITA', 'FRA'];
  var EXOTIC = ['JPN', 'KOR', 'UZB', 'GUA', 'HON', 'THA', 'IND', 'IRN', 'QAT', 'UAE', 'KSA', 'CHN', 'AUS', 'USA', 'MEX', 'PAN', 'SLV', 'JAM', 'CRC', 'EGY', 'MAR', 'RSA'];

  function lgByCountry() {
    var by = {}; FP.DATA.leagues.forEach(function (l) { var o = by[l.c] || (by[l.c] = { tmax: 0, q: 0 }); o.tmax = Math.max(o.tmax, l.t); if (l.t === 1) o.q = l.q; });
    return by;
  }
  function cname(c) { var d = FP.DATA.countries[c]; return d ? d.n : c; }
  // peso por nivel de competición (índice 0 = primera división)
  function tiers(kind, tmax) {
    var base = { baja: [0.1, 0.4, 0.9, 0.9, 0.9], media: [0.4, 0.9, 0.7, 0.4, 0.3], elite: [0.95, 0.6, 0.2, 0.1, 0.1], mixta: [0.7, 0.7, 0.7, 0.6, 0.5] }[kind] || [0.7, 0.7, 0.7, 0.6, 0.5];
    return base.slice();
  }
  function describe(a) {
    var cs = Object.keys(a.contacts).sort(function (x, y) { return a.contacts[y] - a.contacts[x]; }).slice(0, 3).map(cname).join(', ');
    var lvl = { baja: 'divisiones inferiores', media: 'ligas medias', elite: 'ligas de élite', mixta: 'todos los niveles' }[a.spec];
    var kind = { local: 'Conoce a fondo el mercado de ' + cname(a.nat), lowerdiv: 'Especialista en las divisiones inferiores de ' + cname(a.nat), ibero: 'Contactos en España, Portugal e Italia', elite: 'Agente de primera línea en las grandes ligas', sudamericano: 'Puente entre Sudamérica y Europa', exotico: 'Contactos en mercados poco habituales', joven: 'Busca promesas para ligas de todo el mundo', legacy: 'Tu representante de siempre' }[a.kind];
    return kind + '. Trabaja sobre todo en ' + lvl + ' (' + cs + ').';
  }

  // ---------- generación del mundo ----------
  Agents.generate = function (seed) {
    var r = U.mulberry(U.hash(seed, 'agentes', VER)), list = [], by = lgByCountry();
    var codes = Object.keys(FP.DATA.countries).filter(function (c) { return by[c]; }).sort();
    function ri(a, b) { return a + Math.floor(r() * (b - a + 1)); }
    function pick(arr) { return arr[Math.floor(r() * arr.length)]; }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function add(kind, nat, lvl, spec, contacts, extra) {
      var age = ri(33, 68), rep = clamp(lvl * 18 - 8 + ri(-8, 10), 5, 98);
      var a = { id: 'ag' + (list.length + 1), nm: FP.Names.gen(nat, r), nat: nat, age: age, yrs: Math.max(2, age - ri(25, 32)), lvl: lvl, exp: clamp(lvl * 14 + ri(0, 25), 5, 100), rep: rep,
        neg: clamp(lvl * 15 + ri(10, 25), 15, 98), com: COM[lvl], dur: lvl >= 4 ? ri(3, 4) : ri(1, 3), contacts: contacts, tiers: tiers(spec, 5), spec: spec,
        profile: pick(PROFILES), style: pick(STYLES), kind: kind, roster: [] };
      if (extra) Object.keys(extra).forEach(function (k) { a[k] = extra[k]; });
      a.desc = describe(a); list.push(a); return a;
    }
    codes.forEach(function (c) {
      var o = by[c], conf = FP.DATA.countries[c].conf, near = codes.filter(function (x) { return x !== c && FP.DATA.countries[x].conf === conf; });
      var lvl = o.q >= 68 ? ri(3, 4) : o.q >= 55 ? ri(2, 3) : ri(1, 3), ct = {}; ct[c] = 0.85;
      if (near.length) ct[pick(near)] = 0.25;
      add('local', c, lvl, o.tmax >= 3 && r() < 0.35 ? 'media' : 'mixta', ct);
      if (o.tmax >= 3) { var cb = {}; cb[c] = 0.9; add('lowerdiv', c, ri(1, 3), 'baja', cb); }
    });
    for (var i = 0; i < 6; i++) { var cn = {}; TOP5.forEach(function (c) { cn[c] = 0.9; }); add('elite', TOP5[i % 5], 5, 'elite', cn); }
    for (i = 0; i < 2; i++) add('ibero', pick(['ESP', 'POR', 'ITA']), ri(3, 4), 'media', { ESP: 0.85, POR: 0.85, ITA: 0.75 });
    ['ARG', 'BRA', 'URU'].forEach(function (c) { var cn = {}; cn[c] = 0.85; cn.ESP = 0.6; cn.POR = 0.6; cn.ITA = 0.5; add('sudamericano', c, ri(3, 4), 'media', cn); });
    var ex = EXOTIC.filter(function (c) { return by[c]; });
    for (i = 0; i < 5; i++) { var e = {}, nat = pick(ex); e[nat] = 0.85; while (Object.keys(e).length < 3) e[pick(ex)] = 0.7; add('exotico', nat, ri(2, 3), 'mixta', e); }
    for (i = 0; i < 4; i++) { var j = {}, nat2 = pick(codes); j[nat2] = 0.7; while (Object.keys(j).length < 4) j[pick(codes)] = 0.5; add('joven', nat2, ri(3, 4), 'mixta', j, { profile: 'promesas', style: 'desarrollo' }); }
    return list;
  };
  Agents.ensure = function () {
    var S = FP.S; if (!S) return null;
    if (!S.agents || S.agents.v !== VER) S.agents = { v: VER, list: Agents.generate(S.seed) };
    return S.agents;
  };
  Agents.get = function (id) { var A = Agents.ensure(); return A ? A.list.filter(function (a) { return a.id === id; })[0] || null : null; };
  // representante actual del héroe (objeto del mundo) o null
  Agents.current = function () { var h = FP.S && FP.S.hero; return h && h.agent && h.agent.id ? Agents.get(h.agent.id) : null; };
  // fuerza de contacto del agente con un club (0 a 1): país × peso de la división. Solo informativa en la fase 1.
  Agents.contact = function (a, club) {
    if (!a || !club) return 0;
    var cs = a.contacts[club.c] || 0, lg = FP.LGDEF && FP.LGDEF[club.lg], t = lg ? Math.min(lg.t, 5) : 1;
    return cs * (a.tiers[t - 1] != null ? a.tiers[t - 1] : 0.5);
  };

  // ---------- candidatos ----------
  // seis candidatos por año (mismo resultado para una semilla y un año): generalista del país, especialista de divisiones inferiores, élite y otros perfiles
  Agents.candidates = function () {
    var S = FP.S, h = S.hero, A = Agents.ensure().list, year = Math.floor(S.week / 52), r = U.mulberry(U.hash(S.seed, 'agents', year));
    var nat = h.nat, club = h.club != null ? S.clubs[h.club] : null, cc = club ? club.c : nat, used = {}, out = [];
    function pickFrom(f) { var pool = A.filter(function (a) { return !used[a.id] && f(a); }); if (!pool.length) return; var a = pool[Math.floor(r() * pool.length)]; used[a.id] = 1; out.push(a); }
    pickFrom(function (a) { return a.kind === 'local' && a.nat === nat; });
    pickFrom(function (a) { return a.kind === 'lowerdiv' && (a.nat === cc || a.nat === nat); });
    pickFrom(function (a) { return a.kind === 'lowerdiv'; });
    pickFrom(function (a) { return a.kind === 'elite'; });
    pickFrom(function (a) { return a.kind === 'exotico' || a.kind === 'ibero' || a.kind === 'sudamericano'; });
    pickFrom(function (a) { return a.kind === 'joven' || a.kind === 'local'; });
    return out.sort(function (a, b) { return a.lvl - b.lvl || a.id.localeCompare(b.id); }).map(function (a) { return { id: a.id, nm: a.nm + ' (agente)', lvl: a.lvl, com: a.com, desc: a.desc, spec: a.spec, kind: a.kind }; });
  };
  Agents.hire = function (c) { var h = FP.S.hero; h.agent = { nm: c.nm, lvl: c.lvl, com: c.com, id: c.id, since: FP.S.week }; };

  // ---------- migración de partidas anteriores ----------
  // el representante antiguo {nm, lvl, com} se conserva tal cual y se enlaza con una entrada del mundo
  Agents.migrate = function () {
    var S = FP.S, h = S && S.hero; if (!S) return;
    var A = Agents.ensure(); if (!h || !h.agent || h.agent.id) return;
    var id = 'ag_h' + (A.list.length + 1), ct = {}; ct[h.nat] = 0.8;
    var a = { id: id, nm: h.agent.nm, nat: h.nat, age: 45, yrs: 15, lvl: h.agent.lvl, exp: h.agent.lvl * 14, rep: h.agent.lvl * 18 - 8, neg: h.agent.lvl * 15 + 15, com: h.agent.com, dur: 2,
      contacts: ct, tiers: tiers('mixta', 5), spec: 'mixta', profile: 'todos', style: 'equilibrado', kind: 'legacy', roster: [] };
    a.desc = describe(a); A.list.push(a);
    h.agent.id = id; h.agent.since = h.agent.since != null ? h.agent.since : S.week;
  };
})();
