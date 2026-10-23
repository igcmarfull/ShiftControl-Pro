/* Representantes persistentes (fase 1 de docs/PROPUESTA_REPRESENTANTES.md).
   Mundo de agentes con identidad, experiencia, reputación, especialidad y contactos por mercado, guardado en S.agents.
   Se genera de forma determinista desde S.seed (no consume el RNG de la partida) y se completa al cargar partidas antiguas.
   Fase 1: el agente contratado sigue actuando solo con h.agent.lvl (multiplicador de sueldo, M.negotiate) y h.agent.com (comisión), igual que antes;
   los contactos y las especialidades todavía NO modifican visibilidad, ofertas ni precontratos (fases siguientes). */
(function () {
  var U = FP.U, Agents = FP.Agents = {}, Rep = FP.Rep;
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
  var idx = { list: null, map: null };                      // índice id → agente (se reconstruye si cambia la lista: carga, migración)
  Agents.get = function (id) {
    var A = Agents.ensure(); if (!A) return null;
    if (idx.list !== A.list || idx.n !== A.list.length) { idx.list = A.list; idx.n = A.list.length; idx.map = {}; A.list.forEach(function (a) { idx.map[a.id] = a; }); }
    return idx.map[id] || null;
  };
  // representante actual del héroe (objeto del mundo) o null
  Agents.current = function () { var h = FP.S && FP.S.hero; return h && h.agent && h.agent.id ? Agents.get(h.agent.id) : null; };
  // fuerza de contacto del agente con un club (0 a 1): país × peso de la división. Solo informativa en la fase 1.
  Agents.contact = function (a, club) {
    if (!a || !club) return 0;
    var cs = a.contacts[club.c] || 0, lg = FP.LGDEF && FP.LGDEF[club.lg], t = lg ? Math.min(lg.t, 5) : 1;
    return cs * (a.tiers[t - 1] != null ? a.tiers[t - 1] : 0.5);
  };

  // ---------- efecto de los contactos (fase 2) ----------
  // Supuestos de diseño: el representante solo modera la visibilidad y el seguimiento donde tiene contactos; nunca decide por el club ni salta las reglas
  // deportivas (Rep.fit, lowerGate, offerGate, cupos de extranjeros, sueldos). vis: puntos máximos que baja el requisito de reputación del club; pull: aumento máximo del peso de interés.
  Agents.CFG = { vis: 6, pull: 0.5, q0: 0.6 };
  // fuerza efectiva (0 a 1): contacto del país × peso de la división × calidad del agente (el nivel 1 aporta el 60 % y el 5 el 100 %)
  Agents.strength = function (club) {
    var S = FP.S, h = S && S.hero; if (!h || !h.agent || !h.agent.id) return 0;
    var a = Agents.get(h.agent.id); if (!a) return 0;
    var c = Agents.contact(a, club); if (c <= 0) return 0;
    var C = Agents.CFG; return c * (C.q0 + (1 - C.q0) * (a.lvl - 1) / 4);
  };
  Agents.visibility = function (club) { return Agents.CFG.vis * Agents.strength(club); };      // puntos de reputación que se descuentan del requisito del club
  Agents.pullBoost = function (club) { return 1 + Agents.CFG.pull * Agents.strength(club); };  // multiplicador del peso con el que el club se fija en el jugador

  // ---------- instrucciones al representante (fase 3) ----------
  // Una ranura de destino (país, liga, divisiones inferiores, Europa) y una de prioridad (titularidad, sueldo, desarrollo), más peticiones puntuales de cesión y renovación.
  // Las instrucciones NO crean ofertas ni tocan las puertas deportivas y económicas: solo sesgan el reparto de interés (Rep.pull) y alimentan el interés con una gestión
  // semanal limitada (Rep.addInterest sobre clubes que ya pasan exposure, cupos y Rep.fit). Estado en h.agb (del jugador, no del agente: cambiar de agente no reinicia los plazos).
  // Todos los valores son supuestos de diseño.
  Agents.CFG.brief = { dest: 1.6, off: 0.8, half: 0.5, prio: 1.3, dur: 26, change: 8, every: 4, perYear: 6, dv: [8, 16], p0: 0.3, pl: 0.06, loanDur: 26, askEvery: 8 };
  var DEST = ['pais', 'liga', 'inferiores', 'europa'], PRIO = ['titular', 'sueldo', 'desarrollo'];
  function agb() { var h = FP.S && FP.S.hero; return h ? (h.agb || (h.agb = { dest: null, prio: null, set: -999, until: 0, last: -999, hist: [], loan: 0, ask: -999, log: [] })) : null; }
  function shortName(h) { return h.agent && h.agent.nm ? h.agent.nm.replace(/\s*\(agente\)\s*/i, '') : 'Tu representante'; }
  function say(txt, kind, ok) { var b = agb(); b.log.unshift({ w: FP.S.week, ok: !!ok, t: txt }); if (b.log.length > 10) b.log.length = 10; FP.Hero.msg('Tu agente ' + shortName(FP.S.hero) + ': ' + txt, kind || 'i'); }
  Agents.destLabel = function (d) {
    if (!d) return 'cualquier destino';
    if (d.k === 'pais') return cname(d.arg);
    if (d.k === 'liga') { var l = FP.LGDEF && FP.LGDEF[d.arg]; return l ? l.n + ' (' + cname(l.c) + ')' : d.arg; }
    return d.k === 'europa' ? 'Europa' : 'divisiones inferiores';
  };
  Agents.PRIO_LABEL = { titular: 'ser titular', sueldo: 'el sueldo', desarrollo: 'el desarrollo' };
  // instrucciones vigentes (requieren representante contratado y no caducadas)
  Agents.brief = function () {
    var S = FP.S, h = S && S.hero, b = h && h.agb; if (!h || !h.agent || !b) return null;
    return b.until > S.week && (b.dest || b.prio) ? b : null;
  };
  Agents.matches = function (club, d) {
    if (!d) return true;
    var lg = FP.LGDEF[club.lg]; if (!lg) return false;
    if (d.k === 'pais') return club.c === d.arg;
    if (d.k === 'liga') return club.lg === d.arg;
    if (d.k === 'europa') return FP.DATA.countries[club.c].conf === 'UEFA';
    var h = FP.S.hero, cur = h.club != null ? FP.S.clubs[h.club] : null, ct = cur && FP.LGDEF[cur.lg] ? FP.LGDEF[cur.lg].t : 0;
    return lg.t >= 3 || lg.t > ct;
  };
  // peso adicional del club en el reparto de interés: destino hasta ×1,6 (la mitad si el agente no conoce ese país), resto ×0,8, prioridad hasta ×1,3
  Agents.briefWeight = function (club, f) {
    var b = Agents.brief(); if (!b) return 1;
    var C = Agents.CFG.brief, w = 1;
    if (b.dest) {
      if (Agents.matches(club, b.dest)) { var a = Agents.current(), known = a && a.contacts[club.c] > 0; w *= 1 + (C.dest - 1) * (known ? 1 : C.half); }
      else w *= C.off;
    }
    if (b.prio && f) {
      if (b.prio === 'titular' && f.gap >= 3) w *= C.prio;
      else if (b.prio === 'sueldo' && club.fin >= 6) w *= C.prio;
      else if (b.prio === 'desarrollo' && f.kind === 'project') w *= C.prio;
    }
    return w;
  };
  Agents.canInstruct = function () {
    var h = FP.S.hero;
    if (!h.agent) return { ok: false, msg: 'Necesitas un representante para darle instrucciones.' };
    if (FP.Hero.age() < 15) return { ok: false, msg: 'Podrás contratar representante desde los 15 años.' };
    return { ok: true };
  };
  // dest: 'any' | 'inf' | 'eur' | 'pais:XXX' | 'liga:ID'; prio: '' | 'titular' | 'sueldo' | 'desarrollo'
  Agents.setBrief = function (dest, prio) {
    var S = FP.S, c = Agents.canInstruct(); if (!c.ok) return c;
    var b = agb(), C = Agents.CFG.brief, d = null;
    var m = /^(pais|liga):(.+)$/.exec(dest || '');
    if (m) { d = { k: m[1], arg: m[2] }; if (m[1] === 'pais' ? !FP.DATA.countries[m[2]] || !FP.DATA.leagues.some(function (l) { return l.c === m[2]; }) : !FP.LGDEF[m[2]]) return { ok: false, msg: 'Ese destino no existe en el juego.' }; }
    else if (dest === 'inf') d = { k: 'inferiores' }; else if (dest === 'eur') d = { k: 'europa' };
    var pr = PRIO.indexOf(prio) >= 0 ? prio : null;
    if (!d && !pr) { b.dest = null; b.prio = null; b.until = 0; return { ok: true, msg: 'Retiraste las instrucciones: tu agente vuelve a mirar todo el mercado.' }; }
    if (S.week - b.set < C.change) return { ok: false, msg: 'Acabas de dar instrucciones: tu agente pide esperar ' + (C.change - (S.week - b.set)) + ' semanas antes de cambiarlas.' };
    b.dest = d; b.prio = pr; b.set = S.week; b.until = S.week + C.dur; b.tg = []; b.won = []; b.drops = [];
    return { ok: true, msg: 'Instrucciones dadas: ' + (d ? 'destino ' + Agents.destLabel(d) : 'cualquier destino') + (pr ? ', prioridad: ' + Agents.PRIO_LABEL[pr] : '') + '. Duran ' + C.dur + ' semanas. No garantizan ofertas.' };
  };
  // diagnóstico por etapas de los clubes del destino: por qué no hay oportunidades
  function stages(list, cur, age) {
    var S = FP.S, h = S.hero, w = S.week, n = [list.length, 0, 0, 0], cand = [];
    list.forEach(function (c) {
      if (c === cur || h.club === c.id) return;
      if (!Rep.exposure(c).ok) return; n[1]++;
      if (h.cd[c.id] > w || !Rep.foreignOK(c, h.nat, age) || !Rep.permit(c)) return; n[2]++;
      var f = Rep.fit(c); if (f.kind === 'none' || !f.ok) return; n[3]++; cand.push(c);
    });
    return { n: n, cand: cand };
  }
  function reason(n, dest) {
    var lab = Agents.destLabel(dest);
    if (!n[0]) return 'no encontró clubes en ' + lab + ' que pudiera sondear';
    if (!n[1]) return 'ningún club de ' + lab + ' te conoce todavía: tu reputación aún no llega hasta allí';
    if (!n[2]) return 'los clubes de ' + lab + ' no pueden fichar ahora a un jugador como tú (cupos de extranjeros, edad o clubes que ya te descartaron)';
    return 'ningún club de ' + lab + ' necesita a un jugador de tu nivel y posición en este momento';
  }
  // gestión semanal: como mucho una cada 4 semanas y 6 en 52 semanas.
  // El agente cultiva una lista corta de clubes objetivo (2 y, a veces, 3): primero contacta, después insiste con los mismos clubes (la insistencia pesa más y el interés de
  // un objetivo se enfría más despacio) hasta que el club lo sigue de cerca o deja de ser posible. Con maxTargets = 0 vuelve a repartir cada gestión en un club distinto.
  Agents.CFG.brief.maxTargets = 3; Agents.CFG.brief.fill = 2; Agents.CFG.brief.third = 0.3; Agents.CFG.brief.dvInsist = [12, 24]; Agents.CFG.brief.warm = 0.35; Agents.CFG.brief.close = 38;
  // ritmo al que se enfría el interés de un club (0,7 por semana; la mitad si es objetivo activo del representante)
  Agents.decay = function (clubId) {
    var b = Agents.brief(), C = Agents.CFG.brief; if (!b || !C.maxTargets || !b.tg) return 0.7;
    for (var i = 0; i < b.tg.length; i++) if (b.tg[i].c === clubId) return C.warm;
    return 0.7;
  };
  function whyNot(c, cur, age) {
    var S = FP.S, h = S.hero;
    if (!Rep.exposure(c).ok) return 'ya no te conoce';
    if (h.cd[c.id] > S.week) return 'te descartó hace poco';
    if (!Rep.foreignOK(c, h.nat, age) || !Rep.permit(c)) return 'ya no puede ficharte (cupos o edad)';
    var f = Rep.fit(c); if (f.kind === 'none' || !f.ok) return 'ya no encaja contigo';
    return null;
  }
  Agents.weekly = function () {
    var S = FP.S, h = S && S.hero, b = Agents.brief(); if (!b || !Rep) return;
    var C = Agents.CFG.brief, w = S.week, age = FP.Hero.age();
    if (age < 15 || w - b.last < C.every) return;
    b.hist = b.hist.filter(function (x) { return w - x < 52; });
    if (b.hist.length >= C.perYear) return;
    if (FP.Contracts && FP.Contracts.ensure().pre) return;           // con un precontrato firmado no se aceptan más propuestas
    b.last = w;                                                       // ritmo: un intento cada 4 semanas; solo cuenta como gestión efectiva si hay algo que hacer (más abajo)
    var cur = h.club != null ? S.clubs[h.club] : null, pool = S.clubs.filter(function (c) { return Agents.matches(c, b.dest); }), st = stages(pool, cur, age);
    var tg = b.tg = C.maxTargets ? (b.tg || []) : [];
    // revisión de objetivos: los que ya te siguen de cerca pasan al club; los que dejaron de ser posibles se abandonan con su motivo
    tg = b.tg = tg.filter(function (t) {
      var c = S.clubs[t.c], why = whyNot(c, cur, age);
      if (why) { say('dejó de insistir con ' + c.nm + ': ' + why + '.', 'i', false); (b.drops = b.drops || []).unshift({ c: c.id, w: w, why: why }); if (b.drops.length > 8) b.drops.length = 8; return false; }
      if (Rep.interestOf(c.id) >= C.close) { (b.won = b.won || []).unshift({ c: c.id, w: w, v: Math.round(Rep.interestOf(c.id)) }); if (b.won.length > 6) b.won.length = 6; say(c.nm + ' ya te sigue de cerca (interés ' + Math.round(Rep.interestOf(c.id)) + '): ahora depende de que el club presente una propuesta.', 'ok', true); return false; }
      return true;
    });
    b.diag = { w: w, n: st.n.slice() };                                // para la pantalla: cuántos clubes del destino pasan cada etapa
    if (!st.cand.length && !tg.length) { say('sin oportunidades por ahora: ' + reason(st.n, b.dest) + '. No cuenta como gestión.', 'i', false); return; }
    b.hist.push(w);                                                    // contacto, insistencia o contacto rechazado: sí es una gestión efectiva
    var a = Agents.current(), cs = 0; st.cand.forEach(function (c) { cs += Agents.strength(c); }); cs /= Math.max(1, st.cand.length);
    var p = Math.min(0.75, C.p0 + C.pl * (a ? a.lvl : h.agent.lvl) + 0.2 * cs);
    // la tirada solo decide si aparece un contacto nuevo; insistir con un club objetivo ya abierto no depende de la suerte (y una tirada fallida no desperdicia la gestión)
    var needNew = !C.maxTargets || !tg.length || tg.length < C.fill || (tg.length < C.maxTargets && U.R() < C.third), club = null, dv = 0, isNew = false;
    if (needNew && st.cand.length && U.R() <= p) {
      var free = st.cand.filter(function (c) { return !tg.some(function (t) { return t.c === c.id; }); });
      club = Rep.pickClub(free.length ? free : st.cand); isNew = !!club;
      if (club) { dv = U.int(C.dv[0], C.dv[1]); if (C.maxTargets && !tg.some(function (t) { return t.c === club.id; })) tg.push({ c: club.id, since: w, push: 0, last: w }); }
    }
    if (!club && tg.length) { tg.sort(function (x, y) { return x.last - y.last; }); club = S.clubs[tg[0].c]; dv = U.int(C.dvInsist[0], C.dvInsist[1]); }
    if (!club) { say('sondeó ' + st.n[3] + ' clubes de ' + Agents.destLabel(b.dest) + ' que podrían ficharte, pero ninguno se movió esta vez.', 'i', false); return; }
    var t = tg.filter(function (x) { return x.c === club.id; })[0]; if (t) { t.push++; t.last = w; }
    Rep.addInterest(club, dv, 'gestión de tu representante');
    var v = Math.round(Rep.interestOf(club.id));
    if (v >= C.close) { b.tg = tg.filter(function (x) { return x.c !== club.id; }); (b.won = b.won || []).unshift({ c: club.id, w: w, v: v }); if (b.won.length > 6) b.won.length = 6; say(club.nm + ' (' + cname(club.c) + ') ya te sigue de cerca (interés ' + v + '): ahora depende de que el club presente una propuesta.', 'ok', true); return; }
    say(isNew && !(t && t.push > 1) ? 'movió tu perfil en ' + club.nm + ' (' + cname(club.c) + '). Todavía no es una oferta.' : 'insistió con ' + club.nm + ' (' + cname(club.c) + '): su interés sube a ' + v + ' de ' + C.close + '.', 'ok', true);
  };
  // resumen para la pantalla del representante: todo sale del estado guardado (h.agb) y de los datos del juego
  Agents.status = function () {
    var S = FP.S, h = S.hero, b = h && h.agb, a = Agents.current(); if (!h || !h.agent) return null;
    var C = Agents.CFG.brief, w = S.week, act = Agents.brief(), hist = ((b && b.hist) || []).filter(function (x) { return w - x < 52; });
    var st = { active: !!act, left: act ? Math.max(0, act.until - w) : 0, effective: hist.length, cap: C.perYear, targets: [], won: [], drops: [], max: C.maxTargets, next: null, fit: null, diag: null, agent: a };
    if (act) {
      st.next = hist.length >= C.perYear ? { capped: Math.max(1, Math.min.apply(null, hist) + 52 - w) } : { weeks: Math.max(0, b.last + C.every - w) };
      (act.tg || []).forEach(function (t) { st.targets.push({ club: S.clubs[t.c], v: Rep.interestOf(t.c), push: t.push }); });
      st.won = (act.won || []).slice(0, 4).map(function (d) { return { club: S.clubs[d.c], w: d.w, v: d.v }; });
      st.drops = (act.drops || []).slice(0, 4).map(function (d) { return { club: S.clubs[d.c], w: d.w, why: d.why }; });
      if (act.diag) st.diag = { n: act.diag.n, w: act.diag.w };
      if (act.dest) {
        var pool = S.clubs.filter(function (c) { return Agents.matches(c, act.dest); }), sum = 0, known = 0;
        pool.forEach(function (c) { var x = Agents.strength(c); sum += x; if (x > 0) known++; });
        var avg = pool.length ? sum / pool.length : 0;
        st.fit = { label: avg >= 0.4 ? 'alta' : avg >= 0.15 ? 'media' : avg > 0 ? 'baja' : 'sin contactos', known: known, total: pool.length };
      }
    }
    return st;
  };
  // recomendación de destinos: dónde hay hoy clubes que pueden ficharte (visibilidad con tus contactos, cupos, edad, permisos y encaje deportivo).
  // Solo lee el mercado (no consume el RNG ni cambia nada); se ordena primero por los clubes de nivel parecido o superior, que son los que de verdad suelen hacer ofertas.
  var recoCache = { key: null, val: null };
  Agents.recommend = function (limit) {
    var S = FP.S, h = S && S.hero; if (!h || !h.agent) return [];
    var cur = h.club != null ? S.clubs[h.club] : null, age = FP.Hero.age(), r = h.rep || {};
    var key = [S.week, h.ovr, r.loc, r.nat, r.int, h.agent.id, h.club, h.tk].join('|');
    if (recoCache.key !== key) {
      var by = {}, a = Agents.current();
      S.clubs.forEach(function (c) {
        if (c === cur || !Rep.exposure(c).ok || h.cd[c.id] > S.week || !Rep.foreignOK(c, h.nat, age) || !Rep.permit(c)) return;
        var f = Rep.fit(c); if (f.kind === 'none' || !f.ok) return;
        var o = by[c.c] || (by[c.c] = { c: c.c, n: 0, up: 0 }); o.n++; if (!cur || c.st >= cur.st - 3) o.up++;
      });
      recoCache.val = Object.keys(by).map(function (c) {
        var ct = a ? a.contacts[c] || 0 : 0, o = by[c];
        return { c: c, name: cname(c), n: o.n, up: o.up, contact: ct >= 0.6 ? 'alta' : ct >= 0.3 ? 'media' : ct > 0 ? 'baja' : 'ninguno' };
      }).sort(function (x, y) { return y.up - x.up || y.n - x.n || x.name.localeCompare(y.name, 'es'); });
      recoCache.key = key;
    }
    return recoCache.val.slice(0, limit || 5);
  };
  // petición puntual de cesión: el mercado de cesiones existente la considera durante 26 semanas (siguen mandando la ventana, el nivel y los cupos)
  Agents.loanRequested = function () { var h = FP.S && FP.S.hero, b = h && h.agb; return !!(b && h.agent && b.loan > FP.S.week); };
  Agents.askLoan = function () {
    var S = FP.S, h = S.hero, c = Agents.canInstruct(); if (!c.ok) return c;
    var b = agb(), C = Agents.CFG.brief, age = FP.Hero.age();
    if (age > 23) return { ok: false, msg: 'Las cesiones están pensadas para jugadores de hasta 23 años.' };
    if (h.tk !== 'pro' && h.tk !== 'academy') return { ok: false, msg: 'Solo puedes pedir una cesión si tienes contrato con un club.' };
    if (S.week - b.ask < C.askEvery) return { ok: false, msg: 'Tu agente ya está en ello: pide esperar ' + (C.askEvery - (S.week - b.ask)) + ' semanas para una nueva petición.' };
    b.ask = S.week;
    var pool = Rep.loanClubs(S.clubs[h.club], age).filter(function (x) { return Rep.exposure(x).ok; });
    if (!pool.length) { say('no ve clubes que ahora te den minutos en cesión: ' + (age < 18 ? 'a tu edad solo se puede ir cedido dentro de tu país' : 'ninguno cumple nivel, cupos y ventana de fichajes') + '.', 'i', false); return { ok: true, msg: 'Pediste una cesión, pero por ahora no hay clubes posibles.' }; }
    b.loan = S.week + C.loanDur; say('buscará una cesión con minutos (' + pool.length + ' clubes posibles). Solo llegará una propuesta si un club la presenta en una ventana de fichajes.', 'ok', true);
    return { ok: true, msg: 'Tu agente buscará una cesión durante ' + C.loanDur + ' semanas.' };
  };
  // petición puntual de renovación: usa la solicitud de contrato existente (K.request) con sus mismos requisitos
  Agents.askRenew = function () {
    var S = FP.S, h = S.hero, c = Agents.canInstruct(); if (!c.ok) return c;
    var b = agb(), C = Agents.CFG.brief;
    if (h.tk !== 'pro' || !h.contract) return { ok: false, msg: 'Solo puedes pedir una renovación si tienes contrato profesional.' };
    if (S.week - b.ask < C.askEvery) return { ok: false, msg: 'Tu agente pide esperar ' + (C.askEvery - (S.week - b.ask)) + ' semanas para una nueva petición.' };
    b.ask = S.week;
    var r = FP.Contracts.request('early'); say(r.ok ? 'abrió la negociación: ' + r.msg : 'sin avances: ' + r.msg, r.ok ? 'ok' : 'i', r.ok);
    return r;
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
  Agents.hire = function (c) { var h = FP.S.hero; h.agent = { nm: c.nm, lvl: c.lvl, com: c.com, id: c.id, since: FP.S.week }; if (h.agb) { h.agb.dest = null; h.agb.prio = null; h.agb.loan = 0; h.agb.tg = []; h.agb.won = []; h.agb.drops = []; } };

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
