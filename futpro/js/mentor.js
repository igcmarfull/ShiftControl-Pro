/* FUTPRO — protegido: un hijo del jugador retirado o una promesa que apadrina. Crece como cualquier jugador del mundo
   (reserva de promesas → club), y cada año tus decisiones de formación mueven su progresión y el vínculo contigo. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, Dec = FP.Dec, P = FP.Post;
  var M = FP.Mentor = {};

  M.get = function () { var h = FP.S && FP.S.hero, p = h && h.post; return p && p.prot ? p.prot : null; };
  M.player = function () { var pr = M.get(); return pr ? FP.S.pl[pr.pid] || null : null; };
  M.lastName = function () { var nm = String(FP.S.hero.nm || '').trim().split(/\s+/); return nm.length > 1 ? nm[nm.length - 1] : null; };
  M.canSon = function () { var p = P.ensure(); return FP.S.hero.retired && !p.sonDone; };

  // el hijo hereda parte del nivel máximo del jugador y de su posición
  M.createSon = function () {
    var S = FP.S, h = S.hero, p = P.ensure(), lg = p.legacy || P.legacy(), nat = h.nat;
    var q = FP.Youth.makePros(nat, 12);
    var fn = FP.Names.gen(nat).split(' ')[0], ln = M.lastName() || FP.Names.gen(nat).split(' ').slice(1).join(' ');
    q.n = fn + ' ' + ln; q.p = R() < 0.6 && h.pos !== 'GK' ? h.pos : q.p;
    q.pt = U.clamp(Math.round(0.4 * lg.peak + 0.6 * FP.Youth.natLevel(nat) + U.norm() * 5), 40, 95);
    q.o = U.clamp(Math.round(q.pt * FP.Youth.f(12) - 5 + 2 * U.norm()), 25, q.pt);
    q.prot = 1; q.son = 1; delete q.cl;
    p.sonDone = true; p.prot = { pid: q.i, kind: 'hijo', since: S.week, bond: 70, plan: 'equilibrado', hist: [], max: q.o, club: null };
    h.history.push({ w: S.week, t: 'Tu hijo ' + q.n + ' empieza a jugar al fútbol.' });
    return q;
  };
  M.candidates = function () {
    var S = FP.S, nat = S.hero.nat;
    return S.pl.filter(function (q) { return q && q.c === -3 && !q.prot && q.nat === nat && C.age(q) >= 12 && C.age(q) <= 16; }).sort(function (a, b) { return b.pt - a.pt + (R() - 0.5) * 8; }).slice(0, 3);
  };
  M.adopt = function (pid) {
    var S = FP.S, q = S.pl[pid], p = P.ensure(); if (!q || p.prot) return { ok: false, msg: 'Ya tienes un protegido.' };
    q.prot = 1; p.prot = { pid: pid, kind: 'promesa', since: S.week, bond: 55, plan: 'equilibrado', hist: [], max: q.o, club: null };
    S.hero.history.push({ w: S.week, t: 'Comienzas a apadrinar a ' + q.n + '.' });
    return { ok: true, msg: 'Ahora apadrinas a ' + q.n + '.' };
  };
  M.release = function () { var p = P.ensure(), q = M.player(); if (q) delete q.prot; if (p.prot) { p.prot.ended = FP.S.week; p.protHist = (p.protHist || []).concat([p.prot]); } p.prot = null; };

  M.PLANS = { intensivo: { nm: 'Intensivo', d: 'Mucho trabajo: progresa más rápido, pero la presión desgasta el vínculo.', g: 1.4, b: -6 }, equilibrado: { nm: 'Equilibrado', d: 'Entrena, estudia y juega: crecimiento sostenido.', g: 0.9, b: 1 }, tranquilo: { nm: 'Tranquilo', d: 'Disfruta del fútbol sin presión: crece menos, pero el vínculo se fortalece.', g: 0.5, b: 5 } };
  M.setPlan = function (k) { var pr = M.get(); if (!pr || !M.PLANS[k]) return { ok: false, msg: '' }; pr.plan = k; return { ok: true, msg: 'Plan de formación: ' + M.PLANS[k].nm.toLowerCase() + '.' }; };

  // cierre anual: aplica el plan, registra la temporada y lanza decisiones
  M.yearTick = function () {
    var S = FP.S, h = S.hero, pr = M.get(), q = M.player(); if (!pr) return;
    if (!q || q.c === -2) { h.history.push({ w: S.week, t: (q ? q.n : 'Tu protegido') + ' se retira del fútbol.' }); M.release(); return; }
    var age = C.age(q), plan = M.PLANS[pr.plan] || M.PLANS.equilibrado;
    if (age <= 22 && q.o < q.pt) { var g = plan.g * (0.5 + pr.bond / 100 * 0.8) * (age <= 17 ? 1.1 : 0.8) * (1 + (P.ability() - 55) / 120); q.o = Math.min(q.pt, Math.round(q.o + g + U.norm() * 0.5)); }
    pr.bond = U.clamp(pr.bond + plan.b + (pr.kind === 'hijo' ? 1 : 0), 0, 100);
    pr.max = Math.max(pr.max, q.o);
    pr.hist.push({ w: S.week, y: D.year(S.week), age: age, o: q.o, club: q.c >= 0 ? q.c : null });
    if (pr.bond < 12) { h.history.push({ w: S.week, t: q.n + ' se aleja de tu tutela.' }); FP.Hero.msg(q.n + ' ya no quiere que lo guíes.', 'warn'); M.release(); return; }
    // debut profesional
    if (q.c === -3 && age >= 17 && (age >= 19 || q.o >= 55)) {
      var su = FP.Agency.suitors(Object.assign({}, q, { c: -3 })), club = su[0] || FP.S.clubs.filter(function (c) { return c.c === h.nat && Math.abs(c.st - q.o) < 8; })[0];
      if (club) { Dec.add({ kind: 'protegido', uniq: 'club' + q.i + D.year(S.week), title: q.n + ' está listo para dar el salto', text: 'Con ' + age + ' años y media ' + q.o + ', varios clubes lo quieren. ¿Dónde empieza?', def: 'a', exp: 20, data: { pid: q.i, clubs: su.slice(0, 3).map(function (c) { return c.id; }).concat(su.length ? [] : [club.id]) }, opts: (su.length ? su.slice(0, 3) : [club]).map(function (c, i) { return { k: 'c' + i, label: c.nm + ' (' + C.cname(c.c) + ')', hint: 'Nivel del club ' + Math.round(c.st) + (c.st > q.o + 4 ? ': mucha exigencia, pocos minutos al inicio.' : c.st < q.o - 4 ? ': jugará mucho pero crecerá menos.' : ': equilibrio entre exigencia y minutos.') }; }) }); }
    } else if (age < 17 && R() < 0.5) {
      Dec.add({ kind: 'protegido', uniq: 'plan' + q.i + D.year(S.week), title: 'Plan de formación de ' + q.n, text: pr.kind === 'hijo' ? 'Lleva tu apellido y siente la presión. ¿Cómo lo acompañas este año?' : 'Elige cómo guías su formación este año.', def: 'equilibrado', exp: 12, data: { pid: q.i },
        opts: Object.keys(M.PLANS).map(function (k) { return { k: k, label: M.PLANS[k].nm, hint: M.PLANS[k].d }; }) });
    }
    if (q.c >= 0 && age <= 23 && R() < 0.3) {
      Dec.add({ kind: 'protegido', uniq: 'cons' + q.i + D.year(S.week), title: q.n + ' te pide un consejo', text: 'Atraviesa un momento importante en ' + (S.clubs[q.c] ? S.clubs[q.c].nm : 'su club') + '.', def: 'escuchar', exp: 10, data: { pid: q.i },
        opts: [{ k: 'escuchar', label: 'Escucharlo y apoyarlo', hint: 'Sube el vínculo.' }, { k: 'exigir', label: 'Exigirle más', hint: 'Puede subir su nivel o dañar el vínculo.' }] });
    }
  };
  Dec.handlers.protegido = function (k, d) {
    var S = FP.S, pr = M.get(), q = S.pl[d.data.pid]; if (!pr || !q || pr.pid !== q.i) return { ok: true, msg: '' };
    if (/^c\d/.test(k)) { var club = S.clubs[d.data.clubs[+k.slice(1)]] || S.clubs[d.data.clubs[0]]; if (!club) return { ok: true, msg: '' }; FP.Agency.move(q, club.id); pr.club = club.id; pr.bond = Math.min(100, pr.bond + 4); S.hero.history.push({ w: S.week, t: q.n + ' debuta en ' + club.nm + '.' }); FP.Sim.news(q.n + ' (apadrinado por ' + S.hero.nm + ') ficha por ' + club.nm + '.', 'transfer', 1); return { ok: true, msg: q.n + ' firma con ' + club.nm + '.' }; }
    if (M.PLANS[k]) { pr.plan = k; return { ok: true, msg: 'Plan de formación: ' + M.PLANS[k].nm.toLowerCase() + '.' }; }
    if (k === 'escuchar') { pr.bond = Math.min(100, pr.bond + 6); return { ok: true, msg: q.n + ' se siente respaldado.' }; }
    if (k === 'exigir') { if (R() < 0.5) { q.o = Math.min(q.pt, q.o + 1); pr.bond -= 2; return { ok: true, msg: 'Tu exigencia da frutos: ' + q.n + ' sube su nivel.' }; } pr.bond -= 8; return { ok: true, msg: 'Tu exigencia lo agobia: el vínculo se resiente.' }; }
    return { ok: true, msg: '' };
  };
  M.migrate = function () { };

  var yt0 = P.yearTick;
  P.yearTick = function () { var r = yt0.apply(this, arguments); try { M.yearTick(); } catch (e) { if (window.console) console.warn('mentor', e); } return r; };
})();
