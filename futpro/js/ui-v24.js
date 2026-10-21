/* FUTPRO — pantalla "Vida y legado": salud y etapas de la vida tras el fútbol, carrera de entrenador, presidencia, reencuentros y cierre.
   Solo presentación: la lógica vive en retiro.js. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, UI = FP.UI, esc = U.esc, SC = UI.screens, A = UI.acts, I = UI.icon, P = FP.Post, RT = FP.Retiro, Dec = FP.Dec, hdr = UI.hdr, seg = UI.seg;
  function m(k) { return FP.fmt.money(k); }
  function pill(t, c) { return '<span class="pill ' + (c || '') + '">' + t + '</span>'; }
  function bar(v, cls) { return UI.bar(Math.max(0, Math.min(100, v)), 100, cls || ''); }
  function kv(l, v) { return '<div class="kv-i"><span>' + l + '</span><b>' + v + '</b></div>'; }
  function link(s, t) { return '<a class="more" data-act="nav" data-s="' + s + '">' + t + '</a>'; }
  function done(r) { if (r && r.msg) UI.toast(esc(r.msg), r.ok === false ? 'warn' : 'ok'); UI.render(); }

  // ---------- VIDA ----------
  function lifeTab(h, rt) {
    var D2 = FP.Dinero, nw = D2 ? D2.networth() : h.money, yr = D2 ? D2.weeklyLife() * 52 : 0, run = yr > 0 ? nw / yr : null, a = C.age(h);
    var html = UI.decCards(['rt']);
    html += '<div class="grid g2"><div><div class="card"><div class="hd"><h3>' + I('plus') + 'Salud</h3>' + pill(RT.hlLabel(rt.hl), rt.hl >= 65 ? 'g' : rt.hl >= 40 ? 'y' : 'r') + '</div>' + bar(rt.hl, rt.hl < 40 ? 'r' : rt.hl < 60 ? 'y' : '') +
      '<p class="mut sm" style="margin-top:.5rem">Parte de tus lesiones graves, tus semanas de baja y los partidos de tu carrera (' + Math.round(rt.hl0 != null ? rt.hl0 : rt.hl) + ' al retirarte) y se desgasta con los años. Con salud baja rindes menos en cualquier cargo y te llegan problemas que cuestan dinero.' + (rt.fit ? ' Sigues un plan de salud que frena el desgaste.' : '') + '</p></div>' +
      '<div class="card"><div class="hd"><h3>' + I('coin') + 'Patrimonio y nivel de vida</h3>' + link('dinero', 'Finanzas personales') + '</div>' + kv('Patrimonio', m(Math.round(nw))) + kv('Gasto anual de tu nivel de vida', m(Math.round(yr))) + kv('Alcance', run == null ? '—' : run >= 60 ? 'Más de 60 años' : '≈ ' + Math.max(0, Math.round(run)) + ' años') + kv('Edad', a + ' años') + '</div></div>';
    html += '<div><div class="card"><div class="hd"><h3>' + I('history') + 'Etapas</h3></div>' + RT.MS.slice().reverse().map(function (x) {
      var st = rt.ms[x] ? '<span class="mut sm">vivida</span>' : a >= x ? '<span class="mut sm">pendiente</span>' : '<span class="mut sm">a los ' + x + ' años</span>'; return '<div class="row sp sm"><span>' + (x === 45 ? 'Balance del cuerpo y la vida' : x === 55 ? 'Qué haces con tu tiempo' : 'Memorias y despedida definitiva') + '</span>' + st + '</div>';
    }).join('') + '<p class="mut sm" style="margin-top:.5rem">En cada etapa decides cómo vivirla: lo que eliges cuesta dinero, mueve tu salud y queda en tu historia.</p></div>';
    html += '<div class="card"><div class="hd"><h3>' + I('book') + 'Tu historia desde el retiro</h3></div>' + (rt.life.length ? rt.life.slice().reverse().map(function (x) { return '<div class="row sp sm"><span>' + esc(x.t) + '</span><span class="mut">' + x.age + ' años</span></div>'; }).join('') : '<p class="mut sm">Aún no hay etapas vividas.</p>') + '</div></div></div>';
    return html;
  }

  // ---------- CARRERA ----------
  function coachTab(h, p, pa) {
    var j = pa.job, steps = RT.coachSteps(), sh = Math.round(RT.shorten() * 100);
    var html = UI.decCards(['rt', 'post']);
    html += '<div class="grid g2"><div class="card"><div class="hd"><h3>' + I('target') + 'Escalera del entrenador</h3></div>' + steps.map(function (s) { return '<div class="row sp"><span>' + (s.done ? '✓ ' : '· ') + (s.cur ? '<b>' + esc(s.n) + '</b>' : esc(s.n)) + '</span>' + (s.cur ? pill('Tu techo', 'g') : '') + '</div>'; }).join('') + '<p class="mut sm" style="margin-top:.5rem">Tu pasado como jugador acorta el camino: los cursos duran un ' + sh + '% menos y ' + (p.legacy && p.legacy.score >= 62 ? 'puedes saltarte la experiencia mínima de los niveles 2' + (p.legacy.score >= 80 ? ' y Pro' : '') + '.' : 'con más legado (62+) también dejarías de necesitar la experiencia mínima.') + '</p></div>';
    html += '<div class="card"><div class="hd"><h3>' + I('shield') + 'Cargo actual</h3></div>' + (j ? '<div class="row" style="gap:.6rem">' + UI.crest(j.club) + '<div><b>' + esc(P.ROLEN[j.role]) + '</b><div class="mut sm">' + esc(C.tname(j.club)) + ' desde ' + esc(D.fmt(j.since)) + '</div></div></div>' +
      (j.role === 'head' ? '<div class="mut sm" style="margin-top:.6rem">Confianza de la directiva</div>' + bar(j.conf == null ? 60 : j.conf, (j.conf == null ? 60 : j.conf) < 30 ? 'r' : (j.conf == null ? 60 : j.conf) < 50 ? 'y' : '') + '<p class="mut sm">Cada victoria suma y cada derrota resta. Si cae al mínimo con varios partidos dirigidos, te destituyen.</p><button class="btn sm" data-act="nav" data-s="coach">Ir al Banquillo</button>' : '<p class="mut sm" style="margin-top:.6rem">Una buena temporada puede abrirte la puerta al siguiente escalón.</p>') : '<p class="mut">Sin puesto. ' + (p.lic < 1 ? 'Necesitas la Licencia Nivel 1.' : 'Cada año te llegan propuestas.') + '</p>') + '</div></div>';
    if (pa.seasons.length) html += '<div class="card"><div class="hd"><h3>' + I('history') + 'Trayectoria técnica</h3>' + pill(pa.titles + ' título(s)', 'g') + '</div><table class="wt"><thead><tr><th>Temporada</th><th>Club</th><th>Cargo</th><th>Resultado</th></tr></thead><tbody>' + pa.seasons.slice().reverse().slice(0, 12).map(function (s) { return '<tr><td>' + esc(String(s.y)) + '</td><td>' + (s.club != null ? esc(C.tname(s.club)) : '—') + '</td><td>' + esc(P.ROLEN[s.role] || s.role) + '</td><td>' + esc(s.res) + (s.mid ? ' (a mitad de temporada)' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    return html;
  }
  function presTab(h, p, pa) {
    var S = FP.S, job = pa.job, html = UI.decCards(['rt', 'gestion']);
    var fn = RT.fn(); if (!fn) return html + '<div class="card"><p class="mut">Aún no presides ningún club. ' + (Dec.open('gestion').length ? 'Revisa las ofertas pendientes.' : 'Cada año llegan propuestas para comprar el control de un club.') + '</p></div>';
    var club = S.clubs[job.club], wb = RT.wageBill(club), inc = RT.income(club, fn), cs = RT.costs(club), ro = (S.ro[club.id] || []).slice().sort(function (a, b) { return b.o - a.o; });
    html += '<div class="card"><div class="hd"><h3>' + UI.crest(club.id) + ' ' + esc(club.nm) + '</h3>' + pill(esc(FP.LGDEF[club.lg].n), 'b') + '</div><div class="grid g2"><div>' + kv('Caja del club', m(Math.round(fn.cash))) + kv('Tu patrimonio', m(Math.round(h.money))) + kv('Plantel', ro.length + ' jugadores · nivel ' + Math.round(club.st)) + '</div><div>' + kv('Ingreso anual estimado', m(inc)) + kv('Gasto anual estimado', m(cs)) + kv('Estadio · Academia', 'nivel ' + fn.st + ' de 3 · nivel ' + club.ac + ' de 5') + '</div></div>' +
      '<div class="btn-group" style="margin-top:.6rem"><button class="btn" data-act="pr-inject">Inyectar capital</button><button class="btn" data-act="pr-stadium"' + (fn.st >= 3 ? ' disabled' : '') + '>Ampliar estadio (' + m(RT.stadiumCost(club, fn)) + ')</button><button class="btn" data-act="pr-academy"' + (club.ac >= 5 ? ' disabled' : '') + '>Invertir en la academia (' + m(RT.academyCost(club)) + ')</button></div>' +
      '<p class="mut sm" style="margin-top:.5rem">La caja paga los fichajes; si termina la temporada en negativo lo cubres tú. Si hay excedente grande, retiras dividendos. El estadio sube los ingresos y la academia sube de nivel con dos inversiones.</p></div>';
    if (!fn.tg || S.week - fn.tg.w > 12) fn.tg = { w: S.week, list: RT.targets() };
    html += '<div class="grid g2"><div class="card"><div class="hd"><h3>' + I('transfer') + 'Objetivos de fichaje</h3><button class="btn sm" data-act="pr-scan">Buscar otros</button></div><table class="wt"><thead><tr><th>Jugador</th><th class="n">Edad</th><th class="n">Nivel</th><th class="n">Precio</th><th></th></tr></thead><tbody>' +
      fn.tg.list.map(function (t) { var q = S.pl[t.pid]; if (!q || typeof q !== 'object') return ''; return '<tr><td>' + UI.posb(q.p) + ' ' + esc(q.n) + '<div class="mut sm">' + (q.c >= 0 ? esc(C.tname(q.c)) : '') + '</div></td><td class="n">' + C.age(q) + '</td><td class="n">' + q.o + '</td><td class="n">' + m(t.fee) + '</td><td><button class="btn sm" data-act="pr-buy" data-id="' + q.i + '" data-fee="' + t.fee + '">Fichar</button></td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="card"><div class="hd"><h3>' + I('user') + 'Tu plantel</h3></div><table class="wt"><thead><tr><th>Jugador</th><th class="n">Edad</th><th class="n">Nivel</th><th></th></tr></thead><tbody>' + ro.slice(0, 10).map(function (q) { return '<tr><td>' + UI.posb(q.p) + ' ' + esc(q.n) + '</td><td class="n">' + C.age(q) + '</td><td class="n">' + q.o + '</td><td><button class="btn sm" data-act="pr-sell" data-id="' + q.i + '">Vender</button></td></tr>'; }).join('') + '</tbody></table><p class="mut sm">Se venden por el 90% de su valor. Mínimo 18 jugadores.</p></div></div>';
    if (fn.y.length) html += '<div class="card"><div class="hd"><h3>' + I('table') + 'Cuentas por temporada</h3></div><table class="wt"><thead><tr><th>Temporada</th><th class="n">Puesto</th><th class="n">Ingresos</th><th class="n">Gastos</th><th class="n">Resultado</th><th class="n">Capital aportado</th><th class="n">Dividendos</th></tr></thead><tbody>' + fn.y.slice().reverse().map(function (r) { return '<tr><td>' + esc(String(r.y)) + '</td><td class="n">' + r.rank + '.º/' + r.n + '</td><td class="n">' + m(r.inc) + '</td><td class="n">' + m(r.cost) + '</td><td class="n">' + m(r.net) + '</td><td class="n">' + (r.cov ? m(r.cov) : '—') + '</td><td class="n">' + (r.div ? m(r.div) : '—') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    if (fn.tx.length) html += '<div class="card"><div class="hd"><h3>' + I('history') + 'Últimos movimientos</h3></div>' + fn.tx.map(function (x) { return '<div class="row sp sm"><span>' + x.t + ' · ' + esc(x.n) + '</span><span class="mut">' + m(x.v) + ' · ' + esc(D.fmt(x.w)) + '</span></div>'; }).join('') + '</div>';
    return html;
  }
  function careerTab(h, p) {
    var pa = p.path;
    if (!h.retired) return '<div class="card"><p class="mut">Disponible cuando te retires.</p></div>';
    if (!pa) return UI.decCards(['rt']) + '<div class="card"><p class="mut">Aún no elegiste qué hacer después del fútbol. ' + link('post', 'Elegir un camino') + '</p></div>';
    if (pa.k === 'coach') return coachTab(h, p, pa);
    if (pa.k === 'pres') return presTab(h, p, pa);
    return UI.decCards(['rt']) + '<div class="card"><div class="hd"><h3>' + I('target') + esc(P.PATHS[pa.k].nm) + '</h3></div><p class="mut">' + esc(P.PATHS[pa.k].d) + '</p><div class="row sp"><span class="mut sm">Ingresos en este camino</span><b>' + m(pa.inc || 0) + '</b></div><p class="mut sm" style="margin-top:.5rem">' + link('post', 'Ver el detalle en Después del fútbol') + '</p></div>';
  }

  // ---------- REENCUENTROS ----------
  function reencTab(h, rt) {
    var S = FP.S, mates = RT.matesFree().sort(function (a, b) { return (b.m.y1 - b.m.y0) - (a.m.y1 - a.m.y0) || b.m.o - a.m.o; }), rivals = Object.keys(rt.rivals).map(function (k) { return rt.rivals[k]; }).sort(function (a, b) { return b.o - a.o; });
    var html = UI.decCards(['rt']);
    if (rt.trib) html += '<div class="card"><div class="hd"><h3>' + I('medal') + 'Homenaje de un rival</h3></div><p>' + esc(rt.trib.t) + '</p></div>';
    if (rt.mateCoach) html += '<div class="card"><div class="hd"><h3>' + I('whistle') + 'En tu cuerpo técnico</h3></div><p><b>' + esc(rt.mateCoach.n) + '</b> trabaja contigo desde ' + esc(D.fmt(rt.mateCoach.since)) + '. Mejora un poco al equipo y sostiene la confianza de la directiva.</p></div>';
    html += '<div class="grid g2"><div class="card"><div class="hd"><h3>' + I('user') + 'Excompañeros</h3></div>' + (mates.length ? '<table class="wt"><thead><tr><th>Nombre</th><th>Juntos</th><th>Hoy</th></tr></thead><tbody>' + mates.slice(0, 14).map(function (x) { return '<tr><td>' + esc(x.m.n) + '</td><td>' + (x.m.y0 === x.m.y1 ? x.m.y0 : x.m.y0 + '–' + x.m.y1) + ' · ' + esc(C.tname(x.m.club)) + '</td><td>' + (x.gone ? 'Retirado' : x.q.c >= 0 ? esc(C.tname(x.q.c)) : 'Libre') + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="mut sm">Se van registrando a los compañeros con los que compartes vestuario cada año.</p>') +
      '<p class="mut sm">Si diriges un club, un excompañero retirado puede pedir un lugar en tu cuerpo técnico y uno en activo puede pedirte una oportunidad.</p></div>' +
      '<div class="card"><div class="hd"><h3>' + I('shield') + 'Rivales de tu época</h3></div>' + (rivals.length ? '<table class="wt"><thead><tr><th>Nombre</th><th>Años</th><th class="n">Nivel máx.</th></tr></thead><tbody>' + rivals.slice(0, 10).map(function (x) { return '<tr><td>' + esc(x.n) + '</td><td>' + (x.y0 === x.y1 ? x.y0 : x.y0 + '–' + x.y1) + '</td><td class="n">' + x.o + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="mut sm">Se anota al mejor jugador de tu puesto en tu liga cada año.</p>') + '</div></div>';
    return html;
  }

  // ---------- CIERRE ----------
  function closeTab(h, p) {
    var E = RT.hofLoad(), cur = h.retired ? RT.hofEntry() : null, html = '';
    var rows = E.slice();
    html += '<div class="card"><div class="hd"><h3>' + I('trophy') + 'Salón de la Fama de tus carreras</h3></div>' + (rows.length ? '<table class="wt"><thead><tr><th>Jugador</th><th class="n">Legado</th><th class="n">Balón de Oro</th><th class="n">Títulos</th><th class="n">Partidos</th><th class="n">Goles</th><th class="n">Nivel máx.</th><th>Después</th><th></th></tr></thead><tbody>' +
      rows.map(function (e) { var me = cur && e.id === cur.id; return '<tr><td>' + (me ? '<b>' + esc(e.nm) + '</b>' : esc(e.nm)) + '<div class="mut sm">' + esc(e.label) + ' · retiro a los ' + e.ret + ' (' + e.yr + ')' + '</div></td><td class="n">' + e.score + '</td><td class="n">' + e.bo + '</td><td class="n">' + e.tro + '</td><td class="n">' + e.ap + '</td><td class="n">' + e.g + '</td><td class="n">' + e.peak + '</td><td>' + esc(e.path || '—') + '</td><td><button class="btn sm" data-act="rt-hofdel" data-id="' + esc(e.id) + '">Quitar</button></td></tr>'; }).join('') + '</tbody></table><p class="mut sm">Se guarda en este navegador cada vez que te retiras. Compara tus carreras entre sí.</p>' : '<p class="mut">Aún no hay carreras terminadas en este navegador. Cuando te retires, tu carrera quedará registrada aquí.</p>') + '</div>';
    if (h.retired) {
      var img = ''; try { img = RT.card().toDataURL('image/png'); } catch (e) { }
      html += '<div class="grid g2"><div class="card"><div class="hd"><h3>' + I('arrow') + 'Compartir tu carrera</h3></div>' + (img ? '<img src="' + img + '" alt="Tarjeta de carrera" style="width:100%;max-width:340px;border-radius:8px;display:block;margin:.3rem auto">' : '') + '<div class="btn-group" style="margin-top:.6rem"><button class="btn pri" data-act="rt-img">Descargar tarjeta (PNG)</button><button class="btn" data-act="rt-pdf">Imprimir / guardar PDF</button></div></div>' +
        '<div class="card"><div class="hd"><h3>' + I('book') + 'El relato completo</h3></div><p class="mut sm">Tu biografía estilo enciclopedia, el epílogo y el resumen de tu carrera están en estas pantallas.</p><div class="btn-group"><button class="btn" data-act="nav" data-s="bio">Biografía</button><button class="btn" data-act="rt-epi">Epílogo</button></div></div></div>';
    } else html += '<div class="card"><p class="mut">La tarjeta de carrera y la versión imprimible se generan cuando te retiras.</p></div>';
    return html;
  }

  SC.retiro = function () {
    var S = FP.S, h = S.hero, p = P.ensure(), rt = RT.ensure(), tab = UI.tab.retiro || 'vida';
    var html = hdr('book', 'Vida y legado', 'Salud, carrera de entrenador, presidencia, reencuentros y cierre', seg('retiro', [['vida', 'Vida', 'plus'], ['carrera', 'Carrera', 'target'], ['reenc', 'Reencuentros', 'user'], ['cierre', 'Cierre', 'trophy']], tab));
    if (!h.retired) html += '<div class="notice">Todavía estás en actividad. Aquí se desarrolla lo que viene después: tu salud, tu carrera como entrenador o presidente y el cierre de tu historia. Ya puedes ver el Salón de la Fama con tus carreras anteriores.</div>';
    if (!h.retired && tab !== 'cierre') return html + '<div class="card"><p class="mut">Disponible cuando te retires.</p></div>';
    return html + (tab === 'carrera' ? careerTab(h, p) : tab === 'reenc' ? reencTab(h, rt) : tab === 'cierre' ? closeTab(h, p) : lifeTab(h, rt));
  };
  A['pr-inject'] = function () { done(RT.inject()); };
  A['pr-stadium'] = function () { done(RT.stadium()); };
  A['pr-academy'] = function () { done(RT.academy()); };
  A['pr-scan'] = function () { var fn = RT.fn(); if (fn) fn.tg = { w: FP.S.week, list: RT.targets() }; UI.render(); };
  A['pr-buy'] = function (d) { var r = RT.buy(+d.id, +d.fee); var fn = RT.fn(); if (r.ok && fn && fn.tg) fn.tg.list = fn.tg.list.filter(function (t) { return t.pid !== +d.id; }); done(r); };
  A['pr-sell'] = function (d) { UI.confirm('¿Vender a este jugador?', function () { done(RT.sell(+d.id)); }); };
  A['rt-epi'] = function () { UI.tab.post = 'epi'; UI.go('post'); };
  A['rt-hofdel'] = function (d) { UI.confirm('¿Quitar esta carrera del Salón de la Fama?', function () { RT.hofDelete(d.id); UI.render(); }); };
  A['rt-img'] = function () {
    try { var cv = RT.card(); cv.toBlob(function (b) { var a = document.createElement('a'), url = URL.createObjectURL(b); a.href = url; a.download = 'carrera-' + String(FP.S.hero.nm).replace(/\s+/g, '-').toLowerCase() + '.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 500); }, 'image/png'); } catch (e) { UI.toast('No se pudo generar la imagen.', 'warn'); }
  };
  A['rt-pdf'] = function () {
    var w = window.open('', '_blank'); if (!w) { UI.toast('El navegador bloqueó la ventana. Permite ventanas emergentes.', 'warn'); return; }
    w.document.open(); w.document.write(RT.printHtml()); w.document.close(); setTimeout(function () { try { w.focus(); w.print(); } catch (e) { } }, 300);
  };

  // navegación, avisos y acceso desde el inicio del retirado
  var gr = UI.GROUPS[0][1], ix = 0; gr.forEach(function (n, i) { if (n[0] === 'post') ix = i; }); gr.splice(ix + 1, 0, ['retiro', 'Vida y legado', 'book']);
  var badges0 = UI.badges;
  UI.badges = function () { var b = badges0.apply(this, arguments); if (FP.S && FP.S.hero) { var n = Dec.open('rt').length; b.retiro = n || undefined; } return b; };
})();
