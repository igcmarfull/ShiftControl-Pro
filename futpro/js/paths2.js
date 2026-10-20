/* FUTPRO — más caminos tras el retiro: director deportivo, presidente de club y seleccionador juvenil.
   Cada año hay una decisión de gestión que modifica de verdad al club (plantel, cantera) o a la selección. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, Dec = FP.Dec, Sim = FP.Sim, P = FP.Post;
  var X = FP.Paths2 = {};

  P.PATHS.dir = { nm: 'Director deportivo', d: 'Armas el proyecto deportivo de un club: apuestas por la cantera, por figuras o por el equilibrio y ves cómo cambia el plantel.' };
  P.PATHS.pres = { nm: 'Presidente de club', d: 'Presides un club con tu propio dinero: estadio, academia y refuerzos cambian su economía y su nivel.' };
  P.PATHS.sel = { nm: 'Seleccionador juvenil', d: 'Diriges una selección juvenil de tu país: tus decisiones mueven el nivel de la generación.' };
  X.ROLE = { dir: 'Director deportivo', pres: 'Presidente', sel: 'Seleccionador Sub-20' };
  X.isX = function (k) { return k === 'dir' || k === 'pres' || k === 'sel'; };
  X.q = function () { return U.clamp((P.ability() - 40) / 35, 0.3, 1.6); };         // calidad de gestión
  function tierOf(c) { return Math.min(5, FP.LGDEF[c.lg].t); }
  function squadBoost(club, n, amt) {
    var r = (FP.S.ro[club.id] || []).slice().sort(function (a, b) { return b.o - a.o; }).slice(0, n);
    r.forEach(function (p) { p.o = Math.min(Math.max(p.o, p.pt), Math.round(p.o + amt)); if (p.pt < p.o) p.pt = p.o; });
    delete FP.Match.cache[club.id]; C.calcStr(club);
  }

  // ofertas anuales (mitad de año tras el retiro)
  X.offers = function () {
    var S = FP.S, h = S.hero, p = P.ensure(), pa = p.path; if (!pa || !X.isX(pa.k) || pa.job) return;
    var lg = p.legacy, cand = [];
    if (pa.k === 'sel') {
      var nat = S.nat.filter(function (n) { return n.c === h.nat; })[0]; if (!nat) return;
      Dec.add({ kind: 'gestion', uniq: 'ofsel' + S.week, title: 'La federación te ofrece la selección juvenil', text: 'Te proponen dirigir la Sub-20 de ' + nat.nm + '.', opts: [{ k: 'sel', label: 'Aceptar el cargo', hint: 'Trabajas con la generación de tu país.' }, { k: 'no', label: 'Rechazar', hint: '' }], def: 'no', exp: 20, data: { nat: nat.id } });
      return;
    }
    var pool = S.clubs.filter(function (c) { return c.c === h.nat; }), want = pa.k === 'pres' ? [2, 5] : [1, lg.score >= 62 ? 2 : 3];
    pool.filter(function (c) { var t = tierOf(c); return t >= want[0] && t <= want[1]; }).sort(function () { return R() - 0.5; }).slice(0, 3).forEach(function (c) { cand.push(c.id); });
    if (!cand.length) return;
    Dec.add({ kind: 'gestion', uniq: 'of' + pa.k + S.week, title: pa.k === 'pres' ? 'Clubes que buscan presidente' : 'Clubes que buscan director deportivo', text: pa.k === 'pres' ? 'Puedes comprar el control de un club con tu fortuna y presidirlo.' : 'Tu trayectoria interesa a varios clubes.', def: 'no', exp: 20, data: { cand: cand },
      opts: cand.map(function (id, i) { return { k: 'j' + i, label: S.clubs[id].nm + ' (' + FP.LGDEF[S.clubs[id].lg].n + ')', hint: pa.k === 'pres' ? 'Asumes el control del club.' : 'Sueldo estimado ' + FP.fmt.money(Math.round(X.wage(S.clubs[id]))) + ' al año.' }; }).concat([{ k: 'no', label: 'Seguir esperando', hint: '' }]) });
  };
  X.wage = function (club) { return ({ 1: 900, 2: 350, 3: 130, 4: 50, 5: 25 }[tierOf(club)] || 25); };

  // decisión anual de gestión
  X.plan = function () {
    var S = FP.S, p = P.ensure(), pa = p.path; if (!pa || !X.isX(pa.k) || !pa.job) return;
    var name = pa.job.club != null ? S.clubs[pa.job.club].nm : 'la Sub-20';
    var opts = pa.k === 'dir' ? [{ k: 'cantera', label: 'Apostar por la cantera', hint: 'Mejora la academia a mediano plazo; el equipo no se refuerza ahora.' }, { k: 'estrellas', label: 'Fichar figuras', hint: 'Sube el nivel de los mejores ahora; riesgo para las finanzas.' }, { k: 'equilibrio', label: 'Proyecto equilibrado', hint: 'Mejoras moderadas y seguras.' }]
      : pa.k === 'pres' ? [{ k: 'estadio', label: 'Invertir en el estadio (' + FP.fmt.money(150) + ')', hint: 'Mejora las finanzas del club.' }, { k: 'academia', label: 'Invertir en la academia (' + FP.fmt.money(100) + ')', hint: 'Mejora la cantera.' }, { k: 'refuerzos', label: 'Financiar refuerzos (' + FP.fmt.money(200) + ')', hint: 'Sube el nivel del plantel.' }, { k: 'austeridad', label: 'Austeridad', hint: 'Ahorras; el equipo se resiente un poco.' }]
      : [{ k: 'jovenes', label: 'Apostar por los más jóvenes', hint: 'Más proyección; menos resultado inmediato.' }, { k: 'experiencia', label: 'Apostar por los mejores', hint: 'Más resultado inmediato.' }, { k: 'sistema', label: 'Trabajar el sistema de juego', hint: 'Mejora gradual del equipo.' }];
    Dec.add({ kind: 'gestion', uniq: 'pl' + S.week, title: 'Plan del año en ' + name, text: 'Tu cargo de ' + X.ROLE[pa.k].toLowerCase() + ' te permite fijar la prioridad de la temporada.', opts: opts, def: opts[opts.length - 1].k, exp: 16, data: { plan: 1 } });
  };
  Dec.handlers.gestion = function (k, d) {
    var S = FP.S, h = S.hero, p = P.ensure(), pa = p.path; if (!pa || !X.isX(pa.k)) return { ok: true, msg: '' };
    if (/^j\d/.test(k)) { var id = d.data.cand[+k.slice(1)], c = S.clubs[id]; pa.job = { club: id, role: pa.k, since: S.week }; if (pa.k === 'pres') { var cost = Math.round(100 + (6 - tierOf(c)) * 120); if (h.money < cost) { pa.job = null; return { ok: false, msg: 'No tienes fondos (' + FP.fmt.money(cost) + ') para tomar el club.' }; } FP.Contracts.pay(-cost, 'inversion', 'Compra del control de ' + c.nm); } h.history.push({ w: S.week, t: (pa.k === 'pres' ? 'Asumes la presidencia de ' : 'Asumes como director deportivo de ') + c.nm + '.' }); return { ok: true, msg: 'Aceptas el cargo en ' + c.nm + '.' }; }
    if (k === 'sel') { pa.job = { club: null, nat: d.data.nat, role: 'sel', since: S.week }; h.history.push({ w: S.week, t: 'Asumes como seleccionador Sub-20.' }); return { ok: true, msg: 'Aceptas dirigir la Sub-20.' }; }
    if (k === 'no') return { ok: true, msg: '' };
    var q = X.q(), club = pa.job && pa.job.club != null ? S.clubs[pa.job.club] : null, nat = pa.job && pa.job.nat != null ? S.nat[pa.job.nat - 5000] : null, msg = '';
    if (k === 'cantera' && club) { if (R() < 0.3 * q) { club.ac = Math.min(5, club.ac + 1); msg = 'La academia da un salto de calidad.'; } else msg = 'La inversión en cantera necesita más tiempo.'; }
    else if (k === 'estrellas' && club) { squadBoost(club, 5, 1.5 * q); if (R() < 0.3) club.fin = Math.max(1, club.fin - 1); msg = 'Llegan refuerzos: sube el nivel del equipo.'; }
    else if (k === 'equilibrio' && club) { squadBoost(club, 8, 0.7 * q); msg = 'Mejoras moderadas en el plantel.'; }
    else if (k === 'estadio' && club) { FP.Contracts.pay(-150, 'inversion', 'Estadio de ' + club.nm); if (R() < 0.6 * Math.min(1, q)) { club.fin = Math.min(10, club.fin + 1); msg = 'El estadio mejora las finanzas del club.'; } else msg = 'La obra se retrasa: sin efecto este año.'; }
    else if (k === 'academia' && club) { FP.Contracts.pay(-100, 'inversion', 'Academia de ' + club.nm); if (R() < 0.5 * Math.min(1, q)) { club.ac = Math.min(5, club.ac + 1); msg = 'La academia mejora.'; } else msg = 'La academia todavía no da frutos.'; }
    else if (k === 'refuerzos' && club) { FP.Contracts.pay(-200, 'inversion', 'Refuerzos de ' + club.nm); squadBoost(club, 6, 1.4 * q); msg = 'Los refuerzos elevan al equipo.'; }
    else if (k === 'austeridad' && club) { FP.Contracts.pay(60, 'post', 'Ahorro de ' + club.nm); if (R() < 0.3) club.fin = Math.min(10, club.fin + 1); squadBoost(club, 4, -0.4); msg = 'Ahorras, pero el equipo se resiente.'; }
    else if (nat) { var dr = k === 'jovenes' ? 0.1 * q - 0.05 : k === 'experiencia' ? 0.15 * q : 0.1 * q; nat.r = Math.round((nat.r + dr) * 100) / 100; pa.job.eff = (pa.job.eff || 0) + dr; msg = 'Tu trabajo ' + (dr > 0.05 ? 'mejora' : 'apenas mueve') + ' el nivel de la generación.'; }
    return { ok: true, msg: msg };
  };

  // resultado de la temporada en la liga del club
  X.onClosed = function (comp, entry) {
    var S = FP.S, h = S.hero, p = P.ensure(), pa = p && p.path; if (!h.retired || !pa || !X.isX(pa.k) || pa.k === 'sel' || !pa.job) return;
    var club = S.clubs[pa.job.club]; if (comp.lg !== club.lg) return;
    var tab = entry.tab, n = tab.length, rank = tab.indexOf(club.id) + 1, champ = entry.ch === club.id, dn = entry.dn.indexOf(club.id) >= 0, up = entry.up.indexOf(club.id) >= 0;
    var res = champ ? 'Campeón' : up ? 'Ascenso' : dn ? 'Descenso' : rank <= Math.ceil(n * 0.3) ? 'Zona alta' : rank <= Math.ceil(n * 0.65) ? 'Mitad de tabla' : 'Zona baja';
    p.exp++; pa.seasons.push({ y: comp.label, club: club.id, role: pa.k, res: res, rank: rank, n: n });
    if (pa.k === 'dir') P.pay(X.wage(club), 'Sueldo como director deportivo');
    if (champ) { pa.titles++; h.history.push({ w: S.week, t: club.nm + ' gana ' + FP.LGDEF[club.lg].n + ' con tu gestión.' }); }
    if (pa.k === 'dir' && (dn || rank > n * 0.8) && R() < 0.5) { h.history.push({ w: S.week, t: 'Dejas el cargo en ' + club.nm + ' tras una mala temporada.' }); pa.job = null; }
  };
  var olc = Sim.onLeagueClosed;
  Sim.onLeagueClosed = function (comp, entry) { if (olc) olc(comp, entry); try { X.onClosed(comp, entry); } catch (e) { if (window.console) console.warn('paths2', e); } };

  // seleccionador: resultado anual según el nivel del equipo y tu capacidad
  X.selYear = function () {
    var S = FP.S, p = P.ensure(), pa = p.path; if (!pa || pa.k !== 'sel' || !pa.job) return;
    var nat = S.nat[pa.job.nat - 5000], perf = P.ability() - nat.r - 6 + U.norm() * 7, res = perf >= 16 ? 'Campeón continental' : perf >= 8 ? 'Semifinales' : perf >= 0 ? 'Fase de grupos' : 'Eliminación temprana';
    p.exp++; pa.seasons.push({ y: String(D.year(S.week)), role: 'sel', res: res, nat: pa.job.nat });
    P.pay(60, 'Sueldo como seleccionador'); if (perf >= 16) { pa.titles++; S.hero.history.push({ w: S.week, t: 'Tu Sub-20 de ' + nat.nm + ' gana el torneo continental.' }); }
  };
  var yt0 = P.yearTick;
  P.yearTick = function () { var r = yt0.apply(this, arguments); try { X.selYear(); } catch (e) { if (window.console) console.warn('paths2', e); } return r; };
  // ofertas y planes: se enganchan al calendario anual de Post
  var pw0 = P.weekly;
  P.weekly = function (w) { pw0.apply(this, arguments); var h = FP.S.hero; if (!h || !h.retired) return; var d = w - h.retiredW; try { if (d > 0 && d % 52 === 26) X.offers(); if (d > 0 && d % 52 === 8) X.plan(); } catch (e) { if (window.console) console.warn('paths2', e); } };
})();
