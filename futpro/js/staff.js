/* FUTPRO — entrenadores y vestuario: estilo de cada entrenador, su efecto en minutos, moral y progresión,
   y relaciones con el capitán, el ídolo, el mentor, el rival de puesto y los amigos del plantel. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, Hero = FP.Hero, Dec = FP.Dec;
  var St = FP.Staff = {};

  // youth: confianza en juveniles | disc: exigencia disciplinaria | rot: rotación | att: sesgo ofensivo(+)/defensivo(-) | mot: motivación
  St.STYLES = {
    formador: { nm: 'Formador', youth: 3, disc: 0, rot: 0.5, att: 0, mot: 0.1, press: 0, tempo: 0, desc: 'Apuesta por los jóvenes y confía en el talento que se forma en casa.' },
    defensivo: { nm: 'Defensivo', youth: -1, disc: 1, rot: 0.2, att: -1, mot: 0, press: -1, tempo: -1, desc: 'Prioriza el orden y el bloque bajo; premia a defensores y mediocampistas de contención.' },
    ofensivo: { nm: 'Ofensivo', youth: 1, disc: 0, rot: 0.3, att: 1, mot: 0.1, press: 1, tempo: 1, desc: 'Presión alta y ritmo: favorece a delanteros, extremos y creativos.' },
    pragmatico: { nm: 'Pragmático', youth: -1, disc: 1, rot: 0.2, att: 0, mot: 0, press: 0, tempo: 0, desc: 'Se apoya en los jugadores de experiencia y en lo que funciona.' },
    motivador: { nm: 'Motivador', youth: 1, disc: 0, rot: 0.4, att: 0, mot: 0.35, press: 0, tempo: 0, desc: 'Cuida el ánimo del grupo: el equipo rinde mejor cuando hay confianza.' },
    disciplinario: { nm: 'Disciplinario', youth: -2, disc: 2, rot: 0.2, att: 0, mot: -0.05, press: 0, tempo: 0, desc: 'Exige orden, puntualidad y cumplimiento táctico; no tolera indisciplina.' },
    rotador: { nm: 'Rotador', youth: 1, disc: 0, rot: 0.8, att: 0, mot: 0.1, press: 0, tempo: 0, desc: 'Cambia mucho el once: más oportunidades para el plantel, menos continuidad.' }
  };
  St.ensure = function () { var S = FP.S; if (!S.staff) S.staff = {}; return S.staff; };
  // Entrenador de un club (persistente mientras no cambie su nombre)
  St.coach = function (club) {
    var all = St.ensure(), c = all[club.id];
    if (!c || c.nm !== club.co) {
      var r = U.mulberry(U.hash(FP.S.seed, club.id, club.co, 'estilo')), keys = Object.keys(St.STYLES);
      var weights = { formador: club.ac >= 4 ? 2.2 : 1, defensivo: 1.4, ofensivo: 1.4, pragmatico: 1.6, motivador: 1, disciplinario: 0.9, rotador: 0.7 };
      var style = U.wpick(keys, function (k) { return weights[k]; }, r);
      c = all[club.id] = { nm: club.co, style: style, q: Math.round((0.35 + r() * 0.6) * 100) / 100, w: FP.S.week };
    }
    return c;
  };
  St.def = function (club) { return St.STYLES[St.coach(club).style]; };
  St.medicalFactor = function (club) { return U.clamp(1.1 - club.fin * 0.022, 0.86, 1.08); };
  St.rehabFactor = function (club) { return U.clamp(1.06 - club.fin * 0.016, 0.9, 1.04); };

  // ---------- relaciones ----------
  St.ensureLk = function () {
    var S = FP.S, h = S.hero; if (!h) return null;
    var team = h.tk === 'pro' || h.tk === 'loan' ? h.team : h.tk === 'academy' ? h.club : null;
    if (!h.lk || h.lk.club !== team) { h.lk = { club: team, coach: 10, mood: 50, people: [], cd: {}, advice: 0, since: S.week }; if (team != null) St.buildPeople(); }
    if (h.lk.club != null && h.lk.tk !== h.tk) { var first = h.lk.tk === undefined && h.lk.people.length && h.tk === 'academy'; if (!first) { h.lk.people = []; h.lk.tk = h.tk; St.buildPeople(); } else h.lk.tk = h.tk; }
    return h.lk;
  };
  St.buildPeople = function () {
    var S = FP.S, h = S.hero, lk = h.lk, club = S.clubs[lk.club], ro = (S.ro[club.id] || []).filter(function (p) { return p.i !== 0; }), grp = C.POS_GRP[h.pos];
    if (h.tk === 'academy') { ro = FP.Youth.catSquad(h.team, Hero.age()).concat(ro.slice(0, 6)); }
    if (!ro.length) return;
    var used = {}; function add(role, p, rel, label) { if (!p || used[p.i]) return; used[p.i] = 1; lk.people.push({ pid: p.i, role: role, rel: rel, label: label }); }
    var cap = ro.filter(function (p) { return C.age(p) >= 26; }).sort(function (a, b) { return (b.o + C.age(b) * 0.6) - (a.o + C.age(a) * 0.6); })[0];
    add('capitan', cap, 15, 'Capitán');
    var idol = ro.slice().sort(function (a, b) { return b.o - a.o; })[0]; add('idolo', idol, 8, 'Ídolo del club');
    var mentor = ro.filter(function (p) { return C.age(p) >= 29 && C.POS_GRP[p.p] === grp; }).sort(function (a, b) { return b.o - a.o; })[0]; add('mentor', mentor, 12, 'Veterano de tu puesto');
    var rival = ro.filter(function (p) { return p.p === h.pos; }).sort(function (a, b) { return b.o - a.o; })[0]; if (rival && rival.o >= h.ovr - 4) add('rival', rival, -5, 'Rival de puesto');
    var friends = ro.filter(function (p) { return !used[p.i] && Math.abs(C.age(p) - Hero.age()) <= 3; }); U.shuffle(friends);
    friends.slice(0, 2).forEach(function (p) { add('amigo', p, 25, 'Compañero cercano'); });
  };
  St.person = function (e) { return FP.S.pl[e.pid] || (FP.Youth && St.sqFind(e.pid)); };
  St.sqFind = function (id) { var sq = FP.S.sq, k, i; for (k in sq) { var ps = sq[k].ps; for (i = 0; i < ps.length; i++) if (ps[i].i === id) return ps[i]; } return null; };
  St.mood = function () { var lk = St.ensureLk(); return lk ? lk.mood : 50; };

  // ---------- efecto en minutos (se suma a la puntuación del jugador al armar el equipo) ----------
  St.statusAdj = function () {
    var S = FP.S, h = S.hero, lk = St.ensureLk(); if (!lk || lk.club == null) return 0;
    var club = S.clubs[lk.club], def = St.def(club), c = St.coach(club), age = Hero.age(), grp = C.POS_GRP[h.pos], adj = 0;
    if (age < 21) adj += def.youth * (0.5 + c.q * 0.5);
    else if (age >= 29) adj -= def.youth * 0.3;
    if (def.disc > 0 && h.at.dis < 55) adj -= (55 - h.at.dis) * 0.06 * def.disc;
    if (def.att > 0) adj += (grp === 'F' || h.pos === 'AM') ? 1.2 : (grp === 'D' ? -0.6 : 0);
    if (def.att < 0) adj += (grp === 'D' || h.pos === 'DM') ? 1.2 : (grp === 'F' ? -0.7 : 0);
    adj += lk.coach * 0.025;
    adj += (R() - 0.5) * 2 * def.rot * 1.6;                       // un rotador cambia mucho el once
    return adj;
  };
  // bono de progresión por tener un mentor cercano y consejos recientes
  St.mentorBonus = function () {
    var h = FP.S.hero, lk = h.lk; if (!lk || Hero.age() > 24) return 0;
    var b = 0; lk.people.forEach(function (e) { if (e.role === 'mentor' && e.rel >= 35) b += Math.min(0.08, (e.rel - 20) * 0.001); if (e.role === 'capitan' && e.rel >= 50) b += 0.02; });
    if (lk.advice > FP.S.week) b += 0.06;
    return b;
  };

  // ---------- semana ----------
  St.weekly = function (w) {
    var S = FP.S, h = S.hero, lk = St.ensureLk(); if (!lk || lk.club == null || h.retired) return;
    var club = S.clubs[lk.club], def = St.def(club), c = St.coach(club);
    var ms = h.log.slice(0, 4).filter(function (m) { return (m.k === 'liga' || m.k === 'copa' || m.k === 'cont' || m.k === 'juv') && w - m.w <= 5; });
    var role = h.tk === 'pro' ? Hero.roleLabel() : '';
    // relación con el entrenador: rendimiento, minutos y disciplina
    ms.forEach(function (m) { if (m.rt) lk.coach += (m.rt - 6.4) * 0.9; else if (m.role === 'fuera' && /Estrella|indiscutido/.test(role)) lk.coach -= 0.5; });
    if (h.at.dis < 45 && def.disc > 0) lk.coach -= 0.25 * def.disc;
    lk.coach = U.clamp(lk.coach * 0.995, -100, 100);
    var starter = ms.length ? ms.filter(function (m) { return m.role === 'tit'; }).length / ms.length : 0.5;
    lk.people.forEach(function (e) {
      if (e.role === 'rival') { var p = St.person(e); if (p) { var ahead = h.ovr - Hero.age() * 0 > p.o; e.rel += (starter > 0.6 && ahead) ? -0.5 : (starter < 0.4 ? 0.1 : -0.1); } }
      else if (e.role === 'capitan') e.rel += ms.length ? (ms.some(function (m) { return m.rt >= 7; }) ? 0.3 : 0) : 0;
      else e.rel += 0.05;
      e.rel = U.clamp(e.rel, -100, 100);
    });
    var avg = lk.people.length ? lk.people.reduce(function (s, e) { return s + e.rel; }, 0) / lk.people.length : 0;
    var target = U.clamp(50 + lk.coach * 0.2 + avg * 0.2 + def.mot * 20 + (starter - 0.5) * 10, 5, 98);
    lk.mood += (target - lk.mood) * 0.08;
    h.mor = U.clamp(h.mor + (lk.mood - 50) * 0.01 + (def.mot > 0.2 && h.mor < 70 ? 0.4 : 0), 0, 100);
    St.events(w);
  };
  St.events = function (w) {
    var S = FP.S, h = S.hero, lk = h.lk;
    if ((lk.cd.evt || 0) > w) return;
    var rival = lk.people.filter(function (e) { return e.role === 'rival'; })[0];
    if (rival && rival.rel <= -35 && R() < 0.2) {
      var p = St.person(rival); lk.cd.evt = w + 10;
      if (p) Dec.add({ kind: 'vestuario', uniq: 'riv' + Math.floor(w / 10), title: 'Tensión con ' + p.n, text: p.n + ', tu rival de puesto, está molesto con vos y el ambiente se resiente.', opts: [{ k: 'paz', label: 'Hacer las paces', hint: 'Baja la tensión; mejora el ánimo del grupo.' }, { k: 'plantar', label: 'Plantarte', hint: 'Marcas territorio: ganas respeto o dañas el clima.' }, { k: 'ignorar', label: 'Ignorarlo', hint: 'La tensión sigue.' }], def: 'ignorar', exp: 2, data: { pid: rival.pid } });
      return;
    }
    var cap = lk.people.filter(function (e) { return e.role === 'capitan'; })[0];
    if (cap && cap.rel >= 45 && lk.advice < w && R() < 0.06) { var cp = St.person(cap); lk.advice = w + 6; lk.cd.evt = w + 8; FP.Hero.msg((cp ? cp.n : 'El capitán') + ' te toma de lado y te da consejos para el juego: rindes mejor las próximas semanas.', 'ok'); }
    var club = S.clubs[lk.club], def = St.def(club);
    if (def.disc >= 2 && h.at.dis < 40 && R() < 0.05) { lk.cd.evt = w + 12; Dec.add({ kind: 'vestuario', uniq: 'dis' + Math.floor(w / 12), title: 'Llamado de atención del entrenador', text: club.co + ' te reprocha tu falta de disciplina táctica.', opts: [{ k: 'aceptar', label: 'Aceptar la crítica', hint: 'Recuperas su confianza.' }, { k: 'discutir', label: 'Discutir', hint: 'Dañas la relación.' }], def: 'aceptar', exp: 2, data: {} }); }
  };
  Dec.handlers.vestuario = function (k, d) {
    var h = FP.S.hero, lk = h.lk; if (!lk) return { ok: true, msg: '' };
    if (d.uniq && /^riv/.test(d.uniq)) {
      var e = lk.people.filter(function (x) { return x.pid === d.data.pid; })[0];
      if (k === 'paz') { if (e) e.rel = Math.min(0, e.rel + 25); lk.mood = Math.min(100, lk.mood + 4); return { ok: true, msg: 'Hacen las paces: el ambiente mejora.' }; }
      if (k === 'plantar') { if (R() < 0.5) { lk.coach += 2; return { ok: true, msg: 'Te plantás con firmeza y ganás respeto.' }; } if (e) e.rel -= 10; lk.mood -= 6; return { ok: true, msg: 'El choque deja una mala imagen: el clima se resiente.' }; }
      lk.mood -= 2; return { ok: true, msg: 'Dejás pasar la tensión.' };
    }
    if (k === 'aceptar') { lk.coach += 4; h.at.dis = Math.min(h.cap.dis, h.at.dis + 0.4); return { ok: true, msg: 'Aceptás la crítica: el entrenador valora tu actitud.' }; }
    lk.coach -= 12; h.mor = U.clamp(h.mor - 4, 0, 100); return { ok: true, msg: 'La discusión daña tu relación con el entrenador.' };
  };

  // acciones de la pantalla Vestuario
  St.act = function (kind, pid) {
    var S = FP.S, h = S.hero, lk = St.ensureLk(), w = S.week; if (!lk || lk.club == null) return { ok: false, msg: 'Necesitas estar en un club.' };
    var key = kind + (pid != null ? pid : ''); if ((lk.cd[key] || 0) > w) return { ok: false, msg: 'Ya lo hiciste hace poco: espera unas semanas.' };
    lk.cd[key] = w + 3;
    var e = lk.people.filter(function (x) { return x.pid === pid; })[0], p = e ? St.person(e) : null, nm = p ? p.n : '';
    if (kind === 'consejo' && e) {
      if (e.rel < 10 && R() < 0.5) { e.rel += 2; return { ok: false, msg: nm + ' responde con frialdad: todavía no hay confianza.' }; }
      e.rel = Math.min(100, e.rel + 6); lk.advice = w + 4; return { ok: true, msg: nm + ' te da un consejo útil: progresas algo más rápido unas semanas.' };
    }
    if (kind === 'salir') { lk.mood = Math.min(100, lk.mood + 4); h.mor = U.clamp(h.mor + 5, 0, 100); h.fat = U.clamp(h.fat - 4, 0, 100); if (e) e.rel = Math.min(100, e.rel + 7); return { ok: true, msg: 'Salís a comer con' + (nm ? ' ' + nm : ' el plantel') + ': mejora el ánimo.' }; }
    if (kind === 'ayuda' && e) { e.rel = Math.min(100, e.rel + 9); lk.mood = Math.min(100, lk.mood + 2); return { ok: true, msg: 'Ayudás a ' + nm + ': te lo agradece.' }; }
    if (kind === 'entrenador') {
      var club = S.clubs[lk.club], sit = FP.Contracts.situation(club);
      if (h.tk === 'pro' && sit.rank > 0 && lk.coach < 30) { lk.coach -= 3; return { ok: false, msg: 'El entrenador te responde que debés ganarte el puesto en la cancha.' }; }
      lk.coach = Math.min(100, lk.coach + 6); return { ok: true, msg: 'Conversás con ' + club.co + ': mejora la comunicación.' };
    }
    if (kind === 'pelea' && e) { e.rel -= 8; return { ok: true, msg: 'Retás a ' + nm + ' a mejorar: se siente el pique.' }; }
    return { ok: false, msg: 'Acción no disponible.' };
  };
  St.migrate = function () { St.ensure(); };

  // enlaces
  var weekEnd0 = Hero.weekEnd;
  Hero.weekEnd = function () { var r = weekEnd0.apply(this, arguments); try { St.weekly(FP.S.week); } catch (e) { if (window.console) console.warn('staff', e); } return r; };
})();
