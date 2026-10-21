/* FUTPRO — selecciones nacionales por categorías (Sub-15, Sub-17, Sub-20, Sub-23 y adulta):
   plantillas con futbolistas que existen en la simulación, seleccionadores, observación → microciclo →
   preselección → nómina final, amistosos, torneos continentales juveniles, Mundiales Sub-17/Sub-20 y Olímpico.
   Los formatos y cupos siguen los torneos reales (ver README); las convocatorias del jugador compiten con
   los demás candidatos de su generación. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, Comp = FP.Comp, Sim = FP.Sim, Nat = FP.Nat, Youth = FP.Youth;
  var NT = FP.NT = {};

  NT.CATS = ['U15', 'U17', 'U20', 'U23', 'ABS'];
  NT.LIM = { U15: 15, U17: 17, U20: 20, U23: 23, ABS: 99 };
  NT.LABEL = { U15: 'Sub-15', U17: 'Sub-17', U20: 'Sub-20', U23: 'Sub-23', ABS: 'Absoluta' };
  NT.FROM_LABEL = { 'Sub-15': 'U15', 'Sub-17': 'U17', 'Sub-20': 'U20', 'Sub-23': 'U23', 'Absoluta': 'ABS' };
  var K = { U15: 0.80, U17: 0.86, U20: 0.92, U23: 0.96, ABS: 1 };       // fuerza de la categoría respecto de la absoluta
  var SQN = { U15: 23, U17: 23, U20: 23, U23: 23, ABS: 26 };
  // cupos por posición de una nómina de 23
  var QUOTA = { GK: 3, CB: 4, LB: 2, RB: 2, DM: 2, CM: 2, AM: 2, LW: 2, RW: 2, ST: 2 };

  // ---------- estado ----------
  NT.ensure = function () {
    var S = FP.S; if (!S) return;
    Youth.ensure();
    if (!S.nt) S.nt = { v: 1, coach: {}, sq: {}, ref: {}, hist: [], tours: [], made: {}, wk: {} };
    var h = S.hero; if (h && !h.nts) h.nts = { c: {}, act: null, ev: [] };
    return S.nt;
  };
  function key(natId, cat) { return natId + '|' + cat; }
  NT.natOf = function (code) { return Nat.byCode(code); };
  NT.catAge = function (age) { return age; };

  // ---------- seleccionadores ----------
  NT.coach = function (natId, cat) {
    var S = FP.S, st = NT.ensure(), k = key(natId, cat), c = st.coach[k];
    if (!c || (S.week - c.w > 52 * 5 && R() < 0.02)) {
      var nat = S.nat[natId - 5000], r = U.mulberry(U.hash(S.seed, k, c ? c.w : 0, 'dt'));
      c = st.coach[k] = { nm: FP.Names.gen(nat.c, r), w: S.week, pot: 0.6 + r() * 0.8, vet: (r() - 0.5) * 1.6, form: 0.4 + r() * 0.9, loy: r() };
    }
    return c;
  };

  // ---------- candidatos ----------
  var idxW = -1, idx = null;
  // Índice por nacionalidad y año de nacimiento (se reconstruye una vez por semana de uso)
  function index() {
    var S = FP.S;
    if (idx && S.week - idxW < 8 && S.week >= idxW && idx.S === S) return idx;
    idx = { S: S, by: {}, cc: {}, ccw: {}, abs: {} }; idxW = S.week;
    for (var i = 1; i < S.pl.length; i++) {
      var p = S.pl[i]; if (!p || p.c === -2 || (p.c === -1 && p.o < 40)) continue;
      var e = idx.by[p.nat] || (idx.by[p.nat] = { all: [], y: {} });
      e.all.push(p); var by = D.year(p.b); (e.y[by] || (e.y[by] = [])).push(p);
    }
    return idx;
  }
  NT.invalidate = function () { idxW = -1; };
  NT.eligible = function (p, cat, w) {
    w = w == null ? FP.S.week : w;
    var y = D.year(w), by = D.year(p.b), age = C.age(p, w);
    if (cat === 'ABS') return age >= 17 && p.c >= 0;
    if (y - by > NT.LIM[cat]) return false;
    return age >= (cat === 'U15' ? 12 : cat === 'U17' ? 13 : cat === 'U20' ? 15 : 17) && !(p.inj > 5);
  };
  var UEFA_U20 = 19;     // en Europa la categoría "Sub-20" corresponde a la Eurocopa Sub-19
  NT.limitFor = function (cat, nat) { return cat === 'U20' && nat && nat.conf === 'UEFA' ? UEFA_U20 : NT.LIM[cat]; };
  var MINAGE = { U15: 12, U17: 13, U20: 15, U23: 17 };
  NT.candidates = function (natId, cat, w) {
    var S = FP.S, nat = S.nat[natId - 5000], ix = index(), e = ix.by[nat.c]; if (!e) return [];
    w = w == null ? S.week : w;
    var ck = nat.c + '|' + cat; if (ix.cc[ck] && ix.ccw[ck] === S.week) return ix.cc[ck];
    var out = [], i, p;
    if (cat === 'ABS') {
      var arr = ix.abs[nat.c];
      if (!arr) arr = ix.abs[nat.c] = e.all.filter(function (q) { return q.c >= 0; }).sort(function (a, b) { return b.o - a.o; }).slice(0, 160);
      for (i = 0; i < arr.length; i++) { p = arr[i]; if (C.age(p, w) >= 17 && !(p.inj > 6)) out.push(p); }
    } else {
      var y = D.year(w), lim = NT.limitFor(cat, nat), minA = MINAGE[cat];
      for (var by = y - lim; by <= y - 8; by++) {
        var bucket = e.y[by]; if (!bucket) continue;
        for (i = 0; i < bucket.length; i++) { p = bucket[i]; if (!p || p.c === -2) continue; if (C.age(p, w) < minA || (p.c === -1 && p.o < 42) || p.inj > 6) continue; out.push(p); }
      }
      if (out.length > 170) { out.sort(function (a, b) { return (b.o + (b.pt - b.o) * 0.3) - (a.o + (a.pt - a.o) * 0.3); }); out.length = 170; }
    }
    ix.ccw[ck] = S.week;
    return (ix.cc[ck] = out);
  };

  // ---------- evaluación de un futbolista por el seleccionador ----------
  function noise(coach, id) { var sd = coach.sd || (coach.sd = U.hash(coach.nm) | 1); return (((Math.imul(id + 7919, 2654435761) ^ sd) >>> 0) % 1000) / 500 - 1; }
  NT.score = function (p, cat, coach, w) {
    var S = FP.S, age = C.age(p, w), ov = p.o, pt = p.pt || p.o;
    var potW = ({ U15: 0.45, U17: 0.35, U20: 0.22, U23: 0.12, ABS: 0.03 }[cat]) * coach.pot;
    var s = ov + potW * Math.max(0, pt - ov);
    if (p.c >= 0 && S.clubs[p.c]) s += U.clamp((S.clubs[p.c].st - 55) * 0.05, -1.5, 2.5);   // jugar en un club fuerte pesa
    if (p.pm != null) s += (p.pm - 0.6) * 3;                                                // minutos disputados
    s += coach.vet * 0.4 * (age - (NT.LIM[cat] > 30 ? 25 : NT.LIM[cat] - 1.5));
    s += noise(coach, p.i) * 1.3;
    return s;
  };
  // Referencia del nivel de la reserva (para ubicar al jugador frente a su generación)
  NT.heroScore = function (cat, coach, w) {
    var S = FP.S, h = S.hero, age = FP.Hero.age(), M = FP.Market, pe = M.potEst();
    var potW = ({ U15: 0.45, U17: 0.35, U20: 0.22, U23: 0.12, ABS: 0.03 }[cat]) * coach.pot;
    var o = h.ovr + (h.form - 50) * 0.03;
    var s = o + potW * Math.max(0, pe - h.ovr);
    // nivel competitivo del equipo donde juega y rendimiento reciente
    var lvl = h.tk === 'pro' || h.tk === 'loan' ? S.clubs[h.team].st : h.tk === 'academy' ? Youth.levelFor(h.team, age) : h.tk === 'amat' ? Youth.levelFor(h.team, age) : 40;
    var ref = Youth.natLevel(h.nat) * (cat === 'ABS' ? 1 : Youth.f(Math.min(age, 19)));
    s += U.clamp((lvl - ref) * 0.08, -4, 2.5);
    var ss = h.season; if (ss.ap >= 4 && ss.rn >= 3) s += U.clamp((ss.rs / ss.rn - 6.4) * 2, -1.5, 2);
    s += U.clamp(h.nts && h.nts.rate != null ? (h.nts.rate - 0.5) * 2 : 0, -1, 1);
    s -= (cat === 'ABS' ? Youth.adultPenalty(age) : 0);
    s += noise(coach, 0) * 1.3;
    return s;
  };

  // ---------- visibilidad del jugador ante las selecciones ----------
  NT.visibility = function () {
    var S = FP.S, h = S.hero, v = 0.1;
    if (h.tk === 'pro' || h.tk === 'loan') { var t = FP.LGDEF[S.clubs[h.team].lg].t; v = t === 1 ? 0.95 : t === 2 ? 0.8 : 0.62; }
    else if (h.tk === 'academy') { var t2 = FP.LGDEF[S.clubs[h.club].lg].t; v = t2 === 1 ? 0.8 : t2 === 2 ? 0.55 : 0.38; }
    else if (h.tk === 'amat') v = Youth.TIERS[Youth.tierOf(S.amat[h.team - 20000])].vis * 0.5;
    else v = 0.08;
    var ss = h.season; if (ss.ap >= 5) v += U.clamp(ss.g / ss.ap * 0.25, 0, 0.3);
    if (h.rep) v += h.rep.nat / 250;
    return U.clamp(v, 0.02, 1);
  };

  // ---------- preselección y nómina por categoría ----------
  function needsList() { var a = []; Object.keys(QUOTA).forEach(function (p) { for (var i = 0; i < QUOTA[p]; i++) a.push(p); }); return a; }
  // Elige n jugadores respetando cupos por posición. cand: [{p, sc}] ordenados no necesariamente.
  NT.pickSquad = function (cand, n) {
    var by = {}, out = [], used = {};
    cand.forEach(function (e) { (by[e.p.p] || (by[e.p.p] = [])).push(e); });
    Object.keys(by).forEach(function (k) { by[k].sort(function (a, b) { return b.sc - a.sc; }); });
    var q = {}; Object.keys(QUOTA).forEach(function (k) { q[k] = Math.round(QUOTA[k] * n / 23); });
    Object.keys(q).forEach(function (k) { (by[k] || []).slice(0, q[k]).forEach(function (e) { out.push(e); used[e.p.i] = 1; }); });
    if (out.length < n) cand.slice().sort(function (a, b) { return b.sc - a.sc; }).forEach(function (e) { if (out.length < n && !used[e.p.i]) { out.push(e); used[e.p.i] = 1; } });
    if (out.length > n) out = out.sort(function (a, b) { return b.sc - a.sc; }).slice(0, n);
    return out;
  };
  // Lista de una selección para una etapa. kind: 'obs' (40) | 'micro' (30) | 'pre' (26) | 'final' (23) | 'friendly' (22)
  var SIZE = { obs: 40, micro: 30, pre: 26, final: 23, friendly: 22 };
  NT.build = function (natId, cat, kind, w, heroIn) {
    var S = FP.S, st = NT.ensure(), coach = NT.coach(natId, cat), cand = NT.candidates(natId, cat, w), h = S.hero;
    var nat = S.nat[natId - 5000], n = cat === 'ABS' ? (kind === 'final' ? 26 : SIZE[kind] + 2) : SIZE[kind];
    var list = cand.map(function (p) { return { p: p, sc: NT.score(p, cat, coach, w) }; });
    var me = null;
    if (heroIn && h && h.nat === nat.c) { me = { p: S.pl[0], sc: NT.heroScore(cat, coach, w), hero: 1 }; list.push(me); }
    var sel = NT.pickSquad(list, n);
    return { sel: sel, hero: me ? sel.indexOf(me) >= 0 : false, heroRank: me ? NT.posRank(list, me) : null, coach: coach, all: list };
  };
  // Posición del jugador entre sus competidores de puesto (1 = el mejor)
  NT.posRank = function (list, me) {
    var same = list.filter(function (e) { return e.p.p === me.p.p; }).sort(function (a, b) { return b.sc - a.sc; });
    return { rank: same.indexOf(me) + 1, of: same.length, quota: QUOTA[me.p.p] || 2 };
  };
  // Guarda la lista vigente de una selección (ids) para alinear jugadores en sus partidos
  NT.setList = function (natId, cat, sel, kind, tour) {
    var st = NT.ensure(), k = key(natId, cat);
    st.sq[k] = { ids: sel.map(function (e) { return e.p.i; }), at: FP.S.week, kind: kind, tour: tour || null };
  };
  NT.squadOf = function (natId, cat) {
    var S = FP.S, st = NT.ensure(), s = st.sq[key(natId, cat)]; if (!s) return [];
    return s.ids.map(function (i) { return S.pl[i]; }).filter(function (p) { return p; });
  };
  var posRankCache = {};
  NT.top11 = function (players, cat) {
    var list = players.map(function (p) { return { p: p, sc: p.i === 0 ? FP.S.hero.ovr : p.o }; });
    var t = Youth.pickTeam(list, '4-3-3');
    return t;
  };
  // Fuerza de un equipo juvenil: base de la selección absoluta ajustada por la calidad real de su plantilla
  NT.strength = function (natId, cat, players) {
    var S = FP.S, st = NT.ensure(), nat = S.nat[natId - 5000], base = (nat.r - 6) * K[cat] - (cat === 'ABS' ? 0 : 2);
    if (cat === 'ABS' || !players || players.length < 11) return base;
    var t = NT.top11(players, cat), m = t.xi.reduce(function (s, x) { return s + x.e.p.o; }, 0) / Math.max(1, t.xi.length), k = key(natId, cat);
    var ref = st.ref[k]; if (ref == null) ref = st.ref[k] = m;
    st.ref[k] = ref * 0.88 + m * 0.12;
    return base + (m - ref) * 0.9;
  };
  // Alineación real para el motor de partidos (jugadores clonados con la media ajustada a la fuerza del equipo)
  NT.lineup = function (natId, comp, heroRole, form) {
    var S = FP.S, cat = comp.cat || (FP.Sel && FP.Sel.mine(natId, 'ABS') ? 'ABS' : null); if (!cat || (cat === 'ABS' && !(FP.Sel && FP.Sel.mine(natId, 'ABS')))) return null;
    var players = NT.squadOf(natId, cat); if (players.length < 14) return null;
    var h = S.hero, ys = comp.ys && comp.ys[natId], list = players.map(function (p) { return { p: p, sc: p.i === 0 ? h.ovr : p.o }; });
    var heroHere = h && !h.retired && h.nat === S.nat[natId - 5000].c;
    var t = Youth.pickTeam(list, form || '4-3-3'), xi = t.xi, mean = xi.reduce(function (s, x) { return s + x.e.p.o; }, 0) / Math.max(1, xi.length);
    var off = ys != null ? ys - mean : 0;
    function clone(p) { return p.i === 0 ? p : { i: p.i, n: p.n, p: p.p, o: Math.round(p.o + off), nat: p.nat, ref: p }; }
    var outXI = xi.map(function (x) { return { p: clone(x.e.p), slot: x.slot }; });
    var bench = t.bench.map(function (e) { return clone(e.p); });
    return { xi: outXI, bench: bench, form: form || '4-3-3', generic: false, team: t };
  };
  // Rol del jugador en un partido de selección: el entrenador alinea al mejor por puesto
  NT.heroRole = function (natId, comp) {
    var S = FP.S, h = S.hero, cat = comp.cat;
    if (!cat) return null;
    var players = NT.squadOf(natId, cat), me = players.indexOf(S.pl[0]);
    if (me < 0) return { role: 'out', why: 'no está en la nómina', p: 0 };
    if (h.inj && h.inj.n > 0) return { role: 'out', why: 'lesionado', p: 0 };
    var coach = NT.coach(natId, cat), w = S.week;
    var list = players.map(function (p) { return { p: p, sc: p.i === 0 ? NT.heroScore(cat, coach, w) : NT.score(p, cat, coach, w) + U.norm() * 0.8 }; });
    var t = Youth.pickTeam(list, '4-3-3'), hero = list.filter(function (e) { return e.p.i === 0; })[0];
    var inXI = t.xi.some(function (x) { return x.e === hero; }), inB = t.bench.indexOf(hero) >= 0;
    var beat = list.filter(function (e) { return e !== hero && e.p.p === h.pos && e.sc > hero.sc; }).length;
    return { role: inXI ? 'starter' : inB ? 'bench' : 'out', why: !inXI && !inB ? 'fuera de la lista' : '', p: inB ? U.clamp(0.6 - beat * 0.1, 0.2, 0.7) : 0.9, rank: beat };
  };

  // ---------- historial por jugador ----------
  NT.addStat = function (p, cat, idxS, v) { var ns = p.ns || (p.ns = {}), a = ns[cat] || (ns[cat] = [0, 0, 0, 0]); a[idxS] += v; };
  NT.scoreGoals = function (comp, natId, goals) {
    if (!goals || !comp.cat) return;
    var players = NT.squadOf(natId, comp.cat); if (players.length < 11) return;
    var list = players.map(function (p) { return { p: p, sc: p.o }; }), t = Youth.pickTeam(list, '4-3-3'), xi = t.xi.map(function (x) { return x.e.p; });
    for (var g = 0; g < goals; g++) {
      var SW = { ST: 10, LW: 6, RW: 6, AM: 5, CM: 2.4, DM: 1, LB: 1, RB: 1, CB: 1.3, GK: 0.02 };
      var sc = U.wpick(xi, function (p) { return (SW[p.p] || 1) * Math.pow(Math.max(20, p.o) / 60, 4); });
      FP.Match.addSc(comp, sc, natId, 0);
      if (R() < 0.7) { var as = U.wpick(xi, function (p) { return p === sc ? 0 : Math.pow(Math.max(20, p.o) / 60, 3) * (p.p === 'GK' ? 0.05 : 1); }); if (as !== sc) FP.Match.addSc(comp, as, natId, 1); }
    }
  };
  // Apariciones y minutos de la plantilla tras un partido (el jugador del usuario se registra aparte)
  NT.appearances = function (comp, f) {
    if (!comp.cat) return;
    [f.h, f.a].forEach(function (id) {
      var players = NT.squadOf(id, comp.cat); if (players.length < 11) return;
      var list = players.map(function (p) { return { p: p, sc: p.o }; }), t = Youth.pickTeam(list, '4-3-3');
      t.xi.forEach(function (x) { if (x.e.p.i === 0) return; NT.addStat(x.e.p, comp.cat, 0, 1); NT.addStat(x.e.p, comp.cat, 1, 60 + Math.floor(R() * 31)); });
      t.bench.slice(0, 4).forEach(function (e) { if (e.p.i === 0 || R() > 0.55) return; NT.addStat(e.p, comp.cat, 0, 1); NT.addStat(e.p, comp.cat, 1, 8 + Math.floor(R() * 25)); });
    });
  };
  FP.Hooks = FP.Hooks || {};
  var prevHook = FP.Hooks.onFixture;
  FP.Hooks.onFixture = function (comp, f) { if (prevHook) prevHook(comp, f); if (comp.cat && comp.nat) NT.appearances(comp, f); };

  // ---------- torneos ----------
  // g: grupos | k: equipos que pasan a eliminatorias (8 = cuartos, 4 = semifinales, 16, 32) | t: 'hexa' (seis finalistas) o 'rr4' (cuatro)
  var TD = {
    SA15: { nm: 'Campeonato Sudamericano Sub-15', cat: 'U15', conf: 'CONMEBOL', size: 10, g: 2, k: 4, ev: function (y) { return y % 2 === 0; }, m: 9, d: 5, v: 'v', note: 'Formato 2024 (Bolivia): dos grupos de cinco, semifinales y final.' },
    SA17: { nm: 'Campeonato Sudamericano Sub-17', cat: 'U17', conf: 'CONMEBOL', size: 10, g: 2, k: 4, ev: function () { return true; }, m: 2, d: 27, slots: { WU17: 7 }, v: 'v', note: 'Formato 2025 (Colombia): dos grupos de cinco, semifinales; siete cupos al Mundial.' },
    SA20: { nm: 'Campeonato Sudamericano Sub-20', cat: 'U20', conf: 'CONMEBOL', size: 10, g: 2, t: 'hexa', ev: function (y) { return y % 2 === 1; }, m: 0, d: 20, slots: { WU20: 4 }, v: 'v', note: 'Formato 2025 (Venezuela): dos grupos de cinco, hexagonal final; cuatro cupos al Mundial.' },
    PREOL: { nm: 'Preolímpico Sudamericano Sub-23', cat: 'U23', conf: 'CONMEBOL', size: 10, g: 2, t: 'rr4', ev: function (y) { return y % 4 === 0; }, m: 0, d: 20, slots: { OLY: 2 }, v: 'v', note: 'Formato 2024: dos grupos de cinco, cuadrangular final; dos cupos olímpicos.' },
    EU17: { nm: 'Eurocopa Sub-17', cat: 'U17', conf: 'UEFA', size: 16, g: 4, k: 8, ev: function () { return true; }, m: 4, d: 5, slots: { WU17: 11 }, v: 'e', note: 'Formato clásico de 16 selecciones (la UEFA lo reforma desde 2024/25).' },
    EU19: { nm: 'Eurocopa Sub-19', cat: 'U20', conf: 'UEFA', size: 8, g: 2, k: 4, ev: function () { return true; }, m: 6, d: 1, slots: { WU20: 5 }, v: 'e', note: 'Ocho finalistas; categoría "Sub-20" europea.' },
    EU21: { nm: 'Eurocopa Sub-21', cat: 'U23', conf: 'UEFA', size: 16, g: 4, k: 8, ev: function (y) { return y % 2 === 1; }, m: 5, d: 15, slots: { OLY: 3 }, v: 'e', note: 'Clasifica para el torneo olímpico del año siguiente.' },
    AS17: { nm: 'Copa Asiática Sub-17', cat: 'U17', conf: 'AFC', size: 12, g: 3, k: 8, ev: function () { return true; }, m: 3, d: 7, slots: { WU17: 9 }, v: 'e', note: 'Adaptada al número de selecciones asiáticas cargadas.' },
    AS20: { nm: 'Copa Asiática Sub-20', cat: 'U20', conf: 'AFC', size: 12, g: 3, k: 8, ev: function (y) { return y % 2 === 1; }, m: 1, d: 12, slots: { WU20: 4 }, v: 'e', note: 'Adaptada al número de selecciones asiáticas cargadas.' },
    AS23: { nm: 'Copa Asiática Sub-23', cat: 'U23', conf: 'AFC', size: 12, g: 3, k: 8, ev: function (y) { return y % 2 === 0; }, m: 0, d: 6, slots: { OLY: 3 }, v: 'e', note: 'En año olímpico es la clasificación asiática.' },
    AF17: { nm: 'Copa Africana Sub-17', cat: 'U17', conf: 'CAF', size: 12, g: 3, k: 8, ev: function () { return true; }, m: 3, d: 20, slots: { WU17: 10 }, v: 'e', note: 'Adaptada al número de selecciones africanas cargadas.' },
    AF20: { nm: 'Copa Africana Sub-20', cat: 'U20', conf: 'CAF', size: 12, g: 3, k: 8, ev: function (y) { return y % 2 === 1; }, m: 3, d: 27, slots: { WU20: 4 }, v: 'e', note: 'Adaptada al número de selecciones africanas cargadas.' },
    AF23: { nm: 'Copa Africana Sub-23', cat: 'U23', conf: 'CAF', size: 12, g: 3, k: 8, ev: function (y) { return y % 4 === 3; }, m: 5, d: 10, slots: { OLY: 3 }, v: 'e', note: 'Clasifica para el torneo olímpico del año siguiente.' },
    CC17: { nm: 'Campeonato Concacaf Sub-17', cat: 'U17', conf: 'CONCACAF', size: 10, g: 2, k: 4, ev: function () { return true; }, m: 1, d: 3, slots: { WU17: 8 }, v: 'e', note: 'Adaptado: en la realidad son ocho grupos de ~4 selecciones.' },
    CC20: { nm: 'Campeonato Concacaf Sub-20', cat: 'U20', conf: 'CONCACAF', size: 10, g: 2, k: 4, ev: function (y) { return y % 2 === 0; }, m: 2, d: 10, slots: { WU20: 4 }, v: 'e', note: 'Se disputa el año previo al Mundial Sub-20.' },
    CC23: { nm: 'Preolímpico Concacaf', cat: 'U23', conf: 'CONCACAF', size: 10, g: 2, k: 4, ev: function (y) { return y % 4 === 0; }, m: 2, d: 15, slots: { OLY: 2 }, v: 'e', note: 'Clasificación olímpica de la Concacaf.' },
    OC17: { nm: 'Copa de Naciones OFC Sub-17', cat: 'U17', conf: 'OFC', size: 3, g: 1, k: 0, ev: function () { return true; }, m: 1, d: 17, slots: { WU17: 3 }, v: 'e', note: 'Pocas selecciones: todos contra todos.' },
    OC20: { nm: 'Copa de Naciones OFC Sub-20', cat: 'U20', conf: 'OFC', size: 3, g: 1, k: 0, ev: function (y) { return y % 2 === 0; }, m: 6, d: 20, slots: { WU20: 2 }, v: 'e', note: 'Pocas selecciones: todos contra todos.' },
    OC23: { nm: 'Preolímpico OFC', cat: 'U23', conf: 'OFC', size: 3, g: 1, k: 0, ev: function (y) { return y % 4 === 0; }, m: 2, d: 22, slots: { OLY: 1 }, v: 'e', note: 'Un cupo olímpico.' },
    WU17: { nm: 'Copa Mundial Sub-17 de la FIFA', cat: 'U17', conf: null, size: 48, g: 12, k: 32, ev: function () { return true; }, m: 10, d: 3, world: 1, hosts: { AFC: 'QAT' }, v: 'v', note: '48 selecciones, 12 grupos de cuatro; avanzan los dos primeros y los ocho mejores terceros (desde 2025, anual, Catar).' },
    WU20: { nm: 'Copa Mundial Sub-20 de la FIFA', cat: 'U20', conf: null, size: 24, g: 6, k: 16, ev: function (y) { return y % 2 === 1; }, m: 8, d: 27, world: 1, v: 'v', note: '24 selecciones, seis grupos de cuatro; avanzan los dos primeros y los cuatro mejores terceros.' },
    OLY: { nm: 'Torneo Olímpico de Fútbol Sub-23', cat: 'U23', conf: null, size: 16, g: 4, k: 8, ev: function (y) { return y % 4 === 0; }, m: 6, d: 19, world: 1, v: 'e', note: '16 selecciones (Sub-23); se simplifica sin los tres jugadores mayores permitidos.' }
  };
  NT.TD = TD;
  var SLOTS_WU17 = { UEFA: 11, CAF: 10, AFC: 9, CONCACAF: 8, CONMEBOL: 7, OFC: 3 }, SLOTS_WU20 = { UEFA: 5, CONMEBOL: 5, AFC: 4, CAF: 4, CONCACAF: 4, OFC: 2 }, SLOTS_OLY = { UEFA: 3, AFC: 3, CAF: 3, CONMEBOL: 2, CONCACAF: 2, OFC: 1 };
  var WSLOTS = { WU17: SLOTS_WU17, WU20: SLOTS_WU20, OLY: SLOTS_OLY };

  NT.regStrength = function (natId, cat) {   // fuerza de referencia (sin plantilla) para sorteos y clasificación por nivel
    var S = FP.S, nat = S.nat[natId - 5000];
    return (nat.r - 6) * K[cat] + U.norm() * 2.5;
  };

  // Programa las ediciones de un año (se llama cada enero y al iniciar el mundo)
  NT.schedule = function (y) {
    var S = FP.S, st = NT.ensure();
    Object.keys(TD).forEach(function (k) {
      var d = TD[k]; if (!d.ev(y)) return;
      var id = 'T:' + k + ':' + y; if (st.made[id]) return;
      var s0 = D.of(y, d.m, d.d);
      if (s0 < S.week - 2) { st.made[id] = 1; return; }
      st.made[id] = 1;
      st.tours.push({ key: k, y: y, s0: s0, id: id, stage: 'plan', cat: d.cat });
    });
    st.tours.sort(function (a, b) { return a.s0 - b.s0; });
  };

  // Entrantes de una edición
  NT.entrants = function (d, y) {
    var S = FP.S, st = NT.ensure(), pool;
    if (!d.world) {
      pool = S.nat.filter(function (n) { return n.conf === d.conf; }).map(function (n) { return { id: n.id, v: NT.regStrength(n.id, d.cat) }; }).sort(function (a, b) { return b.v - a.v; });
      return pool.slice(0, d.size).map(function (x) { return x.id; });
    }
    var key0 = d.cat === 'U17' ? 'WU17' : d.cat === 'U20' ? 'WU20' : 'OLY', slots = WSLOTS[key0], out = [], used = {};
    var NOLY = { ENG: 1, SCO: 1, WAL: 1 };      // el Reino Unido no participa con selecciones separadas en los Juegos
    Object.keys(slots).forEach(function (cf) {
      var ranked = NT.qualFrom(key0, cf, y).filter(function (id) { return key0 !== 'OLY' || !NOLY[S.nat[id - 5000].c]; }), host = d.hosts && d.hosts[cf] ? Nat.byCode(d.hosts[cf]) : null;
      if (host && ranked.indexOf(host.id) < 0) ranked.unshift(host.id);
      ranked.slice(0, slots[cf]).forEach(function (id) { if (!used[id]) { out.push(id); used[id] = 1; } });
    });
    var rest = S.nat.filter(function (n) { return !used[n.id] && !(key0 === 'OLY' && NOLY[n.c]); }).map(function (n) { return { id: n.id, v: NT.regStrength(n.id, d.cat) }; }).sort(function (a, b) { return b.v - a.v; });
    while (out.length < d.size && rest.length) out.push(rest.shift().id);
    return out.slice(0, d.size);
  };
  // Clasificados de una confederación: ranking del torneo continental correspondiente (el más reciente) o nivel
  NT.qualFrom = function (wkey, cf, y) {
    var S = FP.S, st = NT.ensure(), best = null;
    Object.keys(TD).forEach(function (k) { var d = TD[k]; if (d.conf === cf && d.slots && d.slots[wkey] != null) { for (var yy = y; yy >= y - 2; yy--) { var r = st.res && st.res[k + ':' + yy]; if (r && (!best || yy > best.y)) best = { y: yy, r: r.rank }; } } });
    if (best) {
      var all = S.nat.filter(function (n) { return n.conf === cf; }).map(function (n) { return n.id; });
      var rest = all.filter(function (id) { return best.r.indexOf(id) < 0; }).sort(function (a, b) { return S.nat[b - 5000].r - S.nat[a - 5000].r; });
      return best.r.concat(rest);
    }
    var cat = wkey === 'WU17' ? 'U17' : wkey === 'WU20' ? 'U20' : 'U23';
    return S.nat.filter(function (n) { return n.conf === cf; }).map(function (n) { return { id: n.id, v: NT.regStrength(n.id, cat) }; }).sort(function (a, b) { return b.v - a.v; }).map(function (x) { return x.id; });
  };
  function splitGroups(ids, ng) {
    var groups = []; for (var i = 0; i < ng; i++) groups.push([]);
    ids.forEach(function (id, i) { var row = Math.floor(i / ng); groups[row % 2 ? ng - 1 - (i % ng) : i % ng].push(id); });
    return groups;
  }
  // Crea la competición de una edición (los equipos fijan su fuerza al cerrar las nóminas)
  NT.create = function (tour) {
    var S = FP.S, d = TD[tour.key], y = tour.y, st = NT.ensure();
    var ids = NT.entrants(d, y), ord = ids.slice().sort(function (a, b) { return S.nat[b - 5000].r - S.nat[a - 5000].r; });
    var comp = Comp.create({ id: tour.id, kind: 'T', nm: d.nm, y: y, teams: ids, c: null });
    comp.cat = d.cat; comp.nat = true; comp.spec = tour.key; comp.label = String(y); comp.stage = 'lp'; comp.st = 0; comp.ys = {}; comp.s0 = tour.s0; comp.tk = tour.key;
    ids.forEach(function (id) { comp.ys[id] = NT.strength(id, d.cat, null); });
    var groups = splitGroups(ord, d.g);
    comp.groups = groups; Comp.resetTable(comp);
    var per = 2;                                       // dos fechas por semana
    groups.forEach(function (gr, gi) { Comp.roundRobin(gr, false).forEach(function (rd, r) { rd.forEach(function (m) { Comp.addFx(comp, m[0], m[1], tour.s0 + Math.floor(r / per), { r: r + 1, g: gi, n: 1 }); }); }); });
    comp.fx.sort(function (a, b) { return a.w - b.w; });
    comp.w0 = tour.s0; comp.w1 = tour.s0 + 8; comp.rankDone = false;
    if (d.world) Sim.news('Comienza la ' + d.nm + ' ' + y + '.', 'title', 3);
    else if (S.hero && S.hero.nat && FP.NATBY[S.hero.nat] && FP.NATBY[S.hero.nat].conf === d.conf) Sim.news('Comienza el ' + d.nm + ' ' + y + '.', 'title', 2);
    return comp;
  };
  function allDone(comp) { for (var i = comp.cp; i < comp.fx.length; i++) if (!comp.fx[i].d) return false; return true; }
  function groupRows(comp, gi) { return Comp.rows(comp, comp.groups[gi]); }
  // Avance de un torneo juvenil: fase de grupos → (hexagonal | cuadrangular | eliminatorias)
  Sim.handlers.T = function (comp, w) {
    var S = FP.S, d = TD[comp.tk], st = NT.ensure();
    if (comp.done) return;
    if (comp.stage === 'lp') {
      if (!allDone(comp)) return;
      var gr = comp.groups.map(function (g, gi) { return groupRows(comp, gi); });
      comp.gr = gr.map(function (g) { return g.map(function (r) { return r.id; }); });
      comp.gtab = gr;
      if (d.g === 1) { comp.rank = gr[0].map(function (r) { return r.id; }); return NT.close(comp); }
      if (d.t === 'hexa' || d.t === 'rr4') {
        var top = d.t === 'hexa' ? 3 : 2, fin = [];
        gr.forEach(function (rows) { rows.slice(0, top).forEach(function (r) { fin.push(r.id); }); });
        comp.out = [];
        gr.forEach(function (rows) { rows.slice(top).forEach(function (r) { comp.out.push(r); }); });
        comp.stage = 'fin'; comp.st++;
        var base = w + 1, rds = Comp.roundRobin(fin, false);
        comp.ftab = fin;
        comp.tb2 = {}; fin.forEach(function (t) { comp.tb2[t] = [0, 0, 0, 0, 0, 0, 0]; });
        rds.forEach(function (rd, r) { rd.forEach(function (m) { Comp.addFx(comp, m[0], m[1], base + Math.floor(r / 2), { r: r + 1, n: 1 }); }); });
        comp.fx.sort(function (a, b) { return a.w - b.w; });
        return;
      }
      // eliminatorias: dos primeros de cada grupo + mejores terceros hasta completar k
      var q = [], thirds = [];
      gr.forEach(function (rows, gi) { q.push({ id: rows[0].id, p: 0, pts: rows[0].pts, gd: rows[0].gd, gf: rows[0].gf }); if (rows[1]) q.push({ id: rows[1].id, p: 1, pts: rows[1].pts, gd: rows[1].gd, gf: rows[1].gf }); if (rows[2]) thirds.push({ id: rows[2].id, p: 2, pts: rows[2].pts, gd: rows[2].gd, gf: rows[2].gf }); });
      thirds.sort(function (a, b) { return b.pts - a.pts || b.gd - a.gd || b.gf - a.gf; });
      var need = d.k - q.length, all = q.concat(thirds.slice(0, Math.max(0, need)));
      comp.elim = {}; gr.forEach(function (rows) { rows.forEach(function (r) { comp.elim[r.id] = r; }); });
      all.sort(function (a, b) { return a.p - b.p || b.pts - a.pts || b.gd - a.gd || b.gf - a.gf; });
      var n = all.length, size = 2; while (size < n) size *= 2;
      var ord = Comp.bracketOrder(size), slots = ord.map(function (s) { return s <= n ? all[s - 1].id : null; });
      comp.stage = 'ko'; comp.st++;
      var kk = Math.log2(size), W = []; for (var i = 0; i < kk; i++) W.push(w + 1 + i);
      Comp.koInit(comp, [], { slots: slots, legs: 1, finalLegs: 1, weeks: W, neutralFinal: false });
      comp.fx.forEach(function (f) { if (f.k) f.n = 1; });
      return;
    }
    if (comp.stage === 'fin') {
      if (!allDone(comp)) return;
      var rows2 = NT.finalRows(comp);
      comp.fin = rows2.map(function (r) { return r.id; }); comp.ftab2 = rows2;
      comp.champ = rows2[0].id; comp.runner = rows2[1].id;
      var out = comp.out.slice().sort(function (a, b) { return b.pts - a.pts || b.gd - a.gd || b.gf - a.gf; }).map(function (r) { return r.id; });
      comp.rank = comp.fin.concat(out);
      return NT.close(comp);
    }
    if (comp.stage === 'ko') {
      comp.fx.forEach(function (f) { if (f.k && f.n == null) f.n = 1; });
      var r = Comp.koAdvance(comp, w);
      if (r === 'end') {
        var order = [comp.champ, comp.runner], seen = {}; order.forEach(function (id) { seen[id] = 1; });
        var kos = (comp.kh || []).concat([comp.ko]), losers = [];
        for (var ri = comp.ko.rounds.length - 1; ri >= 0; ri--) {
          var rd = comp.ko.rounds[ri], ls = [];
          rd.ties.forEach(function (t) { var l = t.win === t.a ? t.b : t.a; if (l != null && !seen[l]) { ls.push(l); seen[l] = 1; } });
          ls.sort(function (a, b) { var A = comp.elim[a] || { pts: 0, gd: 0 }, B = comp.elim[b] || { pts: 0, gd: 0 }; return B.pts - A.pts || B.gd - A.gd; });
          order = order.concat(ls);
        }
        var rest = comp.teams.filter(function (id) { return !seen[id]; }).map(function (id) { return comp.elim[id] || { id: id, pts: 0, gd: 0 }; });
        rest.forEach(function (r2) { r2.id = r2.id; });
        rest.sort(function (a, b) { return b.pts - a.pts || b.gd - a.gd; });
        comp.rank = order.concat(rest.map(function (x) { return x.id; }));
        NT.close(comp);
      }
    }
  };
  // Tabla de la fase final (hexagonal / cuadrangular) calculada desde los partidos de esa fase
  NT.finalRows = function (comp) {
    var t = {}; (comp.ftab || []).forEach(function (id) { t[id] = [0, 0, 0, 0, 0, 0, 0]; });
    comp.fx.forEach(function (f) {
      if (f.st !== 1 || !f.d || !t[f.h] || !t[f.a]) return;
      var a = t[f.h], b = t[f.a]; a[0]++; b[0]++; a[4] += f.hs; a[5] += f.as; b[4] += f.as; b[5] += f.hs;
      if (f.hs > f.as) { a[1]++; b[3]++; a[6] += 3; } else if (f.hs < f.as) { b[1]++; a[3]++; b[6] += 3; } else { a[2]++; b[2]++; a[6]++; b[6]++; }
    });
    return Comp.rows({ tb: t }, comp.ftab || []);
  };
  // Cierre: campeón, ranking, goleadores, historial y bonificación mínima al nivel de las selecciones
  NT.close = function (comp) {
    var S = FP.S, st = NT.ensure(), d = TD[comp.tk];
    comp.done = true;
    if (comp.champ == null) { comp.champ = comp.rank[0]; comp.runner = comp.rank[1]; }
    st.res = st.res || {}; st.res[comp.tk + ':' + comp.y] = { rank: comp.rank.slice(0, d.size) };
    var sc = Comp.topScorers(comp, 5, 0).map(function (e) { return { n: e.n, g: e.g, a: e.a, t: e.c, pid: e.pid }; });
    var third = comp.rank[2];
    st.hist.push({ k: comp.tk, cat: d.cat, y: comp.label, ch: comp.champ, ru: comp.runner, th: third, sc: sc, w: S.week, world: d.world ? 1 : 0, name: d.nm });
    if (st.hist.length > 400) st.hist.splice(0, 80);
    var h = S.hero, nat = h ? Nat.byCode(h.nat) : null, ch = S.nat[comp.champ - 5000];
    Sim.news(ch.nm + ' (' + NT.LABEL[d.cat] + ') se corona campeón en ' + d.nm + ' ' + comp.label + '.', 'title', d.world ? 3 : 2);
    if (h && !h.retired && h.nts && h.nts.act && h.nts.act.comp === comp.id) {
      var act = h.nts.act;
      if (comp.champ === act.nat) { h.trophies.push({ y: comp.label, nm: 'Campeón · ' + d.nm, club: ch.nm, w: S.week, nt: 1, cat: d.cat }); FP.Hero.msg('¡Campeón con la selección ' + NT.LABEL[d.cat] + ' de ' + ch.nm + ' en ' + d.nm + '!', 'ok'); }
      else if (comp.runner === act.nat) { h.trophies.push({ y: comp.label, nm: 'Subcampeón · ' + d.nm, club: S.nat[act.nat - 5000].nm, w: S.week, nt: 1, sub: 1, cat: d.cat }); FP.Hero.msg('Subcampeón con la selección ' + NT.LABEL[d.cat] + ' en ' + d.nm + '.', 'i'); }
      else FP.Hero.msg('Terminó ' + d.nm + ' ' + comp.label + ': la selección quedó en el puesto ' + (comp.rank.indexOf(act.nat) + 1) + '.', 'i');
      var best = Comp.topScorers(comp, 1, 0)[0];
      if (best && best.pid === 0) h.awards.push({ y: comp.label, nm: 'Goleador · ' + d.nm, w: S.week });
      h.nts.act = null;
    }
    if (nat && nat.conf && d.conf === nat.conf || d.world) {
      var q = d.slots ? Object.keys(d.slots) : [];
      if (h && nat && d.slots && d.cat !== 'U15') { var slots = d.slots; var wk = Object.keys(slots)[0]; if (comp.rank.indexOf(nat.id) >= 0 && comp.rank.indexOf(nat.id) < slots[wk]) Sim.news(nat.nm + ' (' + NT.LABEL[d.cat] + ') clasifica al ' + (wk === 'OLY' ? 'torneo olímpico' : 'Mundial ' + NT.LABEL[d.cat]) + '.', 'title', 2); }
    }
    // el nivel de la selección absoluta se mueve muy poco con los resultados juveniles
    if (d.world) { var nn = S.nat[comp.champ - 5000]; nn.r = Math.min(95, nn.r + 0.15); }
  };

  // ---------- amistosos internacionales juveniles ----------
  NT.friendlies = function (w) {
    var S = FP.S, st = NT.ensure(), y = D.year(w);
    ['U15', 'U17', 'U20', 'U23'].forEach(function (cat) {
      if (S.week > 0 && false) return;
      var ids = S.nat.map(function (n) { return n.id; });
      U.shuffle(ids);
      // se empareja por nivel parecido y se evita enfrentar a una selección consigo misma
      var sorted = ids.map(function (id) { return { id: id, v: S.nat[id - 5000].r + U.norm() * 6 }; }).sort(function (a, b) { return b.v - a.v; }).map(function (x) { return x.id; });
      var comp = Comp.create({ id: 'N:' + cat + ':' + w, kind: 'N', nm: 'Amistosos internacionales ' + NT.LABEL[cat], y: y, teams: sorted.slice(), c: null });
      comp.cat = cat; comp.nat = true; comp.ys = {}; comp.stages = [{ k: 'fr' }]; comp.friendly = 1; comp.label = String(y);
      sorted.forEach(function (id) { comp.ys[id] = NT.strength(id, cat, NT.squadOf(id, cat)); });
      for (var i = 0; i + 1 < sorted.length; i += 2) {
        var a = sorted[i], b = sorted[i + 1]; if (a === b) continue;
        var home = R() < 0.5; Comp.addFx(comp, home ? a : b, home ? b : a, w + 1, { fr: 1 });
      }
      comp.w0 = w + 1; comp.w1 = w + 2;
    });
  };
  Sim.handlers.N = function (comp, w) {
    var S = FP.S; if (comp.friendly && !Comp.pendingLeft(comp) && w > comp.w1) { var st = NT.ensure(); delete S.comps[comp.id]; return; }
    if (!comp.friendly && !Comp.pendingLeft(comp) && comp.fx.length && w > comp.fx[comp.fx.length - 1].w + 1) delete S.comps[comp.id];
  };

  // ---------- ciclo semanal ----------
  var D_OBS = 14, D_MICRO = 9, D_PRE = 4, D_FIN = 2;
  NT.weekly = function (w) {
    var S = FP.S, st = NT.ensure(), ymd = D.ymd(w);
    if (ymd[1] === 0 && ymd[2] <= 7 && !st.wk['sch' + ymd[0]]) { st.wk['sch' + ymd[0]] = 1; NT.schedule(ymd[0]); NT.schedule(ymd[0] + 1); }
    if (!st.wk.init) { st.wk.init = 1; NT.schedule(ymd[0]); NT.schedule(ymd[0] + 1); }
    var wins = Nat.windows(ymd[0]);
    if (wins.indexOf(w) >= 0 && !st.wk['fr' + w]) { st.wk['fr' + w] = 1; NT.windowRound(w); NT.friendlies(w); }
    st.tours.forEach(function (t) {
      var left = t.s0 - w;
      if (t.stage === 'plan' && left <= D_OBS) { t.stage = 'obs'; NT.round(t, 'obs'); }
      if ((t.stage === 'obs') && left <= D_MICRO) { t.stage = 'micro'; NT.round(t, 'micro'); }
      if ((t.stage === 'micro') && left <= D_PRE) { t.stage = 'pre'; NT.round(t, 'pre'); }
      if ((t.stage === 'pre') && left <= D_FIN) { t.stage = 'final'; NT.finalize(t); }
      if (t.stage === 'final' && w >= t.s0) { t.stage = 'play'; }
    });
    st.tours = st.tours.filter(function (t) { var c = S.comps[t.id]; return !(t.stage === 'play' && (!c || c.done) && w > t.s0 + 12); });
    if (w % 8 === 0) { var tt = {}; Object.keys(S.comps).forEach(function (id) { var c = S.comps[id]; if (c.kind === 'T' && c.done && c.doneAt == null) c.doneAt = w; if (c.kind === 'T' && c.done && w - c.doneAt > 30) delete S.comps[id]; }); }
  };

  // Ronda de una etapa para TODAS las selecciones de una categoría; el jugador solo ve la suya
  NT.round = function (t, kind) {
    var S = FP.S, d = TD[t.key], cat = d.cat, st = NT.ensure(), h = S.hero;
    var comp = S.comps[t.id];
    if (!comp && kind === 'obs') comp = NT.create(t);
    var ids = (comp ? comp.teams : []);
    ids.forEach(function (id) {
      var heroIn = h && !h.retired && h.nat === S.nat[id - 5000].c && NT.heroEligible(cat);
      var b = NT.build(id, cat, kind === 'pre' ? 'pre' : kind, S.week, heroIn);
      NT.setList(id, cat, b.sel, kind, t.id);
      if (heroIn) NT.heroStage(cat, kind, b, t, S.nat[id - 5000]);
    });
  };
  NT.heroEligible = function (cat) {
    var S = FP.S, h = S.hero, age = FP.Hero.age(), nat = Nat.byCode(h.nat); if (!nat) return false;
    var y = D.year(S.week), lim = NT.limitFor(cat, nat);
    if (cat === 'ABS') return age >= 17 && (h.tk === 'pro' || h.tk === 'loan');
    if (y - D.year(h.b) > lim) return false;
    return age >= (cat === 'U15' ? 12 : cat === 'U17' ? 13 : cat === 'U20' ? 15 : 17);
  };

  // ---------- el jugador: etapas del proceso ----------
  var MSG = {
    obs: ['Ojeadores de la selección {c} {n} siguen tus partidos.', 'Un veedor de la selección {c} {n} tomó nota de tu rendimiento.'],
    micro_in: ['Te convocan al microciclo de la selección {c} {n}: una semana de trabajo con el cuerpo técnico.'],
    micro_out: ['No fuiste citado al microciclo de la selección {c} {n}.'],
    micro_cut: ['Quedaste fuera tras el microciclo de la selección {c} {n}. El cuerpo técnico prefirió a otros jugadores de tu puesto.'],
    micro_ok: ['Buen microciclo: sigues en la lista de la selección {c} {n}.'],
    pre_out: ['Quedaste fuera de la preselección de {c} {n} para {t}.'],
    pre_in: ['Estás en la preselección de {c} {n} para {t}.'],
    final_in: ['¡Convocado! Integras la nómina final de {c} {n} para {t}.'],
    final_out: ['No quedaste en la nómina final de {c} {n} para {t}: fue el último descarte.']
  };
  function fmt(s, o) { return s.replace(/\{(\w+)\}/g, function (m, k) { return o[k] != null ? o[k] : ''; }); }
  NT.hs = function (cat) { var h = FP.S.hero; NT.ensure(); h.nts = h.nts || { c: {}, act: null, ev: [] }; return h.nts.c[cat] || (h.nts.c[cat] = { st: 'none', cd: 0, n: 0 }); };
  NT.note = function (cat, text, kind) { var h = FP.S.hero; h.nts.ev.unshift({ w: FP.S.week, cat: cat, t: text }); if (h.nts.ev.length > 60) h.nts.ev.length = 40; FP.Hero.msg(text, kind || 'i'); };
  NT.heroStage = function (cat, kind, b, t, nat) {
    var S = FP.S, h = S.hero, hs = NT.hs(cat), w = S.week, o = { c: NT.LABEL[cat], n: nat.nm, t: t ? TD[t.key].nm : 'los amistosos' };
    var pr = b.heroRank, top = pr ? pr.rank <= pr.quota + 1 : false, inList = b.hero;
    if (pr) hs.rk = { rank: pr.rank, of: pr.of, quota: pr.quota, w: w, kind: kind };
    var vis = NT.visibility();
    if (kind === 'obs') {
      if (hs.cd > w) return;
      var notable = pr && pr.rank <= Math.ceil(pr.of * 0.55);
      if (hs.st === 'none' && notable && R() < vis) { hs.st = 'obs'; hs.since = w; NT.note(cat, fmt(U.pick(MSG.obs), o), 'ok'); }
      return;
    }
    if (kind === 'micro') {
      if (hs.st !== 'obs' && hs.st !== 'micro') { return; }
      if (inList) { hs.st = 'micro'; hs.mc = (hs.mc || 0) + 1; NT.note(cat, fmt(U.pick(MSG.micro_in), o), 'ok'); h.nts.act = { cat: cat, nat: nat.id, comp: t ? t.id : null, until: w + 1, micro: 1 }; }
      else { if (hs.st === 'obs' && R() < 0.5) { /* sigue observado */ } else if (hs.st === 'micro') { hs.st = 'cut'; hs.cd = w + 26; NT.note(cat, fmt(U.pick(MSG.micro_cut), o), 'warn'); } }
      return;
    }
    if (kind === 'pre') {
      if (hs.st !== 'micro') return;
      if (inList) { hs.st = 'pre'; NT.note(cat, fmt(U.pick(MSG.pre_in), o), 'ok'); }
      else { hs.st = 'cut'; hs.cd = w + 26; NT.note(cat, fmt(U.pick(MSG.pre_out), o), 'warn'); }
    }
  };
  // Nómina final: define el equipo, su fuerza y la participación del jugador
  NT.finalize = function (t) {
    var S = FP.S, d = TD[t.key], cat = d.cat, st = NT.ensure(), h = S.hero, comp = S.comps[t.id];
    if (!comp) comp = NT.create(t);
    comp.teams.forEach(function (id) {
      var nat = S.nat[id - 5000], hs = h && !h.retired && h.nat === nat.c ? NT.hs(cat) : null;
      var heroIn = !!hs && NT.heroEligible(cat) && (hs.st === 'pre' || hs.st === 'sel');
      var b = NT.build(id, cat, 'final', S.week, heroIn);
      NT.setList(id, cat, b.sel, 'final', t.id);
      var players = b.sel.map(function (e) { return e.p; });
      comp.ys[id] = NT.strength(id, cat, players);
      if (hs && NT.heroEligible(cat)) {
        var o = { c: NT.LABEL[cat], n: nat.nm, t: d.nm };
        if (heroIn && b.hero) { hs.st = 'sel'; hs.n++; NT.note(cat, fmt(U.pick(MSG.final_in), o), 'ok'); h.nts.act = { cat: cat, nat: id, comp: t.id, until: t.s0 + 8 }; }
        else if (hs.st === 'pre') { hs.st = 'cut'; hs.cd = S.week + 26; NT.note(cat, fmt(U.pick(MSG.final_out), o), 'warn'); }
      }
    });
  };
  // Ventanas FIFA: nómina de amistosos de cada categoría (observación continua y llamados a prueba)
  NT.windowRound = function (w) {
    var S = FP.S, h = S.hero, st = NT.ensure();
    ['U15', 'U17', 'U20', 'U23'].forEach(function (cat) {
      S.nat.forEach(function (nat) {
        var heroIn = h && !h.retired && h.nat === nat.c && NT.heroEligible(cat);
        var b = NT.build(nat.id, cat, heroIn ? 'friendly' : 'friendly', w, heroIn);
        NT.setList(nat.id, cat, b.sel, 'friendly', null);
        if (heroIn) {
          var hs = NT.hs(cat), o = { c: NT.LABEL[cat], n: nat.nm, t: 'los amistosos' };
          // observación por ojeadores en la ventana
          if (hs.st === 'none' && hs.cd <= w) {
            var pr = b.heroRank, notable = pr && pr.rank <= Math.ceil(pr.of * 0.5);
            if (pr) hs.rk = { rank: pr.rank, of: pr.of, quota: pr.quota, w: w, kind: 'friendly' };
            if (notable && R() < NT.visibility() * 0.6) { hs.st = 'obs'; hs.since = w; NT.note(cat, fmt(U.pick(MSG.obs), o), 'ok'); }
          }
          // ¿lo llaman a los amistosos? solo si ya está en el radar y rinde frente a sus competidores
          if ((hs.st === 'obs' || hs.st === 'micro' || hs.st === 'pre' || hs.st === 'sel') && b.hero) {
            h.nts.act = { cat: cat, nat: nat.id, comp: 'N:' + cat + ':' + w, until: w + 2, friendly: 1 }; hs.st = hs.st === 'obs' ? 'micro' : hs.st;
            NT.note(cat, 'Convocado a los amistosos internacionales de la selección ' + NT.LABEL[cat] + ' de ' + nat.nm + '.', 'ok');
          } else if (hs.st === 'micro' && !b.hero) { hs.st = 'cut'; hs.cd = w + 20; NT.note(cat, fmt(U.pick(MSG.micro_cut), o), 'warn'); }
        }
      });
    });
    // selección absoluta: ver Nat.weekStart (usa NT.absCall)
  };
  // Absoluta: llamado por ventana FIFA con competencia real entre los jugadores del país
  NT.absCall = function (natId, w, fx) {
    var S = FP.S, h = S.hero, st = NT.ensure(), nat = S.nat[natId - 5000];
    var heroIn = h && !h.retired && h.nat === nat.c && NT.heroEligible('ABS');
    var b = NT.build(natId, 'ABS', 'final', w, heroIn);
    NT.setList(natId, 'ABS', b.sel, 'final', fx ? fx.id : null);
    return b;
  };

  // ¿Juega el jugador este partido? Evita que una convocatoria juvenil lo ponga en un partido de otra categoría
  NT.heroPlays = function (comp, f) {
    var S = FP.S, h = S.hero; if (!h) return true;
    var sj = FP.Sel && FP.Sel.job(); if (sj && (f.h === sj.nat || f.a === sj.nat)) return (comp.cat || 'ABS') === sj.cat;     // seleccionador: solo los partidos de su categoría
    var nat = Nat.byCode(h.nat);
    var isNatMatch = nat && (f.h === nat.id || f.a === nat.id) && (comp.nat || comp.kind === 'X' || comp.kind === 'Q' || comp.kind === 'T' || comp.kind === 'N');
    if (!isNatMatch) return true;
    var cat = comp.cat || 'ABS', act = h.nts && h.nts.act, w = f.w;
    if (cat === 'ABS') return !!(h.nt.dec && h.nt.dec.ok && h.nt.dec.until >= w - 1);
    return !!(act && !act.micro && act.cat === cat && act.until >= w - 1 && (!act.comp || act.comp === comp.id || (comp.kind === 'N' && act.friendly)));
  };

  // ---------- semana del jugador ----------
  // Reemplaza las convocatorias heredadas: el equipo del jugador en la semana es el de su nómina activa.
  NT.heroWeek = function (w) {
    var S = FP.S, h = S.hero; if (!h || h.retired) return;
    NT.ensure();
    h.extraTeams = [];
    var act = h.nts.act, nat = Nat.byCode(h.nat); if (!nat) return;
    if (act && act.until >= w && !(h.inj && h.inj.n > 2)) { h.extraTeams = [act.nat]; h.nt.cat = NT.LABEL[act.cat]; }
    // absoluta: se decide por bloque con ventana FIFA
    var fx = Nat.nationHasFixture(nat.id, w);
    if (fx && NT.heroEligible('ABS') && !(h.inj && h.inj.n > 0)) {
      var nt = h.nt;
      if (!nt.dec || nt.dec.until < w) {
        var b = NT.absCall(nat.id, w, fx), hs = NT.hs('ABS');
        nt.dec = { ok: !!b.hero, until: w + 8, cat: 'Absoluta' };
        if (b.hero) { nt.cat = 'Absoluta'; hs.st = 'sel'; hs.n++; NT.note('ABS', '¡Convocado a la selección absoluta de ' + nat.nm + '! (' + fx.nm + ')', 'ok'); }
        else if (b.heroRank && b.heroRank.rank <= b.heroRank.quota + 3) NT.note('ABS', 'No fuiste incluido en la nómina de ' + nat.nm + ' para ' + fx.nm + ': compites con ' + b.heroRank.of + ' jugadores de tu puesto.', 'i');
      }
      if (nt.dec && nt.dec.ok && nt.dec.until >= w) h.extraTeams = [nat.id];
    }
  };

  Nat.weekStart = function (w) { return NT.heroWeek(w); };
  // migración y enganche del ciclo semanal
  var prevW = Sim.weeklyExtra;
  Sim.weeklyExtra = function (w) { if (prevW) prevW(w); NT.weekly(w); };
  NT.migrate = function () { NT.ensure(); };
})();
