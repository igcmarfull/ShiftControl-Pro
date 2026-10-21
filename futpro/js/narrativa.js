/* FUTPRO — motor narrativo de la Wiki, parte 1: INTERPRETACIÓN.
   Lee el historial real de la partida (registro estadístico, palmarés, historial, lesiones, selecciones, legado) y lo convierte en un
   modelo de carrera: temporadas evaluadas en contexto, etapas por club, tendencias, hechos con peso y tipos de trayectoria.
   No escribe estado ni toca el motor: es una función pura de los registros. La redacción está en js/narrativa-texto.js.
   Los valores de referencia (BASE) y los umbrales son supuestos de diseño calibrados con carreras simuladas (tests/narrativa-calibrar.js). */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, B = FP.Bio, X = B.x, ST = FP.Stats;
  var N = FP.Narr = {};

  // ---------- referencias de rendimiento ----------
  // Goles y asistencias por 90 minutos y valoración media esperadas para un futbolista de cada grupo de posiciones, según el nivel de la competición.
  // Se calibraron con las carreras simuladas del propio juego (tests/narrativa-calibrar.js); el nivel 3 incluye las divisiones inferiores.
  N.BASE = {
    // [goles/90, asistencias/90] por posición. Se calibraron con las carreras simuladas del propio juego y, como los futbolistas simulados
    // rinden más en las divisiones bajas que en la élite (compiten contra rivales más flojos), no se usan valores distintos por categoría:
    // el nivel de la competición se aplica después, restando peso a lo logrado en categorías inferiores (N.LEVEL).
    rate: {
      FWD: [0.46, 0.07], ATT: [0.17, 0.21], MID: [0.06, 0.10], DEF: [0.04, 0.035], GK: [0, 0.01]
    },
    rt: { FWD: [6.6, 0.4], ATT: [6.5, 0.4], MID: [6.25, 0.33], DEF: [6.1, 0.25], GK: [6.2, 0.3] }   // [media, desviación] de la valoración por partido
  };
  // peso del nivel de la competición: 25 goles en una liga regional no equivalen a 25 en la máxima categoría ni en una copa continental
  N.LEVEL = { 1: 1, 2: 0.9, 3: 0.75, 4: 0.6, juv: 0.8, amat: 0.6 };
  var GRP = { GK: 'GK', CB: 'DEF', LB: 'DEF', RB: 'DEF', DM: 'MID', CM: 'MID', AM: 'ATT', LW: 'ATT', RW: 'ATT', ST: 'FWD' };
  var W_OUT = { FWD: 0.55, ATT: 0.45, MID: 0.30, DEF: 0.12, GK: 0 };     // peso de la producción ofensiva frente a la valoración de los partidos
  N.grp = function (pos) { return GRP[pos] || 'MID'; };

  function z0() { return { p: 0, st: 0, min: 0, g: 0, a: 0, rs: 0, rn: 0, n: 0, w: 0, d: 0, l: 0, yc: 0, rc: 0 }; }
  function addTo(t, r) { for (var k in t) t[k] += r[k] || 0; return t; }
  function lvOf(t) { return t >= 30000 && t < 50000 ? 'juv' : t >= 20000 && t < 30000 ? 'amat' : 'pro'; }
  function bandOf(tier, lv) { return lv === 'juv' ? 'juv' : lv === 'amat' ? 'amat' : tier <= 1 ? 1 : tier === 2 ? 2 : 3; }
  N.TIERN = { 1: 'la máxima categoría', 2: 'la segunda categoría', 3: 'la tercera categoría' };
  N.tierName = function (t) { return N.TIERN[t] || 'una categoría inferior'; };

  // ---------- evaluación de una temporada en su contexto ----------
  // z: distancia (en desviaciones aproximadas) respecto a lo esperable para su posición y nivel; se encoge hacia 0 con pocos minutos.
  N.evaluate = function (s, grp) {
    var L = s.L, band = s.band, rate = N.BASE.rate[grp] || N.BASE.rate.MID, rt = N.BASE.rt[grp] || [6.3, 0.35], lvl = s.lv === 'pro' ? (N.LEVEL[s.tier] || N.LEVEL[4]) : N.LEVEL[s.lv];
    var min = L.min, sample = min >= 900 ? 'plena' : min >= 450 ? 'media' : 'escasa';
    var e90 = min / 90, gE = rate[0] * e90, aE = rate[1] * e90;
    var out = ((L.g - gE) + 0.7 * (L.a - aE)) / Math.sqrt(gE + 0.5 * aE + 2.5);
    var avg = L.rn ? L.rs / L.rn : null, zr = avg == null ? 0 : (avg - rt[0]) / rt[1] * Math.sqrt(L.rn / (L.rn + 10));
    var wo = W_OUT[grp] != null ? W_OUT[grp] : 0.3, z = wo * out + (1 - wo) * zr, shrink = min / (min + 600);
    z = z * shrink * lvl;
    var lab = sample === 'escasa' ? 'escasa' : z >= 1.6 && lvl >= 0.9 ? 'excepcional' : z >= 0.9 ? 'destacada' : z >= 0.3 ? 'buena' : z > -0.4 ? 'regular' : 'baja';
    return { z: z, lab: lab, sample: sample, out: out, zr: zr, avg: avg, g90: e90 ? L.g / e90 : 0, a90: e90 ? L.a / e90 : 0, gE: gE, aE: aE };
  };
  // peso de un rol según la titularidad (st/n: titularidades sobre partidos del equipo con el jugador disponible)
  function roleOf(L) {
    if (!L.n || !L.p) return 'sin minutos';
    var share = L.st / Math.max(L.n, 1), mshare = L.min / (Math.max(L.n, 1) * 90);
    if (L.p < 10) return share >= 0.5 ? 'rotación' : 'suplente';             // con tan pocos partidos no se habla de titularidad consolidada
    if (share >= 0.75 && mshare >= 0.62 && L.p >= 25) return 'titular indiscutible';
    return share >= 0.5 && L.p >= 12 ? 'titular habitual' : share >= 0.2 || mshare >= 0.2 ? 'rotación' : 'suplente';
  }
  N.roleRank = { 'sin minutos': 0, 'suplente': 1, 'rotación': 2, 'titular habitual': 3, 'titular indiscutible': 4 };

  // ---------- recopilación de temporadas y etapas ----------
  function lgFor(club, rows) {
    var best = null; rows.forEach(function (r) { if (r.k !== 'liga' || !club) return; var def = null; for (var id in FP.LGDEF) { var d = FP.LGDEF[id]; if (d.c === club.c && d.n === r.c) { def = d; break; } } if (def && (!best || r.p > best.p)) best = { def: def, p: r.p }; });
    return best ? best.def : (club ? FP.LGDEF[club.lg] : null);
  }
  N.gather = function () {
    var S = FP.S, h = S.hero, rows = ST.rows().slice().sort(function (a, b) { return a.o - b.o; }), ageOf = {};
    (h.seasons || []).forEach(function (r) { ageOf[X.y4(r.y)] = r.age; });
    var by = {}, seasons = [], grp = N.grp(h.pos);
    rows.forEach(function (r) {
      if (ST.isNT(r.k) || r.k === 'amis') return;
      var k = r.s + '|' + r.t, s = by[k];
      if (!s) { s = by[k] = { key: k, s: r.s, y: X.y4(r.s), t: r.t, tn: r.tn, lv: lvOf(r.t), rows: [], o: 0, L: z0(), copa: z0(), cont: z0(), all: z0() }; seasons.push(s); }
      s.rows.push(r); s.o = Math.max(s.o, r.o);
      var tg = r.k === 'copa' ? s.copa : r.k === 'cont' ? s.cont : s.L;
      addTo(tg, r); addTo(s.all, r);
    });
    seasons.sort(function (a, b) { return a.o - b.o; });
    seasons.forEach(function (s) {
      var base = s.t >= 30000 && s.t < 50000 ? s.t - 30000 : s.t, club = base < 5000 ? S.clubs[base] : null;
      s.base = base < 5000 ? base : null; s.club = club; s.name = base < 5000 ? C.tname(base) : s.tn; s.country = club ? club.c : null;
      s.lg = s.lv === 'pro' ? lgFor(club, s.rows) : null; s.lgName = s.lv === 'pro' && s.lg ? s.lg.n : (s.rows.filter(function (r) { return r.k === 'liga' || r.k === 'juv' || r.k === 'amat'; }).sort(function (a, b) { return b.p - a.p; })[0] || { c: '' }).c;
      s.tier = s.lv === 'pro' ? (s.lg ? s.lg.t : 3) : 9; s.q = s.lg ? s.lg.q : null; s.band = bandOf(s.tier, s.lv);
      s.loan = s.lv === 'pro' && B.isLoan(s.t, s.o); s.age = ageOf[s.y]; s.role = roleOf(s.L); s.perf = N.evaluate(s, grp);
      s.ye = X.yEnd(s.s);
    });
    return seasons;
  };

  // etapas por club (solo profesional): temporadas consecutivas en el mismo club y con la misma condición (cedido o no)
  N.stintsOf = function (pro) {
    var out = [], seen = {};
    pro.forEach(function (s) {
      var g = out[out.length - 1];
      if (g && g.t === s.base && g.loan === s.loan) { g.seasons.push(s); } else { out.push({ t: s.base, name: s.name, loan: s.loan, country: s.country, seasons: [s], ret: !!seen[s.base] && !s.loan }); }
      if (!s.loan) seen[s.base] = 1;
    });
    out.forEach(function (g, i) {
      g.i = i; g.y0 = g.seasons[0].y; g.y1 = g.seasons[g.seasons.length - 1].ye; g.n = g.seasons.length;
      g.L = z0(); g.all = z0(); g.seasons.forEach(function (s) { addTo(g.L, s.L); addTo(g.all, s.all); });
      g.tierMin = Math.min.apply(null, g.seasons.map(function (s) { return s.tier; })); g.tierMax = Math.max.apply(null, g.seasons.map(function (s) { return s.tier; }));
      var ev = g.seasons.filter(function (s) { return s.perf.sample !== 'escasa'; });
      g.best = ev.filter(function (s) { return s.perf.sample === 'plena'; }).slice().sort(function (a, b) { return b.perf.z - a.perf.z; })[0] || null;
      g.role = g.seasons.map(function (s) { return N.roleRank[s.role]; }).reduce(function (a, b) { return a + b; }, 0) / g.n;
      g.w1 = g.seasons[g.seasons.length - 1].o; g.w0 = i ? out[i - 1].w1 + 1 : null;
      var pl = g.seasons.filter(function (s) { return s.perf.sample === 'plena'; }); g.z = pl.length ? pl.reduce(function (a, s) { return a + s.perf.z; }, 0) / pl.length : null; g.zN = pl.length;
    });
    return out;
  };

  // ---------- hechos con peso ----------
  var MAJOR_CONT = /Libertadores|Champions|Europa League|Mundial de Clubes|Intercontinental/i, MINOR_CONT = /Sudamericana|Conference|Recopa|Supercopa/i;
  function trophyWeight(t) {
    var nm = t.nm || '';
    if (t.nt) return /Mundial/i.test(nm) ? 90 : /Copa Am|Eurocopa|Copa de Naciones|Copa Asia|Copa Africana|Oro/i.test(nm) ? 78 : 58;
    if (/Juvenil/i.test(nm) || /regional/i.test(nm)) return 22;
    if (MAJOR_CONT.test(nm)) return 88;
    if (MINOR_CONT.test(nm)) return 66;
    if (/^Campe[oó]n de /i.test(nm)) return 72;
    if (/Copa/i.test(nm)) return 54;
    return 50;
  }
  function awardWeight(a) {
    var nm = a.nm || '';
    if (/^Bal[oó]n de Oro$/i.test(nm)) return 96; if (/Finalista del Bal[oó]n/i.test(nm)) return 74;
    if (/Mejor jugador joven/i.test(nm)) return 44; if (/Mejor jugador/i.test(nm)) return 62;
    if (/Bota de Oro/i.test(nm)) return 64; if (/Equipo ideal/i.test(nm)) return 40;
    if (/juvenil/i.test(nm)) return 18; if (/Goleador/i.test(nm)) return 36;
    return 30;
  }
  N.trophyWeight = trophyWeight; N.awardWeight = awardWeight;
  N.isMajor = function (t) { return !t.sub && !/Juvenil|regional/i.test(t.nm || '') && trophyWeight(t) >= 54; };

  // ---------- modelo de carrera ----------
  N.analyze = function () {
    var S = FP.S, h = S.hero, M = { h: h, pos: h.pos, grp: N.grp(h.pos), retired: !!h.retired, now: S.week };
    var all = N.gather(); M.all = all;
    // solo cuentan las temporadas en las que llegó a jugar; estar en la plantilla sin minutos no es una etapa de carrera
    all = all.filter(function (s) { return s.all.p > 0; }); M.all = all;
    M.pro = all.filter(function (s) { return s.lv === 'pro'; }); M.youth = all.filter(function (s) { return s.lv === 'juv'; }); M.amat = all.filter(function (s) { return s.lv === 'amat'; });
    M.form = all.filter(function (s) { return s.lv !== 'pro'; });
    // el fútbol amateur posterior al debut profesional no es formación: se cuenta aparte
    var fy = M.pro.length ? M.pro[0].y : 9999; M.late = M.form.filter(function (s) { return s.lv === 'amat' && s.y > fy; }); M.formPre = M.form.filter(function (s) { return M.late.indexOf(s) < 0; });
    M.stints = N.stintsOf(M.pro);
    M.tot = z0(); M.pro.forEach(function (s) { addTo(M.tot, s.all); });
    M.totL = z0(); M.pro.forEach(function (s) { addTo(M.totL, s.L); });
    M.totForm = z0(); M.formPre.forEach(function (s) { addTo(M.totForm, s.all); }); M.totLate = z0(); M.late.forEach(function (s) { addTo(M.totLate, s.all); });
    M.firstPro = M.pro[0] || null; M.lastPro = M.pro[M.pro.length - 1] || null;
    var lab = {}; M.pro.forEach(function (s) { lab[s.s] = 1; }); M.nProSeasons = Object.keys(lab).length;
    M.clubs = []; M.stints.forEach(function (g) { if (!g.loan && M.clubs.indexOf(g.t) < 0) M.clubs.push(g.t); });
    M.clubsAny = []; M.stints.forEach(function (g) { if (M.clubsAny.indexOf(g.t) < 0) M.clubsAny.push(g.t); });
    M.countries = []; M.pro.forEach(function (s) { if (s.country && M.countries.indexOf(s.country) < 0) M.countries.push(s.country); });
    M.topTier = M.pro.length ? Math.min.apply(null, M.pro.map(function (s) { return s.tier; })) : null;
    // categoría más alta en la que tuvo continuidad (al menos 15 partidos en la temporada); distinta de la más alta en la que llegó a jugar
    var reg = M.pro.filter(function (s) { return s.L.p >= 15; }); M.topTierReg = reg.length ? Math.min.apply(null, reg.map(function (s) { return s.tier; })) : null;
    M.nat = h.nat; M.abroad = M.countries.filter(function (c) { return c !== h.nat; });
    // temporadas con muestra suficiente, para comparar con las demás
    M.rated = M.pro.filter(function (s) { return s.perf.sample === 'plena'; });
    M.bestSeason = M.rated.slice().sort(function (a, b) { return b.perf.z - a.perf.z; })[0] || null;
    M.mostGoals = M.pro.slice().sort(function (a, b) { return b.L.g - a.L.g; })[0] || null;
    // progresión: media por edad (registro del juego) y edad del máximo
    var prog = (h.seasons || []).filter(function (r) { return r.ovr; }); M.peak = prog.reduce(function (b, r) { return !b || r.ovr > b.ovr ? r : b; }, null);
    M.ovrFirst = prog[0] || null; M.ovrLast = prog[prog.length - 1] || null;
    M.trend = N.trend(M); M.inj = N.injuries(M); M.nt = N.national(M);
    M.tro = (h.trophies || []).map(function (t) { return { t: t, w: trophyWeight(t), y: X.y4(t.y) }; });
    M.aw = (h.awards || []).map(function (a) { return { a: a, w: awardWeight(a), y: X.y4(a.y) }; });
    N.attach(M);
    M.clubTotals = N.clubTotals(M); M.ido = N.legacyClubs(M);
    M.arch = N.archetypes(M);
    M.ev = N.events(M);
    return M;
  };

  // ---------- tendencias: auge, retroceso, caídas y recuperaciones ----------
  N.trend = function (M) {
    var ser = M.rated.map(function (s) { return { s: s, z: s.perf.z }; }), out = { dips: [], recover: null, decline: null, late: false, early: false };
    if (ser.length >= 3) {
      var zs = ser.map(function (x) { return x.z; }), pk = 0; zs.forEach(function (z, i) { if (z > zs[pk]) pk = i; });
      // caída y recuperación: dos o más temporadas por debajo de lo esperable seguidas de dos o más buenas
      for (var i = 1; i < ser.length - 2; i++) {
        if (zs[i] < -0.3 && zs[i - 1] > -0.3) { var j = i; while (j < ser.length && zs[j] < -0.1) j++; if (j - i >= 2 && j < ser.length - 1 && zs[j] > 0.3 && zs[j + 1] > 0.3 && ser[i - 1].z > 0) out.recover = { from: ser[i].s, to: ser[j].s, len: j - i }; }
      }
      // retroceso sostenido: tras el mejor momento, dos temporadas seguidas claramente por debajo, que se mantienen por debajo hasta el final del registro
      for (var j = pk + 1; j < ser.length - 1 && zs[pk] > 0.5; j++) {
        var thr = zs[pk] - 0.9;
        if (zs[j] < thr && zs[j + 1] < thr && zs[j] < zs[pk] * 0.6 && zs.slice(j).every(function (z) { return z < thr + 0.5; })) { out.decline = { from: ser[pk].s, next: ser[j].s, peakZ: zs[pk], after: zs[j] }; break; }
      }
    }
    var pkA = M.peak ? M.peak.age : null, d0 = M.firstPro ? M.firstPro.age : null;
    out.late = !!(pkA && pkA >= 28 && M.nProSeasons >= 6 && M.ovrFirst && M.peak.ovr - M.ovrFirst.ovr >= 10);
    out.early = !!(d0 != null && d0 <= 17);
    // regresión en la media del jugador (registro de progresión del juego)
    var last = M.ovrLast, pk = M.peak; out.regress = !!(last && pk && pk.ovr - last.ovr >= 5 && last.age > pk.age + 1);
    return out;
  };

  // ---------- lesiones: solo las registradas, y su efecto sobre la participación ----------
  N.injuries = function (M) {
    var h = M.h, hist = (h.med && h.med.hist) || [], out = [];
    hist.forEach(function (e) {
      if (!e || e.n < 6) return;
      var st = M.stints.filter(function (g) { var w0 = g.w0 != null ? g.w0 : g.seasons[0].o - 60; return e.w <= g.w1 + 6 && e.w >= w0 - 6; })[0] || null;
      out.push({ w: e.w, nm: e.nm, zone: e.zone, n: e.n, relapse: !!e.relapse, stint: st, major: e.n >= 16, big: e.n >= 26 });
    });
    return out;
  };

  // ---------- selecciones ----------
  N.national = function (M) {
    var by = ST.byClass(), out = { cats: [], any: false, caps: 0, goals: 0 };
    X.CATS.forEach(function (k) {
      var d = by[k]; if (!d) return; var rows = d.rows.filter(function (r) { return r.p > 0; }), off = rows.filter(function (r) { return !/Amistoso/i.test(r.c); });
      if (!rows.length) return; var T = ST.sum(rows), ys = rows.map(function (r) { return X.y4(r.s); });
      var comps = {}; off.forEach(function (r) { comps[r.c] = (comps[r.c] || 0) + r.p; });
      out.cats.push({ k: k, label: X.CATN[k], p: T.p, g: T.g, a: T.a, y0: Math.min.apply(null, ys), y1: Math.max.apply(null, ys), comps: comps, rows: rows, offP: off.reduce(function (a, r) { return a + r.p; }, 0) });
      out.any = true; if (k === 'abs') { out.caps += T.p; out.goals += T.g; }
    });
    out.abs = out.cats.filter(function (c) { return c.k === 'abs'; })[0] || null;
    out.youth = out.cats.filter(function (c) { return c.k !== 'abs'; });
    out.first = ((M.h.bio && M.h.bio.ev) || []).filter(function (e) { return /Convocado a la selección absoluta/.test(e.t); })[0] || null;
    return out;
  };

  // ---------- vínculo de títulos, distinciones y lesiones con cada etapa ----------
  N.attach = function (M) {
    M.stints.forEach(function (g) {
      var nm = g.name;
      g.tro = (M.h.trophies || []).filter(function (t) { return !t.sub && !t.nt && !/Juvenil|regional/i.test(t.nm) && X.baseName(t.club) === nm && X.y4(t.y) >= g.y0 - 0 && X.y4(t.y) <= g.y1 + 0; });
      g.sub = (M.h.trophies || []).filter(function (t) { return t.sub && !t.nt && !/regional/i.test(t.nm) && X.baseName(t.club) === nm && X.y4(t.y) >= g.y0 && X.y4(t.y) <= g.y1; });
      g.aw = (M.h.awards || []).filter(function (a) { var y = X.y4(a.y); return y >= g.y0 && y <= g.y1 && g.seasons.some(function (s) { return String(s.s) === String(a.y) || X.y4(s.s) === y; }) && !/juvenil/i.test(a.nm); });
      g.inj = M.inj.filter(function (e) { return e.stint === g; });
      // ascensos y descensos del club durante la etapa: cambio de categoría entre temporadas consecutivas con el mismo equipo
      g.moves = [];
      for (var i = 1; i < g.seasons.length; i++) { var a = g.seasons[i - 1], b = g.seasons[i]; if (a.lg && b.lg && a.lg.t !== b.lg.t && a.country === b.country) g.moves.push({ s: b, up: b.lg.t < a.lg.t, from: a.lg, to: b.lg }); }
    });
  };

  // ---------- acumulado por institución: una etapa nueva empieza cuando entre dos pasos por el mismo club hubo otro club (las cesiones no la cortan) ----------
  N.clubTotals = function (M) {
    var by = {}, order = [], lastOwn = null;
    M.stints.forEach(function (g) {
      if (g.loan || g.t == null) return;
      var c = by[g.t]; if (!c) { c = by[g.t] = { t: g.t, name: g.name, stages: [], n: 0, L: z0(), all: z0(), tro: [], y0: g.y0, y1: g.y1 }; order.push(c); }
      if (!c.stages.length || lastOwn !== g.t) c.stages.push({ y0: g.y0, y1: g.y1, n: 0 }); var st = c.stages[c.stages.length - 1]; st.y1 = g.y1; st.n += g.n;
      c.n += g.n; c.y0 = Math.min(c.y0, g.y0); c.y1 = Math.max(c.y1, g.y1); addTo(c.L, g.L); addTo(c.all, g.all); c.tro = c.tro.concat(g.tro); lastOwn = g.t;
    });
    return order;
  };

  // ---------- legado por club (estatus que el juego asigna) ----------
  // El estatus es histórico y acumulativo: se evalúa una sola vez por club con todas sus etapas; volver a un club no lo concede de nuevo.
  N.legacyClubs = function (M) {
    var out = [], Id = FP.Idolo; if (!Id || !M.h.ido) return out;
    M.clubTotals.forEach(function (c) { var d = M.h.ido.clubs && M.h.ido.clubs[c.t]; if (!d) return; var s = Id.status(c.t); if (s.rank >= 2) out.push({ t: c.t, name: c.name, label: s.label, rank: s.rank, pts: s.pts, c: c, g: c.stages[0] }); });
    out.sort(function (a, b) { return b.rank - a.rank || b.pts - a.pts; });
    return out;
  };

  // ---------- tipos de trayectoria (no excluyentes) ----------
  // Cada tipo se puntúa de 0 a 1 con rasgos medibles de los registros; los que superan el umbral se consideran presentes.
  N.archetypes = function (M) {
    var a = {}, h = M.h, ns = M.nProSeasons, rated = M.rated, avgz = rated.length ? rated.reduce(function (x, s) { return x + s.perf.z; }, 0) / rated.length : 0;
    var maj = M.tro.filter(function (x) { return !x.t.sub && !x.t.nt && x.w >= 54; }), top = M.topTier, topR = M.topTierReg, topSeasons = M.pro.filter(function (s) { return s.tier === 1; });
    var topGood = topSeasons.filter(function (s) { return s.perf.sample === 'plena' && s.perf.z >= 0.7; }).length;
    var maxTenure = M.clubTotals.reduce(function (m, c) { return Math.max(m, c.n); }, 0), minorStints = M.stints.filter(function (g) { return g.n <= 2 && g.L.p < 25; }).length;
    var awMajor = M.aw.filter(function (x) { return x.w >= 60; }).length, qTop = topSeasons.filter(function (s) { return s.q != null && s.q >= 55; }).length;
    // estrella: asciende a lo más alto y rinde por encima de lo esperable de forma sostenida, con honores de peso
    var ntW = M.nt.caps >= 40 ? 0.15 : M.nt.caps >= 15 ? 0.1 : 0, honW = Math.min(0.2, 0.1 * maj.length) + Math.min(0.2, 0.1 * awMajor);
    a.star = ns >= 4 && topR === 1 && honW > 0 ? Math.min(1, 0.075 * Math.min(topGood, 4) + honW + (qTop >= 3 ? 0.15 : 0.05 * qTop) + ntW + 0.25 * (honW >= 0.3 ? 1 : 0)) : 0;
    // modesto: carrera profesional larga sin superar la categoría intermedia ni acumular honores
    a.modest = ns >= 6 && (topR == null || topR >= 2) && maj.length <= 1 && Math.abs(avgz) < 0.9 ? Math.min(1, 0.5 + 0.06 * (ns - 6)) : 0;
    // trotamundos: muchos clubes con permanencias cortas o varios países
    var nc = M.clubs.length, nct = M.countries.length;
    a.rover = nc >= 4 && ns >= 5 ? Math.min(1, 0.3 + 0.12 * (nc - 4) + 0.18 * (nct - 1) + (ns / Math.max(nc, 1) <= 2.4 ? 0.25 : 0)) : 0;
    // ídolo de club: permanencia larga con peso en el club o estatus alto del juego
    var idRank = M.ido.length ? M.ido[0].rank : 0;
    a.idol = (maxTenure >= 7 || (maxTenure >= 5 && idRank >= 3)) ? Math.min(1, 0.4 + 0.05 * Math.max(0, maxTenure - 6) + 0.12 * Math.max(0, idRank - 2)) : (idRank >= 4 ? 0.7 : 0);
    // promesa frustrada: señales juveniles claras que no se consolidan como profesional
    var yz = M.youth.filter(function (s) { return s.perf.sample !== 'escasa' && s.perf.z >= 0.8; }).length, yAw = M.aw.filter(function (x) { return /juvenil|joven/i.test(x.a.nm); }).length + M.tro.filter(function (x) { return /Juvenil/i.test(x.t.nm) && !x.t.sub; }).length, yNt = M.nt.youth.length;
    var ysig = (yz ? 0.4 : 0) + (yAw ? 0.25 : 0) + (yNt ? 0.2 : 0);
    var age = h.retired ? (h.retiredAge || 0) : FP.Hero.age();
    a.fail = ysig >= 0.4 && ns >= 2 && (age >= 24 || h.retired) && (topR == null || topR >= 2) && avgz < 0.3 && topGood === 0 ? Math.min(1, ysig + 0.2) : 0;
    // superación: una etapa mala seguida de una recuperación sostenida, o regreso de una lesión grave con rendimiento
    a.comeback = M.trend.recover ? 0.8 : 0;
    // carrera interrumpida: retiro antes de los 31 años con carrera profesional corta
    var ra = h.retiredAge; a.cut = h.retired && ra && ra <= 30 && ns >= 1 && ns <= 10 ? Math.min(1, 0.5 + 0.1 * (31 - ra) / 3) : 0;
    // desarrollo tardío: el mejor nivel o la mayor categoría llegan después de los 27
    var lateTop = M.pro.filter(function (s) { return s.tier === (top == null ? 9 : top) && s.age >= 27; }).length;
    a.late = M.trend.late || (ns >= 7 && top != null && top <= 2 && M.firstPro && M.firstPro.tier >= 3 && lateTop >= 2 && M.firstPro.age >= 20) ? 0.7 : 0;
    // precoz: debut profesional a los 17 o antes con continuidad
    a.prodigy = M.trend.early && ns >= 5 ? 0.6 : 0;
    // incipiente: pocos datos para hablar de trayectoria
    a.brief = ns <= 1 && M.tot.p < 30 ? 1 : 0;
    var present = Object.keys(a).filter(function (k) { return a[k] >= (k === 'star' ? 0.55 : 0.5); }).sort(function (x, y) { return a[y] - a[x]; });
    return { score: a, present: present, has: function (k) { return present.indexOf(k) >= 0; }, maxTenure: maxTenure, nClubs: nc, nCountries: nct, avgz: avgz, majTitles: maj.length };
  };

  // ---------- jerarquía de acontecimientos ----------
  // Cada hecho trae un peso (0-100) calculado frente al resto de la carrera. De él se decide dónde aparece:
  //   intro: resumen introductorio · club: sección del club · nt: selección · pal: palmarés · rec: récords · line: cronología detallada.
  N.events = function (M) {
    var ev = [], h = M.h;
    function add(e) { ev.push(e); return e; }
    M.tro.forEach(function (x) { var t = x.t; add({ k: t.sub ? 'sub' : 'title', w: t.w != null ? t.w : 0, y: x.y, wt: t.sub ? Math.round(x.w * 0.55) : x.w, t: t, club: t.club, nt: !!t.nt }); });
    M.aw.forEach(function (x) { add({ k: 'award', w: x.a.w != null ? x.a.w : 0, y: x.y, wt: x.w, a: x.a }); });
    M.stints.forEach(function (g, i) {
      if (g.i === 0 || !g.seasons.length) return; var prev = M.stints[i - 1], dest = g.tierMin, src = prev.tierMin;
      var fee = ((h.history || []).filter(function (e) { return /^Firma con/.test(e.t) && e.club === g.t && e.w <= g.seasons[0].o + 40 && e.w >= (prev.w1 - 60); })[0] || {}).t, big = 0;
      var m = fee && /traspaso ([\d.,]+) mil/.exec(fee); if (m) big = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
      var wt = 30 + (dest < src ? 18 : dest > src ? -8 : 4) + (dest === 1 ? 8 : 0) + Math.min(24, big / 2000 * 8) + (g.loan ? -10 : 0);
      add({ k: 'move', w: g.w0 || g.seasons[0].o, y: g.y0, wt: Math.max(10, Math.round(wt)), g: g, from: prev, fee: big });
    });
    M.stints.forEach(function (g) {
      g.moves.forEach(function (m) { add({ k: m.up ? 'promo' : 'relegation', w: m.s.o, y: m.s.y, wt: m.up ? (m.to.t === 1 ? 62 : 48) : 40, g: g, m: m }); });
    });
    M.inj.forEach(function (e) { add({ k: 'injury', w: e.w, y: D.year(e.w), wt: e.big ? 62 : e.major ? 46 : 28, e: e }); });
    if (M.firstPro) add({ k: 'debut', w: M.firstPro.o, y: M.firstPro.y, wt: M.nProSeasons <= 2 ? 62 : 46, s: M.firstPro });
    if (M.nt.first) add({ k: 'ntdebut', w: M.nt.first.w, y: D.year(M.nt.first.w), wt: 58 });
    if (M.nt.abs) add({ k: 'nt', w: 0, y: M.nt.abs.y0, wt: M.nt.abs.p >= 40 ? 70 : M.nt.abs.p >= 10 ? 56 : 40, nt: M.nt.abs });
    M.ido.forEach(function (c) { add({ k: 'legacy', w: 0, y: c.c.y1, wt: 40 + 12 * c.rank, c: c }); });
    if (M.trend.recover) add({ k: 'recover', w: M.trend.recover.to.o, y: M.trend.recover.to.y, wt: 54, r: M.trend.recover });
    if (M.trend.decline) add({ k: 'decline', w: 0, y: M.trend.decline.from.y, wt: 44, r: M.trend.decline });
    if (h.retired) add({ k: 'retire', w: h.retiredW || 0, y: D.year(h.retiredW || M.now), wt: 60 });
    // colocación según el peso y la riqueza de la carrera (una carrera corta puede resumir hechos menores en la introducción)
    var maxW = ev.reduce(function (m, e) { return Math.max(m, e.wt); }, 0), floorIntro = maxW >= 70 ? 62 : maxW >= 55 ? 48 : 36;
    ev.forEach(function (e) {
      e.lead = e.wt >= floorIntro && !/^(injury|promo|relegation|decline)$/.test(e.k);
      e.line = e.wt >= 28; e.club = e.k !== 'nt' && e.k !== 'ntdebut' && !e.nt;
      e.pal = e.k === 'title' || e.k === 'sub' || e.k === 'award';
      e.rec = e.k === 'legacy' || (e.k === 'award' && e.wt >= 60) || (e.k === 'title' && e.wt >= 70);
    });
    ev.sort(function (a, b) { return (a.w || 0) - (b.w || 0) || b.wt - a.wt; });
    return ev;
  };
})();
