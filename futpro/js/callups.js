/* FUTPRO — convocatorias al primer equipo para juveniles de la cantera.
 * Un juvenil que destaca puede ser citado unas semanas a entrenar con el primer equipo (más desarrollo y moral) y,
 * en esas semanas, entrar a veces en la lista de los partidos oficiales del primer equipo (casi siempre como suplente).
 * No depende del tipo de contrato (juvenil o profesional). El ascenso definitivo sigue siendo Market.promoteCheck.
 * Los umbrales son supuestos de diseño calibrados en tests/callups.js, no datos reales. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, Hero = FP.Hero;
  var K = FP.Callup = {};
  K.MIN_AGE = 15;
  K.TRAIN_BOOST = 1.12;                 // multiplicador de entrenamiento mientras está con el primer equipo

  function hero() { return FP.S && FP.S.hero; }
  K.ensure = function () {
    var h = hero(); if (!h) return null;
    if (!h.cu) h.cu = { on: 0, until: -1, last: -99, n: 0, ap: 0, min: 0, g: 0, a: 0, debut: null, hist: [], ev: null };
    return h.cu;
  };
  K.migrate = K.ensure;

  K.eligible = function () {
    var h = hero(); if (!h || h.retired || h.tk !== 'academy' || h.club == null) return false;
    if (Hero.age() < K.MIN_AGE) return false;
    return true;
  };
  // nivel del jugador frente al primer equipo: >0 = está a menos de 14 puntos del plantel
  K.standing = function () {
    var S = FP.S, h = hero(), club = S.clubs[h.club], age = Hero.age();
    var eff = h.ovr - FP.Youth.adultPenalty(age);
    var pos = (S.ro[h.club] || []).filter(function (p) { return p.i !== 0 && p.p === h.pos && !(p.inj > 0); });
    var best = pos.length ? Math.max.apply(null, pos.map(function (p) { return p.o; })) : club.st;
    return { eff: eff, d: eff - (club.st - 14), gapBest: best - eff, club: club };
  };
  function startChance(st) {
    var h = hero(), cu = K.ensure(), age = Hero.age(), z = 0;
    if (st.d < 0) return 0;
    var w = FP.S.week;
    if (cu.ev == null || w - cu.ev.w >= 8) { try { cu.ev = { w: w, z: FP.Youth.heroEval().z }; } catch (e) { cu.ev = { w: w, z: 0 }; } }
    z = cu.ev.z;
    var p = 0.006 + 0.007 * st.d;
    p *= z >= 0.8 ? 1.5 : z >= 0 ? 1 : 0.4;
    p *= age >= 17 ? 1.25 : age === 15 ? 0.7 : 1;
    p *= (h.mor >= 60 ? 1.1 : 0.9);
    return Math.min(0.14, p);
  }
  K.week = function (w) {
    var h = hero(); if (!h) return;
    var cu = K.ensure(), club = h.club;
    // fin de la citación o jugador que ya no está en la cantera
    if (cu.on && (!K.eligible() || w > cu.until)) K.end('fin');
    if (!cu.on) {
      if (!K.eligible() || (h.inj && h.inj.n > 0) || w - cu.last < 3) return;
      var st = K.standing(), p = startChance(st);
      if (p > 0 && R() < p) {
        cu.on = 1; cu.until = w + U.int(0, 1); cu.n++; cu.cd = 0;
        var name = FP.S.clubs[club].nm;
        Hero.msg('El entrenador del primer equipo de ' + name + ' te cita a entrenar con los profesionales' + (cu.n === 1 ? ' por primera vez' : '') + '.', 'ok');
        h.mor = U.clamp(h.mor + 4, 0, 100);
        cu.hist.push({ w: w, t: 'Citado a entrenar con el primer equipo' }); if (cu.hist.length > 40) cu.hist.shift();
      }
    }
  };
  K.end = function (why) {
    var h = hero(), cu = K.ensure();
    cu.on = 0; cu.last = FP.S.week;
  };
  // estado del jugador en un partido del primer equipo mientras está citado
  K.status = function (prep) {
    var h = hero(), st = K.standing();
    if (h.inj && h.inj.n > 0) return { role: 'out', why: 'lesionado' };
    if (R() < 0.3) return { role: 'out', why: 'no convocado', p: 0 };
    var p = U.clamp(0.3 - st.gapBest * 0.02, 0.05, 0.4);
    return { role: 'bench', why: '', p: p, rank: 9, cu: 1 };
  };

  // --- enganches ---
  var ws0 = Hero.weekStart;
  Hero.weekStart = function () { try { K.week(FP.S.week); } catch (e) { if (window.console) console.warn('callups', e); } return ws0.apply(this, arguments); };
  // mientras está citado, los partidos del primer equipo entran en la cola del jugador (las selecciones usan h.extraTeams, que se reinicia cada semana)
  var ht0 = FP.Sim.heroTeams;
  FP.Sim.heroTeams = function () { var o = ht0.apply(this, arguments), h = hero(); if (o && h && h.cu && h.cu.on && h.tk === 'academy' && h.club != null) o[h.club] = 1; return o; };
  var pm0 = Hero.prepareMatch;
  Hero.prepareMatch = function (item) {
    var prep = pm0.apply(this, arguments), h = hero();
    if (h && h.cu && h.cu.on && h.tk === 'academy' && h.club != null && h.club < 5000 && (prep.f.h === h.club || prep.f.a === h.club) && prep.f.h !== h.team && prep.f.a !== h.team) {
      prep.mine = h.club; prep.home = prep.f.h === h.club; prep.opp = prep.home ? prep.f.a : prep.f.h; prep.status = K.status(prep);
    }
    return prep;
  };
  var am0 = Hero.afterMatch;
  Hero.afterMatch = function (prep, res) {
    var r = am0.apply(this, arguments), h = hero(), hm = res && res.hero;
    if (h && h.tk === 'academy' && h.club != null && prep.mine === h.club && h.club < 5000) {
      var cu = K.ensure();
      if (hm && hm.played) {
        cu.ap++; cu.min += hm.min; cu.g += hm.g; cu.a += hm.a;
        var name = FP.S.clubs[h.club].nm;
        if (!cu.debut) {
          cu.debut = { w: FP.S.week, o: prep.opp, min: hm.min };
          Hero.msg('¡Debutas con el primer equipo de ' + name + '! Jugaste ' + hm.min + ' minutos con ' + Hero.age() + ' años.', 'ok');
          FP.Sim.news(h.nm + ' (' + Hero.age() + ') debuta con el primer equipo de ' + name + '.', 'hero', 2);
          (h.history = h.history || []).push({ w: FP.S.week, t: 'Debut con el primer equipo de ' + name, club: h.club });
        }
        if (hm.g) cu.hist.push({ w: FP.S.week, t: 'Gol con el primer equipo' });
      }
    }
    return r;
  };
  var weekEnd0 = Hero.weekEnd;
  Hero.weekEnd = function () { var r = weekEnd0.apply(this, arguments); try { var h = hero(); if (h && h.cu && h.cu.on && (h.retired || h.tk !== 'academy')) K.end('cambio'); } catch (e) { } return r; };
  // entrenar con profesionales acelera algo el desarrollo
  if (FP.Life && FP.Life.trainMult) {
    var tm0 = FP.Life.trainMult;
    FP.Life.trainMult = function () { var m = tm0.apply(this, arguments), h = hero(); return h && h.cu && h.cu.on ? m * K.TRAIN_BOOST : m; };
  }
})();
