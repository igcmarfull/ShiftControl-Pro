/* FUTPRO — menú reorganizado («opción A»): menos entradas y pantallas agrupadas en pestañas.
   Mi jugador (Perfil · Salud · Vestuario · Vida personal), Mi carrera (Resumen · Metas · Historial · Palmarés · Biografía),
   Entrenamientos y táctica, Clasificaciones y estadísticas, Mercado y contratos, Después del retiro.
   Las pantallas originales siguen existiendo: los identificadores antiguos redirigen a su pestaña (UI.go('health') abre Mi jugador › Salud).
   Mientras juegas y una vez retirado el menú muestra solo lo que sirve en cada estado. Solo presentación. */
(function () {
  'use strict';
  var FP = window.FP, UI = FP.UI, SC = UI.screens, Dec = FP.Dec, hdr = UI.hdr, seg = UI.seg;
  function retired() { var h = FP.S && FP.S.hero; return !!(h && h.retired); }

  // ---------- pantallas agrupadas ----------
  var ORIG = {};
  ['clubwiki', 'player', 'health', 'locker', 'life', 'review', 'goals', 'career', 'honors', 'bio', 'training', 'tactics', 'tables', 'stats', 'market', 'contracts', 'tryouts', 'post', 'retiro', 'ficha', 'club', 'idolo'].forEach(function (k) { ORIG[k] = SC[k]; });

  // separa el encabezado propio de una pantalla: devuelve sus herramientas (botones, pestañas internas) y el resto
  function split(html) {
    var key = '<div class="scr-h">', i = html.indexOf(key); if (i < 0) return { tools: '', rest: html };
    var depth = 0, j = i, re = /<div\b|<\/div>/g, m; re.lastIndex = i;
    while ((m = re.exec(html))) { if (m[0] === '</div>') { depth--; if (!depth) { j = m.index + 6; break; } } else depth++; }
    var head = html.slice(i, j), t = head.indexOf('<div class="tools">'), tools = '';
    if (t >= 0) tools = head.slice(t + '<div class="tools">'.length, head.length - '</div></div>'.length);
    return { tools: tools, rest: html.slice(0, i) + html.slice(j) };
  }
  function merged(id, title, icon, sub, views) {
    SC[id] = function () {
      var key = 'g_' + id, vs = views.filter(function (v) { return !v.when || v.when(); }), cur = UI.tab[key];
      if (!vs.some(function (v) { return v.k === cur; })) cur = vs[0].k;
      var v = vs.filter(function (x) { return x.k === cur; })[0], inner;
      try { inner = ORIG[v.id](); } catch (e) { inner = '<div class="card"><pre class="bad">' + FP.U.esc(e.stack || e.message) + '</pre></div>'; if (window.console) console.error(e); }
      var p = split(inner);
      return hdr(icon, title, sub, p.tools) + (vs.length > 1 ? seg(key, vs.map(function (x) { return [x.k, x.n]; }), cur) : '') + p.rest;
    };
  }
  var play = function () { return !retired(); };
  merged('player', 'Mi jugador', 'user', 'Perfil, salud, vestuario y vida personal', [
    { k: 'perfil', n: 'Perfil', id: 'player' }, { k: 'salud', n: 'Salud', id: 'health', when: play }, { k: 'vestuario', n: 'Vestuario', id: 'locker', when: play }, { k: 'vida', n: 'Vida personal', id: 'life' }]);
  merged('mycareer', 'Mi carrera', 'history', 'Resumen, metas, historial, palmarés y biografía', [
    { k: 'resumen', n: 'Resumen de temporada', id: 'review' }, { k: 'metas', n: 'Metas', id: 'goals', when: play }, { k: 'historial', n: 'Historial', id: 'career' }, { k: 'palmares', n: 'Palmarés', id: 'honors' }, { k: 'bio', n: 'Biografía', id: 'bio' }]);
  merged('training', 'Entrenamientos y táctica', 'train', 'Plan de entrenamiento y táctica', [{ k: 'entrena', n: 'Entrenamientos', id: 'training' }, { k: 'tactica', n: 'Táctica', id: 'tactics' }]);
  merged('tables', 'Clasificaciones y estadísticas', 'table', 'Tablas del mundo y estadísticas', [{ k: 'tablas', n: 'Clasificaciones', id: 'tables' }, { k: 'stats', n: 'Estadísticas', id: 'stats' }]);
  merged('market', 'Mercado y contratos', 'transfer', 'Fichajes, contratos y pruebas', [{ k: 'mercado', n: 'Mercado de fichajes', id: 'market' }, { k: 'contratos', n: 'Contratos', id: 'contracts' }, { k: 'pruebas', n: 'Pruebas masivas', id: 'tryouts' }]);
  merged('club', 'Mi club', 'shield', 'Tu club y tu legado en él', [{ k: 'club', n: 'Club', id: 'club' }, { k: 'historia', n: 'Historia', id: 'clubwiki' }, { k: 'legado', n: 'Legado', id: 'idolo' }]);
  merged('after', 'Después del retiro', 'medal', 'Legado, caminos, vida, proyectos y fichas', [{ k: 'legado', n: 'Legado y caminos', id: 'post' }, { k: 'vida', n: 'Vida y proyectos', id: 'retiro' }, { k: 'fichas', n: 'Fichas de jugadores', id: 'ficha' }]);

  // identificadores antiguos → pestaña del grupo
  var ALIAS = { health: ['player', 'salud'], locker: ['player', 'vestuario'], life: ['player', 'vida'], review: ['mycareer', 'resumen'], goals: ['mycareer', 'metas'], career: ['mycareer', 'historial'], honors: ['mycareer', 'palmares'], bio: ['mycareer', 'bio'],
    tactics: ['training', 'tactica'], stats: ['tables', 'stats'], contracts: ['market', 'contratos'], tryouts: ['market', 'pruebas'], post: ['after', 'legado'], retiro: ['after', 'vida'], ficha: ['after', 'fichas'], idolo: ['club', 'legado'], clubwiki: ['club', 'historia'] };
  UI.ALIAS = ALIAS;
  var render0 = UI.render;
  UI.render = function () { var a = ALIAS[UI.scr]; if (a) { UI.scr = a[0]; UI.tab['g_' + a[0]] = a[1]; } return render0.apply(this, arguments); };
  // los tabset antiguos de las pantallas internas siguen funcionando: sus pestañas viven en UI.tab[id interno]
  UI.tab = UI.tab || {};

  // ---------- menú según el estado ----------
  UI.applyNav = function () {
    var r = retired(), K = FP.Coach, coaching = r && K && K.job && K.job(), G = UI.GROUPS;
    var jug = r ? [['home', 'Inicio', 'home'], ['player', 'Mi jugador', 'user'], ['mycareer', 'Mi carrera', 'history'], ['after', 'Después del retiro', 'medal'], ['social', 'Redes', 'chat']]
      : [['home', 'Inicio', 'home'], ['player', 'Mi jugador', 'user'], ['mycareer', 'Mi carrera', 'history'], ['social', 'Redes', 'chat']];
    var temp = r ? (coaching ? [['coach', 'Banquillo', 'whistle']] : []).concat([['calendar', 'Calendario', 'calendar'], ['club', 'Mi club', 'shield']])
      : [['match', 'Partido', 'ball'], ['calendar', 'Calendario', 'calendar'], ['training', 'Entrenamientos y táctica', 'train'], ['club', 'Mi club', 'shield']];
    var mundo = [['comps', 'Competiciones', 'globe'], ['tables', 'Clasificaciones y estadísticas', 'table'], ['nations', 'Selecciones', 'flag'], ['news', 'Noticias', 'news']];
    var ges = r ? [['dinero', 'Finanzas personales', 'coin']] : [['market', 'Mercado y contratos', 'transfer'], ['dinero', 'Finanzas personales', 'coin']];
    var next = [['Jugador', jug], ['Temporada', temp], ['Mundo', mundo], ['Gestión', ges], ['Sistema', [['config', 'Configuración', 'settings']]]];
    G.length = 0; next.forEach(function (g) { G.push(g); });
  };
  var shell0 = UI.shell;
  UI.shell = function () { UI.applyNav(); return shell0.apply(this, arguments); };

  // los avisos de las pantallas internas se suman en su grupo
  var badges0 = UI.badges;
  UI.badges = function () {
    var b = badges0.apply(this, arguments), add = function (to, from) { var n = (b[to] || 0) + (b[from] || 0); if (n) b[to] = n; };
    ['health', 'locker', 'life'].forEach(function (k) { add('player', k); });
    ['review', 'goals', 'career', 'honors', 'bio'].forEach(function (k) { add('mycareer', k); });
    ['contracts', 'tryouts'].forEach(function (k) { add('market', k); });
    ['post', 'retiro', 'ficha'].forEach(function (k) { add('after', k); });
    return b;
  };
})();
