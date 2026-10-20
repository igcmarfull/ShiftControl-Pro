/* FUTPRO — eventos de carrera: cierres de torneos del jugador, premios, cumpleaños, retiro */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, Comp = FP.Comp, Sim = FP.Sim;

  var Events = FP.Events = {};

  function hero() { return FP.S.hero; }
  function isMine(comp) { var h = hero(); return h && h.team != null && comp.teams.indexOf(h.team) >= 0; }

  // ---------- torneos amateur y juveniles ----------
  Sim.handlers.A = function (comp, w) {
    var S = FP.S;
    if (comp.done) return;
    if (!comp.regDone) {
      if (Comp.pendingLeft(comp)) return;
      comp.regDone = true;
      var rows = Comp.rows(comp);
      comp.final = rows.map(function (r) { return r.id; });
      comp.finalId = Sim.newPlayoff(comp, 'FIN', 'Final ' + comp.nm, rows.slice(0, 2).map(function (r) { return r.id; }), 1, 1, comp.w1 + 1);
      return;
    }
    var fin = S.comps[comp.finalId];
    if (fin && fin.done) {
      comp.done = true; comp.champ = fin.champ; comp.runner = fin.runner;
      var h = hero();
      if (h && comp.teams.indexOf(h.team) >= 0) {
        if (comp.champ === h.team) {
          h.trophies.push({ y: comp.label, nm: 'Campeón ' + comp.nm.replace('Campeonato ', '') , club: C.tname(h.team), w: S.week });
          FP.Hero.msg('¡Campeón! ' + C.tname(h.team) + ' gana el ' + comp.nm + ' ' + comp.label + '.', 'ok');
          h.mor = U.clamp(h.mor + 12, 0, 100);
        } else if (comp.runner === h.team) {
          h.trophies.push({ y: comp.label, nm: 'Subcampeón ' + comp.nm.replace('Campeonato ', ''), club: C.tname(h.team), w: S.week, sub: 1 });
          FP.Hero.msg('Subcampeón del ' + comp.nm + ' ' + comp.label + '. Perdiste la final ante ' + C.tname(comp.champ) + '.', 'i');
          h.mor = U.clamp(h.mor + 3, 0, 100);
        } else FP.Hero.msg(C.tname(h.team) + ' no alcanzó la final del ' + comp.nm + ' ' + comp.label + '.', 'i');
        var sc = Comp.topScorers(comp, 1, 0)[0];
        if (sc && sc.pid === 0) { h.awards.push({ y: comp.label, nm: 'Goleador del ' + comp.nm, w: S.week }); FP.Hero.msg('Eres el goleador del ' + comp.nm + ' con ' + sc.g + ' goles.', 'ok'); }
        if (comp.half === 'Clausura') Events.heroSeasonEnd('amat');
      }
      // limpiar torneos viejos
      delete S.comps[comp.finalId];
    }
  };
  Sim.handlers.Y = function (comp, w) {
    var S = FP.S;
    if (comp.done) return;
    if (Comp.pendingLeft(comp)) return;
    comp.done = true;
    var rows = Comp.rows(comp), h = hero();
    comp.champ = rows[0].id;
    if (h && comp.teams.indexOf(h.team) >= 0) {
      var pos = rows.filter(function (r) { return r.id === h.team; })[0].pos;
      if (pos === 1) { h.trophies.push({ y: comp.label, nm: 'Campeón Juvenil · ' + FP.LGDEF[comp.lg].n, club: C.tname(h.team), w: S.week }); FP.Hero.msg('¡Campeón juvenil con ' + C.tname(h.club) + '!', 'ok'); }
      else FP.Hero.msg('El equipo juvenil terminó ' + pos + '° en el campeonato.', 'i');
      var sc = Comp.topScorers(comp, 1, 0)[0];
      if (sc && sc.pid === 0 && sc.g >= 5) h.awards.push({ y: comp.label, nm: 'Goleador del campeonato juvenil', w: S.week });
      Events.heroSeasonEnd('academy');
    }
  };
  Sim.handlers.F = function () { };

  // ---------- fin de temporada del jugador ----------
  Events.heroSeasonEnd = function (src) {
    var S = FP.S, h = hero(); if (!h || h.retired) return;
    var m = FP.Market, label = m.seasonLabel();
    h.flags = h.flags || {};
    if (src === 'academy') { if (h.flags.heAw != null && S.week - h.flags.heAw < 40) return; h.flags.heAw = S.week; }   // varios torneos juveniles cierran en semanas distintas: el cierre de temporada ocurre una sola vez
    var cn = h.club != null ? C.tname(h.club) : (h.team != null && h.team >= 20000 ? C.tname(h.team) : '—');
    if (h.tk === 'loan') cn += ' (cedido)';
    FP.Hero.endSeasonStats(label, cn);
    h.flags = h.flags || {};
    if (h.tk === 'academy') { FP.Youth.review(); m.promoteCheck(); }
    if (h.tk === 'loan' && h.loan) m.endLoan();
    FP.Hero.msg('Terminó la temporada ' + label + '. Revisa tus estadísticas en "Historial de carrera".', 'i');
    h.flags.transferReq = false;
  };
  Sim.onLeagueClosed = function (comp, entry) {
    var S = FP.S, h = hero(); if (!h || h.retired) return;
    var lgTeams = comp.teams;
    var inLeague = (h.tk === 'pro' || h.tk === 'loan') && lgTeams.indexOf(h.team) >= 0;
    if (!inLeague) return;
    var s = h.season;
    // título de liga
    if (entry.ch === h.team) {
      h.trophies.push({ y: comp.label, nm: 'Campeón de ' + FP.LGDEF[comp.lg].n, club: C.tname(h.team), w: S.week, ap: s.ap });
      FP.Hero.msg('¡' + C.tname(h.team) + ' es campeón de ' + FP.LGDEF[comp.lg].n + '! Jugaste ' + s.ap + ' partidos esta temporada.', 'ok'); h.mor = U.clamp(h.mor + 15, 0, 100);
    }
    var sc = Comp.topScorers(comp, 1, 0)[0];
    // los goleadores del comp se limpian después; se consulta antes de limpiar (llamada previa)
    if (sc && sc.pid === 0) { h.awards.push({ y: comp.label, nm: 'Bota de Oro · ' + FP.LGDEF[comp.lg].n, w: S.week }); FP.Hero.msg('¡Goleador de ' + FP.LGDEF[comp.lg].n + ' con ' + sc.g + ' goles!', 'ok'); }
    var avg = s.rn ? s.rs / s.rn : 0;
    if (s.ap >= 15 && avg >= 7.2) { h.awards.push({ y: comp.label, nm: 'Equipo ideal de ' + FP.LGDEF[comp.lg].n, w: S.week }); FP.Hero.msg('Fuiste incluido en el equipo ideal de ' + FP.LGDEF[comp.lg].n + '.', 'ok'); }
    if (s.ap >= 15 && avg >= 6.9 && FP.Hero.age() <= 21) h.awards.push({ y: comp.label, nm: 'Mejor jugador joven · ' + FP.LGDEF[comp.lg].n, w: S.week });
    if (s.ap >= 20 && avg >= 7.5 && h.ovr >= 78) { h.awards.push({ y: comp.label, nm: 'Mejor jugador · ' + FP.LGDEF[comp.lg].n, w: S.week }); }
    Events.heroSeasonEnd('pro');
  };
  Sim.onRollover = function (cc) {
    var S = FP.S, h = hero();
    // limpieza de torneos de ese país de la temporada anterior
    Object.keys(S.comps).forEach(function (id) {
      var c = S.comps[id];
      if (c.c === cc && c.done && (c.kind === 'L' || c.kind === 'K' || c.kind === 'C')) delete S.comps[id];
    });
    FP.Match.cache = {};
    if (h && !h.retired) {
      // la liga juvenil se recrea para la nueva temporada si sigue en la cantera
      if (h.tk === 'academy' && S.clubs[h.club].c === cc) {
        Object.keys(S.comps).forEach(function (id) { if (S.comps[id].kind === 'Y') delete S.comps[id]; });
        FP.Hero.ensureComps();
      }
      FP.Hero.ensureInRoster();
    }
    S.clubs.forEach(function (c) { if (c.c === cc) C.calcStr(c); });
  };


  // ---------- premio al mejor jugador del mundo (se calcula al cerrar la temporada europea) ----------
  Events.worldAward = function () {
    var S = FP.S, y = D.year(S.week), label = String(y);
    var best = [], i;
    for (i = 0; i < S.pl.length; i++) { var p = S.pl[i]; if (!p || p.c < 0 || p.o < 74) continue; best.push(p); }
    var champ = {};
    S.hist.champs.forEach(function (x) { if ((x.k === 'cont' && /UCL|LIB/.test(x.key)) && String(x.y).indexOf(String(y)) >= 0) champ[x.ch] = 1; });
    var scored = best.map(function (p) {
      var club = S.clubs[p.c], lgd = FP.LGDEF[club.lg];
      var s = p.o * 0.55 + (p.g || 0) * 0.8 + (p.as || 0) * 0.35 + (lgd.t === 1 ? lgd.q * 0.08 : 0) + (champ[p.c] ? 4 : 0) + U.norm() * 2.2;
      return { p: p, s: s };
    }).sort(function (a, b) { return b.s - a.s; });
    if (!scored.length) return;
    var w = scored[0].p, h = S.hero;
    var rec = { y: label, id: w.i, n: w.i === 0 ? h.nm : w.n, club: w.c, ovr: w.o };
    S.hist.awards.push(rec);
    Sim.news((w.i === 0 ? h.nm : w.n) + ' (' + C.tname(w.c) + ') gana el Balón de Oro ' + label + '.', 'title', 3);
    if (h && !h.retired && w.i === 0) { h.awards.push({ y: label, nm: 'Balón de Oro', w: S.week }); FP.Hero.msg('¡Ganaste el Balón de Oro ' + label + '!', 'ok'); }
    else if (h && !h.retired && scored.slice(0, 5).some(function (x) { return x.p.i === 0; })) { h.awards.push({ y: label, nm: 'Finalista del Balón de Oro (top 5)', w: S.week }); }
  };

  // ---------- semanales ----------
  Events.weekly = function (w) {
    var S = FP.S, h = hero(); if (!h || h.retired) return;
    var a = Math.floor(FP.Hero.ageF()), prevA = Math.floor(C.ageF(S.pl[0], w - 1));
    if (a > prevA) {
      FP.Hero.msg('¡Cumpleaños! ' + h.nm + ' cumple ' + a + ' años.', 'i');
      if (a === 16) FP.Hero.msg('A partir de ahora puedes firmar un contrato profesional.', 'i');
      if (a === 18) FP.Hero.msg('Ya eres mayor de edad: puedes fichar en el extranjero.', 'i');
      if (a === 15) FP.Hero.msg('Puedes contratar un representante desde esta edad (menú Contratos).', 'i');
      if (a >= 34) FP.Hero.msg('Se acerca el final de tu carrera. Puedes retirarte cuando quieras desde "Mi jugador".', 'i');
    }
    if (a >= 39 && !h.retired) Events.retire(true);
    if (h.team == null && h.tk === 'free' && h.freeSince == null) h.freeSince = w;
    FP.Market.promoteCheck();
  };
  Sim.worldAward = function () { Events.worldAward(); };
  Events.retire = function (auto) {
    var S = FP.S, h = hero(); if (!h || h.retired) return;
    var cn = h.club != null ? C.tname(h.club) : '—';
    FP.Hero.endSeasonStats(FP.Market.seasonLabel(), cn);
    h.retired = true; h.retiredW = S.week; h.retiredAge = FP.Hero.age();
    S.pl[0].c = -2;
    Object.keys(S.ro).forEach(function (k) { var i = S.ro[k].indexOf(S.pl[0]); if (i >= 0) S.ro[k].splice(i, 1); });
    FP.Sim.news(h.nm + ' anuncia su retiro del fútbol a los ' + h.retiredAge + ' años.', 'hero', 3);
    FP.Hero.msg(auto ? 'La edad te alcanzó: te retiras del fútbol profesional.' : 'Anunciaste tu retiro del fútbol.', 'warn');
    S.pending = [];
  };
})();
