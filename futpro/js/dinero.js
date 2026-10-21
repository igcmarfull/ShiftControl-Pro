/* FUTPRO — finanzas personales: impuestos por país, estilo de vida (gastos y bienestar), inversiones (depósito, bolsa, propiedades, negocios,
 * club amateur), asesor financiero, estafas y peticiones (decisiones), familia y fundación. Unidad: miles de euros.
 * Todos los porcentajes y retornos son supuestos de diseño (no están contrastados con datos reales). */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, Hero = FP.Hero, Dec = FP.Dec;
  var D = FP.Dinero = {};
  function rnd(a, b) { return a + R() * (b - a); }

  // tasa efectiva aproximada sobre sueldos y primas (impuestos + cotizaciones); supuestos
  var TAX = { CHI: .27, ARG: .30, BRA: .27, URU: .25, PAR: .10, COL: .28, PER: .22, ECU: .22, BOL: .25, VEN: .20, ENG: .45, ESP: .45, ITA: .43, GER: .42, FRA: .45, POR: .28, NED: .38, BEL: .50, SCO: .45, TUR: .30, GRE: .22, SUI: .25, AUT: .43, DEN: .50, SWE: .50, NOR: .40, POL: .30, CZE: .25, HRV: .30, SRB: .15, ROU: .10, HUN: .15, BUL: .10, UKR: .20, RUS: .13, ISR: .35, CYP: .25, IRL: .38, WAL: .45, FIN: .42, ISL: .40,
    USA: .35, MEX: .30, CAN: .40, CRC: .20, HON: .20, PAN: .20, GUA: .15, SLV: .20, JAM: .20, KSA: 0, QAT: 0, UAE: 0, IRN: .10, UZB: .12, IND: .30, THA: .20, JPN: .35, KOR: .33, CHN: .30, AUS: .35, EGY: .22, MAR: .30, RSA: .30, TUN: .25, ALG: .25 };
  var TAXED = { sueldo: 1, prima: 1, bono: 1, patrocinio: 1 };
  D.taxRate = function () {
    var cc; try { cc = FP.Market.heroCountry(); } catch (e) { cc = null; }
    var t = TAX[cc]; return t == null ? 0.30 : t;
  };

  // estilo de vida: 3 categorías, 4 niveles
  D.LIFE = {
    casa: { n: 'Vivienda', lv: ['Con la familia / pensión', 'Departamento arrendado', 'Casa en un buen barrio', 'Mansión'], f: [0, .06, .14, .28], min: [0, .012, .04, .12], mor: [0, .05, .12, .22] },
    auto: { n: 'Transporte', lv: ['Transporte público', 'Auto compacto', 'Auto de alta gama', 'Colección de autos de lujo'], f: [0, .02, .06, .15], min: [0, .006, .02, .07], mor: [0, .02, .05, .09] },
    apoyo: { n: 'Entorno de apoyo', lv: ['Solo tú', 'Nutricionista', 'Nutricionista y fisioterapeuta', 'Equipo personal completo'], f: [0, .03, .09, .20], min: [0, .01, .035, .09], rec: [0, .8, 1.6, 2.4], mor: [0, .02, .05, .08] }
  };
  D.ensure = function () {
    var h = FP.S && FP.S.hero; if (!h) return null; hook();
    if (!h.fx) h.fx = { lv: { casa: 0, auto: 0, apoyo: 0 }, inv: [], nid: 1, adv: 0, adverted: 0, tax: 0, living: 0, fees: 0, gain: 0, lost: 0, given: 0, ref: 0, hist: [], led: [], fam: { casa: 0, apoyo: 0 }, fund: { lv: 0, since: null, helped: 0, paid: 0 }, cd: { ev: 0 }, boot: 0 };
    var f = h.fx; if (!f.hist) f.hist = []; if (!f.led) f.led = [];
    return f;
  };
  D.migrate = D.ensure;

  function money() { return Hero ? FP.S.hero.money : 0; }
  function led(w, k, t, a) { var f = D.ensure(); f.led.unshift({ w: w, k: k, t: t, a: Math.round(a * 10) / 10 }); if (f.led.length > 200) f.led.length = 150; }
  function age() { return Hero.age(); }
  function wageNow() { var h = FP.S.hero, ct = h.contract; return ct && ct.wage > 0 ? ct.wage : 0; }
  D.refWage = function () { var f = D.ensure(); return f.ref || 0; };

  // ---------- impuestos ----------
  var hooked = false;
  function hook() {
    var K = FP.Contracts; if (hooked || !K || !K.pay) return; hooked = true;
    var pay0 = K.pay;
    K.pay = function (amt, kind, why, extra) {
      var f = D.ensure();
      if (f && amt > 0 && TAXED[kind]) { var t = D.taxRate(), tax = amt * t; if (tax > 0) { f.tax += tax; amt -= tax; } }
      return pay0.call(K, amt, kind, why, extra);
    };
  }

  // ---------- estilo de vida ----------
  D.lifeCost = function (cat, lv) {
    var d = D.LIFE[cat], wk = D.refWage() / 52; lv = lv == null ? D.ensure().lv[cat] : lv;
    return Math.max(d.min[lv], d.f[lv] * wk);
  };
  D.weeklyLife = function () { var f = D.ensure(); return Object.keys(D.LIFE).reduce(function (s, c) { return s + D.lifeCost(c); }, 0) + D.famCost() + D.fundCost(); };
  D.setLife = function (cat, lv) {
    var f = D.ensure(); if (!D.LIFE[cat] || lv < 0 || lv > 3) return { ok: false, msg: '' };
    if (age() < 18 && lv > 0) return { ok: false, msg: 'Siendo menor de edad vives con tu familia.' };
    f.lv[cat] = lv; return { ok: true, msg: D.LIFE[cat].n + ': ' + D.LIFE[cat].lv[lv] + '.' };
  };

  // ---------- familia y fundación ----------
  var FAMC = { casa: ['Sin ayuda', 'Casa para tus padres'], apoyo: ['Sin apoyo', 'Ayuda mensual', 'Ayuda total (estudios, salud y gastos)'] };
  D.FAM = FAMC;
  D.famCost = function () { var f = D.ensure(), wk = D.refWage() / 52; return [0, .02, .05][f.fam.apoyo] * wk + (f.fam.apoyo ? [0, .01, .02][f.fam.apoyo] : 0); };
  D.fundCost = function () { var f = D.ensure(), wk = D.refWage() / 52; return f.fund.lv ? Math.max([0, .02, .05, .10][f.fund.lv] * wk, [0, .01, .03, .07][f.fund.lv]) : 0; };
  D.houseParentsCost = function () { return Math.max(60, D.refWage() * 0.12); };
  D.buyParentsHouse = function () {
    var f = D.ensure(), h = FP.S.hero, c = D.houseParentsCost();
    if (f.fam.casa) return { ok: false, msg: 'Ya les compraste una casa.' };
    if (h.money < c) return { ok: false, msg: 'No tienes fondos (' + FP.fmt.money(c) + ').' };
    h.money -= c; f.given += c; f.fam.casa = 1; led(FP.S.week, 'fam', 'Casa para tus padres', -c);
    var l = FP.Life && FP.Life.ensure(); if (l) { l.fam.support = U.clamp(l.fam.support + 15, 0, 100); }
    h.mor = U.clamp(h.mor + 6, 0, 100); Hero.msg('Les compraste una casa a tus padres. Un sueño cumplido.', 'ok');
    return { ok: true, msg: 'Casa comprada: apoyo familiar +15.' };
  };
  D.setFam = function (lv) { var f = D.ensure(); if (lv < 0 || lv > 2) return { ok: false, msg: '' }; f.fam.apoyo = lv; return { ok: true, msg: FAMC.apoyo[lv] + '.' }; };
  D.setFund = function (lv) {
    var f = D.ensure(); if (lv < 0 || lv > 3) return { ok: false, msg: '' };
    if (lv > 0 && f.fund.since == null) { f.fund.since = FP.S.week; Hero.msg('Creas tu fundación: ayudará a niños de tu barrio.', 'ok'); }
    f.fund.lv = lv; return { ok: true, msg: lv ? 'Aporte de la fundación: nivel ' + lv + '.' : 'Fundación en pausa.' };
  };

  // ---------- asesor ----------
  D.ADV = [['Sin asesor', 'Tú decides todo.', 0], ['Asesor básico', 'Cobra 0,4% anual del patrimonio. Te protege de la mayoría de las estafas.', .004], ['Asesor premium', 'Cobra 0,9% anual del patrimonio. Evita casi todas las estafas y mejora el retorno de tus inversiones (+1%).', .009]];
  D.setAdvisor = function (lv) { var f = D.ensure(); if (lv < 0 || lv > 2) return { ok: false, msg: '' }; if (lv > 0 && age() < 18) return { ok: false, msg: 'Podrás contratar un asesor desde los 18 años.' }; f.adv = lv; return { ok: true, msg: D.ADV[lv][0] + '.' }; };

  // ---------- inversiones ----------
  D.TYPES = {
    dep: { n: 'Depósito a plazo', d: 'Seguro y líquido. Rinde ~3% anual.' },
    bol: { n: 'Bolsa de valores', d: 'Rinde ~7% anual en promedio, con altibajos fuertes y posibles caídas de 30% o más.' },
    prop: { n: 'Propiedades', d: 'Se revalorizan ~3,5% anual y pagan arriendo (~4,5% anual). Vender cuesta 3%.' },
    biz: { n: 'Negocio propio', d: 'Café, academia, marca de ropa… Cada año: ~35% prospera (gana mucho), ~40% se mantiene, ~25% fracasa (pierdes la mayor parte).' },
    club: { n: 'Club amateur local', d: 'Apoyas a un club de tu ciudad: rinde poco (~2%) pero da fama e imagen.' }
  };
  D.BIZ = ['Café', 'Academia de fútbol', 'Marca de ropa deportiva', 'Restaurante', 'Aplicación deportiva', 'Gimnasio'];
  D.MIN_INV = 10;
  D.networth = function () {
    var f = D.ensure(), h = FP.S.hero, v = h.money;
    f.inv.forEach(function (x) { v += x.val; }); return v;
  };
  D.invTotal = function () { return D.ensure().inv.reduce(function (s, x) { return s + x.val; }, 0); };
  D.invest = function (type, amt) {
    var f = D.ensure(), h = FP.S.hero; amt = Math.round(amt);
    if (age() < 18) return { ok: false, msg: 'Podrás invertir desde los 18 años.' };
    if (!D.TYPES[type]) return { ok: false, msg: '' };
    if (amt < D.MIN_INV) return { ok: false, msg: 'Inversión mínima: ' + D.MIN_INV + ' mil €.' };
    if (h.money < amt) return { ok: false, msg: 'No tienes fondos suficientes.' };
    var fee = type === 'prop' ? amt * 0.02 : 0, nm = D.TYPES[type].n;
    h.money -= amt; f.fees += fee;
    var x = { id: f.nid++, t: type, c: amt, val: amt - fee, w0: FP.S.week, last: FP.S.week };
    if (type === 'biz') { x.k = U.pick(D.BIZ); nm = x.k; x.nextRoll = FP.S.week + 52; x.state = 'nuevo'; }
    if (type === 'club') { var cc = FP.Market.heroCountry(); x.k = 'Club amateur de ' + (h.city || 'tu ciudad'); nm = x.k; }
    f.inv.push(x); led(FP.S.week, 'inv', 'Inviertes en ' + nm, -amt);
    return { ok: true, msg: 'Invertiste ' + FP.fmt.money(amt) + ' en ' + nm + '.' };
  };
  D.sell = function (id) {
    var f = D.ensure(), h = FP.S.hero, x = f.inv.filter(function (y) { return y.id === id; })[0]; if (!x) return { ok: false, msg: '' };
    var fee = x.t === 'prop' ? x.val * 0.03 : x.t === 'biz' || x.t === 'club' ? x.val * 0.10 : 0, gain = Math.max(0, x.val - fee - x.c), cg = gain * 0.15 * (D.taxRate() > 0 ? 1 : 0), net = x.val - fee - cg;
    h.money += net; f.fees += fee + cg; f.gain += net - x.c; f.inv = f.inv.filter(function (y) { return y !== x; });
    led(FP.S.week, 'inv', 'Vendes ' + (x.k || D.TYPES[x.t].n), net);
    return { ok: true, msg: 'Vendiste por ' + FP.fmt.money(net) + (fee + cg ? ' (comisiones e impuesto: ' + FP.fmt.money(fee + cg) + ')' : '') + '.' };
  };
  var advBoost = function () { return D.ensure().adv === 2 ? 0.01 : 0; };
  function tickInv(w) {
    var f = D.ensure(), h = FP.S.hero, mk = D.market();
    f.inv.forEach(function (x) {
      if (x.t === 'dep') x.val *= 1 + (0.03 + advBoost()) / 52;
      else if (x.t === 'bol') { var r = (0.07 + advBoost()) / 52 + (mk.bear ? -0.005 : 0) + 0.18 / Math.sqrt(52) * U.norm(); x.val *= Math.max(0.7, 1 + r); }
      else if (x.t === 'prop') { x.val *= 1 + (0.035 + advBoost()) / 52 + 0.01 * U.norm() / Math.sqrt(52); var rent = x.val * 0.045 / 52 * (D.taxRate() > 0 ? 0.85 : 1); h.money += rent; f.gain += rent; }
      else if (x.t === 'club') { x.val *= 1 + 0.02 / 52; if (R() < 0.01) { var s = FP.S.hero.soc; if (s) s.fame += 0.4; } }
      else if (x.t === 'biz') {
        var bonus = f.adv === 2 ? 0.10 : f.adv === 1 ? 0.04 : 0;
        if (w >= x.nextRoll) {
          var p = R(), good = 0.35 + bonus, mid = 0.40;
          if (p < good) { x.val *= 1.6 + R() * 0.7; x.state = 'prospera'; Hero.msg('Tu negocio «' + x.k + '» prospera: su valor sube a ' + FP.fmt.money(x.val) + '.', 'ok'); }
          else if (p < good + mid) { x.val *= 1.04 + R() * 0.12; x.state = 'estable'; }
          else { var loss = 0.55 + R() * 0.35; x.val *= (1 - loss); x.state = 'fracaso'; f.lost += x.val / (1 - loss) * loss; Hero.msg('Tu negocio «' + x.k + '» fracasa: pierdes buena parte de lo invertido.', 'warn'); }
          x.nextRoll = w + 52;
        }
        if (x.state === 'prospera') { var inc = x.val * 0.10 / 52; h.money += inc; f.gain += inc; }
        else if (x.state === 'estable') { var inc2 = x.val * 0.04 / 52; h.money += inc2; f.gain += inc2; }
      }
    });
  }
  // mercado: ciclos de 6 a 24 meses con rachas bajistas ocasionales
  D.market = function () { var S = FP.S; if (!S.mkt) S.mkt = { bear: false, until: 0 }; var m = S.mkt, w = S.week; if (w >= m.until) { m.bear = !m.bear && R() < 0.28; m.until = w + (m.bear ? U.int(20, 52) : U.int(40, 120)); } return m; };

  // ---------- semana ----------
  D.weekly = function (w) {
    var h = FP.S.hero, f = D.ensure(); if (!h || !f) return;
    if (!f.boot && age() >= 18 && wageNow() > 0) { f.boot = 1; f.lv.casa = 1; f.lv.auto = 1; Hero.msg('Ahora vives por tu cuenta: arriendas un departamento y te mueves en auto. Revisa tus gastos en Finanzas personales.', 'i'); }
    var wg = wageNow(); if (wg > f.ref) f.ref = wg; else if (h.retired || !wg) f.ref *= 0.9985;
    var a = age(), cost = 0;
    if (!h.retired || f.ref > 5) {
      // gastos de vida (solo adultos; los menores viven con la familia)
      if (a >= 18) {
        cost = D.weeklyLife();
        if (h.money < cost * 4 && cost > 0) {        // sin liquidez: se baja el nivel de vida
          var cat = ['casa', 'auto', 'apoyo'].filter(function (c) { return f.lv[c] > 0; })[0];
          if (cat) { f.lv[cat]--; Hero.msg('Tu liquidez es baja: bajas tu nivel de gasto en ' + D.LIFE[cat].n.toLowerCase() + '.', 'warn'); }
          else if (f.fam.apoyo) { f.fam.apoyo = 0; } else if (f.fund.lv) { f.fund.lv = 0; }
        }
        cost = Math.min(cost, Math.max(0, h.money));
        h.money -= cost; f.living += cost;
      }
    }
    // bienestar
    if (!h.retired && a >= 18) {
      var mor = 0, rec = 0; Object.keys(D.LIFE).forEach(function (c) { mor += D.LIFE[c].mor[f.lv[c]]; if (D.LIFE[c].rec) rec += D.LIFE[c].rec[f.lv[c]]; });
      if (f.fam.apoyo) mor += 0.03 * f.fam.apoyo; if (f.fam.casa) mor += 0.03;
      h.mor = U.clamp(h.mor + mor - 0.2 + 0.2 * (D.stressOver() ? -1 : 0), 0, 100);
      if (rec) h.fat = U.clamp(h.fat - rec, 0, 100);
    }
    // fundación
    if (f.fund.lv && cost >= 0) {
      f.fund.paid += D.fundCost(); var l = FP.Life && FP.Life.ensure(), s = h.soc;
      if (l) l.press.img = U.clamp(l.press.img + 0.02 * f.fund.lv, 0, 100);
      if (s) s.fame += 0.012 * f.fund.lv;
      if (h.rd) h.rd.brand = U.clamp(h.rd.brand + 0.02 * f.fund.lv, 0, 100);
      if (w - (f.fund.since || w) > 0 && (w - f.fund.since) % 52 === 51) { var n = Math.round(f.fund.lv * U.int(40, 120)); f.fund.helped += n; Hero.msg('Tu fundación ayudó este año a ' + n + ' niños y niñas.', 'ok'); }
    }
    tickInv(w);
    // comisión del asesor (anual, repartida por semana)
    if (f.adv) { var nw = D.networth(), fee = nw * D.ADV[f.adv][2] / 52; if (fee > 0) { h.money -= fee; f.fees += fee; } }
    if (w % 4 === 0) { f.hist.push([w, Math.round(D.networth())]); if (f.hist.length > 400) f.hist.splice(0, 40); }
    if (a >= 18 && !h.retired) events(w);
  };
  // gasto de vida por encima de lo que se gana: estrés (moral)
  D.stressOver = function () { var wk = D.refWage() / 52; return wk > 0 && D.weeklyLife() > wk * 0.55; };

  // ---------- decisiones: estafas, peticiones y ofertas ----------
  function events(w) {
    var h = FP.S.hero, f = D.ensure(), nw = D.networth();
    if (nw < 150 || w < f.cd.ev || R() > 0.045) return;
    f.cd.ev = w + 10;
    var kinds = ['amigo', 'familiar', 'negocio', 'estafa', 'estafa'];
    var k = U.pick(kinds), amt = Math.max(20, Math.round(Math.min(h.money, nw) * rnd(0.08, 0.28)));
    if (h.money < amt) return;
    var advLine = f.adv ? ' Tu asesor opina que conviene revisarlo.' : '';
    if (k === 'amigo') Dec.add({ kind: 'dinero', uniq: 'dn' + w, title: 'Un amigo te pide un préstamo', text: 'Un amigo de la infancia, con una deuda, te pide ' + FP.fmt.money(amt) + ' prestados y te jura que te los devolverá.', opts: [{ k: 'prestar', label: 'Prestárselo', hint: 'Mejor lo que te devuelva: suele costar caro' }, { k: 'regalo', label: 'Darle una parte como regalo (' + FP.fmt.money(Math.round(amt * 0.3)) + ')', hint: 'Menos plata, buena imagen' }, { k: 'no', label: 'Rechazar', hint: 'Sin riesgo' }], def: 'no', exp: 3, data: { t: k, a: amt } });
    else if (k === 'familiar') Dec.add({ kind: 'dinero', uniq: 'dn' + w, title: 'Un familiar necesita ayuda', text: 'Un familiar cercano atraviesa un mal momento económico y te pide ' + FP.fmt.money(Math.round(amt * 0.6)) + '.', opts: [{ k: 'ayudar', label: 'Ayudarlo', hint: '+apoyo familiar, +moral' }, { k: 'no', label: 'Decir que no', hint: 'Tu familia se resiente' }], def: 'ayudar', exp: 3, data: { t: k, a: Math.round(amt * 0.6) } });
    else if (k === 'negocio') Dec.add({ kind: 'dinero', uniq: 'dn' + w, title: 'Te ofrecen entrar a un negocio', text: 'Un conocido te propone ser socio de un negocio (' + U.pick(D.BIZ).toLowerCase() + ') con ' + FP.fmt.money(amt) + '.' + advLine, opts: [{ k: 'socio', label: 'Entrar como socio', hint: 'Mismo riesgo que un negocio propio' }, { k: 'no', label: 'Rechazar', hint: 'Sin riesgo' }].concat(f.adv ? [{ k: 'asesor', label: 'Consultar al asesor', hint: 'Revisa si conviene' }] : []), def: 'no', exp: 3, data: { t: k, a: amt } });
    else Dec.add({ kind: 'dinero', uniq: 'dn' + w, title: 'Una inversión que "no puedes perderte"', text: 'Te prometen duplicar tu dinero en pocos meses si pones ' + FP.fmt.money(amt) + '. Suena demasiado bueno.' + advLine, opts: [{ k: 'invertir', label: 'Invertir', hint: 'Alta chance de que sea una estafa' }, { k: 'no', label: 'No invertir', hint: 'Sin riesgo' }].concat(f.adv ? [{ k: 'asesor', label: 'Consultar al asesor', hint: 'Revisa si es una estafa' }] : []), def: 'no', exp: 3, data: { t: 'estafa', a: amt } });
  }
  Dec.handlers.dinero = function (k, d) {
    var h = FP.S.hero, f = D.ensure(), t = d.data.t, a = d.data.a, w = FP.S.week, l = FP.Life && FP.Life.ensure(), m = '';
    function take(x) { x = Math.min(x, h.money); h.money -= x; return x; }
    if (t === 'amigo') {
      if (k === 'prestar') { var x = take(a); if (R() < 0.3) { h.money += x; m = 'Tu amigo te devolvió el dinero.'; } else { f.lost += x; m = 'Tu amigo no te devolvió el dinero: perdiste ' + FP.fmt.money(x) + '.'; } led(w, 'dec', 'Préstamo a un amigo', -x); }
      else if (k === 'regalo') { var g = take(Math.round(a * 0.3)); f.given += g; if (l) l.press.img = U.clamp(l.press.img + 1.5, 0, 100); h.mor = U.clamp(h.mor + 2, 0, 100); m = 'Le diste ' + FP.fmt.money(g) + ': agradeció el gesto.'; led(w, 'dec', 'Regalo a un amigo', -g); }
      else { h.mor = U.clamp(h.mor - 1, 0, 100); m = 'Rechazaste el pedido.'; }
    } else if (t === 'familiar') {
      if (k === 'ayudar') { var y = take(a); f.given += y; if (l) l.fam.support = U.clamp(l.fam.support + 4, 0, 100); h.mor = U.clamp(h.mor + 3, 0, 100); m = 'Ayudaste a tu familiar con ' + FP.fmt.money(y) + '.'; led(w, 'fam', 'Ayuda a un familiar', -y); }
      else { if (l) l.fam.support = U.clamp(l.fam.support - 6, 0, 100); h.mor = U.clamp(h.mor - 3, 0, 100); m = 'Tu familiar se sintió desatendido.'; }
    } else if (t === 'negocio') {
      if (k === 'asesor') { if (R() < (f.adv === 2 ? 0.8 : 0.6)) { m = 'Tu asesor revisó el negocio: era razonable. Entras como socio.'; var r0 = D.invest('biz', a); return { ok: true, msg: m }; } m = 'Tu asesor descubrió que el negocio no era confiable. Lo rechazaste.'; }
      else if (k === 'socio') { var r1 = D.invest('biz', a); m = r1.msg; }
      else m = 'Rechazaste el negocio.';
    } else if (t === 'estafa') {
      if (k === 'asesor') { m = 'Tu asesor confirmó que era una estafa. Te ahorró ' + FP.fmt.money(a) + '.'; }
      else if (k === 'invertir') {
        var guard = f.adv === 2 ? 0.9 : f.adv === 1 ? 0.6 : 0;
        if (R() < guard) m = 'Tu asesor frenó la operación a tiempo: era una estafa.';
        else if (R() < 0.6) { var z = take(a); f.lost += z; m = 'Era una estafa: perdiste ' + FP.fmt.money(z) + '.'; led(w, 'dec', 'Estafa', -z); if (l) l.press.heat += 1; }
        else { var z2 = take(a); h.money += z2 * 1.6; f.gain += z2 * 0.6; m = 'La inversión resultó legítima: ganaste ' + FP.fmt.money(z2 * 0.6) + '.'; led(w, 'dec', 'Inversión exitosa', z2 * 0.6); }
      } else m = 'Evitaste una posible estafa.';
    }
    return { ok: true, msg: m };
  };

  // ---------- enganches ----------
  var we0 = Hero.weekEnd;
  Hero.weekEnd = function () { var r = we0.apply(this, arguments); try { D.weekly(FP.S.week); } catch (e) { if (window.console) console.warn('dinero', e); } return r; };
  var P = FP.Post; if (P && P.weekly) { var pw0 = P.weekly; P.weekly = function (w) { var r = pw0.apply(this, arguments); try { if (FP.S.hero && FP.S.hero.retired) D.weekly(w); } catch (e) { } return r; }; }
})();
