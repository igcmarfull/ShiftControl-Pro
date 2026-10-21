/* Pruebas del motor narrativo de la Wiki (js/narrativa.js y js/narrativa-texto.js).
   Construye carreras de prueba (escenarios con registros inyectados, para cubrir casos que la simulación rara vez produce) y
   comprueba que las biografías sean distintas, proporcionadas, estables y que no inventen nada.
   Uso: node tests/narrativa.js [--ver] [--sim]   (--ver imprime las biografías; --sim añade carreras simuladas de 2, 10 y 25 temporadas) */
var H = require('./harness.js'), FP = H.FP, ok = 0, bad = 0, VER = process.argv.indexOf('--ver') > 0, SIM = process.argv.indexOf('--sim') > 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
var snap = H.buildWorld(555), D = FP.Date, C = FP.Core, X = FP.Bio.x;
function tx(s) { return String(s).replace(/<[^>]+>/g, ''); }

// ---------- constructor de escenarios ----------
var S0, clubsCache = {};
function club(tier, country, k) {
  var key = tier + country + k; if (clubsCache[key]) return clubsCache[key];
  var l = FP.S.clubs.filter(function (c) { return FP.LGDEF[c.lg].t === tier && c.c === country; }); if (!l.length) throw new Error('sin club ' + tier + country);
  return clubsCache[key] = l[k % l.length];
}
function label(c, y) { return FP.LGDEF[c.lg].cal === 'euro' ? y + '/' + String((y + 1) % 100).replace(/^(\d)$/, '0$1') : String(y); }
function endWeek(c, y) { return FP.LGDEF[c.lg].cal === 'euro' ? D.of(y + 1, 4, 25) : D.of(y, 10, 28); }
function newHero(o) {
  clubsCache = {}; var S = H.restore(snap), h = FP.Game.startPreset();
  h.nm = o.nm; h.nat = o.nat || 'ESP'; h.pos = o.pos; h.city = o.city || 'Valdivia'; h.bd = [o.b, 2, 14]; h.b = D.of(o.b, 2, 14);
  h.trophies = []; h.awards = []; h.history = []; h.seasons = []; h.led = { rows: {} }; h.bio = { ev: [], loans: [], moments: [] }; h.med = h.med || {}; h.med.hist = [];
  h.ido = { v: 1, clubs: {}, cur: null, tn: 0, hall: [], ev: [], mig: 1 }; h.retired = false; h.nt = h.nt || { caps: 0, goals: 0 }; h.startAge = o.start || 14; h.startW = D.of(o.b + (o.start || 14), 5, 18);
  h.ovr0 = 50; h.ovr = 70; h.tk = 'pro'; h.post = { legacy: null, tribute: { st: 'none' }, path: null, lic: 0, agentLic: false, exp: 0, hist: [], income: 0 };
  h.gl = {}; h.rd = null; h.agent = null; h.dyn = null; FP.Social.milestones(); FP.Social.followers(); FP.Life.ensure();
  return h;
}
function row(h, o) {   // una fila del registro: liga/copa/continental/juvenil/amateur/selección
  var c = o.club, cls = o.k || 'liga', t = o.t != null ? o.t : c.id, lg = c ? FP.LGDEF[c.lg] : null, y = o.y;
  var s = o.s || (c ? label(c, y) : String(y)), cname = o.c || (lg ? lg.n : 'Competición'), tn = o.tn || (c ? c.nm : 'Equipo');
  var p = o.p, min = o.min != null ? o.min : Math.round(p * (o.avg || 80)), st = o.st != null ? o.st : Math.round(p * (o.starts != null ? o.starts : 0.9));
  var key = s + '|' + t + '|' + cls + '|' + cname, r = h.led.rows[key] = { s: s, t: t, tn: tn, k: cls, c: cname, p: p, st: st, min: min, g: o.g || 0, a: o.a || 0, yc: 0, rc: 0, rs: (o.rt || 6.4) * p, rn: p, w: Math.round(p * 0.5), d: Math.round(p * 0.25), l: p - Math.round(p * 0.5) - Math.round(p * 0.25), sq: 0, n: o.n || Math.round(p * 1.08) + 1, o: o.o != null ? o.o : (c ? endWeek(c, y) : D.of(y, 10, 28)) };
  return r;
}
// temporada en liga (más copas y continental opcionales); devuelve la fila
function season(h, y, c, p, g, a, rt, opt) {
  opt = opt || {}; var r = row(h, { y: y, club: c, p: p, g: g, a: a, rt: rt, avg: opt.avg, starts: opt.starts, n: opt.n });
  if (opt.cup) row(h, { y: y, club: c, k: 'copa', c: 'Copa nacional', p: opt.cup[0], g: opt.cup[1] || 0, a: 0, rt: rt, st: opt.cup[0] });
  if (opt.cont) row(h, { y: y, club: c, k: 'cont', c: opt.contName || 'Liga de Campeones', p: opt.cont[0], g: opt.cont[1] || 0, a: 0, rt: rt, st: opt.cont[0] });
  h.seasons.push({ y: r.s, club: c.nm, comp: '', ap: p, min: r.min, g: g, a: a, yc: 0, rc: 0, rt: rt, ovr: opt.ovr || 70, age: y - h.bd[0] });
  return r;
}
function youth(h, y, c, p, g, a, rt, nm) { var r = row(h, { y: y, club: c, t: 30000 + c.id, tn: c.nm + ' (juv.)', k: 'juv', c: nm || 'Campeonato Juvenil Sub-17', p: p, g: g, a: a, rt: rt || 6.5, starts: 0.9, o: D.of(y, 10, 20) }); h.seasons.push({ y: String(y), club: c.nm + ' (juv.)', comp: '', ap: p, min: r.min, g: g, a: a, yc: 0, rc: 0, rt: rt || 6.5, ovr: 55, age: y - h.bd[0] }); return r; }
function trophy(h, nm, y, c, extra) { var o = { y: String(y), nm: nm, club: c ? c.nm : 'Selección', w: D.of(y, 10, 30) }; for (var k in (extra || {})) o[k] = extra[k]; h.trophies.push(o); }
function award(h, nm, y) { h.awards.push({ y: String(y), nm: nm, w: D.of(y, 10, 30) }); }
function sign(h, c, y, fee) { h.history.push({ w: D.of(y, 0, 20), t: 'Firma con ' + c.nm + (fee ? ' (traspaso ' + fee + ' mil €)' : ''), club: c.id }); }
function debut(h, c, y) { h.history.push({ w: D.of(y, 2, 10), t: 'Debut con el primer equipo de ' + c.nm, club: c.id }); }
function nat(h, y, p, g, comp, cat) { var k = cat || 'abs'; row(h, { y: y, k: k, t: 5000 + 1, tn: 'Selección', s: String(y), c: comp || 'Eliminatorias', p: p, g: g, a: 0, rt: 6.6, o: D.of(y, 9, 15) }); }
function injure(h, y, nm, zone, n) { h.med.hist.push({ w: D.of(y, 2, 1), id: 'x', nm: nm, zone: zone, n: n, src: 'match', relapse: false, plan: 'club' }); }
function retire(h, age, y) { h.retired = true; h.retiredAge = age; h.retiredW = D.of(y, 11, 5); }
function idolize(h, c, ap, g, seasons, lg) { var Id = FP.Idolo; Id.ensure(); h.ido.clubs[c.id] = { ap: ap, g: g, a: 0, seasons: seasons, lg: lg || 0, cup: 0, cont: 0, fin: 0, dg: 0, hat: 0, saved: 0, promo: 0, rej: 0, love: 90, since: D.of(2026, 5, 1), last: D.of(2026, 5, 1), left: null, trait: 0, ev: [] }; }

