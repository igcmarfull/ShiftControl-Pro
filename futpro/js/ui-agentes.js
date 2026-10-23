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
  // centro de gestión: el representante a la izquierda y su actividad a la derecha
  function tile(v, label) { return '<div class="card" style="padding:.6rem;text-align:center"><b style="font-size:1.25rem">' + v + '</b><div class="mut sm">' + label + '</div></div>'; }
  function clubLine(c) { return esc(c.nm) + ' <span class="mut sm">(' + esc(FP.DATA.countries[c.c].n) + ')</span>'; }
  UI.agentCenter = function () {
    var S = FP.S, h = S.hero, st = Ag.status(), a = st.agent, ag = h.agent, fx = FP.Hero.age() < 15;
    var info = a ? '<p class="mut sm" style="margin:.4rem 0">' + esc(a.desc) + '</p>' : '';
    var left = '<div><div class="terms" style="grid-template-columns:1fr;gap:.4rem"><div><span>Nombre</span><b>' + esc(ag.nm) + '</b></div><div><span>Nivel</span><b class="rep">' + UI.stars(ag.lvl * 20) + '</b></div><div><span>Comisión</span><b>' + ag.com + '% de sueldo y bonos</b></div></div>' + info +
      (a ? '<div class="sm mut">Contactos: ' + Object.keys(a.contacts).sort(function (x, y) { return a.contacts[y] - a.contacts[x]; }).slice(0, 4).map(function (c) { return esc(FP.DATA.countries[c].n); }).join(', ') + '</div>' : '') +
      '<p class="mut sm" style="margin:.6rem 0">Más nivel: más ofertas y mejores condiciones.</p><button class="btn sm" data-act="dropagent">Despedir</button></div>';
    var chip = st.active ? '<span class="chip" style="background:rgba(34,197,94,.14)">Buscando oportunidades</span>' : '<span class="chip">Sin instrucciones</span>';
    var next = !st.active ? '—' : st.next.capped ? 'sin gestiones hasta dentro de ' + st.next.capped + ' sem.' : st.next.weeks > 0 ? 'en ' + st.next.weeks + ' sem.' : 'esta semana';
    var right = '<div><div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.6rem"><b>Actividad</b>' + chip + '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem">' + tile(st.targets.length + '/' + st.max, 'clubes objetivo') + tile(st.effective + '/' + st.cap, 'gestiones efectivas') + tile(st.active ? st.left + ' sem.' : '—', 'instrucción vigente') + '</div>' +
      '<div class="sm" style="margin:.6rem 0"><span class="mut">Próxima gestión:</span> ' + next + '</div>';
    if (st.fit) right += '<div class="sm" style="margin-bottom:.4rem"><span class="mut">Especialidad y destino:</span> contactos <b>' + st.fit.label + '</b> (' + st.fit.known + ' de ' + st.fit.total + ' clubes de ' + esc(Ag.destLabel(Ag.brief().dest)) + ')</div>';
    if (st.diag) right += '<div class="sm" style="margin-bottom:.4rem"><span class="mut">Clubes que hoy cumplen tus requisitos en el destino:</span> ' + st.diag.n[3] + ' de ' + st.diag.n[0] + ' <span class="mut">(visibles ' + st.diag.n[1] + ', pueden ficharte ' + st.diag.n[2] + ')</span></div>';
    right += '<div class="tag" style="font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;margin:.6rem 0 .2rem" >Clubes que sigue</div>' + (st.targets.length ? st.targets.map(function (t) { var pct = Math.min(100, Math.round(t.v / 38 * 100)); return '<div class="sm" style="margin:.3rem 0"><div style="display:flex;justify-content:space-between"><span>' + clubLine(t.club) + '</span><span class="mut">interés ' + Math.round(t.v) + ' de 38 · ' + t.push + (t.push === 1 ? ' contacto' : ' contactos') + '</span></div><div style="height:.35rem;border-radius:.3rem;background:rgba(127,127,127,.25);overflow:hidden"><i style="display:block;height:100%;width:' + pct + '%;background:#2aa3a0"></i></div></div>'; }).join('') : '<div class="mut sm">Todavía ninguno.</div>') +
      '<div class="tag" style="font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;margin:.6rem 0 .2rem">Ya te siguen de cerca</div>' + (st.won.length ? st.won.map(function (d) { return '<div class="sm">' + clubLine(d.club) + ' <span class="mut">· interés ' + d.v + ' (' + esc(FP.Date.fmt(d.w)) + '): depende de que el club presente propuesta</span></div>'; }).join('') : '<div class="mut sm">Todavía ninguno.</div>') +
      '<div class="tag" style="font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;margin:.6rem 0 .2rem">Clubes que se alejaron</div>' + (st.drops.length ? st.drops.map(function (d) { return '<div class="sm">' + clubLine(d.club) + ' <span class="mut">· ' + esc(d.why) + ' (' + esc(FP.Date.fmt(d.w)) + ')</span></div>'; }).join('') : '<div class="mut sm">Ninguno por ahora.</div>') + '</div>';
    var reco = Ag.recommend(5), recoHtml = '<div style="margin-top:.8rem"><h4 style="margin:.2rem 0">Tu agente te recomienda</h4><p class="mut sm">Dónde hay hoy clubes que pueden ficharte con tu nivel y tu reputación (cupos, edad, permisos y encaje incluidos). No es una oferta: es el mapa del mercado.</p>' +
      (reco.length ? reco.map(function (x) { return '<div class="row" style="display:flex;gap:.6rem;align-items:center;justify-content:space-between;padding:.35rem 0;border-top:1px solid rgba(127,127,127,.2)"><div class="sm"><b>' + esc(x.name) + '</b> · ' + x.n + ' clubes posibles' + (x.up ? ' (' + x.up + ' de nivel parecido o superior)' : ' (todos de nivel inferior)') + ' <span class="mut">· contactos del agente: ' + x.contact + '</span></div><button class="btn sm" data-act="agreco" data-c="' + esc(x.c) + '">Buscar aquí</button></div>'; }).join('') : '<div class="mut sm">Hoy ningún club visible puede ficharte: tu reputación aún no llega a ningún mercado.</div>') + '</div>';
    return '<div class="card"><div class="hd"><h3>' + UI.icon('user') + 'Representante</h3></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.2rem">' + left + right + '</div>' + recoHtml + UI.agentBrief() + '</div>';
  };
  A.agdest = function (d, t) { (UI.filt.ag = UI.filt.ag || {}).dest = t.value; };
  A.agprio = function (d, t) { (UI.filt.ag = UI.filt.ag || {}).prio = t.value; };
  function done(r) { UI.toast(esc(r.msg), r.ok ? 'ok' : 'warn'); UI.filt.ag = null; UI.render(); }
  A.agreco = function (d) { var b = Ag.brief(), r = Ag.setBrief('pais:' + d.c, b && b.prio || ''); done(r); };
  A.agsave = function () { var f = UI.filt.ag || {}; done(Ag.setBrief(f.dest || 'any', f.prio || '')); };
  A.agloan = function () { done(Ag.askLoan()); };
  A.agrenew = function () { done(Ag.askRenew()); };
})();
