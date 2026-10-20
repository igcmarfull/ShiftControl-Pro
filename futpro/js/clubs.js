/* FUTPRO — mercado vivo: perfil y presupuesto de cada club (comprador, vendedor, formador), rumores y operaciones frustradas,
   cierre de ventana con más movimiento, cláusulas de rescisión que otros clubes pagan, y efectos en cadena cuando el jugador cambia de club. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, M = FP.Market, Rep = FP.Rep, Sim = FP.Sim;
  var K = FP.Clubs = {};

  K.mk = function () { var S = FP.S; if (!S.mk) S.mk = { pend: [], rum: [], last: {}, v: 1 }; return S.mk; };
  K.base = function (club) { return M.budget(club); };
  // perfil del club: depende de su economía, su cantera y su situación deportiva
  K.profile = function (club) {
    if (!club.sg) {
      var r = U.mulberry(U.hash(FP.S.seed, club.id, 'perfil')), lg = FP.LGDEF[club.lg], role = 'equilibrado';
      var x = r();
      if (club.fin >= 7 && x < 0.65) role = 'comprador';
      else if (club.fin <= 4 && x < 0.55) role = 'vendedor';
      else if (club.ac >= 3 && club.fin <= 6 && x < 0.5) role = 'formador';
      else if (x > 0.9) role = ['comprador', 'vendedor', 'formador'][Math.floor(r() * 3)];
      club.sg = { role: role, b: Math.round(K.base(club) * (0.5 + r() * 0.6)), y: 0 };
    }
    return club.sg;
  };
  K.ROLES = { comprador: 'Comprador', vendedor: 'Vendedor', formador: 'Formador', equilibrado: 'Equilibrado' };
  K.budgetLabel = function (club) { var sg = K.profile(club), q = sg.b / K.base(club); return q > 1.1 ? 'holgado' : q > 0.55 ? 'normal' : 'ajustado'; };
  // al cerrar cada temporada: el resultado mueve el presupuesto y el perfil
  K.seasonUpdate = function (cc) {
    var S = FP.S;
    S.clubs.forEach(function (club) {
      if (club.c !== cc) return; var sg = K.profile(club), lg = FP.LGDEF[club.lg], hist = S.lgs[club.lg] && S.lgs[club.lg].hist, e = hist && hist[hist.length - 1];
      var up = e && e.up.indexOf(club.id) >= 0, dn = e && e.dn.indexOf(club.id) >= 0, champ = e && e.ch === club.id;
      sg.b = Math.round(Math.min(K.base(club) * 2.2, Math.max(K.base(club) * 0.15, sg.b + K.base(club) * (0.45 + (champ ? 0.5 : 0) + (up ? 0.4 : 0) - (dn ? 0.35 : 0)))));
      if (dn) sg.role = 'vendedor'; else if (champ || up) sg.role = club.fin >= 5 ? 'comprador' : 'equilibrado';
      else if (sg.role === 'vendedor' && sg.b > K.base(club) * 1.1) sg.role = 'equilibrado';
    });
  };
  var roll0 = Sim.onRollover;
  Sim.onRollover = function (cc) { if (roll0) roll0(cc); try { K.seasonUpdate(cc); } catch (e) { if (window.console) console.warn('clubs', e); } };

  // ---------- ventana ----------
  K.isFirst = function (w) { return M.isWindow(w) && !M.isWindow(w - 1); };
  K.isLast = function (w) { return M.isWindow(w) && !M.isWindow(w + 1); };
  K.weeksLeft = function (w) { var n = 0; while (M.isWindow(w + n + 1) && n < 30) n++; return M.isWindow(w) ? n : null; };

  function buyW(c) { var sg = K.profile(c); return ({ comprador: 2.2, equilibrado: 1, formador: 1, vendedor: 0.45 }[sg.role] || 1) * (0.4 + Math.min(1.6, sg.b / K.base(c))); }
  K.news = function (txt, imp) { FP.Sim.news(txt, 'transfer', imp || 1); };
  function isHeadline(p, fee, from, buyer) { var lg = FP.LGDEF[buyer.lg]; return fee >= 8000 || (lg.t <= 2 && fee >= 2500) || (fee >= 1500 && p.o >= lg.q + buyer.ra + 6); }

  // ejecuta (o frustra) una operación entre clubes
  K.exec = function (d, official) {
    var S = FP.S, p = S.pl[d.p]; if (!p || p.c !== d.from) return false;
    var buyer = S.clubs[d.to], seller = S.clubs[d.from]; if (!buyer || !seller) return false;
    var from = M.move(p, buyer.id, d.fee, U.int(2, 4)); C.calcStr(seller); C.calcStr(buyer);
    M.rec(p, from, buyer.id, Math.round(d.fee));
    K.profile(buyer).b -= Math.round(d.fee * 0.8); K.profile(seller).b += Math.round(d.fee * 0.9);
    var ro = S.ro[buyer.id] || [], sz = FP.LGDEF[buyer.lg].q >= 55 ? 25 : FP.LGDEF[buyer.lg].q >= 45 ? 23 : 21;
    if (ro.length > sz + 3) { var r2 = ro.filter(function (x) { return x.i !== 0; }).sort(function (a, b) { return a.o + (a.pt - a.o) * 0.3 - b.o - (b.pt - b.o) * 0.3; })[0]; if (r2) { ro.splice(ro.indexOf(r2), 1); r2.c = -1; } }
    if (d.hl || d.fee >= 20000 || (d.fee >= 6000 && R() < 0.3)) K.news((official ? 'OFICIAL: ' : '') + p.n + ' (' + C.age(p) + ') ficha por ' + buyer.nm + ' desde ' + seller.nm + ' por ' + FP.fmt.money(Math.round(d.fee)) + '.', d.fee >= 20000 ? 2 : 1);
    return true;
  };
  K.propose = function (p, buyer, fee, w, immediate) {
    var d = { p: p.i, from: p.c, to: buyer.id, fee: fee, w: w, hl: isHeadline(p, fee, p.c, buyer) };
    if (d.hl && !immediate) {
      d.ex = w + U.int(1, 3); K.mk().pend.push(d);
      var seller = FP.S.clubs[p.c];
      K.news('Rumor: ' + buyer.nm + ' va por ' + p.n + ' (' + C.age(p) + ', media ' + p.o + ') de ' + seller.nm + '. Se habla de ' + FP.fmt.money(Math.round(fee)) + '.', 1);
      K.mk().rum.unshift({ w: w, t: p.n + ': ' + buyer.nm + ' ← ' + seller.nm, st: 'rumor', fee: Math.round(fee) }); if (K.mk().rum.length > 30) K.mk().rum.length = 24;
      return 'rumor';
    }
    return K.exec(d, d.hl) ? 'ok' : 'no';
  };
  K.resolvePending = function (w) {
    var mk = K.mk(), S = FP.S;
    mk.pend = mk.pend.filter(function (d) {
      if (d.ex > w) return true;
      var p = S.pl[d.p], buyer = S.clubs[d.to], ok = p && p.c === d.from && K.profile(buyer).b >= d.fee * 0.5 && R() < 0.72, r = mk.rum.filter(function (x) { return x.t.indexOf(p ? p.n : '§') === 0 && x.st === 'rumor'; })[0];
      if (ok && K.exec(d, true)) { if (r) r.st = 'oficial'; }
      else { if (p && !d.quiet) K.news('Se cae el fichaje de ' + p.n + ' por ' + buyer.nm + ': las partes no llegaron a un acuerdo.', 1); if (r) r.st = 'frustrado'; }
      return false;
    });
  };

  // ronda de fichajes de la IA (reemplaza a Market.aiRound)
  K.round = function (w) {
    var S = FP.S, last = K.isLast(w), first = K.isFirst(w), mult = last ? 2.6 : first ? 1.4 : 1, nBuy = Math.ceil(S.clubs.length * 0.045 * mult), moved = 0;
    for (var k = 0; k < nBuy; k++) {
      var buyer = U.wpick(S.clubs, buyW), sg = K.profile(buyer), lg = FP.LGDEF[buyer.lg], ro = S.ro[buyer.id] || [];
      var sz = lg.q >= 55 ? 25 : lg.q >= 45 ? 23 : 21;
      if (ro.length >= sz + 2 && R() < 0.8) continue;
      var best = {}; ro.forEach(function (p) { if (p.i !== 0 && (!best[p.p] || p.o > best[p.p])) best[p.p] = p.o; });
      var pos = C.POS.slice().sort(function (a, b) { return (best[a] || 0) - (best[b] || 0); })[0];
      if (R() < 0.4) pos = U.pick(C.POS);
      var mu = lg.q + buyer.ra, f = { comprador: 1.7, equilibrado: 1, formador: 0.8, vendedor: 0.5 }[sg.role] || 1;
      var lim = K.base(buyer) * f * (0.5 + 0.5 * Math.min(2, Math.max(0.1, sg.b / K.base(buyer)))) * (R() < 0.15 ? 3 : 1);
      var cand = null, cv = -999;
      for (var t = 0; t < 36; t++) {
        var p = S.pl[1 + Math.floor(R() * (S.pl.length - 1))];
        if (!p || p.c < 0 || p.c === buyer.id || p.p !== pos) continue;
        if (Rep && !Rep.aiForeignOK(buyer, p)) continue;
        var seller = S.clubs[p.c]; if (!seller) continue;
        var age = C.age(p);
        if (p.o < mu - 3 || p.o > mu + 7) continue;
        if (sg.role === 'formador' && age > 25 && R() < 0.7) continue;
        var sellerRo = S.ro[p.c] || []; if (sellerRo.length < 21) continue;
        var val = C.value(p.o, p.pt, age); if (val > lim) continue;
        var sellerMu = FP.LGDEF[seller.lg].q + seller.ra, up = mu - sellerMu;
        if (up < -8 && R() < 0.8) continue;
        var sp = K.profile(seller), sellBonus = sp.role === 'vendedor' ? 2.5 : sp.role === 'formador' && age <= 21 ? 1 : 0;
        var score = p.o + (p.pt - p.o) * 0.35 - age * 0.2 - val / (lim + 1) * 2 + sellBonus + (sg.role === 'formador' ? Math.max(0, 23 - age) * 0.6 : 0) + (sg.role === 'comprador' ? p.o * 0.05 : 0);
        if (score > cv) { cv = score; cand = p; }
      }
      if (!cand) continue;
      var fee = C.value(cand.o, cand.pt, C.age(cand)) * (0.85 + R() * 0.4);
      var res = K.propose(cand, buyer, fee, w); if (res) moved++;
    }
    // ventas forzadas: los clubes vendedores y sin caja se desprenden de su figura
    S.clubs.forEach(function (c) {
      var sg = K.profile(c); if (sg.role !== 'vendedor' || sg.b > K.base(c) * 0.5 || R() > 0.01 * mult) return;
      var star = (S.ro[c.id] || []).filter(function (p) { return p.i !== 0 && C.age(p) >= 22; }).sort(function (a, b) { return b.o - a.o; })[0]; if (!star) return;
      var val = C.value(star.o, star.pt, C.age(star)), byr = null, bv = -1;
      for (var i = 0; i < 30; i++) { var x = S.clubs[Math.floor(R() * S.clubs.length)]; if (x === c || !Rep.aiForeignOK(x, star)) continue; var s2 = K.profile(x); if (s2.b < val || FP.LGDEF[x.lg].q + x.ra < star.o - 4) continue; var v = s2.b; if (v > bv) { bv = v; byr = x; } }
      if (byr && K.propose(star, byr, val * (0.9 + R() * 0.3), w)) moved++;
    });
    return moved;
  };
  M.aiRound = function (w) { return K.round(w); };
  var mw0 = M.weekly;
  M.weekly = function (w) { var r = mw0.apply(this, arguments); try { K.weekly(w); } catch (e) { if (window.console) console.warn('clubs', e); } return r; };

  // semana: presupuestos, operaciones pendientes, cierre de ventana y cláusulas
  K.weekly = function (w) {
    var S = FP.S; K.mk(); K.hook();
    S.clubs.forEach(function (c) { if (!c.sg) return; var base = K.base(c); c.sg.b = Math.min(Math.round(base * 2.2), c.sg.b + Math.round(base * 0.006)); });
    K.resolvePending(w);
    if (M.isWindow(w)) {
      var mk = K.mk();
      if (K.isFirst(w)) K.news('Se abre el mercado: ' + FP.Market.windowName(w).toLowerCase() + '.', 1);
      if (K.isLast(w)) { K.news('Último día del mercado de fichajes: los clubes aceleran para cerrar sus operaciones.', 2); mk.last = { w: w }; K.deadlineHero(w); }
    }
    var h = S.hero; if (h && !h.retired && h.tk === 'pro' && M.isWindow(w)) K.clauseCheck(w);
  };
  // último día: ofertas que llegan de golpe a quien tiene interés
  K.deadlineHero = function (w) {
    var h = FP.S.hero; if (!h || h.retired || (h.tk !== 'pro' && h.tk !== 'free' && h.tk !== 'academy')) return;
    var n = Rep.offers(false, 2); if (n) FP.Hero.msg('¡Último día del mercado! Llegaron ' + n + (n === 1 ? ' oferta de último minuto.' : ' ofertas de último minuto.'), 'warn');
  };
  // un club interesado paga tu cláusula de rescisión
  K.clauseCheck = function (w) {
    var S = FP.S, h = S.hero, ct = h.contract, cur = h.club != null ? S.clubs[h.club] : null; if (!ct || !ct.release || !cur) return;
    if (h.offers.some(function (o) { return o.clause; })) return;
    var val = M.heroValue(), rel = ct.release, p = rel <= val * 1.15 ? 0.1 : rel <= val * 1.6 ? 0.04 : 0.008;
    if (R() > p) return;
    var cand = S.clubs.filter(function (c) { return c !== cur && K.profile(c).b >= rel * 0.9 && (h.cd[c.id] || 0) <= w && Rep.exposure(c).ok && Rep.foreignOK(c, h.nat, FP.Hero.age()) && Rep.permit(c) && c.st >= cur.st - 1 && Rep.fit(c).kind !== 'none'; });
    if (!cand.length) return;
    var c = U.pick(cand), f = Rep.fit(c), role = f.kind === 'project' ? 'Proyecto / suplente' : f.gap >= 3 ? 'Titular' : f.gap >= -1 ? 'Rotación' : 'Suplente', years = FP.Hero.age() < 25 ? U.int(3, 5) : U.int(2, 4), wage = Rep.wage(c, 1.2);
    K.profile(c).b -= Math.round(rel * 0.8);
    M.addOffer({ type: 'transfer', club: c.id, fee: rel, wage: wage, years: years, role: role, clause: 1, urgent: 1, exp: w + 4, text: c.nm + ' (' + C.cname(c.c) + ') pagó tu cláusula de rescisión de ' + FP.fmt.money(rel) + ': ' + role.toLowerCase() + ', ' + years + ' años, ' + FP.fmt.money(wage) + ' al año. Puedes aceptar o negociar tu contrato.' });
  };

  // efectos en cadena cuando el jugador cambia de club
  K.onHeroMove = function (fromId, toId) {
    var S = FP.S, h = S.hero, from = fromId != null ? S.clubs[fromId] : null, to = S.clubs[toId], pos = h.pos, w = S.week;
    if (from) {
      K.news(h.nm + ' deja ' + from.nm + ' y ficha por ' + to.nm + '.', 2);
      // el club vendedor busca reemplazo
      if (R() < 0.7) {
        var mu = FP.LGDEF[from.lg].q + from.ra, cand = null, cv = -99;
        for (var t = 0; t < 60; t++) { var p = S.pl[1 + Math.floor(R() * (S.pl.length - 1))]; if (!p || p.c < 0 || p.c === from.id || p.c === to.id || p.p !== pos || !Rep.aiForeignOK(from, p)) continue; if (p.o < h.ovr - 10 || p.o > mu + 5) continue; var v = C.value(p.o, p.pt, C.age(p)); if (v > K.profile(from).b * 1.2 + 200) continue; var sc = p.o - C.age(p) * 0.2 - v / 5000; if (sc > cv) { cv = sc; cand = p; } }
        if (cand) { var fee = C.value(cand.o, cand.pt, C.age(cand)) * (0.9 + R() * 0.3); K.news(from.nm + ' busca reemplazo tras la salida de ' + h.nm + ': se interesa por ' + cand.n + '.', 1); K.propose(cand, from, fee, w); }
      }
      // los hinchas del club que dejas
      var stay = h.seasons.filter(function (s) { return s.club === from.nm; }).length;
      if (stay >= 2 && h.life && h.life.press) { h.life.press.img = U.clamp(h.life.press.img - 2, 0, 100); FP.Hero.msg('Parte de la afición de ' + from.nm + ' no tomó bien tu salida.', 'i'); }
    }
    // el que pierde el puesto en el club nuevo
    var ro = (S.ro[to.id] || []).filter(function (p) { return p.i !== 0 && p.p === pos; }).sort(function (a, b) { return a.o - b.o; });
    var starters = ro.slice(-2), displaced = ro.length >= 2 ? ro[ro.length - 2] : null;
    if (displaced && h.ovr > displaced.o + 1 && R() < 0.5) {
      var dest = null, dv = -1; for (var i = 0; i < 40; i++) { var x = S.clubs[Math.floor(R() * S.clubs.length)]; if (x === to || !Rep.aiForeignOK(x, displaced)) continue; var mu2 = FP.LGDEF[x.lg].q + x.ra; if (displaced.o < mu2 - 4 || displaced.o > mu2 + 6) continue; if (K.profile(x).b < C.value(displaced.o, displaced.pt, C.age(displaced)) * 0.7) continue; dest = x; break; }
      if (dest) { K.news(displaced.n + ' pierde su puesto en ' + to.nm + ' con la llegada de ' + h.nm + ' y negocia su salida.', 1); K.mk().pend.push({ p: displaced.i, from: to.id, to: dest.id, fee: C.value(displaced.o, displaced.pt, C.age(displaced)) * 0.9, w: w, ex: w + U.int(1, 4), hl: false, quiet: 1 }); }
    }
  };
  // contracts.js se carga después: el enlace con los traspasos del jugador se crea la primera vez que corre el mercado
  K.hooked = false;
  K.hook = function () {
    if (K.hooked || !FP.Contracts || !FP.Contracts.doTransfer) return; K.hooked = true;
    var dt0 = FP.Contracts.doTransfer;
    FP.Contracts.doTransfer = function (o) { var h = FP.S.hero, fromId = h.club; var r = dt0.apply(this, arguments); try { if (r && r.ok && o.club != null && o.club !== fromId) K.onHeroMove(fromId, o.club); } catch (e) { if (window.console) console.warn('clubs', e); } return r; };
  };

  // inteligencia de oferta: qué encontrarías en ese club
  K.intel = function (o) {
    var S = FP.S, h = S.hero, c = o.club != null ? S.clubs[o.club] : null; if (!c) return null;
    var cur = h.club != null ? S.clubs[h.club] : null, sg = K.profile(c);
    var ro = (S.ro[c.id] || []).filter(function (p) { return p.i !== 0 && p.p === h.pos; }).sort(function (a, b) { return b.o - a.o; }).slice(0, 3);
    var f = Rep.fit(c), eff = f.eff, rank = ro.filter(function (p) { return p.o > eff; }).length;
    var lg = FP.LGDEF[c.lg], coach = FP.Staff ? FP.Staff.def(c) : null;
    return { club: c, role: sg.role, budget: K.budgetLabel(c), rivals: ro, ahead: rank, dSt: cur ? Math.round(c.st - cur.st) : null, tier: lg.t, lgName: lg.n, coach: coach ? coach.nm : null, kind: f.kind, gap: f.gap };
  };
  K.migrate = function () { K.mk(); };
})();
