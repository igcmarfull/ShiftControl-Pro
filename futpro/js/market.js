/* FUTPRO — mercado: fichajes de la IA, ofertas al jugador, contratos, pruebas, cesiones, representantes */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, Comp = FP.Comp;

  var Market = FP.Market = {};

  Market.isWindow = function (w) {
    var ymd = D.ymd(w), m = ymd[1], d = ymd[2];
    if (m === 0) return true;
    if (m === 1 && d <= 8) return true;
    if (m === 5 && d >= 12) return true;
    if (m === 6 || m === 7) return true;
    if (m === 8 && d <= 5) return true;
    return false;
  };
  Market.windowName = function (w) { var m = D.ymd(w)[1]; return m <= 1 ? 'Mercado de invierno' : 'Mercado de verano'; };
  Market.endYearOf = function (cal, years, w) {
    // año en que termina un contrato (euro: 30-jun / year: 31-dic)
    var ymd = D.ymd(w || FP.S.week), y = ymd[0], m = ymd[1];
    if (cal === 'euro') { var base = m >= 6 ? y + 1 : y; return base + years - 1 + (m >= 6 ? 0 : 0); }
    return y + years - (m === 11 ? 0 : 1) ;
  };
  Market.contractEndWeek = function (ct, cal) {
    return cal === 'euro' ? D.of(ct.end, 5, 30) : D.of(ct.end, 11, 31);
  };
  Market.budget = function (club) {
    var cw = FP.DATA.countries[club.c].w;
    return 40 * Math.exp(0.55 * club.fin) * Math.pow(0.4 + cw, 1.5);
  };

  // ---------- registro de fichajes ----------
  Market.rec = function (p, from, to, fee, kind) {
    var S = FP.S; (S.transfers = S.transfers || []).unshift({ w: S.week, p: p.n, id: p.i, o: p.o, a: C.age(p), from: from, to: to, fee: fee, k: kind || 't' });
    if (S.transfers.length > 120) S.transfers.length = 90;
  };
  Market.move = function (p, to, fee, years) {
    var S = FP.S, from = p.c;
    if (from >= 0 && S.ro[from]) { var a = S.ro[from], i = a.indexOf(p); if (i >= 0) a.splice(i, 1); delete FP.Match.cache[from]; }
    p.c = to; p.ce = D.year(S.week) + (years || 3);
    (S.ro[to] || (S.ro[to] = [])).push(p); delete FP.Match.cache[to];
    return from;
  };

  // ---------- fichajes de la IA ----------
  Market.aiRound = function (w) {
    var S = FP.S, nBuy = Math.ceil(S.clubs.length * 0.045), moved = 0;
    for (var k = 0; k < nBuy; k++) {
      var buyer = S.clubs[Math.floor(R() * S.clubs.length)], lg = FP.LGDEF[buyer.lg], ro = S.ro[buyer.id] || [];
      var sz = lg.q >= 55 ? 25 : lg.q >= 45 ? 23 : 21;
      if (ro.length >= sz + 2 && R() < 0.8) continue;
      // posición más débil
      var best = {}; ro.forEach(function (p) { if (p.i !== 0 && (!best[p.p] || p.o > best[p.p])) best[p.p] = p.o; });
      var pos = C.POS.slice().sort(function (a, b) { return (best[a] || 0) - (best[b] || 0); })[0];
      if (R() < 0.4) pos = U.pick(C.POS);
      var mu = lg.q + buyer.ra, lim = Market.budget(buyer) * (R() < 0.15 ? 3 : 1);
      var cand = null, cv = -999;
      for (var t = 0; t < 36; t++) {
        var p = S.pl[1 + Math.floor(R() * (S.pl.length - 1))];
        if (!p || p.c < 0 || p.c === buyer.id || p.p !== pos) continue;
        if (FP.Rep && !FP.Rep.aiForeignOK(buyer, p)) continue;
        var seller = S.clubs[p.c]; if (!seller) continue;
        var age = C.age(p);
        if (p.o < mu - 3 || p.o > mu + 7) continue;
        var sellerRo = S.ro[p.c] || []; if (sellerRo.length < 21) continue;
        var val = C.value(p.o, p.pt, age);
        if (val > lim) continue;
        // un club grande rara vez compra a uno mucho más chico y viceversa fluye hacia arriba
        var sellerMu = FP.LGDEF[seller.lg].q + seller.ra;
        var up = mu - sellerMu;
        if (up < -8 && R() < 0.8) continue;
        var score = p.o + (p.pt - p.o) * 0.35 - age * 0.2 - val / (lim + 1) * 2;
        if (score > cv) { cv = score; cand = p; }
      }
      if (!cand) continue;
      var fee = C.value(cand.o, cand.pt, C.age(cand)) * (0.85 + R() * 0.4);
      var from = Market.move(cand, buyer.id, fee, U.int(2, 4));
      S.clubs[from] && C.calcStr(S.clubs[from]); C.calcStr(buyer);
      Market.rec(cand, from, buyer.id, Math.round(fee));
      moved++;
      if (ro.length > sz + 3) { // sobrantes: salen los peores a libres
        var r2 = S.ro[buyer.id].filter(function (x) { return x.i !== 0; }).sort(function (a, b) { return a.o + (a.pt - a.o) * .3 - b.o - (b.pt - b.o) * .3; })[0];
        if (r2) { S.ro[buyer.id].splice(S.ro[buyer.id].indexOf(r2), 1); r2.c = -1; }
      }
      if (fee >= 20000 || (fee >= 6000 && R() < 0.3)) FP.Sim.news(cand.n + ' (' + C.age(cand) + ') ' + 'ficha por ' + buyer.nm + ' desde ' + (S.clubs[from] ? S.clubs[from].nm : '—') + ' por ' + FP.fmt.money(Math.round(fee)) + '.', 'transfer', fee >= 40000 ? 3 : 2);
    }
    // reponer plantillas de quienes vendieron (lo hace la temporada) + libres sin club firman en equipos con faltante
    return moved;
  };
  Market.weekly = function (w) {
    var S = FP.S;
    if (Market.isWindow(w)) {
      Market.aiRound(w);
      if (R() < 0.3) Market.signFreeAgents();
    } else if (R() < 0.1) Market.signFreeAgents();
  };
  Market.signFreeAgents = function () {
    var S = FP.S, n = 0;
    for (var k = 0; k < 40; k++) {
      var club = S.clubs[Math.floor(R() * S.clubs.length)], lg = FP.LGDEF[club.lg], sz = lg.q >= 55 ? 25 : lg.q >= 45 ? 23 : 21;
      var ro = S.ro[club.id] || [];
      if (ro.length >= sz) continue;
      var cnt = {}; ro.forEach(function (p) { cnt[p.p] = (cnt[p.p] || 0) + 1; });
      var pos = C.POS.slice().sort(function (a, b) { return (cnt[a] || 0) - (cnt[b] || 0); })[0];
      var fa = FP.Sim.pickFreeAgent(club, pos); if (!fa) continue;
      Market.move(fa, club.id, 0, U.int(1, 3)); C.calcStr(club); n++;
    }
    return n;
  };

  // ---------- Jugador: ofertas ----------
  Market.addOffer = function (o) {
    var h = FP.S.hero;
    if (o.club != null && !o.name) {
      var dup = h.offers.filter(function (x) { return x.type === o.type && x.club === o.club; })[0];
      if (dup) { if (o.exp != null && dup.exp != null && o.exp > dup.exp) dup.exp = o.exp; return dup; }
    }
    o.id = h.nextId++; o.w = FP.S.week; if (o.exp == null) o.exp = FP.S.week + 4;
    h.offers.push(o);
    FP.Hero.msg(o.text, 'offer', { oid: o.id });
    return o;
  };
  Market.heroCountry = function () { var h = FP.S.hero; return h.club != null ? FP.S.clubs[h.club].c : (h.team >= 20000 && h.team < 30000 ? FP.S.amat[h.team - 20000].c : h.nat); };
  Market.potEst = function () { var r = FP.Hero.potRange(); return (r[0] + r[1]) / 2; };
  Market.heroValue = function () {
    var h = FP.S.hero, age = FP.Hero.age();
    return C.value(h.ovr, Market.potEst(), age);
  };
  Market.agentMult = function () { var h = FP.S.hero; return h.agent ? 1 + h.agent.lvl * 0.05 : 1; };
  Market.wageFor = function (club, factor) {
    var val = Market.heroValue(), cw = FP.DATA.countries[club.c].w;
    var w = C.wage(val, cw) * (factor || 1) * Market.agentMult();
    return Math.max(2, Math.round(w));
  };
  Market.clubLevel = function (club) { return FP.LGDEF[club.lg].q + club.ra; };

  Market.heroWeekly = function (w) {
    var S = FP.S, h = S.hero; if (!h || h.retired) return;
    // caducan ofertas
    h.offers = h.offers.filter(function (o) { return !((o.type === 'pro' && h.contract && h.contract.type === 'prof' && h.club === o.club) || (o.type === 'academy' && h.tk === 'academy' && h.club === o.club)); });
    h.offers = h.offers.filter(function (o) { if (o.exp != null && o.exp < w) { FP.Hero.msg('La oferta de ' + (o.club != null ? C.tname(o.club) : 'un club') + ' ha caducado.', 'i'); return false; } return true; });
    var age = FP.Hero.age();
    // pruebas programadas
    (h.trials || []).slice().forEach(function (t) { if (t.w <= w) { Market.resolveTrial(t); h.trials.splice(h.trials.indexOf(t), 1); } });
    if (h.tk === 'amat' || h.tk === 'free') Market.scouting(w);
    if (h.tk === 'pro' || h.tk === 'loan') {
      Market.contractWatch(w);
      if (Market.isWindow(w) && !h.flags['win' + Market.windowKey(w)]) { h.flags['win' + Market.windowKey(w)] = 1; Market.transferOffers(); }
    } else if (h.tk === 'academy') {
      if (age >= 17 && Market.isWindow(w) && !h.flags['win' + Market.windowKey(w)]) { h.flags['win' + Market.windowKey(w)] = 1; Market.transferOffers(); }
    } else if (h.tk === 'free') {
      if (R() < 0.18) Market.transferOffers(true);
    }
    if (h.tk === 'free' && h.freeSince != null && w - h.freeSince > 14 && !h.offers.length) {
      Market.addOffer({ type: 'amateur', club: null, text: 'Un club amateur local te ofrece jugar en su equipo mientras buscas club profesional.', exp: w + 8 });
    }
  };
  Market.windowKey = function (w) { var ymd = D.ymd(w); return ymd[0] + (ymd[1] <= 1 ? 'W' : 'S'); };

  // clubes que visitan a jugadores amateur / libres
  Market.scouting = function (w) {
    var S = FP.S, h = S.hero, age = FP.Hero.age(), cc = Market.heroCountry();
    if (age > 19 && h.tk === 'amat' && R() < 0.5) return;
    if (h.lastScout != null && w - h.lastScout < 5) return;
    var p = 0.035 + Math.max(0, (h.ovr - 48)) * 0.0035 + (h.season.g * 0.002);
    if (R() > Math.min(0.2, p)) return;
    var clubs = S.clubs.filter(function (c) { return c.c === cc && FP.LGDEF[c.lg].t <= 3; });
    if (!clubs.length) return;
    var potEst = Market.potEst();
    var c = U.wpick(clubs, function (c) {
      var fit = (h.ovr + (potEst - h.ovr) * 0.25) - Market.trialReq(c, age); // cuánto supera al nivel del club
      return Math.exp(fit / 5) * (FP.LGDEF[c.lg].t === 1 ? 1 : 1.3);
    });
    h.lastScout = w;
    Market.addOffer({ type: 'trial', club: c.id, text: c.nm + ' te invita a una prueba en sus divisiones inferiores.', exp: w + 6 });
  };
  // nivel exigido por un club para aceptar a un juvenil de esa edad (los grandes exigen más)
  Market.trialReq = function (club, age) {
    var lg = FP.LGDEF[club.lg];
    return C.youthStr(club, U.clamp(age, 12, 19)) + (lg.t === 1 ? 4 : lg.t === 2 ? 1 : -2) + (club.ra > 4 ? 3 : club.ra > 2 ? 1.5 : 0);
  };
  Market.trialDifficulty = function (clubId) {
    var h = FP.S.hero, c = FP.S.clubs[clubId], age = FP.Hero.age();
    var req = Market.trialReq(c, age);
    var fit = (h.ovr + (Market.potEst() - h.ovr) * 0.25) - req;
    return { req: req, fit: fit, p: 1 / (1 + Math.exp(-(fit - 1) / 2.5)) };
  };
  Market.requestTrial = function (clubId) {
    var S = FP.S, h = S.hero, age = FP.Hero.age();
    if (h.tk === 'pro' || h.tk === 'loan') return { ok: false, msg: 'Ya eres profesional.' };
    if (age > 19) return { ok: false, msg: 'Las pruebas en divisiones inferiores son hasta los 19 años.' };
    h.trials = h.trials || [];
    if (h.trials.some(function (t) { return t.club === clubId; })) return { ok: false, msg: 'Ya hay una prueba pendiente en ese club.' };
    if (h.trials.length >= 2) return { ok: false, msg: 'Ya tienes dos pruebas pendientes.' };
    if (S.clubs[clubId].c !== Market.heroCountry() && age < 18) return { ok: false, msg: 'Un menor de 18 años no puede probarse en el extranjero (normativa FIFA).' };
    h.trials.push({ club: clubId, w: S.week + 2 });
    FP.Hero.msg('Solicitaste una prueba en ' + S.clubs[clubId].nm + '. Se realizará en 2 semanas.', 'i');
    return { ok: true };
  };
  Market.resolveTrial = function (t) {
    var S = FP.S, h = S.hero, c = S.clubs[t.club];
    var d = t.open ? { p: 0.35 + Math.max(-0.2, Math.min(0.45, (h.ovr - 52) * 0.03)) } : Market.trialDifficulty(t.club);
    if (t.open) {
      // prueba abierta con varios clubes de la zona
      var ok = R() < d.p;
      if (ok) {
        var list = t.clubs.map(function (id) { return S.clubs[id]; });
        list.forEach(function (cl) {
          if (R() < 0.75 || list.length === 1) Market.addOffer({ type: 'academy', club: cl.id, years: 2, wage: 0, text: cl.nm + ' te ofrece ingresar a sus divisiones inferiores tras la prueba abierta de ' + t.place + '.', exp: S.week + 8 });
        });
        if (!h.offers.length) Hero_msg('Tras la prueba abierta de ' + t.place + ' los veedores quedaron en contactarte más adelante.');
        else Hero_msg('La prueba abierta de ' + t.place + ' fue positiva: recibiste interés de clubes de la zona.');
      } else Hero_msg('La prueba abierta de ' + t.place + ' no resultó. Seguir mejorando y mostrándote en el regional es la clave.');
      h.mor = U.clamp(h.mor + (ok ? 6 : -5), 0, 100);
      return;
    }
    var ok2 = R() < d.p;
    h.mor = U.clamp(h.mor + (ok2 ? 6 : -4), 0, 100);
    if (ok2) Market.addOffer({ type: 'academy', club: c.id, years: 2, wage: 0, text: '¡Prueba aprobada! ' + c.nm + ' te ofrece incorporarte a sus divisiones inferiores.', exp: S.week + 8 });
    else Hero_msg('La prueba en ' + c.nm + ' no fue satisfactoria. Te aconsejan seguir madurando. (Probabilidad estimada: ' + Math.round(d.p * 100) + '%)');
  };
  function Hero_msg(t) { FP.Hero.msg(t, 'i'); }

  // ofertas de traspaso / préstamo a jugadores de academia (>=17) y profesionales
  Market.transferOffers = function (freeAgent) {
    var S = FP.S, h = S.hero, age = FP.Hero.age(), cc = Market.heroCountry();
    var cur = h.club != null ? S.clubs[h.club] : null;
    var potEst = Market.potEst(), val = Market.heroValue();
    var curLvl = cur ? Market.clubLevel(cur) : 40;
    var lambda = 0.55 + (h.agent ? h.agent.lvl * 0.3 : 0) + U.clamp((h.ovr - (cur ? cur.st - 2 : 50)) * 0.1, -0.5, 1.6) + (h.season.g + h.season.a * 0.5) * 0.02 + (FP.Valor ? FP.Valor.demand() : 0);   // el mercado te ve en alza o en baja (js/valor.js)
    if (freeAgent) lambda += 0.8;
    var n = Math.min(3, U.poisson(Math.max(0.1, lambda)));
    if (age < 17) n = 0;
    var made = 0, roleNow = (h.tk === 'pro' || h.tk === 'loan') ? FP.Hero.roleLabel() : 'Titular';
    var target = h.ovr + 1 + Math.max(0, (potEst - h.ovr)) * 0.3;
    var curQ = cur ? FP.LGDEF[cur.lg].q : 42;
    var pool = [];
    S.clubs.forEach(function (club) {
      if (club === cur) return;
      if (age < 18 && club.c !== cc) return;
      var st = club.st, gap = h.ovr - (st - 4), prospect = potEst - st;
      var ok = gap >= -2 || (age <= 22 && prospect >= 3 && gap >= -10);
      if (!ok) return;
      if (club.st > h.ovr + 10 + Math.max(0, (potEst - h.ovr) * 0.4)) return;
      if (cur && club.st < cur.st - 4 && roleNow !== 'Suplente' && roleNow !== 'Rotación') return;
      var newQ = FP.LGDEF[club.lg].q;
      if (newQ - curQ > 6 + Math.max(0, h.ovr - 62) * 0.6 + (age <= 21 ? 2 : 0)) return;
      var w = Math.exp(-Math.abs(club.st - target) / 5) * (club.c === cc ? 1.6 : 1) * (club.c !== cc && !freeAgent && R() < 0.3 ? 0.5 : 1);
      pool.push({ club: club, w: w, gap: gap });
    });
    while (made < n && pool.length) {
      var pk = U.wpick(pool, function (x) { return x.w; });
      pool.splice(pool.indexOf(pk), 1);
      var club2 = pk.club, gap2 = pk.gap; made++;
      var role = gap2 >= 3 ? 'Titular' : gap2 >= -2 ? 'Rotación' : 'Proyecto / suplente';
      var wage = Market.wageFor(club2, role === 'Titular' ? 1.15 : role === 'Rotación' ? 1 : 0.75);
      var years = age < 20 ? U.int(3, 5) : age < 30 ? U.int(2, 4) : U.int(1, 2);
      var fee = Math.round(val * (0.8 + R() * 0.45));
      if (freeAgent || (h.contract && D.of(h.contract.end, 5, 30) < S.week + 20)) fee = 0;
      var text = club2.nm + ' (' + C.cname(club2.c) + ', ' + FP.LGDEF[club2.lg].n + ') quiere ficharte: ' + role.toLowerCase() + ', ' + years + ' años, ' + FP.fmt.money(wage) + ' al año' + (fee ? ', traspaso ' + FP.fmt.money(fee) + '.' : ' (agente libre).');
      Market.addOffer({ type: 'transfer', club: club2.id, fee: fee, wage: wage, years: years, role: role, text: text, exp: S.week + (freeAgent ? 6 : 5) });
    }
    // cesiones: jugadores profesionales de club grande sin minutos
    if ((h.tk === 'pro' || h.tk === 'academy') && age <= 23 && cur) {
      var st0 = FP.Hero.roleLabel();
      if ((st0 === 'Suplente' || st0 === 'Rotación' || h.tk === 'academy') && R() < 0.45 && Market.isWindow(S.week)) {
        var opts = S.clubs.filter(function (c) { return c.c === cc && c !== cur && Math.abs(c.st - h.ovr) < 6 && FP.LGDEF[c.lg].t >= FP.LGDEF[cur.lg].t; });
        if (opts.length && (h.tk === 'pro' || age >= 17)) {
          var lc = U.pick(opts);
          Market.addOffer({ type: 'loan', club: lc.id, years: 1, wage: 0, role: 'Con minutos', text: lc.nm + ' solicita tu cesión por una temporada para darte minutos. Regresas a ' + cur.nm + ' al terminar.', exp: S.week + 5 });
        }
      }
    }
  };

  // contrato: renovación y vencimiento
  Market.contractWatch = function (w) {
    var S = FP.S, h = S.hero, ct = h.contract; if (!ct) return;
    var club = S.clubs[h.club], cal = FP.LGDEF[club.lg].cal;
    var endW = Market.contractEndWeek(ct, cal);
    ct.endW = endW;
    var left = endW - w;
    if (left <= 20 && left > 0 && !ct.renewAsked && h.tk === 'pro') {
      ct.renewAsked = true;
      var gap = h.ovr - (club.st - 4);
      if (gap >= -6 || FP.Hero.age() < 21) {
        var years = FP.Hero.age() < 22 ? U.int(2, 4) : U.int(1, 3);
        var wage = Math.round(Market.wageFor(club, gap >= 2 ? 1.2 : 1) * 1.05);
        Market.addOffer({ type: 'renew', club: club.id, years: years, wage: wage, text: club.nm + ' te propone renovar: ' + years + ' años y ' + FP.fmt.money(wage) + ' anuales.', exp: endW - 1 });
      } else FP.Hero.msg(club.nm + ' no tiene previsto renovarte. Tu contrato termina pronto: busca opciones.', 'warn');
    }
    if (left <= 0) Market.contractExpired();
  };
  Market.contractExpired = function () {
    var S = FP.S, h = S.hero, club = S.clubs[h.club];
    FP.Hero.msg('Tu contrato con ' + club.nm + ' ha vencido. Eres agente libre.', 'warn');
    if (h.tk === 'loan') { Market.endLoan(); return; }
    Market.release('Contrato vencido');
  };
  Market.endLoan = function () {
    var S = FP.S, h = S.hero, l = h.loan; if (!l) return;
    var parent = S.clubs[l.from];
    FP.Hero.msg('Terminó tu cesión en ' + C.tname(l.to) + ': regresas a ' + parent.nm + '.', 'i');
    FP.Hero.endSeasonStats(Market.seasonLabel(), C.tname(l.to) + ' (cedido)');
    h.tk = 'pro'; h.club = l.from; h.team = l.from; h.loan = null;
    h.contract = l.ct; Market.leaveComps(); FP.Hero.ensureInRoster();
  };
  Market.release = function (why) {
    var S = FP.S, h = S.hero;
    FP.Hero.endSeasonStats(Market.seasonLabel(), h.club != null ? C.tname(h.club) : '—');
    h.tk = 'free'; h.club = null; h.team = null; h.contract = null; h.freeSince = S.week; h.loan = null;
    Market.leaveComps(); FP.Hero.ensureInRoster();
  };
  Market.seasonLabel = function () {
    var S = FP.S, h = S.hero, w = S.week, ymd = D.ymd(w);
    var club = h.club != null ? S.clubs[h.club] : null;
    var cal = club ? FP.LGDEF[club.lg].cal : 'year';
    if (cal === 'euro') { var y = ymd[1] >= 6 ? ymd[0] : ymd[0] - 1; return y + '/' + String(y + 1).slice(2); }
    return String(ymd[0]);
  };
  Market.leaveComps = function () {
    var S = FP.S, h = S.hero;
    Object.keys(S.comps).forEach(function (id) {
      var c = S.comps[id];
      if (c.kind === 'A' || c.kind === 'Y' || c.kind === 'F') { if (h.team == null || c.teams.indexOf(h.team) < 0 || c.kind === 'F') { delete S.comps[id]; } }
    });
    S.pending = (S.pending || []).filter(function (p) { return S.comps[p.c]; });
  };

  // ---------- responder ofertas ----------
  Market.respond = function (oid, accept) {
    var S = FP.S, h = S.hero, o = h.offers.filter(function (x) { return x.id === oid; })[0];
    if (!o) return { ok: false, msg: 'La oferta ya no está disponible.' };
    if (!accept) { h.offers = h.offers.filter(function (x) { return x.id !== oid; }); if (o.type === 'renew') h.flags.refusedRenew = true; return { ok: true, msg: 'Oferta rechazada.' }; }
    var club = o.club != null ? S.clubs[o.club] : null, age = FP.Hero.age();
    var res = { ok: true, msg: '' };
    if (o.type === 'trial') {
      h.offers = h.offers.filter(function (x) { return x.id !== oid; });
      h.trials = h.trials || []; h.trials.push({ club: o.club, w: S.week + 1 });
      return { ok: true, msg: 'Aceptaste la invitación: la prueba será la próxima semana.' };
    }
    if (o.type === 'event') {
      h.offers = h.offers.filter(function (x) { return x.id !== oid; });
      if (o.trialOpen) { h.trials = h.trials || []; h.trials.push({ open: true, place: o.place, clubs: o.clubs, w: S.week + 1, club: null }); return { ok: true, msg: 'Asistirás a la prueba en ' + o.place + ' la próxima semana.' }; }
      return { ok: true, msg: '' };
    }
    if (o.type === 'amateur') {
      h.offers = h.offers.filter(function (x) { return x.id !== oid; });
      var nm = FP.Names.club(); Market.joinAmateur(Market.newAmateurClub(nm, Market.heroCountry(), 50)); return { ok: true, msg: 'Te incorporas a ' + nm + '.' };
    }
    if (o.type === 'academy') {
      h.offers = h.offers.filter(function (x) { return x.id !== oid; });
      Market.joinAcademy(o.club, o.years);
      return { ok: true, msg: 'Bienvenido a las divisiones inferiores de ' + club.nm + '.' };
    }
    if (o.type === 'pro') {
      h.offers = h.offers.filter(function (x) { return x.id !== oid; });
      Market.signPro(o.club, o.years, o.wage, o.role); return { ok: true, msg: 'Firmaste tu contrato profesional con ' + club.nm + '.' };
    }
    if (o.type === 'renew') {
      h.offers = h.offers.filter(function (x) { return x.id !== oid; });
      h.contract = { type: 'prof', wage: o.wage, end: Market.endYearOf(FP.LGDEF[club.lg].cal, o.years), clause: h.contract ? h.contract.clause : null };
      h.mor = U.clamp(h.mor + 8, 0, 100);
      return { ok: true, msg: 'Renovaste con ' + club.nm + ' hasta ' + h.contract.end + '.' };
    }
    if (o.type === 'loan') {
      var cur = S.clubs[h.club];
      h.offers = h.offers.filter(function (x) { return x.id !== oid; });
      h.loan = { from: h.club, to: o.club, ct: h.contract, end: S.week + 40 };
      FP.Hero.endSeasonStats(Market.seasonLabel(), cur.nm);
      h.tk = 'loan'; h.team = o.club; h.contract = { type: 'cesion', wage: h.contract ? h.contract.wage : 0, end: D.year(S.week + 40) + 0, endW: S.week + 40 };
      h.contract.end = D.year(S.week + 40);
      Market.leaveComps(); FP.Hero.ensureInRoster();
      FP.Sim.news(h.nm + ' es cedido por ' + cur.nm + ' a ' + club.nm + '.', 'transfer', 1);
      return { ok: true, msg: 'Cedido a ' + club.nm + ' por una temporada.' };
    }
    if (o.type === 'transfer') {
      var cur2 = h.club != null ? S.clubs[h.club] : null;
      // decisión del club actual
      if (cur2 && h.contract && (h.tk === 'pro' || h.tk === 'academy' || h.tk === 'loan') && o.fee > 0) {
        var val = Market.heroValue(), ratio = o.fee / Math.max(1, val);
        var role = FP.Hero.roleLabel();
        var p = 0.15 + (ratio - 0.8) * 1.6 + (role === 'Suplente' || role === 'Rotación' ? 0.2 : -0.1) + (club.st > cur2.st + 4 ? 0.12 : 0) + (h.flags.transferReq ? 0.3 : 0) - (h.tk === 'academy' ? 0.1 : 0);
        if (R() > U.clamp(p, 0.04, 0.95)) {
          h.offers = h.offers.filter(function (x) { return x.id !== oid; });
          h.mor = U.clamp(h.mor - 4, 0, 100);
          return { ok: false, msg: cur2.nm + ' rechazó la oferta de ' + club.nm + '. Puedes solicitar la salida para aumentar las posibilidades.' };
        }
      }
      h.offers = h.offers.filter(function (x) { return x.id !== oid; });
      var fromName = cur2 ? cur2.nm : 'agente libre';
      FP.Hero.endSeasonStats(Market.seasonLabel(), fromName);
      Market.signPro(o.club, o.years, o.wage, o.role, o.fee, fromName);
      return { ok: true, msg: 'Fichaste por ' + club.nm + '.' };
    }
    return { ok: false, msg: 'Oferta no reconocida.' };
  };
  Market.newAmateurClub = function (nm, cc, st, tier) {
    var S = FP.S, id = 20000 + S.amat.length;
    S.amat.push({ id: id, nm: nm, c: cc, st: st || 50, user: true, grp: null, tier: tier || null });
    return id;
  };
  Market.joinAmateur = function (id) {
    var S = FP.S, h = S.hero;
    if (h.tk === 'pro' || h.tk === 'loan') FP.Hero.endSeasonStats(Market.seasonLabel(), C.tname(h.club));
    h.tk = 'amat'; h.club = null; h.team = id; h.contract = null; h.loan = null; h.freeSince = null;
    Market.leaveComps(); FP.Hero.ensureInRoster(); FP.Hero.ensureComps();
  };
  Market.joinAcademy = function (clubId, years) {
    var S = FP.S, h = S.hero, club = S.clubs[clubId];
    if (h.tk === 'pro' || h.tk === 'loan') FP.Hero.endSeasonStats(Market.seasonLabel(), C.tname(h.club));
    h.tk = 'academy'; h.club = clubId; h.team = 30000 + clubId;
    h.contract = { type: 'juvenil', wage: 0, end: Market.endYearOf(FP.LGDEF[club.lg].cal, years || 2) };
    h.freeSince = null; h.loan = null;
    Market.leaveComps(); FP.Hero.ensureInRoster(); FP.Hero.ensureComps();
    FP.Sim.news(h.nm + ' ingresa a las divisiones inferiores de ' + club.nm + '.', 'hero', 1);
    h.mor = U.clamp(h.mor + 8, 0, 100);
  };
  Market.signPro = function (clubId, years, wage, role, fee, fromName) {
    var S = FP.S, h = S.hero, club = S.clubs[clubId], age = FP.Hero.age();
    var wasAcademy = h.tk === 'academy' && h.club === clubId;
    var toAcademy = age < 19 && h.ovr - FP.Youth.adultPenalty(age) < club.st - 6;
    h.club = clubId; h.loan = null; h.freeSince = null;
    if (toAcademy) { h.tk = 'academy'; h.team = 30000 + clubId; } else { h.tk = 'pro'; h.team = clubId; }
    h.contract = { type: 'prof', wage: wage, end: Market.endYearOf(FP.LGDEF[club.lg].cal, years), clause: null, role: role };
    if (fee) h.contract.fee = fee;
    h.offers = h.offers.filter(function (x) { return x.type !== 'pro'; });
    Market.leaveComps(); FP.Hero.ensureInRoster(); FP.Hero.ensureComps();
    h.mor = U.clamp(h.mor + 10, 0, 100);
    if (!wasAcademy || fee) FP.Sim.news(h.nm + ' ficha por ' + club.nm + (fromName ? ' (desde ' + fromName + ')' : '') + (fee ? ' por ' + FP.fmt.money(fee) + '.' : '.'), 'hero', 2);
    (h.history = h.history || []).push({ w: S.week, t: 'Firma con ' + club.nm + (fee ? ' (traspaso ' + FP.fmt.money(fee) + ')' : '') + (toAcademy ? ' — juega en el equipo juvenil/reserva' : ''), club: clubId });
    if (toAcademy) FP.Hero.msg('Firmas contrato profesional, pero por ahora jugarás en el equipo juvenil de ' + club.nm + ' hasta ganarte un lugar en el primer equipo.', 'i');
  };
  // ascenso al primer equipo para juveniles con contrato profesional
  Market.promoteCheck = function () {
    var S = FP.S, h = S.hero; if (h.tk !== 'academy' || !h.contract || h.contract.type !== 'prof') return;
    var club = S.clubs[h.club], age = FP.Hero.age();
    if (age >= 17 && h.ovr - FP.Youth.adultPenalty(age) >= club.st - 7) {
      h.tk = 'pro'; h.team = h.club; Market.leaveComps(); FP.Hero.ensureInRoster();
      FP.Hero.msg('¡Ascendido al primer equipo de ' + club.nm + '! Ahora competirás por un lugar con los profesionales.', 'ok');
      FP.Sim.news(h.nm + ' (' + age + ') es promovido al primer equipo de ' + club.nm + '.', 'hero', 2);
    }
  };
  Market.requestTransfer = function () {
    var h = FP.S.hero;
    if (h.tk !== 'pro' && h.tk !== 'academy') return { ok: false, msg: 'Solo disponible si tienes contrato con un club.' };
    h.flags.transferReq = true; h.mor = U.clamp(h.mor - 5, 0, 100);
    return { ok: true, msg: 'Solicitaste la salida. El club será más receptivo, pero tu relación se resiente.' };
  };
  Market.hireAgent = function (i) {
    var h = FP.S.hero, c = Market.agentCandidates()[i];
    if (!c) return { ok: false, msg: 'Representante no disponible.' };
    if (FP.Hero.age() < 15) return { ok: false, msg: 'Podrás contratar representante desde los 15 años.' };
    h.agent = { nm: c.nm, lvl: c.lvl, com: c.com };
    return { ok: true, msg: c.nm + ' es ahora tu representante.' };
  };
  Market.agentCandidates = function () {
    var S = FP.S, r = U.mulberry(U.hash(S.seed, 'agents', Math.floor(S.week / 52)));
    return [1, 3, 5].map(function (l) { return { nm: FP.Names.gen(S.hero.nat, r) + ' (agente)', lvl: l, com: l === 1 ? 3 : l === 3 ? 6 : 10 }; });
  };

  // ---------- evaluación de cantera (fin de temporada) ----------
  Market.youthReview = function () {
    var S = FP.S, h = S.hero; if (h.tk !== 'academy') return;
    var club = S.clubs[h.club], age = FP.Hero.age();
    var potEst = Market.potEst();
    var need = club.st - (age >= 18 ? 11 : 14);
    if (age >= 16) {
      if (h.ovr >= need || (potEst >= club.st + 6 && h.ovr >= need - 5)) {
        var wage = Math.round(Market.wageFor(club, 0.35));
        Market.addOffer({ type: 'pro', club: club.id, years: age < 18 ? 3 : 4, wage: wage, role: 'Juvenil / primer equipo', text: club.nm + ' te ofrece tu primer contrato profesional: ' + (age < 18 ? 3 : 4) + ' años, ' + FP.fmt.money(wage) + ' al año.', exp: S.week + 14 });
      } else if (age >= 18 && h.ovr < need - 8) {
        FP.Hero.msg(club.nm + ' no te ofrecerá contrato profesional. Tu etapa en la cantera termina.', 'warn');
        h.flags.releasedAcademy = true;
        Market.release('Fin de cantera');
        h.freeSince = S.week;
      } else {
        FP.Hero.msg(club.nm + ' quiere seguir viéndote en la cantera: no hay oferta profesional aún.', 'i');
      }
    }
  };
})();
