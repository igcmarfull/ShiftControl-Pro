/* FUTPRO — trayectorias más variadas del jugador: maduración temprana o tardía (hero.dv) y revisiones del potencial
   (explosiones y estancamientos) hasta los 23 años. El promedio no cambia: solo la dispersión. Parámetros probados en tests/desarrollo.js. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, Hero = FP.Hero;
  var Dv = FP.Desarrollo = {};
  function hero() { return FP.S && FP.S.hero; }
  Dv.ensure = function () { var h = hero(); if (h && h.dv == null) h.dv = FP.Sim.devShift(h); return h && h.dv; };
  Dv.migrate = Dv.ensure;
  var cr0 = Hero.create;
  Hero.create = function () { var h = cr0.apply(this, arguments); h.dv = FP.Sim.devShift(h); return h; };

  // cada año, en julio (semana ≈ 8 tras el 18 de mayo), el jugador joven puede ver revisado su potencial
  Dv.review = function () {
    var h = hero(), S = FP.S, age = Hero.age(); if (!h || h.retired || age > 23 || age < 13) return;
    var r = R(), up = r < 0.045, down = !up && r < 0.095; if (!up && !down) return;
    var d = up ? U.int(4, 8) : -U.int(3, 5);
    h.pot = U.clamp(Math.round(h.pot + d), Math.max(h.ovr + 1, 40), 96);
    h.cap = Hero.makeCaps(h.at, h.pos, h.pot, h.style); S.pl[0].pt = Math.max(h.ovr, Math.round(h.pot));
    (h.history = h.history || []).push({ w: S.week, t: up ? 'Su progresión se acelera: los ojeadores empiezan a hablar de él.' : 'Su progresión se estanca: le cuesta mejorar.' });
    Hero.msg(up ? 'Tu entrenador nota que progresas más rápido de lo esperado: tu techo parece más alto.' : 'Llevas un tiempo sin mejorar: tu techo podría ser más bajo de lo que se pensaba.', up ? 'ok' : 'warn');
  };
  var we0 = Hero.weekEnd;
  Hero.weekEnd = function () {
    var r = we0.apply(this, arguments), h = hero();
    try { if (h && !h.retired && (FP.S.week - h.b) % 52 === 8) Dv.review(); } catch (e) { if (window.console) console.warn('desarrollo', e); }
    return r;
  };
})();
