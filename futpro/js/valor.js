/* FUTPRO — valor de mercado según rendimiento.
   El valor base de tu jugador (nivel, potencial estimado y edad, js/core.js) se ajusta con lo que el mercado ve de él:
   forma reciente (temporadas evaluadas en contexto por FP.Narr: posición, nivel de la competición y minutos), distinciones y títulos
   de los últimos tres años (con peso decreciente), rol en el equipo y presencia en la selección absoluta.
   Solo afecta a tu jugador y se calcula al consultarse (memorizado por semana): no añade trabajo semanal ni estado guardado.
   Los pesos son supuestos de diseño, no datos reales; sus rangos se comprueban en tests/valor.js. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, M = FP.Market;
  var V = FP.Valor = {};

  V.CFG = {
    zForm: 0.10, formMin: -0.15, formMax: 0.30,             // cada punto de z de forma reciente mueve el valor un 10 %
    window: 104,                                            // semanas de forma que cuentan (dos años); lo más reciente pesa más
    honourWeeks: 156, awardK: 0.22, titleK: 0.12, honourMax: 0.35,   // distinciones y títulos: caen a cero en tres años
    role: { 'titular indiscutible': 0.04, 'titular habitual': 0.02, 'rotación': 0, 'suplente': -0.06, 'sin minutos': -0.06 },
    nt: [[8, 0.04], [3, 0.02]],                             // partidos con la absoluta en la ventana → bonificación
    lo: 0.8, hi: 1.8                                        // límites del multiplicador total
  };
  // los jóvenes se valoran sobre todo por su potencial; con los veteranos pesa más lo reciente
  function ageW(age) { return age <= 19 ? 0.5 : age <= 21 ? 0.7 : age <= 28 ? 1 : 1.1; }

  var cache = null;
  // la memoria se invalida al cambiar la semana, el nivel, los premios o cualquier cifra del registro (un partido jugado dentro de la misma semana)
  function sig() { var h = FP.S.hero, rows = (h.led && h.led.rows) || {}, sum = 0, n = 0; for (var k in rows) { var r = rows[k]; sum += r.p + 7 * r.g + 13 * r.a + r.min * 0.01; n++; } return FP.S.week + '|' + n + '|' + Math.round(sum * 100) + '|' + (h.awards || []).length + '|' + (h.trophies || []).length + '|' + Math.round(h.ovr * 10); }

  V.compute = function () {
    var S = FP.S, h = S.hero, N = FP.Narr, cfg = V.CFG, now = S.week, age = FP.Hero.age(), parts = [], form = 0, hon = 0, role = 0, nt = 0;
    var base = V.base();
    // forma reciente: temporadas con muestra suficiente, evaluadas en su contexto
    var seas = (N && N.gather ? N.gather() : []).filter(function (s) { return s.all.p > 0 && now - s.o <= cfg.window && s.perf.sample !== 'escasa'; }), wsum = 0, zsum = 0, lastPro = null;
    seas.forEach(function (s) {
      // el nivel de la competición ya se aplicó al evaluar la temporada; el mercado lo descuenta otra vez porque en categorías bajas casi nadie lo mira
      var lvl = N ? (s.lv === 'pro' ? (N.LEVEL[s.tier] || N.LEVEL[4]) : N.LEVEL[s.lv]) : 1, rec = Math.max(0.2, 1 - (now - s.o) / cfg.window), wt = rec * s.L.min / (s.L.min + 600);
      wsum += wt; zsum += wt * s.perf.z * lvl; if (s.lv === 'pro') lastPro = s;
    });
    var zavg = wsum > 0 ? zsum / wsum : 0, conf = wsum > 0 ? Math.min(1, wsum / 0.8) : 0;     // con poca información reciente el ajuste se encoge
    form = U.clamp(cfg.zForm * zavg * conf, cfg.formMin, cfg.formMax);
    // distinciones y títulos recientes
    (h.awards || []).forEach(function (a) { if (a.w == null) return; var dt = Math.max(0, 1 - (now - a.w) / cfg.honourWeeks); if (dt > 0 && N) hon += N.awardWeight(a) / 100 * cfg.awardK * dt; });
    (h.trophies || []).forEach(function (t) { if (t.sub || t.w == null || t.preset) return; var dt = Math.max(0, 1 - (now - t.w) / cfg.honourWeeks); if (dt > 0 && N) hon += N.trophyWeight(t) / 100 * cfg.titleK * dt; });
    hon = Math.min(cfg.honourMax, hon);
    // rol en el equipo en la última temporada profesional
    if (lastPro && lastPro.L.p >= 8) role = cfg.role[lastPro.role] || 0;
    // selección absoluta
    var ntp = 0; FP.Stats.rows(function (r) { return r.k === 'abs' && now - r.o <= cfg.window; }).forEach(function (r) { ntp += r.p; });
    for (var i = 0; i < cfg.nt.length; i++) if (ntp >= cfg.nt[i][0]) { nt = cfg.nt[i][1]; break; }
    var w = ageW(age), mult = U.clamp(1 + w * (form + hon + role + nt), cfg.lo, cfg.hi);
    parts.push({ k: 'form', label: 'Forma reciente', v: w * form, why: wsum > 0 ? (zavg >= 0.9 ? 'rinde por encima de lo esperable en su puesto' : zavg >= 0.3 ? 'rinde algo mejor que el promedio de su puesto' : zavg > -0.4 ? 'rinde como se espera de su puesto' : 'rinde por debajo de lo esperable en su puesto') : 'sin temporadas recientes con muestra suficiente' });
    parts.push({ k: 'hon', label: 'Títulos y distinciones', v: w * hon, why: hon > 0 ? 'logros de los últimos tres años' : 'sin logros recientes' });
    parts.push({ k: 'role', label: 'Rol en el equipo', v: w * role, why: lastPro ? lastPro.role : 'sin temporada profesional reciente' });
    parts.push({ k: 'nt', label: 'Selección absoluta', v: w * nt, why: ntp ? ntp + ' partidos recientes' : 'sin partidos recientes' });
    return { base: base, mult: mult, parts: parts, value: V.round(base * mult), ageW: w };
  };
  V.round = function (x) { return Math.max(5, Math.round(x / 5) * 5); };
  // valor base: el cálculo original (nivel, potencial estimado y edad)
  V.base = function () { return V.base0(); };
  V.get = function () { var k = sig(); if (!cache || cache.k !== k) cache = { k: k, v: V.compute() }; return cache.v; };
  V.base0 = M.heroValue;
  M.heroValue = function () { try { return V.get().value; } catch (e) { return V.base0.apply(this, arguments); } };
})();
