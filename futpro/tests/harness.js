/* FUTPRO — arnés de pruebas en Node (sin navegador). Uso: node tests/careers.js [temporadas] [carreras]
   Carga los mismos archivos que index.html (sin interfaz), construye un mundo, y simula carreras completas
   con un "jugador automático" que responde a ofertas con reglas simples. */
global.window = global;
var path = require('path'), root = path.join(__dirname, '..');
['js/util.js', 'data/world.js', 'js/core.js', 'js/comp.js', 'js/match.js', 'js/sim.js', 'js/hero.js', 'js/market.js', 'js/events.js', 'js/tournaments.js', 'js/social.js', 'js/youth.js', 'js/scouting.js', 'js/tryouts.js', 'js/decisions.js', 'js/medical.js', 'js/staff.js', 'js/tactics.js', 'js/life.js', 'js/postcareer.js', 'js/coaching.js', 'js/agency.js', 'js/mentor.js', 'js/paths2.js', 'js/epilogue.js', 'js/season.js', 'js/clubs.js', 'js/redes.js', 'js/dinero.js', 'js/callups.js', 'js/bio.js', 'js/contracts.js', 'js/nteams.js', 'js/stats.js', 'js/game.js', 'js/storage.js'].forEach(function (f) {
  try { require(path.join(root, f)); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND' || String(e.message).indexOf(f) < 0) throw e; }
});
var FP = global.FP, D = FP.Date;

exports.FP = FP;
exports.buildWorld = function (seed, y0) {
  FP.Date.setStart(y0 || 2026);
  var S = FP.Core.newWorld(seed); FP.Sim.startSeasons();
  var g = 0; while (S.week < 0 && g++ < 800) FP.Sim.step();
  return JSON.stringify(FP.Store.pack());
};
exports.restore = function (snap) { FP.Store.unpack(JSON.parse(snap)); return FP.S; };

// reglas del jugador automático (parecidas a las de una persona razonable)
exports.respond = function (h) {
  var S = FP.S, M = FP.Market;
  h.offers.slice().forEach(function (o) {
    var ok = false, cur = h.club != null ? S.clubs[h.club] : null;
    if (o.type === 'trial' || o.type === 'academy' || o.type === 'pro' || o.type === 'event' || o.type === 'renew' || o.type === 'amateur') ok = true;
    else if (o.type === 'transfer') ok = !cur || S.clubs[o.club].st >= cur.st - 2 || h.tk === 'free';
    else if (o.type === 'loan') ok = h.tk === 'pro';
    if (o.type === 'amateur' && h.tk !== 'free') ok = false;
    try { M.respond(o.id, ok); } catch (e) { M.respond(o.id, false); }
  });
};
// el jugador automático pide pruebas cuando es juvenil sin club profesional
exports.seekTrials = function (h) {
  var S = FP.S, M = FP.Market, age = FP.Hero.age();
  if ((h.tk !== 'amat' && h.tk !== 'free') || age > 19 || (h.trials && h.trials.length)) return;
  if (S.week % 13 !== 0) return;
  var cc = M.heroCountry(), best = null, bp = 0;
  S.clubs.forEach(function (c) { if (c.c !== cc || FP.LGDEF[c.lg].t > 3) return; var d = M.trialDifficulty(c.id); if (d.p > bp && d.p < 0.9 || (!best && d.p > 0.05)) { bp = d.p; best = c; } });
  if (best) M.requestTrial(best.id);
};
// simula una carrera: devuelve un resumen con las métricas relevantes
exports.runCareer = function (opts, seasons) {
  var S = FP.S, h = FP.Game.startCareer(opts), M = FP.Market;
  var rec = { name: opts.nm, age0: FP.Hero.age(), pos: opts.pos, nat: opts.nat, start: opts.club.kind, pro: false, proWeek: null, maxTier: 9, amatWeeks: 0, freeWeeks: 0, acadWeeks: 0, proWeeks: 0, offers: 0, ntCats: {}, ntCaps: 0, ntGoals: 0, trophies: 0, ovrByAge: {}, abroad: false, firstProAge: null, maxOvr: 0, clubs: [], maxLeagueQ: 0 };
  var end = S.week + Math.round(seasons * 52.1775), n0 = 0;
  while (S.week < end && !h.retired) {
    FP.Game.beginWeek(); var g = 0; while (FP.Game.hasPending() && g++ < 20) FP.Game.playPending();
    FP.Game.endWeek();
    exports.respond(h); exports.seekTrials(h);
    var tk = h.tk; rec.offers = Math.max(rec.offers, 0);
    if (tk === 'amat') rec.amatWeeks++; else if (tk === 'free') rec.freeWeeks++; else if (tk === 'academy') rec.acadWeeks++; else { rec.proWeeks++; if (!rec.pro) { rec.pro = true; rec.proWeek = S.week; rec.firstProAge = FP.Hero.age(); } }
    if (h.club != null) { var lg = FP.LGDEF[S.clubs[h.club].lg]; rec.maxTier = Math.min(rec.maxTier, lg.t); rec.maxLeagueQ = Math.max(rec.maxLeagueQ, lg.q); if (S.clubs[h.club].c !== h.nat) rec.abroad = true; }
    if (h.nt && h.nt.cat) rec.ntCats[h.nt.cat] = 1;
    var a = FP.Hero.age(); rec.ovrByAge[a] = h.ovr; rec.maxOvr = Math.max(rec.maxOvr, h.ovr);
  }
  rec.ntCaps = h.nt.caps; rec.ntGoals = h.nt.goals; rec.trophies = h.trophies.filter(function (t) { return !t.sub; }).length;
  rec.finalTk = h.tk; rec.finalAge = FP.Hero.age(); rec.ovr = h.ovr; rec.pot = Math.round(h.pot);
  rec.tot = JSON.parse(JSON.stringify(h.tot)); rec.seasons = h.seasons.length;
  rec.retired = h.retired; rec.hero = h;
  return rec;
};
exports.PROFILES = function (n, rng) {
  var pos = ['ST', 'ST', 'LW', 'RW', 'AM', 'CM', 'CM', 'DM', 'CB', 'CB', 'LB', 'RB'], nats = ['CHI', 'CHI', 'CHI', 'ARG', 'BRA', 'ESP', 'URU', 'COL', 'MEX', 'ENG'], out = [];
  var C = FP.Core, ATT = C.ATTRS;
  for (var i = 0; i < n; i++) {
    var age = 12 + Math.floor(rng() * 2), p = pos[Math.floor(rng() * pos.length)], nat = nats[Math.floor(rng() * nats.length)];
    var academy = rng() < 0.35, prodigy = rng() < 0.10;
    // como el asistente de creación: hasta 30 puntos extra repartidos (máx. +12 por atributo), sesgados al puesto
    var w = C.WN[p], keys = Object.keys(w).sort(function (a, b) { return w[b] - w[a]; }), extra = {}, left = 24 + Math.floor(rng() * 7);
    while (left > 0) { var k = rng() < 0.7 ? keys[Math.floor(rng() * 5)] : ATT[Math.floor(rng() * ATT.length)], add = Math.min(left, 1 + Math.floor(rng() * 6), 12 - (extra[k] || 0)); if (add <= 0) { if (Object.keys(extra).length > 14) break; continue; } extra[k] = (extra[k] || 0) + add; left -= add; }
    var o = { nm: 'Bot' + i, nat: nat, city: '', age: age, h: 165 + Math.floor(rng() * 20), kg: 55 + Math.floor(rng() * 15), pos: p, foot: 'R', style: ['fisico', 'tecnico', 'veloz', 'cerebral', 'killer', 'solido'][Math.floor(rng() * 6)], extra: extra, prodigy: prodigy, club: academy ? { kind: 'academy' } : { kind: 'amat', name: 'Club Local ' + i, st: 44 + Math.floor(rng() * 10) } };
    if (prodigy) { o.ovrTarget = 55 + Math.floor(rng() * 5); }
    out.push(o);
  }
  return out;
};
