/* FUTPRO — resumen de temporada, metas de la temporada y logros de carrera.
   El resumen se arma con el registro de la partida (estadísticas, palmarés, lesiones, decisiones, historial); las metas y los logros
   dan dirección a la carrera con recompensas pequeñas (moral y fama). Todo se guarda en h.rv (resúmenes) y h.gl (metas y logros). */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, Hero = FP.Hero, Sim = FP.Sim, Ev = FP.Events;
  var G = FP.Season = {};

  G.ensure = function () {
    var S = FP.S, h = S && S.hero; if (!h) return null;
    if (!h.rv) h.rv = { w0: h.startW || 0, list: [], seen: 0 };
    if (!h.gl) h.gl = { ach: {}, season: null, flags: {}, hist: [] };
    if (!h.gl.season) G.newGoals();
    return h;
  };
  function inWin(w) { var h = FP.S.hero; return w >= h.rv.w0; }
  function onField(h) { return h.tk === 'pro' || h.tk === 'loan'; }

  // ---------- logros de carrera ----------
  var INTL = /Libertadores|Sudamericana|Champions|Europa League|Conference|Concacaf|Copa del Mundo|Mundial|Eurocopa|Copa Am[eé]rica/i;
  function cnt(h, f) { return h.trophies.filter(function (t) { return !t.sub && f(t); }).length; }
  G.ACH = [
    { id: 'debut_pro', nm: 'Debut profesional', d: 'Juega tu primer partido como profesional.', t: function (h) { return !!h.gl.flags.firstPro; } },
    { id: 'debut_u18', nm: 'Precoz', d: 'Debuta como profesional antes de los 18 años.', t: function (h) { return !!(h.gl.flags.firstPro && h.gl.flags.firstPro.age < 18); } },
    { id: 'gol_pro', nm: 'Primer gol profesional', d: 'Marca tu primer gol como profesional.', t: function (h) { return !!h.gl.flags.firstGoal; } },
    { id: 'hat', nm: 'Triplete', d: 'Marca tres goles en un partido oficial.', t: function (h) { return !!h.gl.flags.hat; } },
    { id: 'g10', nm: 'Diez goles en una temporada', d: 'Llega a 10 goles en una misma temporada.', t: function (h) { return h.season.g >= 10 || h.gl.flags.maxSeasonG >= 10; }, p: function (h) { return [Math.max(h.season.g, h.gl.flags.maxSeasonG || 0), 10]; } },
    { id: 'g20', nm: 'Veinte goles en una temporada', d: 'Llega a 20 goles en una misma temporada.', t: function (h) { return Math.max(h.season.g, h.gl.flags.maxSeasonG || 0) >= 20; }, p: function (h) { return [Math.max(h.season.g, h.gl.flags.maxSeasonG || 0), 20]; } },
    { id: 'g100', nm: 'Centenario goleador', d: '100 goles en tu carrera.', t: function (h) { return h.tot.g >= 100; }, p: function (h) { return [h.tot.g, 100]; } },
    { id: 'ap100', nm: '100 partidos', d: 'Disputa 100 partidos.', t: function (h) { return h.tot.ap >= 100; }, p: function (h) { return [h.tot.ap, 100]; } },
    { id: 'ap300', nm: '300 partidos', d: 'Disputa 300 partidos.', t: function (h) { return h.tot.ap >= 300; }, p: function (h) { return [h.tot.ap, 300]; } },
    { id: 'titulo', nm: 'Primer título', d: 'Gana un título con tu equipo.', t: function (h) { return cnt(h, function () { return true; }) >= 1; } },
    { id: 'liga', nm: 'Campeón de liga', d: 'Gana una liga de primera división.', t: function (h) { return cnt(h, function (t) { return /^Campeón de /.test(t.nm); }) >= 1; } },
    { id: 'intl', nm: 'Gloria internacional', d: 'Gana un título internacional.', t: function (h) { return cnt(h, function (t) { return INTL.test(t.nm); }) >= 1; } },
    { id: 'ovr70', nm: 'Media 70', d: 'Alcanza una media de 70.', t: function (h) { return h.ovr >= 70; }, p: function (h) { return [h.ovr, 70]; } },
    { id: 'ovr80', nm: 'Media 80', d: 'Alcanza una media de 80.', t: function (h) { return h.ovr >= 80; }, p: function (h) { return [h.ovr, 80]; } },
    { id: 'ovr90', nm: 'Media 90', d: 'Alcanza una media de 90.', t: function (h) { return h.ovr >= 90; }, p: function (h) { return [h.ovr, 90]; } },
    { id: 'primera', nm: 'Primera división', d: 'Juega en una primera división.', t: function (h) { return !!h.gl.flags.top; } },
    { id: 'extranjero', nm: 'Jugar fuera', d: 'Juega en un club de otro país.', t: function (h) { return !!h.gl.flags.abroad; } },
    { id: 'seleccion', nm: 'Selección absoluta', d: 'Debuta con la selección absoluta.', t: function (h) { return !!h.gl.flags.absCap; } },
    { id: 'mundial', nm: 'Jugar un Mundial', d: 'Disputa un partido de una Copa del Mundo.', t: function (h) { return !!h.gl.flags.wc; } },
    { id: 'nota75', nm: 'Temporada de nota alta', d: 'Termina una temporada con nota media 7.5 o más (mín. 15 partidos).', t: function (h) { return (h.gl.flags.bestRt || 0) >= 7.5; } },
    { id: 'balon', nm: 'Balón de Oro', d: 'Gana el Balón de Oro.', t: function (h) { return (h.awards || []).some(function (a) { return a.nm === 'Balón de Oro'; }); } }
  ];
  G.REWARD = { mor: 8, fame: 3 };

  // seguimiento de hitos por partido
  var after0 = Hero.afterMatch;
  Hero.afterMatch = function (prep, res) {
    var r = after0.apply(this, arguments); var h = FP.S.hero, hm = res && res.hero; if (!h || !hm || !hm.played) return r; G.ensure();
    var f = h.gl.flags, comp = prep.comp, official = !(comp.kind === 'F' || prep.f.fr), age = Hero.age();
    if (official && onField(h) && !(comp.cat)) { if (!f.firstPro) f.firstPro = { age: age, w: FP.S.week }; if (hm.g > 0 && !f.firstGoal) f.firstGoal = { age: age, w: FP.S.week }; }
    if (official && hm.g >= 3) f.hat = FP.S.week;
    if (comp.cat === 'ABS' || (comp.nat && !comp.cat)) { f.absCap = f.absCap || FP.S.week; if (/Copa del Mundo|Mundial/i.test(comp.nm || '')) f.wc = f.wc || FP.S.week; }
    return r;
  };
  G.checkAchievements = function (w) {
    var h = FP.S.hero; G.ensure();
    var f = h.gl.flags; if (h.club != null) { var cl = FP.S.clubs[h.club]; if (cl && onField(h)) { if (FP.LGDEF[cl.lg].t === 1) f.top = f.top || w; if (cl.c !== h.nat) f.abroad = f.abroad || w; } }
    G.ACH.forEach(function (a) {
      if (h.gl.ach[a.id]) return;
      var ok = false; try { ok = a.t(h); } catch (e) { }
      if (!ok) return;
      h.gl.ach[a.id] = w; h.mor = U.clamp(h.mor + G.REWARD.mor, 0, 100); if (h.soc) h.soc.fame = (h.soc.fame || 0) + G.REWARD.fame;
      Hero.msg('Logro desbloqueado: ' + a.nm + '.', 'ok');
    });
  };

  // ---------- metas de la temporada ----------
  G.newGoals = function () {
    var S = FP.S, h = S.hero, last = h.seasons.length ? h.seasons[h.seasons.length - 1] : null, grp = C.POS_GRP[h.pos], role = onField(h) ? Hero.roleLabel() : '';
    var star = /Estrella|indiscutido|^Titular$/.test(role);
    var baseG = grp === 'F' ? (star ? 9 : 5) : grp === 'M' ? (star ? 4 : 2) : (star ? 2 : 1);
    var tg = Math.min(32, Math.max(1, Math.round(last && last.ap >= 8 ? Math.max(baseG * 0.7, last.g * 1.15 + 0.5) : baseG)));
    var tp = star ? 24 : (role === 'Rotación' ? 14 : onField(h) ? 10 : 12);
    var tr = Math.round(U.clamp(last && last.rt ? last.rt + 0.1 : 6.5, 6.2, 7.6) * 10) / 10;
    var items = [{ id: 'gol', t: tg, nm: 'Marcar ' + tg + (tg === 1 ? ' gol' : ' goles') }, { id: 'pj', t: tp, nm: 'Jugar ' + tp + ' partidos' }, { id: 'nota', t: tr, nm: 'Nota media de ' + tr.toFixed(1) + ' o más (mín. 8 partidos)' }, { id: 'sano', t: 1, nm: 'Terminar la temporada sin lesiones graves (4 semanas o más)' }];
    if (grp === 'D') items = [items[1], items[2], items[3], { id: 'gol', t: 1, nm: 'Marcar al menos un gol' }];
    var pick = items.slice(0, 3); if (R() < 0.35 && items[3]) pick = [items[0], items[1], items[3]];
    h.gl.season = { y: FP.Market.seasonLabel(), w0: S.week, items: pick.map(function (x) { return { id: x.id, t: x.t, nm: x.nm, ok: null }; }) };
  };
  G.progress = function (it) {
    var h = FP.S.hero, s = h.season, w0 = h.gl.season.w0;
    if (it.id === 'gol') return { v: s.g, max: it.t, ok: s.g >= it.t };
    if (it.id === 'pj') return { v: s.ap, max: it.t, ok: s.ap >= it.t };
    if (it.id === 'nota') { var rt = s.rn >= 8 ? s.rs / s.rn : 0; return { v: rt, max: it.t, ok: s.rn >= 8 && rt >= it.t, dec: 1 }; }
    var bad = (h.med ? h.med.hist : []).some(function (e) { return e.w >= w0 && e.n >= 4; });
    return { v: bad ? 0 : 1, max: 1, ok: !bad, flag: 1 };
  };
  G.evalGoals = function () {
    var h = FP.S.hero, g = h.gl.season, done = 0; if (!g) return null;
    g.items.forEach(function (it) { var p = G.progress(it); it.ok = !!p.ok; it.v = p.v; if (it.ok) done++; });
    var res = { y: g.y, items: g.items.map(function (x) { return { nm: x.nm, ok: x.ok, v: x.v, t: x.t, id: x.id }; }), done: done, n: g.items.length };
    if (done) { h.mor = U.clamp(h.mor + 6 * done + (done === g.items.length ? 4 : 0), 0, 100); if (h.soc) h.soc.fame = (h.soc.fame || 0) + done; }
    return res;
  };

  // ---------- resumen de temporada ----------
  G.headline = function (r) {
    if (r.trophies.length) return 'Año de títulos';
    if (r.ap < 6) return 'Año de poco protagonismo';
    return r.rt >= 7.2 ? 'Gran temporada' : r.rt >= 6.6 ? 'Buena temporada' : r.rt >= 6.0 ? 'Temporada irregular' : 'Año difícil';
  };
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
  G.build = function (s, goals) {
    var S = FP.S, h = S.hero, w0 = h.rv.w0, now = S.week, prev = h.rv.list.length ? h.rv.list[0] : null;
    var win = function (e) { return e.w >= w0 && e.w <= now; };
    var log = h.log.filter(function (m) { return m.w >= w0 && m.off; });
    var bestRt = log.filter(function (m) { return m.rt; }).sort(function (a, b) { return b.rt - a.rt; })[0], bestG = log.filter(function (m) { return m.g; }).sort(function (a, b) { return b.g - a.g || b.rt - a.rt; })[0];
    var inj = (h.med ? h.med.hist : []).filter(win), dec = (h.dec ? h.dec.done : []).filter(function (e) { return win(e) && !e.auto; }).slice(-3);
    var mv = (h.history || []).filter(function (e) { return win(e) && /^(Firma|Fichaje|Ascenso|Se retira|Debuta|Renueva|Cesión|Prueba)/i.test(e.t); }).slice(-3);
    var rank = h.rvLast || null; h.rvLast = null;
    var r = { y: s.y, w: now, club: s.club, age: s.age, tk: h.tk, ap: s.ap, st: 0, min: s.min, g: s.g, a: s.a, rt: s.rt, yc: s.yc, rc: s.rc, ovr0: prev ? prev.ovr1 : h.ovr0, ovr1: h.ovr,
      caps: h.nt.caps - (h.rv.caps0 || 0), rank: rank, trophies: uniq(h.trophies.filter(function (t) { return !t.sub && win(t); }).map(function (t) { return t.nm; })), awards: (h.awards || []).filter(win).map(function (a) { return a.nm; }),
      inj: inj.map(function (e) { return { nm: e.nm, n: e.n }; }), dec: uniq(dec.map(function (e) { return e.title; })), moves: mv.map(function (e) { return e.t; }),
      best: bestRt ? { c: bestRt.c, s: bestRt.s, r: bestRt.r, rt: bestRt.rt, o: bestRt.o } : null, goal: bestG && bestG.g >= 2 ? { c: bestG.c, s: bestG.s, g: bestG.g, o: bestG.o } : null, goals: goals };
    r.head = G.headline(r); r.text = G.story(r); return r;
  };
  G.story = function (r) {
    var t = [], d = r.ovr1 - r.ovr0;
    t.push('En ' + r.y + ' jugaste ' + r.ap + (r.ap === 1 ? ' partido' : ' partidos') + ' en ' + r.club + (r.rank ? ' (' + (r.rank.ch ? 'campeón' : r.rank.pos + '.º de ' + r.rank.n) + ')' : '') + ', con ' + r.g + (r.g === 1 ? ' gol, ' : ' goles, ') + r.a + (r.a === 1 ? ' asistencia' : ' asistencias') + (r.rt ? ' y una nota media de ' + r.rt.toFixed(1) : '') + '.');
    t.push(d > 0 ? 'Tu media subió de ' + r.ovr0 + ' a ' + r.ovr1 + '.' : d < 0 ? 'Tu media bajó de ' + r.ovr0 + ' a ' + r.ovr1 + '.' : 'Tu media se mantuvo en ' + r.ovr1 + '.');
    if (r.trophies.length) t.push('Ganaste ' + r.trophies.slice(0, 2).join(' y ') + '.'); else if (r.awards.length) t.push('Recibiste: ' + r.awards.slice(0, 2).join(' y ') + '.');
    if (r.inj.length) t.push('Las lesiones te costaron ' + r.inj.reduce(function (s, e) { return s + e.n; }, 0) + ' semanas (' + r.inj.map(function (e) { return e.nm.toLowerCase(); }).slice(0, 2).join(', ') + ').');
    if (r.best) t.push('Tu mejor partido fue por ' + r.best.c + ' contra ' + (r.best.o != null ? C.tname(r.best.o) : 'el rival') + ' (' + r.best.s + ', nota ' + r.best.rt.toFixed(1) + ').');
    if (r.caps > 0) t.push('Sumaste ' + r.caps + (r.caps === 1 ? ' partido' : ' partidos') + ' con la selección.');
    if (r.dec.length) t.push('Decisiones que marcaron el año: ' + r.dec.join('; ') + '.');
    if (r.goals) t.push('Cumpliste ' + r.goals.done + ' de ' + r.goals.n + ' metas de la temporada.');
    return t;
  };

  var se0 = Ev.heroSeasonEnd;
  Ev.heroSeasonEnd = function (src) {
    var h = FP.S.hero; if (!h || h.retired) return se0.apply(this, arguments);
    G.ensure();
    var s = h.season, snap = { ap: s.ap, st: s.st, min: s.min, g: s.g, a: s.a, yc: s.yc, rc: s.rc, rs: s.rs, rn: s.rn };
    var goals = G.evalGoals(); h.gl.flags.maxSeasonG = Math.max(h.gl.flags.maxSeasonG || 0, snap.g);
    if (snap.ap >= 15 && snap.rn) h.gl.flags.bestRt = Math.max(h.gl.flags.bestRt || 0, snap.rs / snap.rn);
    G.checkAchievements(FP.S.week);
    var r = se0.apply(this, arguments);
    var row = h.seasons.length ? h.seasons[h.seasons.length - 1] : null;
    if (row && (snap.ap || snap.st) && row.ap === snap.ap) {
      var rev = G.build(row, goals); rev.st = snap.st; h.rv.list.unshift(rev); if (h.rv.list.length > 40) h.rv.list.length = 40;
      h.rv.w0 = FP.S.week; h.rv.caps0 = h.nt.caps;
      Hero.msg('Resumen de ' + rev.y + ': ' + rev.head + '. Míralo en "Resumen de temporada".', 'i');
    }
    G.newGoals();
    return r;
  };
  // posición final en la liga (se guarda antes de que el cierre de liga procese al jugador)
  var olc0 = Sim.onLeagueClosed;
  Sim.onLeagueClosed = function (comp, entry) {
    var h = FP.S.hero;
    if (h && !h.retired && (h.tk === 'pro' || h.tk === 'loan') && comp.teams.indexOf(h.team) >= 0) h.rvLast = { pos: entry.tab.indexOf(h.team) + 1, n: entry.tab.length, ch: entry.ch === h.team, lg: comp.lg };
    return olc0 ? olc0.apply(this, arguments) : undefined;
  };
  G.weekly = function (w) { var h = FP.S.hero; if (!h || h.retired) return; G.ensure(); if (w % 2 === 0) G.checkAchievements(w); };
  G.migrate = function () { G.ensure(); };
  var weekEnd0 = Hero.weekEnd;
  Hero.weekEnd = function () { var r = weekEnd0.apply(this, arguments); try { G.weekly(FP.S.week); } catch (e) { if (window.console) console.warn('season', e); } return r; };
})();
