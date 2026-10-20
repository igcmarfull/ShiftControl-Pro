/* FUTPRO — simulación del mundo: avance semanal, cierre de temporadas, ascensos/descensos, desarrollo de plantillas */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, Comp = FP.Comp;

  var Sim = FP.Sim = { handlers: {} };

  // ---------- noticias ----------
  Sim.news = function (txt, kind, imp) {
    var S = FP.S;
    S.news.unshift({ w: S.week, t: txt, k: kind || 'g', i: imp || 1 });
    if (S.news.length > 500) S.news.length = 400;
  };

  // ---------- inicio del mundo ----------
  Sim.startSeasons = function () {
    var S = FP.S;
    FP.DATA.leagues.forEach(function (l) {
      var y = l.cal === 'euro' ? 2025 : 2026;
      Comp.newLeague(l.id, y);
    });
    Object.keys(FP.DATA.countries).forEach(function (cc) {
      var l = FP.DATA.leagues.filter(function (x) { return x.c === cc; })[0];
      Comp.newCup(cc, l.cal === 'euro' ? 2025 : 2026);
    });
    if (Sim.startContinental) Sim.startContinental(true);
    S.pending = [];
    // posiciona el reloj una semana antes del primer partido
    var first = 1e9;
    Object.keys(S.comps).forEach(function (id) { var c = S.comps[id]; if (c.fx.length && c.fx[0].w < first) first = c.fx[0].w; });
    S.week = first - 1;
  };

  // equipos del héroe (para encolar sus partidos en lugar de simularlos)
  Sim.heroTeams = function () {
    var h = FP.S.hero; if (!h || h.retired) return null;
    var o = {}; if (h.team != null) o[h.team] = 1;
    (h.extraTeams || []).forEach(function (t) { o[t] = 1; });
    return o;
  };

  // ---------- semana ----------
  // Juega los partidos de la semana S.week (los del héroe quedan en S.pending). No incrementa la semana.
  Sim.playWeek = function () {
    var S = FP.S, w = S.week, ht = Sim.heroTeams(), ids = Object.keys(S.comps), i;
    S.pending = [];
    for (i = 0; i < ids.length; i++) {
      var c = S.comps[ids[i]];
      if (!c || c.done) continue;
      if (S.cfg.off && S.cfg.off[c.lg] && c.kind === 'L' && !(ht && c.teams.some(function (t) { return ht[t]; }))) {
        if (w >= c.w1) Comp.playDue(c, 1e9, null); // liga desactivada: se simula en bloque al terminar la temporada
        continue;
      }
      Comp.playDue(c, w, ht);
    }
  };
  // Tareas posteriores a los partidos (progreso de torneos, lesiones, mercado). Luego avanza la semana.
  Sim.endWeek = function () {
    var S = FP.S, w = S.week, ids = Object.keys(S.comps), i;
    for (i = 0; i < ids.length; i++) {
      var c = S.comps[ids[i]];
      if (!c || c.done) continue;
      Sim.progress(c, w);
    }
    // limpieza de torneos terminados hace mucho
    // lesiones y sanciones
    for (i = 1; i < S.pl.length; i++) {
      var p = S.pl[i]; if (!p) continue;
      if (p.inj > 0) { p.inj--; if (p.inj === 0) delete p.inj; if (p.c >= 0) delete FP.Match.cache[p.c]; }
      if (p.su > 0) { p.su--; if (p.su === 0) delete p.su; }
    }
    if (FP.Market && FP.Market.weekly) FP.Market.weekly(w);
    if (Sim.weeklyExtra) Sim.weeklyExtra(w);
    S.week++;
  };
  Sim.step = function () { Sim.playWeek(); Sim.endWeek(); };

  // ---------- progreso por tipo de competición ----------
  Sim.progress = function (comp, w) {
    var h = Sim.handlers[comp.kind];
    if (h) return h(comp, w);
  };
  Sim.handlers.C = function (comp, w) { // copa nacional
    var r = Comp.koAdvance(comp, w);
    if (r === 'end') Sim.closeCup(comp);
  };
  Sim.handlers.K = function (comp, w) { // eliminatoria suelta (playoff)
    var r = Comp.koAdvance(comp, w);
    if (r === 'end') { comp.done = true; }
  };
  Sim.handlers.L = function (comp, w) {
    if (comp.lgDone) return;
    var S = FP.S, def = FP.LGDEF[comp.lg];
    if (!comp.regDone) {
      if (Comp.pendingLeft(comp)) return;
      comp.regDone = true;
      var rows = Comp.rows(comp), last = comp.w1 + 1;
      comp.final = rows.map(function (r) { return r.id; });
      if (def.po) {
        var n = Math.min(def.po.n, rows.length);
        comp.poId = Sim.newPlayoff(comp, 'PO', 'Playoffs de ' + def.n, rows.slice(0, n).map(function (r) { return r.id; }), 1, 1, last + 1);
      }
      if (def.poUp) {
        var a = def.poUp[0] - 1, b = Math.min(def.poUp[1], rows.length);
        comp.upId = Sim.newPlayoff(comp, 'UP', 'Liguilla de ascenso ' + def.n, rows.slice(a, b).map(function (r) { return r.id; }), 2, 1, last + 1);
      }
    }
    var kids = [comp.poId, comp.upId].filter(Boolean).map(function (id) { return S.comps[id]; });
    if (kids.every(function (k) { return k.done; })) Sim.closeLeague(comp);
  };
  Sim.newPlayoff = function (parent, tag, nm, teams, legs, finalLegs, startW) {
    var S = FP.S;
    var comp = Comp.create({ id: tag + ':' + parent.id, kind: 'K', nm: nm, y: parent.y, lg: parent.lg, teams: teams, c: parent.c });
    comp.stages = [{ k: 'ko' }]; comp.label = parent.label; comp.parent = parent.id;
    var m = teams.length, size = 2; while (size < m) size *= 2;
    var rounds = Math.log2(size), weeks = [], w = startW;
    for (var r = 0; r < rounds; r++) {
      var last = r === rounds - 1, lg = last ? finalLegs : legs;
      weeks.push(lg === 2 ? [w, w + 1] : w); w += lg === 2 ? 3 : 2;
    }
    Comp.koInit(comp, teams, { legs: legs, finalLegs: finalLegs, weeks: weeks });
    comp.w0 = startW; comp.w1 = w;
    return comp.id;
  };

  // ---------- cierres ----------
  Sim.closeCup = function (comp) {
    comp.done = true;
    var S = FP.S, cdef = FP.DATA.countries[comp.c];
    S.hist.champs.push({ k: 'cup', cc: comp.c, nm: comp.nm, y: comp.label, ch: comp.champ, ru: comp.runner });
    var top = C.team(comp.champ);
    var lgd = FP.DATA.leagues.filter(function (l) { return l.c === comp.c; })[0];
    if (lgd && lgd.t === 1) Sim.news(top.nm + ' gana la ' + comp.nm + ' ' + comp.label + '.', 'title', 2);
    Sim.checkRollover(comp.c);
  };
  Sim.closeLeague = function (comp) {
    var S = FP.S, def = FP.LGDEF[comp.lg], lg = S.lgs[comp.lg];
    comp.lgDone = true; comp.done = true; lg.done = true;
    var rows = Comp.rows(comp), n = rows.length;
    var champ = rows[0].id, runner = rows[1] ? rows[1].id : null;
    if (comp.poId) { var po = S.comps[comp.poId]; champ = po.champ; runner = po.runner; }
    var up = [], dn = [];
    var nUp = def.up || 0, nDn = def.dn || 0;
    var tab = rows.map(function (r) { return r.id; });
    var upIds = rows.slice(0, nUp).map(function (r) { return r.id; });
    if (comp.upId) { var uk = S.comps[comp.upId]; if (uk.champ != null) upIds.push(uk.champ); }
    dn = nDn ? rows.slice(n - nDn).map(function (r) { return r.id; }) : [];
    var sc = Comp.topScorers(comp, 5, 0);
    var entry = { y: comp.y, l: comp.label, tab: tab, ch: champ, ru: runner, reg: rows[0].id, up: upIds, dn: dn, pts: rows[0].pts, sc: sc.slice(0, 3).map(function (e) { return [e.n, e.g, e.c]; }), as: Comp.topScorers(comp, 1, 1).map(function (e) { return [e.n, e.a, e.c]; }) };
    lg.hist.push(entry);
    comp.entry = entry;
    S.hist.champs.push({ k: 'lg', lg: comp.lg, y: comp.label, ch: champ, ru: runner });
    if (def.t === 1) Sim.news(C.tname(champ) + ' se corona campeón de ' + def.n + ' (' + C.cname(def.c) + ') ' + comp.label + '.', 'title', def.q >= 60 ? 3 : 2);
    if (sc[0] && def.t === 1) Sim.news(sc[0].n + ' (' + C.tname(sc[0].c) + ') es el goleador de ' + def.n + ' con ' + sc[0].g + ' goles.', 'stat', 1);
    if (Sim.onLeagueClosed) Sim.onLeagueClosed(comp, entry);
    // guardar los goleadores definitivos y liberar fixtures pesados
    comp.sc = {};
    Sim.checkRollover(def.c);
  };
  Sim.checkRollover = function (cc) {
    var S = FP.S, lgs = FP.DATA.leagues.filter(function (l) { return l.c === cc; });
    var ok = lgs.every(function (l) { return S.lgs[l.id].done; });
    var cup = Object.keys(S.comps).filter(function (id) { return id.indexOf('C:' + cc + ':') === 0 && !S.comps[id].done; });
    if (!ok || cup.length) return;
    if (S.lgs[lgs[0].id].rolled) return;
    Sim.rollover(cc);
  };

  // ---------- cambio de temporada ----------
  Sim.rollover = function (cc) {
    var S = FP.S, lgs = FP.DATA.leagues.filter(function (l) { return l.c === cc; }).sort(function (a, b) { return a.t - b.t; });
    lgs.forEach(function (l) { S.lgs[l.id].rolled = true; });
    var endY = lgs[0].cal === 'euro' ? lgs[0] && S.lgs[lgs[0].id].y + 1 : S.lgs[lgs[0].id].y;
    // ascensos y descensos
    for (var i = 0; i < lgs.length - 1; i++) {
      var hi = S.lgs[lgs[i].id], lo = S.lgs[lgs[i + 1].id];
      var dn = hi.hist[hi.hist.length - 1].dn, up = lo.hist[lo.hist.length - 1].up;
      var k = Math.min(dn.length, up.length);
      if (!k) continue;
      dn = dn.slice(0, k); up = up.slice(0, k);
      dn.forEach(function (id) { S.clubs[id].lg = lgs[i + 1].id; });
      up.forEach(function (id) { S.clubs[id].lg = lgs[i].id; });
      hi.teams = hi.teams.filter(function (id) { return dn.indexOf(id) < 0; }).concat(up);
      lo.teams = lo.teams.filter(function (id) { return up.indexOf(id) < 0; }).concat(dn);
      if (lgs[i].t === 1 || i === 0) {
        up.forEach(function (id) { Sim.news(S.clubs[id].nm + ' asciende a ' + lgs[i].n + '.', 'promo', 1); });
        dn.forEach(function (id) { Sim.news(S.clubs[id].nm + ' desciende de ' + lgs[i].n + '.', 'releg', 1); });
      }
    }
    if (cc === 'ENG' && Sim.worldAward) Sim.worldAward();
    // desarrollo de plantillas del país
    var teams = [];
    lgs.forEach(function (l) { teams = teams.concat(S.lgs[l.id].teams); });
    Sim.seasonTurnover(teams, endY, cc);
    // nueva temporada
    lgs.forEach(function (l) { Comp.newLeague(l.id, S.lgs[l.id].y + 1); });
    Comp.newCup(cc, S.lgs[lgs[0].id].y);
    if (Sim.onRollover) Sim.onRollover(cc);
  };

  function progressPlayer(p, age) {
    var d;
    if (age <= 21) d = (p.pt - p.o) * (0.30 + R() * 0.15) + U.norm() * 0.9;
    else if (age <= 25) d = (p.pt - p.o) * (0.28 + R() * 0.2) + U.norm() * 0.8;
    else if (age <= 29) d = U.norm() * 0.8 - 0.1;
    else if (age <= 32) d = -(0.5 + (age - 29) * 0.35) + U.norm() * 0.8;
    else d = -(1.5 + (age - 32) * 0.5) + U.norm() * 0.9;
    p.o = U.clamp(Math.round(p.o + d), 25, 96);
    if (age <= 24) p.pt = Math.max(p.o, Math.min(97, p.pt + Math.round(U.norm() * 0.8)));
    else p.pt = p.o;
  }
  Sim.progressPlayer = progressPlayer;
  var MINPOS = { GK: 2, CB: 3, LB: 1, RB: 1, DM: 1, CM: 2, AM: 1, LW: 1, RW: 1, ST: 2 };
  Sim.genYouth = function (club) {
    var S = FP.S, lg = FP.LGDEF[club.lg], pos = U.wpick(C.POS, function (p) { return p === 'GK' ? 0.5 : 1; });
    var age = U.int(16, 17);
    var o = Math.round((lg.q + club.ra) * 0.78 - 4 + U.norm() * 3.5);
    var pt = Math.min(96, Math.round(o + 5 + R() * 12 + club.ac * 1.2 + (R() < 0.03 ? 12 : 0)));
    var nat = R() < C.foreignP(club.c) * 0.4 ? C.foreignNat(club) : club.c;
    var p = { i: S.pl.length, n: FP.Names.gen(nat), b: Math.round(S.week - (age + R()) * 52.1775), p: pos, o: U.clamp(o, 25, 80), pt: pt, c: club.id, ce: FP.Date.year(S.week) + U.int(2, 4), nat: nat };
    S.pl.push(p);
    return p;
  };
  Sim.seasonTurnover = function (teamIds, endY, cc) {
    var S = FP.S, retired = 0;
    teamIds.forEach(function (cid) {
      var club = S.clubs[cid], r = (S.ro[cid] || []).slice(), lg = FP.LGDEF[club.lg];
      r.forEach(function (p) {
        if (p.i === 0) return;
        var age = C.age(p);
        progressPlayer(p, age); delete p.g; delete p.as; delete p.yc; delete p.rc;
        var leave = false;
        if (age >= 35 || (age >= 33 && R() < (age - 32) * 0.22)) { p.c = -2; retired++; leave = true; }
        else if (p.ce <= endY) {
          var keep = age < 30 ? 0.82 : age < 33 ? 0.6 : 0.35;
          if (p.o < lg.q + club.ra - 9 && age > 24) keep -= 0.35;
          if (R() < keep) p.ce = endY + U.int(1, 4);
          else { p.c = -1; leave = true; p.ce = 0; }
        }
        if (leave) delete S.ro[cid][S.ro[cid].indexOf(p)];
      });
      S.ro[cid] = (S.ro[cid] || []).filter(Boolean);
      // cantera
      var n = 2 + (club.ac >= 4 ? 1 : 0) + (R() < 0.3 ? 1 : 0);
      for (var k = 0; k < n; k++) { var y = Sim.genYouth(club); S.ro[cid].push(y); }
      // entrenador
      if (R() < 0.12) {
        var old = club.co; club.co = FP.Names.gen(club.c); club.cs = S.week; if (R() < 0.6) club.fm = U.pick(['4-3-3', '4-4-2', '4-2-3-1', '3-5-2']);
        if (lg.t === 1 && lg.q >= 58 && R() < 0.6) Sim.news(club.nm + ' cambia de entrenador: llega ' + club.co + ' en lugar de ' + old + '.', 'coach', 1);
      }
    });
    // completar plantillas y mantener tamaños
    teamIds.forEach(function (cid) {
      var club = S.clubs[cid], lg = FP.LGDEF[club.lg], rr = S.ro[cid], sz = lg.q >= 55 ? 25 : lg.q >= 45 ? 23 : 21;
      var cnt = {}; rr.forEach(function (p) { cnt[p.p] = (cnt[p.p] || 0) + 1; });
      Object.keys(MINPOS).forEach(function (pos) {
        while ((cnt[pos] || 0) < MINPOS[pos]) {
          var fa = Sim.pickFreeAgent(club, pos);
          if (!fa) fa = C.genPlayer(club, pos, 1);
          else { fa.c = cid; fa.ce = endY + U.int(1, 3); }
          rr.push(fa); cnt[pos] = (cnt[pos] || 0) + 1;
        }
      });
      while (rr.length < sz) { var pos = C.TEMPLATE[rr.length % C.TEMPLATE.length]; var q = Sim.pickFreeAgent(club, pos) || C.genPlayer(club, pos, 1); if (q.c < 0 || q.c !== cid) { q.c = cid; q.ce = endY + U.int(1, 3); } if (rr.indexOf(q) < 0) rr.push(q); }
      // recortar sobrantes: los peores / más veteranos salen
      if (rr.length > sz + 3) {
        rr.sort(function (a, b) { return (b.o + (b.pt - b.o) * 0.3) - (a.o + (a.pt - a.o) * 0.3); });
        var extra = rr.splice(sz + 3).filter(function (p) { return p.i !== 0; });
        extra.forEach(function (p) { p.c = -1; });
        if (rr.length < sz + 3) rr.length = rr.length; // héroe excluido: se vuelve a incluir abajo
        if (S.hero && extra.length !== rr.length) { /* el héroe nunca se libera aquí */ }
      }
      S.ro[cid] = rr;
      delete FP.Match.cache[cid];
      C.calcStr(club);
    });
    // anclaje de nivel: evita que la media de cada liga se infle o desinfle a lo largo de 25 temporadas
    var seenLg = {};
    teamIds.forEach(function (cid) { seenLg[S.clubs[cid].lg] = 1; });
    Object.keys(seenLg).forEach(function (lgId) {
      var def = FP.LGDEF[lgId], tot = 0, n = 0;
      S.lgs[lgId].teams.forEach(function (cid) {
        var top = (S.ro[cid] || []).slice().sort(function (a, b) { return b.o - a.o; }).slice(0, 14);
        top.forEach(function (p) { tot += p.o; n++; });
      });
      if (!n) return;
      var drift = tot / n - (def.q + 1.8);
      if (Math.abs(drift) < 0.5) return;
      var adj = (drift - Math.sign(drift) * 0.3) * 0.7;
      S.lgs[lgId].teams.forEach(function (cid) {
        (S.ro[cid] || []).forEach(function (p) {
          if (p.i === 0) return;
          var d = adj, fl = Math.floor(Math.abs(d)), fr = Math.abs(d) - fl, q = (fl + (R() < fr ? 1 : 0)) * Math.sign(d);
          p.o = U.clamp(p.o - q, 25, 96); if (p.pt < p.o) p.pt = p.o;
        });
        C.calcStr(S.clubs[cid]);
      });
    });
    // libres: retiro de los muy veteranos / muy bajos
    for (var i = 1; i < S.pl.length; i++) {
      var p = S.pl[i]; if (!p) continue;
      if (p.c === -1) { var ag = C.age(p); if (ag >= 34 || p.o < 40 || (ag >= 30 && R() < 0.4) || R() < 0.12) p.c = -2; }
      if (p.c === -2) S.pl[i] = 0;
    }
    // el héroe, si juega en este país, también refresca su club
    if (S.hero) FP.Hero && FP.Hero.ensureInRoster && FP.Hero.ensureInRoster();
  };
  Sim.pickFreeAgent = function (club, pos) {
    var S = FP.S, lg = FP.LGDEF[club.lg], mu = lg.q + club.ra, best = null, bv = -1, tries = 0;
    var pool = Sim.faPool(); // lista cacheada por semana
    for (var i = 0; i < pool.length && tries < 400; i++, tries++) {
      var p = pool[i]; if (p.c !== -1 || p.p !== pos) continue;
      if (p.o < mu - 8 || p.o > mu + 4) continue;
      var v = p.o + R() * 3;
      if (v > bv) { bv = v; best = p; }
    }
    return best;
  };
  Sim.faPool = function () {
    var S = FP.S;
    if (Sim._fa && Sim._faW === S.week && Sim._faN === S.pl.length) return Sim._fa;
    var a = []; for (var i = 1; i < S.pl.length; i++) { var p = S.pl[i]; if (p && p.c === -1) a.push(p); }
    U.shuffle(a); Sim._fa = a; Sim._faW = S.week; Sim._faN = S.pl.length;
    return a;
  };
})();