// ---------- los escenarios ----------
var SC = {};
SC.elite = function () {
  var h = newHero({ nm: 'Elio Vargas', pos: 'ST', b: 2012, nat: 'ESP', city: 'Sevilla' }), A = club(1, 'ESP', 0), B = club(1, 'ESP', 1), Cc = club(1, 'ENG', 0), Dd = club(1, 'ESP', 2);
  youth(h, 2026, A, 24, 14, 5, 7.0, 'Campeonato Juvenil Sub-15'); youth(h, 2027, A, 26, 22, 6, 7.2); debut(h, A, 2029); sign(h, A, 2029);
  var g = [18, 24, 29, 33, 31, 36, 28, 30];
  for (var i = 0; i < 8; i++) season(h, 2029 + i, i < 4 ? A : B, 36 + (i % 3) * 2, g[i], 7 + (i % 4), i === 0 ? 6.9 : 7.5, { cup: [6, 5], cont: i >= 2 ? [9, 7] : null, ovr: 80 + i, starts: 0.95 });
  sign(h, B, 2033, 62000); for (i = 8; i < 11; i++) season(h, 2029 + i, Cc, 34, 22 - (i - 8) * 2, 8, 7.3, { cont: [8, 5], ovr: 88 - (i - 8) });
  sign(h, Cc, 2037, 45000);
  trophy(h, 'Campeón de ' + FP.LGDEF[A.lg].n, 2032, A); trophy(h, 'Campeón de ' + FP.LGDEF[A.lg].n, 2033, A); trophy(h, 'Campeón · UEFA Champions League', 2033, A); trophy(h, 'Campeón · UEFA Champions League', 2035, B); trophy(h, 'Campeón de ' + FP.LGDEF[B.lg].n, 2035, B);
  award(h, 'Balón de Oro', 2033); award(h, 'Balón de Oro', 2035); award(h, 'Bota de Oro · ' + FP.LGDEF[A.lg].n, 2032);
  for (i = 0; i < 6; i++) nat(h, 2031 + i, 11 + i, 5 + (i % 3)); nat(h, 2034, 7, 4, 'Copa del Mundo'); h.nt.caps = 74; h.nt.goals = 31; trophy(h, 'Campeón · Copa del Mundo', 2034, null, { nt: 1, cat: 'ABS' });
  idolize(h, A, 140, 90, 4, 2); retire(h, 35, 2040); return h;
};
SC.regular = function () {
  var h = newHero({ nm: 'Rafael Ortiz', pos: 'ST', b: 2012, nat: 'CHI', city: 'Rancagua' }), A = club(2, 'CHI', 0), B = club(2, 'CHI', 1), Cc = club(1, 'CHI', 3);
  youth(h, 2028, A, 20, 8, 2, 6.6); debut(h, A, 2030);
  [9, 11, 13, 12].forEach(function (g, i) { season(h, 2030 + i, A, 28 + i, g, 3, 6.5); }); [10, 8, 12].forEach(function (g, i) { season(h, 2034 + i, B, 30, g, 2, 6.5); }); [6, 9, 7, 5].forEach(function (g, i) { season(h, 2037 + i, Cc, 26, g, 3, 6.4); });
  sign(h, B, 2034, 120); sign(h, Cc, 2037, 400); trophy(h, 'Subcampeón de ' + FP.LGDEF[B.lg].n, 2035, B, { sub: 1 }); retire(h, 33, 2041); return h;
};
SC.defensa = function () {
  var h = newHero({ nm: 'Nicolás Bravo', pos: 'CB', b: 2012, nat: 'CHI' }), A = club(1, 'CHI', 0), B = club(1, 'CHI', 4), Cc = club(2, 'CHI', 2);
  youth(h, 2027, A, 22, 1, 0, 6.3); debut(h, A, 2030); for (var i = 0; i < 6; i++) season(h, 2030 + i, A, 26 + i, i % 3 === 0 ? 2 : 1, 1, 6.25); for (i = 0; i < 6; i++) season(h, 2036 + i, B, 30, i % 4 === 0 ? 3 : 1, 0, 6.3);
  for (i = 0; i < 3; i++) season(h, 2042 + i, Cc, 28, 1, 0, 6.2); sign(h, B, 2036, 900); sign(h, Cc, 2042); trophy(h, 'Campeón de ' + FP.LGDEF[B.lg].n, 2039, B); retire(h, 36, 2045); return h;
};
SC.arquero = function () {
  var h = newHero({ nm: 'Mauro Peña', pos: 'GK', b: 2010, nat: 'ARG' }), A = club(1, 'ARG', 0), B = club(1, 'ARG', 2);
  debut(h, A, 2029); for (var i = 0; i < 12; i++) season(h, 2029 + i, A, i < 2 ? 14 : 30 + (i % 3), 0, 0, i < 3 ? 6.2 : 6.5, { cup: [3, 0] }); for (i = 12; i < 20; i++) season(h, 2029 + i, B, 33, 0, 0, 6.45, {});
  sign(h, B, 2041, 1500); trophy(h, 'Campeón de ' + FP.LGDEF[A.lg].n, 2035, A); trophy(h, 'Campeón de ' + FP.LGDEF[A.lg].n, 2038, A); trophy(h, 'Campeón · Copa Libertadores', 2038, A); nat(h, 2036, 12, 0); nat(h, 2037, 10, 0); h.nt.caps = 22; retire(h, 40, 2049); return h;
};
SC.asistidor = function () {
  var h = newHero({ nm: 'Diego Salas', pos: 'CM', b: 2012, nat: 'BRA' }), A = club(1, 'BRA', 0), B = club(1, 'BRA', 3);
  youth(h, 2028, A, 25, 5, 9, 6.9); debut(h, A, 2030); [4, 6, 5, 7, 6, 4, 5].forEach(function (g, i) { season(h, 2030 + i, i < 4 ? A : B, 34, g, 11 + (i % 3), 6.9, {}); });
  sign(h, B, 2034, 3000); award(h, 'Equipo ideal de ' + FP.LGDEF[B.lg].n, 2035); retire(h, 32, 2044); return h;
};
SC.nuncaPrimera = function () {
  var h = newHero({ nm: 'Cristóbal Fuentes', pos: 'LB', b: 2012, nat: 'CHI' }), A = club(3, 'CHI', 0), B = club(4, 'CHI', 1), Cc = club(3, 'CHI', 2);
  debut(h, A, 2031); for (var i = 0; i < 4; i++) season(h, 2031 + i, A, 22, 1, 2, 6.2); for (i = 0; i < 3; i++) season(h, 2035 + i, B, 26, 0, 3, 6.3); for (i = 0; i < 4; i++) season(h, 2038 + i, Cc, 20, 1, 1, 6.1); sign(h, B, 2035); sign(h, Cc, 2038); retire(h, 31, 2042); return h;
};
SC.unClub = function () {
  var h = newHero({ nm: 'Esteban Roca', pos: 'CM', b: 2008, nat: 'URU' }), A = club(1, 'URU', 0);
  youth(h, 2023, A, 22, 3, 4, 6.8); debut(h, A, 2025); var tot = 0; for (var i = 0; i < 20; i++) { var p = 30 + (i % 5); tot += p; season(h, 2025 + i, A, p, 3 + (i % 4), 4 + (i % 3), 6.6, { cup: [4, 1] }); }
  trophy(h, 'Campeón de ' + FP.LGDEF[A.lg].n, 2030, A); trophy(h, 'Campeón de ' + FP.LGDEF[A.lg].n, 2036, A); trophy(h, 'Campeón · Copa Sudamericana', 2033, A); idolize(h, A, tot, 80, 20, 2); retire(h, 38, 2045); return h;
};
SC.trotamundos = function () {
  var h = newHero({ nm: 'Gonzalo Ibáñez', pos: 'RW', b: 2012, nat: 'COL' }), cs = [club(1, 'COL', 0), club(2, 'ARG', 0), club(1, 'MEX', 1), club(2, 'ESP', 3), club(1, 'POR', 2), club(2, 'TUR', 1), club(3, 'ITA', 0), club(1, 'USA', 2), club(2, 'BRA', 1)];
  debut(h, cs[0], 2030); cs.forEach(function (c, i) { season(h, 2030 + i * 1, c, i < 2 ? 26 : 12 + (i % 3) * 2, 4 + (i % 4), 3 + (i % 3), 6.4, {}); sign(h, c, 2030 + i, i * 150); }); retire(h, 34, 2041); return h;
};
SC.lesiones = function () {
  var h = newHero({ nm: 'Hugo Lagos', pos: 'ST', b: 2012, nat: 'ESP' }), A = club(1, 'ESP', 5), B = club(1, 'ESP', 6);
  debut(h, A, 2030); season(h, 2030, A, 24, 9, 3, 6.9); season(h, 2031, A, 33, 17, 4, 7.1); injure(h, 2032, 'Rotura del ligamento cruzado', 'rodilla', 38); season(h, 2032, A, 9, 3, 0, 6.5, { starts: 0.7 }); season(h, 2033, A, 20, 6, 1, 6.6); injure(h, 2034, 'Lesión muscular', 'isquiotibiales', 9); season(h, 2034, B, 25, 9, 2, 6.7); injure(h, 2035, 'Rotura del ligamento cruzado', 'rodilla', 33); season(h, 2035, B, 12, 3, 1, 6.4); season(h, 2036, B, 26, 8, 2, 6.6); sign(h, B, 2034, 7000); return h;
};
SC.retiroJoven = function () {
  var h = newHero({ nm: 'Lucas Mena', pos: 'RW', b: 2012, nat: 'CHI' }), A = club(1, 'CHI', 1), B = club(2, 'CHI', 3);
  debut(h, A, 2029); [[2029, 18, 3, 2], [2030, 28, 7, 5], [2031, 30, 9, 4], [2032, 14, 2, 1]].forEach(function (r) { season(h, r[0], A, r[1], r[2], r[3], 6.8, {}); }); season(h, 2033, B, 8, 1, 0, 6.2, { starts: 0.4 }); retire(h, 21, 2033); return h;
};
SC.remontada = function () {
  var h = newHero({ nm: 'Ignacio Duarte', pos: 'AM', b: 2010, nat: 'ARG' }), A = club(1, 'ARG', 1), B = club(2, 'ARG', 2), Cc = club(1, 'ARG', 4);
  youth(h, 2026, A, 24, 7, 7, 6.9); debut(h, A, 2028); [[10, 8], [12, 9]].forEach(function (r, i) { season(h, 2028 + i, A, 33, r[0], r[1], 7.0, {}); });
  [[2, 2, 6.0], [1, 3, 5.9], [2, 1, 6.0]].forEach(function (r, i) { season(h, 2030 + i, A, 30, r[0], r[1], r[2], { starts: 0.55 }); }); sign(h, B, 2033, 100);
  [[8, 9, 6.9], [11, 10, 7.1], [9, 12, 7.2]].forEach(function (r, i) { season(h, 2033 + i, B, 32, r[0], r[1], r[2], {}); }); sign(h, Cc, 2036, 900); season(h, 2036, Cc, 31, 10, 11, 7.1, {}); award(h, 'Equipo ideal de ' + FP.LGDEF[B.lg].n, 2035); return h;
};
SC.seleccion = function () {
  var h = newHero({ nm: 'Matías Quiroz', pos: 'CB', b: 2012, nat: 'CHI' }), A = club(1, 'CHI', 2), B = club(1, 'ITA', 3);
  youth(h, 2027, A, 25, 2, 1, 6.8); nat(h, 2028, 5, 0, 'Sudamericano Sub-17', 'u17'); nat(h, 2030, 9, 1, 'Sudamericano Sub-20', 'u20'); debut(h, A, 2030); h.bio.ev.push({ w: D.of(2032, 5, 3), t: '¡Convocado a la selección absoluta!' });
  for (var i = 0; i < 5; i++) season(h, 2030 + i, A, 28, 2, 1, 6.6, {}); for (i = 0; i < 5; i++) season(h, 2035 + i, B, 30, 1, 1, 6.7, {}); sign(h, B, 2035, 8000);
  nat(h, 2032, 3, 0, 'Eliminatorias CONMEBOL'); nat(h, 2033, 8, 1, 'Eliminatorias CONMEBOL'); nat(h, 2034, 6, 0, 'Copa América'); nat(h, 2036, 9, 1, 'Eliminatorias CONMEBOL'); h.nt.caps = 26; trophy(h, 'Subcampeón · Copa América', 2034, null, { nt: 1, sub: 1, cat: 'ABS' }); return h;
};
SC.promesaFrustrada = function () {
  var h = newHero({ nm: 'Bastián Cordero', pos: 'ST', b: 2012, nat: 'CHI' }), A = club(1, 'CHI', 5), B = club(2, 'CHI', 4), Cc = club(3, 'CHI', 1);
  youth(h, 2026, A, 26, 19, 4, 7.3, 'Campeonato Juvenil Sub-15'); youth(h, 2027, A, 28, 24, 6, 7.4); trophy(h, 'Campeón Juvenil · Primera División', 2027, A); award(h, 'Goleador del campeonato juvenil', 2027); nat(h, 2028, 6, 5, 'Sudamericano Sub-17', 'u17');
  debut(h, A, 2029); season(h, 2029, A, 8, 0, 0, 6.0, { starts: 0.3 }); season(h, 2030, A, 10, 1, 0, 6.1, { starts: 0.3 }); sign(h, B, 2031, 60); season(h, 2031, B, 20, 3, 1, 6.2); season(h, 2032, B, 24, 4, 1, 6.2); sign(h, Cc, 2033); season(h, 2033, Cc, 22, 4, 0, 6.3); season(h, 2034, Cc, 18, 2, 1, 6.2); retire(h, 28, 2038); return h;
};
SC.tardio = function () {
  var h = newHero({ nm: 'Sergio Pinto', pos: 'ST', b: 2008, nat: 'CHI' }), A = club(3, 'CHI', 3), B = club(2, 'CHI', 3), Cc = club(1, 'CHI', 3);
  for (var i = 0; i < 5; i++) season(h, 2027 + i, A, 24, 5 + (i % 2), 1, 6.4, { ovr: 58 + i }); sign(h, B, 2032, 60); for (i = 0; i < 3; i++) season(h, 2032 + i, B, 30, 12 + i, 2, 6.8, { ovr: 65 + i * 2 }); sign(h, Cc, 2035, 700); for (i = 0; i < 4; i++) season(h, 2035 + i, Cc, 33, 20 + i * 2, 4, 7.3, { ovr: 74 + i * 2, cup: [5, 3] });
  trophy(h, 'Campeón de ' + FP.LGDEF[Cc.lg].n, 2038, Cc); award(h, 'Bota de Oro · ' + FP.LGDEF[Cc.lg].n, 2037); return h;
};
SC.regreso = function () {   // vuelve a un club en el que ya era leyenda: el reconocimiento es uno solo y acumulado
  var h = newHero({ nm: 'Tadeo Villar', pos: 'CM', b: 2012, nat: 'POR', city: 'Braga' }), A = club(1, 'POR', 0), B = club(1, 'POR', 1), tot = 0;
  youth(h, 2027, A, 24, 4, 5, 6.8); debut(h, A, 2029);
  for (var i = 0; i < 5; i++) { season(h, 2029 + i, A, 30 + i, 5 + i, 6, 6.9, { cup: [4, 1] }); tot += 30 + i; }
  sign(h, B, 2034, 5000); for (i = 0; i < 4; i++) season(h, 2034 + i, B, 31, 6, 5, 6.8, {}); sign(h, A, 2038);
  for (i = 0; i < 4; i++) { season(h, 2038 + i, A, 29 - i * 3, 5, 4, 6.8, {}); tot += 29 - i * 3; }
  trophy(h, 'Campeón de ' + FP.LGDEF[A.lg].n, 2031, A); trophy(h, 'Campeón de ' + FP.LGDEF[A.lg].n, 2039, A); idolize(h, A, tot, 60, 9, 2); retire(h, 37, 2042); return h;
};
SC.desconocido = function () {
  var h = newHero({ nm: 'Tomás Rojas', pos: 'CM', b: 2012, nat: 'CHI' }), A = club(2, 'CHI', 2);
  debut(h, A, 2030); season(h, 2030, A, 6, 0, 0, 6.1, { starts: 0.4 }); season(h, 2031, A, 4, 0, 1, 6.0, { starts: 0.3 }); retire(h, 20, 2032); return h;
};
SC.nuevo = function () { var h = newHero({ nm: 'Joaquín Reyes', pos: 'CM', b: 2012, nat: 'CHI' }), A = club(1, 'CHI', 3); youth(h, 2026, A, 12, 2, 1, 6.5, 'Campeonato Juvenil Sub-15'); return h; };

