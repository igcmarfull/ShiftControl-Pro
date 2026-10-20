/* FUTPRO — pantallas: Inicio, Mi jugador, Mi club, Calendario, Partido, Entrenamientos */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, UI = FP.UI, esc = U.esc, A = UI.acts, SC = UI.screens;

  // ---------- helpers ----------
  UI.heroTeamLabel = function () {
    var h = FP.S.hero;
    if (h.retired) return 'Retirado';
    if (h.tk === 'free') return 'Sin club';
    if (h.tk === 'amat') return C.tname(h.team) + ' (amateur)';
    if (h.tk === 'academy') return C.tname(h.club) + ' · inferiores';
    if (h.tk === 'loan') return C.tname(h.team) + ' (cedido)';
    return C.tname(h.team);
  };
  UI.nextFx = function (n, onlyHero) {
    var S = FP.S, h = S.hero, out = [], mine = {}; mine[h.team] = 1; (h.extraTeams || []).forEach(function (t) { mine[t] = 1; });
    var nat = FP.Nat.heroNation(); if (nat) mine[nat.id] = 2;
    Object.keys(S.comps).forEach(function (id) {
      var c = S.comps[id]; if (c.done) return;
      for (var i = c.cp; i < c.fx.length; i++) {
        var f = c.fx[i]; if (f.d) continue;
        if (mine[f.h] || mine[f.a]) {
          var isNat = (f.h >= 5000 && f.h < 20000) || (f.a >= 5000 && f.a < 20000);
          if (isNat && !(h.nt.dec && h.nt.dec.ok && h.nt.dec.until >= f.w) && !(h.extraTeams || []).length) { if (f.w > S.week + 10) continue; }
          out.push({ c: c, f: f, w: f.w, nat: isNat });
        }
      }
    });
    out.sort(function (a, b) { return a.w - b.w; });
    return out.slice(0, n);
  };
  UI.fxLine = function (x) {
    var f = x.f, h = FP.S.hero;
    var mineId = (f.h === h.team || (x.nat && (f.h >= 5000 && f.h < 20000) && FP.Nat.heroNation() && f.h === FP.Nat.heroNation().id)) ? f.h : f.a;
    var opp = f.h === mineId ? f.a : f.h;
    return '<div class="row sp" style="padding:.3rem 0;border-bottom:1px solid var(--line)"><span><b>' + (f.h === mineId ? 'vs' : '@') + '</b> ' + UI.club(opp) + (x.nat ? ' <span class="pill b">Selección</span>' : '') + '</span><span class="mut sm">' + esc(x.c.nm) + (f.ro ? ' · ' + esc(f.ro) : '') + ' · ' + D.fmt(f.w) + '</span></div>';
  };
  UI.statusPills = function () {
    var h = FP.S.hero, p = '';
    if (h.inj && h.inj.n > 0) p += '<span class="pill r">Lesionado: ' + esc(h.inj.nm) + ' (' + h.inj.n + ' sem.)</span> ';
    if (h.susp > 0) p += '<span class="pill y">Suspendido: ' + h.susp + ' partido(s)</span> ';
    if (h.fat > 75) p += '<span class="pill y">Fatiga alta</span> ';
    if (h.nt.dec && h.nt.dec.ok && h.nt.dec.until >= FP.S.week) p += '<span class="pill b">Convocado a la selección</span> ';
    return p;
  };
  UI.attrBlock = function (h, showCaps) {
    var groups = {}, order = ['Físico', 'Técnico', 'Mental', 'Defensa'];
    C.ATTRS.forEach(function (a) { var g = C.ATTR_GRP[a]; (groups[g] = groups[g] || []).push(a); });
    var wn = C.WN[h.pos] || C.WN.CM;
    var html = '<div class="grid g2">';
    order.forEach(function (g) {
      html += '<div><h4>' + g + '</h4>';
      groups[g].forEach(function (a) {
        var v = h.at[a], d = h.at0 ? v - h.at0[a] : 0, key = wn[a] > 0.07;
        html += '<div class="attr"><span class="nm">' + C.ATTR_NAME[a] + (key ? ' <span class="pill g" style="font-size:.6rem">clave</span>' : '') + '</span>' + UI.bar(v, 99, v >= 75 ? '' : v >= 55 ? 'b' : 'y') + '<span class="v">' + Math.round(v) + '</span></div>';
      });
      html += '</div>';
    });
    return html + '</div>';
  };

  // ======================= INICIO =======================
  SC.home = function () {
    var S = FP.S, h = S.hero, age = FP.Hero.age();
    var pr = FP.Hero.potRange();
    var html = '<div class="grid g21"><div>';
    // ficha rápida
    html += '<div class="card"><div class="pcard"><div class="big">' + UI.ovr(h.ovr, true) + '<div class="pos">' + UI.pos(h.pos) + '</div></div><div>' +
      '<div class="pname">' + esc(h.nm) + '</div><div class="mut">' + age + ' años · ' + esc(C.cname(h.nat)) + ' · ' + UI.heroTeamLabel() + '</div>' +
      '<div style="margin:.35rem 0">' + UI.statusPills() + '</div>' +
      '<div class="row gap"><span class="sm mut">Rol: <b style="color:var(--tx)">' + esc(FP.Hero.roleLabel()) + '</b></span><span class="sm mut">Valor: <b style="color:var(--tx)">' + UI.money(FP.Market.heroValue()) + '</b></span>' + (h.contract ? '<span class="sm mut">Contrato: <b style="color:var(--tx)">hasta ' + h.contract.end + '</b></span>' : '') + '</div></div></div>' +
      '<div class="grid g3" style="margin-top:.8rem"><div><div class="sm mut">Forma</div>' + UI.bar(h.form, 100, h.form > 60 ? '' : 'y') + '</div><div><div class="sm mut">Moral</div>' + UI.bar(h.mor, 100, h.mor > 45 ? 'b' : 'r') + '</div><div><div class="sm mut">Fatiga</div>' + UI.bar(h.fat, 100, h.fat > 70 ? 'r' : h.fat > 45 ? 'y' : '') + '</div></div></div>';
    // pendientes
    var pend = [];
    if (S.pending && S.pending.length) pend.push('<button class="btn pri" data-act="nav" data-s="match">⚽ Tienes ' + S.pending.length + ' partido(s) esta semana</button>');
    if (h.offers.length) pend.push('<button class="btn sec" data-act="nav" data-s="contracts">✎ ' + h.offers.length + ' oferta(s) pendiente(s)</button>');
    if (pend.length) html += '<div class="card"><h3>Pendiente</h3><div class="btn-group">' + pend.join('') + '</div></div>';
    // próximos partidos
    var nx = UI.nextFx(4);
    html += '<div class="card"><div class="hd"><h3>Próximos partidos</h3><a class="lk" data-act="nav" data-s="calendar">Ver calendario</a></div>' + (nx.length ? nx.map(UI.fxLine).join('') : '<p class="mut">No hay partidos programados en las próximas semanas. Mientras tanto, entrena y mantente visible para los clubes.</p>') + '</div>';
    // últimos resultados
    html += '<div class="card"><div class="hd"><h3>Últimos partidos</h3><a class="lk" data-act="nav" data-s="career">Historial</a></div>';
    html += h.log.slice(0, 5).map(function (m) { return '<div class="row sp" style="padding:.3rem 0;border-bottom:1px solid var(--line)"><span><span class="pill ' + (m.r === 'V' ? 'g' : m.r === 'D' ? 'r' : '') + '">' + m.r + '</span> ' + esc(m.s) + ' vs ' + UI.club(m.o) + '</span><span class="mut sm">' + esc(m.c) + ' · ' + (m.rt ? 'nota ' + m.rt.toFixed(1) + ' · ' : '') + (m.g ? m.g + '⚽ ' : '') + (m.a ? m.a + ' asist. ' : '') + m.min + '\'</span></div>'; }).join('') || '<p class="mut">Aún no has jugado partidos en esta carrera.</p>';
    html += '</div></div><div>';
    // temporada
    var s = h.season;
    html += '<div class="card"><h3>Temporada actual</h3><div class="grid g2"><div><div class="mut sm">Partidos</div><b style="font-size:1.4rem">' + s.ap + '</b></div><div><div class="mut sm">Goles</div><b style="font-size:1.4rem">' + s.g + '</b></div><div><div class="mut sm">Asistencias</div><b style="font-size:1.4rem">' + s.a + '</b></div><div><div class="mut sm">Nota media</div><b style="font-size:1.4rem">' + (s.rn ? (s.rs / s.rn).toFixed(2) : '—') + '</b></div></div></div>';
    // entrenamiento
    html += '<div class="card"><div class="hd"><h3>Entrenamiento</h3><a class="lk" data-act="nav" data-s="training">Cambiar</a></div><p>' + esc(FP.Hero.FOCUS[h.train.focus].n) + ' · intensidad ' + ['', 'suave', 'normal', 'intensa'][h.train.int] + '</p><p class="mut sm">Potencial estimado por los ojeadores: <b style="color:var(--tx)">' + pr[0] + '–' + pr[1] + '</b></p></div>';
    // tabla de liga
    var lgc = UI.myLeagueComp();
    if (lgc) html += '<div class="card"><div class="hd"><h3>' + esc(lgc.nm) + '</h3><a class="lk" data-act="nav" data-s="tables">Ver completa</a></div>' + UI.miniTable(lgc) + '</div>';
    // noticias
    html += '<div class="card"><div class="hd"><h3>Noticias</h3><a class="lk" data-act="nav" data-s="news">Más</a></div><div class="feed">' + S.news.filter(function (n) { return n.i >= 2; }).slice(0, 5).map(function (n) { return '<div class="it"><span class="dt">' + D.fmt(n.w) + '</span><span>' + esc(n.t) + '</span></div>'; }).join('') + '</div></div>';
    return html + '</div></div>';
  };
  UI.myLeagueComp = function () {
    var S = FP.S, h = S.hero, id;
    var c = null;
    Object.keys(S.comps).forEach(function (k) { var x = S.comps[k]; if (!c && (x.kind === 'L' || x.kind === 'A' || x.kind === 'Y') && !x.done && x.teams.indexOf(h.team) >= 0) c = x; });
    return c;
  };
  UI.miniTable = function (comp) {
    var rows = FP.Comp.rows(comp), me = FP.S.hero.team, idx = 0;
    rows.forEach(function (r, i) { if (r.id === me) idx = i; });
    var from = Math.max(0, Math.min(rows.length - 6, idx - 2)), part = rows.slice(from, from + 6);
    var h = '<table class="t"><tbody>';
    part.forEach(function (r) { h += '<tr class="' + (r.id === me ? 'me' : '') + '"><td>' + r.pos + '</td><td>' + UI.club(r.id) + '</td><td class="n">' + r.p + '</td><td class="n"><b>' + r.pts + '</b></td></tr>'; });
    return h + '</tbody></table>';
  };

  // ======================= MI JUGADOR =======================
  SC.player = function () {
    var S = FP.S, h = S.hero, age = FP.Hero.age(), tab = UI.tab.player || 'card';
    var tabs = [['card', 'Ficha'], ['prog', 'Progresión'], ['det', 'Detalles']];
    var html = '<h1>' + esc(h.nm) + '</h1><div class="tabs">' + tabs.map(function (t) { return '<button class="' + (tab === t[0] ? 'on' : '') + '" data-act="tabset" data-s="player" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
    var pr = FP.Hero.potRange();
    if (tab === 'card') {
      html += '<div class="grid g21"><div class="card"><div class="pcard"><div class="big">' + UI.ovr(h.ovr, true) + '<div class="pos">' + UI.pos(h.pos) + '</div></div><div><div class="pname">' + esc(h.nm) + '</div><div class="mut">' + age + ' años · ' + esc(C.cname(h.nat)) + (h.city ? ' · ' + esc(h.city) : '') + '</div><div class="mut sm">' + h.ht + ' cm · ' + h.kg + ' kg · pie ' + ({ R: 'derecho', L: 'izquierdo', A: 'ambidiestro' }[h.foot]) + ' · ' + esc(FP.Hero.STYLES[h.style].n) + '</div><div style="margin-top:.4rem">' + UI.statusPills() + '</div></div></div><hr style="border:0;border-top:1px solid var(--line);margin:.8rem 0">' + UI.attrBlock(h) + '</div>' +
        '<div><div class="card"><h3>Estado</h3><dl class="kv"><dt>Forma</dt><dd>' + Math.round(h.form) + '</dd><dt>Moral</dt><dd>' + Math.round(h.mor) + '</dd><dt>Fatiga</dt><dd>' + Math.round(h.fat) + '</dd><dt>Rol en el equipo</dt><dd>' + esc(FP.Hero.roleLabel()) + '</dd><dt>Valor de mercado</dt><dd>' + UI.money(FP.Market.heroValue()) + '</dd><dt>Potencial (estimado)</dt><dd>' + pr[0] + '–' + pr[1] + ' ' + UI.stars(((pr[0] + pr[1]) / 2 - 40) * 1.7) + '</dd></dl><p class="mut sm" style="margin-top:.5rem">El potencial real es oculto y varía entre carreras. La estimación se afina con la edad y al jugar en clubes profesionales.</p></div>' +
        '<div class="card"><h3>Esta temporada</h3><dl class="kv"><dt>Partidos</dt><dd>' + h.season.ap + '</dd><dt>Titular</dt><dd>' + h.season.st + '</dd><dt>Minutos</dt><dd>' + h.season.min + '</dd><dt>Goles</dt><dd>' + h.season.g + '</dd><dt>Asistencias</dt><dd>' + h.season.a + '</dd><dt>Amarillas / rojas</dt><dd>' + h.season.yc + ' / ' + h.season.rc + '</dd><dt>Nota media</dt><dd>' + (h.season.rn ? (h.season.rs / h.season.rn).toFixed(2) : '—') + '</dd></dl></div>' +
        '<div class="card"><h3>Carrera</h3><dl class="kv"><dt>Partidos</dt><dd>' + h.tot.ap + '</dd><dt>Goles</dt><dd>' + h.tot.g + '</dd><dt>Asistencias</dt><dd>' + h.tot.a + '</dd><dt>Selección</dt><dd>' + h.nt.caps + ' partidos · ' + h.nt.goals + ' goles</dd></dl></div></div></div>';
    } else if (tab === 'prog') {
      html += '<div class="card"><h3>Evolución de la media</h3>' + UI.progChart(h) + '<p class="mut sm">Cada punto es la media del jugador cada 4 semanas.</p></div>';
      html += '<div class="card"><h3>Cambios de atributos desde el inicio</h3><div class="grid g4">' + C.ATTRS.map(function (a) { var d = h.at[a] - h.at0[a]; return '<div class="row sp"><span class="mut">' + C.ATTR_NAME[a] + '</span><b class="' + (d > 0.5 ? 'ok' : d < -0.5 ? 'bad' : 'mut') + '">' + (d >= 0 ? '+' : '') + d.toFixed(1) + '</b></div>'; }).join('') + '</div></div>';
      html += '<div class="info">Cómo se progresa: entrenando (menú Entrenamientos), acumulando minutos de calidad y manteniendo buena forma. Los atributos crecen más rápido a los 14–17 años y se estancan o descienden con la edad (físicos desde ~29).</div>';
    } else {
      html += '<div class="card"><h3>Datos personales</h3><div class="grid g4"><label class="f"><span>Nombre</span><input type="text" id="e_nm" value="' + esc(h.nm) + '"></label><label class="f"><span>Ciudad natal</span><input type="text" id="e_city" value="' + esc(h.city) + '"></label><label class="f"><span>Altura (cm)</span><input type="number" id="e_ht" value="' + h.ht + '" min="140" max="210"></label><label class="f"><span>Peso (kg)</span><input type="number" id="e_kg" value="' + h.kg + '" min="35" max="120"></label><label class="f"><span>Pie dominante</span><select id="e_foot"><option value="R"' + (h.foot === 'R' ? ' selected' : '') + '>Derecho</option><option value="L"' + (h.foot === 'L' ? ' selected' : '') + '>Izquierdo</option><option value="A"' + (h.foot === 'A' ? ' selected' : '') + '>Ambidiestro</option></select></label></div><p><button class="btn pri" data-act="savedet">Guardar</button></p></div>';
      html += '<div class="card"><h3>Posición</h3><p class="mut sm">Puedes reconvertirte de posición a lo largo de la carrera. Tus atributos no cambian, pero tu media se recalcula con los pesos de la nueva posición (el portero no está disponible: el modelo de atributos no incluye habilidades de arquero).</p><div class="btn-group">' + C.POS.filter(function (p) { return p !== 'GK'; }).map(function (p) { return '<button class="btn sm ' + (h.pos === p ? 'pri' : '') + '" data-act="setpos" data-p="' + p + '">' + C.POS_ES[p] + ' · ' + esc(C.POS_NAME[p]) + ' (' + Math.round(C.ovrOf(h.at, p)) + ')</button>'; }).join('') + '</div></div>';
      html += '<div class="card"><h3>Instrucción personal en los partidos</h3><p class="mut sm">Cómo juegas dentro de la táctica del equipo.</p><div class="btn-group">' + [[-1, 'Conservador'], [0, 'Equilibrado'], [1, 'Agresivo / ofensivo']].map(function (o) { return '<button class="btn sm ' + ((h.instr || 0) === o[0] ? 'pri' : '') + '" data-act="setinstr" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div></div>';
      html += '<div class="card"><h3>Retiro</h3><p class="mut sm">Puedes retirarte en cualquier momento. A los 39 años el retiro es automático.</p><button class="btn dng" data-act="retire">Anunciar retiro</button></div>';
    }
    return html;
  };
  UI.progChart = function (h) {
    var pts = h.prog; if (pts.length < 2) return '<p class="mut">Aún no hay suficientes datos.</p>';
    var W = 760, H = 220, pad = 34, w0 = pts[0][0], w1 = pts[pts.length - 1][0] || w0 + 1;
    var min = Math.min.apply(null, pts.map(function (p) { return p[1]; })) - 3, max = Math.max.apply(null, pts.map(function (p) { return p[1]; })) + 3;
    var x = function (w) { return pad + (w - w0) / Math.max(1, w1 - w0) * (W - pad * 2); }, y = function (v) { return H - pad - (v - min) / Math.max(1, max - min) * (H - pad * 2); };
    var path = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1); }).join(' ');
    var grid = '';
    for (var v = Math.ceil(min / 5) * 5; v <= max; v += 5) grid += '<line x1="' + pad + '" x2="' + (W - pad) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#263041"/><text x="4" y="' + (y(v) + 4) + '" fill="#64748b" font-size="11">' + v + '</text>';
    var b0 = h.b, ticks = '';
    for (var a = Math.ceil(C.ageF(FP.S.pl[0], w0)); a <= C.ageF(FP.S.pl[0], w1); a++) { var wk = b0 + a * 52.1775; ticks += '<text x="' + x(wk) + '" y="' + (H - 10) + '" fill="#64748b" font-size="11" text-anchor="middle">' + a + '</text>'; }
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto">' + grid + ticks + '<path d="' + path + '" fill="none" stroke="#22c55e" stroke-width="2.5"/></svg>';
  };
  A.savedet = function () {
    var h = FP.S.hero, g = function (id) { return document.getElementById(id).value; };
    h.nm = g('e_nm').trim() || h.nm; h.city = g('e_city').trim(); h.ht = U.clamp(+g('e_ht') || h.ht, 140, 210); h.kg = U.clamp(+g('e_kg') || h.kg, 35, 120); h.foot = g('e_foot');
    FP.S.pl[0].n = h.nm; UI.toast('Datos guardados.', 'ok'); UI.render();
  };
  A.setpos = function (d) {
    var h = FP.S.hero; h.pos = d.p; FP.Hero.updateOvr(); h.cap = FP.Hero.makeCaps(h.at, h.pos, Math.max(h.pot, h.ovr + 1), h.style);
    UI.toast('Ahora juegas de ' + C.POS_NAME[d.p] + '.', 'ok'); UI.render();
  };
  A.setinstr = function (d) { FP.S.hero.instr = +d.v; UI.render(); };
  A.retire = function () { UI.confirm('¿Seguro que quieres retirarte? Esta decisión es definitiva y tu carrera terminará.', function () { FP.Events.retire(false); FP.Store.auto(true); UI.render(); UI.go('career'); }); };

  // ======================= MI CLUB =======================
  SC.club = function () {
    var S = FP.S, h = S.hero, cid = h.club;
    if (h.tk === 'amat') {
      var ac = S.amat[h.team - 20000], comp = UI.myLeagueComp();
      var html = '<h1>' + esc(ac.nm) + '</h1><div class="notice">Club amateur local' + (ac.gen ? ' generado' : ' creado por ti') + ': no figura en la base de datos de clubes reales.</div>';
      html += '<div class="grid g2"><div class="card"><h3>Datos</h3><dl class="kv"><dt>País</dt><dd>' + esc(C.cname(ac.c)) + '</dd><dt>Nivel del equipo</dt><dd>' + ac.st + '</dd><dt>Tu estatus</dt><dd>Titular del plantel</dd></dl><p class="mut sm" style="margin-top:.5rem">Consejo: muéstrate en el campeonato regional y pide pruebas en los clubes profesionales desde "Mercado de fichajes".</p></div>';
      html += '<div class="card"><h3>' + (comp ? esc(comp.nm) + ' ' + esc(comp.label) : 'Competencia regional') + '</h3>' + (comp ? UI.miniTable(comp) : '<p class="mut">El próximo torneo regional comienza pronto.</p>') + '</div></div>';
      html += '<div class="card"><h3>Crear otro club amateur</h3><div class="row"><input type="text" id="newam" placeholder="Nombre del club local"><button class="btn pri" data-act="newamat">Crear y fichar por el club</button></div><p class="mut sm">Quedas inscrito como jugador del nuevo club en el regional de tu zona.</p></div>';
      return html;
    }
    if (cid == null) {
      return '<h1>Sin club</h1><div class="card"><p>Estás sin club. Revisa ofertas en "Contratos" y pide pruebas en "Mercado de fichajes".</p><div class="row"><input type="text" id="newam" placeholder="Nombre de un club amateur local"><button class="btn pri" data-act="newamat">Fichar por un club amateur local</button></div></div>';
    }
    var club = S.clubs[cid], lg = FP.LGDEF[club.lg];
    var html2 = '<div class="hd"><h1>' + esc(club.nm) + '</h1><span>' + UI.verBadge(lg.v) + '</span></div>';
    html2 += '<div class="grid g3"><div class="card"><h3>Club</h3><dl class="kv"><dt>País</dt><dd>' + esc(C.cname(club.c)) + '</dd><dt>Liga</dt><dd>' + esc(lg.n) + '</dd><dt>Entrenador</dt><dd>' + esc(club.co) + ' <span class="tag-gen">generado</span></dd><dt>Fuerza</dt><dd>' + club.st + '</dd><dt>Cantera</dt><dd>' + UI.stars(club.ac * 20) + '</dd><dt>Poder económico</dt><dd>' + club.fin + '/10</dd></dl></div>';
    var comp = UI.myLeagueComp();
    html2 += '<div class="card" style="grid-column:span 2"><h3>' + (comp ? esc(comp.nm) + ' ' + esc(comp.label) : 'Competición') + '</h3>' + (comp ? UI.miniTable(comp) : '') + '</div></div>';
    if (h.tk === 'academy') html2 += '<div class="info">Juegas en las divisiones inferiores. Cuando tu nivel se acerque al del primer equipo, serás promovido. Abajo ves el plantel profesional de referencia.</div>';
    html2 += '<h3>Plantel profesional</h3>' + UI.squadTable(cid, 'squad');
    return html2;
  };
  UI.squadTable = function (cid, id) {
    var rows = (FP.S.ro[cid] || []).map(function (p) { var age = C.age(p); return { p: p, nm: p.i === 0 ? FP.S.hero.nm : p.n, pos: p.p, age: age, o: p.o, nat: p.nat, v: C.value(p.o, p.pt, age), ce: p.ce, g: p.g || 0, a: p.as || 0, inj: p.inj || 0 }; });
    var posOrd = { GK: 0, CB: 1, LB: 2, RB: 3, DM: 4, CM: 5, AM: 6, LW: 7, RW: 8, ST: 9 };
    rows.forEach(function (r) { r.po = posOrd[r.pos]; });
    return UI.table(id, [
      { k: 'po', t: 'Pos', f: function (r) { return '<span class="pill">' + UI.pos(r.pos) + '</span>'; } },
      { k: 'nm', t: 'Jugador', f: function (r) { return UI.player(r.p) + (r.p.i !== 0 ? '<span class="tag-gen">generado</span>' : ' <span class="pill g">tú</span>'); } },
      { k: 'age', t: 'Edad', n: 1 }, { k: 'o', t: 'Media', n: 1, f: function (r) { return UI.ovr(r.o); } }, { k: 'nat', t: 'Nac.', f: function (r) { return UI.nation(r.nat); } },
      { k: 'v', t: 'Valor', n: 1, f: function (r) { return UI.money(r.v); } }, { k: 'ce', t: 'Contrato', n: 1 }, { k: 'g', t: 'Goles', n: 1 }, { k: 'a', t: 'Asist.', n: 1 },
      { k: 'inj', t: 'Estado', f: function (r) { return r.inj ? '<span class="pill r">lesión ' + r.inj + 's</span>' : ''; } }
    ], rows, { sort: ['po', 'a'], cls: function (r) { return r.p.i === 0 ? 'me' : ''; } });
  };
  A.newamat = function () {
    var nm = (document.getElementById('newam').value || '').trim(); if (nm.length < 3) { UI.toast('Escribe un nombre para el club.', 'warn'); return; }
    var cc = FP.Market.heroCountry(); var id = FP.Market.newAmateurClub(nm, FP.DATA.countries[cc] ? cc : 'CHI', 50);
    FP.Market.joinAmateur(id); FP.Hero.msg('Te incorporas al club local ' + nm + '.', 'ok'); UI.toast('Ahora juegas en ' + esc(nm) + '.', 'ok'); UI.render();
  };

  // ======================= CALENDARIO =======================
  SC.calendar = function () {
    var S = FP.S, h = S.hero, tab = UI.tab.calendar || 'next';
    var html = '<h1>Calendario</h1><div class="tabs">' + [['next', 'Próximos partidos'], ['res', 'Resultados'], ['year', 'Fechas importantes']].map(function (t) { return '<button class="' + (tab === t[0] ? 'on' : '') + '" data-act="tabset" data-s="calendar" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
    if (tab === 'next') {
      var nx = UI.nextFx(30);
      html += '<div class="card">' + (nx.length ? nx.map(UI.fxLine).join('') : '<p class="mut">Sin partidos programados todavía.</p>') + '</div>';
    } else if (tab === 'res') {
      var rows = h.log.map(function (m) { return { w: m.w, c: m.c, o: m.o, h: m.h, s: m.s, r: m.r, role: m.role, min: m.min, g: m.g, a: m.a, rt: m.rt, off: m.off }; });
      html += UI.table('cal_res', [
        { k: 'w', t: 'Fecha', f: function (r) { return D.fmt(r.w); } }, { k: 'c', t: 'Competición' },
        { k: 'o', t: 'Rival', f: function (r) { return (r.h ? 'vs ' : '@ ') + UI.club(r.o); }, v: function (r) { return C.tname(r.o); } },
        { k: 's', t: 'Resultado', f: function (r) { return '<span class="pill ' + (r.r === 'V' ? 'g' : r.r === 'D' ? 'r' : '') + '">' + r.r + '</span> ' + esc(r.s); } },
        { k: 'role', t: 'Rol', f: function (r) { return { tit: 'Titular', sup: 'Suplente', banca: 'Banca', fuera: 'Fuera' }[r.role]; } },
        { k: 'min', t: 'Min', n: 1 }, { k: 'g', t: 'G', n: 1 }, { k: 'a', t: 'A', n: 1 }, { k: 'rt', t: 'Nota', n: 1, f: function (r) { return r.rt ? r.rt.toFixed(1) : '—'; } }
      ], rows, { sort: ['w', 'd'], max: 120 });
      if (!rows.length) html += '<p class="mut">Aún no hay partidos registrados.</p>';
    } else {
      var y = D.year(S.week), ev = [], wins = FP.Nat.windows(y);
      ev.push([FP.Date.of(y, 0, 2), 'Abre el mercado de invierno']); ev.push([FP.Date.of(y, 1, 5), 'Cierra el mercado de invierno']);
      ev.push([FP.Date.of(y, 5, 15), 'Abre el mercado de verano']); ev.push([FP.Date.of(y, 8, 4), 'Cierra el mercado de verano']);
      wins.forEach(function (w, i) { ev.push([w, 'Ventana FIFA de selecciones']); });
      Object.keys(S.comps).forEach(function (id) { var c = S.comps[id]; if (!c.done && (c.kind === 'X' || c.kind === 'C') && c.w0 != null && c.w0 >= S.week && c.w0 < S.week + 60) ev.push([c.w0, 'Inicia: ' + c.nm + ' ' + (c.label || '')]); });
      ev = ev.filter(function (e) { return e[0] >= S.week - 1; }).sort(function (a, b) { return a[0] - b[0]; });
      html += '<div class="card feed">' + ev.map(function (e) { return '<div class="it"><span class="dt">' + D.fmt(e[0]) + '</span><span>' + esc(e[1]) + '</span></div>'; }).join('') + '</div>';
    }
    return html;
  };

  // ======================= PARTIDO =======================
  var INSTR = { '-1': 'Conservador', '0': 'Equilibrado', '1': 'Agresivo' };
  SC.match = function () {
    var S = FP.S, h = S.hero;
    if (!UI.mt && S.pending && S.pending.length) { var prep = FP.Game.nextPending(); if (prep) UI.mt = { phase: 'pre', prep: prep }; }
    var mt = UI.mt;
    if (!mt) {
      var last = h.log[0];
      return '<h1>Partido</h1><div class="card"><p>' + (last ? 'Último partido: <b>' + esc(last.c) + '</b> — ' + esc(last.s) + ' vs ' + UI.club(last.o) + ' (' + D.fmt(last.w) + '). ' + (last.rt ? 'Nota ' + last.rt.toFixed(1) + '.' : '') : 'Aún no has jugado.') + '</p><p class="mut">No tienes partidos pendientes esta semana.</p><button class="btn pri" data-act="adv" data-w="1">▶ Avanzar semana</button></div>';
    }
    var prep2 = mt.prep, f = prep2.f, comp = prep2.comp, st = prep2.status;
    var hName = C.tname(f.h), aName = C.tname(f.a);
    var html = '<h1>Partido</h1>';
    var left = S.pending.length;
    if (mt.phase === 'pre') {
      html += '<div class="card"><div class="mut sm center">' + esc(comp.nm) + (f.ro ? ' · ' + esc(f.ro) : '') + ' · ' + D.fmt(f.w) + (left > 1 ? ' · ' + left + ' partidos esta semana' : '') + '</div>' +
        '<div class="score" style="margin:1rem 0"><div class="tm">' + UI.club(f.h) + '</div><div class="sc">vs</div><div class="tm">' + UI.club(f.a) + '</div></div>' +
        '<div class="grid g3"><div><h4>Tu rol hoy</h4><b>' + ({ starter: 'Titular', bench: 'Suplente (banca)', out: 'Fuera de convocatoria' }[st.role]) + '</b>' + (st.why ? ' <span class="pill y">' + esc(st.why) + '</span>' : '') + '</div>' +
        '<div><h4>Fuerza</h4>' + esc(hName) + ' <b>' + (comp.ys && comp.ys[f.h] != null ? comp.ys[f.h] : C.strOf(f.h)) + '</b> · ' + esc(aName) + ' <b>' + (comp.ys && comp.ys[f.a] != null ? comp.ys[f.a] : C.strOf(f.a)) + '</b></div>' +
        '<div><h4>Condición</h4>Forma ' + Math.round(h.form) + ' · Moral ' + Math.round(h.mor) + ' · Fatiga ' + Math.round(h.fat) + '</div></div>' +
        '<div class="row" style="margin-top:.8rem"><span class="mut sm">Instrucción:</span><div class="btn-group">' + [-1, 0, 1].map(function (v) { return '<button class="btn sm ' + ((h.instr || 0) === v ? 'pri' : '') + '" data-act="minstr" data-v="' + v + '">' + INSTR[v] + '</button>'; }).join('') + '</div></div>' +
        '<div class="btn-group" style="margin-top:1rem"><button class="btn pri" data-act="mplay" data-mode="live">▶ Ver minuto a minuto</button><button class="btn" data-act="mplay" data-mode="quick">⚡ Simulación rápida</button></div></div>';
      return html;
    }
    var res = mt.res, hm = res.hero, total = res.ev.length ? res.ev[res.ev.length - 1].m : 90;
    var isLive = mt.phase === 'play';
    html += '<div class="card"><div class="mut sm center">' + esc(comp.nm) + (f.ro ? ' · ' + esc(f.ro) : '') + ' · ' + D.fmt(f.w) + '</div><div class="score" style="margin:.8rem 0"><div class="tm">' + UI.club(f.h) + '</div><div><div class="sc" id="mt-score">' + (isLive ? '0 - 0' : res.hs + ' - ' + res.as) + '</div><div class="mn" id="mt-clock">' + (isLive ? '0\'' : (res.et ? 'Final (prórroga)' : 'Final')) + '</div></div><div class="tm">' + UI.club(f.a) + '</div></div>' +
      (res.ps ? '<p class="center mut" id="mt-ps">Penales: ' + res.ps[0] + ' - ' + res.ps[1] + '</p>' : '') +
      (isLive ? '<div class="btn-group" style="justify-content:center"><button class="btn sm" data-act="mspeed" data-v="1">1×</button><button class="btn sm" data-act="mspeed" data-v="3">3×</button><button class="btn sm" data-act="mspeed" data-v="8">8×</button><button class="btn sm pri" data-act="mskip">⏭ Saltar al final</button></div>' : '') + '</div>';
    html += '<div class="grid g21"><div class="card"><h3>Relato</h3><div class="evbox" id="mt-ev">' + (isLive ? '' : res.ev.map(UI.evHtml).join('')) + '</div></div><div>';
    if (hm) {
      html += '<div class="card" id="mt-hero" ' + (isLive ? 'style="display:none"' : '') + '><h3>Tu partido</h3>' + UI.heroMatchCard(res, prep2) + '</div>';
    }
    html += '<div class="card"><h3>Alineaciones</h3><div class="grid g2"><div><h4>' + esc(hName) + '</h4>' + res.xi.h.map(function (p) { return '<div class="sm">' + (p.id === 0 ? '<b class="ok">' : '') + esc(p.n) + (p.id === 0 ? '</b>' : '') + ' <span class="dim">' + UI.pos(p.pos) + ' ' + Math.round(p.o) + '</span></div>'; }).join('') + '</div><div><h4>' + esc(aName) + '</h4>' + res.xi.a.map(function (p) { return '<div class="sm">' + (p.id === 0 ? '<b class="ok">' : '') + esc(p.n) + (p.id === 0 ? '</b>' : '') + ' <span class="dim">' + UI.pos(p.pos) + ' ' + Math.round(p.o) + '</span></div>'; }).join('') + '</div></div><p class="mut sm" style="margin-top:.4rem">Los futbolistas rivales y compañeros son generados por el juego.</p></div>';
    html += '</div></div>';
    if (!isLive) html += '<div class="card"><button class="btn pri" data-act="mnext">' + (left > 1 ? 'Continuar al siguiente partido' : 'Terminar la semana') + '</button></div>';
    return html;
  };
  UI.evHtml = function (e) {
    var cls = 'ev ' + e.t + (e.hero ? ' hero' : '') + (e.t === 'red' || e.red2 ? ' red' : '');
    var icon = { goal: '⚽', yellow: '🟨', red: '🟥', inj: '✚', sub: '⇄', pen: '◎', save: '🧤', post: '▮', miss: '·', block: '·', chance: '›', et: '⏱', pens: '◎' }[e.t] || '';
    return '<div class="' + cls + '"><span class="m">' + (e.m ? e.m + '\'' : '') + '</span><span>' + icon + ' ' + esc(e.x) + (e.t === 'goal' ? ' <b>(' + e.hs + '-' + e.as_ + ')</b>' : '') + '</span></div>';
  };
  UI.heroMatchCard = function (res, prep) {
    var hm = res.hero;
    if (!hm.played) return '<p>' + ({ out: 'Quedaste fuera de la convocatoria.', bench: 'Estuviste en el banco pero no ingresaste.', starter: '' }[prep.status.role] || '') + (prep.status.why ? ' (' + esc(prep.status.why) + ')' : '') + '</p>';
    return '<div class="row sp"><div><div class="sm mut">Nota</div><div style="font-size:2rem;font-weight:800" class="' + (hm.rating >= 7.5 ? 'ok' : hm.rating < 5.5 ? 'bad' : '') + '">' + hm.rating.toFixed(1) + '</div></div><div class="kv" style="min-width:55%"><dt>Rol</dt><dd>' + (hm.subIn ? 'Ingresó al ' + hm.subIn + '\'' : 'Titular') + '</dd><dt>Minutos</dt><dd>' + hm.min + '</dd><dt>Goles</dt><dd>' + hm.g + '</dd><dt>Asistencias</dt><dd>' + hm.a + '</dd><dt>Remates (a puerta)</dt><dd>' + hm.sh + ' (' + hm.sot + ')</dd><dt>Pases clave</dt><dd>' + hm.kp + '</dd><dt>Tarjetas</dt><dd>' + hm.yc + '🟨 ' + hm.rc + '🟥</dd></dl></div>' + (hm.inj ? '<p class="bad">Terminaste lesionado.</p>' : '');
  };
  A.minstr = function (d) { FP.S.hero.instr = +d.v; UI.render(); };
  A.mplay = function (d) {
    var r = FP.Game.playPending(); if (!r) return;
    UI.mt = { phase: d.mode === 'live' ? 'play' : 'done', prep: r.prep, res: r.res, minute: 0, speed: 1 };
    UI.render();
  };
  UI.after.match = function () {
    var mt = UI.mt; if (!mt || mt.phase !== 'play') return;
    if (mt.timer) clearInterval(mt.timer);
    var res = mt.res, idx = mt.idx || 0, box = document.getElementById('mt-ev'), score = document.getElementById('mt-score'), clock = document.getElementById('mt-clock');
    var total = res.ev.length ? res.ev[res.ev.length - 1].m : 90, hs = 0, as = 0;
    // reconstruye el estado hasta el minuto actual
    for (var i = 0; i < idx; i++) { var e0 = res.ev[i]; box.insertAdjacentHTML('beforeend', UI.evHtml(e0)); if (e0.t === 'goal') { hs = e0.hs; as = e0.as_; } }
    score.textContent = hs + ' - ' + as;
    mt.timer = setInterval(function () {
      mt.minute = (mt.minute || 0) + (mt.speed > 1 ? 1 : 1);
      clock.textContent = mt.minute + '\'';
      while (idx < res.ev.length && res.ev[idx].m <= mt.minute) {
        var e = res.ev[idx++]; box.insertAdjacentHTML('beforeend', UI.evHtml(e)); box.scrollTop = box.scrollHeight;
        if (e.t === 'goal') { hs = e.hs; as = e.as_; score.textContent = hs + ' - ' + as; }
      }
      mt.idx = idx;
      if (mt.minute >= total && idx >= res.ev.length) UI.matchFinish();
    }, 900 / (mt.speed || 1));
  };
  UI.matchFinish = function () {
    var mt = UI.mt; if (!mt) return; if (mt.timer) { clearInterval(mt.timer); mt.timer = null; }
    mt.phase = 'done'; UI.render();
  };
  A.mspeed = function (d) { var mt = UI.mt; if (!mt) return; mt.speed = +d.v; UI.after.match(); };
  A.mskip = function () { UI.matchFinish(); };
  A.mnext = function () {
    var S = FP.S;
    UI.mt = null;
    if (S.pending.length) { UI.render(); return; }
    FP.Game.endWeek(); FP.Store.auto();
    UI.toast('Semana completada.', 'ok'); UI.go('home');
  };

  // ======================= ENTRENAMIENTOS =======================
  SC.training = function () {
    var S = FP.S, h = S.hero, t = h.train, lt = S.lastTrain;
    var html = '<h1>Entrenamientos</h1><div class="grid g21"><div>';
    html += '<div class="card"><h3>Enfoque de la semana</h3><div class="grid g2">' + Object.keys(FP.Hero.FOCUS).map(function (k) {
      var f = FP.Hero.FOCUS[k], attrs = k === 'auto' ? null : FP.Hero.focusAttrs(k);
      return '<div class="card opt ' + (t.focus === k ? 'sel' : '') + '" style="margin:0;' + (t.focus === k ? 'border-color:var(--ac);background:#12301f' : '') + '" data-act="tfocus" data-k="' + k + '"><b>' + esc(f.n) + '</b><div class="mut sm">' + esc(f.d) + '</div>' + (attrs && attrs.length ? '<div class="sm" style="margin-top:.3rem">' + attrs.map(function (a) { return '<span class="pill">' + C.ATTR_NAME[a] + '</span>'; }).join(' ') + '</div>' : '') + '</div>';
    }).join('') + '</div></div>';
    html += '<div class="card"><h3>Intensidad</h3><div class="btn-group">' + [[1, 'Suave', 'menos fatiga y riesgo de lesión'], [2, 'Normal', 'equilibrio'], [3, 'Intensa', 'mejora más, cansa más y lesiona más']].map(function (o) { return '<button class="btn ' + (t.int === o[0] ? 'pri' : '') + '" data-act="tint" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div><p class="mut sm" style="margin-top:.5rem">' + ['', 'Suave: menos fatiga y riesgo de lesión, mejora más lenta.', 'Normal: equilibrio entre progresión y desgaste.', 'Intensa: progresión más rápida, pero más fatiga y mayor riesgo de lesión.'][t.int] + '</p></div>';
    html += '<div class="card"><h3>Entrenador personal</h3><p class="mut sm">Mejora la eficacia del entrenamiento (+10% por nivel). Se paga con tu dinero (' + UI.money(h.money) + ' disponible).</p><div class="btn-group">' + [[0, 'Ninguno', 0], [1, 'Nivel 1', 0.08], [2, 'Nivel 2', 0.18], [3, 'Nivel 3', 0.4]].map(function (o) { return '<button class="btn sm ' + ((h.pcoach || 0) === o[0] ? 'pri' : '') + '" data-act="tcoach" data-v="' + o[0] + '"' + (o[0] && h.money < o[2] * 10 ? ' disabled' : '') + '>' + o[1] + (o[2] ? ' · ' + UI.money(o[2]) + '/sem' : '') + '</button>'; }).join('') + '</div></div>';
    html += '</div><div>';
    html += '<div class="card"><h3>Condición física</h3><div class="sm mut">Fatiga</div>' + UI.bar(h.fat, 100, h.fat > 70 ? 'r' : h.fat > 45 ? 'y' : '') + '<div class="sm mut" style="margin-top:.4rem">Forma</div>' + UI.bar(h.form, 100) + '<div class="sm mut" style="margin-top:.4rem">Moral</div>' + UI.bar(h.mor, 100, 'b') + '<p class="mut sm" style="margin-top:.5rem">' + (h.inj && h.inj.n > 0 ? '<span class="bad">Lesionado: ' + esc(h.inj.nm) + ', ' + h.inj.n + ' semana(s). El entrenamiento se reduce a recuperación.</span>' : 'Con fatiga alta el rendimiento y la progresión bajan y aumenta el riesgo de lesión. Alterna semanas intensas con descanso.') + '</p></div>';
    html += '<div class="card"><h3>Última semana</h3>';
    if (lt && lt.gains && Object.keys(lt.gains).length) {
      html += (lt.autoFocus ? '<p class="mut sm">Plan automático: <b>' + esc(FP.Hero.FOCUS[lt.autoFocus].n) + '</b></p>' : '') + Object.keys(lt.gains).map(function (a) { return '<div class="row sp"><span>' + C.ATTR_NAME[a] + '</span><b class="ok">+' + lt.gains[a].toFixed(2) + '</b></div>'; }).join('');
    } else html += '<p class="mut">' + (lt && lt.rest ? 'Semana de descanso/recuperación.' : 'Todavía sin datos: avanza una semana.') + '</p>';
    html += '</div><div class="card"><h3>Instalaciones</h3><p class="mut sm">Factor de entrenamiento: <b style="color:var(--tx)">×' + FP.Hero.facility().toFixed(2) + '</b>' + (h.tk === 'amat' ? ' (club amateur)' : h.club != null ? ' (cantera del club: ' + FP.S.clubs[h.club].ac + '/5)' : '') + '</p></div></div></div>';
    return html;
  };
  A.tfocus = function (d) { FP.S.hero.train.focus = d.k; UI.render(); };
  A.tint = function (d) { FP.S.hero.train.int = +d.v; UI.render(); };
  A.tcoach = function (d) { FP.S.hero.pcoach = +d.v; UI.render(); };
})();
