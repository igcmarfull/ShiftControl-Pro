/* FUTPRO — retiro en profundidad: salud y vida tras el fútbol, escalera de entrenador, presidencia con cuentas,
   reencuentros con excompañeros y rivales, y cierre de carrera (salón de la fama entre partidas, tarjeta y versión imprimible).
   Se apoya en Post (postcareer), Coach (coaching), Paths2, Dinero y Bio; no duplica su lógica, la envuelve.
   Todos los umbrales, costos y porcentajes son supuestos de diseño calibrados en tests/retiro.js, no datos reales. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, Dec = FP.Dec, Sim = FP.Sim, P = FP.Post, X = FP.Paths2, K = FP.Coach, Hero = FP.Hero;
  var RT = FP.Retiro = {};

  function hero() { return FP.S && FP.S.hero; }
  function path() { var h = hero(), p = h && h.post; return p && p.path; }
  function tierOf(c) { return Math.min(5, FP.LGDEF[c.lg].t); }
  function fm(v) { return FP.fmt.money(v); }
  function pay(amt, kind, why) { return FP.Contracts.pay(amt, kind, why); }
  function hist(t) { var h = hero(); (h.history = h.history || []).push({ w: FP.S.week, t: t }); }
  function age() { return C.age(hero()); }

  RT.ensure = function () {
    var h = hero(); if (!h) return null;
    if (!h.rt) h.rt = { hid: Math.random().toString(36).slice(2, 10), hl: null, ms: {}, life: [], mates: {}, rivals: {}, snap: -99, trib: null, fit: 0, mateCoach: null, coachBest: 0, tl: [] };
    return h.rt;
  };
  RT.migrate = function () { var rt = RT.ensure(); if (rt && hero().retired && rt.hl == null) RT.onRetire(true); };

  // ---------- compañeros y rivales de la época (se anotan una vez al año mientras juegas) ----------
  RT.snapshot = function (force) {
    var S = FP.S, h = hero(), rt = RT.ensure(); if (!h || (h.retired && !force)) return;
    if (!force && S.week - rt.snap < 52) return;
    var club = h.club != null && h.club < 5000 ? S.clubs[h.club] : null; if (!club || (h.tk === 'free')) return;
    rt.snap = S.week; var y = D.year(S.week);
    (S.ro[club.id] || []).filter(function (p) { return p.i !== 0; }).sort(function (a, b) { return b.o - a.o; }).slice(0, 5).forEach(function (p) {
      var m = rt.mates[p.i] || (rt.mates[p.i] = { n: p.n, y0: y, o: 0 }); m.y1 = y; m.o = Math.max(m.o, p.o); m.club = club.id; m.b = p.b; m.pos = p.p;
    });
    var rv = [];
    S.clubs.forEach(function (c) { if (c.lg !== club.lg || c.id === club.id) return; (S.ro[c.id] || []).forEach(function (p) { if (p.p === h.pos && p.i !== 0) rv.push(p); }); });
    rv.sort(function (a, b) { return b.o - a.o; }).slice(0, 3).forEach(function (p) { var r = rt.rivals[p.i] || (rt.rivals[p.i] = { n: p.n, y0: y, o: 0 }); r.y1 = y; r.o = Math.max(r.o, p.o); r.club = p.c; });
    [rt.mates, rt.rivals].forEach(function (o, i) {
      var ks = Object.keys(o), max = i ? 12 : 40; if (ks.length <= max) return;
      ks.sort(function (a, b) { return o[a].o - o[b].o; }).slice(0, ks.length - max).forEach(function (k) { delete o[k]; });
    });
  };
  var we0 = Hero.weekEnd;
  Hero.weekEnd = function () { var r = we0.apply(this, arguments); try { RT.snapshot(); } catch (e) { if (window.console) console.warn('retiro', e); } return r; };

  // ---------- salud ----------
  RT.health0 = function () {
    var h = hero(), cx = h.cx || {}, ser = 0, wk = 0;
    (cx.injH || []).forEach(function (e) { wk += e.n; if (e.n >= 12) ser++; });
    return U.clamp(Math.round(96 - ser * 3.5 - wk * 0.08 - (h.tot ? h.tot.ap : 0) * 0.01), 38, 95);
  };
  RT.hlLabel = function (v) { return v >= 80 ? 'Excelente' : v >= 65 ? 'Buena' : v >= 50 ? 'Aceptable' : v >= 35 ? 'Delicada' : 'Frágil'; };
  var ab0 = P.ability;
  P.ability = function () { var a = ab0.apply(this, arguments), rt = hero() && hero().rt; return rt && rt.hl != null && rt.hl < 50 ? a - (50 - rt.hl) * 0.2 : a; };

  RT.onRetire = function (silent) {
    var S = FP.S, h = hero(), rt = RT.ensure(); if (!h) return;
    RT.snapshot(true);
    if (rt.hl == null) rt.hl = RT.health0();
    rt.hl0 = rt.hl;
    // homenaje de un rival de la época
    var riv = Object.keys(rt.rivals).map(function (k) { return rt.rivals[k]; }).sort(function (a, b) { return b.o - a.o; })[0];
    if (!riv) { var g = FP.Epilogue ? FP.Epilogue.generation().filter(function (x) { return x.n !== h.nm; })[0] : null; if (g) riv = { n: g.n, o: g.ovr }; }
    var mate = Object.keys(rt.mates).map(function (k) { return rt.mates[k]; }).sort(function (a, b) { return (b.y1 - b.y0) - (a.y1 - a.y0) || b.o - a.o; })[0];
    if (riv && !rt.trib) {
      rt.trib = { n: riv.n, t: riv.n + ', uno de tus grandes rivales de la época, te dedica unas palabras: «Jugar contra ' + h.nm + ' siempre fue una prueba.»' };
      if (mate) rt.trib.t += ' ' + mate.n + ', excompañero tuyo, organiza una cena con el vestuario.';
      if (!silent) { hist('Tu rival ' + riv.n + ' te rinde homenaje.'); Hero.msg(rt.trib.t, 'ok'); Sim.news(riv.n + ' sobre ' + h.nm + ': «Fue un rival que obligaba a dar lo mejor».', 'hero', 2); }
    }
    try { RT.hofSave(); } catch (e) { }
  };
  var ret0 = FP.Events.retire;
  FP.Events.retire = function () { var h = hero(), was = h && h.retired; var r = ret0.apply(this, arguments); if (h && h.retired && !was) { try { RT.onRetire(); } catch (e) { if (window.console) console.warn('retiro', e); } } return r; };

  // ---------- vida por etapas (45 / 55 / 65 años) ----------
  RT.MS = [65, 55, 45];
  RT.situation = function () {
    var D2 = FP.Dinero, rt = RT.ensure(), nw = D2 ? D2.networth() : hero().money, wk = D2 ? D2.weeklyLife() * 52 : 0, run = wk > 0 ? nw / wk : 99, t = [];
    t.push('Tu salud es ' + RT.hlLabel(rt.hl).toLowerCase() + ' (' + Math.round(rt.hl) + '/100).');
    t.push(nw <= 0 ? 'No tienes patrimonio: vives al día.' : run >= 25 ? 'Tu patrimonio (' + fm(Math.round(nw)) + ') cubre con holgura tus gastos.' : run >= 8 ? 'Tu patrimonio (' + fm(Math.round(nw)) + ') cubre tus gastos unos ' + Math.round(run) + ' años.' : 'Tu patrimonio (' + fm(Math.round(nw)) + ') alcanza solo para unos ' + Math.max(1, Math.round(run)) + ' años de tu nivel de vida.');
    return t.join(' ');
  };
  RT.milestone = function () {
    var rt = RT.ensure(), a = age(), m = null;
    for (var i = 0; i < RT.MS.length; i++) if (a >= RT.MS[i] && !rt.ms[RT.MS[i]]) { m = RT.MS[i]; break; }
    if (!m) return;
    RT.MS.forEach(function (x) { if (x <= m) rt.ms[x] = 1; });          // una partida antigua solo recibe la etapa vigente
    var nw = FP.Dinero ? Math.max(0, FP.Dinero.networth()) : 0, S = FP.S, o, title, text;
    if (m === 45) {
      title = 'Los 45: balance de tu cuerpo y tu vida'; text = RT.situation() + ' ¿Cómo encaras esta etapa?';
      o = [{ k: 'salud', label: 'Plan de salud y entrenamiento ligero (' + fm(12) + ')', hint: 'Mejora tu salud y frena su desgaste.' }, { k: 'veteranos', label: 'Partidos con amigos y veteranos', hint: 'Sin costo; mantiene la forma y los vínculos.' }, { k: 'trabajo', label: 'Volcarte al trabajo', hint: 'Más ingresos, pero tu cuerpo lo paga.' }];
    } else if (m === 55) {
      var fc = Math.round(U.clamp(nw * 0.04, 40, 400));
      title = 'Los 55: qué haces con tu tiempo'; text = RT.situation() + ' Con lo que has vivido, puedes devolver algo.';
      o = [{ k: 'fundacion', label: 'Crear una escuela / fundación (' + fm(fc) + ')', hint: 'Cuesta dinero; aumenta tu prestigio y deja huella.' }, { k: 'viajar', label: 'Viajar y descansar (' + fm(25) + ')', hint: 'Mejora tu salud.' }, { k: 'familia', label: 'Estar con tu familia', hint: 'Sin costo; leve mejora de salud.' }];
      o[0].cost = fc;
    } else {
      title = 'Los 65: memorias y despedida definitiva'; text = RT.situation() + ' Es momento de cerrar el relato.';
      o = [{ k: 'libro', label: 'Publicar tus memorias', hint: 'Genera ingresos por derechos y fama.' }, { k: 'embajador', label: 'Ser embajador de tu club histórico', hint: 'Ingresos modestos y un lugar permanente en el club.' }, { k: 'tranquilo', label: 'Retirarte del todo', hint: 'Vida tranquila; leve mejora de salud.' }];
    }
    Dec.add({ kind: 'rt', uniq: 'ms' + m, title: title, text: text, opts: o, def: o[o.length - 1].k, exp: 26, data: { t: 'vida', m: m } });
  };
  function done(txt, m) { var rt = RT.ensure(); rt.life.push({ w: FP.S.week, age: age(), t: txt }); hist(txt); }
  function hl(d) { var rt = RT.ensure(); rt.hl = U.clamp(rt.hl + d, 3, 98); }
  function cost(c) { var h = hero(); if (h.money < c) return false; pay(-c, 'inversion', 'Vida tras el fútbol'); return true; }

  // ---------- eventos de salud ----------
  RT.healthEvent = function () {
    var rt = RT.ensure(), S = FP.S; if (rt.hl >= 85 || Dec.open('rt').some(function (d) { return d.data.t === 'salud'; })) return;
    var p = U.clamp((62 - rt.hl) / 260, 0.02, 0.2); if (R() >= p) return;
    var op = Math.round(40 + Math.max(0, 62 - rt.hl) * 3), grave = rt.hl < 38;
    Dec.add({ kind: 'rt', uniq: 'sal' + S.week, title: grave ? 'Problema de salud serio' : 'Molestias que no ceden', text: grave ? 'Tu estado general se ha deteriorado y los médicos piden intervenir.' : 'Las secuelas de tu carrera vuelven: rodillas, espalda y cansancio.', def: grave ? 'operar' : 'tratar', exp: 12, data: { t: 'salud', op: op },
      opts: [{ k: 'operar', label: 'Operarte y rehabilitarte (' + fm(op) + ')', hint: 'Recuperas bastante salud.' }, { k: 'tratar', label: 'Tratamiento conservador (' + fm(8) + ')', hint: 'Frena el deterioro un poco.' }, { k: 'nada', label: 'Aguantar sin hacer nada', hint: 'Sin costo; la salud empeora.' }] });
  };

  Dec.handlers.rt = function (k, d) {
    var dt = d.data || {}, h = hero(), rt = RT.ensure(), p = P.ensure();
    if (!h || !rt) return { ok: true, msg: '' };
    var m = '';
    if (dt.t === 'vida') {
      if (dt.m === 45) {
        if (k === 'salud') { if (cost(12)) { hl(6); rt.fit = 1; m = 'Cuidas tu cuerpo: sube tu salud.'; done('A los 45 empiezas un plan de salud y entrenamiento ligero.'); } else m = 'No tienes fondos para el plan.'; }
        else if (k === 'veteranos') { hl(2); m = 'Vuelves a jugar con amigos.'; done('A los 45 vuelves a jugar con veteranos y amigos.'); }
        else { P.pay(60, 'Proyectos propios'); hl(-3); m = 'Más trabajo, más ingresos y algo de desgaste.'; done('A los 45 te vuelcas al trabajo.'); }
      } else if (dt.m === 55) {
        if (k === 'fundacion') { var c = (d.opts[0] && d.opts[0].cost) || 60; if (cost(c)) { rt.fund = (rt.fund || 0) + 1; if (h.soc) h.soc.fame = (h.soc.fame || 0) + 4; hl(1); m = 'Fundas una escuela con tu nombre.'; done('A los 55 funda una escuela de fútbol para niños con menos recursos.'); } else m = 'No tienes fondos para la fundación.'; }
        else if (k === 'viajar') { if (cost(25)) { hl(3); m = 'Viajas y descansas.'; done('A los 55 se toma un año para viajar y descansar.'); } else m = 'No tienes fondos para viajar.'; }
        else { hl(2); m = 'Pasas más tiempo con tu familia.'; done('A los 55 prioriza a su familia.'); }
      } else {
        if (k === 'libro') { P.pay(30 + (p.legacy ? p.legacy.score : 0) * 1.2, 'Derechos de autobiografía'); if (h.soc) h.soc.fame = (h.soc.fame || 0) + 3; rt.book = 1; m = 'Publicas tus memorias.'; done('A los 65 publica sus memorias.'); }
        else if (k === 'embajador') { P.pay(40, 'Embajador de club'); rt.amb = 1; m = 'Eres embajador de tu club histórico.'; done('A los 65 es nombrado embajador de su club histórico.'); }
        else { hl(3); m = 'Eliges una vida tranquila.'; done('A los 65 se retira del todo y disfruta de la vida tranquila.'); }
      }
    } else if (dt.t === 'salud') {
      if (k === 'operar') { if (cost(dt.op)) { hl(10); m = 'La operación sale bien.'; done('Se opera y se recupera de sus molestias.'); } else { hl(-2); m = 'No tenías fondos para operarte.'; } }
      else if (k === 'tratar') { if (cost(8)) { hl(1); m = 'El tratamiento ayuda un poco.'; } else hl(-3); }
      else { hl(-4); m = 'Aguantas, pero tu salud empeora.'; }
    } else if (dt.t === 'ascenso') {
      var pa = p.path;
      if (k === 'si' && pa && pa.k === 'coach' && pa.job) {
        var j = pa.job, from = j.club, old = pa.job; P.leave(old);
        pa.job = { club: dt.club, role: dt.role, since: FP.S.week, conf: 65 }; P.takeOver(pa.job);
        hist('Asciende a ' + P.ROLEN[dt.role].toLowerCase() + ' de ' + C.tname(dt.club) + '.'); m = 'Aceptas ser ' + P.ROLEN[dt.role].toLowerCase() + ' de ' + C.tname(dt.club) + '.';
      }
    } else if (dt.t === 'mate_coach') {
      var q = rt.mates[dt.pid], pb = p.path;
      if (k === 'si' && q && pb && pb.job) { rt.mateCoach = { pid: dt.pid, n: q.n, since: FP.S.week, q: dt.q }; hist(q.n + ', tu excompañero, se suma a tu cuerpo técnico.'); m = q.n + ' se suma a tu cuerpo técnico.'; var cl = pb.job.club != null ? FP.S.clubs[pb.job.club] : null; if (cl && (pb.k === 'dir' || pb.k === 'pres')) { rt.mateCoach.prevCo = cl.co; cl.co = q.n; } }
    } else if (dt.t === 'mate_sign') {
      var q2 = FP.S.pl[dt.pid], pc = p.path, job = pc && pc.job;
      if (k === 'si' && q2 && job && q2.c >= 0 && job.club != null) { var fn = RT.fn(); var fee = dt.fee; if (fn && fn.cash < fee) { m = 'La caja del club no alcanza para el fichaje.'; return { ok: false, msg: m }; } if (fn) fn.cash -= fee; var from2 = q2.c; FP.Market.move(q2, job.club, fee, 1); if (FP.Market.rec) FP.Market.rec(q2, from2, job.club, fee, 't'); rt.signed = (rt.signed || 0) + 1; hist('Ficha a ' + q2.n + ', tu excompañero, para ' + C.tname(job.club) + '.'); m = q2.n + ' llega al club.'; }
    } else if (dt.t === 'crisis') {
      var pr = p.path;
      if (k === 'vender' && pr && pr.job) { var cl2 = FP.S.clubs[pr.job.club], back = Math.round((pr.job.paid || 0) * 0.6); if (back > 0) pay(back, 'inversion', 'Venta de ' + cl2.nm); hist('Vendes ' + cl2.nm + ' tras sus problemas económicos.'); pr.job = null; m = 'Vendes el club' + (back ? ' y recuperas ' + fm(back) : '') + '.'; }
    }
    return { ok: true, msg: m };
  };

  // ---------- escalera de entrenador ----------
  RT.LADDER = [{ k: 'l1', n: 'Licencia Nivel 1' }, { k: 'youth', n: 'Entrenador de formativas' }, { k: 'l2', n: 'Licencia Nivel 2' }, { k: 'assist', n: 'Asistente técnico' }, { k: 'l3', n: 'Licencia Pro' }, { k: 'h5', n: 'Director técnico (divisiones inferiores)' }, { k: 'h3', n: 'Director técnico (segunda categoría)' }, { k: 'h1', n: 'Director técnico de primera división' }];
  RT.rung = function () {
    var p = P.ensure(), pa = p.path, rt = RT.ensure(), best = rt.coachBest || 0, cur = 0;
    if (p.lic >= 1) cur = Math.max(cur, 1); if (p.lic >= 2) cur = Math.max(cur, 3); if (p.lic >= 3) cur = Math.max(cur, 5);
    (pa && pa.seasons || []).concat(pa && pa.job ? [{ role: pa.job.role, club: pa.job.club }] : []).forEach(function (s) {
      if (s.club == null) return; var t = tierOf(FP.S.clubs[s.club]);
      var r = s.role === 'youth' ? 2 : s.role === 'assist' ? 4 : t >= 4 ? 6 : t >= 2 ? 7 : 8; cur = Math.max(cur, r);
    });
    rt.coachBest = Math.max(best, cur); return rt.coachBest;
  };
  // los títulos acortan el camino: cursos más cortos y requisitos de experiencia reducidos
  RT.shorten = function () { var p = P.ensure(), s = p.legacy ? p.legacy.score : 0; return U.clamp(s / 260, 0, 0.35); };
  var sc0 = P.startCourse;
  P.startCourse = function (kind) {
    var p = P.ensure(), exp0 = p.exp, s = p.legacy ? p.legacy.score : 0;
    if (kind !== 'agent') { if (p.lic === 1 && s >= 62) p.exp = Math.max(p.exp, 1); if (p.lic === 2 && s >= 80) p.exp = Math.max(p.exp, 2); }
    var r = sc0.apply(this, arguments); p.exp = exp0;
    var pa = p.path; if (r.ok && pa && pa.course && kind !== 'agent') pa.course.left = Math.max(4, Math.round(pa.course.left * (1 - RT.shorten())));
    return r;
  };
  // jugador famoso: un club de primer nivel le ofrece ser asistente con la licencia básica
  var oj0 = P.offerJobs;
  P.offerJobs = function () {
    var r = oj0.apply(this, arguments), S = FP.S, p = P.ensure(), pa = p.path;
    if (pa && pa.k === 'coach' && !pa.job && p.lic === 1 && p.legacy && p.legacy.score >= 62 && !Dec.open('post').some(function (d) { return d.uniq === 'job' + S.week; })) {
      var ex = (p.legacy.clubs || []).map(function (c) { return FP.Game.clubByName(c.nm); }).filter(Boolean).filter(function (c) { return tierOf(c) <= 3; });
      if (ex[0]) Dec.add({ kind: 'post', uniq: 'job' + S.week, title: 'Un club histórico te llama', text: 'Tu nombre abre puertas: te ofrecen incorporarte al cuerpo técnico aun con la licencia básica.', opts: [{ k: 'j0', label: 'Asistente técnico · ' + ex[0].nm, hint: 'Sueldo estimado ' + fm(Math.round({ 1: 2000, 2: 700, 3: 250 }[tierOf(ex[0])] * 0.35)) + ' al año.' }, { k: 'no', label: 'Seguir esperando', hint: '' }], def: 'no', exp: 20, data: { cand: [{ club: ex[0].id, role: 'assist' }] } });
    }
    return r;
  };
  // confianza de la directiva en el cargo de director técnico
  var kf0 = K.finish;
  K.finish = function (prep, res) {
    var r = kf0.apply(this, arguments), j = K.job(); if (!j) return r;
    var mine = prep.home ? res.hs : res.as, opp = prep.home ? res.as : res.hs, S = FP.S, h = hero();
    if (j.conf == null) j.conf = 60;
    if (j.club == null) {            // selección: confianza de la federación
      // la federación mide contra lo esperado: una selección débil no pierde la confianza por perder con favoritos
      var w0 = res.ps ? (prep.home ? res.ps[0] > res.ps[1] : res.ps[1] > res.ps[0]) : mine > opp, l0 = res.ps ? !w0 : mine < opp;
      var sd = K.str(prep, prep.mine) - K.str(prep, prep.opp), ex = 1 / (1 + Math.pow(10, -sd / 14)), sc0 = w0 ? 1 : l0 ? 0 : 0.5;
      j.conf = U.clamp(j.conf + (sc0 - ex) * 16, 0, 100); j.n = (j.n || 0) + 1;
      if (j.conf <= 12 && j.n >= 12) { var pa0 = P.ensure().path; hist('Destituido como seleccionador de ' + S.nat[j.nat - 5000].nm + '.'); Hero.msg('La federación te destituye por los malos resultados.', 'warn'); pa0.seasons.push({ y: String(D.year(S.week)), nat: j.nat, cat: j.cat, role: 'sel', res: 'Destituido', mid: 1 }); pa0.job = null; }
      return r;
    }
    var w = res.ps ? (prep.home ? res.ps[0] > res.ps[1] : res.ps[1] > res.ps[0]) : mine > opp, l = res.ps ? !w : mine < opp;
    j.conf = U.clamp(j.conf + (w ? 5 : l ? -5 : 0) + (RT.ensure().mateCoach ? 0.5 : 0), 0, 100);
    j.n = (j.n || 0) + 1;
    if (j.conf <= 15 && j.n >= 8) {
      var club = S.clubs[j.club], pa = P.ensure().path;
      hist('Destituido de ' + club.nm + ' a mitad de temporada.'); Hero.msg('La directiva te destituye de ' + club.nm + ' por los malos resultados.', 'warn');
      pa.seasons.push({ y: FP.Market.seasonLabel(), club: j.club, role: 'head', res: 'Despedido', rank: 0, n: 0, rec: j.rec || null, mid: 1 });
      P.leave(j); pa.job = null; RT.ensure().mateCoach = null;
    }
    return r;
  };
  var kb0 = K.boost;
  K.boost = function () { var b = kb0.apply(this, arguments), rt = hero() && hero().rt; return rt && rt.mateCoach ? b + 0.4 : b; };

  function bigger(club, role) {
    var S = FP.S, h = hero(), t = tierOf(club), ex = ((P.ensure().legacy || {}).clubs || []).map(function (c) { return FP.Game.clubByName(c.nm); }).filter(Boolean);
    return S.clubs.filter(function (c) { return c.id !== club.id && (c.c === h.nat || ex.indexOf(c) >= 0) && (tierOf(c) < t || (tierOf(c) === t && c.st > club.st + 3)) && tierOf(c) >= Math.max(1, t - 1); })
      .sort(function (a, b) { return (ex.indexOf(b) >= 0) - (ex.indexOf(a) >= 0) || R() - 0.5; }).slice(0, 2);
  }
  RT.promo = function () {
    var S = FP.S, p = P.ensure(), pa = p.path; if (!pa || pa.k !== 'coach' || !pa.job || !pa.seasons.length) return;
    var last = pa.seasons[pa.seasons.length - 1], good = last.res === 'Campeón' || last.res === 'Ascenso' || last.res === 'Zona alta';
    // con licencia para el siguiente escalón, dos temporadas en el mismo cargo y club también abren la puerta
    var same = pa.seasons.filter(function (x) { return x.club === pa.job.club && x.role === pa.job.role; }).length; if (same >= 2) good = true;
    if (!good || Dec.open('rt').some(function (d) { return d.data.t === 'ascenso'; })) return;
    var j = pa.job, club = S.clubs[j.club], opts = [], data;
    if (j.role === 'youth' && p.lic >= 2) { opts.push({ k: 'si', label: 'Subir a asistente técnico en ' + club.nm, hint: 'Más sueldo y responsabilidad.' }); data = { club: j.club, role: 'assist' }; }
    else if (j.role === 'assist' && (p.lic >= 3 || (p.lic >= 2 && tierOf(club) >= 4))) { opts.push({ k: 'si', label: 'Asumir como director técnico de ' + club.nm, hint: 'Dirigirás los partidos con el motor real.' }); data = { club: j.club, role: 'head' }; }
    else if (j.role === 'head') { var b = bigger(club, 'head')[0]; if (b) { opts.push({ k: 'si', label: 'Dirigir a ' + b.nm + ' (' + FP.LGDEF[b.lg].n + ')', hint: 'Un club mayor; más exigencia y sueldo.' }); data = { club: b.id, role: 'head' }; } }
    if (!data) return;
    opts.push({ k: 'no', label: 'Seguir donde estás', hint: '' });
    Dec.add({ kind: 'rt', uniq: 'asc' + S.week, title: 'Te ofrecen dar un paso adelante', text: same >= 2 && last.res !== 'Campeón' && last.res !== 'Zona alta' ? 'Llevas ' + same + ' temporadas en el mismo cargo y tienes la licencia para dar el salto.' : 'Tu temporada (' + last.res.toLowerCase() + ') no pasó inadvertida.', opts: opts, def: 'no', exp: 52, data: { t: 'ascenso', club: data.club, role: data.role } });
  };
  var olc0 = Sim.onLeagueClosed;
  Sim.onLeagueClosed = function (comp, entry) {
    if (olc0) olc0(comp, entry);
    try {
      var j = K.job(), mine = j && j.club != null && FP.S.clubs[j.club].lg === comp.lg;      // solo al cerrar la liga de su propio club
      if (mine) {
        j.conf = 60 + ((j.conf == null ? 60 : j.conf) - 60) * 0.5;
        if (RT.ensure().mateCoach) j.conf = Math.min(100, j.conf + 3);
        RT.promo();
      }
      RT.presClose(comp, entry);
    } catch (e) { if (window.console) console.warn('retiro', e); }
  };
  var yt0 = P.yearTick;
  P.yearTick = function () { var r = yt0.apply(this, arguments); try { RT.promo(); } catch (e) { if (window.console) console.warn('retiro', e); } return r; };

  // ---------- presidencia con cuentas ----------
  RT.fn = function () {
    var pa = path(); if (!pa || pa.k !== 'pres' || !pa.job || pa.job.club == null) return null;
    var j = pa.job; if (!j.fn) j.fn = { cash: Math.round(0.15 * RT.wageBill(FP.S.clubs[j.club])), st: 0, ap: 0, y: [], crisis: 0, buys: 0, sales: 0, tx: [] };
    return j.fn;
  };
  RT.wageBill = function (club) { return Math.round((FP.S.ro[club.id] || []).reduce(function (s, p) { return s + P.wageEst(p); }, 0)); };
  RT.income = function (club, fn) { return Math.round(RT.wageBill(club) * 1.28 * (0.88 + club.fin * 0.025) * (1 + 0.07 * fn.st)); };
  RT.costs = function (club) { var wb = RT.wageBill(club); return Math.round(wb * (1.18 + club.ac * 0.008)); };
  RT.stadiumCost = function (club, fn) { return Math.round(RT.wageBill(club) * (0.35 + 0.25 * fn.st)); };
  RT.academyCost = function (club) { return Math.round(RT.wageBill(club) * (0.12 + 0.05 * club.ac)); };
  RT.price = function (club) { return Math.max(100 + (6 - tierOf(club)) * 120, Math.round(RT.wageBill(club) * 0.5)); };
  RT.presClose = function (comp, entry) {
    var S = FP.S, h = hero(), fn = RT.fn(); if (!fn) return;
    var club = S.clubs[path().job.club]; if (comp.lg !== club.lg) return;
    var tab = entry.tab, rank = tab.indexOf(club.id) + 1, n = tab.length, champ = entry.ch === club.id, dn = entry.dn.indexOf(club.id) >= 0;
    var wb = RT.wageBill(club), bonus = Math.round(wb * (champ ? 0.12 : rank <= Math.ceil(n * 0.3) ? 0.05 : dn ? -0.1 : 0));
    var inc = RT.income(club, fn) + bonus, cs = RT.costs(club), net = inc - cs;
    fn.cash += net; var cov = 0, div = 0;
    if (fn.cash < 0) {
      cov = -fn.cash;
      if (h.money >= cov) { pay(-cov, 'inversion', 'Capital para ' + club.nm); fn.cash = 0; fn.inj = (fn.inj || 0) + cov; }
      else { fn.crisis++; club.fin = Math.max(1, club.fin - 1); fn.cash = 0; Hero.msg(club.nm + ' tiene un agujero económico que no puedes cubrir.', 'warn'); }
    } else if (fn.cash > wb * 1.2) { div = Math.round((fn.cash - wb * 1.2) * 0.5); fn.cash -= div; pay(div, 'post', 'Dividendos de ' + club.nm); }
    else if (net > 0) fn.crisis = Math.max(0, fn.crisis - 1);
    fn.y.push({ y: comp.label, inc: inc, cost: cs, net: net, cov: Math.round(cov), div: div, rank: rank, n: n });
    if (fn.crisis >= 2) { fn.crisis = 0; Dec.add({ kind: 'rt', uniq: 'cri' + S.week, title: club.nm + ' en crisis económica', text: 'Dos temporadas seguidas con pérdidas que no logras cubrir. ¿Sigues al frente?', def: 'vender', exp: 16, data: { t: 'crisis' }, opts: [{ k: 'vender', label: 'Vender el club', hint: 'Recuperas parte de lo invertido.' }, { k: 'seguir', label: 'Seguir', hint: 'El club sigue mal.' }] }); }
  };
  RT.targets = function () {
    var S = FP.S, fn = RT.fn(), club = fn && S.clubs[path().job.club]; if (!club) return [];
    var ro = S.ro[club.id] || [], need = {}; C.POS.forEach(function (ps) { need[ps] = Math.max.apply(null, [0].concat(ro.filter(function (p) { return p.p === ps; }).map(function (p) { return p.o; }))); });
    var out = [];
    for (var i = 0; i < 400 && out.length < 60; i++) {
      var q = S.pl[1 + Math.floor(R() * (S.pl.length - 1))];
      if (!q || q.c < 0 || q.c >= 5000 || q.c === club.id || C.age(q) < 18 || C.age(q) > 33) continue;
      if (q.o < club.st - 3 || q.o > club.st + 9 || tierOf(S.clubs[q.c]) < tierOf(club) - 1) continue;
      if (out.some(function (x) { return x.i === q.i; })) continue; out.push(q);
    }
    out.sort(function (a, b) { return (b.o - need[b.p] * 0.3) - (a.o - need[a.p] * 0.3) + (R() - 0.5) * 3; });
    return out.slice(0, 6).map(function (q) { return { pid: q.i, fee: RT.fee(q) }; });
  };
  RT.fee = function (q) { return Math.round(C.value(q.o, q.pt, C.age(q)) * 1.05); };
  RT.buy = function (pid, fee) {
    var S = FP.S, fn = RT.fn(), job = path().job, club = S.clubs[job.club], q = S.pl[pid]; if (!fn || !q) return { ok: false, msg: 'Fichaje no disponible.' };
    if (q.c === club.id || q.c < 0) return { ok: false, msg: 'Ese jugador ya no está disponible.' };
    if ((S.ro[club.id] || []).length >= 28) return { ok: false, msg: 'El plantel está completo (28). Vende a alguien antes.' };
    fee = fee != null ? fee : RT.fee(q); if (fn.cash < fee) return { ok: false, msg: 'La caja del club (' + fm(fn.cash) + ') no alcanza para ' + fm(fee) + '. Inyecta capital.' };
    var from = q.c; fn.cash -= fee; FP.Market.move(q, club.id, fee, 3); if (FP.Market.rec) FP.Market.rec(q, from, club.id, fee, 't'); fn.buys++; fn.tx.unshift({ w: S.week, t: 'Compra', n: q.n, v: fee }); fn.tx.length = Math.min(fn.tx.length, 12);
    hist('Tu club ' + club.nm + ' ficha a ' + q.n + ' por ' + fm(fee) + '.'); C.calcStr(club); return { ok: true, msg: q.n + ' llega a ' + club.nm + ' por ' + fm(fee) + '.' };
  };
  RT.sell = function (pid) {
    var S = FP.S, fn = RT.fn(), job = path().job, club = S.clubs[job.club], q = S.pl[pid]; if (!fn || !q || q.c !== club.id) return { ok: false, msg: 'Jugador no disponible.' };
    if ((S.ro[club.id] || []).length <= 18) return { ok: false, msg: 'Con menos de 18 jugadores no puedes vender.' };
    var price = Math.round(C.value(q.o, q.pt, C.age(q)) * 0.9), buyers = S.clubs.filter(function (c) { return c.id !== club.id && c.lg !== club.lg && tierOf(c) <= tierOf(club) + 1 && (S.ro[c.id] || []).length < 27; });
    var to = buyers.length ? buyers[Math.floor(R() * buyers.length)] : null; if (!to) return { ok: false, msg: 'Sin compradores por ahora.' };
    FP.Market.move(q, to.id, price, 3); if (FP.Market.rec) FP.Market.rec(q, club.id, to.id, price, 't'); fn.cash += price; fn.sales++; fn.tx.unshift({ w: S.week, t: 'Venta', n: q.n, v: price }); fn.tx.length = Math.min(fn.tx.length, 12);
    hist('Tu club ' + club.nm + ' vende a ' + q.n + ' a ' + to.nm + ' por ' + fm(price) + '.'); C.calcStr(club); return { ok: true, msg: q.n + ' se va a ' + to.nm + ' por ' + fm(price) + '.' };
  };
  RT.inject = function () {
    var fn = RT.fn(), h = hero(), club = fn && FP.S.clubs[path().job.club]; if (!fn) return { ok: false, msg: '' };
    var amt = Math.max(50, Math.round(RT.wageBill(club) * 0.25)); if (h.money < amt) return { ok: false, msg: 'No tienes ' + fm(amt) + '.' };
    pay(-amt, 'inversion', 'Capital para ' + club.nm); fn.cash += amt; fn.inj = (fn.inj || 0) + amt; return { ok: true, msg: 'Inyectas ' + fm(amt) + ' a la caja del club.' };
  };
  RT.stadium = function () {
    var fn = RT.fn(), h = hero(), club = fn && FP.S.clubs[path().job.club]; if (!fn) return { ok: false, msg: '' };
    if (fn.st >= 3) return { ok: false, msg: 'El estadio ya está al máximo.' };
    var c = RT.stadiumCost(club, fn); if (h.money < c) return { ok: false, msg: 'Necesitas ' + fm(c) + ' para ampliar el estadio.' };
    pay(-c, 'inversion', 'Estadio de ' + club.nm); fn.st++; club.fin = Math.min(10, club.fin + (fn.st === 2 ? 1 : 0)); hist('Amplía el estadio de ' + club.nm + ' (nivel ' + fn.st + ').'); return { ok: true, msg: 'Estadio ampliado: sube la recaudación anual.' };
  };
  RT.academy = function () {
    var fn = RT.fn(), h = hero(), club = fn && FP.S.clubs[path().job.club]; if (!fn) return { ok: false, msg: '' };
    if (club.ac >= 5) return { ok: false, msg: 'La academia ya es de élite.' };
    var c = RT.academyCost(club); if (h.money < c) return { ok: false, msg: 'Necesitas ' + fm(c) + ' para invertir en la academia.' };
    pay(-c, 'inversion', 'Academia de ' + club.nm); fn.ap++; var up = fn.ap >= 2; if (up) { fn.ap = 0; club.ac++; hist('La academia de ' + club.nm + ' sube de nivel.'); }
    return { ok: true, msg: up ? 'La academia sube de nivel.' : 'Primera fase de la obra: una inversión más completa el salto.' };
  };
  // la compra del club escala con su tamaño económico
  var hg0 = Dec.handlers.gestion;
  Dec.handlers.gestion = function (k, d) {
    var pa = path(), h = hero();
    if (pa && pa.k === 'pres' && /^j\d/.test(k) && d.data && d.data.cand) {
      var c = FP.S.clubs[d.data.cand[+k.slice(1)]], pr = c ? RT.price(c) : 0, old = c ? Math.round(100 + (6 - tierOf(c)) * 120) : 0;
      if (c && h.money < pr) return { ok: false, msg: 'No tienes fondos (' + fm(pr) + ') para tomar el club.' };
      var r = hg0.apply(this, arguments);
      if (r && r.ok && pa.job && c) { var ex = pr - old; if (ex > 0) pay(-ex, 'inversion', 'Compra del control de ' + c.nm); pa.job.paid = Math.max(old, pr); }
      return r;
    }
    return hg0.apply(this, arguments);
  };
  var xo0 = X.offers;
  X.offers = function () {
    var r = xo0.apply(this, arguments), pa = path();
    if (pa && pa.k === 'pres') Dec.open('gestion').forEach(function (d) { if (d.data && d.data.cand && /^ofpres/.test(d.uniq || '')) d.opts.forEach(function (o, i) { var c = d.data.cand[i] != null && FP.S.clubs[d.data.cand[i]]; if (c) o.hint = 'Precio ' + fm(RT.price(c)) + ' · gasto anual en plantel ' + fm(RT.wageBill(c)) + '.'; }); });
    return r;
  };
  // el plan anual aleatorio se reemplaza por la gestión directa en la pantalla de presidencia
  var xp0 = X.plan;
  X.plan = function () { var pa = path(); if (pa && pa.k === 'pres') { if (pa.job) Hero.msg('Abre la presidencia: el mercado, el estadio y la academia están en tus manos.', 'i'); return; } return xp0.apply(this, arguments); };

  // ---------- reencuentros ----------
  // los jugadores retirados se borran del mundo: por eso cada compañero guarda su nombre y nacimiento
  RT.matesFree = function () {
    var rt = RT.ensure(), S = FP.S;
    return Object.keys(rt.mates).map(function (k) {
      var m = rt.mates[k], q = S.pl[+k]; if (q && typeof q !== 'object') q = null;
      var gone = !q || q.c === -2;
      return { pid: +k, m: m, q: gone ? null : q, gone: gone, age: m.b != null ? C.age({ b: m.b }) : 30 };
    }).filter(function (x) { return !x.q || x.q.i !== 0; });
  };
  RT.reencuentros = function () {
    var S = FP.S, rt = RT.ensure(), pa = path(), job = pa && pa.job; if (!job || job.club == null) return;
    var club = S.clubs[job.club], mates = RT.matesFree();
    if (!rt.mateCoach && ((pa.k === 'coach' && job.role === 'head') || pa.k === 'dir' || pa.k === 'pres') && !Dec.open('rt').some(function (d) { return d.data.t === 'mate_coach'; })) {
      var c = mates.filter(function (x) { return x.gone && x.age >= 34 && x.age <= 70; }).sort(function (a, b) { return b.m.o - a.m.o; })[0];
      if (c) { var qq = Math.round(U.clamp(0.7 + (c.m.o - 60) / 60, 0.7, 1.4) * 100) / 100;
        Dec.add({ kind: 'rt', uniq: 'mc' + S.week, title: 'Un excompañero busca banquillo', text: c.m.n + ' (jugaron juntos en ' + C.tname(c.m.club) + ' hasta ' + c.m.y1 + ') se retiró y quiere entrar a un cuerpo técnico. Conoce tu forma de trabajar.', def: 'no', exp: 20, data: { t: 'mate_coach', pid: c.pid, q: qq },
          opts: [{ k: 'si', label: 'Sumarlo a tu cuerpo técnico', hint: 'Más cohesión en el vestuario y mejora ligera del equipo.' }, { k: 'no', label: 'Agradecer, pero no', hint: '' }] }); return; }
    }
    if (pa.k === 'pres' || pa.k === 'dir' || (pa.k === 'coach' && job.role === 'head')) {
      var cand = mates.filter(function (x) { var a = x.q && C.age(x.q); return x.q && x.q.c >= 0 && x.q.c !== job.club && a >= 31 && a <= 38 && x.q.o >= club.st - 8; }).sort(function (a, b) { return b.q.o - a.q.o; })[0];
      if (cand && !Dec.open('rt').some(function (d) { return d.data.t === 'mate_sign'; })) {
        var fee = pa.k === 'pres' ? Math.round(RT.fee(cand.q) * 0.5) : 0, fn = RT.fn();
        Dec.add({ kind: 'rt', uniq: 'ms' + S.week, title: 'Tu excompañero ' + cand.q.n + ' pide una oportunidad', text: cand.q.n + ' (' + C.age(cand.q) + ', nivel ' + cand.q.o + ') jugó contigo en ' + C.tname(cand.m.club) + '. Sabe que ahora decides tú.', def: 'no', exp: 20, data: { t: 'mate_sign', pid: cand.pid, fee: fee },
          opts: [{ k: 'si', label: 'Ficharlo' + (fee ? ' (' + fm(fee) + ')' : ''), hint: 'Aporta nivel y experiencia al plantel.' }, { k: 'no', label: 'Dejarlo pasar', hint: '' }] });
      }
    }
  };
  // el equipo mejora algo con el excompañero en el cuerpo técnico (una vez por año de gestión)
  RT.mateEffect = function () {
    var rt = RT.ensure(), pa = path(); if (!rt.mateCoach || !pa || !pa.job) return;
    if (pa.job.club != null && (pa.k === 'dir' || pa.k === 'pres')) { var club = FP.S.clubs[pa.job.club], amt = 0.5 * (rt.mateCoach.q || 1); (FP.S.ro[club.id] || []).slice().sort(function (a, b) { return b.o - a.o; }).slice(0, 8).forEach(function (p) { p.o = Math.min(Math.max(p.o, p.pt), Math.round(p.o + amt)); }); delete FP.Match.cache[club.id]; C.calcStr(club); }
  };

  // ---------- paso del tiempo para el retirado ----------
  var pw0 = P.weekly;
  P.weekly = function (w) {
    pw0.apply(this, arguments);
    var h = FP.S.hero; if (!h || !h.retired) return;
    var rt = RT.ensure(); if (rt.hl == null) RT.onRetire(true);
    var d = w - h.retiredW; if (d <= 0) return;
    try {
      if (d % 52 === 13) {
        var a = age(); rt.hl = U.clamp(rt.hl - ((rt.fit ? 0.3 : 0.5) + Math.max(0, a - 45) * 0.05 + (R() - 0.5) * 0.6), 3, 98);
        RT.milestone(); RT.healthEvent();
        try { RT.hofSave(); } catch (e) { }
      }
      if (d % 52 === 39) { RT.reencuentros(); RT.mateEffect(); }
    } catch (e) { if (window.console) console.warn('retiro', e); }
  };

  // ---------- cierre: salón de la fama entre partidas ----------
  var HOF_KEY = 'futpro.hof';
  RT.hofLoad = function () { try { var a = JSON.parse(localStorage.getItem(HOF_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  RT.hofEntry = function () {
    var h = hero(), p = h && h.post, lg = p && (p.legacy || (h.retired ? null : P.legacy())); if (!lg) return null;
    var pa = p.path, rt = RT.ensure();
    return { id: h.nm + '|' + (rt && rt.hid), nm: h.nm, nat: h.nat, label: lg.label, score: lg.score, bo: lg.bo, tro: lg.trophies, g: lg.g, ap: lg.ap, peak: lg.peak, caps: lg.caps, ret: h.retiredAge, yr: D.year(h.retiredW), path: pa ? P.PATHS[pa.k].nm : '', pt: pa ? pa.titles : 0, hl: rt && rt.hl != null ? Math.round(rt.hl) : null, nw: FP.Dinero ? Math.round(FP.Dinero.networth()) : Math.round(h.money) };
  };
  RT.hofSave = function () {
    var h = hero(); if (!h || !h.retired) return;
    var e = RT.hofEntry(); if (!e) return;
    var a = RT.hofLoad(), i = -1; a.forEach(function (x, k) { if (x.id === e.id) i = k; });
    if (i >= 0) a[i] = e; else a.push(e);
    a.sort(function (x, y) { return y.score - x.score; }); if (a.length > 30) a.length = 30;
    try { localStorage.setItem(HOF_KEY, JSON.stringify(a)); } catch (er) { }
  };
  RT.hofDelete = function (id) { var a = RT.hofLoad().filter(function (x) { return x.id !== id; }); try { localStorage.setItem(HOF_KEY, JSON.stringify(a)); } catch (er) { } };

  // ---------- tarjeta de carrera (PNG) y versión imprimible ----------
  RT.cardLines = function () {
    var h = hero(), p = P.ensure(), lg = p.legacy || P.legacy(), r = FP.Epilogue.records(), pa = p.path;
    return { nm: h.nm, label: lg.label, score: lg.score, stats: [['Partidos', lg.ap], ['Goles', lg.g], ['Asist.', lg.a], ['Títulos', lg.trophies], ['Selección', lg.caps], ['Nivel máx.', lg.peak]], bo: lg.bo, clubs: r.clubs, years: lg.years, after: pa ? P.PATHS[pa.k].nm + (pa.titles ? ' · ' + pa.titles + ' título(s)' : '') : '', ret: h.retiredAge };
  };
  RT.card = function () {
    var L = RT.cardLines(), cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1350; var g = cv.getContext('2d');
    var gr = g.createLinearGradient(0, 0, 0, 1350); gr.addColorStop(0, '#0f1b2d'); gr.addColorStop(1, '#070b13'); g.fillStyle = gr; g.fillRect(0, 0, 1080, 1350);
    g.strokeStyle = '#d4af37'; g.lineWidth = 6; g.strokeRect(36, 36, 1008, 1278);
    g.fillStyle = '#d4af37'; g.font = '600 34px sans-serif'; g.textAlign = 'center'; g.fillText('FUTPRO · CARRERA COMPLETA', 540, 110);
    g.fillStyle = '#ffffff'; g.font = '800 84px sans-serif'; g.fillText(L.nm, 540, 250, 960);
    g.fillStyle = '#9fb3cc'; g.font = '500 42px sans-serif'; g.fillText(L.label, 540, 320, 960);
    g.fillStyle = '#d4af37'; g.font = '800 260px sans-serif'; g.fillText(String(L.score), 540, 600); g.fillStyle = '#9fb3cc'; g.font = '500 34px sans-serif'; g.fillText('LEGADO / 100', 540, 660);
    L.stats.forEach(function (s, i) { var x = 200 + (i % 3) * 340, y = 800 + Math.floor(i / 3) * 190; g.fillStyle = '#ffffff'; g.font = '800 82px sans-serif'; g.fillText(String(s[1]), x, y); g.fillStyle = '#9fb3cc'; g.font = '500 32px sans-serif'; g.fillText(s[0], x, y + 48); });
    g.fillStyle = '#ffffff'; g.font = '500 38px sans-serif';
    g.fillText(L.clubs + (L.clubs === 1 ? ' club' : ' clubes') + ' · ' + L.years + ' años de carrera' + (L.ret ? ' · retiro a los ' + L.ret : ''), 540, 1220, 960);
    if (L.bo) { g.fillStyle = '#d4af37'; g.fillText(L.bo + (L.bo === 1 ? ' Balón de Oro' : ' Balones de Oro'), 540, 1170); }
    if (L.after) { g.fillStyle = '#9fb3cc'; g.font = '500 34px sans-serif'; g.fillText('Después: ' + L.after, 540, 1275, 960); }
    return cv;
  };
  RT.printHtml = function () {
    var h = hero(), p = P.ensure(), lg = p.legacy || P.legacy(), E = FP.Epilogue, r = E.records(), esc = U.esc, pa = p.path, rt = RT.ensure();
    var rows = [['Partidos', lg.ap], ['Goles', lg.g], ['Asistencias', lg.a], ['Títulos', lg.trophies], ['Premios individuales', lg.awards], ['Balón de Oro', lg.bo], ['Selección (partidos)', lg.caps], ['Nivel máximo', lg.peak], ['Clubes', r.clubs]];
    var html = '<!doctype html><html lang="es"><meta charset="utf-8"><title>' + esc(h.nm) + '</title><style>body{font:15px/1.5 Georgia,serif;max-width:760px;margin:2rem auto;color:#111}h1{margin:0}h2{border-bottom:1px solid #aaa;margin-top:1.6rem}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:.3rem .5rem;text-align:left}th{background:#f1f1f1;width:45%}.m{color:#555}</style>';
    html += '<h1>' + esc(h.nm) + '</h1><p class="m">' + esc(lg.label) + ' · legado ' + lg.score + '/100</p>';
    html += '<h2>Resumen</h2>' + E.story().map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('');
    html += '<h2>Cifras</h2><table>' + rows.map(function (x) { return '<tr><th>' + x[0] + '</th><td>' + x[1] + '</td></tr>'; }).join('') + '</table>';
    if (r.trophyNames.length) html += '<h2>Títulos</h2><table>' + r.trophyNames.map(function (x) { return '<tr><th>' + esc(x.nm) + '</th><td>' + x.n + '</td></tr>'; }).join('') + '</table>';
    if (pa && pa.seasons.length) html += '<h2>Después del fútbol: ' + esc(P.PATHS[pa.k].nm) + '</h2><table>' + pa.seasons.slice(-12).map(function (s) { return '<tr><th>' + esc(String(s.y)) + (s.club != null ? ' · ' + esc(C.tname(s.club)) : '') + '</th><td>' + esc(s.res || '') + '</td></tr>'; }).join('') + '</table>';
    if (rt.life.length) html += '<h2>Vida tras el fútbol</h2><ul>' + rt.life.map(function (x) { return '<li>' + esc(x.t) + ' (' + x.age + ' años)</li>'; }).join('') + '</ul>';
    return html + '<p class="m">Generado por FUTPRO.</p></html>';
  };

  // pasos de la escalera para la interfaz
  RT.coachSteps = function () { var best = RT.rung(); return RT.LADDER.map(function (s, i) { return { k: s.k, n: s.n, done: i + 1 <= best, cur: i + 1 === best }; }); };

})();