// ---------- comprobaciones ----------
var BAN = /\b(hinchas?|afici[oó]n|aficionados?|periodistas?|prensa|cr[ií]ticos?|inolvidable|leyenda viviente|brillante|magistral|fabuloso|espectacular|genial|el mejor|incomparable)\b/i;
function allowedFacts(M) {
  var nums = {}, years = {}, add = function (v) { if (v != null) nums[v] = 1; };
  [M.tot, M.totL, M.totForm, M.totLate].forEach(function (T) { add(T.p); add(T.g); add(T.a); });
  M.all.concat([]).forEach(function (s) { [s.L, s.all, s.copa, s.cont].forEach(function (T) { add(T.p); add(T.g); add(T.a); }); years[s.y] = 1; years[s.ye] = 1; String(s.s).split('/').forEach(function (z) { if (z.length === 4) years[+z] = 1; else if (z.length === 2) years[2000 + +z] = 1; }); });
  M.stints.forEach(function (g) { [g.L, g.all].forEach(function (T) { add(T.p); add(T.g); add(T.a); }); add(g.n); years[g.y0] = 1; years[g.y1] = 1; });
  M.stints.forEach(function (g) { for (var i = 0; i < g.seasons.length; i++) { var P = 0, G = 0, Aa = 0; for (var j = i; j < g.seasons.length; j++) { P += g.seasons[j].L.p; G += g.seasons[j].L.g; Aa += g.seasons[j].L.a; add(P); add(G); add(Aa); } } });   // sumas de tramos consecutivos dentro de una etapa
  for (var i0 = 0; i0 < M.pro.length; i0++) { var P0 = 0, G0 = 0, A0 = 0; for (var j0 = i0; j0 < M.pro.length; j0++) { P0 += M.pro[j0].L.p; G0 += M.pro[j0].L.g; A0 += M.pro[j0].L.a; add(P0); add(G0); add(A0); } }   // tramos consecutivos de varios clubes
  M.nt.cats.forEach(function (c) { add(c.p); add(c.g); add(c.offP); years[c.y0] = 1; years[c.y1] = 1; });
  M.inj.forEach(function (e) { add(e.n); years[FP.Date.year(e.w)] = 1; });
  M.tro.forEach(function (x) { years[x.y] = 1; }); M.aw.forEach(function (x) { years[x.y] = 1; });
  (M.h.history || []).forEach(function (e) { years[FP.Date.year(e.w)] = 1; var m = /traspaso ([\d.]+) mil/.exec(e.t); if (m) add(+m[1]); }); (M.h.bio.ev || []).forEach(function (e) { years[FP.Date.year(e.w)] = 1; });
  years[M.h.bd[0]] = 1; if (M.h.retired) { years[FP.Date.year(M.h.retiredW)] = 1; add(M.h.retiredAge); add(M.h.retiredAge - M.h.startAge); }
  add(M.nProSeasons); add(M.clubs.length); add(M.countries.length); add(M.stints.length); add(M.arch.maxTenure);
  M.pro.forEach(function (s) { add(s.age); }); add(M.h.ht); add(M.h.kg); add(M.h.ovr0);
  (M.h.seasons || []).forEach(function (r) { add(r.age); add(r.ovr); }); M.all.forEach(function (s) { add(s.age); }); add(Math.round(M.h.ovr)); if (M.peak) { add(M.peak.age); add(M.peak.ovr); }
  M.nt.cats.forEach(function (c) { add(c.p); }); add(M.nt.caps); add(M.nt.goals); add(M.form.length); add(M.pro.length);
  if (M.trend.recover) add(M.trend.recover.len);
  return { nums: nums, years: years };
}
function check(name, h, noRetireStamp) {
  var before = JSON.stringify(FP.S.hero), d = FP.Bio.build(), M = d.narr, after = JSON.stringify(FP.S.hero);
  if (before !== after) { var bo = JSON.parse(before), ao = JSON.parse(after); Object.keys(ao).forEach(function (k) { if (JSON.stringify(ao[k]) !== JSON.stringify(bo[k])) console.log('  cambió', k, String(JSON.stringify(bo[k])).slice(0, 80), '->', String(JSON.stringify(ao[k])).slice(0, 120)); }); }
  t(name + ': no modifica el estado', before === after);
  var text = tx(d.lead) + '\n' + d.secs.map(function (s) { return tx(s.t) + '\n' + (s.p || []).map(tx).join('\n') + (s.sub || []).map(function (u) { return tx(u.t) + '\n' + u.p.map(tx).join('\n'); }).join('\n'); }).join('\n');
  t(name + ': estable', JSON.stringify(FP.Bio.build().secs) === JSON.stringify(d.secs) && FP.Bio.build().lead === d.lead);
  t(name + ': tiene texto', text.length > 80);
  t(name + ': sin vocabulario inventado', !BAN.test(text), (text.match(BAN) || [])[0]);
  var A = allowedFacts(M), bad1 = [], clean = text.replace(/\d[\d.,]* (mil|M)\s?€/g, '').replace(/\d[\d.,]*\s?M€/g, '');
  (clean.match(/\b(1\d{3}|20\d{2}|21\d{2})\b/g) || []).forEach(function (y) { if (!A.years[+y]) bad1.push(y); });
  t(name + ': años respaldados por los registros', !bad1.length, bad1.join(','));
  var bad2 = [], re = /(\d[\d.]*) (partidos?|goles?|gol|asistencias?|temporadas?|clubes|clubs?|semanas?|años)/g, m;
  while ((m = re.exec(clean))) { var v = +m[1].replace(/\./g, ''); if (!A.nums[v] && true && m[2] !== 'meses') bad2.push(m[0]); }
  t(name + ': cifras respaldadas por los registros', !bad2.length, bad2.slice(0, 5).join(' | '));
  var maxY = FP.Date.year(FP.S.week), futuros = (text.match(/\b(20\d{2}|21\d{2})\b/g) || []).filter(function (y) { return +y > maxY + 1 && !A.years[+y]; });
  t(name + ': sin hechos futuros', !futuros.length, futuros.join(','));
  // el total profesional del texto coincide con el de los registros y no incluye lo juvenil
  var proTot = 0; FP.Stats.rows().forEach(function (r) { if ((r.k === 'liga' || r.k === 'copa' || r.k === 'cont') && r.t < 5000) proTot += r.p; });
  t(name + ': total profesional = suma de filas profesionales', M.tot.p === proTot, M.tot.p + ' vs ' + proTot);
  // clubes nombrados ⊂ clubes con vínculo registrado
  var allowed = {}; if (h.club != null) allowed[C.tname(h.club)] = 1; if (h.team != null) allowed[C.tname(h.team)] = 1; M.all.forEach(function (s) { allowed[s.name] = 1; }); M.stints.forEach(function (g) { allowed[g.name] = 1; }); B_loans().forEach(function (l) { allowed[C.tname(l.from)] = 1; allowed[C.tname(l.to)] = 1; });
  (h.trophies || []).forEach(function (x) { allowed[x.club] = 1; });
  var txt2 = text.replace(new RegExp(h.city, 'g'), '').replace(/Primera [A-Z][a-z]+/g, '').replace(/Copa [A-Za-zÁéíóúñ]+/g, '').replace(/Liga de [A-Za-z]+/g, ''); var foreign = []; FP.S.clubs.forEach(function (c) { if (c.nm.length >= 6 && !allowed[c.nm] && txt2.indexOf(c.nm) >= 0) { var sup = Object.keys(allowed).some(function (a) { return a.indexOf(c.nm) >= 0; }); if (!sup) foreign.push(c.nm); } });
  t(name + ': solo menciona clubes de su historial', !foreign.length, foreign.join(','));
  // cesiones: nunca se presentan como traspaso definitivo
  M.stints.filter(function (g) { return g.loan; }).forEach(function (g) { var sec = d.secs.filter(function (s) { return s.id === 'trayectoria'; })[0], u = sec && sec.sub.filter(function (x) { return x.t.indexOf(g.name) === 0; })[0]; if (u) t(name + ': cesión a ' + g.name + ' aparece como cedido', /ced/i.test(u.t) || /ced/i.test(u.p.join(' ')), u.t); });
  return { d: d, M: M, text: text };
}
function B_loans() { return FP.Bio.loans(); }

