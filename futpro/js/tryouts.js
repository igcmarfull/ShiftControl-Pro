/* FUTPRO — pruebas masivas: mientras estás sin club (o en un club amateur) se anuncian jornadas abiertas de clubes y
   showcases con ojeadores de varios clubes. Compites contra cientos de aspirantes; destacar abre pruebas, ofertas e interés. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, M = FP.Market, Rep = FP.Rep, Hero = FP.Hero;
  var T = FP.Tryouts = {};

  T.ensure = function () {
    var S = FP.S, h = S && S.hero; if (!h) return null;
    if (!h.ty) h.ty = { reg: null, hist: [], cd: 0 };
    if (h.ty.trip === undefined) { h.ty.trip = null; h.ty.tripCd = 0; }
    if (!S.ty) S.ty = { k: -1, items: [], nid: 1 };
    return h.ty;
  };
  T.eligible = function () { var h = FP.S.hero; return !!h && !h.retired && (h.tk === 'free' || h.tk === 'amat') && Hero.age() >= 12; };
  function tier(c) { return FP.LGDEF[c.lg].t; }
  // Clubes a los que tiene sentido ir a probarse: ligas bajas o equipos de un nivel parecido al tuyo (no se prueba un jugador mediocre en un grande)
  T.reach = function (c, age) {
    var h = FP.S.hero, a = age != null ? age : Hero.age(), eff = h.ovr - FP.Youth.adultPenalty(a);
    if (a >= 20) return tier(c) >= 2 && c.st <= eff + 3;     // los adultos se prueban en divisiones inferiores: los clubes de primera no hacen pruebas abiertas
    return M.trialDifficulty(c.id).p >= 0.12;
  };
  function monthKey(w) { var y = D.ymd(w); return y[0] * 12 + y[1]; }

  // Genera las convocatorias del mes (jornadas abiertas de clubes y showcases)
  T.refresh = function () {
    var S = FP.S, h = S.hero, w = S.week; T.ensure(); if (!T.eligible()) return;
    var k = monthKey(w); if (S.ty.k === k) return; S.ty.k = k;
    S.ty.items = S.ty.items.filter(function (x) { return x.w >= w; });
    var age = Hero.age(), cc = M.heroCountry(), items = [];
    var dom = S.clubs.filter(function (c) { return c.c === cc && tier(c) <= 4 && (age < 20 || tier(c) >= 2); }).sort(function () { return R() - 0.5; });
    dom.slice(0, 3).forEach(function (c) { items.push({ kind: 'club', club: c.id, w: w + U.int(1, 4), n: U.int(90, 320), cost: 0 }); });
    var pool = dom.filter(function (c) { return Rep.foreignOK(c, h.nat, age); }).slice(0, 8);
    if (pool.length >= 4) items.push({ kind: 'show', clubs: pool.slice(0, U.int(4, 8)).map(function (c) { return c.id; }), w: w + U.int(2, 5), n: U.int(180, 420), cost: age >= 18 ? 1 : 0, cc: cc });
    if (age >= 18 && R() < 0.5) {
      var fx = S.clubs.filter(function (c) { return c.c !== cc && tier(c) <= 4 && T.reach(c, age) && Rep.foreignOK(c, h.nat, age) && Rep.permit(c); }).sort(function () { return R() - 0.5; }).slice(0, U.int(4, 7));
      if (fx.length >= 4) items.push({ kind: 'show', clubs: fx.map(function (c) { return c.id; }), w: w + U.int(3, 6), n: U.int(250, 500), cost: 3, intl: 1 });
    }
    items.forEach(function (x) { x.id = S.ty.nid++; S.ty.items.push(x); });
    if (items.length) Hero.msg('Se anunciaron ' + items.length + ' pruebas masivas este mes (menú Pruebas masivas).', 'i');
  };

  // nivel de los aspirantes (media y dispersión): una jornada abierta reúne a muchos jugadores de nivel bajo
  T.field = function (kind) {
    var h = FP.S.hero, age = Hero.age(), cc = M.heroCountry();
    var mean = age <= 19 ? FP.Youth.natLevel(cc) * FP.Youth.f(Math.min(Math.max(age, 12), 19)) - (kind === 'show' ? 7 : 9) : 43;
    return { mean: mean, sd: 6.5 };
  };
  function phi(z) { var t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; }
  // pronóstico para la pantalla: probabilidad de quedar entre los destacados
  T.chance = function (item) {
    var h = FP.S.hero, age = Hero.age(), f = T.field(item.kind), eff = h.ovr - (age >= 19 ? FP.Youth.adultPenalty(age) : 0) + (h.form - 50) * 0.05;
    var pct = phi((eff - f.mean) / Math.sqrt(f.sd * f.sd + 9)), rank = Math.max(1, Math.round(item.n * (1 - pct) + 0.5)), top = Math.max(3, Math.round(item.n * 0.04));
    return { rankEst: rank, sel: top, label: rank <= 2 ? 'Muy alta' : rank <= top ? 'Alta' : rank <= top * 2.5 ? 'Media' : 'Baja' };
  };

  T.register = function (id) {
    var S = FP.S, h = S.hero; T.ensure();
    var it = S.ty.items.filter(function (x) { return x.id === id; })[0];
    if (!T.eligible()) return { ok: false, msg: 'Solo puedes asistir sin club profesional.' };
    if (!it) return { ok: false, msg: 'Esa convocatoria ya no está disponible.' };
    if (h.ty.reg) return { ok: false, msg: 'Ya estás inscrito en otra prueba.' };
    if (h.ty.cd > S.week) return { ok: false, msg: 'Necesitas descansar: podrás inscribirte de nuevo dentro de ' + (h.ty.cd - S.week) + ' semanas.' };
    if (h.inj && h.inj.n > 0) return { ok: false, msg: 'Estás lesionado.' };
    var age = Hero.age(), cost = age < 18 ? 0 : it.cost;
    if (cost && h.money < cost) return { ok: false, msg: 'No tienes fondos para la inscripción (' + FP.fmt.money(cost) + ').' };
    if (cost) FP.Contracts.pay(-cost, 'inversion', 'Inscripción a prueba masiva');
    h.ty.reg = { id: id, w: it.w, item: it };
    return { ok: true, msg: 'Quedaste inscrito: la prueba es en ' + Math.max(0, it.w - S.week) + ' semana(s).' };
  };
  T.cancel = function () { var h = FP.S.hero; T.ensure(); h.ty.reg = null; };

  T.resolve = function () {
    var S = FP.S, h = S.hero, reg = h.ty.reg, it = reg.item, age = Hero.age(); h.ty.reg = null; h.ty.cd = S.week + 6;
    var f = T.field(it.kind), eff = h.ovr - (age >= 19 ? FP.Youth.adultPenalty(age) : 0) + (h.form - 50) * 0.05 - (h.fat > 70 ? (h.fat - 70) * 0.05 : 0) + U.norm() * 3;
    var pct = phi((eff - f.mean) / f.sd), rank = Math.max(1, Math.round(it.n * (1 - pct) + 0.5)), top = Math.max(3, Math.round(it.n * 0.04));
    var level = rank <= 2 ? 'top' : rank <= top ? 'sel' : 'no';
    h.fat = U.clamp(h.fat + 8, 0, 100);
    var clubs = it.kind === 'club' ? [it.club] : it.clubs, made = 0, names = [];
    function offerFrom(cid) {
      var c = S.clubs[cid]; if (!c || h.offers.some(function (o) { return o.club === cid; })) return false;
      if (!Rep.foreignOK(c, h.nat, age)) return false;
      if (age <= 19) { M.addOffer({ type: 'academy', club: cid, years: 2, wage: 0, text: '¡Destacaste en la prueba masiva! ' + c.nm + ' te ofrece incorporarte a sus divisiones inferiores.', exp: S.week + 8 }); }
      else { M.addOffer({ type: 'trial_pro', club: cid, text: c.nm + ' vio tu actuación en la prueba masiva y te invita a entrenar con su primer equipo dos semanas.', exp: S.week + 6 }); }
      names.push(c.nm); return true;
    }
    if (level === 'top') {
      var order = clubs.slice().sort(function () { return R() - 0.5; }), k = it.kind === 'club' ? 1 : 2;
      order.forEach(function (cid) { if (made < k && offerFrom(cid)) made++; });
      order.slice(0, 4).forEach(function (cid) { var c = S.clubs[cid]; if (c && Rep.foreignOK(c, h.nat, age)) Rep.addInterest(c, U.int(20, 40), 'tras tu actuación en la prueba masiva'); });
      h.mor = U.clamp(h.mor + 8, 0, 100);
    } else if (level === 'sel') {
      var cid = U.pick(clubs); if (offerFrom(cid)) made++;
      clubs.slice(0, 2).forEach(function (id2) { var c = S.clubs[id2]; if (c && Rep.foreignOK(c, h.nat, age)) Rep.addInterest(c, U.int(8, 20), 'tras la prueba masiva'); });
      h.mor = U.clamp(h.mor + 4, 0, 100);
    } else {
      var c1 = S.clubs[U.pick(clubs)]; if (c1 && R() < 0.4 && Rep.foreignOK(c1, h.nat, age)) Rep.addInterest(c1, U.int(5, 12), 'por tu paso por la prueba masiva');
      h.mor = U.clamp(h.mor - 3, 0, 100);
    }
    var where = it.kind === 'club' ? 'la jornada abierta de ' + S.clubs[it.club].nm : it.intl ? 'el showcase internacional' : 'el showcase regional';
    var rec = { w: S.week, kind: it.kind, club: it.kind === 'club' ? it.club : null, n: it.n, rank: rank, level: level, offers: names };
    h.ty.hist.unshift(rec); if (h.ty.hist.length > 20) h.ty.hist.length = 20;
    Hero.msg('Terminó ' + where + ': quedaste ' + rank + '.º de ' + it.n + (level === 'top' ? ' — ¡destacaste!' + (names.length ? ' Recibes propuestas de ' + names.join(', ') + '.' : '') : level === 'sel' ? ' — quedaste entre los seleccionados' + (names.length ? ': ' + names.join(', ') + ' quiere verte más.' : '.') : ' — no quedaste entre los elegidos.'), level === 'no' ? 'warn' : 'ok');
    return rec;
  };

  // ---------- viaje de prueba al extranjero ----------
  // Sin club (o en un club amateur) se puede viajar unas semanas a otro país para probarse en hasta 3 clubes.
  // Menores: solo 16-17 años dentro de la UE/EEE (Rep.foreignOK); bajo 16 no hay viaje. Las pruebas usan las mismas reglas de siempre
  // (cantera hasta los 19 años, primer equipo desde los 20) y las propuestas pasan por las reglas de extranjeros y permiso de trabajo.
  T.TRIP_MIN_AGE = 16; T.TRIP_MAX_CLUBS = 3;
  T.canTrip = function () {
    var S = FP.S, h = S.hero; T.ensure();
    if (!T.eligible()) return { ok: false, msg: 'Solo sin club profesional.' };
    if (Hero.age() < T.TRIP_MIN_AGE) return { ok: false, msg: 'Los viajes de prueba al extranjero son desde los ' + T.TRIP_MIN_AGE + ' años.' };
    if (h.ty.trip) return { ok: false, msg: 'Ya estás de viaje de prueba.' };
    if (h.ty.tripCd > S.week) return { ok: false, msg: 'Necesitas recuperarte del viaje: podrás volver a viajar dentro de ' + (h.ty.tripCd - S.week) + ' semanas.' };
    if (h.inj && h.inj.n > 0) return { ok: false, msg: 'Estás lesionado.' };
    return { ok: true };
  };
  T.tripCountries = function () {
    var S = FP.S, h = S.hero, home = M.heroCountry(), seen = {}, out = [];
    S.clubs.forEach(function (c) { if (c.c !== home && !seen[c.c]) { seen[c.c] = 1; out.push(c.c); } });
    return out.sort(function (a, b) { return FP.DATA.countries[a].n.localeCompare(FP.DATA.countries[b].n, 'es'); });
  };
  T.tripClubs = function (cc) {
    var S = FP.S, h = Rep.ensure(), age = Hero.age(), maxT = age < 18 ? 3 : 4;
    return S.clubs.filter(function (c) { return c.c === cc && tier(c) <= maxT && T.reach(c, age); }).map(function (c) {
      var ok = Rep.foreignOK(c, h.nat, age), perm = Rep.permit(c), p;
      if (age >= 20) { var f = Rep.fit(c); p = U.clamp(0.25 + f.gap * 0.07 + f.need * 0.2, 0.05, 0.85); } else p = M.trialDifficulty(c.id).p;
      if ((h.cd[c.id] || 0) > S.week) p = Math.min(p, 0.05);
      return { c: c, p: p, ok: ok && perm, why: !ok ? 'cupo de extranjeros completo' : !perm ? 'sin permiso de trabajo' : '', kind: age >= 20 ? 'primer equipo' : 'cantera', cool: (h.cd[c.id] || 0) > S.week };
    }).sort(function (a, b) { return b.p - a.p; });
  };
  T.tripCost = function (cc, n) {
    var home = M.heroCountry(), same = FP.DATA.countries[cc].conf === FP.DATA.countries[home].conf, age = Hero.age();
    return age < 18 ? 0 : Math.round((same ? 2 : 5) + 0.8 * Math.max(0, n - 1));
  };
  T.startTrip = function (cc, ids) {
    Rep.ensure(); var S = FP.S, h = S.hero, age = Hero.age(), can = T.canTrip(); if (!can.ok) return can;
    ids = (ids || []).filter(function (x, i, a) { return a.indexOf(x) === i; });
    if (!ids.length) return { ok: false, msg: 'Elige al menos un club.' };
    if (ids.length > T.TRIP_MAX_CLUBS) return { ok: false, msg: 'Máximo ' + T.TRIP_MAX_CLUBS + ' clubes por viaje.' };
    var opts = T.tripClubs(cc), chosen = ids.map(function (id) { return opts.filter(function (o) { return o.c.id === id; })[0]; });
    if (chosen.some(function (o) { return !o || !o.ok; })) return { ok: false, msg: 'Alguno de los clubes no puede recibirte (cupo de extranjeros o permiso de trabajo).' };
    var cost = T.tripCost(cc, ids.length);
    if (cost && h.money < cost) return { ok: false, msg: 'No tienes fondos para el viaje (' + FP.fmt.money(cost) + ').' };
    if (cost) FP.Contracts.pay(-cost, 'inversion', 'Viaje de prueba a ' + FP.DATA.countries[cc].n);
    var weeks = 1 + ids.length;
    h.ty.trip = { cc: cc, w0: S.week, w1: S.week + weeks, clubs: ids.slice(), cost: cost };
    h.fat = U.clamp(h.fat + 6, 0, 100); h.mor = U.clamp(h.mor - 2, 0, 100);
    Hero.msg('Viajas a ' + FP.DATA.countries[cc].n + ' a probarte en ' + ids.length + (ids.length === 1 ? ' club' : ' clubes') + '. Volverás en ' + weeks + ' semanas' + (cost ? ' (costo ' + FP.fmt.money(cost) + ')' : ' (los gastos los cubre tu familia)') + '.', 'ok');
    return { ok: true, msg: 'Viaje programado.' };
  };
  T.cancelTrip = function () { var h = FP.S.hero; T.ensure(); h.ty.trip = null; };
  T.finishTrip = function () {
    var S = FP.S, h = S.hero, tr = h.ty.trip, age = Hero.age(); h.ty.trip = null; h.ty.tripCd = S.week + 6;
    var before = h.offers.length, got = [];
    tr.clubs.forEach(function (id) {
      var n0 = h.offers.length;
      M.resolveTrial({ club: id, w: S.week, senior: age >= 20 ? 1 : 0, abroad: 1 });
      if (h.offers.length > n0) got.push(S.clubs[id].nm);
    });
    h.fat = U.clamp(h.fat + 4, 0, 100);
    Hero.msg('Volviste de tu viaje de prueba a ' + FP.DATA.countries[tr.cc].n + (got.length ? ': recibiste propuestas de ' + got.join(', ') + '.' : ': por ahora sin propuestas.'), got.length ? 'ok' : 'i');
    h.ty.hist.unshift({ w: S.week, kind: 'trip', club: null, cc: tr.cc, n: tr.clubs.length, rank: 0, level: got.length ? 'top' : 'no', offers: got }); if (h.ty.hist.length > 20) h.ty.hist.length = 20;
  };
  var rt0 = M.resolveTrial;
  M.resolveTrial = function (t) {
    var S = FP.S, h = S.hero, n0 = h.offers.length, r = rt0.apply(this, arguments);
    if (t && t.abroad && h.offers.length === n0 && R() < 0.3) { var c = S.clubs[t.club]; if (c) Rep.addInterest(c, U.int(6, 14), 'tras tu prueba en el extranjero'); }
    return r;
  };

  T.weekly = function (w) {
    var h = FP.S.hero; if (!h || h.retired) return; T.ensure();
    if (!T.eligible()) { h.ty.reg = null; h.ty.trip = null; return; }
    T.refresh();
    if (h.ty.trip && w >= h.ty.trip.w1) T.finishTrip();
    if (h.ty.reg && w >= h.ty.reg.w) { if (h.inj && h.inj.n > 0) { h.ty.reg = null; Hero.msg('Faltaste a la prueba masiva por lesión.', 'warn'); } else T.resolve(); }
    FP.S.ty.items = FP.S.ty.items.filter(function (x) { return x.w >= w; });
  };
  T.migrate = function () { T.ensure(); };

  var hw0 = M.heroWeekly;
  M.heroWeekly = function (w) { var r = hw0.apply(this, arguments); try { T.weekly(w); } catch (e) { if (window.console) console.warn('tryouts', e); } return r; };
})();
