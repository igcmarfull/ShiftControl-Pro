/* FUTPRO — epílogo: récords personales, tu generación, historia final y Salón de la Fama.
   Todo se calcula a partir del registro de la partida (estadísticas, palmarés, historial); no guarda estado propio salvo la inducción. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, P = FP.Post;
  var E = FP.Epilogue = {};

  E.records = function () {
    var S = FP.S, h = S.hero, by = {};
    FP.Stats.rows().forEach(function (r) { if (FP.Stats.isNT(r.k)) return; var k = r.s + '|' + r.t, s = by[k] = by[k] || { y: r.s, t: r.t, tn: r.tn, p: 0, g: 0, a: 0, rs: 0, rn: 0, min: 0 }; s.p += r.p; s.g += r.g; s.a += r.a; s.rs += r.rs; s.rn += r.rn; s.min += r.min; });
    var seas = Object.keys(by).map(function (k) { return by[k]; }), pick = function (f, ok) { var b = null; seas.forEach(function (s) { if ((!ok || ok(s)) && (!b || f(s) > f(b))) b = s; }); return b; };
    var pk = h.prog.reduce(function (b, x) { return !b || x[1] > b[1] ? x : b; }, null), age = pk ? Math.floor((pk[0] - h.b) / 52.1775) : null;
    var clubs = {}, ctry = {}; seas.forEach(function (s) { if (s.t != null && s.t < 5000) { clubs[s.t] = 1; var c = S.clubs[s.t]; if (c) ctry[c.c] = 1; } });
    var tro = h.trophies.filter(function (t) { return !t.sub; }), tn = {}; tro.forEach(function (t) { tn[t.nm] = (tn[t.nm] || 0) + 1; });
    var aw = h.awards || [], bo = aw.filter(function (a) { return a.nm === 'Balón de Oro'; }).length;
    return { goals: pick(function (s) { return s.g; }, function (s) { return s.g > 0; }), rating: pick(function (s) { return s.rs / s.rn; }, function (s) { return s.p >= 10 && s.rn; }), apps: pick(function (s) { return s.p; }), assists: pick(function (s) { return s.a; }, function (s) { return s.a > 0; }),
      peak: pk ? { o: pk[1], age: age } : null, clubs: Object.keys(clubs).length, countries: Object.keys(ctry).length, trophies: tro.length, trophyNames: Object.keys(tn).sort(function (a, b) { return tn[b] - tn[a]; }).slice(0, 5).map(function (k) { return { nm: k, n: tn[k] }; }), balon: bo, awards: aw.length, caps: h.nt.caps, ntGoals: h.nt.goals, seasons: seas.length };
  };
  E.hof = function () {
    var h = FP.S.hero, p = h.post, lg = p && p.legacy; if (!h.retired || !lg) return { tier: 'none' };
    var yr = D.year(h.retiredW) + 5;
    return lg.score >= 62 ? { tier: 'hof', year: yr, done: D.year(FP.S.week) >= yr } : lg.score >= 44 ? { tier: 'mencion', year: yr } : { tier: 'none' };
  };
  E.generation = function () {
    var S = FP.S, h = S.hero, y0 = D.year(h.startW), y1 = D.year(h.retiredW || S.week), seen = {}, out = [];
    (S.hist.awards || []).forEach(function (a) { var y = parseInt(String(a.y).slice(0, 4), 10); if (y < y0 || y > y1 + 1 || a.id === 0 || seen[a.id]) return; seen[a.id] = 1; out.push({ n: a.n, ovr: a.ovr, y: a.y, club: a.club }); });
    return out.slice(0, 6);
  };
  E.story = function () {
    var S = FP.S, h = S.hero, p = P.ensure(), lg = p.legacy || P.legacy(), r = E.records(), t = [], first = FP.Stats.rows().slice(-1)[0];
    t.push(h.nm + ' empezó a jugar a los ' + h.startAge + ' años' + (first ? ' en ' + (first.t != null && first.t < 5000 ? C.tname(first.t) : first.tn) : '') + '. Con el tiempo pasaría por ' + r.clubs + (r.clubs === 1 ? ' club' : ' clubes') + (r.countries > 1 ? ' de ' + r.countries + ' países' : '') + ' en ' + r.seasons + ' temporadas.');
    if (r.goals) t.push('Su mejor año goleador fue ' + r.goals.y + (r.goals.t < 5000 ? ' en ' + C.tname(r.goals.t) : '') + ': ' + r.goals.g + ' goles en ' + r.goals.p + ' partidos.' + (r.rating ? ' Su temporada más pareja llegó en ' + r.rating.y + ', con una nota media de ' + (r.rating.rs / r.rating.rn).toFixed(2) + '.' : ''));
    if (r.peak) t.push('Alcanzó su techo a los ' + r.peak.age + ' años, con una media de ' + r.peak.o + '.');
    if (r.trophies || r.balon) t.push('Su vitrina suma ' + r.trophies + (r.trophies === 1 ? ' título' : ' títulos') + (r.balon ? ' y ' + r.balon + (r.balon === 1 ? ' Balón de Oro' : ' Balones de Oro') : '') + (r.trophyNames.length ? ' (' + r.trophyNames.slice(0, 3).map(function (x) { return x.nm; }).join(', ') + ')' : '') + '.');
    if (r.caps) t.push('Defendió a su país en ' + r.caps + ' partidos y marcó ' + r.ntGoals + ' goles con la selección.');
    t.push('Se retiró a los ' + h.retiredAge + ' años. La historia lo recuerda como «' + lg.label + '» (legado ' + lg.score + '/100).' + (p.tribute && p.tribute.note ? ' ' + p.tribute.note : ''));
    var pa = p.path; if (pa) {
      var k = pa.k;
      if (k === 'coach') t.push('Después del fútbol se hizo entrenador' + (p.lic ? ' (' + P.LIC[p.lic].toLowerCase() + ')' : '') + (pa.titles ? ' y ganó ' + pa.titles + (pa.titles === 1 ? ' título' : ' títulos') : '') + '.');
      else if (k === 'tv') t.push('Se convirtió en comentarista de televisión' + (pa.lvl >= 2 ? ', una voz reconocida del fútbol' : '') + '.');
      else if (k === 'agent') if (!pa.clients.length) t.push('Intentó abrirse camino como representante.'); else t.push('Como representante llegó a manejar la carrera de ' + pa.clients.length + (pa.clients.length === 1 ? ' jugador' : ' jugadores') + (pa.clients.filter(function (c) { return c.star; }).length ? ', varios de ellos figuras' : '') + '.');
      else if (k === 'dir') t.push('Fue director deportivo' + (pa.titles ? ' y ganó ' + pa.titles + ' título(s) con su gestión' : '') + '.');
      else if (k === 'pres') t.push('Presidió un club con su propia fortuna' + (pa.titles ? ' y lo llevó al título' : '') + '.');
      else if (k === 'sel') t.push('Dirigió a la selección juvenil de su país' + (pa.titles ? ' y ganó ' + pa.titles + ' torneo(s)' : '') + '.');
    }
    var pr = FP.Mentor && FP.Mentor.get(), q = pr && FP.Mentor.player(), hist = p.protHist || [];
    if (q) t.push((pr.kind === 'hijo' ? 'Su hijo ' : 'Su protegido ') + q.n + ' llegó a una media de ' + Math.max(pr.max, q.o) + (q.c >= 0 && S.clubs[q.c] ? ' y hoy juega en ' + S.clubs[q.c].nm : '') + '.');
    else if (hist.length) { var x = hist[hist.length - 1], q2 = S.pl[x.pid]; if (q2) t.push('Guió a ' + q2.n + ' hasta una media máxima de ' + x.max + '.'); }
    var hf = E.hof(); if (hf.tier === 'hof') t.push(hf.done ? 'En ' + hf.year + ' fue inducido al Salón de la Fama del Fútbol.' : 'Es candidato firme al Salón de la Fama: se decide en ' + hf.year + '.'); else if (hf.tier === 'mencion') t.push('Recibió una mención de honor en el Salón de la Fama.');
    return t;
  };
  E.text = function () {
    var h = FP.S.hero, lg = (P.ensure().legacy || P.legacy());
    return h.nm + ' — ' + lg.label + '\n\n' + E.story().join('\n\n') + '\n\nGenerado por FUTPRO.';
  };
  // inducción al Salón de la Fama (5 años después del retiro)
  var pw0 = P.weekly;
  P.weekly = function (w) {
    pw0.apply(this, arguments);
    var h = FP.S.hero, p = h && h.post; if (!h || !h.retired || !p || p.hofDone) return;
    var hf = E.hof(); if (hf.tier === 'hof' && D.year(w) >= hf.year) { p.hofDone = true; h.history.push({ w: w, t: 'Es inducido al Salón de la Fama del Fútbol.' }); FP.Hero.msg('¡Entras al Salón de la Fama del Fútbol!', 'ok'); FP.Sim.news(h.nm + ' es inducido al Salón de la Fama del Fútbol.', 'hero', 3); }
  };
})();
