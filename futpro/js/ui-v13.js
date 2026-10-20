/* FUTPRO — mercado vivo (presentación): información para decidir entre ofertas y el panel de rumores/operaciones del Mercado. js/clubs.js */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, UI = FP.UI, esc = U.esc, SC = UI.screens, I = UI.icon, K = FP.Clubs;
  function pill(t, c) { return '<span class="pill ' + (c || '') + '">' + t + '</span>'; }

  UI.offerIntel = function (o) {
    if (!(o.type === 'transfer' || o.type === 'loan' || o.type === 'pro' || o.type === 'precontract' || o.type === 'trial_pro')) return '';
    var x = K.intel(o); if (!x) return '';
    var role = { comprador: 'Club comprador (con caja)', vendedor: 'Club vendedor', formador: 'Club formador', equilibrado: 'Club equilibrado' }[x.role];
    var rival = x.rivals.length ? x.rivals.map(function (p) { return esc(p.n) + ' <b>' + Math.round(p.o) + '</b> <span class="mut">(' + C.age(p) + ')</span>'; }).join(' · ') : 'sin competencia directa';
    var exp = x.gap >= 3 ? 'Serías de los mejores de tu puesto' : x.gap >= -1 ? 'Pelearías por un puesto' : x.kind === 'project' ? 'Entrarías como proyecto' : 'Empezarías en el banco';
    return '<div class="intel"><div class="mut sm">' + I('search') + ' <b>Qué encontrarías allí</b></div>' +
      '<div class="sm">' + (x.dSt != null ? (x.dSt > 1 ? '<span class="ok">Nivel del club +' + x.dSt + '</span>' : x.dSt < -1 ? '<span class="bad">Nivel del club ' + x.dSt + '</span>' : 'Nivel parecido al actual') + ' · ' : '') + esc(x.lgName) + ' · ' + role + ' · caja ' + x.budget + (x.coach ? ' · técnico ' + esc(x.coach.toLowerCase()) : '') + '</div>' +
      '<div class="sm">En tu puesto: ' + rival + '. ' + exp + (x.ahead ? ' (' + x.ahead + ' por delante).' : '.') + '</div></div>';
  };

  var market0 = SC.market;
  SC.market = function () {
    var html = market0.apply(this, arguments), S = FP.S, h = S.hero, mk = K.mk(), w = S.week, left = K.weeksLeft(w);
    var ops = (S.transfers || []).slice(0, 8), pend = mk.pend.filter(function (d) { return !d.quiet; });
    var card = '<div class="card"><div class="hd"><h3>' + I('transfer') + 'Mercado vivo</h3>' + (left == null ? pill('Ventana cerrada', '') : left === 0 ? pill('Último día', 'r') : pill('Cierra en ' + left + ' sem.', 'y')) + '</div>';
    if (pend.length) card += '<h4>Rumores en curso</h4>' + pend.map(function (d) { var p = S.pl[d.p]; return p ? '<div class="row sp sm"><span>' + esc(p.n) + ' <span class="mut">(' + p.o + ')</span>: ' + esc(S.clubs[d.to].nm) + ' ← ' + esc(S.clubs[d.from].nm) + '</span>' + pill('Se habla de ' + FP.fmt.money(Math.round(d.fee)), 'y') + '</div>' : ''; }).join('');
    var done = mk.rum.filter(function (r) { return r.st !== 'rumor'; }).slice(0, 5);
    if (done.length) card += '<h4 style="margin-top:.6rem">Rumores resueltos</h4>' + done.map(function (r) { return '<div class="row sp sm"><span>' + esc(r.t) + '</span>' + pill(r.st === 'oficial' ? 'Oficial' : 'Frustrado', r.st === 'oficial' ? 'g' : 'r') + '</div>'; }).join('');
    if (ops.length) card += '<h4 style="margin-top:.6rem">Últimas operaciones</h4>' + ops.map(function (t) { return '<div class="row sp sm"><span>' + esc(t.p) + ' <span class="mut">(' + t.o + ', ' + t.a + ')</span> · ' + esc(t.from != null && S.clubs[t.from] ? S.clubs[t.from].nm : '—') + ' → ' + esc(S.clubs[t.to] ? S.clubs[t.to].nm : '—') + '</span><b>' + (t.fee ? FP.fmt.money(t.fee) : 'libre') + '</b></div>'; }).join('');
    if (!pend.length && !done.length && !ops.length) card += '<p class="mut">Todavía no hay movimientos. Los clubes compran y venden durante las ventanas de fichajes.</p>';
    return html + card + '</div>';
  };
})();
