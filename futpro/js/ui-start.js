/* FUTPRO — menú principal, creación de carrera y carga de partidas */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, UI = FP.UI, esc = U.esc, A = UI.acts;
  var Start = FP.Start = {};
  var app = function () { return document.getElementById('app'); };

  function loading(msg, p) {
    app().innerHTML = '<div class="boot" style="position:static;min-height:100vh"><div class="boot-in"><div class="logo-big">FUT<b>PRO</b></div><p id="ld-msg">' + esc(msg || 'Cargando…') + '</p><div class="progress"><i id="ld-bar" style="width:' + Math.round((p || 0) * 100) + '%"></i></div><p class="mut sm">La primera carga genera el fútbol mundial: unos segundos.</p></div></div>';
  }
  function progress(msg, p) { var m = document.getElementById('ld-msg'), b = document.getElementById('ld-bar'); if (m) m.textContent = msg; if (b) b.style.width = Math.round(p * 100) + '%'; }

  Start.menu = function () {
    if (UI.mt && UI.mt.timer) clearInterval(UI.mt.timer);
    UI.mt = null;
    var html = '<div class="start" style="grid-column:1/-1"><div class="hero-banner"><div class="logo-big">FUT<b>PRO</b></div><h2 style="font-weight:500;color:var(--mut)">El Brasfoot de los futbolistas</h2><p class="mut">Vive la carrera de un solo jugador, de los 12 años al retiro, en un mundo con clubes reales que juega independientemente de ti.</p></div>';
    var yrs = ''; for (var yy = 2026; yy >= 1995; yy--) yrs += '<option value="' + yy + '"' + (yy === Start.y0 ? ' selected' : '') + '>' + yy + '</option>';
    html += '<div class="card" style="margin-bottom:.8rem"><div class="row sp"><div><h3 style="margin:0">Año de inicio</h3><p class="mut sm" style="margin:.2rem 0 0">Cambia solo el calendario (fechas, edades y torneos como la Eurocopa o el Mundial según el año). Los clubes, ligas y selecciones son los actuales (2026) y los jugadores son generados.</p></div><select data-act="st-year" style="min-width:6rem">' + yrs + '</select></div></div>';
    html += '<div class="grid g2">' +
      '<div class="card opt" data-act="st-preset"><h3>⚽ Partida preconfigurada: Ignacio</h3><p class="mut">13 años · delantero centro físico y potente · media 58 · Deportivo Los Aromos · 14 partidos, 9 goles y 3 asistencias · subcampeón regional. Mayo del año de inicio elegido, con una oportunidad pendiente en San Fernando.</p><span class="btn pri">Jugar</span></div>' +
      '<div class="card opt" data-act="st-new"><h3>✚ Nueva carrera</h3><p class="mut">Crea tu futbolista: nombre, país, edad (12–17), posición, estilo, atributos y club de inicio (amateur o inferiores de un club profesional).</p><span class="btn">Crear jugador</span></div>' +
      '</div><div id="st-saves"></div>';
    html += '<div class="card" style="margin-top:1rem"><h3>Sobre los datos</h3><p class="mut sm">Clubes, ligas y países son reales (temporada ' + esc(FP.DATA.seasonLabel) + '); <b>los futbolistas se generan automáticamente</b> y no corresponden a personas reales. Algunas composiciones de liga están marcadas “por verificar”. Consulta Configuración → Datos y pendientes dentro del juego.</p><p class="mut sm">Se juega sin conexión: todo se guarda en este navegador (y puedes exportar tu partida a un archivo).</p>' +
      '<label class="btn sm" style="cursor:pointer">Importar partida desde archivo<input type="file" id="st-imp" accept=".fpsave,.json,application/json" style="display:none" data-act="st-imp"></label></div></div>';
    app().innerHTML = html;
    FP.Store.list().then(function (list) {
      var box = document.getElementById('st-saves'); if (!box) return;
      if (!list.length) return;
      box.innerHTML = '<div class="card"><h3>Continuar</h3>' + list.slice(0, 6).map(function (s) { var m = s.meta; return '<div class="row sp" style="padding:.45rem 0;border-bottom:1px solid var(--line)"><span><b>' + esc(s.label || m.name) + '</b> <span class="mut sm">· ' + (m.age != null ? m.age + ' años · media ' + m.ovr + ' · ' : '') + esc(m.team) + ' · ' + esc(m.date) + (m.retired ? ' · retirado' : '') + '</span></span><span class="btn-group"><button class="btn sm pri" data-act="st-load" data-id="' + s.id + '">Cargar</button><button class="btn sm dng" data-act="st-del" data-id="' + s.id + '">Borrar</button></span></div>'; }).join('') + '</div>';
    });
  };
  A['st-load'] = function (d) {
    loading('Cargando partida…', 0.4);
    setTimeout(function () { FP.Store.load(d.id).then(function () { UI.scr = 'home'; UI.render(); }).catch(function (e) { UI.toast('No se pudo cargar: ' + esc(e.message), 'bad'); Start.menu(); }); }, 30);
  };
  A['st-del'] = function (d) { UI.confirm('¿Borrar esta partida?', function () { FP.Store.remove(d.id).then(function () { Start.menu(); }); }); };
  A['st-imp'] = function (d, t) {
    var f = t.files && t.files[0]; if (!f) return;
    loading('Importando partida…', 0.4);
    FP.Store.import(f).then(function () { return FP.Store.save(); }).then(function () { UI.scr = 'home'; UI.render(); UI.toast('Partida importada.', 'ok'); }).catch(function (e) { UI.toast('No se pudo importar: ' + esc(e.message), 'bad'); Start.menu(); });
  };
  Start.y0 = 2026;
  A['st-year'] = function (d, t) { Start.y0 = +(t && t.value || d.v) || 2026; };
  A['st-preset'] = function () {
    loading('Preparando el mundo…', 0.02);
    var seed = Math.floor(Math.random() * 2e9);
    FP.Game.buildWorld(seed, progress, Start.y0).then(function () {
      FP.Game.startPreset(); UI.scr = 'home'; UI.mt = null;
      return FP.Store.save().catch(function () { });
    }).then(function () { UI.render(); }).catch(Start.fail);
  };
  Start.fail = function (e) { console.error(e); app().innerHTML = '<div class="start"><div class="card"><h3>Error</h3><pre class="bad" style="white-space:pre-wrap">' + esc(e.stack || e.message) + '</pre><button class="btn" data-act="st-menu">Volver</button></div></div>'; };
  A['st-menu'] = function () { Start.menu(); };

  // ---------- asistente de nueva carrera ----------
  var form = null;
  A['st-new'] = function () {
    form = { nm: '', ln: '', nat: 'CHI', city: '', age: 13, ht: 165, kg: 55, pos: 'ST', foot: 'R', style: 'fisico', extra: {}, club: 'amat', amName: '', acId: null, res: null };
    Start.wizard();
  };
  Start.wizard = function () {
    var f = form, pts = 30 - Object.keys(f.extra).reduce(function (s, k) { return s + f.extra[k]; }, 0);
    var natOpts = FP.DATA.nations.slice().sort(function (a, b) { return a.n.localeCompare(b.n, 'es'); }).map(function (n) { return '<option value="' + n.c + '" ' + (f.nat === n.c ? 'selected' : '') + '>' + esc(n.n) + '</option>'; }).join('');
    var clubs = FP.S ? [] : [];
    var html = '<div class="start"><h1>Nueva carrera</h1><div class="card"><h3>1 · Tu futbolista</h3><div class="grid g4">' +
      '<label class="f"><span>Nombre</span><input type="text" id="w_nm" value="' + esc(f.nm) + '" placeholder="Ignacio"></label>' +
      '<label class="f"><span>Apellido</span><input type="text" id="w_ln" value="' + esc(f.ln) + '"></label>' +
      '<label class="f"><span>País</span><select id="w_nat">' + natOpts + '</select></label>' +
      '<label class="f"><span>Ciudad natal</span><input type="text" id="w_city" value="' + esc(f.city) + '"></label>' +
      (FP.DATA.countries[f.nat] ? '' : '<label class="f"><span>País donde juegas (tu selección no tiene liga cargada)</span><select id="w_res">' + Object.keys(FP.DATA.countries).map(function (k) { return '<option value="' + k + '" ' + ((f.res || "ESP") === k ? 'selected' : '') + '>' + esc(FP.DATA.countries[k].n) + '</option>'; }).join('') + '</select></label>') +
      '<label class="f"><span>Edad de inicio</span><select id="w_age">' + [12, 13, 14, 15, 16, 17].map(function (a) { return '<option ' + (f.age === a ? 'selected' : '') + '>' + a + '</option>'; }).join('') + '</select></label>' +
      '<label class="f"><span>Altura (cm)</span><input type="number" id="w_ht" value="' + f.ht + '" min="140" max="205"></label>' +
      '<label class="f"><span>Peso (kg)</span><input type="number" id="w_kg" value="' + f.kg + '" min="35" max="110"></label>' +
      '<label class="f"><span>Pie dominante</span><select id="w_foot"><option value="R" ' + (f.foot === 'R' ? 'selected' : '') + '>Derecho</option><option value="L" ' + (f.foot === 'L' ? 'selected' : '') + '>Izquierdo</option><option value="A" ' + (f.foot === 'A' ? 'selected' : '') + '>Ambidiestro</option></select></label>' +
      '<label class="f"><span>Posición</span><select id="w_pos">' + C.POS.filter(function (p) { return p !== 'GK'; }).map(function (p) { return '<option value="' + p + '" ' + (f.pos === p ? 'selected' : '') + '>' + C.POS_ES[p] + ' · ' + esc(C.POS_NAME[p]) + '</option>'; }).join('') + '</select></label>' +
      '<label class="f"><span>Estilo de juego</span><select id="w_style">' + Object.keys(FP.Hero.STYLES).map(function (k) { return '<option value="' + k + '" ' + (f.style === k ? 'selected' : '') + '>' + esc(FP.Hero.STYLES[k].n) + '</option>'; }).join('') + '</select></label>' +
      '</div></div>';
    html += '<div class="card"><div class="hd"><h3>2 · Atributos iniciales</h3><span class="pill ' + (pts < 0 ? 'r' : 'g') + '">Puntos libres: ' + pts + '</span></div><p class="mut sm">El nivel base depende de tu edad, estilo y posición. Reparte hasta 30 puntos extra (máx. +12 por atributo). El potencial es oculto y se sortea en cada carrera.</p><div class="grid g4">' +
      C.ATTRS.map(function (a) { return '<label class="f"><span>' + C.ATTR_NAME[a] + ': <b id="w_v_' + a + '">+' + (f.extra[a] || 0) + '</b></span><input type="range" min="0" max="12" value="' + (f.extra[a] || 0) + '" data-live="st-attr" data-a="' + a + '"></label>'; }).join('') + '</div></div>';
    html += '<div class="card"><h3>3 · Club de inicio</h3><div class="btn-group"><button class="btn ' + (f.club === 'amat' ? 'pri' : '') + '" data-act="st-club" data-v="amat">Club amateur / escuela de fútbol</button><button class="btn ' + (f.club === 'acad' ? 'pri' : '') + '" data-act="st-club" data-v="acad">Inferiores de un club profesional</button></div>';
    if (f.club === 'amat') html += '<div class="grid g2" style="margin-top:.8rem"><label class="f"><span>Nombre del club amateur (puede ser uno local que no figure en la base de datos)</span><input type="text" id="w_am" value="' + esc(f.amName) + '" placeholder="Ej.: Deportivo Los Aromos"></label></div><p class="mut sm">Disputarás campeonatos regionales y podrás recibir invitaciones de clubes profesionales.</p>';
    else {
      var cc = FP.DATA.countries[f.nat] ? f.nat : (f.res || 'ESP'), list = FP.DATA.leagues.filter(function (l) { return l.c === cc && l.t <= 3; });
      var all = []; FP.DATA.leagues.forEach(function (l) { if (l.t <= 3 && (!FP.DATA.countries[cc] || l.c === cc)) l.clubs.split(';').forEach(function (n) { all.push([n, l]); }); });
      if (!f.acName && all.length) f.acName = all[0][0];
      html += '<div class="grid g2" style="margin-top:.8rem"><label class="f"><span>Club (' + esc(FP.DATA.countries[cc] ? FP.DATA.countries[cc].n : 'todos') + ')</span><select id="w_ac">' + all.map(function (x) { return '<option value="' + esc(x[0]) + '" ' + (f.acName === x[0] ? 'selected' : '') + '>' + esc(x[0]) + ' — ' + esc(x[1].n) + '</option>'; }).join('') + '</select></label></div><p class="mut sm">Ejemplos para Chile: O\'Higgins, Universidad Católica, Colo-Colo, Universidad de Chile, Unión Española, Deportes Santa Cruz y más.</p>';
    }
    html += '</div><div class="row"><button class="btn pri" data-act="st-create">Crear carrera</button><button class="btn" data-act="st-menu">Cancelar</button></div></div>';
    app().innerHTML = html;
  };
  function readForm() {
    var g = function (id) { var e = document.getElementById(id); return e ? e.value : null; };
    var f = form;
    if (g('w_nm') != null) f.nm = g('w_nm'); if (g('w_ln') != null) f.ln = g('w_ln'); if (g('w_nat')) f.nat = g('w_nat'); if (g('w_city') != null) f.city = g('w_city');
    if (g('w_age')) f.age = +g('w_age'); if (g('w_ht')) f.ht = +g('w_ht'); if (g('w_kg')) f.kg = +g('w_kg'); if (g('w_foot')) f.foot = g('w_foot'); if (g('w_pos')) f.pos = g('w_pos'); if (g('w_style')) f.style = g('w_style');
    if (g('w_res')) f.res = g('w_res'); if (g('w_am') != null) f.amName = g('w_am'); if (g('w_ac')) f.acName = g('w_ac');
  }
  A['st-club'] = function (d) { readForm(); form.club = d.v; Start.wizard(); };
  A['st-attr'] = function (d, t) {
    var v = +t.value, a = d.a, f = form, used = Object.keys(f.extra).reduce(function (s, k) { return s + (k === a ? 0 : f.extra[k]); }, 0);
    v = Math.min(v, 30 - used); t.value = v; f.extra[a] = v; if (!v) delete f.extra[a];
    var lab = document.getElementById('w_v_' + a); if (lab) lab.textContent = '+' + v;
    var pill = document.querySelector('.hd .pill'); if (pill) { var left = 30 - used - v; pill.textContent = 'Puntos libres: ' + left; }
  };
  document.addEventListener('change', function (e) { if (form && e.target.id && e.target.id.indexOf('w_') === 0 && (e.target.id === 'w_nat' || e.target.id === 'w_pos' || e.target.id === 'w_res')) { readForm(); if (e.target.id === 'w_nat' || e.target.id === 'w_res') form.acName = null; Start.wizard(); } });
  A['st-create'] = function () {
    readForm();
    var f = form, nm = (f.nm + ' ' + f.ln).trim();
    if (f.nm.trim().length < 2) { UI.toast('Escribe el nombre del jugador.', 'warn'); return; }
    if (f.club === 'amat' && f.amName.trim().length < 3) { UI.toast('Escribe el nombre del club amateur.', 'warn'); return; }
    var used = Object.keys(f.extra).reduce(function (s, k) { return s + f.extra[k]; }, 0);
    if (used > 30) { UI.toast('Te pasaste de los 30 puntos.', 'warn'); return; }
    loading('Preparando el mundo…', 0.02);
    var seed = Math.floor(Math.random() * 2e9);
    FP.Game.buildWorld(seed, progress, Start.y0).then(function () {
      var opts = { res: f.res, nm: nm, nat: f.nat, city: f.city, age: f.age, h: f.ht, kg: f.kg, pos: f.pos, foot: f.foot, style: f.style, extra: f.extra };
      if (f.club === 'amat') opts.club = { kind: 'amat', name: f.amName.trim() };
      else { var c = FP.S.clubs.filter(function (c) { return c.nm === f.acName; })[0] || FP.S.clubs.filter(function (c) { return c.nm === 'Colo-Colo'; })[0]; opts.club = { kind: 'academy', id: c.id }; }
      FP.Game.startCareer(opts); UI.scr = 'home'; UI.mt = null;
      return FP.Store.save().catch(function () { });
    }).then(function () { UI.render(); }).catch(Start.fail);
  };
})();
