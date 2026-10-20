/* FUTPRO — motor de partidos: simulación estadística rápida (mundo) y simulación detallada minuto a minuto (jugador) */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core;

  var HOME_ADV = 3.0, NAT_ADV = 2.2;
  var SW_POS = { ST: 10, LW: 6, RW: 6, AM: 5, CM: 2.4, DM: 1, LB: 1, RB: 1, CB: 1.3, GK: 0.02 };
  var AS_POS = { ST: 3.6, LW: 6, RW: 6, AM: 6, CM: 4, DM: 1.5, LB: 3.2, RB: 3.2, CB: 0.7, GK: 0.05 };
  var SHOT_BONUS = { ST: 4, LW: 1, RW: 1, AM: 0, CM: -7, DM: -12, LB: -20, RB: -20, CB: -22, GK: -40 };

  var Match = FP.Match = { cache: {} };
  var HV = null; // vista del jugador durante un partido detallado

  function strFor(comp, id) {
    if (comp && comp.ys && comp.ys[id] != null) return comp.ys[id];
    return C.strOf(id);
  }
  function lambdas(stH, stA, neutral, nat) {
    var d = stH + (neutral ? 0 : (nat ? NAT_ADV : HOME_ADV)) - stA;
    d = U.clamp(d, -45, 45);
    return [1.32 * Math.exp(0.03 * d), 1.08 * Math.exp(-0.03 * d)];
  }
  Match.lambdas = lambdas;

  // ----- penales -----
  Match.shootout = function (stH, stA) {
    var ph = 0, pa = 0, i, p = 0.76;
    var bias = U.clamp((stH - stA) * 0.002, -0.05, 0.05);
    for (i = 0; i < 5; i++) {
      if (R() < p + bias) ph++;
      if (R() < p - bias) pa++;
      var left = 4 - i; if (ph > pa + left || pa > ph + left) break;
    }
    while (ph === pa) { var a = R() < p + bias, b = R() < p - bias; if (a) ph++; if (b) pa++; if (ph === pa && (a !== b)) break; if (ph !== pa) break; }
    if (ph === pa) { if (R() < 0.5) ph++; else pa++; }
    return [ph, pa];
  };

  // ----- cachés de goleadores por club -----
  function swFor(clubId) {
    var c = Match.cache[clubId];
    if (c && c.ro === FP.S.ro[clubId] && c.n === (FP.S.ro[clubId] || []).length) return c;
    var r = (FP.S.ro[clubId] || []).filter(function (p) { return !(p.inj > 0) && !(p.su > 0); });
    var ws = [], as = [], tw = 0, ta = 0, i;
    for (i = 0; i < r.length; i++) {
      var p = r[i], q = Math.pow(p.o / 60, 4);
      var w = SW_POS[p.p] * q, a = AS_POS[p.p] * q; tw += w; ta += a; ws.push(tw); as.push(ta);
    }
    c = Match.cache[clubId] = { r: r, ws: ws, as: as, tw: tw, ta: ta, ro: FP.S.ro[clubId], n: (FP.S.ro[clubId] || []).length };
    return c;
  }
  function pickCum(arr, tot) { var x = R() * tot, lo = 0, hi = arr.length - 1; while (lo < hi) { var m = (lo + hi) >> 1; if (arr[m] < x) lo = m + 1; else hi = m; } return lo; }
  function addSc(comp, p, club, idx) {
    var e = comp.sc[p.i]; if (!e) e = comp.sc[p.i] = [0, 0, club, p.n];
    e[idx]++; e[2] = club; e[3] = p.n;
    if (idx === 0) p.g = (p.g || 0) + 1; else p.as = (p.as || 0) + 1;
  }
  function scoreGoals(comp, clubId, goals) {
    if (!goals || clubId >= 5000) return;
    var c = swFor(clubId); if (!c.r.length) return;
    for (var g = 0; g < goals; g++) {
      var si = pickCum(c.ws, c.tw), sc = c.r[si];
      addSc(comp, sc, clubId, 0);
      if (R() < 0.72 && c.r.length > 1) { var ai = pickCum(c.as, c.ta), tries = 0; while (ai === si && tries++ < 4) ai = pickCum(c.as, c.ta); if (ai !== si) addSc(comp, c.r[ai], clubId, 1); }
    }
  }
  Match.scoreGoals = scoreGoals;

  // ----- simulación rápida (mundo) -----
  Match.quick = function (comp, f) {
    var stH = strFor(comp, f.h), stA = strFor(comp, f.a);
    var nat = f.h >= 5000 && f.h < 20000;
    var l = lambdas(stH, stA, f.n, nat);
    var hs = U.poisson(l[0]), as = U.poisson(l[1]);
    f.hs = hs; f.as = as;
    if (Comp_needs(comp, f)) {
      // prórroga
      var eh = U.poisson(l[0] / 3.2), ea = U.poisson(l[1] / 3.2);
      f.hs += eh; f.as += ea; f.et = 1;
      var ag = FP.Comp.tieAgg(comp, f);
      if (ag.a === ag.b) { f.ps = Match.shootout(stH, stA); }
      scoreGoals(comp, f.h, f.hs); scoreGoals(comp, f.a, f.as);
      return f;
    }
    scoreGoals(comp, f.h, hs); scoreGoals(comp, f.a, as);
    // lesiones del mundo (poco frecuentes)
    if (f.h < 5000 && R() < 0.05) injureRandom(f.h);
    if (f.a < 5000 && R() < 0.05) injureRandom(f.a);
    return f;
  };
  function Comp_needs(comp, f) { return f.k && FP.Comp.needsWinner(comp, f, f.hs, f.as); }
  function injureRandom(clubId) {
    var r = FP.S.ro[clubId]; if (!r || !r.length) return;
    var p = r[Math.floor(R() * r.length)];
    if (p.i === 0 || p.inj > 0) return;
    p.inj = R() < 0.7 ? U.int(1, 4) : R() < 0.8 ? U.int(5, 10) : U.int(11, 30);
    delete Match.cache[clubId];
  }

  // ----- alineaciones -----
  var FORMS = {
    '4-3-3': ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'CM', 'AM', 'LW', 'ST', 'RW'],
    '4-4-2': ['GK', 'LB', 'CB', 'CB', 'RB', 'LW', 'CM', 'CM', 'RW', 'ST', 'ST'],
    '4-2-3-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'DM', 'LW', 'AM', 'RW', 'ST'],
    '3-5-2': ['GK', 'CB', 'CB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RB', 'ST', 'ST']
  };
  Match.FORMS = FORMS;
  function fitPen(pp, slot) {
    if (pp === slot) return 0;
    if (pp === 'GK' || slot === 'GK') return 45;
    var g = C.POS_GRP;
    if ((pp === 'LB' && slot === 'RB') || (pp === 'RB' && slot === 'LB') || (pp === 'LW' && slot === 'RW') || (pp === 'RW' && slot === 'LW')) return 3;
    if ((pp === 'CB' && slot === 'DM') || (pp === 'DM' && slot === 'CB') || (pp === 'CM' && slot === 'DM') || (pp === 'DM' && slot === 'CM') || (pp === 'CM' && slot === 'AM') || (pp === 'AM' && slot === 'CM') || (pp === 'AM' && (slot === 'LW' || slot === 'RW' || slot === 'ST')) || ((pp === 'LW' || pp === 'RW') && (slot === 'AM' || slot === 'ST')) || (pp === 'ST' && (slot === 'AM' || slot === 'LW' || slot === 'RW'))) return 5;
    if (g[pp] === g[slot]) return 6;
    return 14;
  }
  // devuelve {xi:[{p, slot}], bench:[p], form}
  Match.lineup = function (clubId, opts) {
    opts = opts || {};
    var all = (FP.S.ro[clubId] || []).filter(function (p) { return !(p.inj > 0) && !(p.su > 0) && !(opts.excludeIds && opts.excludeIds[p.i]); });
    var club = FP.S.clubs[clubId];
    var form = opts.form || (club && club.fm) || '4-3-3', slots = FORMS[form] || FORMS['4-3-3'], used = {}, xi = [];
    var forced = opts.forced; // {p, slot}
    if (forced) {
      used[forced.p.i] = 1;
      if (slots.indexOf(forced.slot) < 0) { // la formación no tiene su posición: se ubica en el puesto más parecido
        var bs = null, bv = 99; slots.forEach(function (sl) { var v = fitPen(forced.p.p, sl); if (v < bv) { bv = v; bs = sl; } });
        forced.slot = bs;
      }
    }
    slots.forEach(function (sl) {
      if (forced && forced.slot === sl && !forced.done) { xi.push({ p: forced.p, slot: sl }); forced.done = 1; return; }
      var best = null, bv = -1;
      for (var i = 0; i < all.length; i++) {
        var p = all[i]; if (used[p.i]) continue;
        var v = p.o - fitPen(p.p, sl) + (p.p === sl ? 0.5 : 0);
        if (v > bv) { bv = v; best = p; }
      }
      if (best) { used[best.i] = 1; xi.push({ p: best, slot: sl }); }
    });
    var bench = all.filter(function (p) { return !used[p.i]; }).sort(function (a, b) { return b.o - a.o; });
    var bn = [], hasGK = false;
    bench.forEach(function (p) { if (bn.length < 7) { if (p.p === 'GK') { if (hasGK) return; hasGK = true; } bn.push(p); } });
    if (!hasGK) { var gk = bench.filter(function (p) { return p.p === 'GK'; })[0]; if (gk) { bn.pop(); bn.push(gk); } }
    return { xi: xi, bench: bn, form: form };
  };
  function sideRatings(xi, heroFactor) {
    var a = 0, na = 0, m = 0, nm = 0, d = 0, nd = 0, gk = 55;
    xi.forEach(function (e) {
      var o = e.p.i === 0 && HV ? HV.cur(e.slot, heroFactor) : e.p.o - fitPen(e.p.p, e.slot) * 0.6;
      var g = C.POS_GRP[e.slot];
      if (g === 'F') { a += o; na++; } else if (g === 'M') { m += o; nm++; a += o * 0.35; na += 0.35; d += o * 0.2; nd += 0.2; } else if (g === 'D') { d += o; nd++; } else gk = o;
    });
    return { atk: na ? a / na : 50, mid: nm ? m / nm : 50, def: nd ? d / nd : 50, gk: gk };
  }

  // ----- textos -----
  var T = {
    goal: [
      '¡GOOOL de {t}! {p} define con precisión{as}.',
      '¡GOL! {p} no perdona y bate al arquero{as}.',
      '¡{p} la manda al fondo de la red! Gol de {t}{as}.',
      '¡Golazo de {p}! {t} festeja{as}.',
      '¡Qué definición de {p}! No tuvo oportunidad el portero{as}.'
    ],
    goalHead: ['¡GOL de cabeza de {p}! Se elevó más que todos{as}.', '¡{p} cabecea con potencia y marca para {t}{as}!'],
    goalPen: ['¡GOL de penal! {p} engaña al portero y marca para {t}.', '{p} ejecuta el penal con frialdad: gol de {t}.'],
    save: ['Remate de {p}, ataja el arquero.', '{p} dispara y el portero responde con una gran atajada.', 'Tiro de {p} a media altura, el portero la desvía.'],
    miss: ['Sale desviado el disparo de {p}.', '{p} remata y la pelota se va por encima del travesaño.', '{p} intenta de lejos pero no encuentra el arco.'],
    block: ['Bloquea la defensa el tiro de {p}.', 'Se interpone un defensa ante el remate de {p}.'],
    post: ['¡Al palo! El remate de {p} pega en el poste.', '¡Travesaño! {p} estuvo cerca del gol.'],
    penMiss: ['{p} falla el penal. ¡Lo ataja el portero!', '{p} manda el penal a las nubes.'],
    foul: ['Falta de {p} sobre un rival.'],
    yellow: ['Tarjeta amarilla para {p} ({t}).'],
    red: ['¡Tarjeta roja! {p} ({t}) se va expulsado.'],
    inj: ['{p} ({t}) cae lesionado y debe abandonar el campo.'],
    sub: ['Cambio en {t}: entra {p}, sale {q}.'],
    chanceH: ['{p} se escapa por la banda y envía un centro peligroso.', '{p} pisa el área y busca el pase de gol.', 'Jugada colectiva de {t}, {p} participa activamente.']
  };
  function tx(arr, o) {
    var s = U.pick(arr);
    return s.replace(/\{(\w+)\}/g, function (m, k) { return o[k] != null ? o[k] : ''; });
  }

  // ----- simulación detallada -----
  // ctx: { comp, f, role: 'starter'|'bench'|'out', formH/formA, tactic:{mentality:-1..1}, hero (FP.S.hero) }
  Match.full = function (ctx) {
    var S = FP.S, comp = ctx.comp, f = ctx.f, hero = ctx.hero;
    HV = hero;
    var heroSide = hero && (f.h === hero.team ? 'h' : f.a === hero.team ? 'a' : null);
    var ev = [], n = 0;
    function E(m, type, side, text, extra) { var e = { m: m, t: type, s: side, x: text }; if (extra) for (var k in extra) e[k] = extra[k]; ev.push(e); return e; }

    // alineaciones
    var teamIds = { h: f.h, a: f.a }, lu = {}, ys = comp.ys;
    ['h', 'a'].forEach(function (sd) {
      var id = teamIds[sd];
      if (id >= 5000 && id < 20000 || id >= 20000 || (ys && ys[id] != null)) lu[sd] = Match.genericLineup(id, comp); // selecciones/amateur/juveniles
      else {
        var opts = {};
        if (heroSide === sd && ctx.role === 'starter') opts.forced = { p: S.pl[0], slot: hero.matchSlot() };
        else opts.excludeIds = { 0: 1 };
        lu[sd] = Match.lineup(id, opts);
      }
    });
    // el héroe en equipos genéricos
    if (heroSide && lu[heroSide].generic) {
      var hl = lu[heroSide];
      if (ctx.role === 'starter') { hl.xi[hl.xi.length - 1] = { p: S.pl[0], slot: hero.matchSlot() }; hl.xi.forEach(function (e) { e.slot = e.slot; }); }
      else if (ctx.role === 'bench') hl.bench.unshift(S.pl[0]);
    }
    var xi = { h: lu.h.xi.slice(), a: lu.a.xi.slice() }, bench = { h: lu.h.bench.slice(), a: lu.a.bench.slice() };
    var xi0 = { h: xi.h.map(function (e) { return { n: e.p.i === 0 ? hero.nm : e.p.n, pos: e.slot, o: e.p.i === 0 ? hero.ovr : e.p.o, id: e.p.i }; }), a: xi.a.map(function (e) { return { n: e.p.i === 0 ? hero.nm : e.p.n, pos: e.slot, o: e.p.i === 0 ? hero.ovr : e.p.o, id: e.p.i }; }) };
    var hm = { in: false, out: false, min: 0, g: 0, a: 0, sh: 0, sot: 0, kp: 0, yc: 0, rc: 0, inj: 0, subIn: 0, subOut: 0, role: ctx.role, ratingBase: 6.0, big: 0, drib: 0, tk: 0 };
    var isHeroIn = function () { return heroSide && xi[heroSide].some(function (e) { return e.p.i === 0; }); };
    if (heroSide && ctx.role === 'starter') hm.in = true;
    var st = { h: strFor(comp, f.h), a: strFor(comp, f.a) };
    var goals = { h: 0, a: 0 }, cards = { h: {}, a: {} }, sent = { h: {}, a: {} }, subs = { h: 0, a: 0 };
    var heroStam = hero ? U.clamp(100 - hero.fat * 0.45, 40, 100) : 100;
    var adv = f.n ? 0 : (f.h >= 5000 && f.h < 20000 ? NAT_ADV : HOME_ADV);
    var mentH = (heroSide === 'h' && ctx.tactic) ? ctx.tactic.mentality : 0;
    var mentA = (heroSide === 'a' && ctx.tactic) ? ctx.tactic.mentality : 0;

    function recalc() {
      var rh = sideRatings(xi.h.filter(function (e) { return !sent.h[e.p.i]; }), hero ? hero.stamFactor(heroStam) : 1);
      var ra = sideRatings(xi.a.filter(function (e) { return !sent.a[e.p.i]; }), hero ? hero.stamFactor(heroStam) : 1);
      // ajuste por diferencia con la fuerza base (equipos genéricos usan st)
      rh.off = st.h - (rh.atk * 0.35 + rh.mid * 0.3 + rh.def * 0.25 + rh.gk * 0.1);
      ra.off = st.a - (ra.atk * 0.35 + ra.mid * 0.3 + ra.def * 0.25 + ra.gk * 0.1);
      return { h: rh, a: ra };
    }
    var rt = recalc();
    function nameOf(p) { return p.i === 0 ? hero.nm : p.n; }
    function tname(sd) { return C.tname(teamIds[sd]); }
    function shooterFin(e, sd) {
      var p = e.p;
      if (p.i !== 0) return p.o + (SHOT_BONUS[e.slot] || 0);
      var v = hero.shotSkill() * hero.stamFactor(heroStam), ref = st[sd] + 4;
      return v > ref ? ref + 12 * Math.tanh((v - ref) / 12) : v; // rendimientos decrecientes frente al nivel del equipo
    }
    function chooseShooter(sd) {
      var arr = xi[sd].filter(function (e) { return !sent[sd][e.p.i]; });
      return U.wpick(arr, function (e) {
        var base = SW_POS[e.slot], q = shooterFin(e, sd) / 60;
        return base * Math.pow(q, 2.5);
      });
    }
    function chooseAssist(sd, shooter) {
      var arr = xi[sd].filter(function (e) { return !sent[sd][e.p.i] && e.p !== shooter.p; });
      return U.wpick(arr, function (e) {
        var q = e.p.i === 0 ? hero.passSkill() / 60 : e.p.o / 60;
        return AS_POS[e.slot] * q * q;
      });
    }
    function addAppearance(sd) { }
    function goalScored(m, sd, shooter, assist, kind) {
      goals[sd]++;
      var sp = shooter.p;
      var asT = assist ? ' tras pase de ' + nameOf(assist.p) : '';
      var text = kind === 'pen' ? tx(T.goalPen, { p: nameOf(sp), t: tname(sd) }) : tx(kind === 'head' ? T.goalHead : T.goal, { p: nameOf(sp), t: tname(sd), as: asT });
      var isH = sp.i === 0 || (assist && assist.p.i === 0);
      E(m, 'goal', sd, text, { hero: isH ? 1 : 0, sc: sp.i, as: assist ? assist.p.i : null, sn: nameOf(sp), an: assist ? nameOf(assist.p) : null, hs: goals.h, as_: goals.a });
      if (sp.i === 0) { hm.g++; hm.sh++; hm.sot++; }
      if (assist && assist.p.i === 0) { hm.a++; hm.kp++; }
      if (teamIds[sd] < 5000) { addSc(comp, sp, teamIds[sd], 0); if (assist) addSc(comp, assist.p, teamIds[sd], 1); }
      else if (sp.i === 0) { addSc(comp, sp, teamIds[sd], 0); if (assist && assist.p.i === 0) addSc(comp, assist.p, teamIds[sd], 1); }
      else if (assist && assist.p.i === 0) addSc(comp, assist.p, teamIds[sd], 1);
    }
    function attack(m, sd, extraMult) {
      var od = sd === 'h' ? 'a' : 'h', A = rt[sd], Dd = rt[od];
      var sh = chooseShooter(sd), p = sh.p;
      var isHero = p.i === 0;
      var shotSk = shooterFin(sh, sd);
      var head = (isHero && hero.headerSkill() > hero.shotSkill() + 8 && R() < 0.35) || (!isHero && (sh.slot === 'CB' || sh.slot === 'ST') && R() < 0.18);
      // penal por falta en el área
      var isPen = R() < 0.045;
      var rel = (A.atk + A.off * 0.5) - (Dd.def + Dd.off * 0.3);
      var pg = 0.085 + rel * 0.0026 + (shotSk - 58) * 0.0021 - (Dd.gk - 62) * 0.0018;
      pg = U.clamp(pg * (extraMult || 1), 0.02, 0.42);
      if (isPen) {
        var taker = sh; // pateador: el mejor rematador
        xi[sd].forEach(function (e) { if (!sent[sd][e.p.i] && shooterFin(e, sd) > shooterFin(taker, sd) + 4 && R() < 0.8) taker = e; });
        E(m, 'pen', sd, '¡Penal para ' + tname(sd) + '!', {});
        if (R() < U.clamp(0.74 + (shooterFin(taker, sd) - 60) * 0.004 - (Dd.gk - 62) * 0.002, 0.45, 0.9)) {
          goalScored(m, sd, taker, null, 'pen');
          if (taker.p.i === 0) { hm.sh++; }
        } else {
          E(m, 'miss', sd, tx(T.penMiss, { p: nameOf(taker.p) }), { hero: taker.p.i === 0 ? 1 : 0 });
          if (taker.p.i === 0) { hm.sh++; hm.big++; }
        }
        return;
      }
      if (isHero) hm.sh++;
      var r = R();
      if (r < pg) {
        var asst = R() < 0.72 ? chooseAssist(sd, sh) : null;
        if (isHero) hm.sh--; // goalScored suma tiro
        goalScored(m, sd, sh, asst, head ? 'head' : 'normal');
      } else {
        var r2 = R();
        var nm = nameOf(p), hFlag = isHero ? 1 : 0;
        var as2 = R() < 0.4 ? chooseAssist(sd, sh) : null;
        if (as2 && as2.p.i === 0) { hm.kp++; }
        if (r2 < 0.30) { E(m, 'save', sd, tx(T.save, { p: nm }), { hero: hFlag }); if (isHero) hm.sot++; }
        else if (r2 < 0.37) { E(m, 'post', sd, tx(T.post, { p: nm }), { hero: hFlag }); if (isHero) { hm.sot++; hm.big++; } }
        else if (r2 < 0.78) { E(m, 'miss', sd, tx(T.miss, { p: nm }), { hero: hFlag }); if (isHero && R() < 0.3) hm.big++; }
        else E(m, 'block', sd, tx(T.block, { p: nm }), { hero: hFlag });
      }
    }
    function cardCheck(m) {
      if (R() > 0.19) return;
      var sd = R() < 0.5 ? 'h' : 'a';
      var arr = xi[sd].filter(function (e) { return !sent[sd][e.p.i]; });
      var e = U.wpick(arr, function (e) {
        var g = C.POS_GRP[e.slot], w = g === 'D' ? 1.5 : g === 'M' ? 1.2 : g === 'F' ? 0.6 : 0.1;
        if (e.p.i === 0) w *= (100 - hero.at.dis) / 45 + 0.2;
        return w;
      });
      var p = e.p, id = p.i, isH = id === 0;
      var pRed = 0.035 * (isH ? (100 - hero.at.dis) / 45 : 1);
      var rr = R();
      if (rr < pRed) { sent[sd][id] = 1; E(m, 'red', sd, tx(T.red, { p: nameOf(p), t: tname(sd) }), { hero: isH ? 1 : 0, pid: id }); if (isH) { hm.rc++; hm.out = true; hm.min = m; } p.su = (p.su || 0) + (isH ? 0 : U.int(1, 3)); rt = recalc(); return; }
      if (rr < 0.55) {
        if (cards[sd][id]) {
          sent[sd][id] = 1; E(m, 'yellow', sd, 'Segunda amarilla para ' + nameOf(p) + ' ('+ tname(sd) + '): ¡expulsado!', { hero: isH ? 1 : 0, pid: id, red2: 1 });
          if (isH) { hm.yc++; hm.rc++; hm.out = true; hm.min = m; } rt = recalc();
        } else {
          cards[sd][id] = 1; E(m, 'yellow', sd, tx(T.yellow, { p: nameOf(p), t: tname(sd) }), { hero: isH ? 1 : 0, pid: id });
          if (isH) hm.yc++; else p.yc = (p.yc || 0) + 1;
        }
      }
    }
    function injCheck(m) {
      ['h', 'a'].forEach(function (sd) {
        if (R() > 0.0011) return;
        var arr = xi[sd].filter(function (e) { return !sent[sd][e.p.i]; });
        var e = U.wpick(arr, function (e) { return e.p.i === 0 ? 1 + hero.fat / 60 : 1; });
        var p = e.p, isH = p.i === 0;
        E(m, 'inj', sd, tx(T.inj, { p: nameOf(p), t: tname(sd) }), { hero: isH ? 1 : 0 });
        sent[sd][p.i] = 1; // sale del campo
        if (isH) { hm.inj = 1; hm.out = true; hm.min = m; }
        else p.inj = R() < 0.7 ? U.int(1, 4) : U.int(5, 14);
        rt = recalc();
        doSub(m, sd, e, true);
      });
    }
    function doSub(m, sd, outE, forced) {
      if (subs[sd] >= 5) return;
      var cand = bench[sd]; if (!cand.length) return;
      var g = C.POS_GRP[outE.slot];
      var pick = null, bv = -1;
      cand.forEach(function (p) { if (p.i === 0 && !forced) return; var v = p.o - fitPen(p.p, outE.slot); if (v > bv) { bv = v; pick = p; } });
      if (!pick) return;
      bench[sd] = cand.filter(function (p) { return p !== pick; });
      var idx = xi[sd].indexOf(outE);
      xi[sd][idx] = { p: pick, slot: outE.slot };
      subs[sd]++;
      E(m, 'sub', sd, tx(T.sub, { t: tname(sd), p: nameOf(pick), q: nameOf(outE.p) }), { hero: (pick.i === 0 || outE.p.i === 0) ? 1 : 0 });
      rt = recalc();
    }
    var heroInMin = null, heroOutMin = null;
    if (heroSide && ctx.role === 'bench') {
      var pr = ctx.benchP != null ? ctx.benchP : 0.7;
      if (R() < pr) heroInMin = U.int(55, 82);
    }
    if (heroSide && ctx.role === 'starter') {
      var tired = heroStam < 45;
      if (tired || R() < 0.38) heroOutMin = tired ? U.int(62, 78) : U.int(66, 88);
    }
    var subMins = { h: [U.int(58, 66), U.int(70, 76), U.int(80, 86)], a: [U.int(58, 66), U.int(70, 76), U.int(80, 86)] };
    var ref = { h: [], a: [] };

    E(0, 'start', null, 'Comienza el partido: ' + tname('h') + ' vs ' + tname('a') + '.');
    var total = 90 + U.int(2, 5), half = false, m;
    var tempo = 0.22;
    for (m = 1; m <= total; m++) {
      if (m === 46 && !half) { half = true; E(45, 'ht', null, 'Descanso: ' + tname('h') + ' ' + goals.h + ' - ' + goals.a + ' ' + tname('a') + '.'); }
      // fatiga del héroe
      if (hm.in && !hm.out) { heroStam -= 0.34 * (1 - (hero.at.res - 40) / 140); hm.min = m; }
      // cambios del héroe
      if (heroInMin === m && !hm.in) {
        var sd0 = heroSide, cand0 = xi[sd0].filter(function (e) { return !sent[sd0][e.p.i] && C.POS_GRP[e.slot] === C.POS_GRP[hero.matchSlot()]; });
        var outE = cand0.length ? cand0.sort(function (a, b) { return a.p.o - b.p.o; })[0] : null;
        if (outE) {
          var bi = bench[sd0].indexOf(S.pl[0]); if (bi >= 0) bench[sd0].splice(bi, 1);
          xi[sd0][xi[sd0].indexOf(outE)] = { p: S.pl[0], slot: outE.slot };
          subs[sd0]++; hm.in = true; hm.subIn = m; hm.min = m;
          E(m, 'sub', sd0, tx(T.sub, { t: tname(sd0), p: hero.nm, q: nameOf(outE.p) }), { hero: 1 });
          rt = recalc();
        }
      }
      if (heroOutMin === m && hm.in && !hm.out) {
        var e0 = xi[heroSide].filter(function (e) { return e.p.i === 0; })[0];
        if (e0) { doSub(m, heroSide, e0, false); hm.out = true; hm.subOut = m; hm.min = m; }
      }
      // cambios de la IA
      ['h', 'a'].forEach(function (sd) {
        var arr = subMins[sd];
        for (var k = 0; k < arr.length; k++) if (arr[k] === m) {
          var cands = xi[sd].filter(function (e) { return !sent[sd][e.p.i] && e.p.i !== 0 && C.POS_GRP[e.slot] !== 'G'; });
          if (cands.length) doSub(m, sd, cands[Math.floor(R() * cands.length)], false);
          arr[k] = -1;
        }
      });
      // posesión
      var mh = rt.h.mid + rt.h.off * 0.4 + (adv * 0.5) + mentH * 2, ma = rt.a.mid + rt.a.off * 0.4 + mentA * 2;
      var ph = U.clamp(0.5 + (mh - ma) * 0.012, 0.25, 0.75);
      var sd = R() < ph ? 'h' : 'a';
      var trailing = sd === 'h' ? goals.h < goals.a : goals.a < goals.h;
      var t = tempo * (trailing && m > 70 ? 1.25 : 1);
      if (R() < t) {
        // el héroe participa en jugadas de su equipo
        if (heroSide === sd && hm.in && !hm.out && R() < 0.09) {
          E(m, 'chance', sd, tx(T.chanceH, { p: hero.nm, t: tname(sd) }), { hero: 1 });
          if (R() < 0.5) hm.kp++;
        }
        attack(m, sd, sd === 'h' ? 1 + mentH * 0.05 : 1 + mentA * 0.05);
      }
      if (m % 4 === 0) cardCheck(m);
      injCheck(m);
    }
    var finalMin = total;
    E(finalMin, 'end', null, 'Final del partido: ' + tname('h') + ' ' + goals.h + ' - ' + goals.a + ' ' + tname('a') + '.');
    // prórroga y penales
    var out = { hs: goals.h, as: goals.a };
    var needW = f.k && FP.Comp.needsWinner(comp, f, goals.h, goals.a);
    if (needW) {
      E(90, 'et', null, 'Termina el tiempo reglamentario. Se jugará prórroga.');
      for (m = 91; m <= 120; m++) {
        if (hm.in && !hm.out) { heroStam -= 0.45; hm.min = m; }
        var mh2 = rt.h.mid + rt.h.off * 0.4, ma2 = rt.a.mid + rt.a.off * 0.4;
        var sd2 = R() < U.clamp(0.5 + (mh2 - ma2) * 0.012, 0.3, 0.7) ? 'h' : 'a';
        if (R() < tempo * 0.55) attack(m, sd2, 0.9);
      }
      out.hs = goals.h; out.as = goals.a; out.et = 1;
      var sv = [f.hs, f.as]; f.hs = out.hs; f.as = out.as; var ag2 = FP.Comp.tieAgg(comp, f); f.hs = sv[0]; f.as = sv[1];
      if (ag2.a === ag2.b) {
        var ps = Match.shootout(st.h, st.a); out.ps = ps;
        E(120, 'pens', null, 'Tanda de penales: ' + tname('h') + ' ' + ps[0] + ' - ' + ps[1] + ' ' + tname('a') + '.');
      }
      E(120, 'end', null, 'Final de la prórroga: ' + tname('h') + ' ' + out.hs + ' - ' + out.as + ' ' + tname('a') + '.');
    }
    out.ev = ev; out.xi = xi0;
    out.form = { h: lu.h.form, a: lu.a.form };
    out.bench = { h: bench.h.map(function (p) { return { n: nameOf(p), pos: p.p, id: p.i }; }), a: bench.a.map(function (p) { return { n: nameOf(p), pos: p.p, id: p.i }; }) };
    out.stam = heroStam;
    // rating del héroe
    if (heroSide) {
      var side = heroSide, opp = side === 'h' ? 'a' : 'h';
      var played = hm.in;
      hm.played = played;
      if (played) {
        var gd = goals[side] - goals[opp];
        var r = 6.1 + hm.g * 1.15 + hm.a * 0.75 + hm.kp * 0.12 + hm.sot * 0.06 - hm.big * 0.12 + (gd > 0 ? 0.35 : gd < 0 ? -0.3 : 0) - hm.yc * 0.2 - hm.rc * 1.2 + U.norm() * 0.45;
        r += (hero.cur(hero.matchSlot(), 1) - C.strOf(teamIds[opp])) * 0.012;
        hm.rating = Math.round(U.clamp(r, 3.0, 10.0) * 10) / 10;
        hm.min = hm.out ? hm.min : (hm.subIn ? Math.max(1, finalMin - hm.subIn + 1) : finalMin);
        if (hm.subOut) hm.min = hm.subOut - (hm.subIn || 0);
        else if (hm.rc && !hm.subOut) hm.min = hm.min - (hm.subIn || 0);
        if (needW) hm.min += 30;
        hm.min = U.clamp(hm.min, 1, needW ? 120 : finalMin);
      }
      hm.stam = heroStam;
      out.hero = hm;
    }
    return out;
  };

  // equipo genérico (selección, amateur, juvenil): 11 jugadores inventados con la fuerza del equipo
  Match.genericLineup = function (id, comp) {
    var st = strFor(comp, id), form = FORMS['4-3-3'], xi = [], bench = [], nat = null, t = C.team(id);
    var region = t && t.c ? t.c : (id >= 30000 ? FP.S.clubs[id - 30000].c : 'CHI');
    var r = U.mulberry(U.hash(FP.S.seed, id, FP.S.week));
    form.forEach(function (sl) {
      xi.push({ p: { i: -(id * 20 + xi.length + 1), n: FP.Names.gen(region, r), o: Math.round(st + U.norm(r) * 2.5), p: sl, nat: region }, slot: sl });
    });
    for (var i = 0; i < 7; i++) bench.push({ i: -(id * 20 + 12 + i), n: FP.Names.gen(region, r), o: Math.round(st - 4 + U.norm(r) * 2), p: i === 0 ? 'GK' : U.pick(['CB', 'CM', 'LW', 'ST', 'RB'], r), nat: region });
    return { xi: xi, bench: bench, form: '4-3-3', generic: true };
  };

  // aplica un resultado detallado al fixture
  Match.apply = function (comp, f, res) {
    f.hs = res.hs; f.as = res.as;
    if (res.et) f.et = 1;
    if (res.ps) f.ps = res.ps;
    FP.Comp.finish(comp, f);
  };
})();
