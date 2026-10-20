/* FUTPRO — pantalla Banquillo: dirigir los partidos del club como director técnico (formación, mentalidad, pausas).
   Solo presentación: la lógica vive en js/coaching.js. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, UI = FP.UI, esc = U.esc, A = UI.acts, SC = UI.screens, I = UI.icon, K = FP.Coach, Match = FP.Match, hdr = UI.hdr;
  function pill(t, c) { return '<span class="pill ' + (c || '') + '">' + t + '</span>'; }
  UI.cm = null;
  var MENT = { '-1': 'Cerrar el partido', '0': 'Equilibrado', '1': 'Ir a buscarlo' };

  function stepUntilMatch() {
    if (UI.busy) return; UI.busy = true; UI.overlay('Avanzando…');
    var n = 0, d0 = FP.Dec.open().length;
    (function loop() {
      var t0 = Date.now(), found = false;
      while (n < 60 && Date.now() - t0 < 40 && !found && FP.Dec.open().length <= d0) { found = K.stepWeek(); n++; }
      if (!found && n < 60 && FP.Dec.open().length <= d0) { setTimeout(loop, 0); return; }
      UI.busy = false; UI.overlay(false); UI.cm = null; FP.Store.auto(true);
      if (!found) UI.toast(FP.Dec.open().length > d0 ? 'Tienes una decisión pendiente.' : 'No hay más partidos por ahora.', 'warn');
      UI.render();
    })();
  }
  function teamBlock(id) { return '<div class="mc-team">' + UI.crest(id, 'lg') + '<div class="tn">' + UI.club(id) + '</div></div>'; }
  function xiList(club, form) {
    var lu = Match.lineup(club, { form: form });
    return '<div class="grid g2">' + lu.xi.map(function (e) { return '<div class="sm row sp"><span>' + UI.posb(e.slot) + ' ' + esc(e.p.n) + '</span><b>' + Math.round(e.p.o) + '</b></div>'; }).join('') + '</div>';
  }
  function panel(cm) {
    var sc = cm.sess.score(), mine = cm.prep.home ? sc.h : sc.a, opp = cm.prep.home ? sc.a : sc.h;
    return '<div class="card pause-c"><div class="hd"><h3>' + I('whistle') + (cm.stops[cm.si] >= 70 ? 'Recta final' : 'Descanso') + ' · minuto ' + cm.stops[cm.si] + '</h3>' + pill(mine + ' - ' + opp, mine > opp ? 'g' : mine < opp ? 'r' : '') + '</div><p class="mut sm">Ajusta la mentalidad del equipo para lo que queda.</p><div class="btn-group">' +
      [-1, 0, 1].map(function (v) { return '<button class="btn sm ' + (cm.ment === v ? 'pri' : '') + '" data-act="cment" data-v="' + v + '">' + MENT[v] + '</button>'; }).join('') + '</div><div style="margin-top:1rem"><button class="btn cta" data-act="cresume">' + I('play', 'fill') + 'Continuar el partido</button></div></div>';
  }
  SC.coach = function () {
    var S = FP.S, h = S.hero, j = K.job(), html = hdr('whistle', 'Banquillo', 'Dirige los partidos de tu club');
    if (!h.retired || !j) return html + '<div class="card"><p class="mut">Todavía no diriges a ningún equipo como director técnico. Elige el camino de entrenador en <a class="more" data-act="nav" data-s="post">Después del fútbol</a>, saca las licencias y acepta una oferta de director técnico.</p></div>';
    var club = S.clubs[j.club], cm = UI.cm;
    if (cm && S.comps[cm.prep.comp.id] !== cm.prep.comp) cm = UI.cm = null;
    if (!cm) {
      var pr = K.next();
      var rec = j.rec ? j.rec.w + 'G · ' + j.rec.d + 'E · ' + j.rec.l + 'P' : 'sin partidos aún';
      html += '<div class="card"><div class="row sp"><div class="row" style="gap:.7rem">' + UI.crest(club.id, 'lg') + '<div><b style="font-size:1.1rem">' + esc(club.nm) + '</b><div class="mut sm">Director técnico · temporada actual: ' + rec + '</div></div></div><button class="btn pri" data-act="cnextmatch">' + I('fwd') + 'Ir al próximo partido</button></div></div>';
      if (!pr) return html + '<div class="card"><p class="mut">No hay partidos pendientes esta semana.</p></div>';
      UI.cm = cm = { phase: 'pre', prep: pr, form: club.fm || '4-3-3', ment: 0 };
    }
    var prep = cm.prep, f = prep.f, comp = prep.comp, club2 = S.clubs[j.club];
    if (cm.phase === 'pre') {
      html += '<div class="mc"><div class="mc-top"><span>' + esc(comp.nm) + (f.ro ? ' · ' + esc(f.ro) : '') + '</span><span>·</span><span>' + D.fmt(f.w) + '</span></div><div class="mc-main">' + teamBlock(f.h) + '<div class="mc-score"><div class="big" style="color:var(--dim)">VS</div></div>' + teamBlock(f.a) + '</div></div>';
      html += '<div class="grid g2"><div class="card"><div class="hd"><h3>' + I('target') + 'Planteamiento</h3></div><h4>Formación</h4><div class="btn-group">' + Object.keys(Match.FORMS).map(function (k) { return '<button class="btn sm ' + (cm.form === k ? 'pri' : '') + '" data-act="cform" data-k="' + k + '">' + k + '</button>'; }).join('') + '</div><h4 style="margin-top:.8rem">Mentalidad</h4><div class="btn-group">' + [-1, 0, 1].map(function (v) { return '<button class="btn sm ' + (cm.ment === v ? 'pri' : '') + '" data-act="cment" data-v="' + v + '">' + MENT[v] + '</button>'; }).join('') +
        '</div><p class="mut sm" style="margin-top:.6rem">Fuerza del equipo ' + Math.round(C.strOf(prep.mine)) + ' · rival ' + Math.round(C.strOf(prep.opp)) + ' · tu calidad como técnico aporta ' + (K.boost() >= 0 ? '+' : '') + K.boost().toFixed(1) + '.</p><div class="row" style="gap:.6rem;margin-top:.8rem"><button class="btn cta" data-act="cplay" data-mode="live">' + I('play', 'fill') + 'Dirigir en vivo</button><button class="btn" data-act="cplay" data-mode="quick">' + I('zap') + 'Simular</button></div></div>' +
        '<div class="card"><div class="hd"><h3>' + I('user') + 'Once inicial (' + esc(cm.form) + ')</h3></div>' + xiList(prep.mine, cm.form) + '</div></div>';
      return html;
    }
    var res = cm.res, live = cm.phase !== 'done', total = Math.max(res.et ? 120 : 90, res.ev.length ? res.ev[res.ev.length - 1].m : 90);
    var mg = prep.home ? res.hs : res.as, og = prep.home ? res.as : res.hs, letter = res.ps ? ((prep.home ? res.ps[0] > res.ps[1] : res.ps[1] > res.ps[0]) ? 'V' : 'D') : mg > og ? 'V' : mg < og ? 'D' : 'E';
    if (cm.phase === 'ht') html += panel(cm);
    if (cm.phase === 'done') html += '<div class="res-banner ' + letter + '"><div><div class="rt">' + ({ V: 'Victoria', D: 'Derrota', E: 'Empate' }[letter]) + '</div><div class="rs2">' + esc(comp.nm) + (f.ro ? ' · ' + esc(f.ro) : '') + '</div></div><div class="row" style="gap:1.4rem">' + UI.crest(f.h, 'lg') + '<span style="font-size:2rem;font-weight:800">' + res.hs + ' - ' + res.as + '</span>' + UI.crest(f.a, 'lg') + '</div></div>';
    html += '<div class="mc"><div class="mc-top"><span>' + esc(comp.nm) + '</span></div><div class="mc-main">' + teamBlock(f.h) + '<div class="mc-score"><div class="big" id="cm-score">' + (cm.phase === 'done' ? res.hs + '<i>-</i>' + res.as : '0<i>-</i>0') + '</div><div class="min ' + (cm.phase === 'play' ? 'live' : '') + '" id="cm-min">' + (cm.phase === 'done' ? 'Final' : (cm.minute || 0) + "'") + '</div></div>' + teamBlock(f.a) + '</div>' +
      (cm.phase === 'play' ? '<div class="btn-group" style="justify-content:center;margin-top:.4rem"><button class="btn sm" data-act="cspeed" data-v="1">1×</button><button class="btn sm" data-act="cspeed" data-v="3">3×</button><button class="btn sm" data-act="cspeed" data-v="8">8×</button><button class="btn sm pri" data-act="cskip">' + I('skip') + 'Saltar al final</button></div>' : '') + '</div>';
    html += '<div class="mgrid"><div class="card"><div class="hd"><h3>' + I('whistle') + 'Relato del partido</h3></div><div class="evbox" id="cm-ev" style="max-height:460px;background:transparent;padding:0">' + (cm.phase === 'done' ? res.ev.map(UI.mevRow).join('') : '') + '</div></div><div><div class="card"><div class="hd"><h3>' + I('chart') + 'Estadísticas</h3></div><div id="cm-st">' + UI.statBars(UI.matchStats(res.ev, cm.phase === 'done' ? null : (cm.minute || 0))) + '</div></div></div></div>';
    if (cm.phase === 'done') html += '<div class="card" style="text-align:right"><button class="btn cta" data-act="cnext">' + (S.pending.length > 1 ? 'Siguiente partido' : 'Terminar la semana') + I('arrow') + '</button></div>';
    return html;
  };
  UI.after.coach = function () {
    var cm = UI.cm; if (!cm || (cm.phase !== 'play' && cm.phase !== 'ht')) return;
    if (cm.timer) { clearInterval(cm.timer); cm.timer = null; }
    var res = cm.res, idx = cm.idx || 0, box = document.getElementById('cm-ev'), score = document.getElementById('cm-score'), clock = document.getElementById('cm-min'), st = document.getElementById('cm-st'), hs = 0, as = 0, i, total = Math.max(res.et ? 120 : 90, res.ev.length ? res.ev[res.ev.length - 1].m : 90);
    if (!box) return;
    for (i = 0; i < idx; i++) { var e0 = res.ev[i]; box.insertAdjacentHTML('beforeend', UI.mevRow(e0)); if (e0.t === 'goal') { hs = e0.hs; as = e0.as_; } }
    score.innerHTML = hs + '<i>-</i>' + as; clock.textContent = (cm.minute || 0) + "'"; box.scrollTop = box.scrollHeight;
    if (cm.phase === 'ht') return;
    cm.timer = setInterval(function () {
      cm.minute = (cm.minute || 0) + 1; clock.textContent = cm.minute + "'";
      var changed = false;
      while (idx < res.ev.length && res.ev[idx].m <= cm.minute) { var e = res.ev[idx++]; box.insertAdjacentHTML('beforeend', UI.mevRow(e)); box.scrollTop = box.scrollHeight; changed = true; if (e.t === 'goal') { hs = e.hs; as = e.as_; score.innerHTML = hs + '<i>-</i>' + as; } }
      if (changed) st.innerHTML = UI.statBars(UI.matchStats(res.ev, cm.minute));
      cm.idx = idx;
      if (!cm.sess.done && cm.si < cm.stops.length && cm.minute >= cm.stops[cm.si]) { clearInterval(cm.timer); cm.timer = null; cm.minute = cm.stops[cm.si]; cm.phase = 'ht'; UI.render(); return; }
      if (cm.sess.done && cm.minute >= total && idx >= res.ev.length) { clearInterval(cm.timer); cm.timer = null; cm.phase = 'done'; UI.render(); }
    }, 480 / (cm.speed || 1));
  };
  A.cnextmatch = function () { stepUntilMatch(); };
  A.cform = function (d) { if (UI.cm) { UI.cm.form = d.k; UI.render(); } };
  A.cment = function (d) { var cm = UI.cm; if (!cm) return; cm.ment = +d.v; if (cm.sess) cm.sess.setMent(cm.ment); UI.render(); };
  A.cplay = function (d) {
    var cm = UI.cm; if (!cm) return;
    if (d.mode === 'quick') { var res = K.quick(cm.prep, cm.form, cm.ment); cm.res = res; cm.phase = 'done'; UI.render(); return; }
    var b = K.begin(cm.prep, cm.form, cm.ment); cm.sess = b.sess; cm.res = b.res; cm.stops = b.stops; cm.si = 0; cm.minute = 0; cm.idx = 0; cm.speed = 1; cm.phase = 'play'; UI.render();
  };
  A.cresume = function () {
    var cm = UI.cm; if (!cm) return; var fin = K.resume(cm); cm.phase = 'play'; if (fin) cm.stops = []; UI.render();
  };
  A.cspeed = function (d) { var cm = UI.cm; if (!cm) return; cm.speed = +d.v; UI.after.coach(); };
  A.cskip = function () {
    var cm = UI.cm; if (!cm || !cm.sess) return; if (cm.timer) { clearInterval(cm.timer); cm.timer = null; }
    if (!cm.sess.done) { cm.si = cm.stops.length - 1; K.resume(cm); } cm.phase = 'done'; UI.render();
  };
  A.cnext = function () {
    var S = FP.S; UI.cm = null;
    if (K.next()) { UI.render(); return; }
    FP.Game.endWeek(); FP.Store.auto(); UI.toast('Semana completada.', 'ok'); UI.render();
  };
  // el avance de semanas desde "Después del fútbol" se detiene ante un partido que dirigir
  var adv0 = A.postadv;
  A.postadv = function (d) {
    if (!K.job()) return adv0.apply(this, arguments);
    UI.scr = 'coach'; stepUntilMatch();
  };
  var gr = UI.GROUPS[1][1]; gr.splice(1, 0, ['coach', 'Banquillo', 'whistle']);
})();
