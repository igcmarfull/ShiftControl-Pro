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
  function descr(it) { return it.kind === 'club' ? 'Jornada abierta de ' + esc(FP.S.clubs[it.club].nm) + ' · ' + esc(D.fmt(it.w)) : (it.intl ? 'Showcase internacional' : 'Showcase regional') + ' · ' + esc(D.fmt(it.w)); }
  function hist(ty) {
    if (!ty.hist.length) return '';
    return '<div class="card"><div class="hd"><h3>' + I('history') + 'Tus pruebas</h3></div>' + ty.hist.map(function (r) { var l = LV[r.level]; return '<div class="row sp sm" style="padding:.3rem 0"><span>' + esc(D.fmt(r.w)) + ' · ' + (r.club != null ? esc(C.tname(r.club)) : 'Showcase') + ' <span class="mut">(' + r.rank + '.º de ' + r.n + ')</span>' + (r.offers.length ? ' <span class="mut">→ ' + esc(r.offers.join(', ')) + '</span>' : '') + '</span>' + pill(l[0], l[1]) + '</div>'; }).join('') + '</div>';
  }
  A.tyreg = function (d) { var r = T.register(+d.id); UI.toast(esc(r.msg), r.ok ? 'ok' : 'warn'); UI.render(); };
  A.tycancel = function () { T.cancel(); UI.render(); };
  var g = UI.GROUPS[3][1]; g.splice(g.length, 0, ['tryouts', 'Pruebas masivas', 'search']);
  var badges0 = UI.badges;
  UI.badges = function () { var b = badges0.apply(this, arguments); var h = FP.S && FP.S.hero; if (h && T.eligible() && FP.S.ty && !h.ty.reg && FP.S.ty.items.length && h.tk === 'free') b.tryouts = FP.S.ty.items.length; return b; };
})();