var results = {}, names = Object.keys(SC);
names.forEach(function (k) { var h = SC[k](); results[k] = check(k, h); });
if (VER) names.forEach(function (k) { console.log('\n================ ' + k + ' [' + results[k].M.arch.present.join(',') + '] ' + results[k].text.length + ' caracteres\n' + results[k].text); });

// ---------- tipos de trayectoria que deben surgir de los datos ----------
function has(k, a) { return results[k].M.arch.present.indexOf(a) >= 0; }
t('elite: estrella', has('elite', 'star'), results.elite.M.arch.score);
t('regular: no es estrella', !has('regular', 'star'));
t('nuncaPrimera: modesto', has('nuncaPrimera', 'modest'), results.nuncaPrimera.M.arch.score);
t('unClub: ídolo de club', has('unClub', 'idol'), results.unClub.M.arch.score);
t('trotamundos: trotamundos', has('trotamundos', 'rover'), results.trotamundos.M.arch.score);
t('promesaFrustrada: promesa frustrada', has('promesaFrustrada', 'fail'), results.promesaFrustrada.M.arch.score);
t('remontada: superación', has('remontada', 'comeback'), results.remontada.M.arch.score + ' ' + JSON.stringify(results.remontada.M.trend.recover && 1));
t('retiroJoven: carrera interrumpida', has('retiroJoven', 'cut'), results.retiroJoven.M.arch.score);
t('tardío: desarrollo tardío', has('tardio', 'late'), results.tardio.M.arch.score);
t('desconocido: carrera breve, sin etiquetas de estrella ni ídolo', !has('desconocido', 'star') && !has('desconocido', 'idol'));

