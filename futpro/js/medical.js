/* FUTPRO — salud y físico: tipos de lesión, causas, carga de partidos, prevención, rehabilitación con decisiones,
   recaídas, condición al volver y secuelas. Reemplaza FP.Hero.injure (la lesión sigue siendo h.inj = {n, nm, src}). */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, Hero = FP.Hero, Dec = FP.Dec;
  var Med = FP.Med = {};

  // id: [nombre, zona, causa, semanas mín, máx, cirugía ('no'|'opcional'|'obligatoria'), secuela (puntos de vel/ace/res), peso]
  var T = {
    contractura: ['Contractura', 'gemelo', 'muscular', 1, 2, 'no', 0, 10],
    elongacion: ['Elongación', 'isquiotibiales', 'muscular', 2, 4, 'no', 0, 9],
    desgarro: ['Desgarro muscular', 'isquiotibiales', 'muscular', 4, 8, 'no', 0.1, 6],
    desgarro_grave: ['Desgarro muscular grave', 'muslo', 'muscular', 8, 14, 'no', 0.3, 4],
    esguince_tobillo: ['Esguince de tobillo', 'tobillo', 'ligamento', 2, 6, 'no', 0, 8],
    esguince_rodilla: ['Esguince de rodilla', 'rodilla', 'ligamento', 4, 9, 'no', 0.2, 4],
    menisco: ['Lesión de menisco', 'rodilla', 'ligamento', 6, 14, 'opcional', 0.5, 4],
    lca: ['Rotura del ligamento cruzado', 'rodilla', 'ligamento', 28, 40, 'obligatoria', 1.2, 1.6],
    fractura_pie: ['Fractura de metatarsiano', 'pie', 'hueso', 8, 12, 'no', 0.2, 2.5],
    fractura_tibia: ['Fractura de tibia', 'pierna', 'hueso', 18, 28, 'obligatoria', 1.0, 1],
    contusion: ['Contusión', 'muslo', 'golpe', 1, 3, 'no', 0, 12],
    conmocion: ['Conmoción cerebral', 'cabeza', 'golpe', 1, 3, 'no', 0, 2],
    hombro: ['Lesión de hombro', 'hombro', 'golpe', 3, 6, 'no', 0, 2],
    tendinitis: ['Tendinitis', 'rodilla', 'sobrecarga', 2, 5, 'no', 0, 8],
    pubalgia: ['Pubalgia', 'ingle', 'sobrecarga', 4, 10, 'no', 0.1, 4],
    periostitis: ['Periostitis', 'pierna', 'sobrecarga', 3, 6, 'no', 0, 4]
  };
  Med.TYPES = T;
  // Frecuencia base de lesiones del jugador: calibrada para ≈ 2 por temporada y una grave cada ~3 temporadas (referencia: estudios de la UEFA sobre clubes de élite, ver README).
  Med.BASE = 2.1;
  var CAUSE_W = {
    match: { golpe: 30, muscular: 24, ligamento: 26, hueso: 5, sobrecarga: 8 },
    train: { muscular: 40, sobrecarga: 34, ligamento: 14, golpe: 5, hueso: 2 }
  };

  Med.ensure = function () {
    var h = FP.S && FP.S.hero; if (!h) return null;
    if (!h.med) h.med = { load: 12, cond: 100, prev: false, hist: [], zones: {}, recent: null, wkMin: 0, niggle: 0, out: 0, lastRisk: 1 };
    Dec.ensure(); return h.med;
  };
  Med.loadLevel = function (v) { return v < 8 ? ['baja', 'warn'] : v < 24 ? ['óptima', ''] : v < 36 ? ['alta', 'warn'] : ['excesiva', 'bad']; };
  // multiplicador de riesgo de lesión (partidos y entrenamientos)
  Med.riskMult = function () {
    var h = FP.S.hero, m = Med.ensure(), age = Hero.age();
    var r = 1 + Math.max(0, m.load - 22) * 0.025 + (h.fat > 70 ? 0.25 : 0) + (m.niggle > 0 ? 0.8 : 0) + (age >= 30 ? (age - 29) * 0.03 : 0) - (h.at.res - 50) * 0.004;
    if (m.prev) r *= 0.75;
    if (m.cond < 85) r *= 1 + (85 - m.cond) * 0.01;
    var club = h.club != null ? FP.S.clubs[h.club] : null; if (club && FP.Staff) r *= FP.Staff.medicalFactor(club);
    return U.clamp(r, 0.4, 3.5);
  };
  Med.pickType = function (src) {
    var h = FP.S.hero, m = Med.ensure(), w = CAUSE_W[src === 'train' ? 'train' : 'match'];
    var overuse = m.load > 30 ? 1.6 : 1;
    return U.wpick(Object.keys(T), function (k) {
      var t = T[k], cw = (w[t[2]] || 1) * t[7] * (t[2] === 'sobrecarga' ? overuse : 1);
      var rep = (m.zones[t[1]] || 0); cw *= 1 + rep * 0.18;                        // las zonas ya lesionadas son más frágiles
      if (t[2] === 'muscular' && h.fat > 70) cw *= 1.4;
      if ((t[2] === 'hueso' || t[2] === 'golpe') && h.at.fue > 65) cw *= 0.8;
      return cw;
    });
  };
  // Reemplazo de Hero.injure: elige tipo, duración y abre la decisión de tratamiento
  Hero.injure = function (src, weeksForced, forceType, isRelapse) {
    var S = FP.S, h = S.hero, m = Med.ensure(), age = Hero.age();
    var id = forceType || Med.pickType(src), t = T[id];
    if (weeksForced) { var near = Object.keys(T).filter(function (k) { return weeksForced >= T[k][3] && weeksForced <= T[k][4]; }); if (near.length && !forceType) { id = U.pick(near); t = T[id]; } }
    var n = weeksForced || U.int(t[3], t[4]);
    n = Math.max(1, Math.round(n * (age >= 30 ? 1.15 : age < 19 ? 0.9 : 1) * (1 - (h.at.res - 50) * 0.002) * (isRelapse ? 1.4 : 1)));
    h.inj = { n: n, nm: t[0], src: src, id: id, zone: t[1], cause: t[2], n0: n, plan: 'club', surg: t[5], w: S.week, relapse: !!isRelapse };
    m.zones[t[1]] = (m.zones[t[1]] || 0) + 1; m.out += n;
    Hero.msg('Lesión: ' + t[0] + ' (' + t[1] + '). Baja estimada: ' + n + (n === 1 ? ' semana.' : ' semanas.'), 'inj');
    m.hist.push({ w: S.week, id: id, nm: t[0], zone: t[1], n: n, src: src, relapse: !!isRelapse, plan: 'club' });
    m.recent = null;
    if (n >= 6 || t[5] !== 'no') Med.askTreatment(h.inj);
    Hero.updateOvr();
  };
  Med.askTreatment = function (inj) {
    var h = FP.S.hero, opts = [{ k: 'club', label: 'Tratamiento del club', hint: 'Plan estándar del cuerpo médico.' }];
    if (inj.surg === 'opcional') { opts.push({ k: 'conservador', label: 'Tratamiento conservador', hint: 'Sin cirugía: recuperación más corta, pero mayor riesgo de recaída.' }); opts.push({ k: 'cirugia', label: 'Cirugía', hint: 'Recuperación más larga, menos recaídas y secuelas.' }); }
    if (inj.surg === 'obligatoria') { opts = [{ k: 'cirugia', label: 'Cirugía en el club', hint: 'Necesaria para volver a competir.' }]; }
    if (inj.surg !== 'obligatoria') opts.push({ k: 'acelerada', label: 'Rehabilitación acelerada', hint: 'Vuelves antes, con más riesgo de recaída.' });
    var cost = Math.round(15 + inj.n * 3 * (0.6 + FP.DATA.countries[Med.country()].w));
    opts.push({ k: 'especialista', label: 'Especialista privado (' + FP.fmt.money(cost) + ')', hint: 'Mejor recuperación y menos recaídas; lo pagas tú.' });
    Dec.add({ kind: 'lesion', uniq: 'inj' + inj.w, title: inj.nm + ': ¿cómo te recuperas?', text: 'Baja estimada de ' + inj.n + ' semanas. Cada tratamiento cambia el tiempo de recuperación, el riesgo de recaída y las secuelas.', opts: opts, def: inj.surg === 'obligatoria' ? 'cirugia' : 'club', exp: 1, data: { cost: cost } });
  };
  Med.country = function () { var h = FP.S.hero; return h.club != null ? FP.S.clubs[h.club].c : (FP.DATA.countries[h.nat] ? h.nat : 'CHI'); };
  Dec.handlers.lesion = function (k, d) {
    var h = FP.S.hero, inj = h.inj, m = Med.ensure(); if (!inj) return { ok: true, msg: '' };
    var f = { club: 1, conservador: 0.95, cirugia: 1.12, acelerada: 0.8, especialista: 0.88 }[k] || 1;
    if (k === 'cirugia' && inj.surg === 'opcional') f = 1.25;
    if (k === 'cirugia' && inj.surg === 'obligatoria') f = 1;
    if (k === 'especialista') { if (h.money < d.data.cost) { k = 'club'; f = 1; FP.Hero.msg('No tienes dinero para el especialista: sigues con el club.', 'warn'); } else { FP.Contracts.pay(-d.data.cost, 'inversion', 'Especialista médico'); } }
    var club = h.club != null ? FP.S.clubs[h.club] : null; if (club && FP.Staff) f *= FP.Staff.rehabFactor(club);
    inj.plan = k; inj.n = Math.max(1, Math.round(inj.n0 * f)); inj.n0 = inj.n;
    var last = m.hist[m.hist.length - 1]; if (last) { last.plan = k; last.n = inj.n; }
    return { ok: true, msg: 'Plan elegido: ' + ({ club: 'tratamiento del club', conservador: 'tratamiento conservador', cirugia: 'cirugía', acelerada: 'rehabilitación acelerada', especialista: 'especialista privado' }[k]) + ' — baja de ' + inj.n + ' semanas.' };
  };
  Dec.handlers.alta = function (k, d) {
    var h = FP.S.hero, m = Med.ensure(); if (!h.inj) return { ok: true, msg: '' };
    if (k === 'esperar') { h.inj.n += U.int(1, 2); h.inj.waited = true; return { ok: true, msg: 'Esperas una o dos semanas más para volver al 100%.' }; }
    h.inj.rush = true; return { ok: true, msg: 'Pides volver cuanto antes.' };
  };
  Dec.handlers.molestias = function (k) {
    var h = FP.S.hero, m = Med.ensure();
    if (k === 'descansar') { m.load = Math.max(8, m.load - 14); m.niggle = 0; h.fat = U.clamp(h.fat - 12, 0, 100); return { ok: true, msg: 'Descansas y bajas la carga: las molestias ceden.' }; }
    m.niggle = 3; return { ok: true, msg: 'Sigues pese a las molestias: el riesgo de lesión sube unas semanas.' };
  };
  // al terminar la baja: condición física, secuelas y riesgo de recaída
  Med.onReturn = function (inj) {
    var S = FP.S, h = S.hero, m = Med.ensure(), t = T[inj.id] || T.contusion;
    var plan = inj.plan, relapseBase = { club: 0.12, conservador: 0.18, cirugia: 0.05, acelerada: 0.3, especialista: 0.07 }[plan] || 0.12;
    if (inj.rush) relapseBase *= 1.3; if (inj.waited) relapseBase *= 0.6;
    relapseBase *= 1 + (m.zones[inj.zone] - 1) * 0.15;
    m.cond = U.clamp(100 - Math.min(38, inj.n0 * 1.3), 55, 100);
    m.recent = { id: inj.id, zone: inj.zone, until: S.week + 8, risk: U.clamp(relapseBase, 0.02, 0.6) };
    // secuelas permanentes en lesiones graves
    var loss = t[6] * (plan === 'cirugia' || plan === 'especialista' ? 0.5 : plan === 'acelerada' ? 1.2 : 1);
    if (loss >= 0.1) { ['vel', 'ace', 'res'].forEach(function (a) { h.at[a] = Math.max(15, h.at[a] - loss * (a === 'res' ? 0.6 : 1)); if (h.cap[a] > h.at[a] + 25) h.cap[a] = h.at[a] + 25; }); Hero.msg('Tras la ' + t[0].toLowerCase() + ' notas secuelas físicas leves en tu velocidad y aceleración.', 'warn'); }
    Hero.updateOvr();
  };
  // riesgo de recaída durante un partido o entrenamiento (se llama al jugar)
  Med.relapseCheck = function (kind) {
    var S = FP.S, h = S.hero, m = Med.ensure(), r = m.recent;
    if (!r || S.week > r.until || (h.inj && h.inj.n > 0)) return false;
    if (R() < r.risk * (kind === 'match' ? 0.22 : 0.06)) { Hero.injure(kind, null, r.id, true); Hero.msg('Recaída: vuelves a lesionarte (' + r.zone + ').', 'inj'); return true; }
    return false;
  };

  // ---------- semana ----------
  Med.weekly = function (w) {
    var S = FP.S, h = S.hero, m = Med.ensure(); if (!h || h.retired) return;
    var ti = h.train ? h.train.int : 2, mins = m.wkMin || 0; m.wkMin = 0;
    m.load = Math.round((m.load * 0.78 + mins / 90 * 3.2 + [0, 0.4, 1, 2][ti]) * 10) / 10;       // un partido por semana + entrenamiento normal ≈ 19 (carga óptima)
    m.lastRisk = Med.riskMult();
    if (m.niggle > 0) m.niggle--;
    if (h.inj && h.inj.n > 0) { m.load = Math.max(0, m.load - 6); }
    else m.cond = U.clamp(m.cond + 6, 0, 100);
    // aviso de molestias por sobrecarga
    if (m.load > 34 && !(h.inj && h.inj.n > 0) && R() < 0.12) Dec.add({ kind: 'molestias', uniq: 'mol' + Math.floor(w / 6), title: 'Molestias por sobrecarga', text: 'Tu carga de partidos y entrenamientos es excesiva (' + Math.round(m.load) + '). Sientes molestias en las piernas.', opts: [{ k: 'descansar', label: 'Descansar unos días', hint: 'Baja la carga y el riesgo.' }, { k: 'seguir', label: 'Seguir como si nada', hint: 'Mantienes el ritmo, con más riesgo.' }], def: 'descansar', exp: 1 });
    // alta médica: ¿vuelves ya?
    if (h.inj && h.inj.n === 2 && !h.inj.asked && h.inj.n0 >= 6) { h.inj.asked = true; Dec.add({ kind: 'alta', uniq: 'alta' + h.inj.w, title: 'Casi recuperado: ¿cuándo vuelves?', text: 'Los médicos ven buena evolución. Puedes forzar el regreso o esperar a estar al 100%.', opts: [{ k: 'volver', label: 'Volver cuanto antes', hint: 'Más riesgo de recaída.' }, { k: 'esperar', label: 'Esperar 1-2 semanas', hint: 'Menos riesgo.' }], def: 'volver', exp: 1 }); }
  };
  // minutos jugados esta semana (para la carga)
  Med.addMinutes = function (min) { var m = Med.ensure(); if (m) m.wkMin += min; };
  Med.togglePrev = function () { var m = Med.ensure(); m.prev = !m.prev; return m.prev; };
  Med.summary = function () {
    var m = Med.ensure(), tot = m.hist.length, weeks = m.hist.reduce(function (s, e) { return s + e.n; }, 0);
    var by = {}; m.hist.forEach(function (e) { by[e.zone] = (by[e.zone] || 0) + 1; });
    return { n: tot, weeks: weeks, by: by };
  };

  // ---------- enlaces con el motor ----------
  var weekEnd0 = Hero.weekEnd;
  Hero.weekEnd = function () {
    var h = FP.S.hero, had = h && h.inj && h.inj.n > 0 ? h.inj : null;
    var r = weekEnd0.apply(this, arguments);
    if (had && (!h.inj || h.inj.n <= 0)) Med.onReturn(had);
    Med.weekly(FP.S.week); Dec.weekly(FP.S.week);
    return r;
  };
  var trainWeek0 = Hero.trainWeek;
  Hero.trainWeek = function () {
    var h = FP.S.hero, m = Med.ensure();
    var res = trainWeek0.apply(this, arguments);
    if (m.prev && res.gains) Object.keys(res.gains).forEach(function (a) { h.at[a] = Math.max(h.at[a] - res.gains[a] * 0.08, h.at[a] - 0.5); });   // la prevención resta algo de ritmo de mejora
    Med.relapseCheck('train');
    return res;
  };
  // la condición tras una lesión penaliza el rendimiento en partidos
  var view0 = Hero.view;
  Hero.view = function (instr, pen) {
    var m = Med.ensure(), c = m ? m.cond : 100;
    return view0.call(Hero, instr, (pen || 0) + (c < 100 ? (100 - c) * 0.04 : 0));
  };
  Med.migrate = function () { Med.ensure(); };
})();
