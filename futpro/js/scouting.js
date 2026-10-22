/* FUTPRO — mercado realista: reputación local/nacional/internacional, seguimiento de clubes y ojeadores,
   interés sin oferta inmediata, pruebas con posibilidad de rechazo, ofertas según nivel y necesidades del club,
   contratos semiprofesionales, negociación, cesiones solicitadas, cupos de extranjeros y restricciones a menores.
   Reemplaza el flujo de ofertas de market.js (el resto del mercado sigue siendo el original). */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, M = FP.Market, Youth = FP.Youth;
  var Rep = FP.Rep = {};

  var EU = { ESP: 1, ITA: 1, FRA: 1, GER: 1, POR: 1, NED: 1, BEL: 1, DEN: 1, AUT: 1, POL: 1, SWE: 1, CZE: 1, GRE: 1, HRV: 1, SVK: 1, ROU: 1, HUN: 1, IRL: 1, BUL: 1, CYP: 1, FIN: 1 };
  var EEA = { NOR: 1, SUI: 1, ENG: 1, SCO: 1, WAL: 1, ISL: 1 };                      // espacio europeo / acuerdos: pueden fichar menores de 16-17 entre ellos
  var NONEU_QUOTA = { ESP: 3, ITA: 3, FRA: 4, POR: 5, GER: 6, NED: 6, BEL: 6, DEN: 6, AUT: 6, GRE: 5 };
  var FQ = { CHI: 5, ARG: 5, URU: 4, COL: 5, PER: 5, ECU: 5, PAR: 4, BOL: 5, VEN: 5, MEX: 9, USA: 8, CAN: 7, JPN: 5, KOR: 5, CHN: 5, AUS: 5, KSA: 8, QAT: 8, UAE: 8, IND: 6, THA: 6, IRN: 4, UZB: 5, TUR: 14, SCO: 17, ENG: 17, BRA: 99 };
  function isEU(c) { return !!EU[c]; }
  function isEUish(c) { return !!(EU[c] || EEA[c]); }

  // ---------- estado ----------
  Rep.ensure = function () {
    var h = FP.S && FP.S.hero; if (!h) return null;
    if (!h.rep) h.rep = { loc: 12, nat: 3, int: 0 };
    if (!h.int) h.int = [];
    if (!h.cd) h.cd = {};
    if (!h.mk) h.mk = { log: [], rej: 0 };
    return h;
  };

  // Puesto del jugador en la tabla de goleadores de su competición de liga (1 = máximo goleador, 0 = no figura entre los 10 primeros)
  Rep.scorerRank = function () {
    var S = FP.S, h = S.hero, found = 0;
    Object.keys(S.comps).forEach(function (k) {
      var c = S.comps[k]; if (found || c.kind !== 'L' || c.done || !c.sc || c.teams.indexOf(h.team) < 0) return;
      var top = FP.Comp.topScorers(c, 10, 0); for (var i = 0; i < top.length; i++) if (top[i].pid === 0 && top[i].g >= 4) { found = i + 1; break; }
    });
    return found;
  };
  // ---------- reputación ----------
  function clubTier(club) { return FP.LGDEF[club.lg]; }
  Rep.targets = function () {
    var S = FP.S, h = S.hero, age = FP.Hero.age(), ss = h.season, t = { loc: 10, nat: 2, int: 0 };
    var perf = ss.rn >= 3 ? U.clamp((ss.rs / ss.rn - 6.4) / 1.1, -1, 1.6) : 0, gr = ss.ap ? ss.g / ss.ap : 0;
    var role = h.tk === 'pro' || h.tk === 'loan' ? FP.Hero.roleLabel() : '';
    var rb = { 'Estrella': 10, 'Titular indiscutido': 6, 'Titular': 3, 'Rotación': -3, 'Suplente': -8 }[role] || 0;
    if (h.tk === 'pro' || h.tk === 'loan') {
      var lg = clubTier(S.clubs[h.team]), tr = lg.t;
      t.loc = tr === 1 ? 62 : tr === 2 ? 54 : 44; t.nat = tr === 1 ? 52 : tr === 2 ? 38 : 26;
      t.int = tr === 1 ? U.clamp((lg.q - 52) * 1.4, 0, 62) : tr === 2 ? U.clamp((lg.q - 52) * 0.5, 0, 18) : 0;
      t.nat += rb; t.int += rb * 0.5;
      if (h.tk === 'loan') { t.nat -= 3; t.int -= 3; }
    } else if (h.tk === 'academy') {
      var l2 = clubTier(S.clubs[h.club]), z = Youth.heroEval().z;
      t.loc = l2.t === 1 ? 42 : l2.t === 2 ? 34 : 26; t.nat = (l2.t === 1 ? 12 : l2.t === 2 ? 8 : 4) + z * 3; t.int = l2.t === 1 ? U.clamp((l2.q - 55) * 0.3, 0, 8) : 0;
    } else if (h.tk === 'amat') {
      var tier = Youth.tierOf(S.amat[h.team - 20000]);
      t.loc = tier === 'semipro' ? 42 : tier === 'regional' ? 30 : 18; t.nat = tier === 'semipro' ? 12 : tier === 'regional' ? 4 : 0; t.int = 0;
    }
    var sr = Rep.scorerRank(), sb = sr ? (sr <= 3 ? 12 : sr <= 5 ? 7 : 3) : 0;           // goleador de la liga
    t.loc += perf * 10 + gr * 18 + sb; t.nat += perf * 7 + gr * 10 + sb; t.int += (h.tk === 'pro' || h.tk === 'loan') ? perf * 6 + gr * 6 + sb * 0.8 : 0;
    var nts = h.nts ? h.nts.c : {};
    var nb = (nts.U15 && nts.U15.n ? 4 : 0) + (nts.U17 && nts.U17.n ? 7 : 0) + (nts.U20 && nts.U20.n ? 10 : 0) + (nts.U23 && nts.U23.n ? 12 : 0);
    t.nat += nb; t.int += nb * 0.4;
    if (h.nt.caps > 0 && h.nt.cat === 'Absoluta') { t.nat += 20; t.int += 15 + Math.min(20, h.nt.caps * 0.5); }
    var titles = h.trophies.filter(function (x) { return !x.sub; }).length; t.loc += Math.min(8, titles * 2); t.nat += Math.min(8, titles * 2);
    if (h.tk === 'free') { t.loc = Math.min(t.loc, h.rep.loc); t.nat = Math.min(t.nat, h.rep.nat); t.int = Math.min(t.int, h.rep.int); }
    t.loc = U.clamp(t.loc, 0, 100); t.nat = U.clamp(t.nat, 0, 100); t.int = U.clamp(t.int, 0, 100);
    return t;
  };
  Rep.weekly = function () {
    var h = Rep.ensure(); if (!h) return;
    var t = Rep.targets(), r = h.rep;
    ['loc', 'nat', 'int'].forEach(function (k) { r[k] += (t[k] - r[k]) * (t[k] > r[k] ? 0.05 : 0.025); r[k] = Math.round(r[k] * 100) / 100; });
    h.int.forEach(function (e) { e.v -= 0.7; });
    h.int = h.int.filter(function (e) { return e.v >= 5; });
  };
  // exposición del jugador frente a un club (qué tan conocido es allí)
  Rep.exposure = function (club) {
    var h = Rep.ensure(), r = h.rep, S = FP.S, cc = M.heroCountry(), lg = clubTier(club);
    if (club.c === cc) {
      var need = (lg.t === 1 ? 50 : lg.t === 2 ? 36 : 22) + (club.ra > 3 ? 4 : 0);
      var have = lg.t === 3 ? Math.max(r.loc * 0.95, r.nat) : Math.max(r.loc * 0.8, r.nat);
      return { ok: have >= need, need: need, have: have };
    }
    var need2 = 24 + (lg.q - 48) * 1.25;
    if ({ KSA: 1, QAT: 1, UAE: 1, CHN: 1 }[club.c] && FP.Hero.age() >= 31) need2 -= 18;       // los veteranos con nombre les interesan aunque no sean estrellas internacionales
    return { ok: r.int >= need2, need: need2, have: r.int };
  };

  // ---------- reglas de contratación ----------
  Rep.foreignOK = function (club, nat, age) {
    var cc = club.c;
    if (nat === cc) return true;
    // menores: solo en su país, salvo traslados de 16-17 años dentro de la UE/EEE
    if (age < 18 && !(age >= 16 && isEUish(nat) && isEUish(cc))) return false;
    var roster = FP.S.ro[club.id] || [], cnt = 0;
    var noneu = !isEU(nat) && !(isEUish(nat) && EEA[nat]);
    if (NONEU_QUOTA[cc] != null) { if (!isEUish(nat)) { roster.forEach(function (p) { if (p.i !== 0 && !isEUish(p.nat)) cnt++; }); return cnt < NONEU_QUOTA[cc]; } return true; }
    var q = FQ[cc] != null ? FQ[cc] : 6;
    roster.forEach(function (p) { if (p.i !== 0 && p.nat !== cc) cnt++; });
    return cnt < q;
  };
  Rep.aiForeignOK = function (club, p) { return Rep.foreignOK(club, p.nat, C.age(p)); };
  Rep.permit = function (club) {       // permiso de trabajo: Inglaterra exige nivel y trayectoria a los no europeos
    var h = FP.S.hero; if (club.c !== 'ENG' || isEUish(h.nat) && !EU[h.nat]) return true;
    if (h.nat === 'ENG' || h.nat === 'SCO' || h.nat === 'WAL') return true;
    return h.nt.caps >= 10 || h.ovr - Youth.adultPenalty(FP.Hero.age()) >= club.st - 1;
  };

  // ---------- encaje deportivo ----------
  Rep.fit = function (club) {
    var S = FP.S, h = S.hero, age = FP.Hero.age(), eff = h.ovr - Youth.adultPenalty(age), pe = M.potEst(), lg = clubTier(club);
    var ro = (S.ro[club.id] || []).filter(function (p) { return p.i !== 0 && p.p === h.pos; }).sort(function (a, b) { return b.o - a.o; });
    var top = ro.length ? ro[0].o : 38, depth = ro.length, slots = h.pos === 'CB' ? 2 : 1;
    var need = depth < slots + 1 ? 1 : (top - eff <= 2 ? 0.7 : top - eff <= 6 ? 0.35 : 0.1);
    var gap = eff - (club.st - 5);
    if (age <= 17) {
      var ys = C.youthStr(club, U.clamp(age, 12, 19));
      return { kind: 'academy', gap: h.ovr - ys, need: 0.6, ok: h.ovr >= ys - 4, eff: eff };
    }
    if (gap >= -3) return { kind: 'pro', gap: gap, need: need, ok: need >= 0.35 || gap >= 4, eff: eff, top: top };
    if (age <= 22 && pe >= club.st + 2 && eff >= club.st - 11) return { kind: 'project', gap: gap, need: 0.5, ok: true, eff: eff, top: top };
    return { kind: 'none', gap: gap, need: need, ok: false, eff: eff, top: top };
  };


  // ---------- atracción: qué clubes se fijan en el jugador y qué tan atractivas son sus propuestas ----------
  // Los pesos son supuestos de diseño (ver tests/precontratos.js): cercanía geográfica y cultural, nivel del club frente al actual, encaje, visibilidad y prestigio de la liga.
  Rep.PULL = { home: 2.6, conf: 1.5, far: 0.7, prestige: 0.8, surprise: 0.06, lowerStar: 0.05, lowerBase: 0.12, lowerWant: 0.55 };
  Rep.situation = function () {
    var h = Rep.ensure(), age = FP.Hero.age(), pro = h.tk === 'pro' || h.tk === 'loan', role = pro ? FP.Hero.roleLabel() : 'Titular';
    return { h: h, age: age, role: role, star: role === 'Estrella' || role === 'Titular indiscutido', wantMove: role === 'Suplente' || role === 'Rotación' || h.tk === 'free' || !!(h.flags && h.flags.transferReq), cur: h.club != null ? FP.S.clubs[h.club] : null };
  };
  // cercanía del club: mismo país, misma confederación o vínculo de idioma/historia (js/origenes.js); el resto del mundo sigue siendo posible
  Rep.proximity = function (club) {
    var P = Rep.PULL, cc = M.heroCountry(), d = FP.DATA.countries, mine = d[cc], theirs = d[club.c];
    var w = club.c === cc ? P.home : (mine && theirs && mine.conf === theirs.conf) ? P.conf : P.far;
    if (club.c !== cc && FP.Origenes && FP.Origenes.affinity(cc, club.c, true) >= 4) w = Math.max(w, P.conf);
    return w;
  };
  // peso con el que un club capta el interés: encaje deportivo × nivel frente al club actual × cercanía × prestigio de la liga × visibilidad del jugador
  Rep.pull = function (club, f, s) {
    var P = Rep.PULL; s = s || Rep.situation(); f = f || Rep.fit(club);
    var w = f.need * Math.exp(-Math.abs(f.gap) / 6);
    if (s.cur) { var d = club.st - s.cur.st; w *= d >= 0 ? 1 + Math.min(d, 10) * 0.04 : Math.exp(d / (s.wantMove ? 14 : 9)); }
    w *= Rep.proximity(club);
    w *= 1 + P.prestige * U.clamp((clubTier(club).q - 55) / 20, 0, 1);
    var ex = Rep.exposure(club); w *= 0.7 + 0.5 * U.clamp((ex.have - ex.need) / 30, 0, 1);
    return Math.max(w, 1e-6);
  };
  // elección ponderada con una pequeña probabilidad de «sorpresa» (elige entre todos los elegibles sin pesos)
  Rep.pickClub = function (cand, s) {
    s = s || Rep.situation();
    if (R() < Rep.PULL.surprise) return U.pick(cand);
    return U.wpick(cand, function (c) { return Rep.pull(c, null, s); });
  };
  // un club de menor nivel deportivo solo llega a proponer con poca frecuencia: menos si eres titular o estrella, más si quieres irte o eres veterano.
  // Pero el nivel del equipo no es lo único que cuenta: si la propuesta es muy atractiva (mejor liga, mejor sueldo, más minutos) la puerta se abre más.
  Rep.lowerGate = function (club, s, f, opts) {
    var P = Rep.PULL; s = s || Rep.situation();
    if (!s.cur || club.st >= s.cur.st - 3) return true;
    var p = s.wantMove ? P.lowerWant : s.star ? P.lowerStar : P.lowerBase;
    if (s.age >= 31) p += 0.1;
    var o = opts || {}; o.s = s; var att = Rep.attract(club, f || Rep.fit(club), o);
    p += Math.max(0, att - 0.45) * 0.8;                    // ventaja de la propuesta: hasta +0,44
    if (club.st < s.cur.st - 12) p *= att >= 0.75 ? 0.8 : 0.5;
    return R() < Math.max(Math.min(p, 0.9), P.surprise);
  };
  // atractivo de la propuesta para el jugador (0 a 1): sueldo frente al actual, minutos esperados, prestigio de la liga y situación contractual
  Rep.attract = function (club, f, opts) {
    var s = (opts && opts.s) || Rep.situation(), h = s.h; f = f || Rep.fit(club); opts = opts || {};
    var cw = h.contract && h.contract.wage ? h.contract.wage : 0, est = opts.wage != null ? opts.wage : Rep.wage(club, 1);
    var sw = cw > 0 ? U.clamp((est / cw - 0.7) / 1.0, 0, 1) : 0.6;
    var sm = f.kind === 'project' ? 0.35 : f.gap >= 3 ? 1 : f.gap >= -1 ? 0.55 : 0.2;
    var sl = s.cur ? U.clamp(0.5 + (clubTier(club).q - clubTier(s.cur).q) / 24, 0, 1) : 0.6;
    var left = h.contract && h.contract.endW != null ? h.contract.endW - FP.S.week : 999;
    var sc = opts.pre ? ((FP.Contracts && FP.Contracts.ensure && FP.Contracts.ensure().noRenew) || (FP.Contracts && FP.Contracts.importance && FP.Contracts.importance() < 0.4) ? 1 : 0.7) : (left > 104 && !s.wantMove ? 0.6 : 1);
    var a = 0.35 * sw + 0.30 * sm + 0.25 * sl + 0.10 * sc;
    if (s.age >= 31) a = Math.min(1, a + 0.08);          // un veterano acepta propuestas menos brillantes
    return a;
  };
  // ¿el club llega a presentar la propuesta? las poco atractivas son menos frecuentes, pero siempre queda margen para la sorpresa
  Rep.offerGate = function (club, f, opts) {
    var a = Rep.attract(club, f, opts);
    return R() < Math.max(0.5 + 0.5 * a, Rep.PULL.surprise);
  };

  // ---------- seguimiento: ojeadores ----------
  Rep.interestOf = function (clubId) { var e = FP.S.hero.int.filter(function (x) { return x.c === clubId; })[0]; return e ? e.v : 0; };
  Rep.addInterest = function (club, dv, why) {
    var h = Rep.ensure(), e = h.int.filter(function (x) { return x.c === club.id; })[0];
    if ((h.cd[club.id] || 0) > FP.S.week) return;           // el club descartó al jugador recientemente
    var was = e ? e.v : 0;
    if (!e) { e = { c: club.id, v: 0, why: why, w: FP.S.week }; h.int.push(e); }
    e.v = Math.min(100, e.v + dv); e.w = FP.S.week; e.why = why || e.why;
    if (was < 35 && e.v >= 35 && !(h.cd['n' + club.id] > FP.S.week)) {
      h.cd['n' + club.id] = FP.S.week + 40;
      FP.Hero.msg('Ojeadores de ' + club.nm + ' (' + C.cname(club.c) + ') siguen tus partidos' + (why ? ': ' + why : '') + '. Todavía no hay oferta.', 'i');
    }
  };
  Rep.scoutWeek = function (w) {
    var S = FP.S, h = Rep.ensure(), age = FP.Hero.age();
    if (age < 14 && h.tk === 'amat') return;
    var ss = h.season, perf = ss.rn >= 3 ? ss.rs / ss.rn : 6.2, gr = ss.ap ? ss.g / ss.ap : 0;
    var sr = Rep.scorerRank(), p = 0.05 + h.rep.loc / 500 + h.rep.nat / 400 + Math.max(0, perf - 6.4) * 0.05 + gr * 0.12 + (sr ? (sr <= 3 ? 0.15 : 0.07) : 0);
    if (h.tk === 'free') p *= 0.7;
    if (R() > Math.min(0.5, p)) return;
    var cand = S.clubs.filter(function (c) {
      var ex = Rep.exposure(c); if (!ex.ok) return false;
      if (h.cd[c.id] > w || (h.club === c.id)) return false;
      if (!Rep.foreignOK(c, h.nat, age) || !Rep.permit(c)) return false;
      var f = Rep.fit(c); return f.kind !== 'none' && f.ok;
    });
    if (!cand.length) return;
    var club = Rep.pickClub(cand);
    var why = gr >= 0.5 ? 'por tus goles' : perf >= 7 ? 'por tu rendimiento' : age <= 17 ? 'por tu proyección' : 'por tu nivel';
    var sup = U.clamp((Rep.fit(club).eff - (club.st - 5)) / 18, 0, 1);        // cuanto mejor es el jugador respecto al club, más rápido crece el interés
    Rep.addInterest(club, Math.round(U.int(10, 24) * (1 + sup * 0.8) * (sr && sr <= 3 ? 1.35 : 1)), sr && sr <= 3 ? 'por ser de los máximos goleadores' : why);
  };
  // tras un buen partido, un club puede fijarse en el jugador
  Rep.spark = function (hm) {
    if (!hm || !hm.played || (hm.rating < 8 && hm.g < 2)) return;
    var S = FP.S, h = Rep.ensure(), age = FP.Hero.age();
    var cand = S.clubs.filter(function (c) { var ex = Rep.exposure(c); if (!ex.ok || !Rep.foreignOK(c, h.nat, age)) return false; var f = Rep.fit(c); return f.ok && f.kind !== 'none'; });
    if (!cand.length) return;
    Rep.addInterest(Rep.pickClub(cand), U.int(6, 16), hm.g >= 2 ? 'tras tu actuación goleadora' : 'tras tu gran partido');
  };

  // ---------- ofertas ----------
  Rep.coolOn = function (w) { return (FP.S.hero.coolUntil || 0) > w; };
  Rep.wage = function (club, factor) {
    var h = FP.S.hero, val = M.heroValue(), cw = FP.DATA.countries[club.c].w, lg = clubTier(club);
    var gulf = { KSA: 1, QAT: 1, UAE: 1, CHN: 1 }[club.c] && lg.t === 1 && FP.Hero.age() >= 30 ? 1.55 : 1;   // el "retiro dorado": los veteranos cobran mucho más en la liga del Golfo y China
    var base = C.wage(val, cw) * gulf, tierF = lg.t === 1 ? 1 : lg.t === 2 ? 0.78 : 0.58, finF = 0.62 + club.fin * 0.06;
    return Math.max(2, Math.round(base * tierF * finF * (factor || 1) * M.agentMult()));
  };
  Rep.offers = function (freeAgent, cap) {
    var S = FP.S, h = Rep.ensure(), age = FP.Hero.age(), w = S.week, cur = h.club != null ? S.clubs[h.club] : null;
    if (Rep.coolOn(w) && !freeAgent) return 0;
    if (age < 16) return 0;
    var made = 0, maxN = cap != null ? cap : freeAgent ? 2 : 3, pot = M.potEst(), val = M.heroValue();
    var roleNow = (h.tk === 'pro' || h.tk === 'loan') ? FP.Hero.roleLabel() : 'Titular';
    var wantMove = roleNow === 'Suplente' || roleNow === 'Rotación' || h.tk === 'free' || h.flags.transferReq;
    var list = h.int.filter(function (e) { return e.v >= 38 && (h.cd[e.c] || 0) <= w; }).sort(function (a, b) { return b.v - a.v; });
    list.forEach(function (e) {
      if (made >= maxN) return;
      var club = S.clubs[e.c]; if (!club || club === cur) return;
      if (h.offers.some(function (o) { return o.club === club.id; })) return;
      var ex = Rep.exposure(club); if (!ex.ok) return;
      if (!Rep.foreignOK(club, h.nat, age) || !Rep.permit(club)) return;
      var f = Rep.fit(club); if (f.kind === 'none' || !f.ok) return;
      // un club que no mejora el nivel actual solo interesa si hay más minutos o más dinero
      var lower = cur && club.st < cur.st - 3, better = !cur || club.st >= cur.st - 1;
      if (!Rep.lowerGate(club, null, f)) return;       // un club de menor nivel propone con poca frecuencia, salvo que la propuesta sea muy atractiva
      if (!Rep.offerGate(club, f)) return;    // y las propuestas poco atractivas (sueldo, minutos, prestigio) son menos frecuentes
      if (R() > (e.v - 20) / 50) return;
      made++;
      var role = f.kind === 'project' ? 'Proyecto / suplente' : f.gap >= 3 ? 'Titular' : f.gap >= -1 ? 'Rotación' : 'Suplente';
      var money = lower ? (wantMove ? 1.2 + R() * 0.25 : 1.05 + R() * 0.1) : 1;             // un club menor solo mejora algo el sueldo; más si quieres irte
      var wage = Rep.wage(club, (role === 'Titular' ? 1.15 : role === 'Rotación' ? 1 : 0.75) * money);
      var years = age < 20 ? U.int(3, 5) : age < 30 ? U.int(2, 4) : U.int(1, 2);
      var fee = Math.round(val * (0.8 + R() * 0.45));
      var ending = h.contract && h.contract.endW != null && h.contract.endW - w <= 26 && h.contract.endW - w > 0;
      if (freeAgent) fee = 0;
      else if (ending && age >= 18 && h.tk === 'pro') {          // contrato a punto de vencer: se ofrece un precontrato, no un traspaso inmediato
        M.addOffer({ type: 'precontract', club: club.id, fee: 0, pre: h.contract.endW + 1, exp: h.contract.endW - 2, why: e.why });
        e.v = Math.max(20, e.v - 25); return;
      }
      var lg = clubTier(club), txt = club.nm + ' (' + C.cname(club.c) + ', ' + lg.n + ') quiere ficharte: ' + role.toLowerCase() + ', ' + years + ' años, ' + (FP.Wages ? FP.Wages.fmt(wage) : FP.fmt.money(wage) + ' al año') + (fee ? ', traspaso ' + FP.fmt.money(fee) + '.' : ' (agente libre).') + (lower ? ' Ofrece mejor sueldo, pero compite en un nivel menor.' : '');
      M.addOffer({ type: 'transfer', club: club.id, fee: fee, wage: wage, years: years, role: role, text: txt, exp: w + (freeAgent ? 6 : 5), why: e.why, lower: lower ? 1 : 0, urgent: f.need >= 1 ? 1 : 0 });
      e.v = Math.max(20, e.v - 25);
    });
    // cesiones: jugadores jóvenes sin minutos en clubes de mayor nivel (del país o del extranjero cuando es legal)
    var few = h.season && h.season.ap < 8 && w - (h.startW || 0) > 30;
    if ((h.tk === 'pro' || h.tk === 'academy') && age <= 23 && cur && !Rep.coolOn(w) && (roleNow === 'Suplente' || roleNow === 'Rotación' || h.tk === 'academy' && age >= 17 || age <= 21 && few || age <= 20 && cur.st >= h.ovr + 3) && M.isWindow(w) && R() < 0.3) {
      var cc = M.heroCountry(), eff = h.ovr - FP.Youth.adultPenalty(age);
      var opts = S.clubs.filter(function (c) {
        if (c === cur || !Rep.exposure(c).ok) return false;
        if (c.c === cc) return c.st <= h.ovr + 4 && c.st >= h.ovr - 14 && clubTier(c).t >= clubTier(cur).t;
        return age >= 18 && clubTier(c).t <= 2 && c.st <= eff + 2 && c.st >= eff - 10 && Rep.foreignOK(c, h.nat, age) && Rep.permit(c);
      });
      if (opts.length && !h.offers.some(function (o) { return o.type === 'loan'; })) {
        var lc = U.pick(opts);
        M.addOffer({ type: 'loan', club: lc.id, years: 1, wage: 0, role: 'Con minutos', text: lc.nm + (lc.c !== cc ? ' (' + C.cname(lc.c) + ')' : '') + ' solicita tu cesión por una temporada para darte minutos. Regresas a ' + cur.nm + ' al terminar.', exp: w + 5 });
      }
    }
    return made;
  };
  M.transferOffers = function (freeAgent) { return Rep.offers(freeAgent); };
  // Durante toda la ventana de fichajes (no solo la primera semana) los clubes interesados pueden presentar oferta; tope de 3 por ventana.
  Rep.WIN_CAP = 3;
  Rep.windowOffers = function (w, key) {
    var h = Rep.ensure(); if (!M.isWindow(w) || w % 2 !== 1) return;
    var ck = 'wc' + key, n = h.flags[ck] || 0; if (n >= Rep.WIN_CAP) return;
    h.flags[ck] = n + Rep.offers(false, Rep.WIN_CAP - n);
  };

  // ---------- ofertas semiprofesionales y pruebas para adultos ----------
  Rep.semiOffers = function () {
    var S = FP.S, h = Rep.ensure(), age = FP.Hero.age(), w = S.week, cc = M.heroCountry();
    if (age < 16 || h.offers.some(function (o) { return o.type === 'semi'; })) return;
    var lvlOk = h.ovr - Youth.adultPenalty(age) >= 40;
    var p = (h.tk === 'free' ? 0.12 : 0.04) + h.rep.loc / 700;
    if (!lvlOk || R() > p || (h.lastSemi != null && w - h.lastSemi < 16)) return;
    h.lastSemi = w;
    var tier = Youth.TIERS.semipro, st = U.int(tier.min, tier.max), nm = FP.Names.club();
    var wage = Math.max(2, Math.round(tier.wage * (0.7 + R() * 0.8) * (FP.DATA.countries[cc] ? FP.DATA.countries[cc].w * 2.2 : 1)));
    M.addOffer({ type: 'semi', club: null, name: nm, cc: cc, st: st, wage: wage, years: U.int(1, 2), role: 'Titular', text: nm + ' (semiprofesional) te ofrece un contrato de ' + FP.fmt.money(wage) + ' al año por ' + 'una o dos temporadas. Compiten en el fútbol regional-semiprofesional.', exp: w + 8 });
  };
  Rep.seniorTrials = function () {     // adultos sin club: pruebas con el primer equipo de clubes de nivel parecido
    var S = FP.S, h = Rep.ensure(), age = FP.Hero.age(), w = S.week, cc = M.heroCountry();
    if (age < 19 || h.tk !== 'free' || (h.trials || []).length || h.offers.some(function (o) { return o.type === 'trial_pro'; })) return;
    if (w - (h.freeSince || w) < 3 || R() > 0.12) return;
    var eff = h.ovr - Youth.adultPenalty(age);
    var cl = S.clubs.filter(function (c) { return c.c === cc && clubTier(c).t >= 2 && (h.cd[c.id] || 0) <= w && Math.abs(c.st - 5 - eff) <= 8 && Rep.exposure(c).ok; });
    if (!cl.length) return;
    var c = U.pick(cl);
    M.addOffer({ type: 'trial_pro', club: c.id, text: c.nm + ' te invita a entrenar con su primer equipo durante dos semanas para evaluarte.', exp: w + 5 });
  };

  // ---------- pruebas ----------
  M.trialReq = function (club, age) {
    var lg = clubTier(club);
    return C.youthStr(club, U.clamp(age, 12, 19)) + (lg.t === 1 ? 4 : lg.t === 2 ? 1 : -2) + (club.ra > 4 ? 3 : club.ra > 2 ? 1.5 : 0);
  };
  M.trialDifficulty = function (clubId) {
    var h = FP.S.hero, c = FP.S.clubs[clubId], age = FP.Hero.age(), req = M.trialReq(c, age);
    var fit = (h.ovr + (M.potEst() - h.ovr) * 0.25) - req;
    var p = 1 / (1 + Math.exp(-(fit - 1.5) / 2.2));
    if ((h.cd[clubId] || 0) > FP.S.week) p = Math.min(p, 0.05);        // rechazado hace poco
    return { req: req, fit: fit, p: p };
  };
  var oldRequest = M.requestTrial;
  M.requestTrial = function (clubId) {
    var h = FP.S.hero; Rep.ensure();
    if ((h.cd[clubId] || 0) > FP.S.week) return { ok: false, msg: 'Ese club te descartó hace poco: espera al menos un año para volver a intentarlo.' };
    var age = FP.Hero.age();
    if (age < 12) return { ok: false, msg: 'Edad mínima 12 años.' };
    return oldRequest(clubId);
  };
  var oldResolve = M.resolveTrial;
  M.resolveTrial = function (t) {
    var S = FP.S, h = Rep.ensure();
    if (t.open) return oldResolve(t);
    var c = S.clubs[t.club], age = FP.Hero.age();
    if (t.senior) {
      var f = Rep.fit(c), p = U.clamp(0.25 + f.gap * 0.07 + f.need * 0.2, 0.05, 0.85), ok = R() < p;
      h.mor = U.clamp(h.mor + (ok ? 6 : -5), 0, 100);
      if (ok) { var wage = Rep.wage(c, 0.9), years = U.int(1, 2); M.addOffer({ type: 'transfer', club: c.id, fee: 0, wage: wage, years: years, role: 'Rotación', text: '¡Prueba superada! ' + c.nm + ' te ofrece un contrato: ' + years + ' años, ' + FP.fmt.money(wage) + ' al año.', exp: S.week + 6 }); }
      else { h.cd[c.id] = S.week + 52; h.mk.rej++; FP.Hero.msg(c.nm + ' decidió no ficharte tras la prueba con el primer equipo' + (f.gap < -2 ? ' (el nivel exigido es superior al tuyo)' : f.need < 0.35 ? ' (ya tienen cubierta tu posición)' : '') + '.', 'warn'); }
      return;
    }
    var d = M.trialDifficulty(t.club), ok2 = R() < d.p;
    h.mor = U.clamp(h.mor + (ok2 ? 6 : -4), 0, 100);
    if (ok2) M.addOffer({ type: 'academy', club: c.id, years: 2, wage: 0, text: '¡Prueba aprobada! ' + c.nm + ' te ofrece incorporarte a sus divisiones inferiores.', exp: S.week + 8 });
    else {
      h.cd[c.id] = S.week + 52; h.mk.rej++;
      var why = d.fit < -4 ? 'tu nivel todavía está por debajo del exigido' : 'otros jugadores de tu puesto mostraron más';
      FP.Hero.msg('La prueba en ' + c.nm + ' no fue satisfactoria: ' + why + '. No podrás volver a probarte allí por un año.', 'warn');
    }
  };

  // ---------- responder / negociar ----------
  var oldRespond = M.respond;
  M.respond = function (oid, accept) {
    var S = FP.S, h = Rep.ensure(), o = h.offers.filter(function (x) { return x.id === oid; })[0];
    if (!o) return oldRespond(oid, accept);
    if (!accept) {
      var r0 = oldRespond(oid, accept);
      if (o.type === 'transfer' || o.type === 'pro' || o.type === 'academy' || o.type === 'semi') {
        h.coolUntil = S.week + U.int(5, 11);                    // rechazar una propuesta no trae otra de inmediato
        if (o.club != null) { var e = h.int.filter(function (x) { return x.c === o.club; })[0]; if (e) e.v = Math.max(0, e.v - 30); }
      }
      return r0;
    }
    if (o.type === 'semi') {
      h.offers = h.offers.filter(function (x) { return x.id !== oid; });
      var id = M.newAmateurClub(o.name, o.cc, o.st, 'semipro');
      M.joinAmateur(id);
      h.contract = { type: 'semi', wage: o.wage, end: D.year(S.week) + o.years, clause: null };
      FP.Hero.msg('Firmaste con ' + o.name + ' (semiprofesional): ' + FP.fmt.money(o.wage) + ' al año.', 'ok');
      return { ok: true, msg: 'Firmaste tu contrato semiprofesional.' };
    }
    if (o.type === 'trial_pro') {
      h.offers = h.offers.filter(function (x) { return x.id !== oid; });
      h.trials = h.trials || []; h.trials.push({ club: o.club, w: S.week + 2, senior: 1 });
      return { ok: true, msg: 'Aceptaste la invitación: dos semanas de prueba con el primer equipo.' };
    }
    return oldRespond(oid, accept);
  };
  // Negociación de sueldo/duración: mods {wage: +%, years: ±n}
  M.negotiate = function (oid, mods) {
    var S = FP.S, h = Rep.ensure(), o = h.offers.filter(function (x) { return x.id === oid; })[0];
    if (!o || o.wage == null || o.neg >= 2) return { ok: false, msg: o && o.neg >= 2 ? 'El club ya no negocia más: acepta o rechaza.' : 'No se puede negociar esta oferta.' };
    var club = o.club != null ? S.clubs[o.club] : null;
    var e = club ? Rep.interestOf(club.id) : 40, eff = h.ovr - Youth.adultPenalty(FP.Hero.age()), st = club ? club.st : 50;
    var lev = e / 100 + (eff - (st - 5)) / 14 + (h.agent ? h.agent.lvl * 0.04 : 0) + (h.tk === 'free' ? -0.2 : 0);
    var askW = mods.wage || 0, askY = mods.years || 0;
    var maxW = 0.05 + 0.2 * U.clamp(lev, 0, 1.4), p = U.clamp(1 - Math.max(0, askW - maxW) * 3.5, 0.05, 0.95) * (Math.abs(askY) > 1 ? 0.8 : 1);
    o.neg = (o.neg || 0) + 1;
    if (R() < p) {
      if (askW) o.wage = Math.round(o.wage * (1 + askW));
      if (askY) o.years = U.clamp(o.years + askY, 1, 5);
      o.text = o.text.replace(/\d+ años, [^.]*?al año( \([^)]*al mes\))?/, o.years + ' años, ' + (FP.Wages ? FP.Wages.fmt(o.wage) : FP.fmt.money(o.wage) + ' al año'));
      o.exp = Math.max(o.exp || 0, S.week + 2);
      return { ok: true, msg: 'El club aceptó tu contrapropuesta.' };
    }
    if (R() < 0.3 + askW) { h.offers = h.offers.filter(function (x) { return x !== o; }); return { ok: false, msg: (club ? club.nm : 'El club') + ' retiró la oferta: consideró excesiva tu petición.' }; }
    return { ok: false, msg: 'El club mantiene su propuesta original.' };
  };
  M.requestLoan = function () {
    var S = FP.S, h = Rep.ensure();
    if (h.tk !== 'pro' && h.tk !== 'academy') return { ok: false, msg: 'Solo disponible con contrato en un club.' };
    if (FP.Hero.age() > 25) return { ok: false, msg: 'Las cesiones de formación son hasta los 25 años.' };
    h.flags.loanReq = S.week; h.mor = U.clamp(h.mor - 2, 0, 100);
    return { ok: true, msg: 'Pediste ser cedido para tener minutos. El club evaluará propuestas en la próxima ventana.' };
  };
  var oldWage = M.wageFor;
  M.wageFor = function (club, factor) { return Rep.wage(club, factor); };

  // ---------- flujo semanal del mercado del jugador ----------
  var oldHW = M.heroWeekly;
  M.heroWeekly = function (w) {
    var S = FP.S, h = S.hero; if (!h || h.retired) return;
    Rep.ensure();
    // caducan ofertas
    h.offers = h.offers.filter(function (o) { if (o.exp != null && o.exp < w) { FP.Hero.msg('La oferta de ' + (o.club != null ? C.tname(o.club) : o.name || 'un club') + ' ha caducado.', 'i'); return false; } return true; });
    var age = FP.Hero.age();
    (h.trials || []).slice().forEach(function (t) { if (t.w <= w) { M.resolveTrial(t); h.trials.splice(h.trials.indexOf(t), 1); } });
    Rep.weekly();
    Rep.scoutWeek(w);
    if (h.tk === 'amat' || h.tk === 'free') {
      M.scouting(w); Rep.semiOffers();
      if (h.tk === 'free') Rep.seniorTrials();
    }
    if (h.tk === 'amat' && h.contract && h.contract.type === 'semi' && D.year(w) > h.contract.end) { h.contract = null; FP.Hero.msg('Terminó tu contrato semiprofesional con ' + C.tname(h.team) + '. Sigues en el club como jugador amateur.', 'i'); }
    var key = 'win' + M.windowKey(w);
    if (h.tk === 'pro' || h.tk === 'loan') {
      M.contractWatch(w);
      Rep.windowOffers(w, key);
    } else if (h.tk === 'academy') {
      if (age >= 17) Rep.windowOffers(w, key);
    } else if (h.tk === 'free') {
      if (w - (h.freeSince || w) >= 3 && R() < 0.2) Rep.offers(true);
    } else if (h.tk === 'amat' && age >= 17) Rep.windowOffers(w, key);
    if (h.tk === 'free' && h.freeSince != null && w - h.freeSince > 14 && !h.offers.length && R() < 0.5) {
      M.addOffer({ type: 'amateur', club: null, text: 'Un club amateur local te ofrece jugar en su equipo mientras buscas club profesional.', exp: w + 8 });
    }
  };
  // visitas de ojeadores a jugadores amateur / libres: ahora dependen de la exposición y solo hasta los 19 años
  M.scouting = function (w) {
    var S = FP.S, h = Rep.ensure(), age = FP.Hero.age(), cc = M.heroCountry();
    if (age > 19) return;
    if (h.lastScout != null && w - h.lastScout < 8) return;
    var p = 0.02 + h.rep.loc / 600 + Math.max(0, h.ovr - 48) * 0.002 + (h.season.g * 0.0015);
    if (R() > Math.min(0.14, p)) return;
    var clubs = S.clubs.filter(function (c) { return c.c === cc && clubTier(c).t <= 3 && (h.cd[c.id] || 0) <= w && Rep.exposure(c).ok; });
    if (!clubs.length) return;
    var pe = M.potEst();
    var c = U.wpick(clubs, function (c) { var fit = (h.ovr + (pe - h.ovr) * 0.25) - M.trialReq(c, age); return Math.exp(fit / 4) * (clubTier(c).t === 1 ? 1 : 1.3); });
    var d = M.trialDifficulty(c.id); if (d.fit < -6) return;
    h.lastScout = w;
    M.addOffer({ type: 'trial', club: c.id, text: c.nm + ' te invita a una prueba en sus divisiones inferiores.', exp: w + 6 });
  };

  // Veteranos (31+) con buen nivel: los clubes del Golfo y China se interesan (más sueldo, menos exigencia deportiva)
  var hw1 = M.heroWeekly;
  M.heroWeekly = function (w) {
    var r = hw1.apply(this, arguments), S = FP.S, h = S.hero;
    try {
      if (h && !h.retired && (h.tk === 'pro' || h.tk === 'free') && FP.Hero.age() >= 31 && h.ovr >= 66 && w % 4 === 0 && R() < 0.10) {
        var cl = S.clubs.filter(function (c) { return { KSA: 1, QAT: 1, UAE: 1, CHN: 1 }[c.c] && clubTier(c).t === 1 && (h.cd[c.id] || 0) <= w && Rep.foreignOK(c, h.nat, FP.Hero.age()) && c.st <= h.ovr + 4; });
        if (cl.length) { var c2 = U.pick(cl); Rep.addInterest(c2, U.int(42, 58), 'por su experiencia y nombre'); }
      }
    } catch (e) { }
    return r;
  };

  // mantiene la comisión del representante solo si hay sueldo; el contrato semiprofesional también cobra
  Rep.migrate = function () { Rep.ensure(); };
})();
