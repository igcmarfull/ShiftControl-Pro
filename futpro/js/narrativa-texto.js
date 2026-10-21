/* FUTPRO — motor narrativo de la Wiki, parte 2: REDACCIÓN.
   Convierte el modelo de js/narrativa.js en el artículo: introducción, formación, etapas por club, selección, récords y retiro.
   Determinista: la elección entre variantes depende solo del nombre, la fecha de nacimiento y la estructura de la carrera,
   de modo que una misma partida produce siempre el mismo texto. No usa red ni IA. Solo afirma lo que respaldan los registros.
   Las frases cambian por estructura (qué hecho se cuenta, en qué orden y con cuánto detalle), no por sinónimos. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, B = FP.Bio, X = B.x, N = FP.Narr, esc = U.esc, plural = X.plural, list = X.list, dlong = X.dlong, mlong = X.mlong;

  // ---------- azar determinista ----------
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  var ctx = null;
  function begin(M) { ctx = { M: M, seed: hash(M.h.nm + '|' + M.h.b + '|' + M.h.pos), used: {}, said: {} }; }
  // elige una variante por grupo; dentro de un mismo artículo no se repite una ya usada mientras queden otras
  function V(group, arr, salt) {
    var n = arr.length, i = (hash(group + '|' + (salt == null ? '' : salt)) + ctx.seed) % n, u = ctx.used[group] = ctx.used[group] || {}, tries = 0;
    while (u[i] && tries < n) { i = (i + 1) % n; tries++; }
    if (tries >= n) { ctx.used[group] = {}; u = ctx.used[group]; }
    u[i] = 1; var v = arr[i]; return typeof v === 'function' ? v() : v;
  }
  function cap(s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); }
  function lcf(s) { s = String(s); return s.charAt(0).toLowerCase() + s.slice(1); }
  function join(parts) { return parts.filter(function (p) { return p; }).join(' '); }
  function shortLg(n) { return String(n || '').replace(/\s*\([^)]*\)\s*$/, ''); }
  function when(s) { return String(s.s).indexOf('/') > 0 ? 'en la temporada ' + s.s : 'en ' + s.s; }
  function fromS(s) { return String(s.s).indexOf('/') > 0 ? 'la temporada ' + s.s : String(s.s); }
  function span(a, b) { return a === b ? String(a) : a + '–' + b; }
  function cn(code) { return X.countryName(code); }
  function nm(s) { return esc(s); }
  function goals(g) { return plural(g, 'gol', 'goles'); }
  function apps(p) { return plural(p, 'partido', 'partidos'); }
  function asis(a) { return plural(a, 'asistencia', 'asistencias'); }
  function money(k) { return FP.fmt.money(k); }
  function feeOf(txt) { var m = txt && /traspaso ([\d.,]+) mil/.exec(txt); return m ? parseFloat(m[1].replace(/\./g, '').replace(',', '.')) : null; }
  function offense(M) { return M.grp === 'FWD' || M.grp === 'ATT' || M.grp === 'MID'; }

  // ---------- rendimiento contextual en palabras ----------
  var EVAL = {
    excepcional: ['claramente por encima de lo esperable en su puesto y categoría', 'muy superior al promedio de su posición en esa categoría', 'de los mejores que cabía esperar de un jugador de su puesto', 'netamente superior a la referencia de su posición'],
    destacada: ['por encima del promedio de su puesto en esa categoría', 'superior a lo habitual para su posición y nivel', 'mejor de lo esperable para su puesto', 'por encima de la referencia de su posición'],
    buena: ['sólido para su posición y categoría', 'acorde con un titular de ese nivel', 'algo mejor que el promedio de su puesto', 'consistente para su categoría'],
    regular: ['en línea con lo esperable para su posición', 'dentro de lo normal para su puesto y categoría', 'similar al de la mayoría de los jugadores de su puesto', 'sin grandes desviaciones respecto a su posición'],
    baja: ['por debajo de lo esperable para su posición', 'inferior al promedio de su puesto en esa categoría', 'más discreto que la referencia de su puesto', 'por debajo de la referencia de su posición']
  };
  function evalPhrase(lab, salt) { return EVAL[lab] ? V('eval.' + lab, EVAL[lab], salt) : ''; }
  function labOf(z) { return z >= 1.6 ? 'excepcional' : z >= 0.9 ? 'destacada' : z >= 0.3 ? 'buena' : z > -0.4 ? 'regular' : 'baja'; }
  var ROLEP = {
    'titular indiscutible': ['fue titular casi indiscutible', 'jugó de titular en la gran mayoría de los partidos', 'se afianzó en el once inicial'],
    'titular habitual': ['fue titular habitual', 'formó parte del once inicial con regularidad', 'jugó con continuidad'],
    'rotación': ['alternó la titularidad con el banquillo', 'entró en la rotación del equipo', 'tuvo una participación intermitente'],
    'suplente': ['tuvo un papel secundario', 'fue suplente en la mayoría de sus apariciones', 'jugó pocos minutos'],
    'sin minutos': ['no sumó minutos']
  };
  function rolePhrase(role, salt) { return V('role.' + role, ROLEP[role] || ROLEP.suplente, salt); }
  // producción de una temporada según el puesto: no se destaca lo irrelevante para esa posición
  function prod(s, M) {
    var L = s.L, g = M.grp;
    if (g === 'FWD' || g === 'ATT') return L.g || L.a ? (L.g ? goals(L.g) + (L.a ? ' y ' + asis(L.a) : '') : asis(L.a) + ' sin marcar') + ' en ' + apps(L.p) : apps(L.p) + ' sin intervenir en goles';
    if (g === 'MID') return L.g || L.a ? goals(L.g) + ' y ' + asis(L.a) + ' en ' + apps(L.p) : apps(L.p) + ' sin intervenir en goles';
    return apps(L.p) + (L.g >= 2 ? ' y ' + goals(L.g) : '');
  }
  function totals(T, M) {   // totales de un tramo: se omiten los goles de quien no los marca por su puesto
    if (M.grp === 'GK') return apps(T.p);
    if (M.grp === 'DEF') return apps(T.p) + (T.g >= 3 ? ' y ' + goals(T.g) : '');
    return apps(T.p) + ', ' + goals(T.g) + (T.a ? ' y ' + asis(T.a) : '');
  }

  // ---------- títulos y distinciones como sintagmas ----------
  function titleNoun(t) {
    var n = String(t.nm || '');
    if (/^Campe[oó]n Juvenil/i.test(n)) return 'el campeonato juvenil';
    if (/^Campe[oó]n regional/i.test(n)) return 'el campeonato regional';
    var m = /^Campe[oó]n de (.+)$/i.exec(n); if (m) return 'el campeonato de ' + shortLg(m[1]);
    m = /^(?:Sub)?campe[oó]n ?(?:· |de )?(.+)$/i.exec(n); var base = m ? m[1] : n;
    return (/^(Copa|Supercopa|Liga|UEFA|Champions|Europa League|Recopa|Eurocopa|Conference|Community|Supertaça)/i.test(base) ? 'la ' : 'el ') + base.replace(/^UEFA /, '');
  }
  function titleList(arr) {   // agrupa repetidos: "el campeonato juvenil (2026/27 y 2027/28)"
    var by = {}, order = []; arr.forEach(function (t) { var k = titleNoun(t); if (!by[k]) { by[k] = []; order.push(k); } by[k].push(t.y); });
    return list(order.map(function (k) { return k + ' (' + list(by[k]) + ')'; }));
  }
  function awardNoun(a) {
    var n = String(a.nm || ''), m;
    if (/^Bal[oó]n de Oro$/i.test(n)) return 'el Balón de Oro';
    if (/^Finalista del Bal[oó]n/i.test(n)) return 'un puesto entre los cinco primeros del Balón de Oro';
    if ((m = /^Bota de Oro · (.+)$/i.exec(n))) return 'la Bota de Oro de ' + shortLg(m[1]);
    if ((m = /^Equipo ideal de (.+)$/i.exec(n))) return 'el equipo ideal de ' + shortLg(m[1]);
    if ((m = /^Mejor jugador joven · (.+)$/i.exec(n))) return 'el premio al mejor jugador joven de ' + shortLg(m[1]);
    if ((m = /^Mejor jugador · (.+)$/i.exec(n))) return 'el premio al mejor jugador de ' + shortLg(m[1]);
    if (/^Goleador del campeonato juvenil$/i.test(n)) return 'el título de goleador del campeonato juvenil';
    if ((m = /^Goleador · (.+)$/i.exec(n))) return 'el título de goleador de ' + m[1];
    if ((m = /^Goleador del (.+)$/i.exec(n))) return 'el título de goleador del ' + m[1];
    return lcf(n);
  }
  function awardList(arr) {
    var by = {}, order = []; arr.forEach(function (a) { var k = awardNoun(a); if (!by[k]) { by[k] = []; order.push(k); } by[k].push(a.y); });
    return list(order.map(function (k) { return k + ' (' + list(by[k]) + ')'; }));
  }
  function kinds(M) {
    var o = { liga: [], copa: [], cont: [], juv: [], nt: [], sub: [], reg: [] };
    M.tro.forEach(function (x) { var t = x.t, n = t.nm || ''; if (t.sub) { o.sub.push(x); return; } if (t.nt) o.nt.push(x); else if (/Juvenil/i.test(n)) o.juv.push(x); else if (/regional/i.test(n)) o.reg.push(x); else if (/Libertadores|Champions|Europa|Sudamericana|Conference|Mundial de Clubes|Intercontinental|Recopa/i.test(n)) o.cont.push(x); else if (/^Campe[oó]n de /i.test(n)) o.liga.push(x); else o.copa.push(x); });
    return o;
  }
  function titleName(t) { return String(t.nm).replace(/^(Sub)?campe[oó]n (de |del )?/i, '').replace(/^· /, ''); }

  // =====================================================================================================
  // INTRODUCCIÓN
  // =====================================================================================================
  function ident(M) {
    var h = M.h, dem = X.pron(h), pos = C.POS_NAME[h.pos].toLowerCase(), ret = M.retired;
    var club = h.club != null ? C.tname(h.club) : (h.team != null ? C.tname(h.team) : null);
    var born = (h.city ? esc(h.city) + ', ' : '') + D.bdText(h);
    return '<b>' + esc(h.nm) + '</b> (' + born + ') ' + (ret ? 'fue' : 'es') + ' un futbolista ' + (dem ? esc(dem) : 'de ' + esc(cn(h.nat))) + ' que ' + (ret ? 'se desempeñaba' : 'se desempeña') + ' como ' + esc(pos) + (!ret && club && h.tk !== 'free' ? ' en ' + esc(club) : '') + '.';
  }
  function clubNames(M) { var seen = [], out = []; M.stints.forEach(function (g) { if (!g.loan && seen.indexOf(g.t) < 0) { seen.push(g.t); out.push(g); } }); return out; }
  function clubList(gs, max) { return list(gs.slice(0, max).map(function (g) { return nm(g.name); })); }
  function titleListShort(arr) {   // "la Champions League (2 veces)"
    var by = {}, order = []; arr.forEach(function (x) { var k = titleNoun(x.t); if (!by[k]) { by[k] = 0; order.push(k); } by[k]++; });
    return list(order.map(function (k) { return by[k] > 1 ? k + ' (' + by[k] + ' veces)' : k; }));
  }
  function honours(M) {
    var K = kinds(M), out = [], bo = M.aw.filter(function (x) { return /^Bal[oó]n de Oro$/i.test(x.a.nm); }).length;
    if (K.cont.length) out.push(titleListShort(K.cont));
    if (K.liga.length) out.push(K.liga.length === 1 ? 'el campeonato de ' + shortLg(titleName(K.liga[0].t)) : plural(K.liga.length, 'campeonato de liga', 'campeonatos de liga'));
    if (K.copa.length) out.push(K.copa.length === 1 ? titleNoun(K.copa[0].t) : plural(K.copa.length, 'copa nacional', 'copas nacionales'));
    return { titles: out, bo: bo, K: K };
  }

  function lead(M) {
    var h = M.h, p = [ident(M)], T = M.tot, A = M.arch, ret = M.retired, first = M.firstPro;
    if (!M.all.length) return p[0];
    if (!M.pro.length) {
      var o = M.all[0];
      p.push(V('lead.nopro', [function () { return 'Aún no ha debutado como profesional; ha jugado en ' + nm(o.name) + (o.lv === 'juv' ? ' (categorías inferiores)' : o.lv === 'amat' ? ' (fútbol amateur)' : '') + '.'; }, function () { return 'Su trayectoria se limita por ahora al ' + (M.youth.length ? 'fútbol formativo' : 'fútbol amateur') + ', con ' + apps(M.totForm.p) + (M.form.length > 1 ? ' en varios equipos' : ' en ' + nm(o.name)) + '.'; }]));
      return p.join(' ');
    }
    var cl = clubNames(M), nC = M.clubs.length, nCt = M.countries.length, topT = M.topTier, H = honours(M), one = nC === 1, g1 = M.stints.filter(function (g) { return !g.loan; })[0] || M.stints[0];
    var formed = M.all[0] && M.all[0].lv !== 'pro' ? M.all[0].name : null;
    var tier1n = M.pro.filter(function (s) { return s.tier === 1; }).length, said = {};
    // 1) forma de la carrera
    if (one && !A.has('rover')) {
      p.push(V('lead.one', [function () { return (ret ? 'Dedicó' : 'Dedica') + ' toda su carrera profesional a ' + nm(g1.name) + ', con el que ' + (ret ? 'jugó ' : 'lleva ') + plural(M.nProSeasons, 'temporada', 'temporadas') + ' (' + span(g1.y0, g1.y1) + ').'; }, function () { return 'Su carrera profesional ' + (ret ? 'transcurrió' : 'transcurre') + ' íntegramente en ' + nm(g1.name) + ', entre ' + g1.y0 + ' y ' + g1.y1 + '.'; }]));
      said.idolTenure = true;
    } else if (A.has('star')) {
      p.push(V('lead.star', [
        function () { return (formed ? 'Surgido de las categorías inferiores de ' + nm(formed) + ', ' : '') + 'llegó a ' + N.tierName(1) + ' y jugó en ella ' + plural(tier1n, 'temporada', 'temporadas') + ', en ' + clubList(cl, 3) + '.'; },
        function () { return 'Su carrera profesional, desarrollada en ' + clubList(cl, 3) + ', lo llevó a competir en ' + N.tierName(1) + (nCt > 1 ? ' de ' + nCt + ' países' : '') + '.'; }]));
    } else if (A.has('modest')) {
      p.push(V('lead.modest', [
        function () { return (ret ? 'Desarrolló' : 'Desarrolla') + ' una carrera profesional de ' + plural(M.nProSeasons, 'temporada', 'temporadas') + ' en ' + clubList(cl, 3) + (topT >= 3 ? ', sin pasar de las divisiones inferiores' : ', con ' + N.tierName(topT) + ' como su nivel más alto') + '.'; },
        function () { return (ret ? 'Hizo' : 'Hace') + ' carrera como profesional durante ' + plural(M.nProSeasons, 'temporada', 'temporadas') + (nC > 1 ? ' en ' + nC + ' clubes' : '') + (topT >= 3 ? ', siempre en categorías inferiores' : ', con ' + N.tierName(topT) + ' como máxima categoría alcanzada') + '.'; }]));
    } else if (A.has('rover')) {
      p.push(V('lead.rover', [
        function () { return 'Su carrera estuvo marcada por los cambios de club: ' + (ret ? 'defendió' : 'ha defendido') + ' a ' + plural(nC, 'equipo', 'equipos') + (nCt > 1 ? ' de ' + nCt + ' países' : '') + ', entre ellos ' + clubList(cl.slice(-3), 3) + '.'; },
        function () { return (ret ? 'Pasó' : 'Ha pasado') + ' por ' + plural(nC, 'club', 'clubes') + (nCt > 1 ? ' en ' + nCt + ' países' : '') + ' en ' + plural(M.nProSeasons, 'temporada', 'temporadas') + ' como profesional.'; }]));
    } else {
      p.push(V('lead.generic', [
        function () { return (ret ? 'Defendió' : 'Ha defendido') + (nC > 1 ? ' a ' + plural(nC, 'club', 'clubes') + ' como profesional, entre ellos ' + clubList(cl.slice(-3), 3) : ' a ' + nm(cl[0].name) + ' como profesional') + '.'; },
        function () { return 'Su carrera profesional ' + (ret ? 'transcurrió' : 'transcurre') + ' en ' + clubList(cl, 3) + '.'; },
        function () { return (ret ? 'Jugó' : 'Juega') + ' como profesional desde ' + first.y + (nC > 1 ? ' y ' + (ret ? 'pasó' : 'ha pasado') + ' por ' + plural(nC, 'club', 'clubes') : ' en ' + nm(cl[0].name)) + '.'; }]));
      if (topT != null && topT <= 2) p.push(V('lead.tier', [function () { return (ret ? 'Llegó a competir' : 'Ha llegado a competir') + ' en ' + N.tierName(topT) + '.'; }, function () { return 'Su nivel más alto fue ' + N.tierName(topT) + '.'; }]));
    }
    // 2) rasgos adicionales que surgen de los datos
    if (A.has('idol') && !said.idolTenure) { var id = M.ido[0], g0 = id ? id.g : M.stints.filter(function (g) { return g.n === A.maxTenure; })[0]; if (g0) p.push(V('lead.idol', [function () { return 'Su vínculo más largo fue con ' + nm(g0.name) + ', donde ' + (ret ? 'jugó ' : 'lleva ') + plural(g0.n, 'temporada', 'temporadas') + ' (' + span(g0.y0, g0.y1) + ')' + (id ? ' y alcanzó el estatus de ' + esc(lcf(id.label)) : '') + '.'; }, function () { return 'En ' + nm(g0.name) + ' permaneció ' + plural(g0.n, 'temporada', 'temporadas') + ', entre ' + g0.y0 + ' y ' + g0.y1 + (id ? ', hasta alcanzar el estatus de ' + esc(lcf(id.label)) : '') + '.'; }])); }
    else if (A.has('idol') && M.ido[0]) p.push('En el club alcanzó el estatus de ' + esc(lcf(M.ido[0].label)) + '.');
    if (A.has('fail')) p.push(V('lead.fail', ['Destacó en las categorías formativas, pero no logró consolidarse en la categoría a la que aspiraba.', 'Sus buenos registros juveniles no tuvieron continuidad en su etapa profesional.']));
    if (A.has('comeback') && M.trend.recover) p.push('Tras ' + plural(M.trend.recover.len, 'temporada', 'temporadas') + ' de rendimiento bajo, recuperó su nivel desde ' + fromS(M.trend.recover.to) + '.');
    if (A.has('late') && !A.has('star') && M.peak) p.push('Sus mejores años llegaron tarde: su pico de nivel fue a los ' + M.peak.age + ' años.');
    // 3) honores: solo lo que pesa en la carrera
    if (H.titles.length || H.bo) {
      var hs = []; if (H.bo) hs.push(H.bo === 1 ? 'el Balón de Oro' : 'el Balón de Oro (' + H.bo + ' veces)'); hs = hs.concat(H.titles);
      p.push(V('lead.honours', [function () { return 'Entre sus logros figuran ' + esc(list(hs.slice(0, 4))) + '.'; }, function () { return (ret ? 'Ganó ' : 'Ha ganado ') + esc(list(hs.slice(0, 4))) + '.'; }, function () { return 'Su palmarés incluye ' + esc(list(hs.slice(0, 4))) + '.'; }]));
    } else {
      var topA = M.aw.filter(function (x) { return x.w >= 60; }).sort(function (a, b) { return b.w - a.w; })[0];
      if (topA) p.push('A título individual fue distinguido con ' + esc(awardNoun(topA.a)) + ' (' + topA.a.y + ').');
    }
    var fm = M.ev.filter(function (e) { return e.k === 'move' && e.fee >= 10000; }).sort(function (a, b) { return b.fee - a.fee; })[0];
    if (fm) p.push('Su traspaso más alto registrado fue el de ' + nm(fm.g.name) + ', por ' + esc(money(fm.fee)) + ' (' + fm.g.y0 + ').');
    var bigInj = M.inj.filter(function (e) { return e.big; });
    if (bigInj.length >= 2 || (bigInj.length === 1 && M.nProSeasons <= 6)) p.push(bigInj.length >= 2 ? 'Su carrera estuvo condicionada por las lesiones: sufrió ' + plural(bigInj.length, 'lesión', 'lesiones') + ' de larga duración (' + list(bigInj.map(function (e) { return D.year(e.w); })) + ').' : 'Una lesión de larga duración en ' + D.year(bigInj[0].w) + ' lo mantuvo ' + plural(bigInj[0].n, 'semana', 'semanas') + ' alejado de las canchas.');
    // 4) selección
    if (M.nt.abs) { var a = M.nt.abs; p.push(V('lead.nt', [function () { return (ret ? 'Fue' : 'Es') + ' internacional absoluto con ' + esc(cn(h.nat)) + ' (' + apps(a.p) + (a.g && offense(M) ? ' y ' + goals(a.g) : '') + ').'; }, function () { return 'Con la selección absoluta de ' + esc(cn(h.nat)) + (ret ? ' disputó ' : ' ha disputado ') + apps(a.p) + '.'; }])); }
    else if (M.nt.youth.length) p.push('Fue internacional con las categorías inferiores de ' + esc(cn(h.nat)) + '.');
    // 5) final
    if (ret) p.push('Se retiró en ' + D.year(h.retiredW) + ', a los ' + h.retiredAge + ' años' + (T.p < 20 ? ', tras ' + apps(T.p) + ' como profesional' : '') + '.');
    return p.join(' ');
  }

  // =====================================================================================================
  // PRIMEROS AÑOS Y FORMACIÓN
  // =====================================================================================================
  function earlyYears(M) {
    var h = M.h, out = [], f = M.all[0];
    out.push('Nació' + (h.city ? ' en ' + esc(h.city) : '') + ' el ' + D.bdText(h) + '. Mide ' + h.ht + ' cm y pesa ' + h.kg + ' kg.');
    if (f) {
      var lvTxt = f.lv === 'juv' ? 'en las categorías inferiores de ' + nm(f.name) : f.lv === 'amat' ? 'en el fútbol amateur con ' + nm(f.name) : 'en ' + nm(f.name);
      out.push(V('early.start', [function () { return 'Comenzó a competir ' + lvTxt + ' en ' + f.y + (f.age ? ', con ' + f.age + ' años' : '') + (h.ovr0 ? ' y una media de ' + h.ovr0 : '') + '.'; }, function () { return 'Su primera temporada registrada fue la de ' + f.s + ', ' + lvTxt + (f.age ? ', a los ' + f.age + ' años' : '') + '.'; }]));
    }
    var groups = []; M.form.forEach(function (s) { var g = groups[groups.length - 1], key = s.lv + '|' + s.name; if (g && g.key === key) { g.y1 = s.ye; } else groups.push({ key: key, lv: s.lv, name: s.name, y0: s.y, y1: s.ye }); });
    if (groups.length > 1 || (groups.length === 1 && M.form.length > 1)) {
      var am = groups.filter(function (g) { return g.lv === 'amat'; }), jv = groups.filter(function (g) { return g.lv !== 'amat'; }), gl = function (a) { return list(a.map(function (g) { return nm(g.name) + ' (' + span(g.y0, g.y1) + ')'; })); };
      out.push(V('early.path', [function () { return 'En su etapa formativa ' + (jv.length ? 'pasó por las inferiores de ' + gl(jv) : '') + (jv.length && am.length ? ' y también jugó en el fútbol amateur con ' + gl(am) : am.length ? 'jugó en el fútbol amateur con ' + gl(am) : '') + '.'; }, function () { return 'Su formación ' + (jv.length ? 'incluyó las categorías inferiores de ' + gl(jv) : '') + (jv.length && am.length ? ', además de ' + gl(am) + ' en el fútbol amateur' : am.length ? 'transcurrió en el fútbol amateur, con ' + gl(am) : '') + '.'; }]) + ' En total disputó ' + apps(M.totForm.p) + (M.totForm.g ? ' y marcó ' + goals(M.totForm.g) : '') + ' en esas categorías.');
    }
    var ys = M.form.filter(function (s) { return s.perf.sample === 'plena'; }).sort(function (a, b) { return b.perf.z - a.perf.z; })[0];
    if (ys && ys.perf.z >= 0.9) out.push('Su mejor campaña formativa fue ' + when(ys) + ' con ' + nm(ys.name) + ': ' + prod(ys, M) + ', un rendimiento ' + evalPhrase(ys.perf.lab, 'y') + '.');
    var jt = M.tro.filter(function (x) { return /Juvenil/i.test(x.t.nm) && !x.t.sub; }), ja = M.aw.filter(function (x) { return /juvenil|joven/i.test(x.a.nm); });
    if (jt.length || ja.length) out.push('En categorías juveniles ' + (jt.length ? 'ganó ' + esc(titleList(jt.map(function (x) { return x.t; }))) : '') + (jt.length && ja.length ? ' y recibió ' : ja.length ? 'recibió ' : '') + (ja.length ? esc(awardList(ja.map(function (x) { return x.a; }))) : '') + '.');
    var hist = h.history || [], ev = (h.bio && h.bio.ev) || [], deb = hist.filter(function (e) { return /^Debut con el primer equipo/.test(e.t); })[0], prom = ev.filter(function (e) { return /Ascendido al primer equipo/.test(e.t); })[0];
    var fp = M.firstPro;
    if (fp) {
      var sig = hist.filter(function (e) { return /^Firma con/.test(e.t) && e.club === fp.base && !/juvenil\/reserva/.test(e.t); })[0], pieces = [];
      if (prom && deb && prom.w <= deb.w) pieces.push('Fue ascendido al primer equipo de ' + nm(fp.name) + ' en ' + mlong(prom.w) + ' y debutó el ' + dlong(deb.w) + '.');
      else if (deb && sig && sig.w >= deb.w) pieces.push('Debutó con el primer equipo de ' + nm(fp.name) + ' el ' + dlong(deb.w) + ' y firmó con el club en ' + mlong(sig.w) + '.');
      else if (deb) pieces.push('Debutó con el primer equipo de ' + nm(fp.name) + ' el ' + dlong(deb.w) + '.');
      else pieces.push('Su debut profesional llegó ' + when(fp) + ' con ' + nm(fp.name) + (fp.age ? ', a los ' + fp.age + ' años' : '') + '.');
      if (sig && !prom && !(deb && sig.w >= deb.w)) pieces.unshift('En ' + mlong(sig.w) + ' firmó con ' + nm(fp.name) + '.');
      out.push(pieces.join(' '));
    }
    return out;
  }

  // =====================================================================================================
  // CARRERA PROFESIONAL POR CLUBES
  // =====================================================================================================
  function stintMass(g) {
    var m = g.n + 1.5 * g.tro.length + 0.8 * g.aw.length + 0.5 * g.moves.length + g.L.p / 60 + 0.5 * g.inj.filter(function (e) { return e.major; }).length;
    return g.loan ? m * 0.7 : m;
  }
  function arrival(M, g) {
    var h = M.h, i = g.i, prev = i ? M.stints[i - 1] : null, fs = g.seasons[0], hist = h.history || [], ev = (h.bio && h.bio.ev) || [];
    var firm = hist.filter(function (e) { return /^Firma con/.test(e.t) && e.club === g.t && e.w >= (prev ? prev.w1 - 80 : 0) && e.w <= fs.o + 10; })[0];
    var fk = firm && feeOf(firm.t), fee = fk ? money(fk) : null;
    var ln = B.loans().filter(function (l) { return l.to === g.t; })[0], from = ln ? C.tname(ln.from) : prev ? prev.name : null;
    var dt = firm ? 'En ' + mlong(firm.w) : cap(when(fs));
    var abroad = prev && g.country && prev.country && g.country !== prev.country;
    if (g.loan) return V('arr.loan', [function () { return (ln ? 'En ' + mlong(ln.w0) : cap(when(fs))) + ' fue cedido a ' + nm(g.name) + (from ? ' por ' + nm(from) : '') + (ln && ln.w1 != null ? ' durante ' + plural(Math.max(1, Math.round((ln.w1 - ln.w0) / 4.35)), 'mes', 'meses') : '') + '.' + (ln && ln.buy ? ' La cesión incluía una opción de compra de ' + esc(money(ln.buy)) + '.' : ''); }, function () { return 'Llegó a ' + nm(g.name) + ' ' + (ln ? 'en ' + mlong(ln.w0) + ' ' : '') + 'en calidad de cedido' + (from ? ' desde ' + nm(from) : '') + '.' + (ln && ln.buy ? ' El préstamo incluía una opción de compra de ' + esc(money(ln.buy)) + '.' : ''); }], g.t);
    if (g.ret) return V('arr.ret', [function () { return cap(when(fs)) + ' regresó a ' + nm(g.name) + (prev && prev.loan ? ' tras su cesión' : '') + '.'; }, function () { return 'Volvió a ' + nm(g.name) + ' ' + when(fs) + (fee ? ', con un traspaso de ' + esc(fee) : '') + '.'; }], g.t);
    if (!prev) {
      var promoted = M.youth.some(function (s) { return s.base === g.t; }) && ev.some(function (e) { return /Ascendido al primer equipo/.test(e.t); });
      return promoted ? V('arr.first.promo', [function () { return 'Su etapa profesional comenzó en ' + nm(g.name) + ', club en el que se había formado.'; }, function () { return cap(when(fs)) + ' dio el salto al fútbol profesional con ' + nm(g.name) + ', donde ya jugaba en las inferiores.'; }], g.t) : V('arr.first', [function () { return 'Inició su etapa profesional en ' + nm(g.name) + ' ' + when(fs) + '.'; }, function () { return cap(when(fs)) + ' se incorporó a ' + nm(g.name) + ', su primer club profesional.'; }], g.t);
    }
    var pl = prev.seasons[prev.seasons.length - 1], up = fs.tier < pl.tier, down = fs.tier > pl.tier;
    return V('arr.move' + (abroad ? '.abroad' : ''), abroad ? [
      function () { return dt + ' dejó ' + nm(prev.name) + ' para jugar en ' + esc(cn(g.country)) + ', en ' + nm(g.name) + (fee ? ' (traspaso de ' + esc(fee) + ')' : '') + '.'; },
      function () { return 'Su siguiente destino fue ' + esc(cn(g.country)) + ': ' + nm(g.name) + (fee ? ', por un traspaso de ' + esc(fee) : '') + ', ' + when(fs) + '.'; }] : [
      function () { return dt + ' fichó por ' + nm(g.name) + (fee ? ' mediante un traspaso de ' + esc(fee) : '') + (up ? ', un paso a ' + N.tierName(fs.tier) : down ? ', en ' + N.tierName(fs.tier) : '') + '.'; },
      function () { return 'Se incorporó a ' + nm(g.name) + ' ' + (firm ? 'en ' + mlong(firm.w) : when(fs)) + (fee ? ' por ' + esc(fee) : '') + (up ? ', ascendiendo de categoría' : '') + '.'; },
      function () { return 'Tras ' + (prev.n > 1 ? plural(prev.n, 'temporada', 'temporadas') + ' en ' : 'su paso por ') + nm(prev.name) + ', pasó a ' + nm(g.name) + (fee ? ' (traspaso de ' + esc(fee) + ')' : '') + '.'; }], g.t);
  }
  // primera temporada en un club con varias: formas distintas según lo que haya que decir
  function firstSeason(M, g) {
    var f = g.seasons[0], informative = f.perf.sample !== 'escasa';
    var role = N.roleRank[f.role] >= 3 ? rolePhrase(f.role, g.t) : null, st = prod(f, M), lab = informative && (f.perf.lab === 'destacada' || f.perf.lab === 'excepcional' || f.perf.lab === 'baja') ? ', un rendimiento ' + evalPhrase(f.perf.lab, g.t) : '';
    return V('first.' + (role ? 'r' : 'n'), role ? [
      function () { return 'Ese primer año ' + role + ' (' + st + ')' + lab + '.'; },
      function () { return 'En su primera temporada ' + role + ', con ' + st + lab + '.'; },
      function () { return cap(role) + ' desde el principio: ' + st + lab + '.'; }] : [
      function () { return 'En su primera temporada sumó ' + st + lab + '.'; },
      function () { return 'Su primer año dejó ' + st + lab + '.'; },
      function () { return 'En esa campaña inicial ' + (f.L.p < 10 ? 'jugó poco: ' + apps(f.L.p) : 'disputó ' + apps(f.L.p)) + (offense(M) && f.L.g ? ' y marcó ' + goals(f.L.g) : '') + lab + '.'; }], g.t);
  }
  function oneSeason(M, g, s, pre0) {
    var lg = shortLg(s.lgName), pre = pre0 || cap(when(s)), lab = s.perf.sample === 'escasa' ? '' : ', un registro ' + evalPhrase(s.perf.lab, s.s);
    return V('one', [function () { return pre + ' disputó ' + esc(lg) + ' con ' + prod(s, M) + lab + '.'; }, function () { return pre + ' jugó en ' + esc(lg) + ': ' + prod(s, M) + lab + '.'; }], g.t);
  }
  function bestPhrase(M, g, s) {
    ctx.said[s.key] = 1;
    var rtNote = s.L.rn && s.perf.zr >= 0.8 ? ', con una valoración media de ' + s.perf.avg.toFixed(2).replace('.', ',') : '';
    return V('best', [function () { return 'Su mejor campaña ' + (M.bestSeason && M.bestSeason.key === s.key ? 'como profesional ' : 'en el club ') + 'fue ' + when(s) + ': ' + prod(s, M) + ' en ' + esc(shortLg(s.lgName)) + rtNote + '.'; }, function () { return 'El año de mayor rendimiento en ' + nm(g.name) + ' fue ' + fromS(s) + ', con ' + prod(s, M) + ' en ' + esc(shortLg(s.lgName)) + rtNote + '.'; }], g.t);
  }
  function stintParas(M, g) {
    var out = [], mass = stintMass(g), depth = mass < 1.6 ? 0 : mass < 3.2 ? 1 : mass < 6 ? 2 : 3, ss = g.seasons, A0 = arrival(M, g), usedPhases = false;
    if (depth === 0) {
      out.push(join([A0, ss.length === 1 ? cap(prodAlone(M, ss[0]).replace(new RegExp('^' + when(ss[0]).replace(/[\/]/g, '\\/')), A0.indexOf(when(ss[0])) >= 0 ? 'ese año' : when(ss[0]))) + '.' : 'Disputó ' + apps(g.L.p) + ' entre ' + g.y0 + ' y ' + g.y1 + '.']));
      injuriesAt(M, g, out); return out;
    }
    if (ss.length === 1) { out.push(join([A0, oneSeason(M, g, ss[0], A0.indexOf(when(ss[0])) >= 0 ? 'Ese año' : null)])); }
    else if (g.n >= 6 && depth >= 3) { phases(M, g, A0, out); usedPhases = true; }
    else {
      var f = ss[0], l = ss[ss.length - 1];
      out.push(join([A0, firstSeason(M, g)]));
      var p2 = [], bs = g.best && ss.length >= 2 && (g.best.perf.z >= 0.9 || (g.n >= 3 && g.best.perf.z >= 0.5 && g.best !== f)) ? g.best : null;
      if (bs) p2.push(bestPhrase(M, g, bs));
      else p2.push(V('stint.mid', [function () { return 'En ' + plural(g.n, 'temporada', 'temporadas') + ' (' + span(g.y0, g.y1) + ') acumuló ' + totals(g.L, M) + '.'; }, function () { return 'Entre ' + g.y0 + ' y ' + g.y1 + ' sumó ' + totals(g.L, M) + ' con el club.'; }, function () { return 'Su paso por el club dejó ' + totals(g.L, M) + ' en ' + plural(g.n, 'temporada', 'temporadas') + '.'; }], g.t));
      var rF = N.roleRank[f.role], rL = N.roleRank[l.role];
      if (g.n >= 3 && rL - rF >= 2) p2.push('Su protagonismo creció con los años: de ' + lcf(f.role) + ' en ' + f.y + ' pasó a ' + lcf(l.role) + ' en ' + l.y + '.');
      else if (g.n >= 3 && rF - rL >= 2) p2.push('Con el tiempo perdió protagonismo: de ' + lcf(f.role) + ' en ' + f.y + ' a ' + lcf(l.role) + ' en ' + l.y + '.');
      trendNotes(M, g, p2);
      var lab = g.zN >= 2 && g.L.min >= 1800 ? labOf(g.z) : null;
      if (lab && (lab !== 'regular' || depth >= 3)) p2.push(V('stint.sum', [function () { return 'En conjunto, su rendimiento en el club fue ' + EVAL[lab][0] + '.'; }, function () { return 'Tomando todas sus temporadas en el club, su balance fue ' + EVAL[lab][1] + '.'; }], g.t + 'z'));
      out.push(join(p2));
    }
    if (g.moves.length) out.push(movesText(g));
    if (!usedPhases) {
      var hon = [];
      if (g.tro.length) hon.push(V('hon.club', [function () { return 'Con ' + nm(g.name) + (g.loan ? ' (cedido)' : '') + ' conquistó ' + esc(titleList(g.tro)) + '.'; }, function () { return 'En su paso por ' + nm(g.name) + ' ganó ' + esc(titleList(g.tro)) + '.'; }, function () { return 'El club levantó ' + esc(titleList(g.tro)) + ' con él en la plantilla.'; }], g.t));
      if (g.sub.length && depth >= 2) hon.push('Fue subcampeón de ' + esc(list(g.sub.map(function (t) { return shortLg(titleName(t)) + ' (' + t.y + ')'; }))) + '.');
      if (g.aw.length) hon.push(V('hon.aw', [function () { return 'A título individual obtuvo ' + esc(awardList(g.aw.slice(0, 3))) + '.'; }, function () { return 'Recibió ' + esc(awardList(g.aw.slice(0, 3))) + '.'; }], g.t));
      if (hon.length) out.push(join(hon));
    }
    if (depth >= 2) { var mo = B.moments().filter(function (m) { var yy = D.year(m.w); return !m.nat && X.baseName(m.club) === g.name && yy >= g.y0 && yy <= g.y1 + 1 && m.sc >= 5; }).sort(function (a, b) { return b.sc - a.sc; }).slice(0, depth >= 3 ? 2 : 1).sort(function (a, b) { return a.w - b.w; }); if (mo.length) out.push(cap('entre sus actuaciones destacadas figuran: ' + esc(mo.map(X.momentText).join('; '))) + '.'); }
    if (!usedPhases) injuriesAt(M, g, out);
    var next = M.stints[g.i + 1];
    if (next && next.loan && depth >= 1) out.push(V('exit.loan', ['Más tarde fue cedido a ' + nm(next.name) + '.', 'Después pasó cedido a ' + nm(next.name) + '.'], g.t));
    else if (!next && !M.retired && depth >= 1) out.push(V('now', ['Continúa en el club.', 'Sigue vinculado al club.'], g.t));
    return out.filter(function (x) { return x; });
  }
  function trendNotes(M, g, p2) {
    var tr = M.trend, ss = g.seasons;
    if (tr.recover && ss.indexOf(tr.recover.from) >= 0 && ss.indexOf(tr.recover.to) < 0) {
      var rf = tr.recover.from, lastDip = M.rated[M.rated.indexOf(tr.recover.to) - 1] || rf;
      p2.push(V('trend.dip', [function () { return 'A partir de ' + fromS(rf) + ' sus registros cayeron por debajo de lo esperable para su puesto' + (N.roleRank[rf.role] < 3 ? ' y ' + rolePhrase(rf.role, g.t + 'd') : '') + '.'; }, function () { return 'Su rendimiento bajó desde ' + fromS(rf) + ' y durante ' + plural(tr.recover.len, 'temporada', 'temporadas') + ' se mantuvo por debajo del promedio de su posición.'; }], g.t));
    }
    if (tr.recover && ss.indexOf(tr.recover.to) >= 0) p2.push(V('trend.rec', [function () { return 'A partir de ' + fromS(tr.recover.to) + ' recuperó su nivel tras ' + plural(tr.recover.len, 'temporada', 'temporadas') + ' por debajo de lo esperable para su puesto.'; }, function () { return 'Tras ' + plural(tr.recover.len, 'campaña', 'campañas') + ' discretas, volvió a rendir por encima del promedio desde ' + fromS(tr.recover.to) + '.'; }], g.t));
    if (tr.decline && ss.indexOf(tr.decline.next) >= 0) p2.push(V('trend.dec', [function () { return 'Desde ' + fromS(tr.decline.next) + ' sus registros quedaron por debajo de los de su mejor momento (' + tr.decline.from.s + ').'; }, function () { return 'A partir de ' + fromS(tr.decline.next) + ' su rendimiento fue claramente inferior al que tuvo ' + when(tr.decline.from) + '.'; }], g.t));
  }
  // etapas largas: un párrafo por tramo, con lo que de verdad ocurrió en él
  function phases(M, g, A0, out) {
    var ss = g.seasons, k = g.n >= 14 ? 4 : g.n >= 9 ? 3 : 2, size = Math.ceil(ss.length / k), chunks = [];
    for (var i = 0; i < ss.length; i += size) chunks.push(ss.slice(i, i + size));
    var lastLab = null;
    chunks.forEach(function (ch, ci) {
      var T = { p: 0, g: 0, a: 0, min: 0 }; ch.forEach(function (s) { T.p += s.L.p; T.g += s.L.g; T.a += s.L.a; T.min += s.L.min; });
      var y0 = ch[0].y, y1 = ch[ch.length - 1].ye, rr = ch.reduce(function (a, s) { return a + N.roleRank[s.role]; }, 0) / ch.length, role = rr >= 3.5 ? 'titular indiscutible' : rr >= 2.5 ? 'titular habitual' : rr >= 1.5 ? 'rotación' : 'suplente';
      var pl = ch.filter(function (s) { return s.perf.sample === 'plena'; }), z = pl.length ? pl.reduce(function (a, s) { return a + s.perf.z; }, 0) / pl.length : null, lab = z != null ? labOf(z) : null;
      var best = pl.slice().sort(function (a, b) { return b.perf.z - a.perf.z; })[0], s = [];
      var tro = g.tro.filter(function (t) { var y = X.y4(t.y); return y >= y0 && y <= y1; }), aw = g.aw.filter(function (a) { var y = X.y4(a.y); return y >= y0 && y <= y1; });
      var fsx = ch[0].perf.lab; if (ci === 0) { s.push(A0); if (fsx === 'destacada' || fsx === 'excepcional' || fsx === 'baja') s.push(firstSeason(M, g)); s.push(V('ph.first', ['Hasta ' + y1 + ' ' + rolePhrase(role, g.t) + ' y reunió ' + totals(T, M) + '.', 'En esos primeros años (hasta ' + y1 + ') sumó ' + totals(T, M) + ' y ' + rolePhrase(role, g.t + 'f') + '.'], g.t)); }
      else s.push(V('ph.open', [function () { return 'Entre ' + y0 + ' y ' + y1 + ' ' + rolePhrase(role, g.t + ci) + ' y sumó ' + totals(T, M) + '.'; }, function () { return 'En el tramo ' + span(y0, y1) + ' ' + rolePhrase(role, g.t + ci) + ': ' + totals(T, M) + '.'; }, function () { return 'De ' + y0 + ' a ' + y1 + ' reunió ' + totals(T, M) + ' y ' + rolePhrase(role, g.t + 'b' + ci) + '.'; }], g.t + ci));
      var chg = lab && lab !== lastLab; if (lab) lastLab = lab;
      if (lab && lab !== 'regular' && chg) s.push(V('ph.eval', [function () { return 'Su rendimiento en esos años fue ' + EVAL[lab][0] + '.'; }, function () { return 'Visto en conjunto, el tramo resultó ' + EVAL[lab][1] + '.'; }], g.t + ci));
      if (best && g.best === best && best.perf.z >= 0.9 && !ctx.said[best.key]) s.push(bestPhrase(M, g, best));
      if (tro.length) s.push(V('ph.tro', [function () { return 'En ese período conquistó ' + esc(titleList(tro)) + '.'; }, function () { return 'El club ganó ' + esc(titleList(tro)) + ' con él en la plantilla.'; }], g.t + ci));
      if (aw.length) s.push('Recibió ' + esc(awardList(aw)) + '.');
      var inj = g.inj.filter(function (e) { var y = D.year(e.w); return e.major && y >= y0 && y <= y1 + 1; })[0]; if (inj) s.push('En ' + mlong(inj.w) + ' una lesión (' + esc(String(inj.nm).toLowerCase()) + ') lo mantuvo ' + plural(inj.n, 'semana', 'semanas') + ' alejado de las canchas.');
      if (ci === chunks.length - 1) trendNotes(M, g, s);
      out.push(join(s));
    });
  }
  function prodAlone(M, s) { return when(s) + ' disputó ' + apps(s.L.p) + (offense(M) && s.L.g ? ' y marcó ' + goals(s.L.g) : '') + ' en ' + esc(shortLg(s.lgName)); }
  function movesText(g) {
    var mv = g.moves, nm0 = nm(g.name);
    if (mv.length === 1) { var m = mv[0]; return V(m.up ? 'mv.up' : 'mv.down', m.up ? ['El club ascendió a ' + esc(shortLg(m.to.n)) + ' ' + when(m.s) + '.', cap(when(m.s)) + ', ' + nm0 + ' pasó a competir en ' + esc(shortLg(m.to.n)) + ' tras ascender.'] : ['El club descendió a ' + esc(shortLg(m.to.n)) + ' ' + when(m.s) + '.', cap(when(m.s)) + ', ' + nm0 + ' jugó en ' + esc(shortLg(m.to.n)) + ' tras perder la categoría.'], m.s.key); }
    return 'En esos años ' + nm0 + ' cambió de categoría ' + mv.length + ' veces: ' + list(mv.map(function (m) { return (m.up ? 'ascendió a ' : 'descendió a ') + esc(shortLg(m.to.n)) + ' (' + m.s.s + ')'; })) + '.';
  }
  function injuriesAt(M, g, out) {
    var big = g.inj.filter(function (e) { return e.major; }).sort(function (a, b) { return b.n - a.n; })[0];
    if (!big) return;
    out.push('En ' + mlong(big.w) + ' sufrió ' + (big.nm ? 'una lesión (' + esc(big.nm.toLowerCase()) + ', en ' + esc(big.zone) + ')' : 'una lesión') + ' que lo mantuvo ' + plural(big.n, 'semana', 'semanas') + ' alejado de las canchas.');
  }
  // tramos de clubes con muy poca participación se agrupan para no repetir la misma fórmula
  function stintGroups(M) {
    var out = [], run = [];
    function flush() { if (run.length >= 2) out.push({ minor: run.slice() }); else run.forEach(function (g) { out.push({ g: g }); }); run = []; }
    M.stints.forEach(function (g) { if (g.i > 0 && g.n <= 2 && g.L.p < 24 && !g.tro.length && !g.aw.length && stintMass(g) < 2 && !g.moves.length && !g.inj.length) run.push(g); else { flush(); out.push({ g: g }); } });
    flush(); return out;
  }
  function minorText(M, run) {
    var T = { p: 0, g: 0 }; run.forEach(function (g) { T.p += g.L.p; T.g += g.L.g; });
    var names = run.map(function (g) { return nm(g.name) + (g.loan ? ' (cedido)' : '') + (g.country && g.country !== M.h.nat ? ' [' + esc(cn(g.country)) + ']' : ''); }), y0 = run[0].y0, y1 = run[run.length - 1].y1;
    return V('minor', [function () { return (y0 === y1 ? 'En ' + y0 : 'Entre ' + y0 + ' y ' + y1) + ' pasó sucesivamente por ' + list(names) + ', sin superar los ' + Math.max.apply(null, run.map(function (g) { return g.L.p; })) + ' partidos en ninguno de ellos.'; }, function () { return 'Durante ese tramo (' + span(y0, y1) + ') defendió a ' + list(names) + '. En conjunto disputó ' + apps(T.p) + (offense(M) && T.g ? ' y marcó ' + goals(T.g) : '') + '.'; }]);
  }
  function career(M) {
    var subs = [];
    stintGroups(M).forEach(function (e) {
      if (e.minor) { var run = e.minor; subs.push({ t: 'Etapa itinerante · ' + span(run[0].y0, run[run.length - 1].y1), p: [minorText(M, run)] }); return; }
      var g = e.g; subs.push({ t: String(g.name) + (g.loan ? ' (cedido)' : '') + ' · ' + span(g.y0, g.y1), p: stintParas(M, g) });
    });
    return subs;
  }

  // =====================================================================================================
  // SELECCIÓN NACIONAL
  // =====================================================================================================
  function national(M) {
    var h = M.h, n = M.nt, out = [], cnn = esc(cn(h.nat)), K = kinds(M);
    if (!n.any) return out;
    function ntTitles(abs) { var nt = K.nt.filter(function (x) { return abs ? (!x.t.cat || x.t.cat === 'ABS') : (x.t.cat && x.t.cat !== 'ABS'); }); return nt.length ? 'Ganó ' + esc(titleList(nt.map(function (x) { return x.t; }))) + ' con la selección.' : ''; }
    if (n.youth.length) {
      var yp = n.youth.map(function (c) { return c.label + ' (' + span(c.y0, c.y1) + '): ' + apps(c.p) + (c.g && offense(M) ? ' y ' + goals(c.g) : ''); });
      out.push({ t: 'Categorías inferiores', p: [join([V('nt.youth', [function () { return 'Con las selecciones juveniles de ' + cnn + ' disputó ' + esc(list(yp)) + '.'; }, function () { return 'Fue internacional en categorías inferiores con ' + cnn + ': ' + esc(list(yp)) + '.'; }]), ntTitles(false)])] });
    }
    if (n.abs) {
      var a = n.abs, ps = [], comps = Object.keys(a.comps).sort(function (x, y) { return a.comps[y] - a.comps[x]; }).slice(0, 3);
      if (n.first) ps.push(V('nt.first', ['Fue convocado por primera vez a la selección absoluta el ' + dlong(n.first.w) + '.', 'Su primera convocatoria con la selección absoluta fue el ' + dlong(n.first.w) + '.']));
      ps.push('Con ' + cnn + ' ' + (a.y0 === a.y1 ? 'en ' + a.y0 : 'entre ' + a.y0 + ' y ' + a.y1) + ' acumuló ' + apps(a.offP || a.p) + (a.g && offense(M) ? ' y ' + goals(a.g) : '') + (comps.length ? ', con presencia en ' + esc(list(comps)) : '') + '.');
      ps.push(ntTitles(true));
      var nmo = B.moments().filter(function (m) { return m.nat; }).sort(function (x, y) { return y.sc - x.sc; }).slice(0, 2).sort(function (x, y) { return x.w - y.w; });
      if (nmo.length) ps.push(cap('entre sus actuaciones destacadas figuran: ' + esc(nmo.map(X.momentText).join('; '))) + '.');
      out.push({ t: 'Selección absoluta', p: [join(ps)] });
    }
    return out;
  }

  // =====================================================================================================
  // RÉCORDS Y LEGADO
  // =====================================================================================================
  function records(M) {
    var h = M.h, out = [], T = M.tot, ms = M.mostGoals;
    if (M.pro.length && T.p >= 20) out.push('Como profesional ' + (M.retired ? 'sumó ' : 'suma ') + totals(T, M) + ' en ' + plural(M.clubs.length, 'club', 'clubes') + (M.countries.length > 1 ? ' de ' + M.countries.length + ' países' : '') + '.');
    if (ms && ms.L.g >= 8 && offense(M) && !ctx.said[ms.key]) { ctx.said[ms.key] = 1; out.push('Su mejor registro goleador en una temporada fue de ' + goals(ms.L.g) + ' ' + when(ms) + ' con ' + nm(ms.name) + ' (' + apps(ms.L.p) + ' en ' + esc(shortLg(ms.lgName)) + ').'); }
    var bs = M.bestSeason; if (bs && bs.perf.z >= 0.9 && !ctx.said[bs.key]) out.push('La temporada de mejor rendimiento relativo a su puesto fue ' + when(bs) + ' en ' + nm(bs.name) + ': ' + prod(bs, M) + '.');
    M.ido.forEach(function (c, i) {
      if (i > 2) return; var Id = FP.Idolo, top = Id && Id.top ? Id.top(c.t, 3) : [], pos = top.map(function (x) { return x.me; }).indexOf(1);
      out.push('En ' + nm(c.name) + ' alcanzó el estatus de ' + esc(lcf(c.label)) + ' tras ' + plural(c.g.n, 'temporada', 'temporadas') + ' (' + span(c.g.y0, c.g.y1) + ')' + (pos === 0 ? ' y figura como máximo goleador del club en el registro de la partida' : pos > 0 ? ' y figura entre los tres máximos goleadores del club en el registro de la partida' : '') + '.');
    });
    var hs = X.milestones(h); if (hs.length) out.push('El registro de la partida anota ' + plural(hs.length, 'hito', 'hitos') + ' en su carrera; el listado completo está en la cronología.');
    if (M.retired && h.post && h.post.legacy) out.push('Al retirarse, el juego valoró su legado como «' + esc(h.post.legacy.label) + '» (' + h.post.legacy.score + '/100).');
    return out;
  }

  // =====================================================================================================
  // RETIRO Y TRAYECTORIA POSTERIOR
  // =====================================================================================================
  function retiro(M) {
    var h = M.h, out = [], yrs = h.retiredAge && h.startAge != null ? h.retiredAge - h.startAge : null;
    out.push('Se retiró del fútbol profesional el ' + dlong(h.retiredW != null ? h.retiredW : M.now) + ', a los ' + (h.retiredAge || FP.Hero.age()) + ' años' + (yrs ? ', tras ' + plural(yrs, 'año', 'años') + ' de carrera' : '') + '.');
    var lastInj = M.inj.filter(function (e) { return e.major && h.retiredW - e.w >= 0 && h.retiredW - e.w <= 52; }).sort(function (a, b) { return b.w - a.w; })[0];
    if (lastInj) out.push('Su último año como futbolista estuvo marcado por una lesión (' + esc(String(lastInj.nm).toLowerCase()) + ', ' + plural(lastInj.n, 'semana', 'semanas') + ' de baja) en ' + mlong(lastInj.w) + '.');
    var p = h.post, pa = p && p.path, PA = FP.Post && FP.Post.PATHS;
    if (pa && PA && PA[pa.k]) {
      var since = pa.since != null ? D.year(pa.since) : null, nmP = PA[pa.k].nm.toLowerCase();
      var s = 'Tras su retiro ' + (pa.k === 'none' ? 'llevó una vida tranquila' : 'se dedicó a su carrera como ' + esc(nmP)) + (since && pa.k !== 'none' ? ' (desde ' + since + ')' : '') + '.';
      if (pa.k === 'coach' && pa.titles) s += ' Como entrenador ha ganado ' + plural(pa.titles, 'título', 'títulos') + '.';
      out.push(s);
    }
    return out;
  }

  // =====================================================================================================
  // ENSAMBLE
  // =====================================================================================================
  N.build = function () {
    var M = N.analyze(), h = M.h; begin(M);
    var secs = [], lock = [], leadHtml = lead(M);
    secs.push({ id: 'infancia', t: 'Primeros años y formación', p: earlyYears(M) });
    if (M.stints.length) secs.push({ id: 'trayectoria', t: 'Carrera profesional', sub: career(M) });
    else lock.push(['Carrera profesional', 'se escribe cuando debutes como profesional']);
    var nat = national(M);
    if (nat.length) secs.push({ id: 'seleccion', t: 'Selección nacional', sub: nat.map(function (x) { return { t: x.t, p: x.p }; }), tables: ['nat'] }); else lock.push(['Selección nacional', 'se escribe cuando juegues con tu selección']);
    secs.push({ id: 'estilo', t: 'Estilo de juego', p: X.styleText(h) });
    if (M.pro.length) secs.push({ id: 'estadisticas', t: 'Estadísticas profesionales', tables: ['pro'] });
    if (M.form.length) secs.push({ id: 'estjuv', t: 'Estadísticas juveniles', tables: ['youth'] });
    var tr = h.trophies || [], aw = h.awards || [];
    if (tr.length || aw.length) secs.push({ id: 'palmares', t: 'Palmarés y distinciones', trophies: tr, awards: aw }); else lock.push(['Palmarés y distinciones', 'se completa al ganar títulos o premios']);
    var rc = records(M); if (rc.length) secs.push({ id: 'records', t: 'Récords y legado', p: rc }); else lock.push(['Récords y legado', 'aparece con una carrera más larga']);
    var per = X.personalText(h); if (per.length) secs.push({ id: 'vida', t: 'Vida personal', p: per }); else lock.push(['Vida personal', 'se completa con estudios, familia y vida fuera de la cancha']);
    if (h.retired) secs.push({ id: 'retiro', t: 'Retiro y trayectoria posterior', p: retiro(M) }); else lock.push(['Retiro y trayectoria posterior', 'se escribe cuando termine tu carrera']);
    return { M: M, lead: leadHtml, secs: secs, lock: lock };
  };

  // ---------- conexión con la Wiki: el motor reemplaza el cuerpo del artículo y conserva ficha, cronología y estructura ----------
  var build0 = B.build;
  B.build = function () {
    var d = build0.apply(this, arguments);
    try {
      var n = N.build(); d.lead = n.lead; d.secs = n.secs; d.lock = n.lock; d.narr = n.M;
      var seasons = n.M.nProSeasons, nSec = d.secs.length;
      d.grade = FP.S.hero.retired && seasons >= 10 ? ['Artículo destacado', 'g'] : nSec >= 7 && seasons >= 5 ? ['Artículo bueno', 'b'] : nSec >= 4 ? ['En construcción', 'y'] : ['Esbozo', ''];
    } catch (e) { if (window.console) console.warn('narrativa', e); }
    return d;
  };
})();
