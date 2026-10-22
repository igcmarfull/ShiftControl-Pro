/* FUTPRO — núcleo: posiciones, atributos, valor de mercado, generación del mundo */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R;

  var POS = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'];
  var POS_ES = { GK: 'POR', CB: 'DFC', LB: 'LI', RB: 'LD', DM: 'MCD', CM: 'MC', AM: 'MCO', LW: 'EI', RW: 'ED', ST: 'DC' };
  var POS_NAME = { GK: 'Portero', CB: 'Defensa central', LB: 'Lateral izquierdo', RB: 'Lateral derecho', DM: 'Mediocentro defensivo', CM: 'Mediocentro', AM: 'Mediapunta', LW: 'Extremo izquierdo', RW: 'Extremo derecho', ST: 'Delantero centro' };
  var POS_GRP = { GK: 'G', CB: 'D', LB: 'D', RB: 'D', DM: 'M', CM: 'M', AM: 'M', LW: 'F', RW: 'F', ST: 'F' };
  var TEMPLATE = ['GK', 'GK', 'CB', 'CB', 'CB', 'LB', 'RB', 'DM', 'CM', 'CM', 'AM', 'LW', 'RW', 'ST', 'ST', 'CB', 'LB', 'RB', 'CM', 'GK', 'LW', 'RW', 'ST', 'DM', 'AM'];

  var ATTRS = ['vel', 'ace', 'res', 'fue', 'fin', 'rem', 'cab', 'pas', 'reg', 'con', 'vis', 'pos', 'ant', 'com', 'dfn', 'dis'];
  var ATTR_NAME = { vel: 'Velocidad', ace: 'Aceleración', res: 'Resistencia', fue: 'Fuerza', fin: 'Definición', rem: 'Remate', cab: 'Cabezazo', pas: 'Pase', reg: 'Regate', con: 'Control', vis: 'Visión', pos: 'Posicionamiento', ant: 'Anticipación', com: 'Compostura', dfn: 'Defensa', dis: 'Disciplina' };
  var ATTR_GRP = { vel: 'Físico', ace: 'Físico', res: 'Físico', fue: 'Físico', fin: 'Técnico', rem: 'Técnico', cab: 'Técnico', pas: 'Técnico', reg: 'Técnico', con: 'Técnico', vis: 'Mental', pos: 'Mental', ant: 'Mental', com: 'Mental', dfn: 'Defensa', dis: 'Mental' };

  var WRAW = {
    ST: { fin: 16, rem: 10, cab: 7, pos: 12, com: 9, vel: 8, ace: 7, fue: 8, reg: 6, con: 7, ant: 4, vis: 2, pas: 2, res: 2 },
    LW: { vel: 12, ace: 10, reg: 12, con: 8, pas: 6, rem: 7, fin: 8, vis: 5, pos: 6, res: 4, com: 4, ant: 3, fue: 2, cab: 1 },
    AM: { pas: 12, vis: 12, con: 10, reg: 10, rem: 7, fin: 6, com: 8, pos: 7, ant: 4, ace: 5, vel: 4, res: 3, fue: 2 },
    CM: { pas: 11, vis: 9, con: 8, res: 10, ant: 8, dfn: 6, pos: 6, com: 6, reg: 5, fue: 6, ace: 3, vel: 3, dis: 6, rem: 3 },
    DM: { dfn: 14, ant: 12, pas: 8, res: 10, fue: 9, pos: 7, com: 6, dis: 8, con: 6, vis: 5, vel: 3, ace: 2, cab: 4 },
    CB: { dfn: 18, ant: 12, fue: 12, cab: 10, pos: 9, dis: 8, com: 6, vel: 5, ace: 3, res: 5, pas: 4, con: 3, vis: 2 },
    LB: { vel: 11, res: 11, dfn: 11, ace: 8, ant: 8, pas: 7, reg: 5, con: 5, pos: 6, dis: 6, vis: 3, fue: 6, com: 4, cab: 3 },
    GK: { ant: 25, pos: 25, com: 20, dfn: 15, fue: 5, dis: 5, vis: 5 }
  };
  WRAW.RW = WRAW.LW; WRAW.RB = WRAW.LB;
  var WN = {};
  Object.keys(WRAW).forEach(function (p) {
    var t = 0, k; for (k in WRAW[p]) t += WRAW[p][k];
    WN[p] = {}; for (k in WRAW[p]) WN[p][k] = WRAW[p][k] / t;
  });
  function ovrOf(at, pos) {
    var w = WN[pos] || WN.CM, s = 0, k;
    for (k in w) s += (at[k] || 0) * w[k];
    return s;
  }

  var Core = FP.Core = {
    POS: POS, POS_ES: POS_ES, POS_NAME: POS_NAME, POS_GRP: POS_GRP, ATTRS: ATTRS, ATTR_NAME: ATTR_NAME, ATTR_GRP: ATTR_GRP, WN: WN, TEMPLATE: TEMPLATE,
    ovrOf: ovrOf,
    WEEKS_YEAR: 52.1775,
    age: function (p, w) { return Math.floor(((w == null ? FP.S.week : w) - p.b) / 52.1775); },
    ageF: function (p, w) { return ((w == null ? FP.S.week : w) - p.b) / 52.1775; },
    // Valor de mercado estimado en miles de euros
    value: function (o, pt, age) {
      var pw = age <= 16 ? 0.75 : age >= 27 ? 0 : 0.75 * (27 - age) / 11;
      var e = o + (pt - o) * pw, x = Math.max(e - 40, 2);
      var v = Math.exp(4.58 - 0.014 * x + 0.0035 * x * x);
      if (e < 42) v *= Math.pow(Math.max(e, 20) / 42, 6);
      var am = age <= 27 ? 1 : age <= 29 ? 0.85 : age <= 31 ? 0.6 : age <= 33 ? 0.3 : 0.12;
      if (age < 21) am *= age <= 14 ? 0.03 : age <= 15 ? 0.06 : age <= 16 ? 0.12 : age <= 17 ? 0.22 : age <= 18 ? 0.4 : age <= 19 ? 0.6 : 0.8;
      return Math.max(5, Math.round(v * am / 5) * 5);
    },
    // Sueldo anual estimado (miles de euros) según nivel de la liga
    wage: function (v, cw) { return Math.max(3, Math.round(0.26 * Math.pow(v, 0.95) * (0.45 + 0.55 * (cw || 0.5)))); },
    team: function (id) {
      var S = FP.S;
      if (id >= 30000) { var yc = S.clubs[id - 30000]; return yc ? { id: id, nm: yc.nm + ' (juv.)', c: yc.c, st: yc.st } : null; }
      if (id >= 20000) return S.amat[id - 20000];
      if (id >= 5000) return S.nat[id - 5000];
      return S.clubs[id];
    },
    tname: function (id) { var t = Core.team(id); return t ? t.nm : '—'; },
    isClub: function (id) { return id < 5000; },
    isNat: function (id) { return id >= 5000 && id < 20000; },
    isAmat: function (id) { return id >= 20000 && id < 30000; },
    lgDef: function (id) { return FP.LGDEF[id]; },
    cname: function (code) { var c = FP.DATA.countries[code]; if (c) return c.n; var n = FP.NATBY[code]; return n ? n.n : code; },

    // ---------- generación de jugadores del mundo ----------
    foreignP: function (c) { var top = { ENG: 0.42, ESP: 0.3, ITA: 0.4, GER: 0.38, FRA: 0.38, POR: 0.4, NED: 0.4, BEL: 0.42, SCO: 0.4, TUR: 0.35, KSA: 0.5, USA: 0.3, CHI: 0.12, ARG: 0.08, BRA: 0.05, MEX: 0.1 }; return top[c] != null ? top[c] : 0.2; },
    foreignNat: function (club) {
      var conf = FP.DATA.countries[club.c].conf, pool = FP.S.natPool;
      var same = R() < 0.65;
      var arr = pool.filter(function (n) { return n.c !== club.c && (same ? n.conf === conf : true); });
      return U.wpick(arr, function (n) { return Math.exp(n.r / 14); }).c;
    },
    genPlayer: function (club, pos, tier, ageForced) {
      var S = FP.S, lg = FP.LGDEF[club.lg], age;
      if (ageForced) age = ageForced;
      else { age = Math.round(18 + 18 * (R() + R() + R()) / 3 * 0.9 + (R() - 0.5) * 2); age = U.clamp(age, 17, 37); if (age > 34 && R() < 0.6) age -= 4; }
      var mu = lg.q + club.ra + (tier === 0 ? 1.5 : tier === 1 ? -1 : -3);
      var base = mu + U.norm() * 3.2;
      var pen = age < 25 ? (25 - age) * 1.1 : 0, dec = age > 31 ? (age - 31) * 0.8 : 0;
      var o = U.clamp(Math.round(base - pen - dec), 28, 94);
      var gap = age <= 20 ? 5 + R() * 9 : age <= 23 ? 2 + R() * 7 : age <= 26 ? R() * 3 : 0;
      var pt = Math.min(97, Math.round(o + gap));
      var nat = R() < Core.foreignP(club.c) ? Core.foreignNat(club) : club.c;
      var y = FP.Date.year(S.week);
      var p = {
        i: S.pl.length, n: FP.Names.gen(nat), b: Math.round(S.week - (age + R()) * 52.1775), p: pos, o: o, pt: pt,
        c: club.id, ce: y + U.int(0, 4) + (age < 20 ? 1 : 0), nat: nat
      };
      S.pl.push(p);
      return p;
    },
    // ---------- creación del mundo ----------
    newWorld: function (seed) {
      var D = FP.DATA, S = FP.S = {
        ver: 1, y0: FP.Date.y0, seed: seed, rs: seed | 0, week: 0, clubs: [], pl: [0], lgs: {}, nat: [], amat: [], comps: {}, news: [], hist: { champs: [], awards: [] },
        cfg: { activeAll: true, off: {} }, log: []
      };
      FP.LGDEF = {}; D.leagues.forEach(function (l) { FP.LGDEF[l.id] = l; });
      FP.NATBY = {}; D.nations.forEach(function (n) { FP.NATBY[n.c] = n; });
      S.natPool = D.nations.map(function (n) { return { c: n.c, conf: n.conf, r: n.r }; });
      D.nations.forEach(function (n, i) { S.nat.push({ id: 5000 + i, c: n.c, nm: n.n, conf: n.conf, r: n.r, pr: n.r }); });
      D.leagues.forEach(function (l) { Core.addLeague(l); });
      S.clubs.forEach(function (club) { Core.fillSquad(club); });
      Core.rebuildRoster();
      S.clubs.forEach(Core.calcStr);
      if (FP.Wages && FP.Wages.ensureAll) FP.Wages.ensureAll();
      return S;
    },
    // crea los clubes de una liga (sin plantillas: ver fillSquad)
    addLeague: function (l, onlyNames) {
      var S = FP.S, names = l.clubs.split(';'), n = names.length, made = [];
      if (!S.lgs[l.id]) S.lgs[l.id] = { id: l.id, teams: [], on: true, y: 0, cmp: null, hist: [] };
      names.forEach(function (nm, i) {
        if (onlyNames && S.clubs.some(function (c) { return c.nm === nm && c.c === l.c; })) return;
        var z = n > 1 ? (n - 1 - 2 * i) / (n - 1) : 0;
        var club = {
          id: S.clubs.length, nm: nm, c: l.c, lg: l.id, ra: Math.round((z * (l.sp || 6) + U.norm() * 1.2) * 10) / 10,
          ac: U.clamp(Math.round(1 + (l.q - 42) / 11 + z * 0.9 + U.norm() * 0.5), 1, 5),
          fin: U.clamp(Math.round(4 + (l.q - 52) / 6 + z * 2.2 + U.norm()), 1, 10),
          co: FP.Names.gen(l.c), cs: -U.int(5, 200), st: 0, pt: 0, fm: U.wpick(['4-3-3', '4-4-2', '4-2-3-1', '3-5-2'], function (f) { return f === '4-3-3' ? 3 : f === '4-4-2' ? 3 : f === '4-2-3-1' ? 2.5 : 1; })
        };
        S.clubs.push(club); S.lgs[l.id].teams.push(club.id); made.push(club);
      });
      return made;
    },
    fillSquad: function (club) {
      var lg = FP.LGDEF[club.lg], sz = lg.q >= 55 ? 25 : lg.q >= 45 ? 23 : 21;
      for (var i = 0; i < sz; i++) Core.genPlayer(club, TEMPLATE[i], i < 14 ? 0 : 1);
    },
    rebuildRoster: function () {
      var S = FP.S, ro = S.ro = {};
      for (var i = 0; i < S.pl.length; i++) {
        var p = S.pl[i]; if (!p || p.c < 0) continue;
        (ro[p.c] || (ro[p.c] = [])).push(p);
      }
    },
    roster: function (id) { return FP.S.ro[id] || (FP.S.ro[id] = []); },
    // Fortaleza: media de los mejores 11 (1 POR, 4 DEF, 3 MED, 3 DEL) + profundidad
    calcStr: function (club) {
      var r = Core.roster(club.id), g = { G: [], D: [], M: [], F: [] }, i;
      for (i = 0; i < r.length; i++) { var p = r[i]; if (p.inj > 0 && p.i !== 0) { g[POS_GRP[p.p]].push(p.o - 3); } else g[POS_GRP[p.p]].push(p.o); }
      var need = { G: 1, D: 4, M: 3, F: 3 }, sum = 0, cnt = 0, rest = [];
      Object.keys(need).forEach(function (k) {
        var a = g[k].sort(function (x, y) { return y - x; });
        for (var j = 0; j < need[k]; j++) { if (j < a.length) { sum += a[j]; cnt++; } else { sum += 35; cnt++; } }
        for (j = need[k]; j < a.length; j++) rest.push(a[j]);
      });
      rest.sort(function (x, y) { return y - x; });
      var depth = 0; for (i = 0; i < Math.min(5, rest.length); i++) depth += rest[i];
      depth = rest.length ? depth / Math.min(5, rest.length) : 40;
      club.st = Math.round(((sum / cnt) * 0.93 + depth * 0.07) * 10) / 10;
      return club.st;
    },
    nationStr: function (n) { return n.r - 6; },
    strOf: function (id) {
      var t = Core.team(id);
      if (!t) return 40;
      if (id >= 20000) return t.st;
      if (id >= 5000) return Core.nationStr(t);
      return t.st;
    },
    // Fuerza de equipos juveniles de un club para una categoría de edad
    youthStr: function (club, age) {
      var f = { 12: 0.86, 13: 0.89, 14: 0.92, 15: 0.94, 16: 0.96, 17: 0.98, 18: 0.99 }[Math.min(18, Math.max(12, age))] || 1;
      var lg = FP.LGDEF[club.lg];
      return Math.round(((lg.q + club.ra * 0.8) * f - 1) * 10) / 10;
    }
  };
})();
