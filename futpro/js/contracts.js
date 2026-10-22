/* FUTPRO — contratos, ofertas y negociaciones.
   Amplía el sistema de ofertas existente (Market.addOffer / respond / negotiate) sin crear uno paralelo:
   términos detallados por oferta, ciclo de vida (abierta → acordada → en trámite → completada / fracasada),
   cierre de ofertas incompatibles, precontratos, cesiones con opción de compra, bonos con pago real,
   promesas de rol y sus consecuencias, renovaciones, historial contractual y libro de movimientos económicos.
   Unidades: miles de euros (igual que el resto del juego); el sueldo anual se muestra también por mes. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, M = FP.Market, Sim = FP.Sim;
  var K = FP.Contracts = {};

  K.ROLES = ['Promesa juvenil', 'Proyecto de futuro', 'Suplente', 'Rotación', 'Titular habitual', 'Jugador importante', 'Estrella del equipo'];
  var EXPECT = [0.06, 0.08, 0.14, 0.40, 0.68, 0.78, 0.86];          // minutos esperados (fracción de 90) por rol
  var WAGE_F = [0.5, 0.7, 0.8, 0.92, 1.05, 1.18, 1.32];
  K.roleIdx = function (r) { var i = K.ROLES.indexOf(r); if (i >= 0) return i; return { 'Titular': 4, 'Rotación': 3, 'Suplente': 2, 'Proyecto / suplente': 1, 'Juvenil / primer equipo': 0, 'Con minutos': 4 }[r] != null ? { 'Titular': 4, 'Rotación': 3, 'Suplente': 2, 'Proyecto / suplente': 1, 'Juvenil / primer equipo': 0, 'Con minutos': 4 }[r] : 3; };
  K.TYPES = { transfer: 1, pro: 1, renew: 1, loan: 1, semi: 1, academy: 1, precontract: 1 };
  var CONTRACT_BEARING = { transfer: 1, pro: 1, semi: 1, academy: 1, precontract: 1, loan: 1, renew: 1 };

  // ---------- estado ----------
  K.ensure = function () {
    var h = FP.S && FP.S.hero; if (!h) return null;
    if (FP.Rep) FP.Rep.ensure();
    if (!h.cx) h.cx = { hist: [], fin: [], tot: {}, paid: {}, pend: null, pre: null, conf: [], reg: [], nid: 1, cid: 1, noRenew: false, reqCd: {}, troN: null, injH: [], busy: 0 };
    return h.cx;
  };
  K.migrate = function () {
    var h = FP.S && FP.S.hero; if (!h) return;
    var cx = K.ensure();
    if (h.contract && !h.contract.cid) K.upgradeContract(h.contract);
    if (cx.troN == null) cx.troN = h.trophies.length;
    h.offers.forEach(function (o) { if (CONTRACT_BEARING[o.type] && !o.t) K.fill(o, true); });
  };
  K.upgradeContract = function (ct) {
    var S = FP.S, h = S.hero, cx = K.ensure(), club = h.club != null ? S.clubs[h.club] : null;
    ct.cid = cx.cid++; ct.kind = ct.kind || (ct.type === 'juvenil' ? 'juvenil' : ct.type === 'cesion' ? 'cesion' : ct.type === 'semi' ? 'semi' : 'prof');
    ct.startW = ct.startW != null ? ct.startW : (h.contractStartW != null ? h.contractStartW : S.week);
    if (club && ct.end != null && ct.endW == null && ct.type !== 'cesion') ct.endW = M.contractEndWeek(ct, FP.LGDEF[club.lg].cal);
    ct.status = ct.status || 'activo'; ct.bonuses = ct.bonuses || {}; ct.role = ct.role || (h.tk === 'academy' ? 'Promesa juvenil' : 'Rotación');
    K.register(ct, club ? club.id : h.team, 'contrato existente');
  };
  K.register = function (ct, clubId, how) {
    var cx = K.ensure();
    cx.reg.push({ cid: ct.cid, club: clubId, kind: ct.kind, startW: ct.startW, endW: ct.endW, wage: ct.wage || 0, wh: [[ct.startW, ct.wage || 0]], role: ct.role, release: ct.release || 0, bonuses: JSON.parse(JSON.stringify(ct.bonuses || {})), status: 'activo', how: how || '', ev: [], paid: 0, exitW: null, exitWhy: '' });
  };
  K.regOf = function (cid) { var cx = K.ensure(), i; for (i = cx.reg.length - 1; i >= 0; i--) if (cx.reg[i].cid === cid) return cx.reg[i]; return null; };

  // ---------- historial permanente ----------
  K.log = function (k, o) {
    var S = FP.S, cx = K.ensure(); if (!cx) return;
    var e = { w: S.week, k: k };
    for (var a in o) e[a] = o[a];
    cx.hist.push(e);
    if (cx.hist.length > 2500) cx.hist.splice(0, 300);
    return e;
  };
  function offerBrief(o) { var t = o.t || {}; return { type: o.type, club: o.club != null ? o.club : null, name: o.name || null, wage: t.wage != null ? t.wage : o.wage, years: t.years || o.years, role: t.role || o.role, fee: o.fee || 0 }; }

  // ---------- movimientos económicos ----------
  K.net = function (amt, kind) { var h = FP.S.hero; return h.agent && kind !== 'inversion' ? amt * (1 - h.agent.com / 100) : amt; };
  K.pay = function (amt, kind, why, extra) {
    var S = FP.S, h = S.hero, cx = K.ensure(); if (!amt) return 0;
    var net = K.net(amt, kind); h.money += net;
    var label = D.fmt(S.week).split(' ').slice(1).join(' ');
    var last = cx.fin[cx.fin.length - 1];
    if (kind === 'sueldo' && last && last.k === 'sueldo' && last.lab === label && last.club === h.club) { last.amt += net; last.gross += amt; }
    else { cx.fin.push({ w: S.week, lab: label, k: kind, amt: net, gross: amt, why: why || '', club: h.club != null ? h.club : h.team }); if (cx.fin.length > 900) cx.fin.splice(0, 100); }
    cx.tot[kind] = (cx.tot[kind] || 0) + net;
    var ct = h.contract && K.regOf(h.contract.cid); if (ct && kind !== 'sueldo') ct.paid += net;
    return net;
  };
  K.payWage = function () {
    var h = FP.S.hero; if (!h.contract || !(h.contract.wage > 0)) return;
    K.pay(h.contract.wage / 52, 'sueldo', 'Sueldo');
  };

  // ---------- situación deportiva en un club ----------
  K.situation = function (club) {
    var S = FP.S, h = S.hero, age = FP.Hero.age(), eff = h.ovr - FP.Youth.adultPenalty(age);
    var ro = (S.ro[club.id] || []).filter(function (p) { return p.i !== 0 && p.p === h.pos; }).sort(function (a, b) { return b.o - a.o; });
    var slots = h.pos === 'CB' ? 2 : 1, rank = ro.filter(function (p) { return p.o > eff; }).length;
    var top = ro.length ? ro[0].o : 38;
    return { eff: eff, ro: ro, slots: slots, rank: rank, top: top, depth: ro.length, gap: eff - top, need: ro.length < slots + 1 ? 1 : (top - eff <= 2 ? 0.7 : top - eff <= 6 ? 0.35 : 0.1) };
  };
  K.roleFor = function (club, sit, age, small) {
    var i;
    if (age <= 17 && (FP.Hero.age() <= 17)) i = sit.rank >= sit.slots + 1 ? 0 : 1;
    else if (sit.rank >= sit.slots + 2 || sit.gap < -8) i = age <= 22 ? 1 : 2;
    else if (sit.rank >= sit.slots + 1 || sit.gap < -3) i = 2;
    else if (sit.rank >= sit.slots || sit.gap < 0) i = 3;
    else i = sit.gap < 3 ? 4 : sit.gap < 7 ? 5 : 6;
    if (small && R() < 0.35) i = Math.min(6, i + 1);          // un club chico vende titularidad
    return i;
  };
  K.gamesIn = function (club) {
    var lg = FP.LGDEF[club.lg], n = FP.S.lgs[club.lg] ? FP.S.lgs[club.lg].teams.length : 16, g = lg.rr === 1 ? n - 1 : 2 * (n - 1);
    return lg.mp ? Math.min(g, lg.mp) : g;
  };
  K.injLoad = function () { var cx = K.ensure(), w = FP.S.week; return cx.injH.filter(function (e) { return w - e.w < 104; }).reduce(function (s, e) { return s + e.n; }, 0); };

  // ---------- términos de un contrato ----------
  // opts: {type, fee, free, lower, urgent, base (contrato actual), pre, loan:{months,buy}, hint}
  K.terms = function (club, o) {
    var S = FP.S, h = S.hero, age = FP.Hero.age(), lg = club ? FP.LGDEF[club.lg] : null, cw = club ? FP.DATA.countries[club.c].w : 0.3;
    var sit = club ? K.situation(club) : { eff: h.ovr, rank: 0, slots: 1, gap: 0, need: 0.5, depth: 5, top: h.ovr };
    var small = club ? (club.fin <= 4 || lg.t >= 3) : true, big = club ? (club.fin >= 8 && lg.t === 1) : false;
    var inter = h.int ? h.int.filter(function (e) { return e.v >= 45 && (!club || e.c !== club.id); }).length : 0;
    var load = K.injLoad(), ri = o.roleIdx != null ? o.roleIdx : K.roleFor(club, sit, age, small && o.type !== 'renew');
    if (big && ri > 3 && R() < 0.3) ri = Math.max(2, ri - 1);       // un club grande ofrece más dinero pero menos protagonismo
    var kind = o.type === 'semi' ? 'semi' : age < 16 ? 'formacion' : age < 18 ? 'juvenil' : 'prof';
    if (o.type === 'academy') kind = age < 16 ? 'formacion' : 'juvenil';
    if (o.type === 'pro' && age >= 16) kind = 'prof';                  // la oferta de "primer contrato profesional" (edad mínima 16) es un contrato profesional, no juvenil
    if (o.type === 'loan') kind = 'cesion';
    if (kind === 'formacion') ri = 0;                                  // los niños son "promesa": nunca estrellas ni titulares prometidos
    else if (kind === 'juvenil') ri = Math.max(0, Math.min(ri, 2));
    else if (kind === 'semi') ri = Math.max(3, Math.min(ri, 5));
    var t = { kind: kind, role: K.ROLES[ri], roleIdx: ri, state: 'abierta', free: !!o.free };
    var wage;
    if (o.base && o.type === 'renew') wage = o.base.wage;
    else if (club) wage = club.id != null ? FP.Rep.wage(club, WAGE_F[ri]) : 6;
    else wage = 6;
    var bump = 1 + (o.lower ? 0.32 : 0) + (sit.need >= 1 ? 0.12 : 0) + Math.min(0.2, inter * 0.05) + (o.urgent ? 0.1 : 0) - Math.min(0.22, load * 0.012) - (age >= 31 ? (age - 30) * 0.04 : 0);
    if (o.type === 'renew' && o.base) wage = Math.round(o.base.wage * (0.98 + 0.1 * Math.max(0, Math.min(1.6, (ri - 2) / 3)) + (o.raise || 0)));
    else wage = Math.round(wage * bump);
    if (kind === 'formacion') wage = o.type === 'academy' ? Math.round(Math.min(wage, 1 + 3 * cw)) : 0;
    if (kind === 'juvenil') wage = Math.round(Math.min(wage, 12 + 55 * cw));
    if (kind === 'cesion') wage = o.base ? o.base.wage : (h.contract ? h.contract.wage : 0);
    if (club && FP.Wages && kind !== 'cesion') wage = Math.min(wage, FP.Wages.maxOffer(club, o.type === 'renew' && o.base ? o.base.wage : 0));       // nunca más de lo que el club puede pagar
    t.wage = Math.max(0, wage);
    // duración (menores: máximo 3 años por la normativa de contratos a menores)
    var yrs = age < 18 ? U.int(1, 3) : age < 21 ? U.int(3, 5) : age < 30 ? U.int(2, 5) : age < 33 ? U.int(1, 3) : U.int(1, 2);
    if (kind === 'formacion') yrs = U.int(1, 2);
    if (kind === 'semi') yrs = U.int(1, 2);
    if (o.type === 'renew') yrs = age < 22 ? U.int(2, 4) : age < 30 ? U.int(2, 4) : U.int(1, 2);
    if (load > 40) yrs = Math.min(yrs, 2);
    t.years = Math.min(yrs, age < 18 ? 3 : 5);
    // fechas
    var w = S.week, winOpen = M.isWindow(w), startW = w + 1;
    if (o.pre) startW = o.pre;
    else if ((o.type === 'transfer' || o.type === 'pro') && !t.free && club && club.id !== h.club && !winOpen) { startW = w + 1; while (!M.isWindow(startW) && startW < w + 60) startW++; }
    t.startW = startW; var cal = club ? lg.cal : 'year';
    if (o.type === 'loan') {
      var months = (o.loan && o.loan.months) || (R() < 0.5 ? 6 : 12), s0 = winOpen ? w + 1 : startW; t.loan = { months: months, buy: o.loan && o.loan.buy != null ? o.loan.buy : (R() < 0.45 ? Math.round(M.heroValue() * (0.9 + R() * 0.5)) : 0), startW: s0, endW: s0 + Math.round(months * 4.35) };
      t.startW = s0; t.endW = t.loan.endW; t.endY = D.year(t.endW); t.years = Math.max(1, Math.round(months / 12));
    } else {
      t.endY = M.endYearOf(cal, t.years, startW); t.endW = M.contractEndWeek({ end: t.endY }, cal);
    }
    // primas
    t.signBonus = 0; t.renewBonus = 0;
    if (kind === 'prof' && o.type !== 'renew' && o.type !== 'loan') t.signBonus = Math.round(t.wage * (t.free ? 0.12 + R() * 0.14 : 0.04 + R() * 0.08));
    else if (kind === 'semi') t.signBonus = R() < 0.3 ? Math.round(t.wage * 0.05) : 0;
    if (o.type === 'renew') t.renewBonus = Math.round(t.wage * (0.07 + R() * 0.08));
    // bonos (no todos los contratos los incluyen)
    t.bonuses = {};
    if (o.base && o.type === 'renew' && o.base.bonuses) t.bonuses = JSON.parse(JSON.stringify(o.base.bonuses));       // la renovación conserva lo pactado
    else if (kind === 'prof' || kind === 'semi' || kind === 'juvenil') {
      var g = K.gamesIn(club || { lg: 'CHI1' }), grp = C.POS_GRP[h.pos], starter = ri >= 4;
      var pb = kind === 'prof' ? 1 : kind === 'semi' ? 0.5 : 0.3;
      var wk = Math.max(1, t.wage);
      if ((grp === 'F' || h.pos === 'AM') && R() < 0.85 * pb && ri >= 3) t.bonuses.goals = { n: starter ? U.int(9, 15) : U.int(4, 8), amt: Math.max(1, Math.round(wk * (0.05 + R() * 0.05))) };
      else if (h.pos === 'CM' && R() < 0.4 * pb && ri >= 3) t.bonuses.goals = { n: U.int(4, 7), amt: Math.max(1, Math.round(wk * 0.05)) };
      if ((h.pos === 'AM' || h.pos === 'LW' || h.pos === 'RW' || h.pos === 'CM') && R() < 0.6 * pb && ri >= 3) t.bonuses.assists = { n: starter ? U.int(6, 10) : U.int(3, 6), amt: Math.max(1, Math.round(wk * (0.04 + R() * 0.03))) };
      if (R() < 0.65 * pb && ri >= 2) t.bonuses.apps = { n: Math.round(g * (starter ? 0.62 + R() * 0.1 : 0.4)), amt: Math.max(1, Math.round(wk * (0.04 + R() * 0.04))) };
      if (kind === 'prof' && lg && R() < (lg.t === 1 ? 0.45 : 0.18)) t.bonuses.titles = { n: 1, amt: Math.max(1, Math.round(wk * (0.10 + R() * 0.08))) };
      if (kind === 'prof' && lg && lg.qual && R() < 0.4) t.bonuses.intl = { n: 1, amt: Math.max(1, Math.round(wk * (0.08 + R() * 0.06))) };
    }
    // cláusula de rescisión (según país, edad y tipo de contrato)
    t.release = 0;
    var pClause = { ESP: 0.9, POR: 0.55, ITA: 0.1, ENG: 0.05, FRA: 0.1, GER: 0.1 }[club ? club.c : 'CHI']; if (pClause == null) pClause = 0.2;
    if (o.type === 'renew' && o.base && o.base.release) t.release = o.base.release;
    else if (kind === 'prof' && age >= 18 && club && R() < pClause) t.release = Math.round(Math.max(t.wage * 4, M.heroValue() * (1.8 + R() * 1.7) * (age < 23 ? 1.3 : 1)));
    t.loanable = kind === 'prof' ? (ri <= 2 || age <= 23 ? R() < 0.8 : R() < 0.4) : kind !== 'formacion';
    if (o.type === 'renew' && o.base && o.base.loanable != null) t.loanable = o.base.loanable;
    // límites de negociación del club (ocultos para el jugador)
    var fin = club ? club.fin : 4, urg = (sit.need >= 1 ? 0.12 : 0) + (o.urgent ? 0.1 : 0);
    var head = 0.06 + 0.026 * fin + urg + Math.min(0.15, inter * 0.04) + (small ? -0.02 : 0.03);
    t.lim = { wage: Math.round(t.wage * (1 + head)), sign: Math.round(t.signBonus * (1 + head * 2) + t.wage * 0.04), bonus: 1 + head * 2.2, rmax: Math.min(6, ri + (small ? 1 : 1 + (urg > 0 ? 1 : 0))), ymin: kind === 'juvenil' ? 1 : 1, ymax: age < 18 ? 3 : 5, relMin: t.release ? Math.round(t.release * 0.7) : Math.round(M.heroValue() * 2.4), clause: kind === 'prof' && age >= 18 && (pClause > 0.15 || !small) };
    if (club && FP.Wages && kind !== 'cesion') t.lim.wage = Math.min(t.lim.wage, FP.Wages.maxOffer(club, o.type === 'renew' && o.base ? o.base.wage : 0));       // el máximo negociable también respeta el presupuesto del club
    if (kind === 'formacion' || kind === 'juvenil') { t.lim.rmax = Math.min(t.lim.rmax, 2); t.lim.clause = false; }
    return t;
  };

  // resumen en texto de unas condiciones
  K.monthly = function (wage) { return Math.round(wage / 12 * 10) / 10; };
  K.fmtDate = function (w) { return D.fmt(w); };
  // duración exacta entre dos fechas, en años y meses
  K.durLabel = function (a, b) {
    if (a == null || b == null) return '—';
    var m = Math.max(1, Math.round((b - a) / 4.345)), y = Math.floor(m / 12), r = m % 12;
    return (y ? y + (y === 1 ? ' año' : ' años') : '') + (y && r ? ' y ' : '') + (r ? r + (r === 1 ? ' mes' : ' meses') : '');
  };
  K.KIND = { prof: 'Contrato profesional', juvenil: 'Contrato juvenil', formacion: 'Contrato de formación', semi: 'Contrato semiprofesional', cesion: 'Cesión' };
  K.bonusLabel = function (k, b) {
    var amt = FP.fmt.money(b.amt);
    return ({ goals: 'Bono por ' + b.n + ' goles: ', assists: 'Bono por ' + b.n + ' asistencias: ', apps: 'Bono por ' + b.n + ' partidos: ', titles: 'Bono por título: ', intl: 'Bono por clasificación internacional: ' }[k] || k) + amt;
  };
  K.summary = function (o) {
    var t = o.t, club = o.club != null ? FP.S.clubs[o.club] : null, nm = club ? club.nm : (o.name || 'Un club');
    var bits = [K.KIND[t.kind] || 'Contrato', t.role.toLowerCase(), K.durLabel(t.startW, t.endW) + ' (' + K.fmtDate(t.startW) + ' – ' + (t.endW != null ? K.fmtDate(t.endW) : t.endY) + ')'];
    if (t.wage) bits.push(FP.fmt.money(K.monthly(t.wage)) + ' al mes');
    if (t.signBonus) bits.push('prima de fichaje ' + FP.fmt.money(t.signBonus));
    return nm + ': ' + bits.join(' · ') + (o.fee ? ' · traspaso ' + FP.fmt.money(o.fee) : '') + '.';
  };

  // ---------- normalización de ofertas (única puerta: Market.addOffer) ----------
  K.fill = function (o, legacy) {
    var h = FP.S.hero, club = o.club != null ? FP.S.clubs[o.club] : null, cx = K.ensure();
    var base = o.type === 'renew' ? h.contract : null;
    if (!club && o.type !== 'semi') { o.t = { kind: 'prof', role: o.role || 'Rotación', roleIdx: K.roleIdx(o.role), wage: o.wage || 0, years: o.years || 1, startW: FP.S.week + 1, endY: D.year(FP.S.week) + (o.years || 1), signBonus: 0, renewBonus: 0, bonuses: {}, release: 0, loanable: true, state: 'abierta', lim: { wage: o.wage || 0, sign: 0, bonus: 1, rmax: 3, ymin: 1, ymax: 5, relMin: 0, clause: false } }; return o; }
    var opts = { type: o.type, free: !o.fee, lower: !!o.lower, urgent: !!o.urgent, base: base, pre: o.pre || null, loan: o.loan || null, raise: o.raise || 0 };
    if (o.type === 'semi') {
      var tt = K.terms({ id: null, c: o.cc || 'CHI', fin: 3, lg: 'CHI3', st: o.st, nm: o.name }, opts);
      tt.wage = o.wage != null ? o.wage : tt.wage; tt.years = o.years || tt.years; tt.role = 'Titular habitual'; tt.roleIdx = 4; tt.kind = 'semi';
      tt.endY = D.year(FP.S.week) + tt.years; tt.endW = D.of(tt.endY, 11, 31); o.t = tt;
    } else {
      if (legacy && o.wage != null) { /* ofertas guardadas antes de este sistema conservan sueldo y rol */ }
      o.t = K.terms(club, opts);
      if (legacy && o.wage != null) { o.t.wage = o.wage; o.t.years = o.years || o.t.years; o.t.role = o.role && K.ROLES.indexOf(o.role) >= 0 ? o.role : K.ROLES[K.roleIdx(o.role)]; o.t.roleIdx = K.roleIdx(o.t.role); }
    }
    o.wage = o.t.wage; o.years = o.t.years; o.role = o.t.role; o.state = 'abierta'; o.nid = cx.nid++;
    if (o.type === 'precontract') { o.t.startW = o.pre; }
    if (o.type === 'renew' && base) o.t.keep = true;
    o.text = K.summary(o) + (o.lower ? ' Ofrece mejor sueldo, pero compite en un nivel menor.' : '') + (o.type === 'precontract' ? ' Te incorporarías cuando termine tu contrato actual.' : '');
    return o;
  };
  var addOffer0 = M.addOffer;
  M.addOffer = function (o) {
    // con un precontrato firmado no se aceptan más propuestas de contrato (solo renovación o cesión): no se generan
    if (CONTRACT_BEARING[o.type] && o.type !== 'renew' && o.type !== 'loan' && K.ensure().pre) return null;
    if (CONTRACT_BEARING[o.type] && !o.t) K.fill(o);
    if (o.t && o.exp == null) o.exp = FP.S.week + 5;
    var r = addOffer0.call(M, o);
    if (r === o) K.log('ofrecida', offerBrief(o));
    return r;
  };

  // ---------- cierre de ofertas incompatibles ----------
  var CLOSE = {
    contract: ['transfer', 'pro', 'semi', 'academy', 'amateur', 'trial', 'trial_pro', 'event', 'loan', 'renew', 'precontract'],
    renew: ['renew', 'precontract'],
    loan: ['transfer', 'pro', 'semi', 'academy', 'amateur', 'trial', 'trial_pro', 'event', 'loan', 'precontract'],
    precontract: ['transfer', 'pro', 'semi', 'academy', 'amateur', 'trial', 'trial_pro', 'event', 'loan', 'renew', 'precontract'],
    academy: ['academy', 'amateur', 'trial', 'trial_pro', 'event', 'semi', 'loan'],
    amateur: ['amateur']
  };
  K.closeIncompatible = function (done, why) {
    var h = FP.S.hero, rule = done.type === 'renew' ? CLOSE.renew : done.type === 'loan' ? CLOSE.loan : done.type === 'precontract' ? CLOSE.precontract : done.type === 'academy' ? CLOSE.academy : done.type === 'amateur' ? CLOSE.amateur : CLOSE.contract;
    var closed = [];
    h.offers = h.offers.filter(function (x) {
      if (x === done || x.id === done.id) return true;
      if (rule.indexOf(x.type) < 0) return true;
      closed.push(x); return false;
    });
    closed.forEach(function (x) { K.log('cerrada', { type: x.type, club: x.club != null ? x.club : null, name: x.name || null, why: why || 'incompatible con otra operación' }); });
    return closed;
  };
  K.pending = function () { var cx = K.ensure(); return cx.pend; };

  // ---------- cambio de contrato: apertura/cierre del registro ----------
  K.endCurrent = function (why, kindEvt) {
    var S = FP.S, h = S.hero, cx = K.ensure(), ct = h.contract;
    if (!ct || !ct.cid) return;
    var r = K.regOf(ct.cid);
    if (r && !r.exitW) { r.exitW = S.week; r.exitWhy = why; r.status = kindEvt || 'finalizado'; }
    K.log('baja', { club: h.club != null ? h.club : h.team, why: why, wage: ct.wage, cid: ct.cid });
  };
  K.applyTermsToContract = function (ct, t, o) {
    ct.cid = ct.cid || K.ensure().cid++; ct.kind = t.kind; ct.role = t.role; ct.startW = t.startW; ct.endW = t.endW; ct.end = t.endY;
    ct.wage = t.wage; ct.bonuses = JSON.parse(JSON.stringify(t.bonuses || {})); ct.release = t.release || 0; ct.loanable = t.loanable; ct.signBonus = t.signBonus || 0; ct.status = 'activo';
    ct.type = t.kind === 'juvenil' || t.kind === 'formacion' ? 'juvenil' : t.kind === 'semi' ? 'semi' : 'prof';
    return ct;
  };

  // ---------- aprobación del club actual ----------
  K.clubApproves = function (o) {
    var S = FP.S, h = S.hero, cur = h.club != null ? S.clubs[h.club] : null, buyer = S.clubs[o.club];
    if (!cur || !h.contract || !(o.fee > 0) || h.tk === 'free') return { ok: true, why: '' };
    if (h.contract.release && o.fee >= h.contract.release) return { ok: true, why: 'cláusula de rescisión pagada', clause: true };
    var val = M.heroValue(), ratio = o.fee / Math.max(1, val), role = FP.Hero.roleLabel(), left = (h.contract.endW || S.week) - S.week;
    var imp = role === 'Estrella' || role === 'Titular indiscutido';
    var p = 0.15 + (ratio - 0.8) * 1.6 + (role === 'Suplente' || role === 'Rotación' ? 0.2 : -0.1) + (buyer.st > cur.st + 4 ? 0.12 : 0) + (h.flags.transferReq ? 0.3 : 0) - (h.tk === 'academy' ? 0.1 : 0) - (imp ? 0.2 : 0) + (left < 26 ? 0.25 : 0);
    var ok = R() < U.clamp(p, 0.04, 0.95);
    return { ok: ok, why: ok ? '' : cur.nm + ' rechazó la oferta de ' + buyer.nm + (ratio < 0.9 ? ' por considerarla baja' : '') + '.' };
  };

  // ---------- aceptar / rechazar ----------
  var respond0 = M.respond;
  K.find = function (oid) { return FP.S.hero.offers.filter(function (x) { return x.id === oid; })[0]; };
  M.respond = function (oid, accept) {
    var S = FP.S, h = S.hero, cx = K.ensure(), o = K.find(oid);
    if (!o) return { ok: false, msg: 'La oferta ya no está disponible (se cerró o caducó).' };
    if (cx.busy) return { ok: false, msg: 'Hay una operación en curso: espera un momento.' };
    cx.busy = 1;
    try { return K.doRespond(o, accept); } finally { cx.busy = 0; }
  };
  K.reject = function (o, why, kind) {
    var S = FP.S, h = S.hero;
    h.offers = h.offers.filter(function (x) { return x !== o; });
    K.log(kind || 'rechazada', Object.assign(offerBrief(o), { why: why || 'rechazada por el jugador' }));
    if (CONTRACT_BEARING[o.type]) {
      if (o.type !== 'renew') h.coolUntil = S.week + U.int(5, 11);
      if (o.club != null) { var e = h.int.filter(function (x) { return x.c === o.club; })[0]; if (e) e.v = Math.max(0, e.v - 30); }
    }
    if (o.type === 'renew') h.flags.refusedRenew = true;
  };
  K.doRespond = function (o, accept) {
    var S = FP.S, h = S.hero, cx = K.ensure();
    if (!accept) { K.reject(o); return { ok: true, msg: 'Oferta rechazada.' }; }
    if (!CONTRACT_BEARING[o.type] || o.type === 'amateur') {
      // pruebas, invitaciones y clubes amateur: reglas propias del sistema anterior (no son contratos profesionales)
      var r = respond0(o.id, true);
      K.log('aceptada', Object.assign(offerBrief(o), { why: o.type === 'trial' || o.type === 'trial_pro' || o.type === 'event' ? 'prueba / invitación' : 'club amateur' }));
      if (o.type === 'amateur') K.closeIncompatible(o, 'te incorporaste a un club amateur');
      return r;
    }
    if (o.state === 'pensando') return { ok: false, msg: 'El club todavía está evaluando tu contrapropuesta.' };
    if (o.state === 'tramite') return { ok: false, msg: 'Esta operación ya está en trámite.' };
    // una operación pendiente bloquea las demás que cambiarían tu situación
    if (cx.pend && cx.pend.oid !== o.id && (o.type !== 'renew' || cx.pend.type === 'precontract')) return { ok: false, msg: 'Tienes una operación pendiente con ' + (cx.pend.name || 'otro club') + ': espera a que se resuelva antes de aceptar otra.' };
    if (cx.pre && o.type !== 'renew' && o.type !== 'loan') return { ok: false, msg: 'Ya firmaste un precontrato con ' + C.tname(cx.pre.club) + ': continúas en tu club hasta la fecha de incorporación.' };
    var t = o.t, club = o.club != null ? S.clubs[o.club] : null, age = FP.Hero.age();
    if ((o.type === 'pro' || o.type === 'transfer' || o.type === 'precontract') && age < 16) return { ok: false, msg: 'No se pueden firmar contratos profesionales antes de los 16 años.' };
    if (o.type === 'precontract') return K.signPre(o);
    if (o.type === 'renew') return K.completeNow(o, 'renovación');
    if (o.type === 'semi' || o.type === 'academy') return K.completeNow(o, o.type === 'semi' ? 'contrato semiprofesional' : 'ingreso a la cantera');
    if (o.type === 'loan') {
      var okw = M.isWindow(S.week);
      if (okw) return K.completeNow(o, 'cesión');
      o.state = 'tramite'; o.doneW = t.startW; o.exp = o.doneW + 6; cx.pend = { oid: o.id, type: 'loan', name: club.nm, doneW: o.doneW };
      K.log('acordada', Object.assign(offerBrief(o), { why: 'cesión a la espera de la apertura del mercado' }));
      return { ok: true, msg: 'Condiciones acordadas con ' + club.nm + '. La cesión se concretará el ' + K.fmtDate(o.doneW) + '.' };
    }
    // traspaso / contrato profesional: 1) condiciones personales  2) aprobación del club  3) fichaje
    var ap = K.clubApproves(o);
    if (!ap.ok) {
      K.reject(o, ap.why, 'fracasada'); h.mor = U.clamp(h.mor - 4, 0, 100);
      return { ok: false, msg: ap.why + ' Las demás ofertas siguen disponibles.' };
    }
    if (o.fee > 0 && !ap.clause && !M.isWindow(S.week)) { o.state = 'tramite'; o.doneW = t.startW; }
    else if (o.fee > 0 && !ap.clause) { o.state = 'tramite'; o.doneW = S.week + 1; }
    else { o.state = 'tramite'; o.doneW = S.week; }
    K.log('acordada', Object.assign(offerBrief(o), { why: ap.clause ? 'cláusula de rescisión pagada' : 'condiciones personales acordadas' }));
    if (o.doneW <= S.week) return K.finish(o);
    o.exp = o.doneW + 6; cx.pend = { oid: o.id, type: o.type, name: club.nm, doneW: o.doneW };
    return { ok: true, msg: 'Aceptaste las condiciones de ' + club.nm + '. El traspaso se completará el ' + K.fmtDate(o.doneW) + ' si todo sale bien (aprobación de clubes y examen médico).' };
  };
  K.completeNow = function (o, label) { o.state = 'tramite'; o.doneW = FP.S.week; return K.finish(o); };

  // ---------- precontrato ----------
  K.signPre = function (o) {
    var S = FP.S, h = S.hero, cx = K.ensure(), t = o.t, club = S.clubs[o.club];
    if (!K.preAllowed()) return { ok: false, msg: 'Aún no puedes firmar un precontrato: solo en los últimos seis meses de tu contrato.' };
    cx.pre = { club: club.id, terms: JSON.parse(JSON.stringify(t)), signedW: S.week, startW: t.startW, oid: o.id };
    h.offers = h.offers.filter(function (x) { return x !== o; });
    K.log('precontrato', Object.assign(offerBrief(o), { why: 'firmado: te incorporarás el ' + K.fmtDate(t.startW) }));
    var closed = K.closeIncompatible(o, 'firmaste un precontrato con ' + club.nm);
    FP.Hero.msg('Firmaste un precontrato con ' + club.nm + ': seguirás en ' + C.tname(h.club) + ' hasta el ' + K.fmtDate(t.startW) + '. Se cerraron ' + closed.length + ' propuestas incompatibles.', 'ok');
    FP.Sim.news(h.nm + ' firmó un precontrato con ' + club.nm + ' para la próxima temporada.', 'transfer', 2);
    h.mor = U.clamp(h.mor + 3, 0, 100);
    return { ok: true, msg: 'Precontrato firmado con ' + club.nm + '.' };
  };
  K.preAllowed = function () {
    var S = FP.S, h = S.hero, ct = h.contract; if (!ct || h.tk !== 'pro' || FP.Hero.age() < 18 || !ct.endW) return false;
    return ct.endW - S.week <= 26 && ct.endW - S.week > 0;
  };

  // ---------- concretar la operación ----------
  K.finish = function (o) {
    var S = FP.S, h = S.hero, cx = K.ensure(), t = o.t, club = o.club != null ? S.clubs[o.club] : null, res;
    if (cx.pend && cx.pend.oid === o.id) cx.pend = null;
    // una operación nunca compromete dinero que el club no tiene
    if (club && FP.Wages && (o.type === 'transfer' || o.type === 'pro' || o.type === 'renew')) {
      var prevW = o.type === 'renew' && h.contract && h.club === club.id ? h.contract.wage : 0;
      if (t.kind === 'prof' && !FP.Wages.canAfford(club, t.wage, prevW)) {
        K.reject(o, 'presupuesto salarial insuficiente', 'fracasada');
        return { ok: false, msg: club.nm + ' no tiene presupuesto salarial disponible para completar el contrato.' };
      }
    }
    // examen médico: una lesión importante o un historial pesado puede frustrar el fichaje
    if ((o.type === 'transfer' || o.type === 'pro') && club && club.id !== h.club) {
      var injW = h.inj ? h.inj.n : 0, pf = injW >= 10 ? 0.65 : injW >= 5 ? 0.2 : 0.01 + K.injLoad() * 0.0012;
      if (R() < pf) {
        K.reject(o, 'no superó el examen médico', 'fracasada');
        FP.Hero.msg(club.nm + ' canceló el fichaje tras el examen médico' + (injW ? ' (lesión en curso)' : '') + '. Las demás ofertas siguen disponibles.', 'warn');
        return { ok: false, msg: 'El fichaje con ' + club.nm + ' fracasó en el examen médico.' };
      }
    }
    h.offers = h.offers.filter(function (x) { return x !== o; });
    K.log('aceptada', Object.assign(offerBrief(o), { why: 'operación completada' }));
    if (o.type === 'renew') res = K.doRenew(o);
    else if (o.type === 'loan') res = K.doLoan(o);
    else if (o.type === 'semi') res = K.doSemi(o);
    else if (o.type === 'academy') res = K.doAcademy(o);
    else res = K.doTransfer(o);
    if (!res.ok) return res;
    var closed = K.closeIncompatible(o, 'te incorporaste a ' + (club ? club.nm : o.name));
    var nm = club ? club.nm : o.name;
    if (o.type !== 'renew') {
      var msg = (o.type === 'loan' ? 'Cesión concretada: ' : 'Fichaje concretado: ') + h.nm + ' → ' + nm + '.' + (closed.length ? ' Se cerraron ' + closed.length + ' propuestas incompatibles.' : '');
      FP.Hero.msg(msg, 'ok');
      FP.Sim.news(h.nm + (o.type === 'loan' ? ' es cedido a ' : ' ficha por ') + nm + '.', 'hero', 2);
    }
    return res;
  };
  K.doTransfer = function (o) {
    var S = FP.S, h = S.hero, t = o.t, club = S.clubs[o.club], fromName = h.club != null ? S.clubs[h.club].nm : 'agente libre';
    K.endCurrent(o.fee ? 'traspaso a ' + club.nm : (h.tk === 'free' ? 'agente libre' : 'fichaje por ' + club.nm), 'traspasado');
    FP.Hero.endSeasonStats(M.seasonLabel(), fromName);
    M.signPro(club.id, t.years, t.wage, t.role, o.fee, fromName);
    var ct = K.applyTermsToContract(h.contract, t, o); h.contract.fee = o.fee || 0;
    K.register(ct, club.id, o.fee ? 'traspaso' : 'agente libre');
    if (t.signBonus) { K.pay(t.signBonus, 'prima', 'Prima por fichaje (' + club.nm + ')'); K.log('bono', { club: club.id, kind: 'fichaje', amt: t.signBonus }); }
    K.log('alta', { club: club.id, kind: t.kind, wage: t.wage, years: t.years, fee: o.fee || 0, role: t.role, cid: ct.cid });
    K.openRole();
    return { ok: true, msg: 'Fichaste por ' + club.nm + '.' };
  };
  K.doSemi = function (o) {
    var S = FP.S, h = S.hero, t = o.t;
    K.endCurrent('fichaje semiprofesional', 'finalizado');
    var id = M.newAmateurClub(o.name, o.cc, o.st, 'semipro'); M.joinAmateur(id);
    h.contract = K.applyTermsToContract({ type: 'semi' }, t, o); h.contract.end = t.endY;
    K.register(h.contract, id, 'semiprofesional');
    if (t.signBonus) K.pay(t.signBonus, 'prima', 'Prima por fichaje (' + o.name + ')');
    K.log('alta', { club: id, kind: 'semi', wage: t.wage, years: t.years, role: t.role, cid: h.contract.cid });
    return { ok: true, msg: 'Firmaste tu contrato semiprofesional con ' + o.name + '.' };
  };
  K.doAcademy = function (o) {
    var S = FP.S, h = S.hero, t = o.t, club = S.clubs[o.club];
    K.endCurrent('cambio de academia', 'finalizado');
    M.joinAcademy(club.id, t.years);
    K.applyTermsToContract(h.contract, t, o); h.contract.type = 'juvenil';
    K.register(h.contract, club.id, 'ingreso a la cantera');
    K.log('alta', { club: club.id, kind: t.kind, wage: t.wage, years: t.years, role: t.role, cid: h.contract.cid });
    return { ok: true, msg: 'Bienvenido a las divisiones inferiores de ' + club.nm + '.' };
  };
  K.doLoan = function (o) {
    var S = FP.S, h = S.hero, t = o.t, club = S.clubs[o.club], cur = S.clubs[h.club];
    if (!cur || !h.contract) return { ok: false, msg: 'Necesitas contrato con un club para ser cedido.' };
    if (h.contract.loanable === false) { K.log('fracasada', Object.assign(offerBrief(o), { why: 'tu contrato no permite cesiones' })); return { ok: false, msg: 'Tu contrato no permite cesiones.' }; }
    var owner = h.contract, rg = K.regOf(owner.cid); if (rg) rg.ev.push([S.week, 'cedido a ' + club.nm]);
    h.loan = { from: h.club, to: club.id, ct: owner, start: S.week, end: t.loan.endW, buy: t.loan.buy || 0 };
    FP.Hero.endSeasonStats(M.seasonLabel(), cur.nm);
    h.tk = 'loan'; h.team = club.id;
    h.contract = { type: 'cesion', kind: 'cesion', wage: owner.wage, end: D.year(t.loan.endW), endW: t.loan.endW, startW: S.week, role: t.role, cid: K.ensure().cid++, status: 'cedido', ownerCid: owner.cid, bonuses: {} };
    owner.status = 'cedido';
    K.register(h.contract, club.id, 'cesión' + (t.loan.buy ? ' con opción de compra' : ''));
    M.leaveComps(); FP.Hero.ensureInRoster();
    K.log('cesion_ini', { club: club.id, from: cur.id, until: t.loan.endW, buy: t.loan.buy || 0, role: t.role });
    K.openRole();
    return { ok: true, msg: 'Cedido a ' + club.nm + ' hasta el ' + K.fmtDate(t.loan.endW) + '. Tu contrato con ' + cur.nm + ' sigue vigente.' };
  };
  K.doRenew = function (o) {
    var S = FP.S, h = S.hero, t = o.t, club = S.clubs[o.club], ct = h.contract;
    if (!ct || h.club !== o.club) return { ok: false, msg: 'Ya no tienes contrato con ese club.' };
    var old = JSON.parse(JSON.stringify(ct)), rg = K.regOf(ct.cid);
    // las condiciones no modificadas se conservan; se sustituye lo pactado en la oferta
    ct.wage = t.wage; ct.role = t.role; ct.end = t.endY; ct.endW = t.endW; ct.bonuses = JSON.parse(JSON.stringify(t.bonuses || ct.bonuses || {}));
    ct.release = t.release != null ? t.release : ct.release; ct.loanable = t.loanable != null ? t.loanable : ct.loanable; ct.renewAsked = true; ct.status = 'activo';
    if (rg) { rg.wage = ct.wage; rg.endW = ct.endW; rg.role = ct.role; rg.release = ct.release; rg.bonuses = JSON.parse(JSON.stringify(ct.bonuses)); rg.wh.push([S.week, ct.wage]); rg.ev.push([S.week, 'renovación']); }
    h.mor = U.clamp(h.mor + 8, 0, 100); h.flags.refusedRenew = false; K.ensure().noRenew = false;
    if (t.renewBonus) { K.pay(t.renewBonus, 'prima', 'Prima por renovación (' + club.nm + ')'); K.log('bono', { club: club.id, kind: 'renovación', amt: t.renewBonus }); }
    K.log('renovacion', { club: club.id, wage: ct.wage, was: old.wage, until: ct.endW, role: ct.role });
    FP.Hero.msg('Renovaste con ' + club.nm + ' hasta el ' + K.fmtDate(ct.endW) + ' (' + FP.fmt.money(K.monthly(ct.wage)) + ' al mes).', 'ok');
    FP.Sim.news(h.nm + ' renueva con ' + club.nm + '.', 'hero', 1);
    K.openRole();
    return { ok: true, msg: 'Renovaste con ' + club.nm + '.' };
  };

  // ---------- procesos semanales: trámites, expiración, precontratos, cesiones ----------
  K.weekly = function (w) {
    var S = FP.S, h = S.hero, cx = K.ensure(); if (!h || h.retired) return;
    if (cx.troN == null) cx.troN = h.trophies.length;
    // 1) operaciones en trámite
    if (cx.pend) {
      var o = K.find(cx.pend.oid);
      if (!o) cx.pend = null;
      else if (w >= o.doneW) K.finish(o);
    }
    // 2) ofertas en "pensando"
    h.offers.slice().forEach(function (o) { if (o.state === 'pensando' && w >= o.answerW) K.answerThinking(o); });
    // 2b) un club puede retirarse si ya cubrió su necesidad en esa posición
    h.offers = h.offers.filter(function (o) {
      if ((o.type !== 'transfer' && o.type !== 'pro') || o.state !== 'abierta' || o.club == null || w - o.w < 2 || R() > 0.03) return true;
      var f = FP.Rep.fit(S.clubs[o.club]); if (f.need >= 0.35) return true;
      K.log('retirada', Object.assign(offerBrief(o), { why: 'el club cubrió su necesidad en tu posición' })); FP.Hero.msg(C.tname(o.club) + ' retiró su oferta: ya cubrió tu posición.', 'i'); return false;
    });
    // 3) caducidad (las que están en trámite no caducan)
    h.offers = h.offers.filter(function (o) {
      if (o.state === 'tramite' || o.exp == null || o.exp >= w) return true;
      K.log('caducada', offerBrief(o)); FP.Hero.msg('La oferta de ' + (o.club != null ? C.tname(o.club) : o.name || 'un club') + ' ha caducado.', 'i'); return false;
    });
    // 4) precontrato: llegada a la fecha de incorporación
    if (cx.pre && w >= cx.pre.startW) K.joinPre();
    // 5) vencimiento y cesiones
    K.expiry(w);
    // 6) bonos y rol
    K.bonusWeekly(w); K.roleWeekly(w);
  };
  K.joinPre = function () {
    var S = FP.S, h = S.hero, cx = K.ensure(), p = cx.pre; cx.pre = null;
    var club = S.clubs[p.club], t = p.terms;
    if (club && FP.Wages && p.terms && p.terms.kind === 'prof' && !FP.Wages.canAfford(club, p.terms.wage)) {
      K.log('fracasada', { club: club.id, wage: p.terms.wage, why: 'presupuesto insuficiente al comienzo del precontrato' });
      FP.Hero.msg(club.nm + ' no puede inscribir tu precontrato porque ya no tiene margen salarial.', 'warn');
      return;
    }
    var o = { id: -1, type: 'transfer', club: club.id, fee: 0, t: t, wage: t.wage, years: t.years, role: t.role };
    if (h.tk === 'loan') M.endLoan();
    if (h.contract) K.endCurrent('fin de contrato (precontrato con ' + club.nm + ')', 'finalizado');
    var left = h.contract;
    if (h.tk !== 'free') { FP.Hero.endSeasonStats(M.seasonLabel(), C.tname(h.club)); h.tk = 'free'; h.contract = null; }
    t.startW = S.week; var cal = FP.LGDEF[club.lg].cal; t.endY = M.endYearOf(cal, t.years, S.week); t.endW = M.contractEndWeek({ end: t.endY }, cal);
    M.signPro(club.id, t.years, t.wage, t.role, 0, 'precontrato');
    var ct = K.applyTermsToContract(h.contract, t, o); K.register(ct, club.id, 'precontrato');
    if (t.signBonus) K.pay(t.signBonus, 'prima', 'Prima por fichaje (' + club.nm + ')');
    K.log('alta', { club: club.id, kind: t.kind, wage: t.wage, years: t.years, role: t.role, cid: ct.cid, how: 'precontrato' });
    FP.Hero.msg('Te incorporas a ' + club.nm + ' según tu precontrato.', 'ok'); FP.Sim.news(h.nm + ' se incorpora a ' + club.nm + '.', 'hero', 2);
    K.openRole();
  };
  K.expiry = function (w) {
    var S = FP.S, h = S.hero, cx = K.ensure(), ct = h.contract;
    if (h.tk === 'loan' && h.loan && w >= h.loan.end) { K.endLoanFlow(); return; }
    if (!ct || ct.endW == null) return;
    if (h.tk === 'pro' && w >= ct.endW) {                 // contrato profesional vencido: salida como agente libre (el sistema anterior hacía lo mismo)
      if (cx.pre) return;                                 // lo recoge joinPre
      K.endCurrent('contrato vencido', 'finalizado'); FP.Hero.msg('Tu contrato con ' + C.tname(h.club) + ' ha vencido. Eres agente libre.', 'warn');
      h.offers = h.offers.filter(function (o) { if (o.type === 'renew') { K.log('caducada', offerBrief(o)); return false; } return true; });
      M.release('Contrato vencido'); return;
    }
    if (h.tk === 'academy' && w > ct.endW + 0 && ct.type === 'juvenil') {   // vínculo juvenil vencido sin renovar
      K.endCurrent('vínculo juvenil vencido', 'finalizado');
      ct.endW = null; ct.end = ct.end;                                    // la evaluación de fin de temporada decide la continuidad
    }
  };
  K.endLoanFlow = function () {
    var S = FP.S, h = S.hero, l = h.loan; if (!l) return;
    var loanCt = h.contract, rg = K.regOf(loanCt ? loanCt.cid : -1), club = S.clubs[l.to], parent = S.clubs[l.from];
    var ss = h.season, avg = ss.rn ? ss.rs / ss.rn : 6, played = ss.ap >= 8;
    if (l.buy > 0 && played && avg >= 6.7 && R() < 0.55) {      // el club ejerce la opción de compra
      if (rg) { rg.exitW = S.week; rg.exitWhy = 'opción de compra'; rg.status = 'finalizado'; }
      K.log('cesion_fin', { club: l.to, from: l.from, why: 'opción de compra ejercida por ' + club.nm, buy: l.buy });
      var oc = K.regOf(l.ct.cid); if (oc) { oc.exitW = S.week; oc.exitWhy = 'traspaso definitivo a ' + club.nm; oc.status = 'traspasado'; }
      h.tk = 'loan'; h.loan = null;
      var t = K.terms(club, { type: 'transfer', free: false });
      FP.Hero.endSeasonStats(M.seasonLabel(), club.nm + ' (cedido)');
      h.tk = 'free'; h.contract = null;
      M.signPro(club.id, t.years, t.wage, t.role, l.buy, parent.nm);
      var ct = K.applyTermsToContract(h.contract, t, null); K.register(ct, club.id, 'opción de compra');
      K.log('alta', { club: club.id, kind: t.kind, wage: t.wage, years: t.years, fee: l.buy, role: t.role, cid: ct.cid, how: 'opción de compra' });
      K.log('traspaso', { club: club.id, from: parent.id, fee: l.buy });
      FP.Hero.msg(club.nm + ' ejerció la opción de compra por ' + FP.fmt.money(l.buy) + ': fichas definitivamente.', 'ok');
      FP.Sim.news(h.nm + ' queda definitivamente en ' + club.nm + ' tras su cesión.', 'hero', 2);
      return;
    }
    if (rg) { rg.exitW = S.week; rg.exitWhy = 'fin de la cesión'; rg.status = 'finalizado'; }
    K.log('cesion_fin', { club: l.to, from: l.from, why: 'regreso al club propietario' });
    var owner = l.ct; if (owner) owner.status = 'activo';
    M.endLoan();
    if (h.contract && h.contract.endW != null && S.week >= h.contract.endW) { /* el contrato del club propietario venció durante la cesión: lo gestiona K.expiry */ }
    K.openRole();
  };

  // ---------- bonos con pago real ----------
  K.bonusWeekly = function (w) {
    var S = FP.S, h = S.hero, cx = K.ensure(), ct = h.contract;
    if (!ct || !ct.bonuses || h.tk !== 'pro' || !ct.cid) { cx.troN = h.trophies.length; return; }
    var sk = M.seasonLabel(), ss = h.season, club = C.tname(h.club);
    function once(key, amt, why, kind) { var pk = ct.cid + '|' + sk + '|' + key; if (cx.paid[pk]) return; cx.paid[pk] = w; K.pay(amt, 'bono', why); K.log('bono', { club: h.club, kind: kind, amt: amt, why: why, cid: ct.cid }); FP.Hero.msg('Cobras un bono: ' + why + ' (' + FP.fmt.money(K.net(amt, 'bono')) + ').', 'ok'); }
    var b = ct.bonuses;
    if (b.goals && ss.g >= b.goals.n) once('goals', b.goals.amt, 'Bono por ' + b.goals.n + ' goles', 'goles');
    if (b.assists && ss.a >= b.assists.n) once('assists', b.assists.amt, 'Bono por ' + b.assists.n + ' asistencias', 'asistencias');
    if (b.apps && ss.ap >= b.apps.n) once('apps', b.apps.amt, 'Bono por ' + b.apps.n + ' partidos disputados', 'partidos');
    // títulos: cada trofeo nuevo de clubes (no de selecciones) se paga una sola vez
    while (cx.troN < h.trophies.length) {
      var tr = h.trophies[cx.troN]; cx.troN++;
      if (!tr || tr.sub || tr.nt || tr.preset) continue;
      if (b.titles && !(tr.nm || '').match(/Juvenil|regional/i)) { var pk = ct.cid + '|t|' + tr.w + '|' + tr.nm; if (!cx.paid[pk]) { cx.paid[pk] = w; K.pay(b.titles.amt, 'bono', 'Bono por título: ' + tr.nm); K.log('bono', { club: h.club, kind: 'título', amt: b.titles.amt, why: tr.nm, cid: ct.cid }); FP.Hero.msg('Cobras el bono por el título: ' + tr.nm + '.', 'ok'); } }
    }
  };
  K.onLeagueClosed = function (comp, entry) {
    var S = FP.S, h = S.hero; if (!h || h.retired || h.tk !== 'pro' || !h.contract || !h.contract.bonuses || !h.contract.bonuses.intl) return;
    var def = FP.LGDEF[comp.lg], slots = def.qual ? Object.keys(def.qual).reduce(function (s, k) { return s + def.qual[k]; }, 0) : 0;
    if (!slots || comp.teams.indexOf(h.team) < 0) return;
    var pos = entry.tab.indexOf(h.team) + 1;
    if (pos > 0 && pos <= slots) { var cx = K.ensure(), ct = h.contract, pk = ct.cid + '|' + comp.label + '|intl'; if (cx.paid[pk]) return; cx.paid[pk] = S.week; K.pay(ct.bonuses.intl.amt, 'bono', 'Bono por clasificación internacional (' + comp.label + ')'); K.log('bono', { club: h.club, kind: 'clasificación internacional', amt: ct.bonuses.intl.amt, cid: ct.cid }); FP.Hero.msg('Tu club se clasificó a una copa internacional: cobras el bono pactado.', 'ok'); }
  };
  var olc = Sim.onLeagueClosed;
  Sim.onLeagueClosed = function (comp, entry) { if (olc) olc(comp, entry); K.onLeagueClosed(comp, entry); };

  // ---------- promesas de rol y consecuencias ----------
  K.openRole = function () { var cx = K.ensure(); cx.role = { since: FP.S.week, evt: 0, lastW: FP.S.week, lvl: 0 }; };
  // minutos reales de los partidos de club desde que rige el contrato (se excluyen lesión y suspensión)
  K.roleStatus = function () {
    var S = FP.S, h = S.hero, ct = h.contract; if (!ct || (h.tk !== 'pro' && h.tk !== 'loan')) return null;
    var cx = K.ensure(), since = Math.max(ct.startW || 0, cx.role ? cx.role.since : 0);
    var ms = h.log.filter(function (m) { return m.w >= since && (m.k === 'liga' || m.k === 'copa' || m.k === 'cont') && !m.why; }).slice(0, 14);
    var n = ms.length, actual = n ? ms.reduce(function (s, m) { return s + (m.min || 0); }, 0) / (90 * n) : null;
    var ri = K.roleIdx(ct.role), exp = EXPECT[ri];
    return { n: n, actual: actual, expected: exp, deficit: actual == null ? 0 : exp - actual, role: ct.role, ri: ri };
  };
  K.roleWeekly = function (w) {
    var S = FP.S, h = S.hero, cx = K.ensure(); if (!cx.role || !h.contract) return;
    var st = K.roleStatus(); if (!st || st.n < 6) return;
    var r = cx.role;
    if (st.deficit < 0.1 && r.lvl > 0) { K.log('conflicto', { club: h.club, state: 'resuelto', why: 'tus minutos se normalizaron' }); FP.Hero.msg('Tus minutos se normalizaron: el rol de ' + st.role.toLowerCase() + ' se está cumpliendo.', 'ok'); r.lvl = 0; return; }
    if (st.ri <= 2 || st.deficit < 0.25) return;                 // solo cuenta una promesa de protagonismo incumplida
    var club = C.tname(h.club), sit = K.situation(S.clubs[h.team]), gapw = w - r.lastW;
    if (r.lvl === 0 && st.n >= 6) {
      r.lvl = 1; r.lastW = w; K.log('conflicto', { club: h.club, state: 'aviso', why: 'conversación con el entrenador por minutos' });
      FP.Hero.msg('El entrenador te cita: te prometieron ' + st.role.toLowerCase() + ' pero juegas ' + Math.round(st.actual * 100) + '% de los minutos' + (sit.rank >= 1 ? ' (hay ' + sit.rank + ' jugador(es) de tu puesto por delante)' : '') + '. Puedes hablar con él desde Contratos.', 'warn');
    } else if (r.lvl === 1 && st.n >= 10 && gapw >= 8) {
      r.lvl = 2; r.lastW = w; K.log('conflicto', { club: h.club, state: 'escalado', why: 'reclamo a la directiva disponible' });
      h.mor = U.clamp(h.mor - 4, 0, 100); FP.Hero.msg('La situación persiste: tu rol prometido no se cumple. Puedes reclamar a la directiva, pedir cesión, pedir traspaso o renegociar tu rol.', 'warn');
    } else if (r.lvl === 2 && st.n >= 14 && gapw >= 10) {
      r.lvl = 3; r.lastW = w; K.log('conflicto', { club: h.club, state: 'conflicto contractual', why: 'pérdida de confianza por promesa incumplida' });
      h.mor = U.clamp(h.mor - 6, 0, 100); h.ct = U.clamp((h.ct == null ? 50 : h.ct) - 8, 5, 99); h.flags.transferReq = h.flags.transferReq || R() < 0.5;
      FP.Hero.msg('Conflicto contractual: pierdes la confianza en el club. Es momento de decidir tu futuro.', 'warn');
    }
  };
  // acciones del jugador ante un rol incumplido
  K.roleAction = function (kind) {
    var S = FP.S, h = S.hero, cx = K.ensure(), st = K.roleStatus(), ct = h.contract; if (!st || !ct) return { ok: false, msg: 'No hay contrato vigente.' };
    var sit = K.situation(S.clubs[h.team]), r = cx.role || (cx.role = { since: S.week, lvl: 0, lastW: S.week });
    if (kind === 'coach') {
      if (sit.rank === 0 && sit.gap >= -1) { h.ct = U.clamp((h.ct == null ? 50 : h.ct) + 10, 5, 99); r.lastW = S.week; K.log('conflicto', { club: h.club, state: 'conversación', why: 'el entrenador te dará más minutos' }); return { ok: true, msg: 'El entrenador reconoce que mereces jugar más y te dará minutos.' }; }
      h.mor = U.clamp(h.mor - 2, 0, 100); K.log('conflicto', { club: h.club, state: 'conversación', why: 'el entrenador prefiere a los demás' });
      return { ok: false, msg: 'El entrenador te responde que hay ' + sit.rank + ' jugador(es) de tu puesto por delante y que debes mejorar tu nivel.' };
    }
    if (kind === 'board') {
      if (st.deficit >= 0.3 && r.lvl >= 1) {
        var opt = R() < 0.5 ? 'raise' : 'loan';
        if (opt === 'raise') { ct.wage = Math.round(ct.wage * 1.08); var rg = K.regOf(ct.cid); if (rg) { rg.wage = ct.wage; rg.wh.push([S.week, ct.wage]); } K.log('conflicto', { club: h.club, state: 'compensación', why: 'la directiva mejora tu sueldo' }); h.mor = U.clamp(h.mor + 3, 0, 100); r.lastW = S.week; return { ok: true, msg: 'La directiva reconoce el incumplimiento y mejora tu sueldo un 8%.' }; }
        ct.loanable = true; K.log('conflicto', { club: h.club, state: 'compensación', why: 'la directiva facilita una cesión' }); h.flags.transferReq = true; return { ok: true, msg: 'La directiva acepta estudiar tu salida: facilitará una cesión o traspaso.' };
      }
      h.ct = U.clamp((h.ct == null ? 50 : h.ct) - 5, 5, 99); return { ok: false, msg: 'La directiva considera que todavía no hay incumplimiento y se molesta con el reclamo.' };
    }
    if (kind === 'role') {
      var ri = Math.max(0, Math.min(st.ri, Math.round(st.actual != null ? (st.actual > 0.55 ? 4 : st.actual > 0.3 ? 3 : 2) : 3)));
      ct.role = K.ROLES[ri]; var rg2 = K.regOf(ct.cid); if (rg2) { rg2.role = ct.role; rg2.ev.push([S.week, 'rol renegociado: ' + ct.role]); }
      cx.role = { since: S.week, evt: 0, lastW: S.week, lvl: 0 }; K.log('conflicto', { club: h.club, state: 'rol renegociado', why: 'nuevo rol: ' + ct.role });
      h.mor = U.clamp(h.mor + 2, 0, 100); return { ok: true, msg: 'Acordaste un rol realista: ' + ct.role + '.' };
    }
    return { ok: false, msg: 'Acción no disponible.' };
  };

  // ---------- renovaciones ----------
  K.importance = function () {
    var S = FP.S, h = S.hero, club = S.clubs[h.club]; if (!club) return 0;
    var role = FP.Hero.roleLabel(), base = { 'Estrella': 1, 'Titular indiscutido': 0.85, 'Titular': 0.65, 'Rotación': 0.4, 'Suplente': 0.15 }[role]; if (base == null) base = 0.4;
    var age = FP.Hero.age(), pot = M.potEst();
    if (age <= 22 && pot >= club.st + 3) base = Math.max(base, 0.6);
    if (age >= 33) base *= 0.7;
    return base;
  };
  K.makeRenew = function (mods) {
    var S = FP.S, h = S.hero, club = S.clubs[h.club], ct = h.contract; if (!club || !ct) return null;
    h.offers = h.offers.filter(function (x) { if (x.type === 'renew') { K.log('retirada', Object.assign(offerBrief(x), { why: 'reemplazada por una nueva propuesta' })); return false; } return true; });
    var o = { type: 'renew', club: club.id, years: 0, wage: 0, raise: mods && mods.raise || 0, urgent: mods && mods.urgent, exp: Math.min((ct.endW || S.week + 20) - 1, S.week + 8) };
    var ri = mods && mods.roleIdx != null ? mods.roleIdx : null;
    M.addOffer(o);
    if (ri != null) { o.t.roleIdx = ri; o.t.role = K.ROLES[ri]; o.role = o.t.role; }
    if (mods && mods.bonuses) { Object.keys(mods.bonuses).forEach(function (k) { o.t.bonuses[k] = mods.bonuses[k]; }); }
    if (mods && mods.clause) { o.t.release = Math.round(Math.max(o.t.wage * 4, M.heroValue() * 2.3)); }
    o.text = K.summary(o) + ' Conserva las demás condiciones de tu contrato actual.';
    return o;
  };
  K.request = function (kind) {
    var S = FP.S, h = S.hero, cx = K.ensure(), ct = h.contract, club = S.clubs[h.club]; if (!ct || !club || h.tk !== 'pro') return { ok: false, msg: 'Solo disponible con contrato profesional vigente.' };
    if ((cx.reqCd[kind] || 0) > S.week) return { ok: false, msg: 'Ya hiciste esta solicitud hace poco: el club pide esperar unas semanas.' };
    var left = (ct.endW || S.week) - S.week, imp = K.importance(), mkt = FP.Rep.wage(club, 1.05), st = K.roleStatus();
    function deny(m) { cx.reqCd[kind] = S.week + 20; K.log('rechazada', { type: 'solicitud', club: club.id, why: m }); return { ok: false, msg: m }; }
    if (kind === 'raise') {
      if (ct.wage < mkt * 0.9 && imp >= 0.4) { var o = K.makeRenew({ raise: 0.12 }); K.log('aceptada', { type: 'solicitud', club: club.id, why: 'aumento salarial: el club presenta una propuesta' }); return { ok: true, msg: club.nm + ' acepta estudiar tu pedido y te presenta una propuesta de ampliación.' }; }
      return deny(club.nm + ' considera que tu sueldo ya es acorde a tu rendimiento e importancia.');
    }
    if (kind === 'early') {
      if (left > 104) return deny('Falta demasiado para el fin de tu contrato: el club prefiere esperar.');
      if (imp >= 0.35) { K.makeRenew({}); return { ok: true, msg: club.nm + ' abre la negociación de una renovación anticipada.' }; }
      return deny(club.nm + ' no tiene prisa por renovarte.');
    }
    if (kind === 'role') {
      var want = Math.min(6, K.roleIdx(ct.role) + 1);
      if (st && st.actual != null && st.actual >= EXPECT[want] - 0.08 && imp >= 0.5) { K.makeRenew({ roleIdx: want, raise: 0.04 }); return { ok: true, msg: 'El club reconoce tu aporte y propone un rol de ' + K.ROLES[want].toLowerCase() + '.' }; }
      return deny('El club no ve que tu rendimiento y tus minutos justifiquen una mejora de rol.');
    }
    if (kind === 'bonus') {
      if (club.fin >= 5 && imp >= 0.4) { var g = { goals: null }; var b = {}; var starter = K.roleIdx(ct.role) >= 4; if (!ct.bonuses.apps) b.apps = { n: Math.round(K.gamesIn(club) * (starter ? 0.62 : 0.4)), amt: Math.max(1, Math.round(ct.wage * 0.06)) }; if (!ct.bonuses.titles && FP.LGDEF[club.lg].t === 1) b.titles = { n: 1, amt: Math.max(1, Math.round(ct.wage * 0.12)) }; if (!Object.keys(b).length) return deny('Tu contrato ya incluye los bonos que el club está dispuesto a dar.'); K.makeRenew({ bonuses: b }); return { ok: true, msg: 'El club propone incorporar bonos a tu contrato.' }; }
      return deny('El presupuesto del club no permite añadir bonos por ahora.');
    }
    if (kind === 'clause') {
      if (imp < 0.8 && club.fin >= 4 && R() < 0.65) { K.makeRenew({ clause: true }); return { ok: true, msg: 'El club acepta incluir una cláusula de salida.' }; }
      return deny('El club no está dispuesto a fijar una cláusula de salida.');
    }
    if (kind === 'refuse') {
      cx.noRenew = true;
      h.offers = h.offers.filter(function (x) { if (x.type === 'renew') { K.log('rechazada', Object.assign(offerBrief(x), { why: 'te negaste a renovar' })); return false; } return true; });
      if (imp >= 0.6 && left < 60) FP.Hero.msg(club.nm + ' se preocupa: eres importante y tu contrato termina pronto. Podrían ofrecerte mejores condiciones o venderte.', 'warn');
      else FP.Hero.msg('Comunicaste que no renovarás. ' + club.nm + ' lo tendrá en cuenta.', 'i');
      K.log('conflicto', { club: club.id, state: 'sin renovación', why: 'el jugador se niega a renovar' });
      return { ok: true, msg: 'Informaste que no renovarás. Esperas ofertas de otros clubes.' };
    }
    return { ok: false, msg: 'Solicitud no reconocida.' };
  };
  // el club inicia renovaciones y se preocupa por jugadores importantes próximos a vencer
  K.contractWatch = function (w) {
    var S = FP.S, h = S.hero, cx = K.ensure(), ct = h.contract; if (!ct) return;
    var club = S.clubs[h.club]; if (!club) return;
    if (ct.cid == null) K.upgradeContract(ct);
    if (ct.endW == null) ct.endW = M.contractEndWeek(ct, FP.LGDEF[club.lg].cal);
    var left = ct.endW - w;
    if (h.tk !== 'pro' || cx.noRenew) { if (cx.noRenew && left <= 26 && K.importance() >= 0.6 && !ct.worry) { ct.worry = 1; FP.Hero.msg(club.nm + ' está preocupado: un jugador importante termina contrato sin renovar.', 'warn'); } return; }
    var imp = K.importance(), has = h.offers.some(function (o) { return o.type === 'renew'; });
    if (left <= 52 && left > 0 && !ct.renewAsked && !has && imp >= 0.4) {
      ct.renewAsked = true; var o = K.makeRenew({ urgent: left <= 26 });
      if (o) FP.Hero.msg(club.nm + ' quiere renovar tu contrato: revisa la propuesta en Contratos.', 'ok');
    } else if (left <= 26 && left > 0 && !ct.renewAsked2 && !has && imp >= 0.6 && !h.flags.refusedRenew) {
      ct.renewAsked2 = true; K.makeRenew({ urgent: true, raise: 0.08 });
      FP.Hero.msg(club.nm + ' mejora su oferta de renovación: no quiere perderte.', 'ok');
    } else if (left <= 26 && left > 0 && !ct.renewAsked && !has && imp < 0.4) {
      ct.renewAsked = true; FP.Hero.msg(club.nm + ' no tiene previsto renovarte. Tu contrato termina pronto: busca opciones.', 'warn');
    }
    // precontratos: clubes interesados en tus últimos seis meses
    if (K.preAllowed() && !cx.pre && !h.offers.some(function (o) { return o.type === 'precontract'; }) && R() < 0.3) K.preOffers();
  };
  K.preOffers = function () {
    var S = FP.S, h = S.hero, ct = h.contract, age = FP.Hero.age(), made = 0;
    var list = h.int.filter(function (e) { return e.v >= 40 && (h.cd[e.c] || 0) <= S.week && e.c !== h.club; }).sort(function (a, b) { return b.v - a.v; });
    list.forEach(function (e) {
      if (made >= 2) return; var club = S.clubs[e.c]; if (!club) return;
      if (!FP.Rep.exposure(club).ok || !FP.Rep.foreignOK(club, h.nat, age) || !FP.Rep.permit(club)) return;
      var f = FP.Rep.fit(club); if (f.kind === 'none' || !f.ok || f.kind === 'academy') return;
      if (!FP.Rep.lowerGate(club) || !FP.Rep.offerGate(club, f, { pre: true })) return;       // mismos criterios que las ofertas de traspaso: nivel, sueldo, minutos, liga y situación contractual
      if (R() > (e.v - 30) / 70) return; made++;
      M.addOffer({ type: 'precontract', club: club.id, fee: 0, pre: ct.endW + 1, exp: ct.endW - 2, why: e.why });
    });
    return made;
  };

  // ---------- negociación (amplía M.negotiate) ----------
  // counter: {wage, years, signBonus, bonuses:{tipo:{n,amt}|null}, release:(0|n), role, loanable}
  K.negotiate = function (oid, counter) {
    var S = FP.S, h = S.hero, cx = K.ensure(), o = K.find(oid);
    if (!o || !o.t) return { ok: false, msg: 'No se puede negociar esta oferta.' };
    if (o.state === 'tramite') return { ok: false, msg: 'La operación ya está en trámite.' };
    if (o.state === 'pensando') return { ok: false, msg: 'El club todavía responde a tu contrapropuesta.' };
    if (o.neg >= 3) return { ok: false, msg: 'El club ya hizo su última propuesta: acepta o rechaza.' };
    var t = o.t, L = t.lim, club = o.club != null ? S.clubs[o.club] : null, nm = club ? club.nm : (o.name || 'El club');
    o.neg = (o.neg || 0) + 1; o.agg = o.agg || 0;
    var ask = JSON.parse(JSON.stringify(t)), over = 0, stretch = 0, items = 0;
    function rel(a, base, lim) { if (a <= base) return 0; var span = Math.max(1, lim - base); return (a - base) / span; }
    if (counter.wage != null) { ask.wage = Math.max(0, Math.round(counter.wage)); var r = rel(ask.wage, t.wage, L.wage); over = Math.max(over, r - 1); stretch += Math.min(r, 1); items++; }
    if (counter.years != null) { ask.years = U.clamp(counter.years, 1, 5); if (ask.years > L.ymax || ask.years < L.ymin) over = Math.max(over, 0.5); if (ask.years !== t.years) { stretch += 0.4; items++; } }
    if (counter.signBonus != null) { ask.signBonus = Math.max(0, Math.round(counter.signBonus)); var r2 = rel(ask.signBonus, t.signBonus, L.sign); over = Math.max(over, r2 - 1); stretch += Math.min(r2, 1); items++; }
    if (counter.bonuses) {
      Object.keys(counter.bonuses).forEach(function (k) {
        var b = counter.bonuses[k]; if (b === null) { delete ask.bonuses[k]; return; }
        var cur = t.bonuses[k], base = cur ? cur.amt : 0; ask.bonuses[k] = b; var r3 = b.amt > base ? (b.amt - base) / Math.max(1, base * (L.bonus - 1) + (cur ? 0 : t.wage * 0.1)) : 0;
        if (!cur && !L.clause && false) over = Math.max(over, 0.3);
        over = Math.max(over, r3 - 1); stretch += Math.min(r3, 1); items++;
      });
    }
    if (counter.release != null) {
      if (counter.release === 0) delete ask.release, ask.release = 0;
      else { ask.release = counter.release; if (!L.clause) over = Math.max(over, 0.6); else if (counter.release < L.relMin) over = Math.max(over, (L.relMin - counter.release) / L.relMin); stretch += 0.5; items++; }
    }
    if (counter.role) { ask.roleIdx = K.roleIdx(counter.role); ask.role = K.ROLES[ask.roleIdx]; if (ask.roleIdx > L.rmax) over = Math.max(over, 0.4 + 0.3 * (ask.roleIdx - L.rmax)); else if (ask.roleIdx > t.roleIdx) { stretch += 0.4; items++; } }
    if (counter.loanable != null) ask.loanable = !!counter.loanable;
    if (!items && !counter.loanable && counter.loanable !== false) { o.neg--; return { ok: false, msg: 'No cambiaste ninguna condición.' }; }
    var dec = 'accept';
    if (over > 0.8) dec = 'withdraw';
    else if (over > 0.35) dec = R() < 0.35 ? 'wait' : 'counter';
    else if (over > 0) dec = 'counter';
    else if (stretch > 1.4 + (L.rmax >= 5 ? 0.3 : 0)) dec = 'counter';
    if (o.neg >= 3 && dec === 'counter') dec = over > 0 ? 'withdraw' : 'accept';
    if (dec === 'counter' || dec === 'wait') o.agg += over > 0 ? 1 : 0;
    if (dec === 'withdraw' || (o.agg >= 3 && dec !== 'accept')) {
      var pw = 0.55 + 0.2 * (o.agg || 0); if (dec === 'withdraw' || R() < pw) {
        h.offers = h.offers.filter(function (x) { return x !== o; });
        K.log('retirada', Object.assign(offerBrief(o), { why: 'retiró la oferta por exigencias excesivas' }));
        if (o.club != null) { h.cd[o.club] = S.week + 26; var e = h.int.filter(function (x) { return x.c === o.club; })[0]; if (e) e.v = 0; }
        h.mor = U.clamp(h.mor - 2, 0, 100);
        FP.Hero.msg(nm + ' retiró su oferta: consideró excesivas tus exigencias.', 'warn');
        return { ok: false, result: 'withdraw', msg: nm + ' se retira de la negociación: tus exigencias fueron excesivas. No volverá a ofertarte en unos meses.' };
      }
    }
    if (dec === 'wait') {
      o.state = 'pensando'; o.pending = ask; o.answerW = S.week + U.int(1, 2); o.exp = Math.max(o.exp || 0, o.answerW + 3);
      K.log('negociacion', Object.assign(offerBrief(o), { why: 'el club pidió tiempo para evaluar tu contrapropuesta' }));
      return { ok: true, result: 'wait', msg: nm + ' pide tiempo para evaluar tu contrapropuesta (respuesta en ' + (o.answerW - S.week) + ' semana(s)).' };
    }
    if (dec === 'counter') {
      // el club mueve cada punto hasta su límite o a mitad de camino
      var ct = JSON.parse(JSON.stringify(ask));
      if (ct.wage > L.wage) ct.wage = L.wage; else ct.wage = Math.round((t.wage + ct.wage) / 2);
      if (ct.signBonus > L.sign) ct.signBonus = L.sign; else ct.signBonus = Math.round((t.signBonus + ct.signBonus) / 2);
      if (ct.roleIdx > L.rmax) { ct.roleIdx = Math.max(t.roleIdx, L.rmax); ct.role = K.ROLES[ct.roleIdx]; }
      if (ask.years > L.ymax) ct.years = L.ymax; if (ask.years < L.ymin) ct.years = L.ymin;
      Object.keys(ct.bonuses).forEach(function (k) { var b0 = t.bonuses[k] ? t.bonuses[k].amt : 0, cap = b0 ? Math.round(b0 * L.bonus) : Math.round(t.wage * 0.08); if (ct.bonuses[k].amt > cap) ct.bonuses[k].amt = cap; });
      if (ct.release && !L.clause) ct.release = t.release || 0; else if (ct.release && ct.release < L.relMin) ct.release = L.relMin;
      K.applyOfferTerms(o, ct);
      K.log('negociacion', Object.assign(offerBrief(o), { why: 'contrapropuesta del club' }));
      return { ok: true, result: 'counter', msg: nm + ' presenta una contrapropuesta: revísala.' };
    }
    K.applyOfferTerms(o, ask);
    K.log('negociacion', Object.assign(offerBrief(o), { why: 'el club aceptó tus condiciones' }));
    return { ok: true, result: 'accept', msg: nm + ' acepta tus condiciones. Falta que confirmes la firma.' };
  };
  K.applyOfferTerms = function (o, t) {
    var S = FP.S, club = o.club != null ? S.clubs[o.club] : null, lim = o.t.lim;
    var cal = club ? FP.LGDEF[club.lg].cal : 'year';
    o.t = t; o.t.lim = lim;
    if (o.type !== 'loan') { o.t.endY = M.endYearOf(cal, t.years, t.startW); o.t.endW = M.contractEndWeek({ end: o.t.endY }, cal); }
    o.wage = t.wage; o.years = t.years; o.role = t.role;
    o.text = K.summary(o);
  };
  K.answerThinking = function (o) {
    var S = FP.S, h = S.hero, ask = o.pending; o.state = 'abierta'; o.pending = null;
    if (!ask) return;
    // tras pensarlo: acepta al límite o mantiene su propuesta
    var L = o.t.lim, ct = JSON.parse(JSON.stringify(ask));
    if (ct.wage > L.wage) ct.wage = L.wage; if (ct.signBonus > L.sign) ct.signBonus = L.sign; if (ct.roleIdx > L.rmax) { ct.roleIdx = L.rmax; ct.role = K.ROLES[ct.roleIdx]; }
    if (ct.years > L.ymax) ct.years = L.ymax; if (ct.release && !L.clause) ct.release = o.t.release || 0;
    K.applyOfferTerms(o, ct); o.neg = (o.neg || 0);
    FP.Hero.msg((o.club != null ? C.tname(o.club) : 'El club') + ' respondió a tu contrapropuesta: revisa las nuevas condiciones.', 'ok');
  };
  // compatibilidad: las fichas rápidas de la interfaz actual (+10% sueldo, ±1 año)
  var neg0 = M.negotiate;
  M.negotiate = function (oid, mods) {
    var o = K.find(oid); if (!o || !o.t) return neg0 ? neg0(oid, mods) : { ok: false, msg: 'No se puede negociar esta oferta.' };
    var c = {};
    if (mods.wage) c.wage = Math.round(o.t.wage * (1 + mods.wage));
    if (mods.years) c.years = o.t.years + mods.years;
    var r = K.negotiate(oid, c); return r;
  };
  M.contractWatch = K.contractWatch;
  M.contractExpired = function () { K.expiry(FP.S.week); };

  // ---------- enlaces con el resto del motor ----------
  var heroWeekly0 = M.heroWeekly;
  M.heroWeekly = function (w) {
    var h = FP.S.hero; if (!h || h.retired) return;
    K.ensure(); if (h.contract && !h.contract.cid) K.upgradeContract(h.contract);
    K.weekly(w);                                   // trámites, caducidades, expiración, bonos y rol
    heroWeekly0.call(M, w);
  };
  // el motor viejo caducaba ofertas por su cuenta: ahora lo hace K.weekly (con registro). Se evita el doble tratamiento.
  var hi = FP.Hero.injure;
  FP.Hero.injure = function (src, weeks) { var r = hi.call(FP.Hero, src, weeks); var h = FP.S.hero; if (h && h.inj) K.ensure().injH.push({ w: FP.S.week, n: h.inj.n }); return r; };
})();
