/* FUTPRO — cláusulas de contrato que faltaban: renovación automática por partidos jugados y rebaja salarial por descenso.
   Se suman a lo que ya existe en contracts.js (cláusula de rescisión, opción de compra, primas, bonos, promesas de rol).
   Frecuencias y porcentajes son supuestos de diseño probados en tests/contratos2.js, no datos reales. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, M = FP.Market, K = FP.Contracts;
  var K2 = FP.Contratos2 = {};
  function hero() { return FP.S && FP.S.hero; }
  function clone(x) { return x ? JSON.parse(JSON.stringify(x)) : null; }

  // ---------- condiciones nuevas en las ofertas ----------
  var terms0 = K.terms;
  K.terms = function (club, o) {
    var t = terms0.apply(this, arguments), h = hero(), age = FP.Hero.age(), lg = club ? FP.LGDEF[club.lg] : null;
    t.auto = null; t.relegation = null;
    if (t.kind !== 'prof' || !club || o.type === 'loan') return t;
    if (o.type === 'renew' && o.base) { t.relegation = clone(o.base.relegation); return t; }       // la renovación conserva lo pactado; la automática se consumió
    // renovación automática: el club extiende un año si el jugador juega suficientes partidos en la última temporada
    if (t.years >= 2 && age >= 19 && age <= 31 && R() < (lg && lg.t === 1 ? 0.3 : 0.2)) t.auto = { n: Math.max(8, Math.round(K.gamesIn(club) * (0.5 + R() * 0.15))), years: 1 };
    // rebaja salarial si el club desciende (divisiones de arriba)
    if (lg && lg.t <= 2 && lg.dn !== 0 && R() < (lg.t === 1 ? 0.45 : 0.3)) t.relegation = { cut: R() < 0.5 ? 0.3 : 0.4 };
    return t;
  };
  var apply0 = K.applyTermsToContract;
  K.applyTermsToContract = function (ct, t, o) { var r = apply0.apply(this, arguments); ct.auto = clone(t.auto); ct.relegation = clone(t.relegation); ct.autoDone = 0; ct.relDone = 0; return r; };
  var renew0 = K.doRenew;
  K.doRenew = function (o) {
    var r = renew0.apply(this, arguments), ct = hero() && hero().contract;
    if (r && r.ok && ct && o.t) { ct.auto = clone(o.t.auto); ct.relegation = clone(o.t.relegation); ct.autoDone = 0; ct.relDone = 0; }
    return r;
  };
  K2.label = function (t) {
    var out = [];
    if (t && t.auto) out.push('renovación automática de ' + t.auto.years + ' año si juegas ' + t.auto.n + ' partidos');
    if (t && t.relegation) out.push('rebaja del ' + Math.round(t.relegation.cut * 100) + '% si el club desciende');
    return out;
  };
  var sum0 = K.summary;
  K.summary = function (o) { var s = sum0.apply(this, arguments), x = o && o.t ? K2.label(o.t) : []; return x.length ? s.replace(/\.$/, ' · ' + x.join(' · ') + '.') : s; };

  // ---------- efectos ----------
  // renovación automática: en la última temporada del contrato, al llegar a los partidos pactados se extiende
  K2.autoRenew = function (w) {
    var S = FP.S, h = hero(), ct = h && h.contract; if (!h || h.retired || h.tk !== 'pro' || !ct || !ct.auto || ct.autoDone || ct.endW == null) return;
    if (ct.endW - w > 52 || ct.endW - w < 1) return;
    if ((h.season.ap || 0) < ct.auto.n) return;
    var club = S.clubs[h.club], rg = K.regOf(ct.cid), cal = FP.LGDEF[club.lg].cal;
    ct.autoDone = 1; ct.end += ct.auto.years; ct.endW = M.contractEndWeek({ end: ct.end }, cal);
    if (rg) { rg.endW = ct.endW; rg.ev.push([w, 'renovación automática']); }
    K.log('renovacion', { club: club.id, wage: ct.wage, was: ct.wage, until: ct.endW, role: ct.role, auto: 1 });
    FP.Hero.msg('Se activa la cláusula de renovación automática: tu contrato con ' + club.nm + ' se extiende hasta el ' + K.fmtDate(ct.endW) + '.', 'ok');
    (h.history = h.history || []).push({ w: w, t: 'Renovación automática con ' + club.nm + ' por partidos jugados.' });
  };
  var weekly0 = K.weekly;
  K.weekly = function (w) { var r = weekly0.apply(this, arguments); try { K2.autoRenew(w); } catch (e) { if (window.console) console.warn('contratos2', e); } return r; };
  // descenso: se aplica la rebaja pactada una sola vez
  var olc0 = K.onLeagueClosed;
  K.onLeagueClosed = function (comp, entry) {
    var r = olc0.apply(this, arguments), S = FP.S, h = hero(), ct = h && h.contract;
    try {
      if (h && !h.retired && h.tk === 'pro' && ct && ct.relegation && !ct.relDone && comp.teams.indexOf(h.team) >= 0 && entry.dn && entry.dn.indexOf(h.team) >= 0) {
        var was = ct.wage, rg = K.regOf(ct.cid); ct.relDone = 1; ct.wage = Math.max(1, Math.round(ct.wage * (1 - ct.relegation.cut)));
        if (rg) { rg.wage = ct.wage; rg.wh.push([S.week, ct.wage]); rg.ev.push([S.week, 'rebaja por descenso']); }
        K.log('renovacion', { club: h.club, wage: ct.wage, was: was, until: ct.endW, role: ct.role, desc: 1 });
        FP.Hero.msg(C.tname(h.team) + ' descendió: se aplica la rebaja salarial pactada del ' + Math.round(ct.relegation.cut * 100) + '% (' + FP.fmt.money(K.monthly(ct.wage)) + ' al mes).', 'warn');
      }
    } catch (e) { if (window.console) console.warn('contratos2', e); }
    return r;
  };
  K2.migrate = function () { };
})();
