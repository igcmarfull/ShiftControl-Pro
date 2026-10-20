/* FUTPRO — interfaz de Vida personal y de Después del fútbol (legado, homenaje, caminos posteriores).
   Solo presentación: la lógica vive en life.js y postcareer.js. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, UI = FP.UI, esc = U.esc, A = UI.acts, SC = UI.screens, I = UI.icon;
  var L = FP.Life, P = FP.Post, Dec = FP.Dec, hdr = UI.hdr, seg = UI.seg;
  function pill(t, c) { return '<span class="pill ' + (c || '') + '">' + t + '</span>'; }
  function bar(v, cls) { return UI.bar(Math.max(0, Math.min(100, v)), 100, cls || ''); }
  function money(v) { return UI.money(v); }
  function stat(l, v) { return '<div><b>' + v + '</b><span>' + l + '</span></div>'; }

  // ---------- VIDA PERSONAL ----------
  SC.life = function () {
    var S = FP.S, h = S.hero, l = L.ensure(), e = l.edu, f = l.fam, p = l.press, age = L.age(), here = L.here(), abroad = L.abroad();
    var html = hdr('home', 'Vida personal', 'Estudios, familia, idioma y prensa');
    html += UI.decCards(['vida']);
    var studying = (age < 18 && !e.grad && e.mode !== 'none') || e.mode === 'uni' || (e.mode === 'sec' && !e.grad);
    // estudios
    html += '<div class="grid g2"><div><div class="card"><div class="hd"><h3>' + I('train') + 'Estudios</h3>' + pill(e.degree ? 'Título universitario' : e.grad ? 'Secundaria completa' : studying ? 'En curso' : 'Sin estudios en curso', e.degree || e.grad ? 'g' : 'y') + '</div>';
    if (studying) {
      var uni = e.mode === 'uni';
      html += '<div class="mut sm">' + (uni ? 'Carrera universitaria a distancia — avance ' + Math.round(e.uprog) + '%' : e.grad ? '' : 'Promedio de notas: ' + Math.round(e.grade)) + '</div>' + bar(uni ? e.uprog : e.grade, !uni && e.grade < 45 ? 'r' : '') +
        '<h4 style="margin-top:.7rem">Dedicación</h4><div class="btn-group">' + [[1, 'Baja'], [2, 'Normal'], [3, 'Alta']].map(function (o) { return '<button class="btn sm ' + (e.inten === o[0] ? 'pri' : '') + '" data-act="eduint" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>' +
        '<p class="mut sm" style="margin-top:.5rem">Más estudio sube tus notas y acerca el título, pero resta energía y eficacia de entrenamiento (hasta –5%). ' + (h.tk === 'academy' ? 'La cantera y tu familia esperan buenas notas.' : '') + '</p>';
    } else html += '<p class="mut sm">' + (e.grad ? 'Terminaste el colegio con promedio ' + Math.round(e.grade) + '.' : 'Tus estudios formales no están en curso.') + (age >= 18 && !e.degree && e.mode === 'none' ? ' Una carrera a distancia te da un título para después del fútbol.' : '') + '</p>' +
      (age >= 18 && !e.degree && e.mode === 'none' ? '<button class="btn" data-act="eduuni">Comenzar carrera universitaria a distancia</button>' : '');
    html += '</div>';
    // familia
    var modeN = { casa: 'Vives con tu familia', residencia: 'Residencia del club', solo: 'Vives solo', familia: 'Tu familia se mudó contigo' }[f.mode] || '';
    html += '<div class="card"><div class="hd"><h3>' + I('user') + 'Familia y hogar</h3>' + pill(esc(modeN), f.mode === 'familia' || f.mode === 'casa' ? 'g' : '') + '</div><div class="mut sm">Apoyo familiar</div>' + bar(f.support) + '<div class="mut sm" style="margin-top:.5rem">Nostalgia</div>' + bar(f.homesick, f.homesick > 60 ? 'r' : f.homesick > 35 ? 'y' : '') +
      '<p class="mut sm" style="margin-top:.5rem">' + (abroad ? 'Vives en ' + esc(C.cname(here)) + ', lejos de tu país. La nostalgia resta moral y rendimiento; vivir con tu familia la reduce.' : 'Estás en tu país: tu entorno te sostiene.') + '</p></div></div><div>';
    // idioma
    var key = L.langKey(here), lv = L.level(key), nat = L.langKey(h.nat);
    html += '<div class="card"><div class="hd"><h3>' + I('chat') + 'Idioma y adaptación</h3>' + (abroad ? pill('En el extranjero', 'b') : pill('En tu país', 'g')) + '</div>';
    html += Object.keys(l.lang).map(function (k) { return '<div class="row sp sm"><span>' + esc(L.langName(k)) + '</span><b>' + Math.round(l.lang[k]) + '%</b></div>' + bar(l.lang[k]); }).join('');
    if (abroad && l.lang[key] == null) html += '<div class="row sp sm" style="margin-top:.4rem"><span>' + esc(L.langName(key)) + ' (local)</span><b>' + lv + '%</b></div>' + bar(lv, 'y');
    if (abroad) html += '<div class="mut sm" style="margin-top:.6rem">Adaptación al país</div>' + bar(l.adapt, l.adapt < 60 ? 'y' : '') + '<p class="mut sm" style="margin-top:.4rem">Penalización actual de rendimiento: <b>–' + L.pen().toFixed(1) + ' pts</b>. Desaparece al dominar el idioma y adaptarte.</p>' +
      '<div class="row sp"><div><b>Clases de idioma</b><div class="mut sm">Aprendes mucho más rápido (≈ ' + FP.fmt.money(12) + ' al mes).</div></div><button class="btn ' + (l.cls ? 'pri' : '') + '" data-act="langcls">' + (l.cls ? 'Activadas' : 'Activar') + '</button></div>';
    else html += '<p class="mut sm" style="margin-top:.5rem">Si fichas en el extranjero tendrás que aprender el idioma local.</p>';
    html += '</div>';
    // prensa
    html += '<div class="card"><div class="hd"><h3>' + I('news') + 'Imagen pública y prensa</h3></div><div class="mut sm">Imagen pública</div>' + bar(p.img, p.img < 35 ? 'r' : '') + '<div class="mut sm" style="margin-top:.5rem">Presión mediática</div>' + bar(p.heat, p.heat > 60 ? 'r' : p.heat > 30 ? 'y' : '') +
      '<p class="mut sm" style="margin-top:.5rem">Cuando tu fama crece, la prensa te pide declaraciones tras buenos o malos momentos. Lo que respondes mueve tu imagen, tu moral y tu relación con el entrenador.</p></div>';
    html += '</div></div>';
    if (l.ev.length) html += '<div class="card"><div class="hd"><h3>' + I('history') + 'Momentos</h3></div>' + l.ev.slice(0, 8).map(function (x) { return '<div class="row sp sm"><span>' + esc(x.t) + '</span><span class="mut">' + esc(D.fmt(x.w)) + '</span></div>'; }).join('') + '</div>';
    return html;
  };
  A.eduint = function (d) { var e = L.ensure().edu; e.inten = +d.v; e.boost = 0; UI.render(); };
  A.eduuni = function () { var e = L.ensure().edu; e.mode = 'uni'; e.inten = 2; e.uprog = 0; L.log('Empiezas una carrera universitaria a distancia.'); UI.toast('Empiezas la universidad a distancia.', 'ok'); UI.render(); };
  A.langcls = function () { var l = L.ensure(); l.cls = !l.cls; UI.render(); };

  // ---------- DESPUÉS DEL FÚTBOL ----------
  function legacyTab(p) {
    var lg = p.legacy || P.legacy(), h = FP.S.hero, t = p.tribute || {};
    var html = '<div class="grid g2"><div><div class="card" style="border-color:var(--gold,var(--ac))"><div class="hd"><h3>' + I('medal') + 'Legado</h3>' + (h.retired ? '' : pill('Proyección', 'y')) + '</div><div style="text-align:center;padding:.6rem 0"><div style="font-size:3rem;font-family:var(--disp);font-weight:800">' + lg.score + '</div><div class="mut sm">de 100</div><h2 style="margin:.3rem 0">' + esc(lg.label) + '</h2></div>' +
      '<div class="pstat" style="grid-template-columns:repeat(3,1fr)">' + stat('Partidos', lg.ap) + stat('Goles', lg.g) + stat('Asist.', lg.a) + stat('Títulos', lg.trophies) + stat('Premios', lg.awards) + stat('Selección', lg.caps) + '</div><p class="mut sm" style="margin-top:.6rem">Media máxima ' + lg.peak + ' · ' + lg.years + ' años de carrera' + (lg.bo ? ' · ' + lg.bo + ' Balón(es) de Oro' : '') + '. El legado mezcla nivel máximo, títulos, premios, selección y longevidad (puntuación propia del juego).</p></div>';
    if (h.retired) html += '<div class="card"><div class="hd"><h3>' + I('flag') + 'Despedida</h3></div>' + (t.st === 'done' ? '<p>' + esc(t.note) + '</p>' : t.st === 'pend' ? UI.decCards(['retiro']) || '<p class="mut">Pendiente.</p>' : '<p class="mut">Sin ceremonia.</p>') + '</div>';
    html += '</div><div><div class="card"><div class="hd"><h3>' + I('shield') + 'Clubes</h3></div>' + (lg.clubs.length ? lg.clubs.map(function (c) { return '<div class="row sp"><span>' + esc(c.nm) + '</span><span class="mut sm">' + c.y + ' temp. · ' + c.ap + ' PJ · ' + c.g + ' goles</span></div>'; }).join('') : '<p class="mut">Sin clubes registrados.</p>') + '</div>';
    var hi = (h.history || []).slice(-8).reverse(); if (h.retired && hi.length) html += '<div class="card"><div class="hd"><h3>' + I('history') + 'Últimos hitos</h3></div>' + hi.map(function (x) { return '<div class="row sp sm"><span>' + esc(x.t) + '</span><span class="mut">' + esc(D.fmt(x.w)) + '</span></div>'; }).join('') + '</div>';
    return html + '</div></div>';
  }
  function pathTab(p) {
    var S = FP.S, h = S.hero, pa = p.path, html = UI.decCards(['post', 'agente']);
    if (!pa) {
      html += '<div class="grid g2">' + Object.keys(P.PATHS).map(function (k) { return '<div class="card"><div class="hd"><h3>' + esc(P.PATHS[k].nm) + '</h3></div><p class="mut sm">' + esc(P.PATHS[k].d) + '</p><button class="btn pri" data-act="postpath" data-k="' + k + '">Elegir</button></div>'; }).join('') + '</div>';
      return html;
    }
    html += '<div class="card"><div class="hd"><h3>' + I('target') + esc(P.PATHS[pa.k].nm) + '</h3><div class="btn-group"><button class="btn sm" data-act="postchange">Cambiar de camino</button></div></div><div class="row sp"><span class="mut sm">Ingresos acumulados en este camino</span><b>' + money(pa.inc) + '</b></div></div>';
    if (pa.course) html += '<div class="card"><div class="hd"><h3>' + I('train') + 'Curso en marcha</h3></div><p>' + esc(pa.course.kind === 'agent' ? 'Licencia de agente' : P.LIC[pa.course.lvl]) + ' — faltan ' + pa.course.left + ' semanas.</p></div>';
    if (pa.k === 'coach') {
      html += '<div class="grid g2"><div class="card"><div class="hd"><h3>' + I('contract') + 'Licencias</h3></div><p>' + esc(P.LIC[p.lic]) + '</p><p class="mut sm">Temporadas de experiencia: ' + p.exp + '. Tu legado y tus estudios acortan los cursos.</p>' + (p.lic < 3 && !pa.course ? '<button class="btn pri" data-act="postcourse" data-k="coach">Comenzar ' + esc(P.LIC[p.lic + 1].toLowerCase()) + '</button>' : '') + '</div>';
      html += '<div class="card"><div class="hd"><h3>' + I('shield') + 'Puesto actual</h3></div>' + (pa.job ? '<div class="row" style="gap:.6rem">' + UI.crest(pa.job.club) + '<div><b>' + esc(P.ROLEN[pa.job.role]) + '</b><div class="mut sm">' + esc(C.tname(pa.job.club)) + ' desde ' + esc(D.fmt(pa.job.since)) + '</div></div></div>' : '<p class="mut">' + (p.lic < 1 ? 'Necesitas la Licencia Nivel 1 para recibir ofertas.' : 'Sin puesto. Cada año te llegarán propuestas según tu licencia y trayectoria.') + '</p>') + '</div></div>';
      if (pa.seasons.length) html += '<div class="card"><div class="hd"><h3>' + I('history') + 'Temporadas como técnico</h3>' + pill(pa.titles + ' título(s)', 'g') + '</div>' + pa.seasons.slice().reverse().map(function (s) { return '<div class="row sp sm"><span>' + esc(s.y) + ' · ' + esc(C.tname(s.club)) + ' <span class="mut">(' + esc(P.ROLEN[s.role]) + ')</span></span><b>' + esc(s.res) + '</b></div>'; }).join('') + '</div>';
    } else if (pa.k === 'tv') {
      var NM = ['Colaborador ocasional', 'Panelista', 'Comentarista de partidos', 'Figura de la TV deportiva'];
      html += '<div class="card"><div class="hd"><h3>' + I('news') + 'Televisión</h3>' + pill(NM[pa.lvl], 'g') + '</div><div class="mut sm">Audiencia</div>' + bar(pa.aud) + '<p class="mut sm" style="margin-top:.5rem">Tu fama de jugador y tus estudios empujan la audiencia; las polémicas la mueven.</p></div>';
      if (pa.seasons.length) html += '<div class="card"><div class="hd"><h3>Temporadas</h3></div>' + pa.seasons.slice().reverse().map(function (s) { return '<div class="row sp sm"><span>' + esc(s.y) + ' · ' + NM[s.lvl] + '</span><b>Audiencia ' + s.aud + '</b></div>'; }).join('') + '</div>';
    } else if (pa.k === 'agent') {
      html += '<div class="grid g2"><div class="card"><div class="hd"><h3>' + I('contract') + 'Licencia</h3></div><p>' + (p.agentLic ? 'Licencia de agente vigente.' : 'Aún no tienes la licencia.') + '</p>' + (!p.agentLic && !pa.course ? '<button class="btn pri" data-act="postcourse" data-k="agent">Sacar la licencia (' + money(5) + ')</button>' : '') + '<p class="mut sm">Reputación como agente: ' + Math.round(pa.rep || 0) + '. Más reputación permite más representados (máx. ' + (3 + Math.floor((pa.rep || 0) / 25)) + ').</p></div>';
      html += '<div class="card"><div class="hd"><h3>' + I('user') + 'Representados</h3></div>' + (pa.clients.length ? pa.clients.map(function (c) { var q = S.pl[c.pid]; if (!q) return ''; var loy = c.loy == null ? 60 : c.loy; return '<div class="person"><div class="row sp"><span><b>' + esc(q.n) + '</b> ' + (c.star ? pill('Figura', 'g') : '') + '<div class="mut sm">' + C.POS_ES[q.p] + ' · ' + C.age(q) + ' años · ' + (q.c >= 0 && q.c < 5000 ? esc(C.tname(q.c)) : 'sin club') + ' · comisiones ' + money(Math.round(c.com || 0)) + '</div></span><b style="font-size:1.2rem">' + Math.round(q.o) + '</b></div><div class="mut sm">Lealtad</div>' + bar(loy, loy < 35 ? 'r' : loy < 55 ? 'y' : '') + '</div>'; }).join('') : '<p class="mut">Sin representados todavía.</p>') + '</div></div>';
    }
    return html;
  }
  SC.post = function () {
    var S = FP.S, h = S.hero, p = P.ensure(), tab = UI.tab.post || 'legacy';
    var html = hdr('medal', 'Después del fútbol', h.retired ? 'Tu legado y lo que viene' : 'Tu legado proyectado y los caminos posteriores', seg('post', [['legacy', 'Legado', 'medal'], ['path', 'Qué haces después', 'target']], tab) + (h.retired ? '<div class="btn-group"><button class="btn" data-act="postadv" data-w="4">' + I('fwd') + '4 semanas</button><button class="btn pri" data-act="postadv" data-w="52">' + I('fwd') + '1 año</button></div>' : ''));
    if (!h.retired) html += '<div class="notice">Todavía estás en actividad. Cuando te retires podrás despedirte con un homenaje y elegir cómo seguir: entrenador, comentarista o representante. Esta es una proyección con tu carrera hasta hoy.</div>';
    if (tab === 'path' && !h.retired) return html + '<div class="card"><p class="mut">Disponible cuando te retires.</p></div>';
    return html + (tab === 'path' ? pathTab(p) : legacyTab(p));
  };
  // avanza semanas del mundo; se detiene cuando aparece una decisión nueva para que no caduque sin verla
  A.postadv = function (d) {
    if (UI.busy) return; var left = Math.max(1, +d.w || 4), n0 = Dec.open().length, done = 0;
    UI.busy = true; UI.overlay('Avanzando el mundo…');
    (function loop() {
      var t0 = Date.now();
      while (left > 0 && Date.now() - t0 < 40 && Dec.open().length <= n0) { FP.Sim.step(); left--; done++; }
      if (left > 0 && Dec.open().length <= n0) setTimeout(loop, 0);
      else { UI.busy = false; UI.overlay(false); FP.Store.auto(true); if (left > 0) UI.toast('Tienes una decisión pendiente.', 'warn'); UI.render(); }
    })();
  };
  A.postpath = function (d) { var r = P.choose(d.k); UI.toast(esc(r.msg), r.ok ? 'ok' : 'warn'); UI.render(); };
  A.postchange = function () { UI.confirm('¿Dejar este camino? Conservas tus licencias, pero pierdes el puesto o los representados actuales.', function () { P.ensure().path = null; UI.render(); }); };
  A.postcourse = function (d) { var r = P.startCourse(d.k); UI.toast(esc(r.msg), r.ok ? 'ok' : 'warn'); UI.render(); };

  // retiro: lleva a la pantalla de legado; inicio de retirados
  A.retire = function () { UI.confirm('¿Seguro que quieres retirarte? Esta decisión es definitiva: pasarás a la vida posterior al fútbol.', function () { FP.Events.retire(false); FP.Store.auto(true); UI.tab.post = 'legacy'; UI.go('post'); }); };
  var home0 = SC.home;
  SC.home = function () {
    var h = FP.S.hero, html = home0.apply(this, arguments);
    if (!h.retired) return html;
    return '<div class="card glass" style="margin-bottom:.8rem"><div class="hd"><h3>' + I('medal') + 'Te retiraste del fútbol</h3></div><p class="mut">Mira tu legado y decide qué haces después.</p><button class="btn pri" data-act="nav" data-s="post">Ver legado y futuro</button></div>' + html;
  };
  var gr = UI.GROUPS[0][1];
  gr.splice(gr.length - 1, 0, ['life', 'Vida personal', 'home'], ['post', 'Después del fútbol', 'medal']);
})();
