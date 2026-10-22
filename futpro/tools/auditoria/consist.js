var H = require('' + require('path').join(__dirname, '..', '..') + '/tests/harness.js'), FP = H.FP;
var snap = H.buildWorld(21), S = H.restore(snap);
function rng(s) { var a = s >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
var prof = H.PROFILES(1, rng(5))[0]; prof.pos = 'ST';
var rec = H.runCareer(prof, 8), h = rec.hero;
var rows = FP.Stats.rows(), by = {}; rows.forEach(function (r) { by[r.k] = by[r.k] || { p: 0, g: 0, a: 0, min: 0 }; by[r.k].p += r.p; by[r.k].g += r.g; by[r.k].a += r.a; by[r.k].min += r.min; });
console.log('h.tot (acumulado de clubes oficiales):', JSON.stringify({ ap: h.tot.ap, g: h.tot.g, a: h.tot.a, min: h.tot.min }));
console.log('libro por clase:', JSON.stringify(by));
var clubSum = ['liga', 'copa', 'cont', 'juv', 'amat'].reduce(function (s, k) { var b = by[k] || { p: 0, g: 0, a: 0 }; return { p: s.p + b.p, g: s.g + b.g, a: s.a + b.a }; }, { p: 0, g: 0, a: 0 });
console.log('libro liga+copa+cont+juv+amat:', JSON.stringify(clubSum));
var ss = h.seasons.reduce(function (s, x) { return { ap: s.ap + x.ap, g: s.g + x.g, a: s.a + x.a }; }, { ap: 0, g: 0, a: 0 }); console.log('suma de h.seasons:', JSON.stringify(ss), '+ temporada en curso', JSON.stringify({ ap: h.season.ap, g: h.season.g }));
console.log('selección: h.nt', JSON.stringify({ caps: h.nt.caps, goals: h.nt.goals }), 'libro abs', JSON.stringify(by.abs || {}));
console.log('ledger rows con p>0 y min==0:', rows.filter(function (r) { return r.p > 0 && r.min === 0; }).length);
