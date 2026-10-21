/* FUTPRO — sueldos realistas: cada liga paga distinto y dentro de la liga los clubes ricos pagan más.
   sueldo = valor del jugador (con su curva) × escala de la liga × factor de economía del club.
   La escala de cada liga se calibra con el mundo del propio juego: el sueldo MEDIO de un jugador de la liga coincide con una referencia
   (REF, en M€ por año) usando el valor medio real de sus plantillas. Así no importa cuánto valgan los jugadores simulados: la liga paga
   lo que debe y los jugadores caros ganan más que los baratos. Las referencias son aproximaciones de diseño (de memoria), no datos oficiales.
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
    BRA1: 0.45, BRA2: 0.12, BRA3: 0.04, BRA4: 0.02, ARG1: 0.2, ARG2: 0.06, ARG3: 0.03, ARG4: 0.015, CHI1: 0.1, CHI2: 0.035, CHI3: 0.015, CHI4: 0.008,
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
  W.ALPHA = 0.9;       // el sueldo crece menos que el valor: las figuras ganan más, pero no en proporción al precio
  function curve(v) { return 0.2 * Math.pow(Math.max(v, 5), W.ALPHA); }
  // clubes ricos pagan más por el mismo jugador: economía 1-10 → ×0,55 a ×1,45
  W.finFactor = function (club) { return 0.45 + 0.1 * U.clamp(club.fin || 5, 1, 10); };

  var cache = { key: null, idx: {} };
  function yearKey() { return FP.S.seed + '|' + D.year(FP.S.week); }
  // escala de la liga: la que hace que el sueldo medio del plantel sea la referencia
  W.leagueScale = function (lgId) {
    var key = yearKey(); if (cache.key !== key) cache = { key: key, idx: {} };
    if (cache.idx[lgId] != null) return cache.idx[lgId];
    var S = FP.S, sum = 0, n = 0;
    S.clubs.forEach(function (c) {
      if (c.lg !== lgId) return; var ff = W.finFactor(c);
      (S.ro[c.id] || []).forEach(function (p) { if (p.i === 0) return; sum += curve(C.value(p.o, p.pt, C.age(p))) * ff; n++; });
    });
    var mean = n ? sum / n : 0, s = mean > 0 ? W.ref(lgId) * 1000 / mean : 1;       // la referencia está en M€; el sueldo, en k€
    return cache.idx[lgId] = U.clamp(s, 0.02, 400);
  };
  // sueldo anual (k€) de un jugador de ese valor (k€) en ese club
  // sueldo mínimo de la liga (10 % del sueldo medio) y techo de cordura (dos veces el valor del jugador al año: en ligas
  // donde los valores simulados son muy bajos, la figura de la liga cobra por encima de su valor, como los jugadores franquicia)
  W.wage = function (value, club) {
    var raw = curve(value) * W.leagueScale(club.lg) * W.finFactor(club), floor = W.ref(club.lg) * 100 * W.finFactor(club);
    return Math.max(2, Math.round(Math.min(Math.max(raw, floor), Math.max(2, value * 2))));
  };
  // sueldo medio estimado de la plantilla de un club (k€)
  W.clubAverage = function (club) {
    var ps = (FP.S.ro[club.id] || []).filter(function (p) { return p.i !== 0; }); if (!ps.length) return 0;
    return Math.round(ps.reduce(function (a, p) { return a + W.wage(C.value(p.o, p.pt, C.age(p)), club); }, 0) / ps.length);
  };

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