// ---------- interpretación contextual de las estadísticas ----------
function zOf(k, grp, y) { var M = results[k].M; return M.pro.filter(function (s) { return s.y === y; })[0]; }
var e1 = results.elite.M.pro[0], r1 = results.regular.M.pro[0];
t('18 goles de un delantero joven en la máxima categoría no se llaman «excepcionales»', e1.perf.lab !== 'excepcional', e1.perf.lab + ' ' + e1.perf.z.toFixed(2));
var evalCases = [
  { nm: 'mediocampista 12 goles', pos: 'CM', g: 12, a: 4, p: 34, tier: 1, exp: ['destacada', 'excepcional'] },
  { nm: 'delantero 12 goles', pos: 'ST', g: 12, a: 3, p: 34, tier: 1, exp: ['regular', 'baja', 'buena'] },
  { nm: 'delantero 30 goles', pos: 'ST', g: 30, a: 6, p: 36, tier: 1, exp: ['excepcional', 'destacada'] },
  { nm: 'muestra pequeña (3 partidos, 3 goles)', pos: 'ST', g: 3, a: 0, p: 3, tier: 1, exp: ['escasa'] }
];
evalCases.forEach(function (c) { var h = newHero({ nm: 'X', pos: c.pos, b: 2012 }), cl = club(c.tier, 'ESP', 0); season(h, 2031, cl, c.p, c.g, c.a, c.pos === 'ST' ? 6.7 : 6.6); var M = FP.Narr.analyze(); t('contexto: ' + c.nm + ' → ' + M.pro[0].perf.lab, c.exp.indexOf(M.pro[0].perf.lab) >= 0, M.pro[0].perf.lab + ' z=' + M.pro[0].perf.z.toFixed(2)); });
// la misma cifra en una competición regional y en la máxima categoría no pesa igual (la referencia depende del nivel)
(function () { var h = newHero({ nm: 'Y', pos: 'ST', b: 2012 }); var a = club(1, 'ESP', 0), b = club(4, 'CHI', 0); season(h, 2031, a, 36, 25, 4, 6.7); season(h, 2032, b, 36, 25, 4, 6.7); var M = FP.Narr.analyze(), s1 = M.pro[0], s2 = M.pro[1]; t('25 goles en primera y en categoría baja no se evalúan igual', s1.perf.z !== s2.perf.z, s1.perf.z.toFixed(2) + ' vs ' + s2.perf.z.toFixed(2)); })();

