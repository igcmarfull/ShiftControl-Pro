/* FUTPRO — sueldos realistas: cada club tiene una masa salarial y el jugador cobra su parte según su valor.
   masa del club = sueldo medio de su liga (REF, M€ al año) × 25 jugadores × presupuesto relativo del club (BUDGET si es conocido; si no, valor de su plantilla y economía),
   normalizado para que la media de la liga sea la referencia. Un grande de Chile paga más que un club de Primera B, y nadie cobra más del 15 % de la masa. Las referencias son aproximaciones de diseño (de memoria), no datos oficiales.
   Cambia solo cómo se calculan sueldos de ofertas, renovaciones y representados; no modifica partidos, valores ni el guardado. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, M = FP.Market, Rep = FP.Rep;
  var W = FP.Wages = {};

  // sueldo medio de un futbolista del primer equipo, en M€ al año (referencias aproximadas de diseño)
  W.REF = {
    ENG1: 5.5, ENG2: 0.9, ENG3: 0.25, ENG4: 0.12, ENG5: 0.06, ESP1: 3.2, ESP2: 0.35, ESP3: 0.08, ESP4: 0.04, ITA1: 2.6, ITA2: 0.4, ITA3: 0.1, GER1: 3.0, GER2: 0.5, GER3: 0.12,
    FRA1: 1.6, FRA2: 0.25, FRA3: 0.07, POR1: 1.0, POR2: 0.12, POR3: 0.05, NED1: 0.9, NED2: 0.15, BEL1: 0.7, BEL2: 0.12, SCO1: 0.5, SCO2: 0.1, SCO3: 0.04, TUR1: 1.3, TUR2: 0.15, GRE1: 0.6,
    SUI1: 0.5, AUT1: 0.5, DEN1: 0.45, SWE1: 0.3, NOR1: 0.3, POL1: 0.35, CZE1: 0.3, RUS1: 0.8, UKR1: 0.3,
    BRA1: 0.45, BRA2: 0.12, BRA3: 0.04, BRA4: 0.02, ARG1: 0.2, ARG2: 0.06, ARG3: 0.03, ARG4: 0.015, CHI1: 0.14, CHI2: 0.045, CHI3: 0.015, CHI4: 0.008,
    URU1: 0.08, URU2: 0.025, COL1: 0.12, COL2: 0.03, PER1: 0.07, ECU1: 0.09, MEX1: 0.5, MEX2: 0.08, USA1: 0.55, USA2: 0.14,
    JPN1: 0.35, JPN2: 0.1, JPN3: 0.04, KOR1: 0.25, KOR2: 0.06, CHN1: 0.8, KSA1: 2.5, AUS1: 0.12, EGY1: 0.2, MAR1: 0.12, QAT1: 1.0, UAE1: 0.6, IRN1: 0.15, IND1: 0.12, THA1: 0.15
  };
  // ligas sin referencia: se deduce del peso económico del país y de la categoría
  var TIERX = { 1: 1, 2: 0.2, 3: 0.06, 4: 0.025, 5: 0.012 };
  W.ref = function (lgId) {
    if (W.REF[lgId] != null) return W.REF[lgId];
    var def = FP.LGDEF[lgId], cw = FP.DATA.countries[def.c], w = cw ? cw.w : 0.5, top = U.clamp(0.1 * Math.pow(w / 0.35, 2.2), 0.03, 6);
    return Math.max(0.005, top * (TIERX[def.t] || 0.01));
  };
  // curva de sueldo con el valor del jugador (k€): crece algo menos que el valor

  // masa salarial aproximada de los clubes conocidos por liga: W.BUDGET[liga][club] (js/sueldos-datos.js). El resto se deduce del valor de su plantilla y su economía
  W.BUDGET = {};
  var BPY = 25;        // jugadores que se reparten la masa salarial

  var cache = { key: null, clubs: {}, lg: {}, sq: {} };
  function yearKey() { return FP.S.seed + '|' + D.year(FP.S.week); }
  function fresh() { var k = yearKey(); if (cache.key !== k) cache = { key: k, clubs: {}, lg: {}, sq: {} }; }
  function squadValue(c) { return (FP.S.ro[c.id] || []).reduce(function (a, p) { return p.i === 0 ? a : a + C.value(p.o, p.pt, C.age(p)); }, 0); }
  // presupuesto relativo de cada club de una liga, normalizado a media 1 (así el sueldo medio de la liga es siempre la referencia)
  function leagueIdx(lgId) {
    if (cache.lg[lgId]) return cache.lg[lgId];
    var cl = FP.S.clubs.filter(function (c) { return c.lg === lgId; }), sv = cl.map(squadValue), mean = sv.reduce(function (a, b) { return a + b; }, 0) / Math.max(1, cl.length) || 1, raw = {}, sum = 0;
    var tab = W.BUDGET[lgId] || {}, known = cl.map(function (c) { return tab[c.nm]; }).filter(function (x) { return x != null; }).sort(function (a, b) { return a - b; }), med = known.length ? known[Math.floor(known.length / 2)] : 1;
    cl.forEach(function (c, i) {
      var r = tab[c.nm];       // clubes fuera de la tabla: relativos a la mediana de los conocidos de su liga
      if (r == null) r = med * Math.pow(Math.max(sv[i], mean * 0.1) / mean, 0.5) * (0.8 + 0.04 * U.clamp(c.fin || 5, 1, 10));
      raw[c.id] = r; sum += r;
    });
    var m = sum / Math.max(1, cl.length) || 1, out = {}; cl.forEach(function (c) { out[c.id] = raw[c.id] / m; });
    return cache.lg[lgId] = out;
  }
  // cuántas veces la masa de un club de la liga media es la suya (≥ 1 en los clubes ricos)
  W.richness = function (club) { return leagueIdx(club.lg)[club.id] || 1; };
  // masa salarial anual del club (k€)
  W.bill = function (club) {
    fresh(); if (cache.clubs[club.id] != null) return cache.clubs[club.id];
    var idx = leagueIdx(club.lg)[club.id] || 1;
    return cache.clubs[club.id] = W.ref(club.lg) * 1000 * BPY * idx;
  };
  // valores de la plantilla (sin el jugador) y su media: cada jugador se compara con la media de su propio club
  function leagueMean(lg) {
    if (cache.lgm == null) cache.lgm = {};
    if (cache.lgm[lg] == null) { var s = 0, n = 0; FP.S.clubs.forEach(function (c) { if (c.lg === lg) (FP.S.ro[c.id] || []).forEach(function (p) { if (p.i !== 0) { s += C.value(p.o, p.pt, C.age(p)); n++; } }); }); cache.lgm[lg] = n ? Math.max(s / n, 20) : 300; }
    return cache.lgm[lg];
  }
  // la referencia de cada club es el punto medio (geométrico) entre la media de su plantel y la de su liga: un suplente de un grande
  // no cobra como un desconocido, ni una figura de un club chico como una estrella mundial
  function squadVals(club) {
    fresh(); if (cache.sq[club.id] != null) return cache.sq[club.id];
    var vs = []; (FP.S.ro[club.id] || []).forEach(function (p) { if (p.i !== 0) vs.push(C.value(p.o, p.pt, C.age(p))); });
    var mo = vs.length ? vs.reduce(function (a, b) { return a + b; }, 0) / vs.length : 300, m = Math.sqrt(Math.max(mo, 20) * leagueMean(club.lg));
    while (vs.length < BPY - 1) vs.push(mo);
    return cache.sq[club.id] = { m: m, w: vs.reduce(function (a, v) { return a + Math.pow(Math.max(v, 5) / m, W.BETA); }, 0) };
  }
  // sueldo anual (k€) de un jugador de ese valor (k€) en ese club: su parte de la masa salarial. Las figuras del plantel (valor muy por encima
  // de la media del club) se llevan una parte desproporcionada (BETA > 1). Ningún jugador cobra más del 15 % de la masa ni más de 2,5 veces
  // su valor al año; el mínimo es la décima parte del sueldo medio del club.
  W.BETA = 1.35;
  W.wage = function (value, club) {
    var bill = W.bill(club), sq = squadVals(club), h = Math.pow(Math.max(value, 5) / sq.m, W.BETA), raw = bill * h / (sq.w + h), floor = Math.min(bill * 0.15, Math.max(bill / BPY * 0.1, value * 0.1 * U.clamp(W.richness(club) - 1, 0, 2))), cap = Math.max(floor, Math.min(bill * 0.15, value * 4));
    return Math.max(2, Math.round(Math.min(Math.max(raw, floor), cap)));
  };
  // sueldo medio del plantel del club (k€ al año)
  W.clubAverage = function (club) { return Math.round(W.bill(club) / BPY); };
  W.monthly = function (annual) { return Math.round(annual / 12); };
  // «850 mil € al año (71 mil € al mes)»
  W.fmt = function (annual) { return FP.fmt.money(annual) + ' al año (' + FP.fmt.money(W.monthly(annual)) + ' al mes)'; };

  // ---------- conexión: ofertas, renovaciones y representados ----------
  var rep0 = Rep && Rep.wage;
  W.off = false;      // true restaura el cálculo anterior (para comparar en pruebas)
  if (Rep) Rep.wage = function (club, factor) {
    if (W.off) return rep0.apply(this, arguments);
    var val = M.heroValue(), lg = FP.LGDEF[club.lg];
    var gulf = { KSA: 1, QAT: 1, UAE: 1, CHN: 1 }[club.c] && lg.t === 1 && FP.Hero.age() >= 30 ? 1.25 : 1;   // la liga ya paga más; el «retiro dorado» de los veteranos suma algo
    return Math.max(2, Math.round(W.wage(val, club) * gulf * (factor || 1) * M.agentMult()));
  };
  if (FP.Agency) FP.Agency.comm = function (q, club, fee) { return Math.round(W.wage(C.value(q.o, q.pt, C.age(q)), club) * 0.15 + (fee || 0) * 0.02); };
  if (FP.Post) { var ps0 = FP.Post.wageEst; FP.Post.wageEst = function (pl) { var club = FP.S.clubs[pl.c]; return club ? W.wage(C.value(pl.o, pl.pt, C.age(pl)), club) : ps0.apply(this, arguments); }; }
})();
