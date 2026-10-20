/* FUTPRO — interfaz de profundidad de carrera: decisiones pendientes, Salud, Vestuario, Táctica y pausas en el partido.
   Solo presentación: la lógica vive en decisions.js, medical.js, staff.js y tactics.js. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, UI = FP.UI, esc = U.esc, A = UI.acts, SC = UI.screens, I = UI.icon;
  var Dec = FP.Dec, Med = FP.Med, St = FP.Staff, Tac = FP.Tac, hdr = UI.hdr, seg = UI.seg;
  function pill(t, c) { return '<span class="pill ' + (c || '') + '">' + t + '</span>'; }
  function bar(v, cls) { return UI.bar(Math.max(0, Math.min(100, v)), 100, cls || ''); }
  function relCls(v) { return v >= 40 ? '' : v >= 0 ? 'y' : 'r'; }
  function relLabel(v) { return v >= 60 ? 'Excelente' : v >= 30 ? 'Buena' : v >= 5 ? 'Correcta' : v >= -20 ? 'Tensa' : 'Mala'; }

  // ---------- decisiones pendientes ----------
  UI.decCards = function (kinds) {
    var list = Dec.open().filter(function (d) { return !kinds || kinds.indexOf(d.kind) >= 0; });
    if (!list.length) return '';
    return list.map(function (d) {
      var left = Math.max(0, d.exp - FP.S.week);
      return '<div class="card dec-c"><div class="hd"><h3>' + I('bell') + esc(d.title) + '</h3>' + pill(left <= 0 ? 'Última semana' : 'Responder en ' + left + ' sem.', left <= 1 ? 'y' : '') + '</div><p class="mut sm">' + esc(d.text) + '</p><div class="dec-opts">' +
        d.opts.map(function (o) { return '<button class="btn ' + (o.k === d.def ? 'pri' : '') + '" data-act="dec" data-id="' + d.id + '" data-k="' + o.k + '"><b>' + esc(o.label) + '</b><span class="mut sm">' + esc(o.hint || '') + '</span></button>'; }).join('') +
        '</div><div class="mut sm" style="margin-top:.4rem">Si no respondes a tiempo se aplica: ' + esc((d.opts.filter(function (o) { return o.k === d.def; })[0] || d.opts[0]).label) + '.</div></div>';
    }).join('');
  };
  A.dec = function (d) {
    var r = Dec.resolve(+d.id, d.k); if (r && r.msg) UI.toast(esc(r.msg), r.ok === false ? 'warn' : 'ok'); UI.render();
  };
  var home0 = SC.home;
  SC.home = function () {
    var html = home0.apply(this, arguments), dc = UI.decCards();
    return dc ? '<div class="dec-wrap">' + dc + '</div>' + html : html;
  };

  // ---------- SALUD ----------
  SC.health = function () {
    var S = FP.S, h = S.hero, m = Med.ensure(), inj = h.inj && h.inj.n > 0 ? h.inj : null, lv = Med.loadLevel(m.load), sm = Med.summary(), risk = Med.riskMult();
    var html = hdr('plus', 'Salud y físico', 'Lesiones, carga de partidos, rehabilitación y prevención');
    html += UI.decCards(['lesion', 'alta', 'molestias']);
    html += '<div class="grid g2"><div>';
    if (inj) {
      var done = Math.max(0, Math.min(100, (inj.n0 - inj.n) / Math.max(1, inj.n0) * 100));
      html += '<div class="card"><div class="hd"><h3>' + I('plus') + esc(inj.nm) + '</h3>' + pill('Lesionado', 'r') + (inj.relapse ? pill('Recaída', 'y') : '') + '</div><div class="terms" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))"><div><span>Zona</span><b>' + esc(inj.zone) + '</b></div><div><span>Causa</span><b>' + esc(inj.cause) + '</b></div><div><span>Baja restante</span><b>' + inj.n + ' sem.</b></div><div><span>Plan</span><b>' + esc({ club: 'Club', conservador: 'Conservador', cirugia: 'Cirugía', acelerada: 'Acelerada', especialista: 'Especialista' }[inj.plan] || inj.plan) + '</b></div></div><div class="mut sm" style="margin-top:.6rem">Recuperación</div>' + bar(done, '') + '<p class="mut sm" style="margin-top:.5rem">Mientras estás lesionado no entrenas ni juegas. Al volver tendrás menos condición y un riesgo de recaída que depende del plan elegido.</p></div>';
    } else {
      html += '<div class="card"><div class="hd"><h3>' + I('check') + 'Estado actual</h3>' + pill(m.cond >= 95 ? 'En forma' : 'Recuperando ritmo', m.cond >= 95 ? 'g' : 'y') + '</div><div class="mut sm">Condición física</div>' + bar(m.cond, m.cond < 80 ? 'y' : '') + '<div class="mut sm" style="margin-top:.5rem">Fatiga</div>' + bar(h.fat, h.fat > 70 ? 'r' : h.fat > 45 ? 'y' : '') +
        (m.recent && S.week <= m.recent.until ? '<p class="mut sm" style="margin-top:.6rem">' + I('bell') + ' Riesgo de recaída en ' + esc(m.recent.zone) + ': <b>' + Math.round(m.recent.risk * 100) + '%</b> hasta la semana ' + D.fmt(m.recent.until) + '.</p>' : '') + '</div>';
    }
    html += '<div class="card"><div class="hd"><h3>' + I('chart') + 'Carga de partidos</h3>' + pill(lv[0], lv[1] === 'bad' ? 'r' : lv[1] === 'warn' ? 'y' : 'g') + '</div><div class="mut sm">Carga acumulada (' + Math.round(m.load) + ')</div>' + bar(m.load / 45 * 100, lv[1] === 'bad' ? 'r' : lv[1] === 'warn' ? 'y' : '') +
      '<div class="row sp" style="margin-top:.6rem"><span>Riesgo de lesión relativo</span><b class="' + (risk > 1.4 ? 'bad' : risk < 0.9 ? 'ok' : '') + '">×' + risk.toFixed(2) + '</b></div><p class="mut sm">Sube con muchos partidos seguidos, fatiga, molestias, edad y lesiones previas en la misma zona. Baja con resistencia y prevención.</p>' +
      '<div class="row sp"><div><b>Plan de prevención</b><div class="mut sm">Trabajo de movilidad y fuerza: –25% de riesgo, pero progresas algo más lento.</div></div><button class="btn ' + (m.prev ? 'pri' : '') + '" data-act="prev">' + (m.prev ? 'Activado' : 'Activar') + '</button></div></div>';
    html += '</div><div>';
    html += '<div class="card"><div class="hd"><h3>' + I('history') + 'Historial médico</h3></div>' + (m.hist.length ? '<div class="pstat" style="grid-template-columns:repeat(3,1fr);margin-bottom:.6rem"><div><b>' + sm.n + '</b><span>Lesiones</span></div><div><b>' + sm.weeks + '</b><span>Semanas fuera</span></div><div><b>' + m.hist.filter(function (e) { return e.relapse; }).length + '</b><span>Recaídas</span></div></div>' +
      m.hist.slice().reverse().slice(0, 12).map(function (e) { return '<div class="row sp sm"><span>' + esc(D.fmt(e.w)) + ' · <b>' + esc(e.nm) + '</b> <span class="mut">(' + esc(e.zone) + ')</span></span><span>' + e.n + ' sem.' + (e.relapse ? ' ' + pill('recaída', 'y') : '') + '</span></div>'; }).join('') : '<p class="mut">Sin lesiones registradas.</p>') + '</div>';
    var zs = Object.keys(m.zones).filter(function (z) { return m.zones[z] >= 2; });
    if (zs.length) html += '<div class="card"><div class="hd"><h3>' + I('target') + 'Zonas frágiles</h3></div>' + zs.map(function (z) { return '<div class="row sp"><span>' + esc(z) + '</span><b>' + m.zones[z] + ' lesiones</b></div>'; }).join('') + '<p class="mut sm">Las zonas que ya se lesionaron son más propensas a volver a hacerlo.</p></div>';
    return html + '</div></div>';
  };
  A.prev = function () { var on = Med.togglePrev(); UI.toast(on ? 'Plan de prevención activado.' : 'Plan de prevención desactivado.', 'ok'); UI.render(); };

  // ---------- VESTUARIO ----------
  SC.locker = function () {
    var S = FP.S, h = S.hero, lk = St.ensureLk();
    var html = hdr('shield', 'Vestuario', 'Entrenador, compañeros y ambiente del plantel');
    html += UI.decCards(['vestuario']);
    if (!lk || lk.club == null) return html + '<div class="card"><p class="mut">Necesitas estar en un club (cantera o profesional) para tener un vestuario.</p></div>';
    var club = S.clubs[lk.club], def = St.def(club), c = St.coach(club), fit = Tac.fit();
    html += '<div class="grid g2"><div><div class="card"><div class="hd"><h3>' + UI.crest(club.id) + esc(club.co) + '</h3>' + pill(esc(def.nm), 'b') + '</div><p class="mut sm">' + esc(def.desc) + '</p><div class="terms" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))"><div><span>Confía en juveniles</span><b>' + (def.youth > 1 ? 'Mucho' : def.youth > 0 ? 'Algo' : def.youth < 0 ? 'Poco' : 'Normal') + '</b></div><div><span>Disciplina</span><b>' + (def.disc >= 2 ? 'Estricta' : def.disc ? 'Exigente' : 'Flexible') + '</b></div><div><span>Rotaciones</span><b>' + (def.rot > 0.5 ? 'Muchas' : def.rot > 0.3 ? 'Algunas' : 'Pocas') + '</b></div><div><span>Calidad</span><b>' + Math.round(c.q * 100) + '</b></div></div>' +
      '<div class="mut sm" style="margin-top:.6rem">Relación contigo: <b>' + relLabel(lk.coach) + '</b></div>' + bar(50 + lk.coach / 2, relCls(lk.coach) === 'r' ? 'r' : relCls(lk.coach) === 'y' ? 'y' : '') +
      '<div class="mut sm" style="margin-top:.6rem">Encaje de tu forma de jugar con su estilo: <b class="' + (fit > 0.2 ? 'ok' : fit < -0.2 ? 'bad' : '') + '">' + (fit > 0.2 ? 'Le gusta' : fit < -0.2 ? 'No le convence' : 'Neutro') + '</b> <a class="more" data-act="nav" data-s="tactics">Cambiar táctica ' + I('chev') + '</a></div>' +
      '<div class="btn-group" style="margin-top:.7rem"><button class="btn" data-act="lkact" data-k="entrenador">' + I('chat') + 'Hablar con el entrenador</button><button class="btn" data-act="lkact" data-k="salir">Salir a comer con el plantel</button></div></div>';
    html += '<div class="card"><div class="hd"><h3>' + I('flag') + 'Ambiente del equipo</h3></div>' + bar(lk.mood, lk.mood < 35 ? 'r' : lk.mood < 50 ? 'y' : '') + '<p class="mut sm" style="margin-top:.4rem">Un buen ambiente sube tu moral semana a semana; un vestuario roto la baja.</p></div></div><div>';
    html += '<div class="card"><div class="hd"><h3>' + I('user') + 'Personas clave</h3></div>';
    if (!lk.people.length) html += '<p class="mut">Todavía no conoces a nadie del plantel.</p>';
    lk.people.forEach(function (e) {
      var p = St.person(e); if (!p) return;
      html += '<div class="person"><div class="row sp"><div><b>' + esc(p.n) + '</b> ' + pill(esc(e.label), e.role === 'rival' ? 'r' : e.role === 'mentor' ? 'g' : '') + '<div class="mut sm">' + UI.posb(p.p) + ' ' + Math.round(p.o) + ' · ' + C.age(p) + ' años</div></div><div style="min-width:35%"><div class="mut sm" style="text-align:right">' + relLabel(e.rel) + '</div>' + bar(50 + e.rel / 2, relCls(e.rel) === 'r' ? 'r' : relCls(e.rel) === 'y' ? 'y' : '') + '</div></div><div class="btn-group" style="margin-top:.4rem"><button class="btn sm" data-act="lkact" data-k="consejo" data-p="' + e.pid + '">Pedir consejo</button><button class="btn sm" data-act="lkact" data-k="ayuda" data-p="' + e.pid + '">Ayudar</button><button class="btn sm" data-act="lkact" data-k="salir" data-p="' + e.pid + '">Salir juntos</button>' + (e.role === 'rival' ? '<button class="btn sm" data-act="lkact" data-k="pelea" data-p="' + e.pid + '">Competir abiertamente</button>' : '') + '</div></div>';
    });
    html += '</div></div></div>';
    return html;
  };
  A.lkact = function (d) { var r = St.act(d.k, d.p != null ? +d.p : null); UI.toast(esc(r.msg), r.ok ? 'ok' : 'warn'); UI.render(); };

  // ---------- TÁCTICA Y POSICIÓN ----------
  function roleBtns() {
    var h = FP.S.hero; Tac.ensure();
    return Object.keys(Tac.ROLES).map(function (k) { var r = Tac.ROLES[k]; return '<div class="card opt ' + (h.tac.role === k ? 'sel' : '') + '" style="margin:0" data-act="trole" data-k="' + k + '"><b>' + esc(r.nm) + '</b><div class="mut sm">' + esc(r.d) + '</div></div>'; }).join('');
  }
  function pressBtns() {
    var h = FP.S.hero; Tac.ensure();
    return Tac.PRESS.map(function (r, i) { return '<div class="card opt ' + (h.tac.press === i ? 'sel' : '') + '" style="margin:0" data-act="tpress" data-k="' + i + '"><b>Presión ' + r.nm.toLowerCase() + '</b><div class="mut sm">' + esc(r.d) + '</div></div>'; }).join('');
  }
  SC.tactics = function () {
    var S = FP.S, h = S.hero; Tac.ensure();
    var html = hdr('target', 'Táctica y posición', 'Tus instrucciones personales y tu puesto en el campo');
    html += '<div class="card"><div class="hd"><h3>' + I('target') + 'Rol en el partido</h3></div><div class="grid g2">' + roleBtns() + '</div></div>';
    html += '<div class="card"><div class="hd"><h3>' + I('zap') + 'Intensidad de presión</h3></div><div class="grid g3">' + pressBtns() + '</div></div>';
    html += '<div class="card"><div class="hd"><h3>' + I('flag') + 'Mentalidad</h3></div><div class="btn-group">' + [-1, 0, 1].map(function (v) { return '<button class="btn sm ' + ((h.instr || 0) === v ? 'pri' : '') + '" data-act="minstr" data-v="' + v + '">' + ({ '-1': 'Conservador', '0': 'Equilibrado', '1': 'Agresivo' }[v]) + '</button>'; }).join('') + '</div></div>';
    var cd = Tac.coachDef();
    if (cd) html += '<div class="card"><div class="hd"><h3>' + I('shield') + 'Lo que pide ' + esc(cd.club.co) + '</h3>' + pill(esc(cd.def.nm), 'b') + '</div><p class="mut sm">' + esc(cd.def.desc) + ' Jugar como él quiere mejora vuestra relación; ir contra su estilo la deteriora lentamente.</p></div>';
    var pen = Tac.pen();
    html += '<div class="card"><div class="hd"><h3>' + I('user') + 'Posición</h3>' + (pen > 0.4 ? pill('Adaptándote: –' + pen.toFixed(1) + ' pts', 'y') : '') + '</div><p class="mut sm">Cambiar de puesto no cambia tus atributos, pero tardas en dominar la nueva posición: mientras tanto rindes menos. La familiaridad crece jugando partidos y entrenando "Posición".</p><div class="grid g2">' +
      C.POS.filter(function (p) { return p !== 'GK'; }).map(function (p) {
        var f = Tac.famOf(p), cur = h.pos === p;
        return '<div class="card" style="margin:0"><div class="row sp"><div>' + UI.posb(p) + ' <b>' + esc(C.POS_NAME[p]) + '</b><div class="mut sm">Nivel en el puesto: ' + Math.round(C.ovrOf(h.at, p)) + '</div></div>' + (cur ? pill('Actual', 'g') : '<button class="btn sm" data-act="tpos" data-p="' + p + '">Cambiar</button>') + '</div><div class="mut sm" style="margin-top:.4rem">Familiaridad ' + Math.round(f) + '%</div>' + bar(f, f < 50 ? 'y' : '') + '</div>';
      }).join('') + '</div></div>';
    return html;
  };
  A.trole = function (d) { Tac.ensure(); FP.S.hero.tac.role = d.k; UI.render(); };
  A.tpress = function (d) { Tac.ensure(); FP.S.hero.tac.press = +d.k; UI.render(); };
  A.tpos = function (d) {
    var f = Tac.famOf(d.p), pen = (100 - f) * 0.1;
    UI.confirm('¿Pasar a jugar de ' + esc(C.POS_NAME[d.p]) + '? Tu familiaridad es ' + Math.round(f) + '%: rendirás unos ' + pen.toFixed(1) + ' puntos menos hasta adaptarte, y el entrenador lo notará.', function () {
      var r = Tac.setPos(d.p); UI.closeModal && UI.closeModal(); UI.toast(esc(r.msg), r.ok ? 'ok' : 'warn'); UI.render();
    });
  };
  A.setpos = A.tpos;                           // el selector antiguo de "Mi jugador" usa el mismo flujo con costo de adaptación

  // ---------- PARTIDO CON PAUSAS ----------
  var match0 = SC.match;
  function panel(mt) {
    var h = FP.S.hero, sess = mt.sess, sc = sess.score(), hm = sess.hm, mn = mt.stops[mt.si - 0] || 45;
    var title = mt.stops[mt.si] >= 70 ? 'Recta final' : 'Descanso';
    var left = mt.stops[mt.si + 1] ? 'Después de esta pausa hay otra en el minuto ' + mt.stops[mt.si + 1] + '.' : '';
    var mine = mt.prep.home ? sc.h : sc.a, opp = mt.prep.home ? sc.a : sc.h;
    return '<div class="card pause-c"><div class="hd"><h3>' + I('whistle') + title + ' · minuto ' + mt.stops[mt.si] + '</h3>' + pill(mine + ' - ' + opp, mine > opp ? 'g' : mine < opp ? 'r' : '') + '</div>' +
      '<p class="mut sm">' + (hm.in && !hm.out ? 'Llevas ' + hm.g + ' gol(es), ' + hm.a + ' asistencia(s) y ' + hm.sh + ' remate(s). ' : '') + 'Cambia tus instrucciones para lo que viene. ' + left + '</p>' +
      '<h4>Mentalidad del equipo</h4><div class="btn-group">' + [-1, 0, 1].map(function (v) { return '<button class="btn sm ' + ((h.instr || 0) === v ? 'pri' : '') + '" data-act="pment" data-v="' + v + '">' + ({ '-1': 'Cerrar el partido', '0': 'Equilibrado', '1': 'Ir a buscarlo' }[v]) + '</button>'; }).join('') + '</div>' +
      '<h4 style="margin-top:.8rem">Tu rol</h4><div class="btn-group">' + Object.keys(Tac.ROLES).map(function (k) { return '<button class="btn sm ' + (h.tac.role === k ? 'pri' : '') + '" data-act="prole" data-k="' + k + '">' + esc(Tac.ROLES[k].nm) + '</button>'; }).join('') + '</div>' +
      '<h4 style="margin-top:.8rem">Presión</h4><div class="btn-group">' + Tac.PRESS.map(function (r, i) { return '<button class="btn sm ' + (h.tac.press === i ? 'pri' : '') + '" data-act="ppress" data-k="' + i + '">' + esc(r.nm) + '</button>'; }).join('') + '</div>' +
      '<div class="row" style="margin-top:1rem;gap:.6rem"><button class="btn cta" data-act="presume">' + I('play', 'fill') + 'Continuar el partido</button>' + (hm.in && !hm.out ? '<button class="btn" data-act="presume" data-out="1">Pedir el cambio</button>' : '') + '</div></div>';
  }
  SC.match = function () {
    var mt = UI.mt, h = FP.S.hero;
    if (mt && mt.phase === 'pre') {
      Tac.ensure();
      var base = match0.apply(this, arguments);
      return base + '<div class="card"><div class="hd"><h3>' + I('target') + 'Instrucciones tácticas</h3><a class="more" data-act="nav" data-s="tactics">Táctica completa ' + I('chev') + '</a></div><div class="grid g2">' + roleBtns() + '</div><h4 style="margin-top:.8rem">Presión</h4><div class="grid g3">' + pressBtns() + '</div><p class="mut sm" style="margin-top:.5rem">En el modo minuto a minuto podrás ajustarlas en el descanso y en la recta final.</p></div>';
    }
    if (mt && mt.phase === 'ht') {
      mt.phase = 'play'; var base2; try { base2 = match0.apply(this, arguments); } finally { mt.phase = 'ht'; }
      return panel(mt) + base2;
    }
    return match0.apply(this, arguments);
  };
  var mplay0 = A.mplay;
  A.mplay = function (d) {
    var mt = UI.mt;
    if (d.mode !== 'live' || !mt || !mt.prep || mt.prep.status.role === 'out') return mplay0.apply(this, arguments);
    var prep = FP.Game.nextPending(); if (!prep) return;
    var b = Tac.begin(prep);
    UI.mt = { phase: 'play', prep: prep, res: b.res, sess: b.sess, stops: b.stops, si: 0, minute: 0, speed: 1 };
    UI.render();
  };
  var after0 = UI.after.match;
  UI.after.match = function () {
    var mt = UI.mt; if (!mt) return;
    if (mt.watch) { clearInterval(mt.watch); mt.watch = null; }
    if (mt.phase === 'ht') { mt.phase = 'play'; after0.apply(this, arguments); if (mt.timer) { clearInterval(mt.timer); mt.timer = null; } mt.phase = 'ht'; var m0 = document.getElementById('mt-min'); if (m0) m0.textContent = mt.minute + "'"; return; }
    after0.apply(this, arguments);
    if (mt.phase === 'play' && mt.sess && !mt.sess.done && mt.si < mt.stops.length) {
      mt.watch = setInterval(function () {
        if (UI.mt !== mt || mt.phase !== 'play') { clearInterval(mt.watch); return; }
        if (mt.minute >= mt.stops[mt.si]) {
          clearInterval(mt.watch); mt.watch = null; if (mt.timer) { clearInterval(mt.timer); mt.timer = null; }
          mt.minute = mt.stops[mt.si];
          if (!mt.sess.hm.in || mt.sess.hm.out) { Tac.resumeUI(mt); return; }          // sin decisiones si ya no estás en el campo
          mt.phase = 'ht'; UI.render();
        }
      }, 80);
    }
  };
  Tac.resumeUI = function (mt) {
    var fin = Tac.resume(mt);
    mt.phase = 'play'; UI.render();
    if (fin) mt.stops = [];
  };
  A.pment = function (d) { Tac.setMent(UI.mt, +d.v); UI.render(); };
  A.prole = function (d) { FP.S.hero.tac.role = d.k; UI.render(); };
  A.ppress = function (d) { FP.S.hero.tac.press = +d.k; UI.render(); };
  A.presume = function (d) {
    var mt = UI.mt; if (!mt || !mt.sess) return;
    if (d.out) mt.sess.askOut();
    Tac.resumeUI(mt);
  };
  A.minstr = function (d) { var mt = UI.mt; FP.S.hero.instr = +d.v; if (mt && mt.sess) mt.sess.setMent(+d.v); UI.render(); };
  var skip0 = A.mskip;
  A.mskip = function () {
    var mt = UI.mt;
    if (mt && mt.sess && !mt.sess.done) {                 // saltar al final: termina el partido sin más pausas
      if (mt.watch) { clearInterval(mt.watch); mt.watch = null; } if (mt.timer) { clearInterval(mt.timer); mt.timer = null; }
      mt.si = mt.stops.length - 1; Tac.resume(mt); mt.phase = 'done'; UI.render(); return;
    }
    return skip0.apply(this, arguments);
  };
  var finish0 = UI.matchFinish;
  UI.matchFinish = function () {
    var mt = UI.mt;
    if (mt && mt.sess && !mt.sess.done) return;          // no se termina mientras haya pausas por jugar
    if (mt && mt.watch) { clearInterval(mt.watch); mt.watch = null; }
    return finish0.apply(this, arguments);
  };

  // ---------- navegación ----------
  var g = UI.GROUPS;
  g[0][1].splice(2, 0, ['health', 'Salud', 'plus'], ['locker', 'Vestuario', 'shield']);
  g[1][1].splice(3, 0, ['tactics', 'Táctica', 'target']);
  var badges0 = UI.badges;
  UI.badges = function () {
    var b = badges0.apply(this, arguments);
    if (FP.S && FP.S.hero) { b.health = (Dec.open('lesion').length + Dec.open('alta').length + Dec.open('molestias').length) || undefined; b.locker = Dec.open('vestuario').length || undefined; b.life = Dec.open('vida').length + Dec.open('prensa').length || undefined; b.post = (Dec.open('post').length + Dec.open('gestion').length + Dec.open('protegido').length + Dec.open('agente').length + Dec.open('retiro').length) || undefined; }
    return b;
  };
})();