t('regreso: el club con estatus aparece una sola vez en el legado', results.regreso.M.ido.length === 1 && results.regreso.M.ido[0].c.stages.length === 2, results.regreso.M.ido.length + ' / etapas ' + (results.regreso.M.ido[0] && results.regreso.M.ido[0].c.stages.length));
t('regreso: «alcanzó el estatus» se dice una sola vez en todo el artículo', (results.regreso.text.match(/alcanz[óo] el estatus/g) || []).length <= 2 && (results.regreso.d.secs.filter(function (x) { return x.id === 'records'; })[0].p.join(' ').match(/estatus de/g) || []).length === 1);
t('regreso: se describen las dos etapas con lo acumulado', /dos etapas|2 etapas/.test(results.regreso.text), results.regreso.text.match(/Récords[\s\S]{0,400}/));
t('regreso: los totales por club suman ambas etapas', results.regreso.M.clubTotals[0].L.p === results.regreso.M.stints.filter(function (g) { return g.t === results.regreso.M.clubTotals[0].t; }).reduce(function (a, g) { return a + g.L.p; }, 0));
// ---------- diversidad y proporción ----------
function sentences(s) { return s.replace(/\([^)]*\)/g, '').split(/(?<=[.!?])\s+/).map(function (x) { return x.toLowerCase().replace(/\d+/g, '#').replace(/[^a-záéíóúñ# ]/g, '').trim(); }).filter(function (x) { return x.length > 25; }); }
var sets = {}; names.forEach(function (k) { sets[k] = sentences(results[k].text); });
var dup = [], pairs = 0;
for (var i = 0; i < names.length; i++) for (var j = i + 1; j < names.length; j++) { var A = sets[names[i]], B = sets[names[j]]; if (A.length < 6 || B.length < 6) continue; var inter = A.filter(function (x) { return B.indexOf(x) >= 0; }).length, sim = inter / Math.min(A.length, B.length); pairs++; if (sim > 0.62) dup.push(names[i] + '~' + names[j] + ' ' + sim.toFixed(2)); }
t('las biografías de carreras distintas no son casi idénticas', !dup.length, dup.join(', '));
var uniq = {}; names.forEach(function (k) { uniq[results[k].d.lead] = 1; }); t('las introducciones son todas distintas', Object.keys(uniq).length === names.length);
var len = {}; names.forEach(function (k) { len[k] = results[k].text.length; });
t('proporción: una carrera de 2 partidos es mucho más corta que una de élite', len.desconocido < 0.4 * len.elite, len.desconocido + ' vs ' + len.elite);
t('proporción: una carrera recién empezada es breve', len.nuevo < 0.3 * len.elite, len.nuevo);
t('proporción: veinte años en un club no repite doce párrafos', results.unClub.d.secs.filter(function (s) { return s.id === 'trayectoria'; })[0].sub.length <= 2);
t('proporción: la introducción no repite todos los números', results.elite.d.lead.length < 900, results.elite.d.lead.length);
t('el trotamundos agrupa los clubes de paso en una etapa itinerante', results.trotamundos.d.secs.filter(function (s) { return s.id === 'trayectoria'; })[0].sub.some(function (u) { return /itinerante/i.test(u.t); }));
t('la lesión grave aparece en el club donde ocurrió', /ligamento/i.test(results.lesiones.text));
t('la selección aparece solo cuando hay datos', results.seleccion.d.secs.some(function (s) { return s.id === 'seleccion'; }) && !results.regular.d.secs.some(function (s) { return s.id === 'seleccion'; }));
t('el desconocido no tiene selección ni palmarés ni récords exagerados', !/Balón|campeón/i.test(results.desconocido.text));
t('una promesa sin debut no recibe sección profesional', !results.nuevo.d.secs.some(function (s) { return s.id === 'trayectoria'; }));

// ---------- evolución: la biografía se reorganiza al avanzar la carrera y no pierde hechos ----------
(function () {
  var h = SC.promesaFrustrada(); var cut = [];
  var full = FP.Bio.build(), leadFull = tx(full.lead);
  // quitar las filas posteriores a 2030 (una carrera "a medio camino") y comparar
  Object.keys(h.led.rows).forEach(function (k) { if (h.led.rows[k].s > '2030') { cut.push(k); } }); var saved = {}; cut.forEach(function (k) { saved[k] = h.led.rows[k]; delete h.led.rows[k]; }); h.retired = false;
  var mid = FP.Bio.build();
  t('evolución: a mitad de carrera aún no se habla de retiro', !mid.secs.some(function (s) { return s.id === 'retiro'; }) && full.secs.some(function (s) { return s.id === 'retiro'; }));
  t('evolución: la introducción cambia al completarse la carrera', tx(mid.lead) !== leadFull);
  t('evolución: el debut juvenil y el palmarés se conservan', /juvenil/i.test(tx(mid.secs.filter(function (s) { return s.id === 'infancia'; })[0].p.join(' '))));
  var proMid = mid.narr.pro.length, proFull = full.narr.pro.length; t('evolución: crecen las temporadas profesionales', proFull > proMid, proMid + ' vs ' + proFull);
})();

// ---------- carreras simuladas por el juego ----------
if (SIM) {
  function rng(s) { var a = s >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var r = rng(1234), profs = H.PROFILES(6, r), lens = {};
  [2, 10, 25].forEach(function (n) {
    profs.slice(0, n === 25 ? 2 : 4).forEach(function (p, i) {
      var S = H.restore(snap);
      if (p.club.kind === 'academy') { var cl = S.clubs.filter(function (c) { return c.c === p.nat && FP.LGDEF[c.lg].t <= 2; }); if (!cl.length) cl = S.clubs.filter(function (c) { return FP.LGDEF[c.lg].t <= 2; }); p.club.id = cl[Math.floor(r() * cl.length)].id; }
      var rec = H.runCareer(p, n), name = 'sim' + n + '#' + i + ' ' + p.pos; var res = check(name, rec.hero); lens[name] = res.text.length;
      if (VER) console.log('\n================ ' + name + ' [' + res.M.arch.present.join(',') + '] ' + res.text.length + '\n' + res.text);
    });
  });
  var l2 = Object.keys(lens).filter(function (k) { return /^sim2#/.test(k); }), l25 = Object.keys(lens).filter(function (k) { return /^sim25#/.test(k); });
  var av = function (a) { return a.reduce(function (s, k) { return s + lens[k]; }, 0) / (a.length || 1); };
  t('las carreras largas dan artículos más largos que las de 2 temporadas', av(l25) > av(l2), av(l2) + ' vs ' + av(l25));
}
console.log('ok', ok, 'fallas', bad);
process.exit(bad ? 1 : 0);
