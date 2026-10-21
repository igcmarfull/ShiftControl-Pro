/* FUTPRO — proyectos del retirado: academia propia, mercado de agente con ofertas múltiples, jugadores seguidos en tu club y dinastía.
   Se apoya en Youth (promesas), Agency (representados), Mentor (protegido), Ficha (libro de carrera) y Retiro (presidencia).
   Costos, calidad de las promesas y porcentajes son supuestos de diseño probados en tests/proyectos.js, no datos reales. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, Dec = FP.Dec, P = FP.Post, G = FP.Agency, M = FP.Mentor, K = FP.Coach, RT = FP.Retiro, Hero = FP.Hero;
  var Y = FP.Proy = {};

  function hero() { return FP.S && FP.S.hero; }
  function fm(v) { return FP.fmt.money(v); }
  function hist(t) { var h = hero(); (h.history = h.history || []).push({ w: FP.S.week, t: t }); }

  // ---------- academia propia ----------
  Y.FOUND = 150;                                   // mil €
  Y.UP = [0, 150, 450, 800, 1300, 1900];           // costo de pasar al nivel i
  Y.NAMES = ['Sin academia', 'Escuela de barrio', 'Academia local', 'Academia regional', 'Academia nacional', 'Academia de élite'];
  Y.run = function (lv) { return lv * 25; };
  Y.ac = function () { var p = P.ensure(); return p && p.acad ? p.acad : null; };
  Y.found = function () {
    var h = hero(), p = P.ensure(); if (!h.retired) return { ok: false, msg: 'Disponible cuando te retires.' };
    if (p.acad) return { ok: false, msg: 'Ya tienes una academia.' };
    if (h.money < Y.FOUND) return { ok: false, msg: 'Necesitas ' + fm(Y.FOUND) + ' para fundarla.' };
    FP.Contracts.pay(-Y.FOUND, 'inversion', 'Fundación de la academia');
    p.acad = { lv: 1, since: FP.S.week, kids: [], grads: 0, stars: 0, paid: Y.FOUND, log: [] };
    hist('Funda su academia de fútbol (' + Y.NAMES[1].toLowerCase() + ').');
    return { ok: true, msg: 'Fundas tu academia. Cada año recibirá promesas de 12 años.' };
  };
  Y.upgrade = function () {
    var h = hero(), a = Y.ac(); if (!a) return { ok: false, msg: '' };
    if (a.lv >= 5) return { ok: false, msg: 'Tu academia ya es de élite.' };
    var c = Y.UP[a.lv + 1]; if (h.money < c) return { ok: false, msg: 'Necesitas ' + fm(c) + ' para mejorarla.' };
    FP.Contracts.pay(-c, 'inversion', 'Mejora de la academia'); a.lv++; a.paid += c;
    hist('Mejora su academia a nivel ' + a.lv + ' (' + Y.NAMES[a.lv].toLowerCase() + ').'); return { ok: true, msg: 'Tu academia sube a ' + Y.NAMES[a.lv].toLowerCase() + '.' };
  };
  Y.intake = function () {
    var S = FP.S, h = hero(), p = P.ensure(), a = Y.ac(); if (!a) return;
    var n = a.lv >= 5 ? 3 : a.lv >= 4 ? (R() < 0.5 ? 3 : 2) : a.lv >= 3 ? 2 : a.lv >= 2 ? (R() < 0.5 ? 2 : 1) : 1, lg = p.legacy ? p.legacy.score : 40, names = [];
    for (var i = 0; i < n; i++) {
      var q = FP.Youth.makePros(h.nat, 12 + (R() < 0.4 ? 1 : 0));
      q.pt = U.clamp(Math.round(q.pt + (a.lv - 2) * 2.5 + (lg - 50) * 0.04 + (a.stars || 0) * 0.4 + U.norm() * 1.5), 45, 96);
      q.o = U.clamp(Math.min(q.pt, Math.round(q.o + (a.lv - 2) * 1.2)), 25, q.pt); q.prot = 1; q.acad = 1;
      a.kids.push({ pid: q.i, y: D.year(S.week) }); names.push(q.n);
    }
    a.log.unshift({ w: S.week, t: n + (n === 1 ? ' promesa ingresa' : ' promesas ingresan') + ' a la academia: ' + names.join(', ') + '.' }); a.log.length = Math.min(a.log.length, 20);
    FP.Hero.msg('Tu academia recibe ' + n + (n === 1 ? ' promesa' : ' promesas') + ': ' + names.join(', ') + '.', 'ok');
  };
  Y.cost = function (a) { return Y.run(a.lv); };
  Y.yearly = function () {
    var S = FP.S, h = hero(), p = P.ensure(), a = Y.ac(); if (!a) return;
    var c = Y.cost(a);
    if (h.money >= c) FP.Contracts.pay(-c, 'inversion', 'Gastos de la academia');
    else { a.lv = Math.max(0, a.lv - 1); FP.Hero.msg('No puedes costear la academia: baja de nivel.', 'warn'); if (!a.lv) { p.acad = null; hist('Cierra su academia por falta de fondos.'); return; } }
    var prot = M && M.get();
    a.kids.forEach(function (k) {
      var q = S.pl[k.pid];
      if (!q || typeof q !== 'object' || q.c === -2) { if (!k.out) { k.out = 1; k.end = 'retirado'; } return; }
      var age = C.age(q);
      if (!k.out && q.c === -3 && age >= 17 && (q.o >= 52 || age >= 19)) {
        var su = G.suitors(Object.assign({}, q, { c: -3 })), club = su[0] || S.clubs.filter(function (x) { return x.c === h.nat && Math.abs(x.st - q.o) < 10; })[0];
        if (club) { G.move(q, club.id); k.out = 1; k.club = club.id; k.g = D.year(S.week); a.grads++; var fee = Math.round(C.value(q.o, q.pt, age) * 0.08); if (fee > 0) P.pay(fee, 'Compensación por formación'); hist(q.n + ' sale de tu academia y ficha por ' + club.nm + '.'); FP.Hero.msg(q.n + ' debuta como profesional en ' + club.nm + ' (compensación ' + fm(fee) + ').', 'ok'); }
      } else if (!k.out && q.c === -3 && age >= 19) { k.out = 1; k.end = 'sin club'; }
      else if (k.out && k.club != null && q.c >= 0 && q.c !== k.club) {            // derechos de formación en un traspaso posterior
        var sol = Math.round(C.value(q.o, q.pt, age) * 0.05); k.club = q.c; if (sol > 0) { P.pay(sol, 'Derechos de formación de ' + q.n); FP.Hero.msg(q.n + ' cambia de club: cobras derechos de formación (' + fm(sol) + ').', 'ok'); }
      }
      if (k.out && q.o >= 72 && !k.star) { k.star = 1; a.stars = (a.stars || 0) + 1; hist(q.n + ', formado en tu academia, alcanza una media de ' + q.o + '.'); }
    });
  };

  // ---------- representados: ofertas múltiples ----------
  Y.offersFor = function (q, su) {
    var cur = q.c >= 0 ? FP.S.clubs[q.c] : null;
    return (su || G.suitors(q)).map(function (c) {
      var role = q.o >= c.st + 1 ? 'titular indiscutido' : q.o >= c.st - 3 ? 'titular' : 'rotación';
      var wage = Math.round(P.wageEst(q) * (0.9 + R() * 0.6) * (c.st > (cur ? cur.st : 0) ? 1.15 : 1)), fee = Math.round(C.value(q.o, q.pt, C.age(q)) * (0.85 + R() * 0.3));
      return { club: c.id, role: role, wage: wage, fee: fee, comm: G.comm(q, c, fee) };
    });
  };
  var ge0 = G.events;
  G.events = function (cl, q, y) {
    var st = Dec.ensure(), n0 = st ? st.list.length : 0, r = ge0.apply(this, arguments);
    var d = st && st.list.filter(function (x) { return x.kind === 'agente' && x.uniq === 'oferta' + cl.pid + y; })[0];
    if (!d) return r;
    var su = G.suitors(q); if (su.length < 2) return r;
    var cur = q.c >= 0 ? FP.S.clubs[q.c] : null, offers = Y.offersFor(q, su);
    st.list = st.list.filter(function (x) { return x !== d; });
    Dec.add({ kind: 'agente', uniq: d.uniq, title: 'Ofertas por ' + q.n, text: offers.length + ' clubes quieren a ' + q.n + ' (' + q.o + ', ' + C.age(q) + ' años). Hoy juega en ' + (cur ? cur.nm : 'ningún club') + '. Tú negocias.', def: 'rechazar', exp: 24, data: { pid: cl.pid, kind: 'oferta', multi: 1, offers: offers },
      opts: offers.map(function (o, i) { var c = FP.S.clubs[o.club]; return { k: 'o' + i, label: c.nm + ' (' + FP.LGDEF[c.lg].n + ')', hint: 'Sueldo ' + fm(o.wage) + '/año · ' + o.role + ' · tu comisión ' + fm(o.comm) }; }).concat([{ k: 'negociar', label: 'Poner a licitar a los clubes', hint: 'Puedes conseguir mejores condiciones… o perderlas todas.' }, { k: 'rechazar', label: 'Rechazar todas', hint: q.n + ' se queda.' }]) });
    return r;
  };
  var ah0 = Dec.handlers.agente;
  Dec.handlers.agente = function (k, d) {
    var dt = d.data || {};
    if (!dt.multi) return ah0.apply(this, arguments);
    var S = FP.S, p = P.ensure(), pa = p.path; if (!pa || pa.k !== 'agent') return { ok: true, msg: '' };
    var cl = pa.clients.filter(function (c) { return c.pid === dt.pid; })[0], q = S.pl[dt.pid]; if (!cl || !q || typeof q !== 'object') return { ok: true, msg: 'El cliente ya no está en tu cartera.' };
    G.state(cl);
    function close(o, bonus) {
      var club = S.clubs[o.club], comm = Math.round(o.comm * (bonus || 1)); G.move(q, club.id); P.pay(comm, 'Traspaso de ' + q.n); cl.com += comm; cl.loy = Math.min(100, cl.loy + 6); pa.rep = (pa.rep || 0) + 3;
      hist(q.n + ' ficha por ' + club.nm + ' con tu mediación (' + o.role + ').'); FP.Sim.news(q.n + ' ficha por ' + club.nm + '.', 'transfer', 1);
      return { ok: true, msg: q.n + ' ficha por ' + club.nm + (bonus > 1 ? ' con mejores condiciones' : '') + '. Comisión ' + fm(comm) + '.' };
    }
    if (k === 'rechazar') { cl.loy = Math.min(100, cl.loy + 3); return { ok: true, msg: q.n + ' se queda en su club.' }; }
    if (k === 'negociar') {
      var best = dt.offers.slice().sort(function (a, b) { return b.wage - a.wage; })[0], win = R() < 0.55 + Math.min(0.15, (pa.rep || 0) / 400);
      if (win) { best = Object.assign({}, best, { wage: Math.round(best.wage * 1.25) }); return close(best, 1.3); }
      cl.loy -= 6; return { ok: true, msg: 'La puja sale mal: los clubes se retiran y ' + q.n + ' se queda sin la operación.' };
    }
    var o = dt.offers[+k.slice(1)]; return o ? close(o, 1) : { ok: true, msg: '' };
  };

  // ---------- protegido: cambios de club ----------
  // un protegido ya profesional recibe ofertas cuando su contrato termina, cuando supera a su club o, a veces, sin más
  Y.protMoves = function () {
    var S = FP.S, pr = M && M.get(), q = pr && M.player(); if (!pr || !q || q.c < 0 || q.c >= 5000) return;
    var age = C.age(q), cur = S.clubs[q.c], y = D.year(S.week); if (age < 17 || Dec.open('protegido').some(function (d) { return d.data.mt; })) return;
    var ending = q.ce <= y + 1 && age >= 18, outgrown = q.o >= cur.st + 3 && age >= 18;
    if (!(ending || outgrown || R() < 0.12)) return;
    var su = G.suitors(q).slice(0, 3); if (!su.length) return;
    var offers = Y.offersFor(q, su);
    Dec.add({ kind: 'protegido', uniq: 'mt' + q.i + y, title: q.n + ' recibe ofertas', text: (ending ? 'Su contrato con ' + cur.nm + ' termina pronto. ' : outgrown ? 'Ya está por encima del nivel de ' + cur.nm + '. ' : '') + su.length + (su.length === 1 ? ' club se interesa' : ' clubes se interesan') + ' por él. Pide tu consejo' + ((ending || outgrown) ? '; si no respondes, acepta la mejor oferta.' : '.'), def: (ending || outgrown) ? 'o0' : 'quedarse', exp: 24, data: { pid: q.i, mt: 1, offers: offers },
      opts: offers.map(function (o, i) { var c = S.clubs[o.club]; return { k: 'o' + i, label: c.nm + ' (' + FP.LGDEF[c.lg].n + ')', hint: 'Sueldo ' + fm(o.wage) + '/año · ' + o.role }; }).concat([{ k: 'quedarse', label: 'Que siga en ' + cur.nm, hint: 'Más estabilidad; sube el vínculo contigo.' }]) });
  };
  var ph0 = Dec.handlers.protegido;
  Dec.handlers.protegido = function (k, d) {
    var dt = d.data || {};
    if (!dt.mt) return ph0.apply(this, arguments);
    var S = FP.S, pr = M.get(), q = S.pl[dt.pid]; if (!pr || !q || typeof q !== 'object' || pr.pid !== q.i) return { ok: true, msg: '' };
    if (k === 'quedarse') { pr.bond = Math.min(100, pr.bond + 3); if (q.ce <= D.year(S.week) + 1) q.ce = D.year(S.week) + U.int(2, 4); return { ok: true, msg: q.n + ' sigue en su club.' }; }
    var o = dt.offers[+k.slice(1)]; if (!o) return { ok: true, msg: '' };
    var club = S.clubs[o.club]; G.move(q, club.id); pr.club = club.id; pr.bond = Math.min(100, pr.bond + (o.role === 'rotación' ? -2 : 4));
    hist(q.n + ' ficha por ' + club.nm + ' con tu consejo (' + o.role + ').'); FP.Sim.news(q.n + ' ficha por ' + club.nm + '.', 'transfer', 1);
    return { ok: true, msg: q.n + ' ficha por ' + club.nm + ' (' + o.role + ').' };
  };
  var my0 = M.yearTick;
  M.yearTick = function () { var r = my0.apply(this, arguments); try { Y.protMoves(); } catch (e) { if (window.console) console.warn('proyectos', e); } return r; };

  // ---------- jugadores seguidos en tu club ----------
  Y.myClub = function () {
    var p = P.ensure(), pa = p.path, j = pa && pa.job; if (!j || j.club == null) return null;
    if (pa.k === 'coach' && j.role === 'head') return { id: j.club, kind: 'tec' };
    if (pa.k === 'dir' || pa.k === 'pres') return { id: j.club, kind: pa.k };
    return null;
  };
  Y.fav = function () { var h = hero(), rt = RT.ensure(); if (!rt.fav) rt.fav = {}; return rt.fav; };
  Y.favMap = function () { var f = Y.fav(), m = Y.myClub(); return m && m.kind === 'tec' ? f : null; };
  Y.toggleFav = function (pid) {
    var m = Y.myClub(), q = FP.S.pl[pid]; if (!m || m.kind !== 'tec') return { ok: false, msg: 'Solo puedes pedir minutos si diriges el club como director técnico.' };
    if (!q || q.c !== m.id) return { ok: false, msg: 'Ese jugador no está en tu club.' };
    var f = Y.fav(); if (f[pid]) { delete f[pid]; return { ok: true, msg: q.n + ': vuelve a competir por el puesto.' }; }
    f[pid] = 1; return { ok: true, msg: q.n + ' será titular siempre que esté disponible. Si no tiene el nivel, el equipo lo notará.' };
  };
  Y.canSign = function (pid) {
    var S = FP.S, m = Y.myClub(), q = S.pl[pid]; if (!m) return 'Necesitas ser director técnico, director deportivo o presidente de un club.';
    if (!q || typeof q !== 'object' || q.c === -2) return 'El jugador ya no está en activo.';
    if (q.c === m.id) return 'Ya juega en tu club.';
    if ((S.ro[m.id] || []).length >= 28) return 'El plantel está completo (28).';
    var club = S.clubs[m.id]; if (q.o < club.st - 8 && q.c !== -3) return 'No tiene el nivel para tu plantel (' + q.o + ' frente a ' + Math.round(club.st) + ').';
    if (C.age(q) < 16) return 'Es demasiado joven para el primer plantel.';
    return null;
  };
  Y.sign = function (pid) {
    var S = FP.S, h = hero(), m = Y.myClub(), q = S.pl[pid], why = Y.canSign(pid); if (why) return { ok: false, msg: why };
    var club = S.clubs[m.id], fee = q.c >= 0 || q.c === -1 ? RT.fee(q) : 0;
    if (m.kind === 'pres') { var fn = RT.fn(); if (fn && fn.cash < fee) return { ok: false, msg: 'La caja del club (' + fm(fn.cash) + ') no alcanza para ' + fm(fee) + '.' }; if (fn) fn.cash -= fee; }
    var from = q.c; FP.Market.move(q, club.id, fee, 3); if (FP.Market.rec) FP.Market.rec(q, from, club.id, fee, 't'); C.calcStr(club);
    hist('Lleva a ' + q.n + ' a ' + club.nm + '.'); return { ok: true, msg: q.n + ' llega a ' + club.nm + (fee ? ' por ' + fm(fee) : '') + '.' };
  };
  // minutos de calidad: quien juega de titular en el club de quien lo guía progresa un poco más
  Y.growth = function () {
    var S = FP.S, fi = hero().fi, m = Y.myClub(); if (!fi || !m) return;
    Object.keys(fi.pl).forEach(function (k) {
      var r = fi.pl[k], q = S.pl[+k]; if (r.end || !q || typeof q !== 'object' || q.c !== m.id || C.age(q) > 24 || q.o >= q.pt) return;
      var mins = r.rows.filter(function (x) { return x.c === m.id; }).slice(-1).reduce(function (s, x) { return s + (x.mn || 0); }, 0);
      if (mins >= 1200 && R() < 0.8) { q.o = Math.min(q.pt, q.o + 1); FP.Hero.msg(q.n + ' crece jugando a tus órdenes (media ' + q.o + ').', 'ok'); }
    });
  };

  // ---------- dinastía: continuar la historia con el hijo ----------
  Y.dynasty = function () {
    var S = FP.S, h = hero(), pr = M && M.get(), q = pr && M.player(); if (!h || !h.retired || !pr || pr.kind !== 'hijo' || !q) return null;
    var lg = P.ensure().legacy || P.legacy(), nm = String(q.n).split(' '), age = C.age(q), clubs = (lg.clubs || []).slice(0, 3).map(function (c) { return c.nm; });
    return { father: h.nm, label: lg.label, score: lg.score, bo: lg.bo, tro: lg.trophies, first: nm[0], last: nm.slice(1).join(' ') || h.nm.split(' ').slice(-1)[0], nat: h.nat, city: h.city || '', pos: q.p === 'GK' ? 'CM' : q.p, age: U.clamp(age, 12, 17), ovr: q.o, pt: q.pt, year: D.year(S.week), clubs: clubs, club: clubs[0] || null, ht: 180, kg: 72 };
  };
  Y.migrate = function () { };

  // ---------- paso del tiempo ----------
  var pw0 = P.weekly;
  P.weekly = function (w) {
    pw0.apply(this, arguments);
    var h = FP.S.hero; if (!h || !h.retired) return; var d = w - h.retiredW; if (d <= 0) return;
    try {
      if (d % 52 === 33) { Y.yearly(); Y.intakeAt = w; }
      if (d % 52 === 36) { if (Y.ac()) Y.intake(); }
      if (d % 52 === 45) Y.growth();
    } catch (e) { if (window.console) console.warn('proyectos', e); }
  };
  var kc0 = K.ctx;
  K.ctx = function () { var c = kc0.apply(this, arguments); var f = Y.favMap(); if (f && Object.keys(f).length) c.fav = f; return c; };
})();
