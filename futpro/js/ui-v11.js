/* FUTPRO — pantalla Pruebas masivas (jornadas abiertas y showcases para jugadores sin club). Solo presentación: js/tryouts.js. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, UI = FP.UI, esc = U.esc, A = UI.acts, SC = UI.screens, I = UI.icon, T = FP.Tryouts, hdr = UI.hdr;
  function pill(t, c) { return '<span class="pill ' + (c || '') + '">' + t + '</span>'; }
  var LV = { top: ['Destacaste', 'g'], sel: ['Seleccionado', 'b'], no: ['No seleccionado', ''] };

  SC.tryouts = function () {
    var S = FP.S, h = S.hero, ty = T.ensure(), html = hdr('search', 'Pruebas masivas', 'Jornadas abiertas y showcases para conseguir club');
    if (!T.eligible()) return html + '<div class="card"><p class="mut">' + (h.retired ? 'Ya te retiraste.' : 'Las pruebas masivas son para jugadores sin club o en un club amateur. Cuando termines tu contrato, o si te quedas libre, aparecerán aquí.') + '</p></div>' + hist(ty);
    T.refresh();
    var items = S.ty.items.slice().sort(function (a, b) { return a.w - b.w; }), age = FP.Hero.age();
    if (ty.reg) html += '<div class="card" style="border-color:var(--ac)"><div class="hd"><h3>' + I('check') + 'Inscrito</h3>' + pill('En ' + Math.max(0, ty.reg.w - S.week) + ' sem.', 'g') + '</div><p>' + descr(ty.reg.item) + '</p><button class="btn sm" data-act="tycancel">Cancelar inscripción</button></div>';
    html += '<div class="notice">Compites contra cientos de aspirantes. Solo los primeros puestos reciben propuestas: cuanto mejor sea tu nivel respecto al de los asistentes, más probable es destacar. ' + (age < 18 ? 'Siendo menor de 18 años solo puedes asistir a pruebas de tu país.' : '') + '</div>';
    html += tripCard();
    if (!items.length) html += '<div class="card"><p class="mut">No hay convocatorias abiertas ahora. Cada mes se anuncian nuevas.</p></div>';
    html += '<div class="grid g2">' + items.map(function (it) {
      var ch = T.chance(it), mine = ty.reg && ty.reg.id === it.id, club = it.kind === 'club' ? S.clubs[it.club] : null;
      return '<div class="card"><div class="hd"><h3>' + (club ? UI.crest(club.id) + esc(club.nm) : I('globe') + (it.intl ? 'Showcase internacional' : 'Showcase regional')) + '</h3>' + pill(it.kind === 'club' ? 'Jornada abierta' : 'Showcase', it.kind === 'club' ? '' : 'b') + '</div>' +
        '<div class="terms" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))"><div><span>Fecha</span><b>' + esc(D.fmt(it.w)) + '</b></div><div><span>Aspirantes</span><b>' + it.n + '</b></div><div><span>Plazas</span><b>' + ch.sel + '</b></div><div><span>Inscripción</span><b>' + (it.cost && age >= 18 ? UI.money(it.cost) : 'Gratis') + '</b></div><div><span>Tu opción</span><b>' + ch.label + '</b></div></div>' +
        (it.kind === 'show' ? '<div class="mut sm" style="margin-top:.5rem">Ojeadores de ' + it.clubs.length + ' clubes: ' + it.clubs.slice(0, 5).map(function (id) { return esc(C.tname(id)); }).join(', ') + (it.clubs.length > 5 ? '…' : '') + '</div>' : '') +
        '<div style="margin-top:.6rem">' + (mine ? pill('Inscrito', 'g') : '<button class="btn pri" data-act="tyreg" data-id="' + it.id + '"' + (ty.reg ? ' disabled' : '') + '>Inscribirme</button>') + '</div></div>';
    }).join('') + '</div>';
    return html + hist(ty);
  };
  // ---- viaje de prueba al extranjero ----
  var tysel = [];
  function tripCard() {
    var S = FP.S, h = S.hero, ty = T.ensure(), age = FP.Hero.age(), tr = ty.trip, can = T.canTrip(), L = FP.Life;
    var head = '<div class="hd"><h3>' + I('globe') + 'Viaje de prueba al extranjero</h3>' + (tr ? pill('De viaje · vuelves en ' + Math.max(0, tr.w1 - S.week) + ' sem.', 'g') : '') + '</div>';
    if (tr) return '<div class="card" style="border-color:var(--ac)">' + head + '<p class="sm">Estás en ' + esc(FP.DATA.countries[tr.cc].n) + ' probándote en ' + tr.clubs.map(function (id) { return esc(C.tname(id)); }).join(', ') + '. Los resultados llegan al volver.</p></div>';
    var intro = '<p class="mut sm">Si no consigues club en tu país, puedes viajar unas semanas a otro para probarte en hasta ' + T.TRIP_MAX_CLUBS + ' clubes. Hasta los 19 años son pruebas de cantera; desde los 20, con el primer equipo. Los clubes solo pueden ficharte si tienen cupo de extranjeros y permiso de trabajo; los menores de 18 solo van a países de la UE/EEE (desde los 16).</p>';
    if (!can.ok) return '<div class="card">' + head + intro + '<p class="warn sm">' + esc(can.msg) + '</p></div>';
    var cs = T.tripCountries(), cc = UI.filt.tyc && cs.indexOf(UI.filt.tyc) >= 0 ? UI.filt.tyc : (cs.indexOf('ESP') >= 0 ? 'ESP' : cs[0]);
    if (UI.filt.tycLast !== cc) { tysel = []; UI.filt.tycLast = cc; }
    var opts = T.tripClubs(cc), cost = T.tripCost(cc, Math.max(1, tysel.length));
    var lang = L ? L.langKey(cc) : null, lv = L && lang ? Math.round(L.level(lang)) : null;
    var rows = opts.map(function (o) {
      var on = tysel.indexOf(o.c.id) >= 0, p = Math.round(o.p * 100);
      return '<div class="row sp" style="padding:.35rem 0;border-top:1px solid var(--line)"><div class="row">' + UI.crest(o.c.id) + '<div><b>' + esc(o.c.nm) + '</b><div class="mut sm">' + esc(FP.LGDEF[o.c.lg].n) + ' · prueba de ' + o.kind + '</div></div></div><div class="row">' +
        (o.ok ? '<span class="pill ' + (p >= 50 ? 'g' : p >= 25 ? 'y' : '') + '">' + p + '%</span>' + (o.cool ? '<span class="pill">descartado hace poco</span>' : '') + '<button class="btn sm ' + (on ? 'pri' : '') + '" data-act="tysel" data-id="' + o.c.id + '">' + (on ? 'Elegido' : 'Elegir') + '</button>' : '<span class="pill r">' + esc(o.why) + '</span>') + '</div></div>';
    }).join('');
    return '<div class="card">' + head + intro + '<div class="filters"><label class="f"><span>País</span><select data-act="tycc">' + cs.map(function (k) { return '<option value="' + k + '"' + (cc === k ? ' selected' : '') + '>' + esc(FP.DATA.countries[k].n) + '</option>'; }).join('') + '</select></label></div>' +
      (lv != null ? '<p class="mut sm">Idioma: ' + esc(L.langName(lang)) + ' · tu nivel ' + lv + '%.</p>' : '') +
      '<div style="max-height:380px;overflow:auto;margin-right:-.3rem;padding-right:.3rem">' + (rows || '<p class="mut sm">Sin clubes disponibles en ese país a tu edad.</p>') + '</div>' +
      '<div class="row sp" style="margin-top:.7rem"><span class="sm">' + tysel.length + ' de ' + T.TRIP_MAX_CLUBS + ' clubes · ' + (1 + tysel.length) + ' semanas · ' + (age < 18 ? 'gastos cubiertos por tu familia' : 'costo ' + UI.money(cost)) + '</span><button class="btn pri" data-act="tygo"' + (tysel.length ? '' : ' disabled') + '>Viajar y probarme</button></div></div>';
  }
  A.tycc = function (d, t) { UI.filt.tyc = t.value; UI.render(); };
  A.tysel = function (d) { var id = +d.id, i = tysel.indexOf(id); if (i >= 0) tysel.splice(i, 1); else if (tysel.length < T.TRIP_MAX_CLUBS) tysel.push(id); else UI.toast('Máximo ' + T.TRIP_MAX_CLUBS + ' clubes por viaje.', 'warn'); UI.render(); };
  A.tygo = function () { var r = T.startTrip(UI.filt.tyc && T.tripCountries().indexOf(UI.filt.tyc) >= 0 ? UI.filt.tyc : (T.tripCountries().indexOf('ESP') >= 0 ? 'ESP' : T.tripCountries()[0]), tysel.slice()); if (r.ok) tysel = []; UI.toast(esc(r.msg), r.ok ? 'ok' : 'warn'); UI.render(); };
  function descr(it) { return it.kind === 'club' ? 'Jornada abierta de ' + esc(FP.S.clubs[it.club].nm) + ' · ' + esc(D.fmt(it.w)) : (it.intl ? 'Showcase internacional' : 'Showcase regional') + ' · ' + esc(D.fmt(it.w)); }
  function hist(ty) {
    if (!ty.hist.length) return '';
    return '<div class="card"><div class="hd"><h3>' + I('history') + 'Tus pruebas</h3></div>' + ty.hist.map(function (r) { var l = LV[r.level]; return '<div class="row sp sm" style="padding:.3rem 0"><span>' + esc(D.fmt(r.w)) + ' · ' + (r.kind === 'trip' ? 'Viaje a ' + esc(FP.DATA.countries[r.cc].n) : r.club != null ? esc(C.tname(r.club)) : 'Showcase') + (r.kind === 'trip' ? ' <span class="mut">(' + r.n + (r.n === 1 ? ' club' : ' clubes') + ')</span>' : ' <span class="mut">(' + r.rank + '.º de ' + r.n + ')</span>') + (r.offers.length ? ' <span class="mut">→ ' + esc(r.offers.join(', ')) + '</span>' : '') + '</span>' + pill(r.kind === 'trip' ? (r.offers.length ? 'Con propuestas' : 'Sin propuestas') : l[0], r.kind === 'trip' ? (r.offers.length ? 'g' : '') : l[1]) + '</div>'; }).join('') + '</div>';
  }
  A.tyreg = function (d) { var r = T.register(+d.id); UI.toast(esc(r.msg), r.ok ? 'ok' : 'warn'); UI.render(); };
  A.tycancel = function () { T.cancel(); UI.render(); };
  var g = UI.GROUPS[3][1]; g.splice(g.length, 0, ['tryouts', 'Pruebas masivas', 'search']);
  var badges0 = UI.badges;
  UI.badges = function () { var b = badges0.apply(this, arguments); var h = FP.S && FP.S.hero; if (h && T.eligible() && FP.S.ty && !h.ty.reg && FP.S.ty.items.length && h.tk === 'free') b.tryouts = FP.S.ty.items.length; return b; };
})();
