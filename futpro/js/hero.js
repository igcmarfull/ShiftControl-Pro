/* FUTPRO — el futbolista: creación, atributos, entrenamiento, forma física, participación en partidos */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, Comp = FP.Comp;

  var Hero = FP.Hero = {};

  var FOCUS = {
    fis: { n: 'Físico', a: ['vel', 'ace', 'res', 'fue'], d: 'Velocidad, aceleración, resistencia y fuerza.' },
    tec: { n: 'Técnica', a: ['pas', 'reg', 'con'], d: 'Pase, regate y control.' },
    ata: { n: 'Definición y ataque', a: ['fin', 'rem', 'cab', 'pos'], d: 'Definición, remate, cabezazo y posicionamiento.' },
    men: { n: 'Mental', a: ['vis', 'ant', 'com', 'dis'], d: 'Visión, anticipación, compostura y disciplina.' },
    def: { n: 'Defensa', a: ['dfn', 'ant', 'pos', 'fue'], d: 'Defensa, anticipación y posicionamiento.' },
    pos: { n: 'Específico de mi posición', a: null, d: 'Los atributos que más pesan en tu posición.' },
    des: { n: 'Descanso activo', a: [], d: 'Recupera fatiga; casi no hay mejora.' },
    auto: { n: 'Plan equilibrado (automático)', a: null, d: 'Rota entre físico, técnica, mental y tu posición.' }
  };
  Hero.FOCUS = FOCUS;
  var STYLES = {
    fisico: { n: 'Físico y potente', b: { vel: 4, ace: 3, res: 4, fue: 10, fin: 3, rem: 5, cab: 6, pas: -5, reg: -5, con: -3, vis: -4, pos: 1, ant: 0, com: 0, dfn: 0, dis: -2 } },
    tecnico: { n: 'Técnico y habilidoso', b: { vel: 0, ace: 2, res: -3, fue: -6, fin: 2, rem: 0, cab: -4, pas: 6, reg: 9, con: 9, vis: 5, pos: 0, ant: 0, com: 3, dfn: -6, dis: 0 } },
    veloz: { n: 'Veloz y desequilibrante', b: { vel: 10, ace: 10, res: 2, fue: -5, fin: 1, rem: 1, cab: -5, pas: 0, reg: 6, con: 2, vis: -2, pos: 0, ant: -1, com: -2, dfn: -5, dis: -3 } },
    cerebral: { n: 'Cerebral y creador', b: { vel: -4, ace: -3, res: 2, fue: -5, fin: 0, rem: 0, cab: -4, pas: 9, reg: 3, con: 5, vis: 10, pos: 4, ant: 4, com: 6, dfn: -2, dis: 4 } },
    killer: { n: 'Rematador letal', b: { vel: 2, ace: 3, res: -2, fue: 2, fin: 11, rem: 9, cab: 3, pas: -4, reg: 0, con: 2, vis: -3, pos: 8, ant: 3, com: 7, dfn: -9, dis: -1 } },
    solido: { n: 'Sólido y disciplinado', b: { vel: -1, ace: -2, res: 6, fue: 6, fin: -6, rem: -4, cab: 5, pas: 1, reg: -5, con: -1, vis: 0, pos: 5, ant: 7, com: 4, dfn: 10, dis: 8 } }
  };
  Hero.STYLES = STYLES;

  // ---------- creación ----------
  // o: {nm, nat, city, age, h, kg, pos, foot, style, ovrTarget?, extra:{attr:+n}, potSeed?, club:{kind,...}}
  Hero.makeAttrs = function (age, pos, styleKey, extra, ovrTarget, boost) {
    var st = STYLES[styleKey] || STYLES.fisico, base = {}, k;
    var level = 40 + (age - 12) * 2.7 + (boost || 0); // nivel de un juvenil competitivo de esa edad (escala de las ligas)
    var wn = C.WN[pos] || C.WN.CM;
    C.ATTRS.forEach(function (a) {
      var posBias = (wn[a] || 0) * 40 - 2.5;
      base[a] = U.clamp(level + (st.b[a] || 0) + posBias + U.norm() * 1.6 + ((extra && extra[a]) || 0), 12, 95);
    });
    if (ovrTarget) {
      for (var i = 0; i < 30; i++) {
        var cur = C.ovrOf(base, pos), d = ovrTarget - cur; if (Math.abs(d) < 0.15) break;
        C.ATTRS.forEach(function (a) { base[a] = U.clamp(base[a] + d, 12, 95); });
      }
    }
    return base;
  };
  Hero.makeCaps = function (at, pos, pot, styleKey) {
    var cap = {}, gap = Math.max(1, pot - C.ovrOf(at, pos)), st = STYLES[styleKey] || STYLES.fisico, s = 1;
    var noise = {}; C.ATTRS.forEach(function (a) { noise[a] = 1 + U.norm() * 0.3; });
    for (var it = 0; it < 24; it++) {
      C.ATTRS.forEach(function (a) { cap[a] = U.clamp(at[a] + gap * s * Math.max(0.2, noise[a]) + (st.b[a] > 5 ? 2 : 0), at[a], 99); });
      var o = C.ovrOf(cap, pos);
      var diff = pot - o; if (Math.abs(diff) < 0.2) break;
      s *= 1 + diff / Math.max(10, o) * 0.8;
    }
    return cap;
  };
  Hero.create = function (o) {
    var S = FP.S, age = o.age;
    var bornW = o.bornW != null ? o.bornW : Math.round(S.week - (age + R() * 0.95) * 52.1775);
    var boost = 0;
    if (o.club && o.club.kind === 'academy' && FP.S.clubs[o.club.id]) { // quien entra a una cantera parte cerca del nivel de esa cantera
      var floor = C.youthStr(FP.S.clubs[o.club.id], U.clamp(age, 12, 19)) - 4;
      boost = Math.max(0, floor - (40 + (age - 12) * 2.7 + 3));
    }
    var at = Hero.makeAttrs(age, o.pos, o.style, o.extra, o.ovrTarget, boost);
    var ovr = C.ovrOf(at, o.pos);
    var pot = o.pot != null ? o.pot : FP.Youth.potFor(ovr, age);
    var h = {
      nm: o.nm, nat: o.nat, city: o.city || '', b: bornW, ht: o.h, kg: o.kg, pos: o.pos, foot: o.foot, style: o.style,
      at: at, cap: Hero.makeCaps(at, o.pos, pot, o.style), pot: pot, ovr: Math.round(ovr),
      team: null, club: null, tk: 'free', contract: null, loan: null,
      fat: 10, mor: 65, form: 60, inj: null, susp: 0, yc: 0,
      train: { focus: 'auto', int: 2 }, pcoach: 0, money: 0,
      season: Hero.blankSeason(), seasons: [], cur: null,
      log: [], trophies: [], awards: [], offers: [], inbox: [], nextId: 1,
      nt: { caps: 0, goals: 0, cat: null, called: false }, agent: null,
      tot: { ap: 0, min: 0, g: 0, a: 0, yc: 0, rc: 0, rs: 0, rn: 0 },
      retired: false, matchesPlayed: 0, extraTeams: [], flags: {}, startW: S.week, startAge: age, scouted: {}, at0: JSON.parse(JSON.stringify(at)), ovr0: Math.round(ovr), prog: [[S.week, Math.round(ovr)]]
    };
    S.hero = h;
    S.pl[0] = { i: 0, n: o.nm, b: bornW, p: o.pos, o: h.ovr, pt: pot, c: -1, ce: 0, nat: o.nat, h: 1 };
    return h;
  };
  Hero.blankSeason = function () { return { ap: 0, st: 0, min: 0, g: 0, a: 0, yc: 0, rc: 0, rs: 0, rn: 0 }; };
  Hero.age = function () { return C.age(FP.S.hero); };
  Hero.ageF = function () { return C.ageF(FP.S.hero); };
  Hero.updateOvr = function () {
    var h = FP.S.hero; h.ovr = Math.round(C.ovrOf(h.at, h.pos));
    FP.S.pl[0].o = h.ovr; FP.S.pl[0].p = h.pos; FP.S.pl[0].pt = Math.max(h.ovr, Math.round(h.pot));
    return h.ovr;
  };
  Hero.msg = function (txt, kind, extra) {
    var h = FP.S.hero; var m = { id: h.nextId++, w: FP.S.week, t: txt, k: kind || 'i' };
    if (extra) for (var k in extra) m[k] = extra[k];
    h.inbox.unshift(m); if (h.inbox.length > 150) h.inbox.length = 120;
    return m;
  };
  // Estimación pública del potencial (el real es oculto)
  Hero.potRange = function () {
    var h = FP.S.hero, age = Hero.age();
    var unc = Math.max(2, 8 - (age - 12) * 0.7 - (h.tk === 'pro' ? 1.5 : 0));
    var seed = U.hash(FP.S.seed, 'pot', Math.floor(FP.S.week / 52));
    var off = (U.mulberry(seed)() - 0.5) * unc * 0.8;
    var c = h.pot + off;
    return [Math.round(Math.max(h.ovr, c - unc)), Math.round(Math.min(99, c + unc))];
  };

  // ---------- vista para el motor de partidos ----------
  Hero.view = function (instr, pen) {
    var h = FP.S.hero, ins = instr || 0;
    var mf = (h.mor - 50) * 0.03 + (h.form - 50) * 0.025 - (pen || 0);
    return {
      nm: h.nm, ovr: h.ovr, at: h.at, fat: h.fat, team: h.team,
      matchSlot: function () { return h.pos; },
      stamFactor: function (s) { return 0.88 + 0.12 * U.clamp(s, 0, 100) / 100; },
      cur: function (slot, sf) { return C.ovrOf(h.at, slot) * (sf || 1) + mf; },
      shotSkill: function () { return (h.at.fin * 0.4 + h.at.rem * 0.3 + h.at.com * 0.2 + h.at.pos * 0.1) + mf + ins * 2; },
      passSkill: function () { return h.at.pas * 0.45 + h.at.vis * 0.35 + h.at.con * 0.2 + mf; },
      headerSkill: function () { return h.at.cab * 0.6 + h.at.fue * 0.2 + h.at.pos * 0.2; }
    };
  };

  // ---------- entrenamiento ----------
  var AGE_RATE = { 12: 1.0, 13: 1.05, 14: 1.15, 15: 1.2, 16: 1.15, 17: 1.05, 18: 0.95, 19: 0.85, 20: 0.75, 21: 0.65, 22: 0.55, 23: 0.48, 24: 0.4, 25: 0.32, 26: 0.25, 27: 0.18, 28: 0.1 };
  Hero.ageRate = function (age) { return age < 12 ? 1 : age > 28 ? 0 : AGE_RATE[age]; };
  Hero.facility = function () {
    var h = FP.S.hero;
    if (h.tk === 'amat') return 0.75;
    var club = h.club != null ? FP.S.clubs[h.club] : null;
    return club ? 0.82 + club.ac * 0.09 : 0.85;
  };
  Hero.focusAttrs = function (f) {
    var h = FP.S.hero;
    if (f === 'pos') {
      var w = C.WN[h.pos] || C.WN.CM;
      return Object.keys(w).sort(function (a, b) { return w[b] - w[a]; }).slice(0, 5);
    }
    return FOCUS[f].a;
  };
  // Aplica una semana de entrenamiento. Devuelve resumen.
  Hero.trainWeek = function () {
    var S = FP.S, h = S.hero, age = Hero.age(), res = { gains: {}, fatDelta: 0 };
    var t = h.train, intn = t.int, fac = Hero.facility();
    var inj = h.inj && h.inj.n > 0;
    if (t.focus === 'des' || inj) {
      h.fat = U.clamp(h.fat - 28, 0, 100); res.rest = true;
    } else {
      var foc = t.focus;
      if (foc === 'auto') {
        var seq = C.POS_GRP[h.pos] === 'F' ? ['pos', 'ata', 'fis', 'tec', 'pos', 'men', 'tec', 'ata'] : C.POS_GRP[h.pos] === 'D' ? ['pos', 'def', 'fis', 'men', 'pos', 'tec', 'def', 'fis'] : ['pos', 'tec', 'fis', 'men', 'pos', 'def', 'tec', 'ata'];
        h.autoIdx = ((h.autoIdx || 0) + 1) % seq.length; foc = seq[h.autoIdx];
        res.autoFocus = foc;
      }
      var attrs = Hero.focusAttrs(foc), mult = intn === 1 ? 0.6 : intn === 2 ? 1 : 1.4;
      var coach = 1 + (h.pcoach || 0) * 0.1;
      var fatM = h.fat > 80 ? 0.5 : h.fat > 65 ? 0.8 : 1;
      var ar = Hero.ageRate(age);
      attrs.forEach(function (a) {
        var gap = h.cap[a] - h.at[a]; if (gap <= 0) return;
        var g = 0.14 * ar * mult * fac * coach * fatM * Math.min(1.7, 0.3 + Math.min(gap, 20) / 12) * (0.85 + R() * 0.3);
        h.at[a] = Math.min(h.cap[a], h.at[a] + g); res.gains[a] = g;
      });
      h.fat = U.clamp(h.fat + (intn === 1 ? -2 : intn === 2 ? 6 : 14) - (8 + h.at.res / 14), 0, 100);
      // riesgo de lesión por entrenamiento
      var pInj = 0.0035 * (1 + h.fat / 55) * (intn === 3 ? 1.6 : intn === 1 ? 0.6 : 1);
      if (R() < pInj) Hero.injure('train');
    }
    // descenso físico con la edad
    if (age >= 29) {
      var dec = (age - 28) * 0.0045;
      ['vel', 'ace', 'res', 'fue'].forEach(function (a) { h.at[a] = Math.max(15, h.at[a] - dec * (0.7 + R() * 0.6)); });
      if (age >= 32) ['reg', 'con', 'rem'].forEach(function (a) { h.at[a] = Math.max(15, h.at[a] - dec * 0.3); });
      // los topes también bajan
      C.ATTRS.forEach(function (a) { if (h.cap[a] > h.at[a]) h.cap[a] = h.at[a]; });
    }
    // maduración natural mínima (aunque no entrene bien)
    if (age <= 17 && !inj) { C.ATTRS.forEach(function (a) { var gap = h.cap[a] - h.at[a]; if (gap > 0) h.at[a] = Math.min(h.cap[a], h.at[a] + 0.012 * Math.min(gap, 15) / 10); }); }
    h.mor = U.clamp(h.mor + (h.mor > 65 ? -1 : 1), 0, 100);
    Hero.updateOvr();
    return res;
  };
  Hero.injure = function (src, weeksForced) {
    var h = FP.S.hero, r = R(), n;
    if (weeksForced) n = weeksForced;
    else n = r < 0.6 ? U.int(1, 3) : r < 0.9 ? U.int(4, 9) : r < 0.99 ? U.int(10, 28) : U.int(30, 44);
    var types = n <= 3 ? ['Golpe muscular', 'Esguince leve', 'Contractura', 'Sobrecarga'] : n <= 9 ? ['Desgarro muscular', 'Esguince de tobillo', 'Lesión de rodilla (leve)'] : ['Rotura de ligamentos', 'Fractura', 'Lesión de menisco', 'Rotura fibrilar grave'];
    h.inj = { n: n, nm: U.pick(types), src: src };
    if (n >= 10) { C.ATTRS.forEach(function (a) { if (['vel', 'ace', 'res'].indexOf(a) >= 0) h.at[a] = Math.max(15, h.at[a] - 0.4); }); }
    Hero.msg('Lesión: ' + h.inj.nm + '. Baja estimada: ' + n + (n === 1 ? ' semana.' : ' semanas.'), 'inj');
    Hero.updateOvr();
  };

  // ---------- rol en la plantilla ----------
  Hero.squadStatus = function () {
    var S = FP.S, h = S.hero;
    if (h.inj && h.inj.n > 0) return { role: 'out', why: 'lesionado' };
    if (h.susp > 0) return { role: 'out', why: 'suspendido' };
    var tk = h.tk;
    var base = C.ovrOf(h.at, h.pos);
    var fatPen = h.fat > 75 ? (h.fat - 75) * 0.08 : 0;
    var score = base + (h.form - 50) * 0.03 + (h.mor - 50) * 0.02 - fatPen + ((h.ct == null ? 50 : h.ct) - 50) * 0.03;
    if (tk === 'amat' || tk === 'academy') {
      if (h.fat > 92 && R() < 0.5) return { role: 'bench', why: 'descanso', p: 0.9 };
      return FP.Youth.heroStatus();
    }
    // profesional: compite contra compañeros de su posición
    var r = (S.ro[h.team] || []).filter(function (p) { return p.i !== 0 && !(p.inj > 0) && p.p === h.pos; });
    var slots = (h.pos === 'CB') ? 2 : 1;
    var better = r.filter(function (p) { return p.o > score; }).length;
    var rank = better;
    var role, p = 0.7;
    var jv = -FP.Youth.adultPenalty(Hero.age()); // madurez física: los juveniles rinden menos entre adultos
    var gapBest = (r.length ? Math.max.apply(null, r.map(function (x) { return x.o; })) : 40) - (score + jv);
    if (rank < slots && gapBest < 3) role = 'starter';
    else if (rank < slots + 1 && gapBest < 7) role = R() < 0.35 + (4 - gapBest) * 0.04 ? 'starter' : 'bench';
    else if (rank < slots + 3) role = R() < 0.65 ? 'bench' : 'out';
    else role = R() < 0.25 ? 'bench' : 'out';
    if (role === 'starter' && h.fat > 85 && R() < 0.4) role = 'bench';
    if (role === 'bench') p = U.clamp(0.82 - gapBest * 0.03, 0.15, 0.9);
    return { role: role, why: role === 'out' ? 'fuera de convocatoria' : '', p: p, rank: rank };
  };
  Hero.roleLabel = function () {
    var h = FP.S.hero; if (h.tk === 'amat' || h.tk === 'academy') return h.tk === 'amat' ? 'Titular (club amateur)' : 'Juvenil del club';
    var r = (FP.S.ro[h.team] || []).filter(function (p) { return p.i !== 0 && p.p === h.pos; }).sort(function (a, b) { return b.o - a.o; });
    var best = r.length ? r[0].o : 40, d = h.ovr - FP.Youth.adultPenalty(Hero.age()) - best;
    return d >= 6 ? 'Estrella' : d >= 1 ? 'Titular indiscutido' : d >= -3 ? 'Titular' : d >= -7 ? 'Rotación' : 'Suplente';
  };

  // ---------- equipos y competiciones del jugador ----------
  Hero.heroTeamIds = function () { return Sim_heroTeams(); };
  function Sim_heroTeams() { return FP.Sim.heroTeams(); }

  // Asegura competiciones para el equipo actual del jugador
  Hero.ensureComps = function () {
    var S = FP.S, h = S.hero, y = D.year(S.week);
    if (h.retired) return;
    if (h.tk === 'amat') {
      var has = Object.keys(S.comps).some(function (id) { var c = S.comps[id]; return c.kind === 'A' && !c.done && c.teams.indexOf(h.team) >= 0; });
      if (!has) Hero.newRegional();
    } else if (h.tk === 'academy') {
      var club = S.clubs[h.club];
      var lg = S.lgs[club.lg], lc = S.comps[lg.cmp];
      var hasY = Object.keys(S.comps).some(function (id) { var c = S.comps[id]; return c.kind === 'Y' && !c.done && c.teams.indexOf(h.team) >= 0; });
      if (!hasY && lc) Hero.newYouthLeague(club.lg);
    }
  };
  // Torneo regional amateur: 8 equipos, todos contra todos + final de los 2 primeros
  Hero.newRegional = function () {
    var S = FP.S, h = S.hero, hc = S.amat[h.team - 20000], cc = hc.c;
    var w = S.week, ymd = D.ymd(w), y = ymd[0];
    // semestres: Apertura (mar-may) y Clausura (ago-oct)
    var half = null, s0;
    var candidates = [[y, 0, D.of(y, 2, 14), 'Apertura'], [y, 1, D.of(y, 7, 8), 'Clausura'], [y + 1, 0, D.of(y + 1, 2, 14), 'Apertura']];
    for (var i = 0; i < candidates.length; i++) if (candidates[i][2] > w) { half = candidates[i]; break; }
    s0 = half[2];
    // rivales: los mismos clubes del grupo regional si existen
    var group = hc.grp, teams = [];
    if (!group) { group = hc.grp = []; }
    while (group.length < 7) {
      var id = 20000 + S.amat.length;
      var nm = FP.Names.club(); var tries = 0;
      while (S.amat.some(function (t) { return t.nm === nm; }) && tries++ < 20) nm = FP.Names.club();
      S.amat.push({ id: id, nm: nm, c: cc, st: Math.round(hc.st - 4 + R() * 9), gen: true, grp: null });
      group.push(id);
    }
    teams = [h.team].concat(group);
    var comp = Comp.create({ id: 'A:' + h.team + ':' + half[0] + half[3], kind: 'A', nm: 'Campeonato Regional ' + half[3], y: half[0], teams: teams, c: cc });
    comp.stages = [{ k: 'lg' }]; comp.label = half[3] + ' ' + half[0]; comp.half = half[3];
    Comp.resetTable(comp);
    var rounds = Comp.roundRobin(U.shuffle(teams.slice()), false);
    rounds.forEach(function (rd, i) { rd.forEach(function (m) { Comp.addFx(comp, m[0], m[1], s0 + i + (i > 3 ? 0 : 0), { r: i + 1 }); }); });
    comp.fx.sort(function (a, b) { return a.w - b.w; });
    comp.w0 = s0; comp.w1 = s0 + rounds.length;
    return comp;
  };
  // Liga juvenil del club (equipos sub-X de la misma división)
  Hero.newYouthLeague = function (lgId) {
    var S = FP.S, h = S.hero, def = FP.LGDEF[lgId], lg = S.lgs[lgId];
    var age = Hero.age(), cat = Math.min(Math.max(age, 12), 19);
    var ids = lg.teams.map(function (cid) { return 30000 + cid; });
    var parent = S.comps[lg.cmp];
    var comp = Comp.create({ id: 'Y:' + lgId + ':' + parent.y + ':' + h.club, kind: 'Y', nm: 'Campeonato Juvenil Sub-' + (cat < 15 ? 15 : cat < 17 ? 17 : cat < 19 ? 19 : 20) + ' · ' + def.n, y: parent.y, lg: lgId, teams: ids, c: def.c });
    comp.stages = [{ k: 'lg' }]; comp.label = parent.label; comp.ys = {};
    ids.forEach(function (id) { comp.ys[id] = C.youthStr(S.clubs[id - 30000], cat) + (id === h.team ? 0 : 0); });
    Comp.resetTable(comp);
    var rounds = Comp.roundRobin(U.shuffle(ids.slice()), true);
    var weeks = Comp.weeksFor(def.cal, parent.y, rounds.length);
    var now = S.week;
    rounds.forEach(function (rd, i) { rd.forEach(function (m) { Comp.addFx(comp, m[0], m[1], weeks[i], { r: i + 1 }); }); });
    comp.fx.sort(function (a, b) { return a.w - b.w || a.r - b.r; });
    comp.w0 = weeks[0]; comp.w1 = weeks[weeks.length - 1];
    // equipos juveniles: partidos pasados se simulan en bloque para tabla coherente
    var guard = 0;
    while (comp.cp < comp.fx.length && comp.fx[comp.cp].w < now && guard++ < 5000) {
      var f = comp.fx[comp.cp]; FP.Match.quick(comp, f); Comp.finish(comp, f); comp.cp++;
    }
    return comp;
  };

  // ---------- semana del jugador ----------
  // Se llama al avanzar la semana, antes de jugar partidos.
  Hero.weekStart = function () {
    var S = FP.S, h = S.hero; if (!h || h.retired) return null;
    var out = { train: Hero.trainWeek() };
    Hero.ensureComps();
    Hero.friendlyIfIdle();
    return out;
  };
  // Al terminar la semana (después de los partidos)
  Hero.weekEnd = function () {
    var S = FP.S, h = S.hero; if (!h || h.retired) return;
    if (h.inj) { h.inj.n--; if (h.inj.n <= 0) { Hero.msg('Alta médica: ' + h.nm + ' vuelve a estar disponible.', 'ok'); h.inj = null; } }
    if (h.susp > 0 && !h.suspHeld) { /* se descuenta al jugar un partido oficial */ }
    h.suspHeld = false;
    // recuperación pasiva
    h.fat = U.clamp(h.fat - (6 + h.at.res / 20), 0, 100);
    // sueldo semanal
    if (FP.Contracts) FP.Contracts.payWage();
    else if (h.contract && h.contract.wage > 0) h.money += h.contract.wage / 52 * (1 - (h.agent ? h.agent.com / 100 : 0));
    if (h.pcoach) h.money -= [0, 0.08, 0.18, 0.4][h.pcoach];
    h.cap = h.cap; // sin cambios
    Hero.updateOvr();
    if (S.week % 4 === 0) { h.prog.push([S.week, h.ovr]); if (h.prog.length > 1500) h.prog.splice(1, 200); }
    var C2 = S.pl[0]; C2.c = h.tk === 'pro' || h.tk === 'loan' || h.tk === 'academy' ? (h.tk === 'academy' ? -1 : h.team) : -1;
    if (h.tk === 'pro' || h.tk === 'loan') { C2.c = h.team; }
    else C2.c = -1;
  };
  Hero.ensureInRoster = function () {
    var S = FP.S, h = S.hero; if (!h) return;
    var p = S.pl[0];
    var inClub = (h.tk === 'pro' || h.tk === 'loan') && h.team != null && h.team < 5000;
    p.c = inClub ? h.team : -1;
    Object.keys(S.ro).forEach(function (k) { var a = S.ro[k]; var i = a.indexOf(p); if (i >= 0 && (!inClub || +k !== h.team)) a.splice(i, 1); });
    if (inClub) { var r = S.ro[h.team] || (S.ro[h.team] = []); if (r.indexOf(p) < 0) r.push(p); delete FP.Match.cache[h.team]; C.calcStr(S.clubs[h.team]); }
  };

  // partidos amistosos cuando no hay competición cerca (amateur / juvenil)
  Hero.friendlyIfIdle = function () {
    var S = FP.S, h = S.hero;
    if (h.tk !== 'amat' && h.tk !== 'academy') return;
    var w = S.week, soon = false;
    Object.keys(S.comps).forEach(function (id) {
      var c = S.comps[id]; if (c.done) return;
      if (c.teams.indexOf(h.team) < 0) return;
      for (var i = c.cp; i < c.fx.length && i < c.cp + 40; i++) { var f = c.fx[i]; if (!f.d && (f.h === h.team || f.a === h.team) && f.w <= w + 2) { soon = true; break; } }
    });
    if (soon) return;
    if (h.lastFriendly != null && w - h.lastFriendly < 2) return;
    // rival: otro club amateur / club juvenil
    var opp, comp = S.comps['F:' + h.team] || Comp.create({ id: 'F:' + h.team, kind: 'F', nm: 'Partidos amistosos', y: D.year(w), teams: [h.team], c: 'CHI' });
    comp.stages = [{ k: 'fr' }]; comp.ys = comp.ys || {};
    if (h.tk === 'amat') {
      var hc = S.amat[h.team - 20000], g = hc.grp || [];
      opp = g.length ? U.pick(g) : null;
    } else {
      var lg = S.clubs[h.club].lg, ids = S.lgs[lg].teams.filter(function (x) { return x !== h.club; });
      opp = 30000 + U.pick(ids);
      comp.ys[opp] = C.youthStr(S.clubs[opp - 30000], U.clamp(Hero.age(), 12, 19));
      comp.ys[h.team] = C.youthStr(S.clubs[h.club], U.clamp(Hero.age(), 12, 19));
    }
    if (opp == null) return;
    var home = R() < 0.5;
    comp.done = false;
    Comp.addFx(comp, home ? h.team : opp, home ? opp : h.team, w + 1, { fr: 1 });
    h.lastFriendly = w;
  };

  // ---------- partido: preparación y resultado ----------
  Hero.prepareMatch = function (item) {
    var S = FP.S, h = S.hero, comp = S.comps[item.c], f = comp.fx[item.i];
    var opp = f.h === h.team || (h.extraTeams || []).indexOf(f.h) >= 0 ? f.a : f.h;
    var mine = (f.h === h.team || (h.extraTeams || []).indexOf(f.h) >= 0) ? f.h : f.a;
    var st = Hero.squadStatus();
    if (comp.kind === 'F' || mine >= 5000 && mine < 20000) { // amistosos y selecciones
      if (comp.kind === 'N' || (mine >= 5000 && mine < 20000)) st = (comp.cat && FP.NT && FP.NT.heroRole(mine, comp)) || Hero.nationalStatus(mine, comp);
    }
    return { comp: comp, f: f, item: item, opp: opp, mine: mine, status: st, home: f.h === mine };
  };
  Hero.nationalStatus = function (natId, comp) {
    var S = FP.S, h = S.hero, n = C.team(natId);
    if (h.inj && h.inj.n > 0) return { role: 'out', why: 'lesionado' };
    var score = h.ovr + (h.form - 50) * 0.03;
    var thr = Hero.callThreshold(n, h.nt.cat);
    var d = score - thr;
    if (d >= 4) return { role: 'starter', why: '', p: 0.9 };
    if (d >= 0) return { role: R() < 0.55 ? 'starter' : 'bench', why: '', p: 0.7 };
    return { role: 'bench', why: '', p: 0.35 };
  };
  // Madurez física: en competiciones de adultos un juvenil rinde menos que lo que dice su media
  Hero.matchPenalty = function (comp) {
    var age = Hero.age();
    if (comp.kind === 'Y' || comp.kind === 'A' || comp.cat) return 0;
    if (comp.kind === 'F' || comp.kind === 'N') return 0;
    return FP.Youth.adultPenalty(age);
  };
  Hero.callThreshold = function (nat, cat) {
    var f = { 'Sub-15': 0.80, 'Sub-17': 0.86, 'Sub-20': 0.92, 'Sub-23': 0.96, 'Absoluta': 1.0 }[cat] || 1;
    var base = nat.r - 8 + (cat === 'Absoluta' ? 0 : 0);
    return Math.round(base * f - (cat === 'Absoluta' ? 0 : 2));
  };

  // Ejecuta el partido y aplica todo al jugador. Devuelve el resultado completo.
  // mode: 'full' (minuto a minuto, el UI reproduce) | 'quick' (igual, se muestra resumen)
  Hero.playMatch = function (prep, opts) {
    var S = FP.S, h = S.hero, comp = prep.comp, f = prep.f;
    opts = opts || {};
    var role = prep.status.role;
    var imp = (f.k ? 1.1 : 1) * (comp.kind === 'T' && f.k ? 1.05 : 1) * (comp.kind === 'X' && comp.nat && f.k ? 1.1 : 1);
    var ctx = { comp: comp, f: f, role: role, status: prep.status, imp: imp, benchP: prep.status.p, hero: Hero.view(h.instr || 0, Hero.matchPenalty(comp)), tactic: { mentality: h.instr || 0 } };
    h.team = h.team; // el equipo ya está definido; para selecciones el id está en prep.mine
    var hv = ctx.hero; hv.team = prep.mine;
    var res = FP.Match.full(ctx);
    // aplica al fixture y a la competición
    FP.Match.apply(comp, f, res);
    Hero.afterMatch(prep, res);
    return res;
  };
  Hero.afterMatch = function (prep, res) {
    var S = FP.S, h = S.hero, comp = prep.comp, f = prep.f, hm = res.hero;
    var official = !(comp.kind === 'F' || f.fr);
    var mineGoals = prep.home ? res.hs : res.as, oppGoals = prep.home ? res.as : res.hs;
    var result = mineGoals > oppGoals ? 'V' : mineGoals < oppGoals ? 'D' : 'E';
    if (res.ps) { result = (prep.home ? res.ps[0] > res.ps[1] : res.ps[1] > res.ps[0]) ? 'V' : 'D'; }
    var rec = { w: S.week, c: comp.nm, cid: comp.id, o: prep.opp, h: prep.home ? 1 : 0, s: mineGoals + '-' + oppGoals, r: result, role: hm ? (hm.played ? (hm.subIn ? 'sup' : 'tit') : (prep.status.role === 'out' ? 'fuera' : 'banca')) : 'fuera', min: hm && hm.played ? hm.min : 0, g: hm ? hm.g : 0, a: hm ? hm.a : 0, rt: hm && hm.played ? hm.rating : 0, off: official ? 1 : 0, k: FP.Stats ? FP.Stats.classOf(comp) : '', why: /lesi|suspend/.test(prep.status.why || '') ? 1 : 0 };
    if (res.ps) rec.s += ' (' + (prep.home ? res.ps[0] + '-' + res.ps[1] : res.ps[1] + '-' + res.ps[0]) + ' pen.)';
    if (res.et) rec.s += ' (pró.)';
    h.log.unshift(rec); if (h.log.length > 400) h.log.length = 300;
    h.logTick = (h.logTick || 0) + 1;
    var team = prep.mine;
    var isNT = team >= 5000 && team < 20000;
    // registro por temporada / equipo / competición (nunca mezcla clases)
    if (FP.Stats && hm) FP.Stats.record(prep, res, hm, result);
    // acumulados de clubes (juvenil, amateur y profesional); las selecciones y los amistosos no se mezclan aquí
    if (official && hm && !isNT) {
      var tot = h.season, T = h.tot;
      if (hm.played) {
        tot.ap++; T.ap++; tot.min += hm.min; T.min += hm.min; if (!hm.subIn) tot.st++;
        tot.rs += hm.rating; T.rs += hm.rating; tot.rn++; T.rn++;
        tot.g += hm.g; T.g += hm.g; tot.a += hm.a; T.a += hm.a;
        tot.yc += hm.yc; T.yc += hm.yc; tot.rc += hm.rc; T.rc += hm.rc;
        h.matchesPlayed++;
      }
    }
    if (hm && hm.played && isNT) { h.nt.caps++; h.nt.goals += hm.g; }
    if (FP.Youth && hm && !isNT) FP.Youth.heroTrustUpdate(hm.rating || 6, !!hm.played);
    if (FP.Rep && hm && !isNT) FP.Rep.spark(hm);
    // morale, forma, fatiga
    if (hm && hm.played) {
      h.fat = U.clamp(h.fat + hm.min / 90 * 20, 0, 100);
      h.form = U.clamp(h.form * 0.7 + (hm.rating * 10 - 5) * 0.3 + (hm.rating >= 7 ? 3 : 0) - (hm.rating < 6 ? 4 : 0), 5, 99);
      h.mor = U.clamp(h.mor + (result === 'V' ? 4 : result === 'D' ? -3 : 0) + (hm.g ? 4 : 0) + (hm.rating >= 7.5 ? 3 : 0) - (hm.rating < 5.5 ? 4 : 0), 0, 100);
      Hero.matchXP(hm, prep);
      if (hm.inj) Hero.injure('match');
      if (hm.rc) { var n = hm.yc && hm.rc && hm.yc >= 2 ? 1 : U.int(1, 3); h.susp = n; h.suspHeld = true; Hero.msg('Expulsado: suspendido ' + n + ' partido' + (n > 1 ? 's' : '') + '.', 'warn'); }
      else if (official && h.season.yc > 0 && h.season.yc % 5 === 0 && hm.yc) { h.susp = 1; h.suspHeld = true; Hero.msg('Acumulación de tarjetas amarillas: 1 partido de suspensión.', 'warn'); }
    } else if (prep.status.role === 'bench' || prep.status.role === 'out') {
      h.mor = U.clamp(h.mor - (h.tk === 'amat' ? 0 : prep.status.role === 'out' && !prep.status.why.match(/lesion|suspend/) ? 3 : 1), 0, 100);
      h.fat = U.clamp(h.fat - 4, 0, 100);
    }
    if (official && h.susp > 0 && !h.suspHeld && prep.status.why === 'suspendido') { h.susp--; }
    if (hm && hm.g && official) {
      if (hm.g >= 3) Hero.msg('¡Triplete! ' + hm.g + ' goles de ' + h.nm + ' en ' + comp.nm + '.', 'ok');
    }
  };
  // experiencia de partido: mejora ligera de atributos clave según minutos y rendimiento
  Hero.matchXP = function (hm, prep) {
    var h = FP.S.hero, age = Hero.age();
    if (hm.min < 5) return;
    var oppSt = C.strOf(prep.opp), d = oppSt - h.ovr;
    var lvl = U.clamp(1 + d * 0.03, 0.5, 1.6);
    var q = U.clamp((hm.rating - 5) / 2.5, 0.3, 1.6);
    var amt = 0.09 * (hm.min / 90) * lvl * q * Hero.ageRate(age) * 1.0;
    var attrs = Hero.focusAttrs('pos');
    attrs.forEach(function (a) { var gap = h.cap[a] - h.at[a]; if (gap > 0) h.at[a] = Math.min(h.cap[a], h.at[a] + amt * Math.min(gap, 20) / 12); });
    if (hm.g) h.at.fin = Math.min(h.cap.fin, h.at.fin + 0.03 * Hero.ageRate(age));
    Hero.updateOvr();
  };

  Hero.endSeasonStats = function (label, clubName) {
    var h = FP.S.hero, s = h.season;
    if (s.ap || s.st) h.seasons.push({ y: label, club: clubName, comp: '', ap: s.ap, min: s.min, g: s.g, a: s.a, yc: s.yc, rc: s.rc, rt: s.rn ? Math.round(s.rs / s.rn * 10) / 10 : 0, ovr: h.ovr, age: Hero.age() });
    h.season = Hero.blankSeason();
  };
})();
