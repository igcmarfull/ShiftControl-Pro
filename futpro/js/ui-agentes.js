/* Pantalla de instrucciones al representante (fase 3 de docs/PROPUESTA_REPRESENTANTES.md). Se muestra dentro de la tarjeta «Representante» (js/ui-v5.js). */
(function () {
  var FP = window.FP, UI = FP.UI, U = FP.U, esc = U.esc, A = UI.acts, Ag = FP.Agents;
  UI.filt = UI.filt || {};
  var PR = [['', 'Sin prioridad'], ['titular', 'Ser titular'], ['sueldo', 'Sueldo'], ['desarrollo', 'Desarrollo']];
  function destOptions(cur) {
    var cs = {}; FP.DATA.leagues.forEach(function (l) { cs[l.c] = 1; });
    var countries = Object.keys(cs).sort(function (a, b) { return FP.DATA.countries[a].n.localeCompare(FP.DATA.countries[b].n, 'es'); });
    var leagues = FP.DATA.leagues.slice().sort(function (a, b) { return a.n.localeCompare(b.n, 'es'); });
    function o(v, t) { return '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(t) + '</option>'; }
    return '<optgroup label="General">' + o('any', 'Cualquier destino') + o('inf', 'Divisiones inferiores') + o('eur', 'Europa') + '</optgroup>' +
      '<optgroup label="País">' + countries.map(function (c) { return o('pais:' + c, FP.DATA.countries[c].n); }).join('') + '</optgroup>' +
      '<optgroup label="Liga">' + leagues.map(function (l) { return o('liga:' + l.id, l.n + ' (' + FP.DATA.countries[l.c].n + ')'); }).join('') + '</optgroup>';
  }
  function code(b) { return !b || !b.dest ? 'any' : b.dest.k === 'inferiores' ? 'inf' : b.dest.k === 'europa' ? 'eur' : b.dest.k + ':' + b.dest.arg; }
  UI.agentBrief = function () {
    var S = FP.S, h = S.hero; if (!h.agent || !Ag || FP.Hero.age() < 15) return '';
    var b = Ag.brief(), f = UI.filt.ag || (UI.filt.ag = { dest: code(b), prio: b && b.prio || '' }), left = b ? Math.max(0, b.until - S.week) : 0;
    var html = '<div style="margin-top:.8rem"><h4 style="margin:.2rem 0">Instrucciones</h4><p class="mut sm">Tu agente busca oportunidades según lo que le pidas, sin garantizar ofertas: los clubes siguen aplicando sus requisitos deportivos y económicos.</p>';
    html += b ? '<p class="sm"><b>Vigentes:</b> ' + esc(Ag.destLabel(b.dest)) + (b.prio ? ', prioridad: ' + Ag.PRIO_LABEL[b.prio] : '') + ' · ' + left + ' semanas</p>' : '<p class="mut sm">Sin instrucciones: tu agente mira todo el mercado.</p>';
    html += '<div class="filters"><label class="f"><span>Destino</span><select data-act="agdest">' + destOptions(f.dest) + '</select></label><label class="f"><span>Prioridad</span><select data-act="agprio">' + PR.map(function (p) { return '<option value="' + p[0] + '"' + (f.prio === p[0] ? ' selected' : '') + '>' + p[1] + '</option>'; }).join('') + '</select></label></div>';
    html += '<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin:.5rem 0"><button class="btn sm pri" data-act="agsave">Dar instrucciones</button>';
    var age = FP.Hero.age(), pro = h.tk === 'pro' || h.tk === 'academy';
    if (age <= 23 && pro) html += '<button class="btn sm" data-act="agloan">Pedir cesión</button>';
    if (h.tk === 'pro' && h.contract) html += '<button class="btn sm" data-act="agrenew">Pedir renovación</button>';
    if (pro && !h.flags.transferReq) html += '<button class="btn sm" data-act="reqtrans" title="Declaración formal: el club será más receptivo, pero tu ánimo y tu relación se resienten">Declarar mi intención de salir</button>';
    html += '</div>';
    if (h.agb && h.agb.log.length) html += '<div class="sm"><b>Últimos informes</b>' + h.agb.log.slice(0, 5).map(function (x) { return '<div class="mut">' + esc(FP.Date.fmt ? FP.Date.fmt(x.w) : 'sem. ' + x.w) + ' · ' + esc(x.t) + '</div>'; }).join('') + '</div>';
    return html + '</div>';
  };
  A.agdest = function (d, t) { (UI.filt.ag = UI.filt.ag || {}).dest = t.value; };
  A.agprio = function (d, t) { (UI.filt.ag = UI.filt.ag || {}).prio = t.value; };
  function done(r) { UI.toast(esc(r.msg), r.ok ? 'ok' : 'warn'); UI.filt.ag = null; UI.render(); }
  A.agsave = function () { var f = UI.filt.ag || {}; done(Ag.setBrief(f.dest || 'any', f.prio || '')); };
  A.agloan = function () { done(Ag.askLoan()); };
  A.agrenew = function () { done(Ag.askRenew()); };
})();
