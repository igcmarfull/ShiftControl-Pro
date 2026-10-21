/* FUTPRO — academia propia y herramientas de la ficha (llevarlo a tu club, minutos, apadrinar, representar, dinastía). Lógica en proyectos.js. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, UI = FP.UI, esc = U.esc, A = UI.acts, I = UI.icon, P = FP.Post, Y = FP.Proy, F = FP.Ficha, M = FP.Mentor, Dec = FP.Dec;
  function m(k) { return FP.fmt.money(k); }
  function pill(t, c) { return '<span class="pill ' + (c || '') + '">' + t + '</span>'; }
  function kv(l, v) { return '<div class="kv-i"><span>' + l + '</span><b>' + v + '</b></div>'; }
  function done(r) { if (r && r.msg) UI.toast(esc(r.msg), r.ok === false ? 'warn' : 'ok'); UI.render(); }

  UI.acadTab = function (h, p) {
    var S = FP.S, a = Y.ac(), html = '';
    if (!h.retired) return '<div class="card"><p class="mut">Disponible cuando te retires: podrás fundar una academia y formar a las promesas de tu país.</p></div>';
    if (!a) return '<div class="card"><div class="hd"><h3>' + I('train') + 'Academia propia</h3></div><p class="mut">Funda una academia de fútbol: cada año recibe promesas de 12 años de tu país. Las formas, las llevas a un club y cobras compensación por formación y derechos cuando se transfieren. Puedes apadrinarlas o representarlas.</p><p class="mut sm">Costo de fundación: ' + m(Y.FOUND) + '. Gasto anual: ' + m(Y.run(1)) + ' por nivel.</p><button class="btn pri" data-act="ac-found"' + (h.money < Y.FOUND ? ' disabled' : '') + '>Fundar la academia (' + m(Y.FOUND) + ')</button></div>';
    var next = a.lv < 5 ? Y.UP[a.lv + 1] : null;
    html += '<div class="grid g2"><div class="card"><div class="hd"><h3>' + I('train') + esc(Y.NAMES[a.lv]) + '</h3>' + pill('Nivel ' + a.lv + ' de 5', 'g') + '</div>' + kv('Gasto anual', m(Y.cost(a))) + kv('Promesas por año', a.lv >= 5 ? '3' : a.lv >= 4 ? '2–3' : a.lv >= 3 ? '2' : a.lv >= 2 ? '1–2' : '1') + kv('Graduados', a.grads) + kv('Figuras formadas (media 72+)', a.stars || 0) + kv('Invertido en total', m(Math.round(a.paid))) +
      (next ? '<div style="margin-top:.6rem"><button class="btn pri" data-act="ac-up">Mejorar a ' + esc(Y.NAMES[a.lv + 1].toLowerCase()) + ' (' + m(next) + ')</button></div>' : '<p class="mut sm">Tu academia ya es de élite.</p>') + '<p class="mut sm" style="margin-top:.5rem">Un nivel mayor y tus figuras formadas mejoran la calidad de las promesas.</p></div>';
    html += '<div class="card"><div class="hd"><h3>' + I('history') + 'Novedades</h3></div>' + (a.log.length ? a.log.slice(0, 6).map(function (x) { return '<div class="row sp sm"><span>' + esc(x.t) + '</span><span class="mut">' + esc(D.fmt(x.w)) + '</span></div>'; }).join('') : '<p class="mut sm">Las primeras promesas llegan el próximo año.</p>') + '</div></div>';
    var kids = a.kids.slice().reverse();
    html += '<div class="card"><div class="hd"><h3>' + I('user') + 'Tus promesas</h3></div>' + (kids.length ? '<table class="wt"><thead><tr><th>Jugador</th><th class="n">Edad</th><th class="n">Nivel</th><th class="n">Pot.</th><th>Situación</th><th></th></tr></thead><tbody>' + kids.map(function (k) {
      var q = S.pl[k.pid], ok = q && typeof q === 'object'; if (!ok) return '<tr><td>' + esc((F.ensure().pl[k.pid] || {}).n || '—') + '</td><td></td><td></td><td></td><td>Retirado</td><td></td></tr>';
      var st = k.out ? (q.c >= 0 ? esc(C.tname(q.c)) : 'Sin club') : 'En la academia';
      return '<tr><td>' + UI.posb(q.p) + ' ' + esc(q.n) + (k.star ? ' ' + pill('Figura', 'g') : '') + '</td><td class="n">' + C.age(q) + '</td><td class="n">' + q.o + '</td><td class="n">' + Math.round(q.pt) + '</td><td>' + st + '</td><td><a class="more" data-act="fichago" data-id="' + q.i + '">Ficha</a></td></tr>';
    }).join('') + '</tbody></table>' : '<p class="mut sm">Todavía no hay promesas.</p>') + '</div>';
    return html;
  };

  // herramientas dentro de la ficha
  UI.fichaTools = function (r) {
    var S = FP.S, q = S.pl[r.pid], alive = !r.end && q && typeof q === 'object', b = [];
    if (!alive) return '';
    var my = Y.myClub(), pa = P.ensure().path, pr = M && M.get();
    if (my && q.c !== my.id) { var why = Y.canSign(r.pid); b.push('<button class="btn" data-act="py-sign" data-id="' + r.pid + '"' + (why ? ' disabled title="' + esc(why) + '"' : '') + '>Llevarlo a ' + esc(C.tname(my.id)) + '</button>'); }
    if (my && my.kind === 'tec' && q.c === my.id) b.push('<button class="btn ' + (Y.fav()[r.pid] ? 'pri' : '') + '" data-act="py-fav" data-id="' + r.pid + '">' + (Y.fav()[r.pid] ? 'Titular siempre ✓' : 'Darle minutos (titular)') + '</button>');
    if (r.kind === 'academia' && !pr) b.push('<button class="btn" data-act="py-adopt" data-id="' + r.pid + '">Apadrinar</button>');
    if (r.kind === 'academia' && pa && pa.k === 'agent' && P.ensure().agentLic && !pa.clients.some(function (c) { return c.pid === r.pid; })) b.push('<button class="btn" data-act="py-rep" data-id="' + r.pid + '">Representarlo</button>');
    var dy = pr && pr.pid === r.pid ? Y.dynasty() : null;
    if (dy) b.push('<button class="btn pri" data-act="py-dyn">Continuar la dinastía como ' + esc(dy.first) + '</button>');
    return b.length ? '<div class="btn-group" style="margin:.6rem 0">' + b.join('') + '</div>' + (my && my.kind === 'tec' && q.c === my.id ? '<div class="mut sm">Si lo pones de titular y no tiene el nivel, el equipo lo nota; si juega mucho, progresa más.</div>' : '') : '';
  };
  A['ac-found'] = function () { done(Y.found()); };
  A['ac-up'] = function () { done(Y.upgrade()); };
  A['py-sign'] = function (d) { done(Y.sign(+d.id)); };
  A['py-fav'] = function (d) { done(Y.toggleFav(+d.id)); };
  A['py-adopt'] = function (d) { done(M.adopt(+d.id)); };
  A['py-rep'] = function (d) {
    var pa = P.ensure().path, q = FP.S.pl[+d.id]; if (!pa || pa.k !== 'agent' || !q) return;
    if (pa.clients.some(function (c) { return c.pid === q.i; })) return;
    pa.clients.push({ pid: q.i, since: FP.S.week, loy: 70, com: 0, star: false, nm: q.n }); FP.S.hero.history.push({ w: FP.S.week, t: 'Pasas a representar a ' + q.n + ', formado en tu academia.' }); done({ ok: true, msg: 'Representas a ' + q.n + '.' });
  };
  A['py-dyn'] = function () {
    var d = Y.dynasty(); if (!d) return;
    UI.confirm('Empezarás una carrera nueva como ' + d.first + ' ' + d.last + ', con su nivel (' + d.ovr + ') y potencial. Esta partida queda guardada tal como está. ¿Continuar la dinastía?', function () {
      FP.Store.save().catch(function () { }).then(function () { FP.Start.dynasty(d); });
    });
  };
})();
