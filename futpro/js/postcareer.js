/* FUTPRO — fin de carrera: legado, homenaje de despedida y vida posterior (entrenador, comentarista, representante).
   La vida posterior es una simulación simplificada por temporada: sirve para dar continuidad, no replica el detalle del juego de campo. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, Dec = FP.Dec, Sim = FP.Sim;
  var P = FP.Post = {};

  P.ensure = function () { var h = FP.S && FP.S.hero; if (!h) return null; if (!h.post) h.post = { legacy: null, tribute: { st: 'none' }, path: null, lic: 0, agentLic: false, exp: 0, hist: [], income: 0 }; return h.post; };

  // ---------- legado ----------
  P.LABELS = [[80, 'Leyenda del fútbol'], [62, 'Ídolo de una generación'], [44, 'Figura destacada'], [26, 'Jugador de carrera sólida'], [0, 'Carrera discreta']];
  P.legacy = function () {
    var h = FP.S.hero, tot = h.tot, tro = h.trophies.filter(function (t) { return !t.sub; }).length, aw = h.awards || [], bo = aw.filter(function (a) { return a.nm === 'Balón de Oro'; }).length;
    var peak = Math.max.apply(null, h.prog.map(function (p) { return p[1]; })), caps = h.nt ? h.nt.caps : 0, goals = tot.g, years = (h.retiredAge || FP.Hero.age()) - h.startAge;
    var byClub = {}; (h.seasons || []).forEach(function (s) { if (!s.club || s.club === '—') return; var c = byClub[s.club] = byClub[s.club] || { nm: s.club, ap: 0, g: 0, y: 0 }; c.ap += s.ap; c.g += s.g; c.y++; });
    var clubs = Object.keys(byClub).map(function (k) { return byClub[k]; }).sort(function (a, b) { return b.ap - a.ap; });
    var score = (peak - 58) * 1.1 + Math.min(tro, 15) * 2.2 + bo * 12 + Math.min(aw.length - bo, 15) * 1 + Math.min(caps, 100) * 0.16 + Math.min(goals, 500) * 0.035 + Math.min(years, 20) * 0.7;
    score = Math.round(U.clamp(score, 0, 100));
    var label = P.LABELS.filter(function (l) { return score >= l[0]; })[0][1];
    return { score: score, label: label, ap: tot.ap, g: goals, a: tot.a, trophies: tro, awards: aw.length, bo: bo, caps: caps, ntGoals: h.nt ? h.nt.goals : 0, peak: peak, years: years, clubs: clubs, top: clubs[0] || null, money: h.money };
  };
  P.onRetire = function (auto) {
    var S = FP.S, h = S.hero, p = P.ensure();
    p.legacy = P.legacy();
    var lg = p.legacy, opts = [];
    if (lg.top && lg.score >= 22) opts.push({ k: 'club', label: 'Partido de homenaje en ' + lg.top.nm, hint: 'Tu club histórico (' + lg.top.ap + ' partidos) te despide con una ceremonia.' });
    if (lg.caps >= 20 && lg.score >= 35) opts.push({ k: 'seleccion', label: 'Despedida con la selección', hint: lg.caps + ' partidos con tu país: un amistoso en tu honor.' });
    opts.push({ k: 'privado', label: 'Despedida íntima', hint: 'Una cena con familia y amigos; sin ceremonia pública.' });
    p.tribute = { st: 'pend' };
    Dec.add({ kind: 'retiro', uniq: 'tributo', title: 'Tu despedida del fútbol', text: 'Te retiras como «' + lg.label + '» (legado ' + lg.score + '/100). ¿Cómo quieres despedirte?', opts: opts, def: opts[0].k, exp: 8, data: {} });
    h.history = h.history || []; h.history.push({ w: S.week, t: 'Se retira del fútbol a los ' + h.retiredAge + ' años (legado: ' + lg.label + ').' });
  };
  Dec.handlers.retiro = function (k) {
    var S = FP.S, h = S.hero, p = P.ensure(), lg = p.legacy; if (!lg) return { ok: true, msg: '' };
    var att = Math.round(6000 + lg.score * 420 + (k === 'seleccion' ? 6000 : 0)), msg;
    if (k === 'privado') { p.tribute = { st: 'done', k: k, note: 'Te despides en privado, rodeado de tu gente.' }; msg = 'Te despides en privado.'; }
    else {
      var where = k === 'club' ? lg.top.nm : 'la selección';
      p.tribute = { st: 'done', k: k, att: att, where: where, note: 'Homenaje en ' + where + ' ante ' + att.toLocaleString('es-CL') + ' espectadores.' };
      lg.score = Math.min(100, lg.score + 2); lg.label = P.LABELS.filter(function (l) { return lg.score >= l[0]; })[0][1];
      if (h.soc) h.soc.fame = (h.soc.fame || 0) + 6;
      msg = p.tribute.note;
    }
    h.history.push({ w: S.week, t: p.tribute.note }); FP.Sim.news(h.nm + ': ' + p.tribute.note, 'hero', 2);
    return { ok: true, msg: msg };
  };

  // ---------- caminos ----------
  P.PATHS = {
    coach: { nm: 'Entrenador', d: 'Sacas las licencias y dirigís desde las formativas hasta el primer equipo. Tu legado y tus estudios acortan el camino.' },
    tv: { nm: 'Comentarista', d: 'Entras a la televisión como colaborador y vas ganando audiencia según tu fama y tu carisma.' },
    agent: { nm: 'Representante', d: 'Sacas la licencia de agente y representas a jóvenes talentos; cobras comisión de sus contratos.' },
    none: { nm: 'Vida tranquila', d: 'Te dedicas a tu familia y a tus inversiones.' }
  };
  P.LIC = ['Sin licencia', 'Licencia Nivel 1 (formativas)', 'Licencia Nivel 2 (asistente / divisiones menores)', 'Licencia Pro (primer equipo)'];
  var COURSE = [null, { w: 26, c: 8 }, { w: 52, c: 20 }, { w: 52, c: 45 }];
  P.eduFactor = function () { var e = FP.S.hero.life && FP.S.hero.life.edu; return e ? (e.degree ? 0.8 : e.grad ? 1 : 1.15) : 1; };
  P.choose = function (k) {
    var h = FP.S.hero, p = P.ensure(); if (!h.retired) return { ok: false, msg: 'Aún estás en actividad.' };
    if (!P.PATHS[k]) return { ok: false, msg: 'Camino inválido.' };
    var lg = p.legacy || P.legacy();
    p.path = { k: k, since: FP.S.week, seasons: [], titles: 0, inc: 0 };
    if (k === 'tv') { p.path.aud = Math.round(lg.score * 0.5); p.path.lvl = 0; }
    if (k === 'agent') p.path.clients = [];
    h.history.push({ w: FP.S.week, t: 'Después del fútbol: ' + P.PATHS[k].nm.toLowerCase() + '.' });
    return { ok: true, msg: 'Nuevo camino: ' + P.PATHS[k].nm + '.' };
  };
  P.startCourse = function (kind) {
    var h = FP.S.hero, p = P.ensure(), pa = p.path; if (!pa || pa.course) return { ok: false, msg: 'Ya estás cursando.' };
    var lvl, def;
    if (kind === 'agent') { if (p.agentLic) return { ok: false, msg: 'Ya tienes la licencia.' }; def = { w: 26, c: 5 }; lvl = 0; }
    else { lvl = p.lic + 1; if (lvl > 3) return { ok: false, msg: 'Ya tienes la licencia máxima.' }; if (lvl === 2 && p.exp < 1) return { ok: false, msg: 'Necesitas al menos 1 temporada de experiencia.' }; if (lvl === 3 && p.exp < 2) return { ok: false, msg: 'Necesitas al menos 2 temporadas de experiencia.' }; def = COURSE[lvl]; }
    if (h.money < def.c) return { ok: false, msg: 'No tienes fondos para el curso (' + FP.fmt.money(def.c) + ').' };
    FP.Contracts.pay(-def.c, 'inversion', kind === 'agent' ? 'Licencia de agente' : 'Curso: ' + P.LIC[lvl]);
    pa.course = { kind: kind, lvl: lvl, left: Math.round(def.w * P.eduFactor()) };
    return { ok: true, msg: 'Comienzas el curso (' + pa.course.left + ' semanas).' };
  };
  P.pay = function (amt, why) { if (!amt) return; var h = FP.S.hero, p = P.ensure(); FP.Contracts.pay(Math.round(amt), 'post', why); p.income += Math.round(amt); if (p.path) p.path.inc += Math.round(amt); };
  var NEED = { 1: 76, 2: 64, 3: 54, 4: 46, 5: 40 }, WAGE = { 1: 2000, 2: 700, 3: 250, 4: 90, 5: 40 }, ROLEM = { youth: 0.2, assist: 0.35, head: 1 }, ROLEN = { youth: 'Entrenador de juveniles', assist: 'Asistente técnico', head: 'Director técnico' }, ROLEX = { youth: -14, assist: -8, head: 0 };
  P.ROLEN = ROLEN;
  function tierOf(club) { return Math.min(5, FP.LGDEF[club.lg].t); }
  P.wageEst = function (pl) { var cw = FP.DATA.countries[(FP.S.clubs[pl.c] || {}).c || 'CHI']; return C.wage(C.value(pl.o, pl.pt, C.age(pl)), cw ? cw.w : 0.5); };

  P.offerJobs = function () {
    var S = FP.S, h = S.hero, p = P.ensure(), pa = p.path, lg = p.legacy; if (!pa || pa.k !== 'coach' || pa.job || p.lic < 1) return;
    var ex = (lg.clubs || []).map(function (c) { return FP.Game.clubByName(c.nm); }).filter(Boolean);
    var pool = S.clubs.filter(function (c) { return c.c === h.nat || ex.indexOf(c) >= 0; }), cand = [];
    function pick(role, tMin, tMax) { var l = pool.filter(function (c) { var t = tierOf(c); return t >= tMin && t <= tMax; }); l.sort(function (a, b) { return (ex.indexOf(b) >= 0) - (ex.indexOf(a) >= 0) || R() - 0.5; }); if (l[0]) cand.push({ club: l[0].id, role: role }); }
    if (p.lic === 1) { pick('youth', 1, 4); pick('youth', 3, 5); }
    else if (p.lic === 2) { pick('assist', 2, 4); pick('head', 4, 5); pick('youth', 1, 3); }
    else { pick('head', p.exp >= 4 || lg.score >= 62 ? 1 : 2, 3); pick('head', 3, 5); pick('assist', 1, 2); }
    if (!cand.length) return;
    Dec.add({ kind: 'post', uniq: 'job' + S.week, title: 'Ofertas para dirigir', text: 'Te llegan propuestas por tu trayectoria y tus licencias.', opts: cand.map(function (c, i) { return { k: 'j' + i, label: ROLEN[c.role] + ' · ' + C.tname(c.club), hint: 'Sueldo estimado ' + FP.fmt.money(Math.round(WAGE[tierOf(S.clubs[c.club])] * ROLEM[c.role])) + ' al año.' }; }).concat([{ k: 'no', label: 'Seguir esperando', hint: 'Ninguna por ahora.' }]), def: 'no', exp: 20, data: { cand: cand } });
  };
  P.offerClients = function () {
    var S = FP.S, p = P.ensure(), pa = p.path; if (!pa || pa.k !== 'agent' || !p.agentLic) return;
    var max = 3 + Math.floor((pa.rep || 0) / 25); if (pa.clients.length >= max) return;
    var have = pa.clients.map(function (c) { return c.pid; });
    var l = S.pl.filter(function (q) { return q && q.i > 0 && q.c >= 0 && q.c < 5000 && have.indexOf(q.i) < 0 && C.age(q) >= 16 && C.age(q) <= 21 && q.pt >= 66; }).sort(function (a, b) { return b.pt - a.pt + (R() - 0.5) * 14; }).slice(0, 3);
    if (!l.length) return;
    Dec.add({ kind: 'post', uniq: 'cli' + S.week, title: 'Jóvenes que buscan representante', text: 'Tres promesas piden que los representes. Cobras comisión de sus contratos.', opts: l.map(function (q) { return { k: 'c' + q.i, label: q.n + ' · ' + C.POS_ES[q.p] + ' · ' + C.age(q) + ' años', hint: 'Nivel ' + q.o + ', potencial estimado ' + Math.round(q.pt) + '. Juega en ' + C.tname(q.c) + '.' }; }).concat([{ k: 'no', label: 'No por ahora', hint: '' }]), def: 'no', exp: 20, data: { ids: l.map(function (q) { return q.i; }) } });
  };
  Dec.handlers.post = function (k, d) {
    var S = FP.S, h = S.hero, p = P.ensure(), pa = p.path; if (!pa) return { ok: true, msg: '' };
    if (/^j\d/.test(k)) { var c = d.data.cand[+k.slice(1)]; pa.job = { club: c.club, role: c.role, since: S.week }; h.history.push({ w: S.week, t: 'Firma como ' + ROLEN[c.role].toLowerCase() + ' de ' + C.tname(c.club) + '.' }); return { ok: true, msg: 'Aceptas ser ' + ROLEN[c.role].toLowerCase() + ' de ' + C.tname(c.club) + '.' }; }
    if (/^c\d/.test(k)) { var pid = +k.slice(1), q = S.pl[pid]; if (q) { pa.clients.push({ pid: pid, since: S.week }); h.history.push({ w: S.week, t: 'Pasas a representar a ' + q.n + '.' }); return { ok: true, msg: 'Representas a ' + q.n + '.' }; } }
    if (k === 'disculparse') { pa.aud = Math.max(0, pa.aud - 1); return { ok: true, msg: 'Pides disculpas en el programa: el asunto se enfría.' }; }
    if (k === 'sostener') { var up = R() < 0.5; pa.aud = U.clamp(pa.aud + (up ? 6 : -7), 0, 100); return { ok: true, msg: up ? 'Tu postura divide, pero sube la audiencia.' : 'Tu postura cae mal: baja la audiencia.' }; }
    return { ok: true, msg: '' };
  };

  // ---------- paso del tiempo ----------
  P.yearTick = function () {
    var S = FP.S, h = S.hero, p = P.ensure(), pa = p.path, lg = p.legacy, label = FP.Market.seasonLabel();
    if (h.money > 0) P.pay(Math.min(h.money * 0.02, 400), 'Rendimiento de inversiones');
    if (!pa) return;
    if (pa.k === 'coach' && pa.job) {
      var club = S.clubs[pa.job.club], t = tierOf(club), ability = 38 + lg.score * 0.22 + p.lic * 8 + p.exp * 1.2 + U.norm() * 6;
      var perf = ability - (NEED[t] + ROLEX[pa.job.role]) + U.norm() * 5, res = perf >= 12 ? 'Campeón' : perf >= 6 ? 'Zona alta' : perf >= -2 ? 'Mitad de tabla' : perf >= -9 ? 'Lucha por la permanencia' : 'Despedido';
      p.exp++; pa.seasons.push({ y: label, club: pa.job.club, role: pa.job.role, res: res });
      P.pay(WAGE[t] * ROLEM[pa.job.role], 'Sueldo como ' + ROLEN[pa.job.role].toLowerCase());
      if (res === 'Campeón') { pa.titles++; h.history.push({ w: S.week, t: 'Campeón como ' + ROLEN[pa.job.role].toLowerCase() + ' de ' + C.tname(pa.job.club) + '.' }); }
      if (res === 'Despedido') { h.history.push({ w: S.week, t: 'Despedido de ' + C.tname(pa.job.club) + '.' }); pa.job = null; }
      else if (perf >= 8 && p.lic >= pa.job.role.length) { /* ascenso se resuelve en las ofertas */ }
    } else if (pa.k === 'tv') {
      pa.aud = U.clamp(pa.aud * 0.9 + lg.score * 0.12 + R() * 6 + (FP.S.hero.life && FP.S.hero.life.edu.degree ? 2 : 0), 0, 100);
      pa.lvl = pa.aud >= 70 ? 3 : pa.aud >= 50 ? 2 : pa.aud >= 30 ? 1 : 0;
      P.pay([20, 60, 180, 500][pa.lvl] * (1 + lg.score / 100), 'Contrato de televisión');
      pa.seasons.push({ y: label, lvl: pa.lvl, aud: Math.round(pa.aud) });
      if (R() < 0.25) Dec.add({ kind: 'post', uniq: 'pol' + S.week, title: 'Polémica en un programa', text: 'Una opinión tuya sobre un jugador se vuelve viral.', opts: [{ k: 'disculparse', label: 'Pedir disculpas', hint: 'Se enfría el asunto.' }, { k: 'sostener', label: 'Sostener tu postura', hint: 'Puede subir o bajar tu audiencia.' }], def: 'disculparse', exp: 10 });
    } else if (pa.k === 'agent' && p.agentLic) {
      var tot = 0, keep = [];
      pa.clients.forEach(function (c) { var q = S.pl[c.pid]; if (!q || q.c === -2) return; keep.push(c); tot += P.wageEst(q) * 0.07; if (q.o >= 72) pa.rep = (pa.rep || 0) + 2; else pa.rep = (pa.rep || 0) + 0.5; });
      pa.clients = keep; P.pay(tot, 'Comisiones de representados'); pa.seasons.push({ y: label, n: keep.length, com: Math.round(tot) });
    }
  };
  P.weekly = function (w) {
    var S = FP.S, h = S.hero; if (!h || !h.retired) return;
    var p = P.ensure(), pa = p.path;
    Dec.weekly(w);
    if (pa && pa.course && --pa.course.left <= 0) {
      var cr = pa.course; pa.course = null;
      if (cr.kind === 'agent') { p.agentLic = true; FP.Hero.msg('Obtienes la licencia de agente.', 'ok'); } else { p.lic = cr.lvl; FP.Hero.msg('Obtienes la ' + P.LIC[cr.lvl].toLowerCase() + '.', 'ok'); }
    }
    var d = w - h.retiredW;
    if (d > 0 && d % 52 === 0) P.yearTick();
    if (d > 0 && d % 52 === 26) { P.offerJobs(); P.offerClients(); }
  };
  P.migrate = function () { var h = FP.S && FP.S.hero; if (h && h.retired && !h.post) { P.ensure().legacy = P.legacy(); h.post.tribute = { st: 'none' }; } };

  var retire0 = FP.Events.retire;
  FP.Events.retire = function (auto) { var h = FP.S.hero, was = h && h.retired; var r = retire0.apply(this, arguments); if (h && h.retired && !was) { try { P.onRetire(auto); } catch (e) { if (window.console) console.warn('post', e); } } return r; };
  var prevW = Sim.weeklyExtra;
  Sim.weeklyExtra = function (w) { if (prevW) prevW(w); try { P.weekly(w); } catch (e) { if (window.console) console.warn('post', e); } };
})();
