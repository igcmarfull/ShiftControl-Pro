/* FUTPRO — motor de competiciones: ligas, tablas, eliminatorias, copas nacionales */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, D = FP.Date;

  var Comp = FP.Comp = {};

  // ---------- calendario ----------
  // Ventana de temporada: 'year' (feb-nov) | 'euro' (ago-may). Semana de descanso navideño en 'euro'.
  Comp.window = function (cal, y) {
    if (cal === 'euro') return { s: D.of(y, 7, 9), e: D.of(y + 1, 4, 24), brk: true };
    return { s: D.of(y, 1, 14), e: D.of(y, 10, 29), brk: false };
  };
  Comp.weeksFor = function (cal, y, rounds) {
    var wn = Comp.window(cal, y), list = [], w;
    for (w = wn.s; w <= wn.e; w++) {
      if (wn.brk) { var ymd = D.ymd(w); if ((ymd[1] === 11 && ymd[2] >= 22) || (ymd[1] === 0 && ymd[2] <= 4)) continue; }
      list.push(w);
    }
    var L = list.length, out = [];
    for (var r = 0; r < rounds; r++) out.push(rounds <= L ? list[Math.floor(r * (L - 1) / Math.max(1, rounds - 1))] : list[Math.floor(r * L / rounds)]);
    return out;
  };

  // Rondas todos-contra-todos por método del círculo. Devuelve [[ [h,a],... ], ...]
  Comp.roundRobin = function (ids, double) {
    var t = ids.slice(); if (t.length % 2) t.push(null);
    var n = t.length, rounds = [], i, r;
    var arr = t.slice();
    for (r = 0; r < n - 1; r++) {
      var rd = [];
      for (i = 0; i < n / 2; i++) {
        var a = arr[i], b = arr[n - 1 - i];
        if (a == null || b == null) continue;
        rd.push((r + i) % 2 === 0 ? [a, b] : [b, a]);
      }
      rounds.push(rd);
      arr.splice(1, 0, arr.pop());
    }
    if (double) {
      var second = rounds.map(function (rd) { return rd.map(function (m) { return [m[1], m[0]]; }); });
      rounds = rounds.concat(second);
    }
    return rounds;
  };

  // ---------- creación y registro ----------
  Comp.create = function (o) {
    var c = { id: o.id, kind: o.kind, nm: o.nm, y: o.y, lg: o.lg, teams: o.teams.slice(), fx: [], cp: 0, tb: {}, sc: {}, st: 0, stages: [], done: false, champ: null, cfg: o.cfg || {}, c: o.c, cont: o.cont };
    FP.S.comps[c.id] = c;
    return c;
  };
  Comp.addFx = function (comp, h, a, w, ex) {
    var f = { h: h, a: a, w: w, st: comp.st };
    if (ex) for (var k in ex) f[k] = ex[k];
    comp.fx.push(f);
    return comp.fx.length - 1;
  };
  Comp.resetTable = function (comp, teams) {
    comp.tb = {};
    (teams || comp.teams).forEach(function (t) { comp.tb[t] = [0, 0, 0, 0, 0, 0, 0]; });
  };
  // fila: [P,G,E,Pe,GF,GC,Pts]
  Comp.applyToTable = function (comp, f) {
    var th = comp.tb[f.h], ta = comp.tb[f.a];
    if (!th || !ta) return;
    th[0]++; ta[0]++; th[4] += f.hs; th[5] += f.as; ta[4] += f.as; ta[5] += f.hs;
    if (f.hs > f.as) { th[1]++; ta[3]++; th[6] += 3; }
    else if (f.hs < f.as) { ta[1]++; th[3]++; ta[6] += 3; }
    else { th[2]++; ta[2]++; th[6]++; ta[6]++; }
  };
  Comp.rows = function (comp, subset) {
    var ids = subset || Object.keys(comp.tb).map(Number);
    var rows = ids.map(function (id) { var r = comp.tb[id] || [0, 0, 0, 0, 0, 0, 0]; return { id: id, p: r[0], w: r[1], d: r[2], l: r[3], gf: r[4], ga: r[5], gd: r[4] - r[5], pts: r[6] }; });
    rows.sort(function (a, b) { return b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.id - b.id; });
    rows.forEach(function (r, i) { r.pos = i + 1; });
    return rows;
  };

  // ---------- ligas ----------
  Comp.newLeague = function (lgId, y) {
    var S = FP.S, def = FP.LGDEF[lgId], lg = S.lgs[lgId];
    var teams = lg.teams.slice();
    var comp = Comp.create({ id: 'L:' + lgId + ':' + y, kind: 'L', nm: def.n, y: y, lg: lgId, teams: teams, c: def.c });
    comp.stages = [{ k: 'lg' }];
    Comp.resetTable(comp);
    var rounds = Comp.roundRobin(U.shuffle(teams.slice()), def.rr === 2);
    if (def.mp && rounds.length > def.mp) rounds = rounds.slice(0, def.mp);
    var weeks = Comp.weeksFor(def.cal, y, rounds.length);
    rounds.forEach(function (rd, i) { rd.forEach(function (m) { Comp.addFx(comp, m[0], m[1], weeks[i], { r: i + 1 }); }); });
    comp.fx.sort(function (a, b) { return a.w - b.w || a.r - b.r; });
    comp.w0 = weeks[0]; comp.w1 = weeks[weeks.length - 1];
    comp.label = def.cal === 'euro' ? (y + '/' + String(y + 1).slice(2)) : String(y);
    lg.cmp = comp.id; lg.y = y; lg.done = false; lg.rolled = false;
    return comp;
  };

  // ---------- eliminatorias ----------
  Comp.bracketOrder = bracketOrder;
  function bracketOrder(size) {
    var o = [1, 2];
    while (o.length < size) { var n = o.length * 2 + 1, nx = []; o.forEach(function (s) { nx.push(s, n - s); }); o = nx; }
    return o;
  }
  function roundName(ties) {
    return { 1: 'Final', 2: 'Semifinales', 4: 'Cuartos de final', 8: 'Octavos de final', 16: 'Dieciseisavos de final', 32: 'Ronda de 64' }[ties] || ('Ronda de ' + ties * 2);
  }
  Comp.roundName = roundName;
  // entrants: ids ordenados por siembra (mejor primero). opts: {legs, finalLegs, weeks:[...], neutralFinal, names}
  Comp.koInit = function (comp, entrants, opts) {
    var m = entrants.length, size = 2; while (size < m) size *= 2;
    var order = bracketOrder(size), slots = (opts && opts.slots) ? opts.slots.slice() : order.map(function (s) { return s <= m ? entrants[s - 1] : null; });
    if (comp.ko) { comp.kh = comp.kh || []; comp.kh.push(comp.ko); }
    comp.ko = { cur: slots, r: -1, rounds: [], opts: opts || {}, stage: comp.st };
    Comp.koStartRound(comp, null);
  };
  Comp.koStartRound = function (comp, afterWeek) {
    var ko = comp.ko, o = ko.opts, cur = ko.cur, ties = cur.length / 2, r = ko.r + 1;
    ko.r = r;
    var isFinal = ties === 1;
    var legs = isFinal ? (o.finalLegs || 1) : (o.legs || 1);
    var wk = o.weeks && o.weeks[r] != null ? o.weeks[r] : (afterWeek != null ? afterWeek + 2 : FP.S.week + 1);
    var rd = { nm: (o.names && o.names[r]) || roundName(ties), legs: legs, ties: [], w: wk };
    ko.rounds.push(rd);
    for (var i = 0; i < cur.length; i += 2) {
      var a = cur[i], b = cur[i + 1], t = { a: a, b: b, win: null, f: [] };
      rd.ties.push(t);
      if (a == null || b == null) { t.win = a == null ? b : a; t.bye = true; continue; }
      var yi = rd.ties.length - 1;
      var w1 = Array.isArray(wk) ? wk[0] : wk, w2 = Array.isArray(wk) ? wk[1] : wk + 1;
      if (legs === 1) {
        Comp.addFx(comp, a, b, w1, { k: 1, x: r, y: yi, n: isFinal && o.neutralFinal ? 1 : 0, ro: rd.nm });
      } else {
        Comp.addFx(comp, a, b, w1, { k: 1, l: 1, x: r, y: yi, ro: rd.nm });
        Comp.addFx(comp, b, a, w2, { k: 1, l: 2, x: r, y: yi, ro: rd.nm });
      }
    }
    comp.fx.sort(function (p, q) { return p.w - q.w; });
    Comp.reindex(comp);
  };
  // reconstruye t.f tras reordenar comp.fx (índices por ronda/empate)
  Comp.reindex = function (comp) {
    if (!comp.ko) return;
    comp.ko.rounds.forEach(function (rd) { rd.ties.forEach(function (t) { t.f = []; }); });
    comp.fx.forEach(function (f, i) {
      if (f.k && f.x != null && comp.ko.rounds[f.x] && comp.ko.rounds[f.x].ties[f.y] && f.st === comp.ko.stage) comp.ko.rounds[f.x].ties[f.y].f.push(i);
    });
    comp.cp = 0;
    while (comp.cp < comp.fx.length && comp.fx[comp.cp].d) comp.cp++;
  };
  // goles agregados de un empate (por equipo a y b) con el resultado propuesto de f
  Comp.tieAgg = function (comp, f) {
    var t = comp.ko.rounds[f.x].ties[f.y], ga = 0, gb = 0;
    t.f.forEach(function (i) {
      var g = comp.fx[i];
      if (g === f || g.d) { var hs = g === f ? (f.hs || 0) : g.hs, as = g === f ? (f.as || 0) : g.as; if (g.h === t.a) { ga += hs; gb += as; } else { gb += hs; ga += as; } }
    });
    return { t: t, a: ga, b: gb };
  };
  // ¿Este partido debe definir ganador (prórroga/penales) tras sus 90 minutos con resultado hs-as?
  Comp.needsWinner = function (comp, f, hs, as) {
    if (!f.k) return false;
    if (f.l === 1) return false;
    var save = [f.hs, f.as]; f.hs = hs; f.as = as;
    var ag = Comp.tieAgg(comp, f); f.hs = save[0]; f.as = save[1];
    return ag.a === ag.b;
  };
  Comp.koFinished = function (comp, f) {
    var ko = comp.ko; if (!ko) return;
    var rd = ko.rounds[f.x], t = rd.ties[f.y];
    var all = t.f.every(function (i) { return comp.fx[i].d; });
    if (!all) return;
    var ag = Comp.tieAgg(comp, comp.fx[t.f[t.f.length - 1]]);
    var last = comp.fx[t.f[t.f.length - 1]], winner;
    if (ag.a !== ag.b) winner = ag.a > ag.b ? t.a : t.b;
    else { // penales en el último partido
      var ph = last.ps ? last.ps[0] : 0, pa = last.ps ? last.ps[1] : 0;
      winner = (ph > pa ? last.h : last.a);
    }
    t.win = winner; t.agg = [ag.a, ag.b];
  };
  // ¿terminó la ronda actual? avanza a la siguiente o cierra el torneo
  Comp.koAdvance = function (comp, week) {
    var ko = comp.ko; if (!ko || comp.done) return false;
    var rd = ko.rounds[ko.r];
    if (!rd.ties.every(function (t) { return t.win != null; })) return false;
    if (rd.ties.length === 1) { comp.champ = rd.ties[0].win; comp.runner = rd.ties[0].win === rd.ties[0].a ? rd.ties[0].b : rd.ties[0].a; ko.winners = [rd.ties[0].win]; return 'end'; }
    if (ko.opts.oneRound) { ko.winners = rd.ties.map(function (t) { return t.win; }); return 'end'; }
    var next = rd.ties.map(function (t) { return t.win; });
    ko.cur = next;
    var lastW = 0; comp.fx.forEach(function (f) { if (f.w > lastW) lastW = f.w; });
    Comp.koStartRound(comp, Math.max(week, lastW));
    return true;
  };

  // ---------- copas nacionales ----------
  Comp.newCup = function (cc, y) {
    var S = FP.S, cdef = FP.DATA.countries[cc], leagues = FP.DATA.leagues.filter(function (l) { return l.c === cc; });
    var maxT = cc === 'ENG' ? 4 : cc === 'ESP' ? 2 : cc === 'ITA' ? 2 : cc === 'GER' ? 3 : 2;
    var teams = [];
    leagues.forEach(function (l) { if (l.t <= maxT) teams = teams.concat(S.lgs[l.id].teams); });
    if (teams.length < 4) return null;
    teams.sort(function (a, b) { return Core().clubs[b].st - Core().clubs[a].st; });
    var cal = leagues[0].cal, wn = Comp.window(cal, y);
    var size = 2; while (size < teams.length) size *= 2;
    var rounds = Math.log2(size), weeks = [];
    for (var r = 0; r < rounds; r++) weeks.push(wn.s + 3 + Math.round(r * 36 / Math.max(1, rounds - 1)));
    var comp = Comp.create({ id: 'C:' + cc + ':' + y, kind: 'C', nm: cdef.cup, y: y, teams: teams, c: cc });
    comp.stages = [{ k: 'ko' }]; comp.w0 = weeks[0]; comp.w1 = weeks[weeks.length - 1];
    comp.label = cal === 'euro' ? (y + '/' + String(y + 1).slice(2)) : String(y);
    comp.cal = cal;
    Comp.koInit(comp, teams, { legs: 1, weeks: weeks, neutralFinal: true });
    return comp;
  };
  function Core() { return FP.S; }

  // ---------- avance semanal ----------
  // Juega los partidos vencidos de una competición. Los de la jugadora/el jugador se encolan en S.pending.
  Comp.playDue = function (comp, week, heroTeams) {
    var f, n = 0;
    if (comp.done) return;
    while (comp.cp < comp.fx.length) {
      f = comp.fx[comp.cp];
      if (f.d) { comp.cp++; continue; }
      if (f.w > week) break;
      if (heroTeams && (heroTeams[f.h] || heroTeams[f.a]) && !f.skipHero) {
        FP.S.pending.push({ c: comp.id, i: comp.cp });
      } else {
        FP.Match.quick(comp, f);
        Comp.finish(comp, f);
      }
      comp.cp++; n++;
    }
    // el puntero puede quedar adelante de fixtures pendientes del héroe: se vigila por pending
  };
  // registra resultado de un partido ya jugado (hs/as/ps definidos)
  Comp.finish = function (comp, f) {
    f.d = 1;
    if (!f.k) {
      if (comp.tb && comp.tb[f.h] && comp.tb[f.a]) Comp.applyToTable(comp, f);
    } else Comp.koFinished(comp, f);
    FP.Hooks && FP.Hooks.onFixture && FP.Hooks.onFixture(comp, f);
  };
  Comp.pendingLeft = function (comp) {
    for (var i = 0; i < comp.fx.length; i++) if (!comp.fx[i].d) return true;
    return false;
  };
  Comp.fxOf = function (comp, id) { return comp.fx.filter(function (f) { return f.h === id || f.a === id; }); };
  Comp.topScorers = function (comp, n, idx) {
    idx = idx || 0; var arr = [];
    for (var pid in comp.sc) { var v = comp.sc[pid]; if (v[idx] > 0) arr.push({ pid: +pid, g: v[0], a: v[1] || 0, c: v[2], n: v[3] }); }
    arr.sort(function (a, b) { return idx === 0 ? (b.g - a.g || b.a - a.a) : (b.a - a.a || b.g - a.g); });
    return arr.slice(0, n || 10);
  };
})();
