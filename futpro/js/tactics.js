/* FUTPRO — tácticas del jugador: rol libre e intensidad de presión (antes y durante el partido),
   decisiones en pausas (descanso y recta final) y cambio de posición con familiaridad y costo de adaptación. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, Hero = FP.Hero;
  var Tac = FP.Tac = {};

  // sh/ps: puntos sobre remate/pase; inv: toques; err: errores; drain: desgaste; att: afinidad con el estilo del entrenador (+ ofensivo)
  Tac.ROLES = {
    equilibrado: { nm: 'Equilibrado', d: 'Sin instrucciones especiales.', sh: 0, ps: 0, inv: 1, err: 1, drain: 1, att: 0 },
    gol: { nm: 'Buscar el gol', d: 'Más remates y desmarques; menos aporte en el pase.', sh: 3, ps: -2, inv: 0.92, err: 1.1, drain: 1, att: 1 },
    crear: { nm: 'Crear juego', d: 'Más participación y pase; menos finalización.', sh: -2.5, ps: 3, inv: 1.25, err: 1.12, drain: 1.03, att: 0.5 },
    cubrir: { nm: 'Cubrir y recuperar', d: 'Ayudas en defensa: menos errores y desgaste, menos peligro propio.', sh: -3.5, ps: 0, inv: 0.95, err: 0.85, drain: 0.95, att: -1 }
  };
  // cur: puntos de nivel del equipo que aporta el jugador (presión coordinada) mientras tiene aire
  Tac.PRESS = [
    { nm: 'Baja', d: 'Ahorras energía; presionas poco.', drain: 0.85, cur: -0.6, st: -1 },
    { nm: 'Normal', d: 'Presión estándar.', drain: 1, cur: 0, st: 0 },
    { nm: 'Alta', d: 'Presionas arriba: ayudas al equipo pero te cansas más.', drain: 1.25, cur: 0.8, st: 1 }
  ];
  Tac.ensure = function () {
    var h = FP.S && FP.S.hero; if (!h) return null;
    if (!h.tac) h.tac = { role: 'equilibrado', press: 1 };
    if (!h.fam) { h.fam = {}; h.fam[h.pos] = 100; h.pos0 = h.pos; }
    if (h.fam[h.pos] == null) h.fam[h.pos] = 100;
    return h.tac;
  };
  Tac.mod = function () { var t = Tac.ensure() || { role: 'equilibrado', press: 1 }; return Tac.ROLES[t.role] || Tac.ROLES.equilibrado; };
  Tac.pressInfo = function () { var t = Tac.ensure() || { press: 1 }; return Tac.PRESS[t.press != null ? t.press : 1]; };

  // ---------- familiaridad con la posición ----------
  var ADJ = { GK: [], CB: ['LB', 'RB', 'DM'], LB: ['CB', 'LW', 'RB'], RB: ['CB', 'RW', 'LB'], DM: ['CM', 'CB'], CM: ['DM', 'AM'], AM: ['CM', 'ST', 'LW', 'RW'], LW: ['RW', 'ST', 'AM', 'LB'], RW: ['LW', 'ST', 'AM', 'RB'], ST: ['AM', 'LW', 'RW'] };
  Tac.startFam = function (p) {
    var h = FP.S.hero, best = 0;
    Object.keys(h.fam || {}).forEach(function (q) { if (q === p) return; var v = h.fam[q]; if ((ADJ[q] || []).indexOf(p) >= 0) best = Math.max(best, v * 0.6); else if (C.POS_GRP[q] === C.POS_GRP[p]) best = Math.max(best, v * 0.42); else best = Math.max(best, v * 0.25); });
    return Math.round(Math.max(18, best));
  };
  Tac.famOf = function (p) { var h = FP.S.hero; Tac.ensure(); return h.fam[p] != null ? h.fam[p] : Tac.startFam(p); };
  // puntos de nivel que se pierden por no dominar la posición actual
  Tac.pen = function () { var h = FP.S.hero; if (!h || !h.fam) return 0; var f = h.fam[h.pos]; return f == null ? 0 : (100 - f) * 0.1; };
  Tac.setPos = function (p) {
    var S = FP.S, h = S.hero; Tac.ensure();
    if (p === h.pos) return { ok: false, msg: 'Ya juegas en esa posición.' };
    if (p === 'GK') return { ok: false, msg: 'El modelo no incluye portero.' };
    if (h.inj && h.inj.n > 0) return { ok: false, msg: 'Estás lesionado: espera a recuperarte para reconvertirte.' };
    if (h.fam[p] == null) h.fam[p] = Tac.startFam(p);
    h.pos = p; h.posSince = S.week;
    Hero.updateOvr(); h.cap = Hero.makeCaps(h.at, h.pos, Math.max(h.pot, h.ovr + 1), h.style);
    h.mor = U.clamp(h.mor - 2, 0, 100);
    if (h.lk && h.tk === 'pro') h.lk.coach -= 1;
    var pen = Tac.pen();
    return { ok: true, msg: 'Ahora juegas de ' + C.POS_NAME[p] + '. Familiaridad ' + h.fam[p] + '%: ' + (pen > 0.4 ? 'rindes ' + pen.toFixed(1) + ' puntos menos hasta adaptarte.' : 'sin costo de adaptación.') };
  };
  // adaptación semanal: entrenar la posición, jugar partidos y la edad
  Tac.weekly = function (w) {
    var h = FP.S.hero; if (!h || h.retired) return; Tac.ensure();
    var f = h.fam[h.pos]; if (f >= 100) return;
    var age = Hero.age(), g = 0.5 * (age <= 20 ? 1.3 : age >= 30 ? 0.7 : 1) + (h.train && h.train.focus === 'pos' ? 0.9 : 0) + (h.tacMin || 0) / 90 * 1.6 + (h.lk && h.lk.advice > w ? 0.3 : 0);
    h.tacMin = 0;
    h.fam[h.pos] = Math.min(100, Math.round((f + g) * 10) / 10);
    if (h.fam[h.pos] >= 100 && h.posSince != null) { Hero.msg('Ya dominas tu nueva posición (' + C.POS_NAME[h.pos] + ').', 'ok'); h.posSince = null; }
  };

  // ---------- vista del motor ----------
  var view0 = Hero.view;
  Hero.view = function (instr, pen) {
    var v = view0.call(Hero, instr, (pen || 0) + Tac.pen() * 0.6);
    var shot0 = v.shotSkill, pass0 = v.passSkill, cur0 = v.cur;
    v.shotSkill = function () { return shot0() + Tac.mod().sh; };
    v.passSkill = function () { return pass0() + Tac.mod().ps; };
    v.cur = function (slot, sf) { return cur0(slot, sf) + Tac.pressInfo().cur; };
    Object.defineProperties(v, {
      drain: { get: function () { return Tac.mod().drain * Tac.pressInfo().drain; } },
      invMul: { get: function () { return Tac.mod().inv; } },
      errMul: { get: function () { return Tac.mod().err; } }
    });
    return v;
  };

  // ---------- encaje con el entrenador ----------
  Tac.coachDef = function () {
    var h = FP.S.hero, lk = h.lk; if (!lk || lk.club == null || !FP.Staff) return null;
    return { club: FP.S.clubs[lk.club], def: FP.Staff.def(FP.S.clubs[lk.club]), c: FP.Staff.coach(FP.S.clubs[lk.club]) };
  };
  // -1..+1: cuánto coincide tu forma de jugar con lo que pide el entrenador
  Tac.fit = function () {
    var cd = Tac.coachDef(); if (!cd) return 0;
    var m = Tac.mod(), p = Tac.pressInfo(), d = cd.def, v = 0;
    if (d.att) v += m.att * d.att * 0.5;
    if (d.press) v += p.st * d.press * 0.5;
    if (!d.att && !d.press && m.nm === 'Equilibrado') v += 0.2;
    return U.clamp(v, -1, 1);
  };
  var after0 = Hero.afterMatch;
  Hero.afterMatch = function (prep, res) {
    var r = after0.apply(this, arguments), hm = res && res.hero, h = FP.S.hero;
    if (hm && hm.played) {
      Tac.ensure(); h.tacMin = (h.tacMin || 0) + hm.min;
      if (h.lk && h.lk.club != null && h.tk === 'pro') h.lk.coach = U.clamp(h.lk.coach + Tac.fit() * 0.8, -100, 100);
    }
    return r;
  };

  // ---------- partidos con pausas ----------
  Tac.STOPS = [45, 70];
  Tac.isLive = function () { var mt = FP.UI && FP.UI.mt; return !!(mt && mt.sess && !mt.sess.done); };
  Tac.begin = function (prep) {
    Tac.ensure();
    var ctx = Hero.matchCtx(prep), sess = FP.Match.fullSession(ctx);
    sess.done = false;
    var stops = prep.status.role === 'out' ? [] : Tac.STOPS.slice();
    sess.runTo(stops.length ? stops[0] : 1e9);
    var part = { ev: sess.events, hs: 0, as: 0, xi: { h: [], a: [] }, form: sess.info().form, hero: null, partial: true };
    var info = sess.info(); part.xi = info.xi;
    return { sess: sess, res: part, stops: stops, si: 0 };
  };
  // continúa hasta la siguiente pausa o hasta el final; devuelve true si el partido terminó
  Tac.resume = function (mt) {
    var sess = mt.sess; mt.si++;
    if (mt.si < mt.stops.length) { sess.runTo(mt.stops[mt.si]); return false; }
    sess.runTo(1e9);
    var res = sess.finish(); sess.done = true;
    Hero.applyMatch(mt.prep, res);
    var S = FP.S; S.pending.shift();
    (S.results = S.results || []).push({ c: mt.prep.comp.nm, h: mt.prep.f.h, a: mt.prep.f.a, hs: res.hs, as: res.as });
    mt.res = res;
    return true;
  };
  Tac.setMent = function (mt, v) { FP.S.hero.instr = v; if (mt && mt.sess) mt.sess.setMent(v); };
  Tac.migrate = function () { Tac.ensure(); };

  var weekEnd0 = Hero.weekEnd;
  Hero.weekEnd = function () { var r = weekEnd0.apply(this, arguments); try { Tac.weekly(FP.S.week); } catch (e) { if (window.console) console.warn('tac', e); } return r; };
})();
