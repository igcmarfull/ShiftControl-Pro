/* FUTPRO — director técnico en activo: los partidos del club que dirigís se juegan con el motor real
   (formación, mentalidad y pausas en el descanso y el minuto 70). Los resultados de la temporada salen de la tabla real. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, Sim = FP.Sim, P = FP.Post, Match = FP.Match;
  var K = FP.Coach = {};

  K.job = function () {
    var h = FP.S && FP.S.hero, pa = h && h.retired && h.post && h.post.path;
    if (pa && pa.k === 'coach' && pa.job && pa.job.role === 'head') return pa.job;
    return (FP.Sel && FP.Sel.job()) || null;          // seleccionador: el equipo es una selección (j.club == null)
  };
  K.team = function (j) { return j.club != null ? j.club : j.nat; };
  K.boost = function () { return U.clamp((P.ability() - 58) * 0.06, -2, 2.5); };      // la calidad del técnico mejora (o empeora) un poco a su equipo

  // los partidos del club dirigido van a la cola S.pending (como los del jugador)
  var ht0 = Sim.heroTeams;
  Sim.heroTeams = function () { var j = K.job(); if (j) { var o = {}; o[K.team(j)] = 1; return o; } return ht0.apply(this, arguments); };

  K.prep = function (item) {
    var S = FP.S, comp = S.comps[item.c], j = K.job(); if (!comp || !j) return null;
    var f = comp.fx[item.i]; if (!f) return null;
    var tm = K.team(j); return { comp: comp, f: f, mine: tm, home: f.h === tm, opp: f.h === tm ? f.a : f.h };
  };
  K.next = function () {
    var S = FP.S;
    while (S.pending && S.pending.length) { var pr = K.prep(S.pending[0]); if (pr && !pr.f.d) return pr; S.pending.shift(); }
    return null;
  };
  K.ctx = function (prep, form, ment) {
    var f = prep.f, comp = prep.comp;
    return { comp: comp, f: f, role: 'none', imp: (f.k ? 1.1 : 1) * (comp.kind === 'T' && f.k ? 1.05 : 1), tactic: { mentality: ment || 0 }, hero: null, coachSide: prep.home ? 'h' : 'a', form: form, coachBoost: K.boost() };
  };
  K.STOPS = [45, 70];
  K.begin = function (prep, form, ment) {
    var sess = Match.fullSession(K.ctx(prep, form, ment)); sess.done = false;
    sess.runTo(K.STOPS[0]);
    var info = sess.info();
    return { prep: prep, sess: sess, res: { ev: sess.events, hs: 0, as: 0, xi: info.xi, form: info.form, hero: null, partial: true }, stops: K.STOPS.slice(), si: 0 };
  };
  K.finish = function (prep, res) {
    var S = FP.S; Match.apply(prep.comp, prep.f, res);
    if (S.pending.length) S.pending.shift();
    (S.results = S.results || []).push({ c: prep.comp.nm, h: prep.f.h, a: prep.f.a, hs: res.hs, as: res.as });
    var j = K.job(), mine = prep.home ? res.hs : res.as, opp = prep.home ? res.as : res.hs;
    if (j) { j.rec = j.rec || { w: 0, d: 0, l: 0 }; if (res.ps) { (prep.home ? res.ps[0] > res.ps[1] : res.ps[1] > res.ps[0]) ? j.rec.w++ : j.rec.l++; } else if (mine > opp) j.rec.w++; else if (mine < opp) j.rec.l++; else j.rec.d++; }
    return res;
  };
  K.resume = function (cm) {
    var sess = cm.sess; cm.si++;
    if (cm.si < cm.stops.length) { sess.runTo(cm.stops[cm.si]); return false; }
    sess.runTo(1e9); var res = sess.finish(); sess.done = true;
    K.finish(cm.prep, res); cm.res = res; return true;
  };
  K.quick = function (prep, form, ment) { var res = Match.full(K.ctx(prep, form, ment)); return K.finish(prep, res); };

  // cierre de temporada del club dirigido: resultado real, sueldo, títulos y posible despido
  K.onClosed = function (comp, entry) {
    var S = FP.S, h = S.hero, j = K.job(); if (!j || j.club == null) return;
    var club = S.clubs[j.club]; if (comp.lg !== club.lg) return;
    var p = P.ensure(), pa = p.path, tab = entry.tab, n = tab.length, rank = tab.indexOf(j.club) + 1;
    var champ = entry.ch === j.club, up = entry.up.indexOf(j.club) >= 0, dn = entry.dn.indexOf(j.club) >= 0, lg = FP.LGDEF[club.lg];
    var res = champ ? 'Campeón' : up ? 'Ascenso' : dn ? 'Descenso' : rank <= Math.ceil(n * 0.3) ? 'Zona alta' : rank <= Math.ceil(n * 0.65) ? 'Mitad de tabla' : 'Lucha por la permanencia';
    p.exp++; pa.seasons.push({ y: comp.label, club: j.club, role: 'head', res: res, rank: rank, n: n, rec: j.rec || null });
    var wage = { 1: 2000, 2: 700, 3: 250, 4: 90, 5: 40 }[Math.min(5, lg.t)] || 40; P.pay(wage, 'Sueldo como director técnico');
    if (champ) { pa.titles++; h.history.push({ w: S.week, t: 'Campeón de ' + lg.n + ' como director técnico de ' + club.nm + '.' }); FP.Sim.news(h.nm + ' dirige a ' + club.nm + ' al título de ' + lg.n + '.', 'hero', 2); }
    var bad = dn || rank > n * 0.8;
    if (bad && R() < (dn ? 0.7 : 0.4)) { h.history.push({ w: S.week, t: 'Despedido de ' + club.nm + ' tras la temporada.' }); FP.Hero.msg('La directiva te despide de ' + club.nm + '.', 'warn'); P.leave(j); pa.job = null; }
    else j.rec = null;
  };
  var olc = Sim.onLeagueClosed;
  Sim.onLeagueClosed = function (comp, entry) { if (olc) olc(comp, entry); try { K.onClosed(comp, entry); } catch (e) { if (window.console) console.warn('coach', e); } };

  // semana del mundo para un jugador retirado: devuelve true si hay un partido que dirigir
  K.stepWeek = function () {
    var Game = FP.Game; Game.beginWeek();
    if (K.job() && K.next()) return true;
    FP.S.pending = []; Game.endWeek(); return false;
  };
})();
