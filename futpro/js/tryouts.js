/* FUTPRO — pruebas masivas: mientras estás sin club (o en un club amateur) se anuncian jornadas abiertas de clubes y
   showcases con ojeadores de varios clubes. Compites contra cientos de aspirantes; destacar abre pruebas, ofertas e interés. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, M = FP.Market, Rep = FP.Rep, Hero = FP.Hero;
  var T = FP.Tryouts = {};

  T.ensure = function () {
    var S = FP.S, h = S && S.hero; if (!h) return null;
    if (!h.ty) h.ty = { reg: null, hist: [], cd: 0 };
    if (!S.ty) S.ty = { k: -1, items: [], nid: 1 };
    return h.ty;
  };
  T.eligible = function () { var h = FP.S.hero; return !!h && !h.retired && (h.tk === 'free' || h.tk === 'amat') && Hero.age() >= 12; };
  function tier(c) { return FP.LGDEF[c.lg].t; }
  function monthKey(w) { var y = D.ymd(w); return y[0] * 12 + y[1]; }

  // Genera las convocatorias del mes (jornadas abiertas de clubes y showcases)
  T.refresh = function () {
    var S = FP.S, h = S.hero, w = S.week; T.ensure(); if (!T.eligible()) return;
    var k = monthKey(w); if (S.ty.k === k) return; S.ty.k = k;
    S.ty.items = S.ty.items.filter(function (x) { return x.w >= w; });
    var age = Hero.age(), cc = M.heroCountry(), items = [];
    var dom = S.clubs.filter(function (c) { return c.c === cc && tier(c) <= 4; }).sort(function () { return R() - 0.5; });
    dom.slice(0, 3).forEach(function (c) { items.push({ kind: 'club', club: c.id, w: w + U.int(1, 4), n: U.int(90, 320), cost: 0 }); });
    var pool = dom.filter(function (c) { return Rep.foreignOK(c, h.nat, age); }).slice(0, 8);
    if (pool.length >= 4) items.push({ kind: 'show', clubs: pool.slice(0, U.int(4, 8)).map(function (c) { return c.id; }), w: w + U.int(2, 5), n: U.int(180, 420), cost: age >= 18 ? 1 : 0, cc: cc });
    if (age >= 18 && R() < 0.5) {
      var fx = S.clubs.filter(function (c) { return c.c !== cc && tier(c) <= 3 && Rep.foreignOK(c, h.nat, age) && Rep.permit(c); }).sort(function () { return R() - 0.5; }).slice(0, U.int(4, 7));
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
  T.weekly = function (w) {
    var h = FP.S.hero; if (!h || h.retired) return; T.ensure();
    if (!T.eligible()) { h.ty.reg = null; return; }
    T.refresh();
    if (h.ty.reg && w >= h.ty.reg.w) { if (h.inj && h.inj.n > 0) { h.ty.reg = null; Hero.msg('Faltaste a la prueba masiva por lesión.', 'warn'); } else T.resolve(); }
    FP.S.ty.items = FP.S.ty.items.filter(function (x) { return x.w >= w; });
  };
  T.migrate = function () { T.ensure(); };

  var hw0 = M.heroWeekly;
  M.heroWeekly = function (w) { var r = hw0.apply(this, arguments); try { T.weekly(w); } catch (e) { if (window.console) console.warn('tryouts', e); } return r; };
})();
