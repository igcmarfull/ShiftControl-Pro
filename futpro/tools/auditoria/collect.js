// recoge un registro por partido del protagonista: node collect.js semilla posiciones(coma) temporadas salida.jsonl
var root = '' + require('path').join(__dirname, '..', '..') + '';
var H = require(root + '/tests/harness.js'), FP = H.FP, fs = require('fs');
var seed = +process.argv[2], poss = process.argv[3].split(','), seasons = +process.argv[4], out = process.argv[5];
function rng(s) { var a = s >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
var snap = H.buildWorld(seed), r = rng(seed * 31 + 7), fd = fs.openSync(out, 'w'), cur = null;
var am0 = FP.Hero.afterMatch;
FP.Hero.afterMatch = function (prep, res) {
  var r0 = am0.apply(this, arguments);
  try {
    var S = FP.S, h = S.hero, hm = res.hero, rec = h.log[0], comp = prep.comp, cls = FP.Stats.classOf(comp);
    var mine = prep.home ? res.hs : res.as, opp = prep.home ? res.as : res.hs, mid = prep.mine, club = S.clubs[mid], oc = S.clubs[prep.opp];
    var lg = club ? FP.LGDEF[club.lg] : null, olg = oc ? FP.LGDEF[oc.lg] : null;
    fs.writeSync(fd, JSON.stringify({ car: cur, w: S.week, age: FP.Hero.age(), pos: h.pos, ovr: h.ovr, cls: cls, tk: h.tk, lgq: lg ? lg.q : null, tier: lg ? lg.t : null, olgq: olg ? olg.q : null, st: club ? Math.round(club.st) : null, ost: oc ? Math.round(oc.st) : null,
      home: prep.home ? 1 : 0, mine: mine, opp: opp, pl: hm && hm.played ? 1 : 0, sub: hm && hm.subIn ? 1 : 0, min: hm ? hm.min : 0, g: hm ? hm.g : 0, a: hm ? hm.a : 0, sh: hm ? hm.sh : 0, xg: hm ? +(hm.xg || 0).toFixed(3) : 0, rt: hm && hm.rating ? +hm.rating.toFixed(1) : null, nat: club ? club.c : null, hn: h.nat }) + '\n');
  } catch (e) { console.error('collect', e.message); }
  return r0;
};
poss.forEach(function (pos, i) {
  var S = H.restore(snap), prof = H.PROFILES(1, r)[0]; prof.pos = pos; prof.nm = 'A' + i;
  // reparte atributos hacia el puesto como el asistente de creación
  if (prof.club.kind === 'academy') { var cl = S.clubs.filter(function (c) { return c.c === prof.nat && FP.LGDEF[c.lg].t <= 2; }); if (!cl.length) cl = S.clubs.filter(function (c) { return FP.LGDEF[c.lg].t <= 2; }); prof.club.id = cl[Math.floor(r() * cl.length)].id; }
  cur = seed + ':' + i + ':' + pos;
  var rec = H.runCareer(prof, seasons);
  fs.writeSync(fd, JSON.stringify({ end: cur, pos: pos, nat: prof.nat, ovr: rec.ovr, pot: rec.pot, age: rec.finalAge, tot: rec.tot, tier: rec.maxTier, q: rec.maxLeagueQ, abroad: !!rec.abroad }) + '\n');
  console.error(cur, 'listo', rec.finalAge, rec.ovr, JSON.stringify(rec.tot).slice(0, 120));
});
