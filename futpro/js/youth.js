/* FUTPRO — fútbol formativo y amateur: modelo de talento, reserva nacional de promesas, plantillas juveniles
   persistentes del club del jugador, su estatus real por posición, evaluaciones de cantera y niveles amateur.
   Todo vive en el estado de la partida (S.pl con c=-3 para las promesas, S.sq para las plantillas). */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, Sim = FP.Sim;
  var Youth = FP.Youth = {};

  // ---------- modelo de talento ----------
  // Fracción de su nivel adulto que alcanza un jugador de esa edad (misma tabla que Core.youthStr).
  var FT = { 12: 0.86, 13: 0.89, 14: 0.92, 15: 0.94, 16: 0.96, 17: 0.98, 18: 0.99 };
  Youth.f = function (age) { return age <= 12 ? FT[12] : age >= 21 ? 1 : age >= 19 ? 0.995 : FT[age]; };
  // Madurez física: un juvenil rinde menos en el fútbol adulto que lo que indica su media (puntos de media).
  var PEN = { 14: 9, 15: 8.5, 16: 7.5, 17: 6, 18: 4.5, 19: 3, 20: 2, 21: 1 };
  Youth.adultPenalty = function (age) { return age >= 22 ? 0 : age <= 14 ? 9 : PEN[age]; };
  // Potencial inicial realista: regresión hacia el nivel adulto proyectado (no "media + 20").
  Youth.potFor = function (ovr, age) {
    var proj = ovr / Youth.f(age);
    var p = proj + U.norm() * 4.5 + (R() < 0.04 ? 7 : 0);
    return U.clamp(Math.round(p), Math.round(ovr) + 2, 96);
  };
  var topLg = {};
  function topLeague(code) {
    if (topLg[code] !== undefined) return topLg[code];
    var best = null; FP.DATA.leagues.forEach(function (l) { if (l.c === code && (!best || l.t < best.t)) best = l; });
    return (topLg[code] = best);
  }
  // Nivel de referencia de los mejores juveniles de un país (misma escala que las ligas).
  Youth.natLevel = function (code) {
    var n = FP.NATBY[code]; if (!n) return 45;
    var lg = topLeague(code);
    if (lg) return lg.q + 5 + 0.2 * Math.max(0, (n.r - 6) - (lg.q + 3));
    return 0.72 * n.r + 6;
  };
  Youth.cohortSize = function (code) { var n = FP.NATBY[code]; return U.clamp(Math.round(10 + 0.30 * ((n ? n.r : 40) - 30)), 10, 28); };
  var POSW = { GK: 0.09, CB: 0.17, LB: 0.06, RB: 0.06, DM: 0.08, CM: 0.17, AM: 0.08, LW: 0.07, RW: 0.07, ST: 0.14 };
  function randPos() { return U.wpick(C.POS, function (p) { return POSW[p]; }); }
  function natClubs(code) {
    var S = FP.S, out = [];
    FP.DATA.leagues.forEach(function (l) { if (l.c === code && l.t <= 2 && S.lgs[l.id]) out = out.concat(S.lgs[l.id].teams); });
    return out;
  }
  // Crea una promesa (jugador de la reserva nacional) y la registra en S.pl con c = -3.
  Youth.makePros = function (code, age, nameRng) {
    var S = FP.S, L = Youth.natLevel(code);
    var pt = U.clamp(Math.round(L + 5.2 * U.norm()), 30, 95);
    var o = U.clamp(Math.round(pt * Youth.f(age) + 2.3 * U.norm()), 25, 95); if (o > pt) pt = o;
    var cl = natClubs(code);
    var p = { i: S.pl.length, n: FP.Names.gen(code, nameRng), b: Math.round(S.week - (age + R()) * 52.1775), p: randPos(), o: o, pt: pt, c: -3, ce: 0, nat: code, pm: Math.round(U.clamp(0.55 + 0.2 * U.norm(), 0.2, 1) * 100) / 100 };
    if (cl.length) p.cl = U.wpick(cl, function (id) { return Math.exp(S.clubs[id].st / 12); });
    S.pl.push(p);
    return p;
  };
  var TAPER = { 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 0.9, 19: 0.8, 20: 0.65, 21: 0.5, 22: 0.4, 23: 0.35 };
  Youth.initPools = function () {
    var S = FP.S; S.yp = { y: D.year(S.week), n: 0 };
    FP.DATA.nations.forEach(function (n) {
      var N0 = Youth.cohortSize(n.c);
      for (var a = 13; a <= 23; a++) { var k = Math.max(3, Math.round(N0 * TAPER[a])); for (var j = 0; j < k; j++) { Youth.makePros(n.c, a); S.yp.n++; } }
    });
  };
  // Cierre de año calendario: crecen, salen los que superan la edad y entra una nueva generación de 13 años.
  Youth.yearTick = function (y) {
    var S = FP.S; if (!S.yp) return;
    S.yp.y = y;
    var gone = 0;
    for (var i = 1; i < S.pl.length; i++) {
      var p = S.pl[i]; if (!p || p.c !== -3) continue;
      var age = C.age(p);
      if (age >= 24 || (age >= 18 && R() < 0.10)) { S.pl[i] = 0; gone++; continue; }
      Sim.progressPlayer(p, age);
      p.pm = Math.round(U.clamp(p.pm + U.norm() * 0.08, 0.2, 1) * 100) / 100;
    }
    FP.DATA.nations.forEach(function (n) { var N0 = Youth.cohortSize(n.c); for (var j = 0; j < N0; j++) Youth.makePros(n.c, 13); });
  };
  // Migración: partidas anteriores a este sistema reciben su reserva de promesas al cargarse.
  Youth.ensure = function () {
    var S = FP.S; if (!S) return;
    if (!S.yp) Youth.initPools();
    if (!S.sq) S.sq = {};
    if (!S.sqn) S.sqn = 0;
  };

  // ---------- plantillas juveniles del club del jugador ----------
  var SLOTS = ['GK', 'GK', 'CB', 'CB', 'CB', 'LB', 'LB', 'RB', 'RB', 'DM', 'DM', 'CM', 'CM', 'CM', 'AM', 'LW', 'LW', 'RW', 'RW', 'ST', 'ST', 'ST'];
  function teamInfo(teamId) {
    var S = FP.S;
    if (teamId >= 30000) { var club = S.clubs[teamId - 30000]; return { kind: 'acad', club: club, cc: club.c, fm: club.fm || '4-3-3' }; }
    var hc = S.amat[teamId - 20000]; return { kind: 'amat', hc: hc, cc: hc ? hc.c : 'CHI', fm: '4-4-2' };
  }
  // Nivel de equipo para una edad (misma escala que Core.youthStr y amateur.st)
  Youth.levelFor = function (teamId, age) {
    var t = teamInfo(teamId);
    if (t.kind === 'acad') return C.youthStr(t.club, U.clamp(age, 12, 19));
    var st = t.hc ? t.hc.st : 48;
    return age >= 18 ? st : Math.round(st * Youth.f(age) * 10) / 10;
  };
  function newSquadPlayer(teamId, age, adult) {
    var S = FP.S, t = teamInfo(teamId), lvl = Youth.levelFor(teamId, adult ? 24 : age);
    var starter = R() < 0.55, o = Math.round(lvl + (starter ? 1.5 : -5) + U.norm() * 3.2);
    var pt = adult ? o : Math.min(95, Math.round(Math.max(o + 2, o / Youth.f(age) + U.norm() * 4)));
    var nat = R() < 0.06 ? C.foreignNat({ c: t.cc }) : t.cc;
    S.sqn = (S.sqn || 0) + 1;
    return { i: -(20000000 + S.sqn), n: FP.Names.gen(nat), b: Math.round(S.week - (age + R()) * 52.1775), p: SLOTS[Math.floor(R() * SLOTS.length)], o: U.clamp(o, 22, 85), pt: pt, nat: nat, u: 0 };
  }
  // Plantilla del sistema juvenil (12–19 años) más el grupo adulto, creada una vez y mantenida cada temporada.
  Youth.squad = function (teamId) {
    var S = FP.S; Youth.ensure();
    var sq = S.sq[teamId];
    if (!sq) {
      sq = S.sq[teamId] = { y: D.year(S.week), ps: [], ad: [] };
      for (var a = 12; a <= 19; a++) for (var k = 0; k < 8; k++) sq.ps.push(newSquadPlayer(teamId, a, false));
      for (var j = 0; j < 24; j++) sq.ad.push(newSquadPlayer(teamId, U.int(19, 32), true));
    }
    return sq;
  };
  // Al cambiar el año: envejecen, progresan y se renuevan.
  Youth.rollSquad = function (teamId) {
    var S = FP.S, sq = S.sq && S.sq[teamId]; if (!sq) return;
    var y = D.year(S.week); if (sq.y === y) return; sq.y = y;
    var keep = [];
    sq.ps.forEach(function (p) {
      var age = C.age(p);
      if (age >= 20) { if (R() < 0.35) { p.o = U.clamp(p.o + U.int(0, 2), 22, 85); p.pt = p.o; sq.ad.push(p); } return; }
      Sim.progressPlayer(p, age); keep.push(p);
    });
    for (var a = 12; a <= 12; a++) for (var k = 0; k < 8; k++) keep.push(newSquadPlayer(teamId, a, false));
    sq.ps = keep;
    var ad = [];
    sq.ad.forEach(function (p) { var age = C.age(p); if (age >= 34 || (age >= 28 && R() < 0.12) || R() < 0.1) return; Sim.progressPlayer(p, age); ad.push(p); });
    while (ad.length < 24) ad.push(newSquadPlayer(teamId, U.int(19, 26), true));
    sq.ad = ad.slice(0, 30);
  };
  // Categoría competitiva del jugador según su edad
  Youth.catLimit = function (age) { return age <= 14 ? 15 : age <= 16 ? 17 : age <= 18 ? 19 : 20; };
  Youth.catName = function (age) { return 'Sub-' + Youth.catLimit(age); };
  Youth.isAdultAmat = function (age) { return age >= 18; };
  // Compañeros elegibles de la categoría
  Youth.catSquad = function (teamId, age) {
    var sq = Youth.squad(teamId), t = teamInfo(teamId);
    if (t.kind === 'amat' && Youth.isAdultAmat(age)) return sq.ad.slice();
    var L = Youth.catLimit(age);
    return sq.ps.filter(function (p) { var a = C.age(p); return a <= L && a >= L - 3; });
  };

  // ---------- selección de equipo por posición ----------
  function fit(pp, slot) {
    if (pp === slot) return 0;
    if (pp === 'GK' || slot === 'GK') return 45;
    var g = C.POS_GRP; return g[pp] === g[slot] ? 6 : 14;
  }
  var FORMS = { '4-3-3': ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'CM', 'AM', 'LW', 'ST', 'RW'], '4-4-2': ['GK', 'LB', 'CB', 'CB', 'RB', 'LW', 'CM', 'CM', 'RW', 'ST', 'ST'], '4-2-3-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'DM', 'LW', 'AM', 'RW', 'ST'], '3-5-2': ['GK', 'CB', 'CB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RB', 'ST', 'ST'] };
  // players: [{p:{...,pos,o}, sc}] -> {xi:[{e,slot}], bench:[e], out:[e]}
  Youth.pickTeam = function (list, form) {
    var slots = FORMS[form] || FORMS['4-3-3'], used = {}, xi = [];
    var av = list.filter(function (e) { return !(e.p.u > 0); });
    slots.forEach(function (sl) {
      var best = null, bv = -1e9;
      av.forEach(function (e) { if (used[e.p.i]) return; var v = e.sc - fit(e.p.p, sl); if (v > bv) { bv = v; best = e; } });
      if (best) { used[best.p.i] = 1; xi.push({ e: best, slot: sl }); }
    });
    var rest = av.filter(function (e) { return !used[e.p.i]; }).sort(function (a, b) { return b.sc - a.sc; });
    var hasGK = false, bench = [];
    rest.forEach(function (e) { if (bench.length < 7) { if (e.p.p === 'GK') { if (hasGK) return; hasGK = true; } bench.push(e); } });
    var inB = {}; bench.forEach(function (e) { inB[e.p.i] = 1; });
    var out = list.filter(function (e) { return !used[e.p.i] && !inB[e.p.i]; });
    return { xi: xi, bench: bench, out: out, form: form };
  };
  function heroEntry(noise) {
    var h = FP.S.hero, tr = ((h.ct == null ? 50 : h.ct) - 50) * 0.04;
    var fat = h.fat > 75 ? (h.fat - 75) * 0.08 : 0;
    return { p: { i: 0, p: h.pos, o: h.ovr, n: h.nm }, sc: h.ovr + (h.form - 50) * 0.03 + (h.mor - 50) * 0.02 + tr - fat + noise };
  }
  // Estatus semanal del jugador en su equipo juvenil/amateur: titular, suplente o fuera de la lista
  Youth.heroStatus = function () {
    var S = FP.S, h = S.hero, age = FP.Hero.age(), t = teamInfo(h.team);
    var mates = Youth.catSquad(h.team, age), coachBias = U.hash(S.seed, h.team, 'coach') % 100 / 100;
    mates.forEach(function (p) { if (p.u > 0) p.u--; else if (R() < 0.03) p.u = U.int(1, 4); });
    var list = mates.map(function (p) {
      var sa = C.age(p), rel = 0.4 * Math.max(0, sa - (Youth.catLimit(age) - 1)); // los mayores de la categoría tienen ventaja
      return { p: p, sc: p.o + rel + U.norm() * 1.1 + (coachBias - 0.5) * 0.4 };
    });
    var me = heroEntry(U.norm() * 1.1); list.push(me);
    var team = Youth.pickTeam(list, t.fm);
    var inXI = team.xi.some(function (x) { return x.e === me; }), inB = team.bench.indexOf(me) >= 0;
    var pool = team.xi.filter(function (x) { return x.slot === h.pos || C.POS_GRP[x.slot] === C.POS_GRP[h.pos]; }).length;
    var role = h.inj && h.inj.n > 0 ? 'out' : inXI ? 'starter' : inB ? 'bench' : 'out';
    var why = role === 'out' ? (h.inj && h.inj.n > 0 ? 'lesionado' : 'fuera de la lista') : '';
    var beat = list.filter(function (e) { return e !== me && (e.p.p === h.pos) && e.sc > me.sc; }).length;
    return { role: role, why: why, p: role === 'bench' ? U.clamp(0.7 - beat * 0.1, 0.25, 0.8) : 0.8, rank: beat, team: team, cat: t.kind === 'amat' && Youth.isAdultAmat(age) ? 'Adulta' : Youth.catName(age) };
  };
  // Posición relativa del jugador entre sus compañeros de puesto (para la interfaz)
  Youth.heroStanding = function () {
    var S = FP.S, h = S.hero, age = FP.Hero.age();
    if (h.tk !== 'academy' && h.tk !== 'amat') return null;
    var mates = Youth.catSquad(h.team, age), same = mates.filter(function (p) { return p.p === h.pos; }).sort(function (a, b) { return b.o - a.o; });
    var above = same.filter(function (p) { return p.o > h.ovr; }).length;
    var all = mates.slice().sort(function (a, b) { return b.o - a.o; }), ab = all.filter(function (p) { return p.o > h.ovr; }).length;
    return { pos: above + 1, ofPos: same.length + 1, squadRank: ab + 1, squadN: all.length + 1, mates: same.slice(0, 5) };
  };
  // Convierte la selección de equipo en alineación para el motor (el jugador es S.pl[0])
  Youth.toLineup = function (team) {
    var S = FP.S;
    function fix(p) { return p.i === 0 ? S.pl[0] : p; }
    return { xi: team.xi.map(function (x) { return { p: fix(x.e.p), slot: x.slot }; }), bench: team.bench.map(function (e) { return fix(e.p); }), form: team.form, generic: false };
  };
  Youth.heroTrustUpdate = function (rating, played) {
    var h = FP.S.hero; h.ct = h.ct == null ? 50 : h.ct;
    if (played) h.ct = U.clamp(h.ct + (rating - 6.4) * 2.2, 5, 99);
    else h.ct = U.clamp(h.ct + (50 - h.ct) * 0.02 - 0.3, 5, 99);
  };

  // ---------- evaluación de fin de temporada en la cantera ----------
  // Devuelve {z, share, pct}: posición del jugador frente a su generación y minutos disputados.
  Youth.heroEval = function () {
    var S = FP.S, h = S.hero, age = FP.Hero.age();
    var mates = Youth.catSquad(h.team, age).filter(function (p) { return Math.abs(C.age(p) - age) <= 1; });
    var m = mates.reduce(function (s, p) { return s + p.o; }, 0) / Math.max(1, mates.length), sd = 0;
    mates.forEach(function (p) { sd += (p.o - m) * (p.o - m); }); sd = Math.sqrt(sd / Math.max(1, mates.length)) || 4;
    var eff = h.ovr + 0.3 * (h.pot - h.ovr) * Math.max(0, (19 - age)) / 6;
    var z = (eff - m) / sd, below = mates.filter(function (p) { return p.o + 0.3 * (p.pt - p.o) < eff; }).length;
    var s = h.season, share = s.ap ? s.ap / Math.max(1, s.ap + (s.team || 0)) : 0;
    return { z: z, pct: below / Math.max(1, mates.length), mean: m, sd: sd, eff: eff };
  };

  // Probabilidad anual de ser desvinculado de una cantera según edad y posición relativa (calibrado en tests/careers.js)
  var REL = { 12: 0.04, 13: 0.07, 14: 0.12, 15: 0.17, 16: 0.22, 17: 0.30, 18: 0.40, 19: 0.60 };
  Youth.releaseProb = function (age, ev, role) {
    var base = REL[Math.max(12, Math.min(19, age))];
    var adj = -0.55 * ev.z / (1 + Math.abs(ev.z) * 0.15);       // mejor que sus compañeros: baja la probabilidad
    var logit = Math.log(base / (1 - base)) + adj + (role === 'out' ? 0.5 : 0);
    return 1 / (1 + Math.exp(-logit));
  };
  Youth.review = function () {
    var S = FP.S, h = S.hero; if (h.tk !== 'academy') return;
    var M = FP.Market, club = S.clubs[h.club], age = FP.Hero.age(), ev = Youth.heroEval();
    var potEst = M.potEst(), eff = h.ovr - Youth.adultPenalty(age);
    h.hist = h.hist || []; h.hist.push({ y: M.seasonLabel(), z: Math.round(ev.z * 100) / 100 });
    // contrato profesional: edad mínima 16, destacarse en la generación y acercarse al nivel del primer equipo
    var wantPro = age >= 16 && ev.z >= 0.6 && eff >= club.st - 9 - (age >= 18 ? 0 : 0) && !(h.contract && h.contract.type === 'prof');
    if (wantPro || (age >= 17 && ev.z >= 1.1 && potEst >= club.st + 3)) {
      var wage = Math.round(M.wageFor(club, 0.35));
      M.addOffer({ type: 'pro', club: club.id, years: age < 18 ? 3 : 4, wage: wage, role: 'Juvenil / primer equipo', text: club.nm + ' te ofrece tu primer contrato profesional: ' + (age < 18 ? 3 : 4) + ' años, ' + FP.fmt.money(wage) + ' al año.', exp: S.week + 14 });
      return;
    }
    var role = h.season.ap < 6 ? 'out' : 'x';
    var pr = Youth.releaseProb(age, ev, role);
    if (age >= 19) pr = Math.max(pr, ev.z >= 0.3 ? 0.35 : 0.85);
    if (R() < pr) {
      FP.Hero.msg(club.nm + ' decide no continuar contigo: terminas tu etapa en las inferiores' + (age <= 15 ? ' (a veces la maduración no acompaña a tiempo)' : '') + '.', 'warn');
      h.flags.releasedAcademy = true; h.flags.relW = S.week;
      M.release('Desvinculado de la cantera'); h.freeSince = S.week;
      FP.Hero.msg('Quedas sin club. Puedes pedir pruebas, jugar en un club amateur o esperar una oportunidad.', 'i');
      return;
    }
    // continúa: renovación del vínculo juvenil si vence
    var yr = D.year(S.week);
    if (h.contract && h.contract.type === 'juvenil' && h.contract.end <= yr + 0) h.contract.end = M.endYearOf(FP.LGDEF[club.lg].cal, 1);
    FP.Hero.msg(club.nm + ' quiere que sigas en la cantera' + (ev.z < -0.5 ? ' (tu nivel está por debajo del promedio de tu generación: demuestra más)' : '') + '.', 'i');
  };

  // ---------- niveles del fútbol amateur ----------
  Youth.TIERS = {
    barrio: { n: 'Club de barrio', min: 36, max: 46, wage: 0, vis: 0.35 },
    regional: { n: 'Club regional amateur', min: 45, max: 54, wage: 0, vis: 0.6 },
    semipro: { n: 'Club semiprofesional', min: 53, max: 60, wage: 4, vis: 0.9 }
  };
  Youth.tierOf = function (hc) { return (hc && hc.tier) || (hc && hc.st >= 53 ? 'semipro' : hc && hc.st >= 45 ? 'regional' : 'barrio'); };

  // ---------- tareas semanales ----------
  Youth.weekly = function (w) {
    var S = FP.S, ymd = D.ymd(w);
    Youth.ensure();
    var y = ymd[0];
    if (ymd[1] === 0 && ymd[2] <= 7 && S.yp.y !== y) {
      Youth.yearTick(y);
      Object.keys(S.sq).forEach(function (id) { Youth.rollSquad(+id); });
    }
  };
  var prevStart = Sim.startSeasons;
  Sim.startSeasons = function () { var r = prevStart.apply(this, arguments); Youth.initPools(); if (!FP.S.sq) FP.S.sq = {}; FP.S.sqn = 0; return r; };
  var prevWeekly = Sim.weeklyExtra;
  Sim.weeklyExtra = function (w) { if (prevWeekly) prevWeekly(w); Youth.weekly(w); };
})();
