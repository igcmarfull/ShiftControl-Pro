/* FUTPRO — representante: cada cliente tiene lealtad y una carrera propia. Cada año pueden surgir ofertas de traspaso,
   renovaciones, ganas de irse y patrocinios; tus decisiones mueven comisiones, lealtad y reputación como agente. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, Dec = FP.Dec, P = FP.Post;
  var G = FP.Agency = {};

  G.state = function (cl) { if (cl.loy == null) { cl.loy = 60; cl.com = 0; cl.star = false; cl.o0 = null; } return cl; };
  G.player = function (cl) { var q = FP.S.pl[cl.pid]; return q && q.c !== -2 ? q : null; };
  // mueve a un jugador real a otro club (plantillas, contrato y cachés)
  G.move = function (q, clubId) {
    var S = FP.S, old = q.c;
    if (old >= 0 && S.ro[old]) S.ro[old] = S.ro[old].filter(function (x) { return x !== q; });
    q.c = clubId; q.ce = D.year(S.week) + U.int(2, 4);
    (S.ro[clubId] = S.ro[clubId] || []).push(q);
    [old, clubId].forEach(function (id) { if (id >= 0 && S.clubs[id]) { delete FP.Match.cache[id]; C.calcStr(S.clubs[id]); } });
  };
  G.suitors = function (q) {
    var S = FP.S, age = C.age(q), cur = q.c >= 0 ? S.clubs[q.c] : null, out = [];
    S.clubs.forEach(function (c) {
      if (c === cur || !FP.Rep.foreignOK(c, q.nat, age)) return;
      if (cur && c.st < cur.st + 2) return;
      if (q.o < c.st - 7 || q.o > c.st + 12) return;
      out.push(c);
    });
    out.sort(function (a, b) { return Math.abs(a.st - q.o) - Math.abs(b.st - q.o) + (R() - 0.5) * 6; });
    return out.slice(0, 3);
  };
  G.comm = function (q, club, fee) { var cw = FP.DATA.countries[club.c]; var wage = C.wage(C.value(q.o, q.pt, C.age(q)), cw ? cw.w : 0.5); return Math.round(wage * 0.15 + (fee || 0) * 0.02); };

  G.yearTick = function (p, pa) {
    var S = FP.S, label = FP.Market.seasonLabel(), tot = 0, keep = [], y = D.year(S.week);
    pa.clients.forEach(function (cl) {
      G.state(cl); var q = G.player(cl); if (!q) { FP.Hero.msg('Tu representado ' + (cl.nm || '') + ' se retira del fútbol.', 'i'); return; }
      cl.nm = q.n;
      var growth = cl.o0 == null ? 0 : q.o - cl.o0; cl.o0 = q.o;
      cl.loy = U.clamp(cl.loy + (growth >= 2 ? 5 : growth <= -2 ? -4 : 0) + (q.c >= 0 && S.clubs[q.c] && q.o >= S.clubs[q.c].st ? 2 : -3), 0, 100);
      var c = P.wageEst(q) * 0.07 * (cl.star ? 1.3 : 1); tot += c; cl.com += c;
      pa.rep = (pa.rep || 0) + (q.o >= 72 ? 2 : 0.5);
      if (!cl.star && q.o >= 80) { cl.star = true; pa.rep += 10; FP.Hero.msg('¡' + q.n + ', tu representado, se convierte en una figura (media ' + q.o + ')!', 'ok'); FP.S.hero.history.push({ w: S.week, t: 'Tu representado ' + q.n + ' se consagra como figura (media ' + q.o + ').' }); }
      if (cl.loy < 15) { FP.Hero.msg(q.n + ' decide cambiar de representante.', 'warn'); FP.S.hero.history.push({ w: S.week, t: q.n + ' deja tu agencia.' }); return; }
      keep.push(cl); G.events(cl, q, y);
    });
    pa.clients = keep; P.pay(tot, 'Comisiones de representados'); pa.seasons.push({ y: label, n: keep.length, com: Math.round(tot), stars: keep.filter(function (c) { return c.star; }).length });
  };
  G.events = function (cl, q, y) {
    var S = FP.S, age = C.age(q), cur = q.c >= 0 ? S.clubs[q.c] : null; if (!cur) return;
    var su = null, kind = null;
    if (q.ce <= y + 1 && age >= 18 && R() < 0.7) kind = 'renov';
    else if (cl.loy < 35 && R() < 0.5) kind = 'irse';
    else if (age >= 17 && R() < 0.4 && (su = G.suitors(q)).length) kind = 'oferta';
    else if (cl.star && R() < 0.35) kind = 'patro';
    if (!kind) return;
    var base = { kind: 'agente', uniq: kind + cl.pid + y, exp: 20, data: { pid: cl.pid, kind: kind } }, nm = q.n;
    if (kind === 'renov') Dec.add(U.ext(base, { title: nm + ': su contrato termina pronto', text: 'A ' + nm + ' le queda poco en ' + cur.nm + '. Puedes renovar, dejar que termine o buscarle club.', def: 'renovar', opts: [{ k: 'renovar', label: 'Renovar con ' + cur.nm, hint: 'Comisión menor y estabilidad; sube algo su lealtad.' }, { k: 'libre', label: 'Dejar que termine', hint: 'Si no hay contrato quedará libre: puede salir con prima, pero arriesga la lealtad.' }, { k: 'buscar', label: 'Buscarle otro club', hint: 'Genera ofertas; con riesgo de no encontrar.' }] }));
    else if (kind === 'irse') Dec.add(U.ext(base, { title: nm + ' quiere irse', text: 'Se siente poco valorado en ' + cur.nm + ' y te pide que busques una salida.', def: 'buscar', opts: [{ k: 'buscar', label: 'Buscarle un nuevo club', hint: 'Recupera su confianza si sale bien.' }, { k: 'convencer', label: 'Convencerlo de que siga', hint: 'Puede no funcionar; si funciona, sube la lealtad.' }] }));
    else if (kind === 'patro') Dec.add(U.ext(base, { title: 'Patrocinio para ' + nm, text: 'Una marca quiere a ' + nm + ' como imagen. Te toca una comisión por cerrarlo.', def: 'aceptar', opts: [{ k: 'aceptar', label: 'Cerrar el contrato', hint: 'Ingreso extra y más lealtad.' }, { k: 'rechazar', label: 'Esperar una oferta mejor', hint: 'Puede mejorar o desaparecer.' }] }));
    else { var c = su[0]; Dec.add(U.ext(base, { title: 'Oferta por ' + nm, text: c.nm + ' (' + C.cname(c.c) + ') quiere fichar a ' + nm + ' (' + q.o + ', ' + age + ' años). Hoy juega en ' + cur.nm + '.', def: 'rechazar', data: { pid: cl.pid, kind: kind, club: c.id }, opts: [{ k: 'aceptar', label: 'Aceptar el traspaso', hint: 'Comisión por la firma; sube su lealtad si el club es mejor.' }, { k: 'subasta', label: 'Pedir más dinero', hint: 'Mitad de las veces mejora; si no, el club se retira.' }, { k: 'rechazar', label: 'Rechazar', hint: 'Se queda donde está; sin ingreso.' }] })); }
  };
  U.ext = function (a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; };
  Dec.handlers.agente = function (k, d) {
    var S = FP.S, p = P.ensure(), pa = p.path; if (!pa || pa.k !== 'agent') return { ok: true, msg: '' };
    var cl = pa.clients.filter(function (c) { return c.pid === d.data.pid; })[0], q = S.pl[d.data.pid]; if (!cl || !q) return { ok: true, msg: 'El cliente ya no está en tu cartera.' };
    G.state(cl); var kind = d.data.kind, nm = q.n;
    function pay(x, why) { P.pay(x, why); cl.com += x; }
    if (kind === 'oferta') {
      var club = S.clubs[d.data.club];
      if (k === 'rechazar') { cl.loy = Math.min(100, cl.loy + 3); return { ok: true, msg: nm + ' se queda en su club.' }; }
      if (k === 'subasta' && R() < 0.5) { k = 'aceptar'; d.data.mejor = 1; } else if (k === 'subasta') { cl.loy -= 5; return { ok: true, msg: club.nm + ' se retira: perdiste la operación.' }; }
      var fee = Math.round(C.value(q.o, q.pt, C.age(q)) * (0.85 + R() * 0.3));
      G.move(q, club.id); pay(G.comm(q, club, fee) * (d.data.mejor ? 1.5 : 1), 'Traspaso de ' + nm); cl.loy = Math.min(100, cl.loy + 6); pa.rep = (pa.rep || 0) + 3;
      FP.S.hero.history.push({ w: S.week, t: nm + ' ficha por ' + club.nm + ' con tu mediación.' }); FP.Sim.news(nm + ' ficha por ' + club.nm + '.', 'transfer', 1);
      return { ok: true, msg: nm + ' ficha por ' + club.nm + (d.data.mejor ? ' con mejores condiciones' : '') + '.' };
    }
    if (kind === 'renov') {
      if (k === 'renovar') { q.ce = D.year(S.week) + U.int(2, 4); pay(P.wageEst(q) * 0.03, 'Renovación de ' + nm); cl.loy = Math.min(100, cl.loy + 3); return { ok: true, msg: nm + ' renueva su contrato.' }; }
      if (k === 'libre') { if (R() < 0.55) { cl.loy -= 4; return { ok: true, msg: nm + ' queda a la espera de ofertas.' }; } cl.loy += 2; return { ok: true, msg: 'Dejas correr el contrato de ' + nm + '.' }; }
      var su = G.suitors(q); if (!su.length) { cl.loy -= 3; return { ok: true, msg: 'No encuentras un club mejor para ' + nm + '.' }; }
      G.move(q, su[0].id); pay(G.comm(q, su[0], 0), 'Traspaso de ' + nm); cl.loy += 5; return { ok: true, msg: nm + ' ficha por ' + su[0].nm + '.' };
    }
    if (kind === 'irse') {
      if (k === 'convencer') { if (R() < 0.5) { cl.loy = Math.min(100, cl.loy + 10); return { ok: true, msg: 'Convences a ' + nm + ' de seguir.' }; } cl.loy -= 8; return { ok: true, msg: nm + ' no se convence y se enfría contigo.' }; }
      var s2 = G.suitors(q); if (!s2.length) { cl.loy -= 5; return { ok: true, msg: 'No hay un club interesado: ' + nm + ' se frustra.' }; }
      G.move(q, s2[0].id); pay(G.comm(q, s2[0], 0), 'Traspaso de ' + nm); cl.loy = Math.min(100, cl.loy + 12); return { ok: true, msg: nm + ' ficha por ' + s2[0].nm + ' y te lo agradece.' };
    }
    if (kind === 'patro') {
      if (k === 'aceptar') { var x = Math.round(20 + q.o * 3); pay(x, 'Patrocinio de ' + nm); cl.loy = Math.min(100, cl.loy + 3); return { ok: true, msg: 'Cierras el patrocinio: ' + FP.fmt.money(x) + ' de comisión.' }; }
      if (R() < 0.5) { var x2 = Math.round(40 + q.o * 5); pay(x2, 'Patrocinio de ' + nm); return { ok: true, msg: 'La marca mejora la oferta: ' + FP.fmt.money(x2) + ' de comisión.' }; }
      return { ok: true, msg: 'La marca se va con otro jugador.' };
    }
    return { ok: true, msg: '' };
  };
  // reemplaza la rama de representante del cierre anual
  var yt0 = P.yearTick;
  P.yearTick = function () {
    var h = FP.S.hero, p = P.ensure(), pa = p.path;
    if (pa && pa.k === 'agent' && p.agentLic) { var save = pa; p.path = { k: 'x' }; try { yt0.apply(this, arguments); } finally { p.path = save; } G.yearTick(p, pa); return; }
    return yt0.apply(this, arguments);
  };
})();
