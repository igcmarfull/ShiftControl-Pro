/* FUTPRO — registro estadístico del jugador por temporada, club y competición.
   Cada fila agrupa (temporada, equipo, competición) y se clasifica en una clase: liga, copa, continental de clubes,
   juvenil, amateur, amistosos, y una clase por categoría de selección (Sub-15, Sub-17, Sub-20, Sub-23, absoluta).
   Las clases nunca se mezclan entre sí. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date;
  var Stats = FP.Stats = {};

  Stats.CLASSES = {
    liga: 'Liga', copa: 'Copas nacionales', cont: 'Torneos internacionales de clubes', juv: 'Competiciones juveniles', amat: 'Fútbol amateur', amis: 'Amistosos de club',
    u15: 'Selección Sub-15', u17: 'Selección Sub-17', u20: 'Selección Sub-20', u23: 'Selección Sub-23', abs: 'Selección adulta'
  };
  Stats.ORDER = ['liga', 'copa', 'cont', 'juv', 'amat', 'amis', 'u15', 'u17', 'u20', 'u23', 'abs'];
  Stats.classOf = function (comp) {
    if (comp.cat) return { U15: 'u15', U17: 'u17', U20: 'u20', U23: 'u23', ABS: 'abs' }[comp.cat];
    switch (comp.kind) {
      case 'K': return /^FIN:/.test(comp.id) ? 'amat' : 'liga';
      case 'L': return 'liga';
      case 'C': return 'copa';
      case 'X': case 'Q': return comp.nat ? 'abs' : 'cont';
      case 'Y': return 'juv';
      case 'A': return 'amat';
      case 'F': return 'amis';
      case 'N': return 'amis';
    }
    return 'liga';
  };
  Stats.isNT = function (cls) { return /^(u15|u17|u20|u23|abs)$/.test(cls); };
  Stats.compName = function (comp) { return String(comp.nm || '').replace(/\s*\d{4}(\/\d{2})?$/, ''); };
  function seasonLabelFor(comp, cls) {
    if (Stats.isNT(cls)) return String(comp.y || D.year(FP.S.week));
    if (comp.label) return String(comp.label).replace(/^(Apertura|Clausura)\s+/, '');
    return FP.Market.seasonLabel();
  }
  Stats.ensure = function () { var h = FP.S && FP.S.hero; if (h && !h.led) h.led = { rows: {} }; return h && h.led; };
  Stats.migrate = function () { Stats.ensure(); };
  // Registra un partido del jugador. hm: resultado individual del motor; result: 'V'|'E'|'D'
  Stats.record = function (prep, res, hm, result) {
    var S = FP.S, h = S.hero, led = Stats.ensure(), comp = prep.comp, cls = Stats.classOf(comp);
    var team = prep.mine, tn = C.tname(team), season = seasonLabelFor(comp, cls);
    var key = season + '|' + team + '|' + cls + '|' + Stats.compName(comp);
    var r = led.rows[key] || (led.rows[key] = { s: season, t: team, tn: tn, k: cls, c: Stats.compName(comp), p: 0, st: 0, min: 0, g: 0, a: 0, yc: 0, rc: 0, rs: 0, rn: 0, w: 0, d: 0, l: 0, sq: 0, n: 0, o: S.week });
    r.n++;                                    // partidos del equipo con el jugador disponible
    if (result === 'V') r.w++; else if (result === 'D') r.l++; else r.d++;
    if (!hm || !hm.played) { r.sq++; return; }  // convocado o no, sin minutos
    r.p++; if (!hm.subIn) r.st++;
    r.min += hm.min; r.g += hm.g; r.a += hm.a; r.yc += hm.yc; r.rc += hm.rc;
    if (hm.rating) { r.rs += hm.rating; r.rn++; }
    r.o = S.week;
  };
  // Filas ordenadas (más recientes primero)
  Stats.rows = function (filter) {
    var led = Stats.ensure(); if (!led) return [];
    return Object.keys(led.rows).map(function (k) { return led.rows[k]; }).filter(function (r) { return !filter || filter(r); }).sort(function (a, b) { return b.o - a.o; });
  };
  Stats.sum = function (rows) {
    var t = { p: 0, st: 0, min: 0, g: 0, a: 0, yc: 0, rc: 0, rs: 0, rn: 0, w: 0, d: 0, l: 0, n: 0 };
    rows.forEach(function (r) { for (var k in t) t[k] += r[k] || 0; });
    t.rt = t.rn ? t.rs / t.rn : 0; t.sub = t.p - t.st;
    return t;
  };
  Stats.byClass = function () {
    var out = {};
    Stats.ORDER.forEach(function (c) { var rows = Stats.rows(function (r) { return r.k === c; }); if (rows.length) out[c] = { rows: rows, tot: Stats.sum(rows) }; });
    return out;
  };
  // Temporadas del jugador agrupadas por club (para revisar qué pasó en cada una)
  Stats.seasons = function () {
    var by = {}, order = [];
    Stats.rows().forEach(function (r) { var k = r.s + '|' + r.t; if (!by[k]) { by[k] = { s: r.s, t: r.t, tn: r.tn, rows: [], o: r.o }; order.push(k); } by[k].rows.push(r); by[k].o = Math.max(by[k].o, r.o); });
    return order.map(function (k) { by[k].tot = Stats.sum(by[k].rows.filter(function (r) { return !Stats.isNT(r.k); })); return by[k]; }).sort(function (a, b) { return b.o - a.o; });
  };
})();
