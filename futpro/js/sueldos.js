/* FUTPRO — sueldos realistas: cada club tiene una masa salarial y el jugador cobra su parte según su valor.
   masa del club = sueldo medio de su liga (REF, M€ al año) × 25 jugadores × presupuesto relativo del club (BUDGET si es conocido; si no, valor de su plantilla y economía),
   normalizado para que la media de la liga sea la referencia. Un grande de Chile paga más que un club de Primera B, y nadie cobra más de la parte máxima de la masa. Las referencias son aproximaciones de diseño (de memoria), no datos oficiales.
   Cambia solo cómo se calculan sueldos de ofertas, renovaciones y representados; no modifica partidos, valores ni el guardado. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, M = FP.Market, Rep = FP.Rep;
  var W = FP.Wages = {};

  // sueldo medio de un futbolista del primer equipo, en k€ al año (aproximaciones de diseño hechas de memoria, no datos oficiales).
  // Las ligas cuyos clubes están en js/sueldos-datos.js usan en cambio el promedio de esa tabla (W.ref), para que ambas coincidan
  var REFK = {
    ENG1: 7200, ENG2: 1350, ENG3: 350, ENG4: 170, ENG5: 80, ESP1: 4000, ESP2: 680, ESP3: 120, ESP4: 60, ITA1: 3350, ITA2: 460, ITA3: 90, GER1: 3370, GER2: 740, GER3: 170,
    FRA1: 2600, FRA2: 350, FRA3: 80, POR1: 970, POR2: 100, POR3: 30, NED1: 900, NED2: 90, BEL1: 880, BEL2: 120, SCO1: 780, SCO2: 100, SCO3: 40, TUR1: 1240, TUR2: 150, GRE1: 560, GRE2: 70,
    SUI1: 570, SUI2: 90, SUI3: 30, AUT1: 570, AUT2: 70, DEN1: 470, DEN2: 70, DEN3: 25, SWE1: 320, SWE2: 40, NOR1: 300, NOR2: 45, POL1: 370, POL2: 40, POL3: 15, CZE1: 335, CZE2: 30, RUS1: 900, RUS2: 90, UKR1: 330, UKR2: 25,
    HRV1: 180, HRV2: 30, SRB1: 140, SRB2: 20, ROU1: 150, ROU2: 30, HUN1: 100, HUN2: 25, BUL1: 80, BUL2: 15, ISR1: 150, ISR2: 30, CYP1: 70, IRL1: 40, IRL2: 12, WAL1: 25, FIN1: 50, FIN2: 15, ISL1: 40, ISL2: 8,
    BRA1: 1350, BRA2: 220, BRA3: 60, BRA4: 25, ARG1: 395, ARG2: 45, ARG3: 12, ARG4: 6, CHI1: 110, CHI2: 38, CHI3: 10, CHI4: 5, URU1: 95, URU2: 25, PAR1: 100, COL1: 170, COL2: 30, PER1: 120, PER2: 20, ECU1: 125, ECU2: 25, BOL1: 90, VEN1: 60,
    MEX1: 710, MEX2: 80, USA1: 800, USA2: 100, CAN1: 80, CRC1: 80, HON1: 25, PAN1: 25, GUA1: 25, SLV1: 20, JAM1: 20,
    JPN1: 520, JPN2: 120, JPN3: 40, KOR1: 415, KOR2: 70, CHN1: 900, KSA1: 2540, AUS1: 175, QAT1: 690, QAT2: 150, UAE1: 590, UAE2: 120, IRN1: 110, IRN2: 40, UZB1: 100, UZB2: 20, IND1: 100, IND2: 25, THA1: 120, THA2: 45,
    EGY1: 335, MAR1: 185, RSA1: 280, TUN1: 50, ALG1: 40
  };
  W.REF = {}; Object.keys(REFK).forEach(function (k) { W.REF[k] = REFK[k] / 1000; });
  // ligas sin referencia: se deduce del peso económico del país y de la categoría
  var TIERX = { 1: 1, 2: 0.2, 3: 0.06, 4: 0.025, 5: 0.012 };
  W.ref = function (lgId) {
    var tab = W.BUDGET && W.BUDGET[lgId];
    if (tab) { var v = Object.keys(tab).map(function (k) { return tab[k]; }); return v.reduce(function (a, b) { return a + b; }, 0) / v.length / 28; }      // masa media de la tabla ÷ 28 jugadores con ficha
    if (W.REF[lgId] != null) return W.REF[lgId];
    var def = FP.LGDEF[lgId], cw = FP.DATA.countries[def.c], w = cw ? cw.w : 0.5, top = U.clamp(0.1 * Math.pow(w / 0.35, 2.2), 0.03, 6);
    return Math.max(0.005, top * (TIERX[def.t] || 0.01));
  };
  // curva de sueldo con el valor del jugador (k€): crece algo menos que el valor

  // masa salarial aproximada de los clubes conocidos por liga: W.BUDGET[liga][club] (js/sueldos-datos.js). El resto se deduce del valor de su plantilla y su economía
  W.BUDGET = {};
  var BPY = 25;
  // parte máxima de la masa que puede llevarse un solo jugador: en las divisiones bajas las diferencias entre figura y plantel son menores
  var CAPSHARE = { 1: 0.15, 2: 0.10, 3: 0.08 };
  W.capShare = function (club) { return CAPSHARE[FP.LGDEF[club.lg].t] || 0.06; };        // jugadores que se reparten la masa salarial

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
  // de la media del club) se llevan una parte desproporcionada (BETA > 1). Ningún jugador cobra más de la parte máxima de la masa ni más de 2,5 veces
  // su valor al año; el mínimo es la décima parte del sueldo medio del club.
  W.BETA = 1.35;
  W.wage = function (value, club) {
    var bill = W.bill(club), sq = squadVals(club), h = Math.pow(Math.max(value, 5) / sq.m, W.BETA), raw = bill * h / (sq.w + h), floor = Math.min(bill * W.capShare(club), Math.max(bill / BPY * 0.1, value * 0.1 * U.clamp(W.richness(club) - 1, 0, 2))), cap = Math.max(floor, Math.min(bill * W.capShare(club), value * 4));
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
    // el techo por jugador también vale con los factores de rol y de agente: un club no paga a una sola persona más de su parte máxima de la masa
    return Math.max(2, Math.round(Math.min(W.wage(val, club) * gulf * (factor || 1) * M.agentMult(), Math.max(W.bill(club) * W.capShare(club) * gulf, 2))));
  };
  if (FP.Agency) FP.Agency.comm = function (q, club, fee) { return Math.round(W.wage(C.value(q.o, q.pt, C.age(q)), club) * 0.15 + (fee || 0) * 0.02); };
  if (FP.Post) { var ps0 = FP.Post.wageEst; FP.Post.wageEst = function (pl) { var club = FP.S.clubs[pl.c]; return club ? W.wage(C.value(pl.o, pl.pt, C.age(pl)), club) : ps0.apply(this, arguments); }; }
})();
