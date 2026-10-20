/* FUTPRO — biografía en formato enciclopédico. Se construye sola a partir de los datos de la carrera (temporadas, títulos,
 * premios, lesiones, selección, vida personal) y de un registro de hitos (h.bio.ev) que se va llenando mientras se juega.
 * No inventa hechos: cada frase sale de un dato registrado; las secciones sin datos quedan por desbloquear. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, Hero = FP.Hero, esc = U.esc;
  var B = FP.Bio = {};

  var MESL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var DEM = { CHI: 'chileno', ARG: 'argentino', BRA: 'brasileño', URU: 'uruguayo', PAR: 'paraguayo', COL: 'colombiano', PER: 'peruano', ECU: 'ecuatoriano', BOL: 'boliviano', VEN: 'venezolano', ENG: 'inglés', ESP: 'español', ITA: 'italiano', GER: 'alemán', FRA: 'francés', POR: 'portugués', NED: 'neerlandés', BEL: 'belga', SCO: 'escocés', TUR: 'turco', GRE: 'griego', SUI: 'suizo', AUT: 'austriaco', DEN: 'danés', SWE: 'sueco', NOR: 'noruego', POL: 'polaco', CZE: 'checo', USA: 'estadounidense', MEX: 'mexicano', CAN: 'canadiense', CRC: 'costarricense', KSA: 'saudí', JPN: 'japonés', KOR: 'surcoreano', CHN: 'chino', AUS: 'australiano', EGY: 'egipcio', MAR: 'marroquí', RSA: 'sudafricano', TUN: 'tunecino', ALG: 'argelino' };
  var ART = { vel: 'la velocidad', ace: 'la aceleración', res: 'la resistencia', fue: 'la fuerza', fin: 'la definición', rem: 'el remate', cab: 'el cabezazo', pas: 'el pase', reg: 'el regate', con: 'el control', vis: 'la visión de juego', pos: 'el posicionamiento', ant: 'la anticipación', com: 'la compostura', dfn: 'la defensa', dis: 'la disciplina' };
  var CATN = { u15: 'Sub-15', u17: 'Sub-17', u20: 'Sub-20', u23: 'Sub-23', abs: 'absoluta' };
  var CATS = ['u15', 'u17', 'u20', 'u23', 'abs'];

  function dlong(w) { var y = D.ymd(w); return y[2] + ' de ' + MESL[y[1]] + ' de ' + y[0]; }
  function mlong(w) { var y = D.ymd(w); return MESL[y[1]] + ' de ' + y[0]; }
  function y4(s) { return parseInt(String(s).slice(0, 4), 10) || 0; }
  function yEnd(s) { s = String(s); return s.indexOf('/') > 0 ? 2000 + parseInt(s.split('/')[1], 10) : y4(s); }
  function plural(n, a, b) { return n + ' ' + (n === 1 ? a : b); }
  function list(a) { return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1]; }
  function tname(nm) { return String(nm).replace(/^(Campeón|Subcampeón) Juvenil · .*$/i, '$1 juvenil'); }   // el campeonato juvenil se nombra solo, sin la liga profesional del club
  function baseName(n) { return String(n || '').replace(/\s*\((juv\.|cedido)\)\s*$/i, '').trim(); }
  function pron(h) { return DEM[h.nat] || null; }
  function countryName(code) { try { return C.cname(code); } catch (e) { return code; } }

  // ---------- registro de hitos mientras se juega ----------
  var KEEP = /^(¡?Convocado a la selección absoluta|¡?Integras la nómina final|¡Ascendido al primer equipo|¡Debutas|Firmaste|¡?Prueba aprobada|Bienvenido a las divisiones|Cedido a|¡?Terminas el colegio|¡?Te recibes|Anuncias|Te retiras)/;
  B.ensure = function () { var h = FP.S && FP.S.hero; if (!h) return null; if (!h.bio) h.bio = { ev: [] }; return h.bio; };
  B.migrate = B.ensure;
  var msg0 = Hero.msg;
  Hero.msg = function (txt, kind, extra) {
    var r = msg0.apply(this, arguments);
    try { if (kind === 'ok' && KEEP.test(txt)) { var b = B.ensure(), last = b.ev[b.ev.length - 1]; if (!last || last.t !== txt) { b.ev.push({ w: FP.S.week, t: txt }); if (b.ev.length > 300) b.ev.shift(); } } } catch (e) { }
    return r;
  };

  // cesiones: se registran al empezar y terminar para escribirlas en la biografía
  var we0 = Hero.weekEnd;
  Hero.weekEnd = function () {
    var r = we0.apply(this, arguments);
    try {
      var h = FP.S.hero, b = B.ensure(); b.loans = b.loans || [];
      var cur = b.loans[b.loans.length - 1], open = cur && cur.w1 == null;
      if (h.loan && (!open || cur.to !== h.loan.to)) b.loans.push({ from: h.loan.from, to: h.loan.to, w0: h.loan.start != null ? h.loan.start : FP.S.week, w1: null, buy: h.loan.buy || 0 });
      else if (!h.loan && open) { cur.w1 = FP.S.week; cur.res = h.club === cur.to ? 'compra' : h.club === cur.from ? 'regreso' : 'otro'; }
    } catch (e) { }
    return r;
  };
  // actuaciones destacadas: se guardan pocas (máx. 2 por año y por clase) para contarlas en la biografía
  var am0 = Hero.afterMatch;
  Hero.afterMatch = function (prep, res) {
    var r = am0.apply(this, arguments);
    try { B.moment(prep, res); } catch (e) { }
    return r;
  };
  B.moment = function (prep, res) {
    var h = FP.S.hero, hm = res && res.hero, comp = prep.comp, f = prep.f; if (!hm || !hm.played || !hm.g) return;
    if (comp.kind === 'F' || f.fr) return;                                   // solo partidos oficiales
    var mins = (res.ev || []).filter(function (e) { return e.hero && e.t === 'goal'; }).map(function (e) { return e.m; });
    var mg = prep.home ? res.hs : res.as, og = prep.home ? res.as : res.hs, win = mg > og, nat = prep.mine >= 5000 && prep.mine < 20000;
    var ro = String(f.ro || ''), fin = /^Final$/i.test(ro) || /\bfinal\b/i.test(ro) && !/semi|cuartos|octavos|dieciseis/i.test(ro);
    var late = win && mg - og === 1 && mins.some(function (m) { return m >= 85; });
    var k = fin ? 'fin' : hm.g >= 3 ? 'hat' : late ? 'late' : (nat && h.nt && h.nt.goals === hm.g) ? 'nt1' : null; if (!k) return;
    var sc = (fin ? 8 : 0) + (hm.g >= 3 ? 4 : 0) + (hm.g >= 4 ? 1 : 0) + (late ? 3 : 0) + (k === 'nt1' ? 3 : 0) + (win ? 1 : 0);
    var b = B.ensure(); b.moments = b.moments || [];
    var m = { w: FP.S.week, k: k, g: hm.g, m: mins, s: mg + '-' + og, r: win ? 'V' : mg < og ? 'D' : 'E', c: FP.Stats.compName(comp), ro: ro, o: C.tname(prep.opp), club: C.tname(prep.mine), nat: nat, sc: sc };
    b.moments.push(m);
    var yr = D.year(m.w), same = b.moments.filter(function (x) { return D.year(x.w) === yr && x.nat === nat; });
    if (same.length > 2) { same.sort(function (a, c2) { return c2.sc - a.sc || c2.w - a.w; }); var drop = same[same.length - 1]; b.moments.splice(b.moments.indexOf(drop), 1); }
    if (b.moments.length > 80) b.moments.shift();
  };
  function momentText(m) {
    var d = dlong(m.w), vs = ' ante ' + m.o + ' (' + m.s + ')', cp = m.c + (m.ro ? ', ' + m.ro.toLowerCase() : '');
    var gn = m.g >= 4 ? plural(m.g, 'gol', 'goles') : m.g === 3 ? 'un triplete' : m.g === 2 ? 'un doblete' : 'un gol', min = m.m && m.m.length === m.g ? ' (min. ' + m.m.join(', ') + ')' : '';
    if (m.k === 'fin') return 'marcó ' + gn + min + ' en la final de ' + m.c + vs + (m.r === 'V' ? ', en la que su equipo se impuso' : '') + ', el ' + d;
    if (m.k === 'hat') return 'anotó ' + (m.g === 3 ? 'un triplete' : plural(m.g, 'gol', 'goles')) + min + vs + ' por ' + cp + ', el ' + d;
    if (m.k === 'late') return 'marcó en el minuto ' + m.m[m.m.length - 1] + vs + ' por ' + cp + ', el gol que decidió el partido (' + d + ')';
    return 'convirtió su primer gol con la selección' + vs + ', el ' + d;
  }
  B.moments = function () { var h = FP.S && FP.S.hero; return (h && h.bio && h.bio.moments) || []; };

  B.loans = function () { var h = FP.S && FP.S.hero; return (h && h.bio && h.bio.loans) || []; };
  // ¿ese equipo, en esa semana, fue una cesión?
  B.isLoan = function (t, w) {
    var b = t != null && t >= 30000 && t < 50000 ? t - 30000 : t;
    return B.loans().some(function (l) { return l.to === b && w >= l.w0 - 1 && (l.w1 == null || w <= l.w1 + 1); });
  };

  // ---------- datos agregados ----------
  // trayectoria a partir del registro de partidos (equipo real de cada temporada: club, juvenil o cedido)
  function entryRows(h) {
    var ST = FP.Stats, ageOf = {}; (h.seasons || []).forEach(function (r) { ageOf[y4(r.y)] = r.age; });
    var ents = ST.seasons().map(function (s) { return { s: s.s, t: s.t, tn: s.tn, o: s.o, rows: s.rows.filter(function (r) { return !ST.isNT(r.k) && r.k !== 'amis'; }) }; }).filter(function (e) { return e.rows.length; }).sort(function (a, b) { return a.o - b.o; });
    return ents.map(function (e) {
      var t = e.rows.reduce(function (a, r) { a.ap += r.p; a.g += r.g; a.a += r.a; a.min += r.min; a.rs += r.rs; a.rn += r.rn; return a; }, { ap: 0, g: 0, a: 0, min: 0, rs: 0, rn: 0 });
      var b = e.t != null && e.t >= 30000 && e.t < 50000 ? e.t - 30000 : e.t, nm = b != null && b < 5000 ? C.tname(b) : e.tn;
      var loan = B.isLoan(e.t, e.o), youth = e.t != null && e.t >= 30000 && e.t < 50000;
      return { y: e.s, club: nm + (youth ? ' (juv.)' : '') + (loan ? ' (cedido)' : ''), ap: t.ap, g: t.g, a: t.a, min: t.min, rt: t.rn ? t.rs / t.rn : 0, age: ageOf[y4(e.s)], t: e.t, o: e.o };
    }).filter(function (r) { return r.ap > 0; });
  }
  function stints(h) {
    var out = [];
    entryRows(h).forEach(function (r) {
      var nm = baseName(r.club), youth = /\(juv\.\)/i.test(r.club), loan = /\(cedido\)/i.test(r.club), g = out[out.length - 1];
      if (g && g.nm === nm && g.loan === loan) { g.rows.push(r); g.youth = g.youth && youth; } else out.push({ nm: nm, rows: [r], youth: youth, loan: loan });
    });
    return out;
  }
  function sumRows(rows) { return rows.reduce(function (t, r) { t.ap += r.ap; t.g += r.g; t.a += r.a; t.min += r.min; return t; }, { ap: 0, g: 0, a: 0, min: 0 }); }
  function range(rows) { var a = y4(rows[0].y), b = yEnd(rows[rows.length - 1].y); return a === b ? String(a) : a + '–' + b; }
  function historyFor(h, nm) { return (h.history || []).filter(function (e) { return e.club != null && e.club < 5000 && C.tname(e.club) === nm; }); }
  function titlesAt(h, nm) { return (h.trophies || []).filter(function (t) { return !t.sub && baseName(t.club) === nm; }); }
  function awardsIn(h, rows) { var ys = {}; rows.forEach(function (r) { ys[y4(r.y)] = 1; ys[yEnd(r.y)] = 1; }); return (h.awards || []).filter(function (a) { return ys[y4(a.y)] || ys[yEnd(a.y)]; }); }

  // ---------- redacción por secciones ----------
  function leadText(h, st, tot, ntTot) {
    var S = FP.S, dem = pron(h), pos = C.POS_NAME[h.pos].toLowerCase(), ret = h.retired;
    var club = h.club != null ? C.tname(h.club) : (h.team != null ? C.tname(h.team) : null);
    var born = (h.city ? esc(h.city) + ', ' : '') + dlong(h.b);
    var p = '<b>' + esc(h.nm) + '</b> (' + born + ') ' + (ret ? 'fue' : 'es') + ' un futbolista ' + (dem ? esc(dem) : 'de ' + esc(countryName(h.nat))) + ' que ' + (ret ? 'se desempeñaba' : 'se desempeña') + ' como ' + esc(pos) + (!ret && club && h.tk !== 'free' ? ' en ' + esc(club) : '') + '.';
    if (!st.length) return p;
    var names = []; st.forEach(function (s) { if (names.indexOf(s.nm) < 0) names.push(s.nm); });
    p += ' ' + (names.length > 1 ? 'Ha pasado por ' + names.length + ' clubes, entre ellos ' + esc(list(names.slice(-3).reverse().slice(0, 3))) + '.' : 'Ha defendido a ' + esc(names[0]) + '.');
    var lo = B.loans().map(function (l) { return C.tname(l.to); }).filter(function (n, i, a) { return a.indexOf(n) === i; }); if (lo.length) p += ' Ha sido cedido a ' + esc(list(lo)) + '.';
    if (tot.ap) p += ' Suma ' + plural(tot.ap, 'partido', 'partidos') + ' y ' + plural(tot.g, 'gol', 'goles') + ' en clubes.';
    if (ntTot && ntTot.p) p += ' Ha sido internacional con ' + esc(countryName(h.nat)) + ' en ' + plural(ntTot.p, 'partido', 'partidos') + (ntTot.g ? ' (' + plural(ntTot.g, 'gol', 'goles') + ')' : '') + '.';
    var champ = (h.trophies || []).filter(function (t) { return !t.sub; });
    if (champ.length) p += ' Ha ganado ' + plural(champ.length, 'título', 'títulos') + (champ.length >= 2 ? ', entre ellos ' + esc(list(champ.slice(-2).map(function (t) { return t.nm; }))) : ', el de ' + esc(champ[0].nm)) + '.';
    var top = (h.awards || []).filter(function (a) { return /Balón de Oro|Mejor jugador/i.test(a.nm); });
    if (top.length) p += ' Fue distinguido con el ' + esc(top[0].nm) + (top.length > 1 ? ' en ' + top.length + ' ocasiones' : ' en ' + y4(top[0].y)) + '.';
    return p;
  }

  function earlyYears(h, st) {
    var S = FP.S, first = st[0], p = [];
    var dem = pron(h);
    if (h.city || true) p.push('Nació' + (h.city ? ' en ' + esc(h.city) : '') + ' el ' + dlong(h.b) + '. Mide ' + h.ht + ' cm y pesa ' + h.kg + ' kg.');
    if (first) {
      var first4 = y4(first.rows[0].y), age0 = first.rows[0].age;
      p.push('Comenzó su carrera en ' + esc(first.nm) + (first.youth ? ' (divisiones inferiores)' : '') + ' en ' + first4 + ', con ' + age0 + ' años' + (h.ovr0 ? ' y una media de ' + h.ovr0 : '') + '.');
    }
    return p;
  }

  var usedM = [];
  function stintText(h, s, i, all) {
    var out = [], rows = s.rows, T = sumRows(rows), hist = historyFor(h, s.nm), senior = rows.filter(function (r) { return !/\(juv\.\)/i.test(r.club); }), young = rows.filter(function (r) { return /\(juv\.\)/i.test(r.club); });
    var arr = hist.filter(function (e) { return /^Firma con/.test(e.t); })[0], debut = hist.filter(function (e) { return /^Debut con el primer equipo/.test(e.t); })[0];
    if (young.length) { var Y = sumRows(young); out.push('Pasó por las divisiones inferiores ' + (range(young).indexOf('–') > 0 ? 'entre ' : 'en ') + range(young) + ', donde disputó ' + plural(Y.ap, 'partido', 'partidos') + ' y anotó ' + plural(Y.g, 'gol', 'goles') + '.'); }
    var pn = null; for (var q = i - 1; q >= 0; q--) if (!all[q].loan) { pn = all[q]; break; }
    var back = !s.loan && pn && pn.nm === s.nm;     // regreso de una cesión: ya se dijo al terminarla
    if (i > 0 && !back) {
      var fee = arr && /traspaso ([^)]+)/.exec(arr.t);
      var ln = B.loans().filter(function (l) { return C.tname(l.to) === s.nm; })[0], from = ln ? C.tname(ln.from) : (all[i - 1] ? all[i - 1].nm : null);
      out.push(s.loan ? (ln ? 'En ' + mlong(ln.w0) : 'En ' + y4(rows[0].y)) + ' fue cedido a ' + esc(s.nm) + (from ? ' por ' + esc(from) : '') + (ln && ln.w1 != null ? ' durante ' + Math.max(1, Math.round((ln.w1 - ln.w0) / 4.35)) + ' meses' : '') + '.' + (ln && ln.buy ? ' El préstamo incluía una opción de compra de ' + esc(FP.fmt.money(ln.buy)) + '.' : '') : (arr ? 'En ' + mlong(arr.w) : 'En ' + y4(rows[0].y)) + (young.length ? ' firmó su primer contrato profesional con ' : ' se incorporó a ') + esc(s.nm) + (fee ? ' por un traspaso de ' + esc(fee[1]) : '') + '.');
    }
    if (debut) out.push('Debutó con el primer equipo el ' + dlong(debut.w) + '.');
    if (senior.length) {
      if (senior.length <= 3) out.push(senior.map(function (r) { return 'en la temporada ' + esc(r.y) + ' jugó ' + plural(r.ap, 'partido', 'partidos') + ' y marcó ' + plural(r.g, 'gol', 'goles') + (r.a ? ' (' + plural(r.a, 'asistencia', 'asistencias') + ')' : ''); }).join('; ').replace(/^e/, 'E') + '.');
      else { var S2 = sumRows(senior), best = senior.slice().sort(function (a, b) { return b.g - a.g; })[0]; out.push('En ' + senior.length + ' temporadas (' + range(senior) + ') disputó ' + plural(S2.ap, 'partido', 'partidos') + ' y anotó ' + plural(S2.g, 'gol', 'goles') + '; su mejor año fue ' + esc(best.y) + ', con ' + plural(best.g, 'gol', 'goles') + '.'); }
    }
    var ya = y4(rows[0].y), yb = yEnd(rows[rows.length - 1].y);
    var mo = B.moments().filter(function (m) { var yy = D.year(m.w); return !m.nat && baseName(m.club) === s.nm && yy >= ya && yy <= yb && usedM.indexOf(m) < 0; }).sort(function (a, b2) { return b2.sc - a.sc; }).slice(0, 2).sort(function (a, b2) { return a.w - b2.w; });
    mo.forEach(function (m) { usedM.push(m); });
    if (mo.length) out.push('Entre sus actuaciones destacadas figuran: ' + esc(mo.map(momentText).join('; ')) + '.');
    var tt = titlesAt(h, s.nm); if (tt.length) out.push('Con el club se proclamó ' + esc(list(tt.map(function (t) { return tname(t.nm).charAt(0).toLowerCase() + tname(t.nm).slice(1) + ' (' + t.y + ')'; }))) + '.');
    var aw = awardsIn(h, rows).filter(function (a) { return !(s.rows.length && false); }); if (aw.length) out.push('A título individual recibió ' + esc(list(aw.slice(0, 3).map(function (a) { return a.nm + ' (' + a.y + ')'; }))) + '.');
    if (s.loan) { var ln2 = B.loans().filter(function (l) { return C.tname(l.to) === s.nm; })[0]; if (ln2 && ln2.res === 'compra') out.push('El club ejerció la opción de compra y el jugador pasó a ser propiedad de ' + esc(s.nm) + '.'); else if (ln2 && ln2.res === 'regreso') out.push('Terminada la cesión, regresó a ' + esc(C.tname(ln2.from)) + '.'); else if (all[i + 1] && all[i + 1].nm === (all[i - 1] && all[i - 1].nm)) out.push('Terminada la cesión, regresó a ' + esc(all[i + 1].nm) + '.'); }
    if (!out.length) out.push('Disputó ' + plural(T.ap, 'partido', 'partidos') + ' en ' + range(rows) + '.');
    return out;
  }

  function nationalText(h) {
    var ST = FP.Stats, by = ST.byClass(), out = [], cn = countryName(h.nat), any = false;
    CATS.forEach(function (k) {
      var d = by[k]; if (!d) return; any = true;
      var rows = d.rows, T = ST.sum(rows), ys = rows.map(function (r) { return y4(r.s); }), a = Math.min.apply(null, ys), b = Math.max.apply(null, ys);
      var comps = {}; rows.forEach(function (r) { if (!/Amistoso/i.test(r.c)) comps[r.c] = (comps[r.c] || 0) + r.p; });
      var cl = Object.keys(comps).sort(function (x, y) { return comps[y] - comps[x]; }).slice(0, 2);
      out.push({ k: k, t: 'Selección ' + CATN[k] + (k === 'abs' ? '' : ''), p: (k === 'abs' ? 'Con la selección absoluta de ' : 'Con la selección ' + CATN[k] + ' de ') + esc(cn) + ' ' + (a === b ? 'en ' + a : 'entre ' + a + ' y ' + b) + ' disputó ' + plural(T.p, 'partido', 'partidos') + ' y marcó ' + plural(T.g, 'gol', 'goles') + (cl.length ? ', con presencia en ' + esc(list(cl)) : '') + '.' });
    });
    var nmo = B.moments().filter(function (m) { return m.nat; }).sort(function (a, b2) { return b2.sc - a.sc; }).slice(0, 3).sort(function (a, b2) { return a.w - b2.w; });
    if (nmo.length) out.push({ k: 'dest', t: 'Actuaciones destacadas', p: 'Entre sus actuaciones destacadas figuran: ' + esc(nmo.map(momentText).join('; ')) + '.' });
    var first = (B.ensure().ev || []).filter(function (e) { return /Convocado a la selección absoluta/.test(e.t); })[0];
    if (first) out.push({ k: 'conv', t: 'Primera convocatoria', p: 'Fue convocado por primera vez a la selección absoluta el ' + dlong(first.w) + '.' });
    return any ? out : [];
  }

  function styleText(h) {
    var S = Hero.STYLES[h.style], at = C.ATTRS.slice().sort(function (a, b) { return h.at[b] - h.at[a]; }), top = at.slice(0, 3), low = at[at.length - 1];
    var foot = h.foot === 'L' ? 'zurdo' : h.foot === 'A' ? 'ambidiestro' : 'diestro';
    var p = ['Es un futbolista ' + foot + ' de estilo ' + esc(S ? S.n.toLowerCase() : 'equilibrado') + '. Destacan ' + esc(list(top.map(function (a) { return ART[a] + ' (' + Math.round(h.at[a]) + ')'; }))) + '; su aspecto más débil es ' + esc(ART[low]) + ' (' + Math.round(h.at[low]) + ').'];
    if (h.ovr0 && Math.round(h.ovr) !== Math.round(h.ovr0)) p.push('Su media pasó de ' + Math.round(h.ovr0) + ' al comenzar su carrera a ' + Math.round(h.ovr) + (h.ovr > h.ovr0 ? '' : ' en la actualidad') + '.');
    return p;
  }

  function injuryText(h) {
    var hist = (h.med && h.med.hist) || []; if (!hist.length) return [];
    var tot = hist.reduce(function (s, e) { return s + e.n; }, 0), big = hist.filter(function (e) { return e.n >= 6; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 4);
    var p = ['A lo largo de su carrera acumuló ' + plural(hist.length, 'lesión', 'lesiones') + ' y ' + plural(tot, 'semana', 'semanas') + ' de baja.'];
    big.sort(function (a, b) { return a.w - b.w; }).forEach(function (e) { p.push('En ' + mlong(e.w) + ' sufrió una lesión (' + esc(e.nm.toLowerCase()) + ', en ' + esc(e.zone) + ') que lo mantuvo ' + plural(e.n, 'semana', 'semanas') + ' alejado de las canchas.'); });
    return p;
  }

  function personalText(h) {
    var L = FP.Life, l = L && L.ensure ? L.ensure() : null, p = [];
    if (l) {
      if (l.edu.degree) p.push('Se tituló en la universidad mientras desarrollaba su carrera.');
      else if (l.edu.mode === 'uni') p.push('Cursa estudios universitarios a distancia, a la vez que juega.');
      if (l.edu.grad === true) p.push('Completó la educación secundaria con un promedio de ' + Math.round(l.edu.grade) + '.');
      else if (l.edu.grad === false && l.edu.hist && l.edu.hist.length) p.push('No llegó a completar la educación secundaria.');
      var langs = Object.keys(l.lang || {}).filter(function (k) { return l.lang[k] >= 60; }).map(function (k) { return L.langName(k).toLowerCase(); });
      if (langs.length > 1) p.push('Habla ' + esc(list(langs)) + '.');
      if (l.ctry && l.ctry !== h.nat && h.tk !== 'free') p.push('Reside en ' + esc(countryName(l.ctry)) + (l.fam && l.fam.mode === 'familia' ? ' junto a su familia.' : '.'));
    }
    if (h.agent) p.push('Es representado por ' + esc(h.agent.nm.replace(/\s*\(agente\)\s*/i, '')) + '.');
    var rd = h.rd;
    if (rd) {
      var br = {}; (rd.sp.deals || []).forEach(function (d) { br[d.brand] = 1; }); (rd.sp.hist || []).forEach(function (d) { br[d.brand] = 1; });
      var bl = Object.keys(br); if (bl.length) p.push('Ha sido imagen de ' + esc(list(bl)) + '.');
      if (rd.fan) p.push('Cuenta con un club de fans, «' + esc(rd.fan.nm) + '».');
    }
    if (h.soc && FP.Social) { var f = FP.Social.followers(); if (f >= 1000) p.push('En redes sociales reúne ' + FP.fmt.num(f) + ' seguidores.'); }
    return p;
  }

  function milestones(h) {
    var out = [], ms = (h.flags && h.flags.ms) || {};
    if (FP.Social) FP.Social.milestones().forEach(function (m) { if (ms[m.id]) out.push({ w: ms[m.id], t: m.n }); });
    var ach = (h.gl && h.gl.ach) || {};
    if (FP.Season) FP.Season.ACH.forEach(function (a) { if (ach[a.id]) out.push({ w: ach[a.id], t: a.nm }); });
    return out;
  }

  function timeline(h) {
    var ev = [];
    (h.history || []).forEach(function (e) { if (/^(Firma|Debut)/.test(e.t)) ev.push({ w: e.w, t: e.t }); });
    (B.ensure().ev || []).forEach(function (e) { ev.push({ w: e.w, t: e.t.replace(/^¡/, '').replace(/!$/, '').replace(/^Convocado/, 'Convocado') }); });
    (h.trophies || []).forEach(function (t) { if (t.w != null && !t.preset) ev.push({ w: t.w, t: (t.sub ? 'Subcampeón: ' : 'Campeón: ') + tname(t.nm).replace(/^(Campeón|Subcampeón) (de )?/i, '') + (t.club ? ' con ' + baseName(t.club) : '') }); });
    (h.awards || []).forEach(function (a) { if (a.w != null) ev.push({ w: a.w, t: 'Distinción: ' + a.nm }); });
    ((h.med && h.med.hist) || []).forEach(function (e) { if (e.n >= 8) ev.push({ w: e.w, t: 'Lesión grave: ' + e.nm.toLowerCase() + ' (' + e.n + ' semanas)' }); });
    B.moments().forEach(function (m) { if (m.sc >= 5) ev.push({ w: m.w, t: (m.k === 'fin' ? 'Final de ' + m.c : m.k === 'hat' ? (m.g === 3 ? 'Triplete' : m.g + ' goles') + ' ante ' + m.o : m.k === 'late' ? 'Gol decisivo ante ' + m.o : 'Primer gol con la selección') + ' (' + m.s + ')' }); });
    B.loans().forEach(function (l) { ev.push({ w: l.w0, t: 'Cedido a ' + C.tname(l.to) + ' por ' + C.tname(l.from) }); if (l.w1 != null) ev.push({ w: l.w1, t: l.res === 'compra' ? 'Se hace efectiva la compra por ' + C.tname(l.to) : 'Fin de la cesión en ' + C.tname(l.to) + (l.res === 'regreso' ? ': regresa a ' + C.tname(l.from) : '') }); });
    milestones(h).forEach(function (e) { ev.push({ w: e.w, t: e.t }); });
    ev.sort(function (a, b) { return a.w - b.w; });
    var seen = {}; return ev.filter(function (e) { var k = e.w + e.t; if (seen[k]) return false; seen[k] = 1; return true; });
  }

  // ---------- documento ----------
  B.build = function () {
    var S = FP.S, h = S.hero, ST = FP.Stats; B.ensure();
    var st = stints(h), tot = sumRows(h.seasons || []), by = ST.byClass(), nt = by.abs || by.u23 || by.u20 || by.u17 || by.u15 ? ST.sum([].concat.apply([], CATS.filter(function (k) { return by[k]; }).map(function (k) { return by[k].rows; }))) : null;
    usedM = [];
    var secs = [], lock = [];
    var ey = earlyYears(h, st); secs.push({ id: 'infancia', t: 'Primeros años', p: ey });
    if (st.length) secs.push({ id: 'trayectoria', t: 'Trayectoria', sub: st.map(function (s, i) { return { t: s.nm + (s.loan ? ' (cedido)' : '') + ' · ' + range(s.rows), p: stintText(h, s, i, st) }; }) });
    else lock.push(['Trayectoria', 'se escribe cuando termines tu primera temporada']);
    var nat = nationalText(h);
    if (nat.length) secs.push({ id: 'seleccion', t: 'Selección nacional', sub: nat.map(function (x) { return { t: x.t, p: [x.p] }; })}); else lock.push(['Selección nacional', 'se escribe cuando juegues con tu selección']);
    secs.push({ id: 'estilo', t: 'Estilo de juego', p: styleText(h) });
    var inj = injuryText(h); if (inj.length) secs.push({ id: 'lesiones', t: 'Lesiones', p: inj }); else lock.push(['Lesiones', 'aparece si sufres lesiones']);
    var per = personalText(h); if (per.length) secs.push({ id: 'vida', t: 'Vida personal', p: per }); else lock.push(['Vida personal', 'se completa con estudios, familia y vida fuera de la cancha']);
    var ms = milestones(h); if (ms.length) secs.push({ id: 'hitos', t: 'Hitos y récords', items: ms.sort(function (a, b) { return a.w - b.w; }).map(function (e) { return dlong(e.w) + ' — ' + e.t; }) }); else lock.push(['Hitos y récords', 'se llena al lograr tus primeros hitos']);
    var tr = (h.trophies || []).filter(function (t) { return !t.preset || true; }), aw = h.awards || [];
    if (tr.length || aw.length) secs.push({ id: 'palmares', t: 'Palmarés', trophies: tr, awards: aw }); else lock.push(['Palmarés', 'se completa al ganar títulos o premios']);
    if (st.length) secs.push({ id: 'estadisticas', t: 'Estadísticas', tables: nt ? ['clubs', 'nat'] : ['clubs'] });
    var tl = timeline(h); if (tl.length >= 3) secs.push({ id: 'cronologia', t: 'Cronología', items: tl.map(function (e) { return dlong(e.w) + ' — ' + e.t; }) });
    if (h.retired) secs.push({ id: 'retiro', t: 'Retiro', p: ['Se retiró del fútbol profesional el ' + dlong(h.retiredW != null ? h.retiredW : S.week) + ', a los ' + (h.retiredAge || Hero.age()) + ' años, tras ' + (h.retiredAge ? h.retiredAge - h.startAge : 0) + ' años de carrera, con ' + plural(h.tot.ap, 'partido', 'partidos') + ' y ' + plural(h.tot.g, 'gol', 'goles') + ' en clubes.'] });
    else lock.push(['Retiro', 'se escribe cuando termine tu carrera']);
    var nSec = secs.length, seasons = st.reduce(function (n, s) { return n + s.rows.length; }, 0);
    var grade = h.retired && seasons >= 10 ? ['Artículo destacado', 'g'] : nSec >= 8 && seasons >= 5 ? ['Artículo bueno', 'b'] : nSec >= 5 ? ['En construcción', 'y'] : ['Esbozo', ''];
    var box = [['Nombre completo', h.nm], ['Nacimiento', (h.city ? h.city + ', ' : '') + dlong(h.b)], ['Nacionalidad', countryName(h.nat)], ['Altura · peso', h.ht + ' cm · ' + h.kg + ' kg'], ['Posición', C.POS_NAME[h.pos]], ['Pie hábil', h.foot === 'L' ? 'Zurdo' : h.foot === 'A' ? 'Ambidiestro' : 'Diestro']];
    if (!h.retired && h.club != null) box.push(['Club actual', C.tname(h.club)]);
    return { name: h.nm, lead: leadText(h, st, tot, nt), box: box, secs: secs, lock: lock, grade: grade, stints: st.map(function (s) { return { nm: s.nm, yrs: range(s.rows), loan: s.loan }; }), nt: nt ? { p: nt.p, g: nt.g } : null, titles: (h.trophies || []).filter(function (t) { return !t.sub; }).length, seasons: seasons };
  };
})();
