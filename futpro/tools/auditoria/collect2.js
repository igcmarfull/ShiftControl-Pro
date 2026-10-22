// mercado y reputación: node collect2.js semilla posiciones temporadas salida.jsonl [raiz]
var root = process.argv[6] || '' + require('path').join(__dirname, '..', '..') + '';
var H = require(root + '/tests/harness.js'), FP = H.FP, fs = require('fs');
var seed = +process.argv[2], poss = process.argv[3].split(','), seasons = +process.argv[4], out = process.argv[5];
function rng(s) { var a = s >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
var snap = H.buildWorld(seed), r = rng(seed * 31 + 7), fd = fs.openSync(out, 'w'), cur = null, lastClub = null;
function ctxClub(id) { var S = FP.S, c = S.clubs[id]; if (!c) return null; var l = FP.LGDEF[c.lg]; return { id: id, nm: c.nm, c: c.c, st: Math.round(c.st), q: l.q, t: l.t, lg: c.lg }; }
var add0 = FP.Market.addOffer;
FP.Market.addOffer = function (o) {
  var res = add0.apply(this, arguments);
  try { var S = FP.S, h = S.hero, ss = h.season || {}; fs.writeSync(fd, JSON.stringify({ k: 'offer', car: cur, w: S.week, age: FP.Hero.age(), ovr: h.ovr, pot: Math.round(h.pot), val: FP.Market.heroValue(), rep: h.rep ? { loc: Math.round(h.rep.loc), nat: Math.round(h.rep.nat), int: Math.round(h.rep.int) } : null, tk: h.tk, from: h.club != null ? ctxClub(h.club) : null, to: o.club != null ? ctxClub(o.club) : null, type: o.type, fee: o.fee, wage: o.wage, role: o.role, why: o.why || '', ap: ss.ap, g: ss.g, a: ss.a, rt: ss.rn ? +(ss.rs / ss.rn).toFixed(2) : null, nat: h.nat, nt: h.nt ? h.nt.caps : 0, aw: (h.awards || []).length, tro: (h.trophies || []).length }) + '\n'); } catch (e) { }
  return res;
};
var ew0 = FP.Game.endWeek;
FP.Game.endWeek = function () {
  var r0 = ew0.apply(this, arguments);
  try { var S = FP.S, h = S.hero; if (h.club !== lastClub) { fs.writeSync(fd, JSON.stringify({ k: 'move', car: cur, w: S.week, age: FP.Hero.age(), ovr: h.ovr, from: lastClub != null ? ctxClub(lastClub) : null, to: h.club != null ? ctxClub(h.club) : null, tk: h.tk, rep: h.rep ? { loc: Math.round(h.rep.loc), nat: Math.round(h.rep.nat), int: Math.round(h.rep.int) } : null, tot: { ap: h.tot.ap, g: h.tot.g } }) + '\n'); lastClub = h.club; }
    if (S.week % 26 === 0 && h.tk !== 'amat') fs.writeSync(fd, JSON.stringify({ k: 'snap', car: cur, w: S.week, age: FP.Hero.age(), ovr: h.ovr, club: h.club != null ? ctxClub(h.club) : null, rep: h.rep ? { loc: Math.round(h.rep.loc * 10) / 10, nat: Math.round(h.rep.nat * 10) / 10, int: Math.round(h.rep.int * 10) / 10 } : null, tot: { ap: h.tot.ap, g: h.tot.g, a: h.tot.a }, val: FP.Market.heroValue(), nt: h.nt ? h.nt.caps : 0, shot: Math.round(FP.Hero.view(0, 0).shotSkill()), fin: Math.round(h.at.fin), rem: Math.round(h.at.rem), pas: Math.round(h.at.pas), pos: h.pos, st: h.club != null ? Math.round(FP.S.clubs[h.club].st) : null }) + '\n'); } catch (e) { }
  return r0;
};
poss.forEach(function (pos, i) {
  var S = H.restore(snap), prof = H.PROFILES(1, r)[0]; prof.pos = pos; prof.nm = 'M' + i;
  if (prof.club.kind === 'academy') { var cl = S.clubs.filter(function (c) { return c.c === prof.nat && FP.LGDEF[c.lg].t <= 2; }); if (!cl.length) cl = S.clubs.filter(function (c) { return FP.LGDEF[c.lg].t <= 2; }); prof.club.id = cl[Math.floor(r() * cl.length)].id; }
  cur = seed + ':' + i + ':' + pos; lastClub = null;
  var rec = H.runCareer(prof, seasons);
  fs.writeSync(fd, JSON.stringify({ k: 'end', car: cur, pos: pos, nat: prof.nat, ovr: rec.ovr, pot: rec.pot, age: rec.finalAge, tot: rec.tot, tier: rec.maxTier, q: rec.maxLeagueQ }) + '\n');
  console.error(cur, 'listo');
});
