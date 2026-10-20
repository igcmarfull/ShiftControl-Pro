/* FUTPRO — vida fuera de la cancha: estudios, familia y mudanza, adaptación al idioma y presión de la prensa.
   Cada área aporta decisiones (FP.Dec) y efectos pequeños y acotados sobre rendimiento, moral y confianza del club. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, Hero = FP.Hero, Dec = FP.Dec;
  var L = FP.Life = {};

  // idioma por región de nombres del juego
  var LANG = { es: 'Español', pt: 'Portugués', en: 'Inglés', en2: 'Inglés', it: 'Italiano', de: 'Alemán', fr: 'Francés', nl: 'Neerlandés', nd: 'Idioma nórdico', sl: 'Idioma local', tr: 'Turco', gr: 'Griego', ja: 'Japonés', ko: 'Coreano', zh: 'Chino', ar: 'Árabe', af: 'Idioma local' };
  var KEY = { en2: 'en' };
  L.langKey = function (country) { var r = FP.Names.region(country); return KEY[r] || r; };
  L.langName = function (key) { return LANG[key] || key; };
  // afinidad entre idiomas (parte que ya entiendes al empezar)
  var AFF = { es: { pt: 40, it: 28, fr: 18 }, pt: { es: 45, it: 25, fr: 18 }, it: { es: 28, pt: 25, fr: 22 }, fr: { it: 22, es: 18, pt: 18 }, de: { nl: 25 }, nl: { de: 25 } };

  L.ensure = function () {
    var S = FP.S, h = S && S.hero; if (!h) return null;
    if (!h.life) {
      var nk = L.langKey(h.nat), lang = {}; lang[nk] = 100; lang.en = Math.max(lang.en || 0, 25);
      h.life = { edu: { inten: 2, grade: 62, grad: false, mode: 'sec', uprog: 0, degree: false, hist: [] }, fam: { mode: 'casa', support: 55, homesick: 0, cost: 0 }, lang: lang, cls: false, adapt: 100, ctry: null, club: null,
        press: { img: 50, heat: 0, cd: 0, n: 0 }, ev: [] };
      if (L.age() >= 18) { h.life.edu.grad = true; h.life.edu.mode = 'none'; }
    }
    return h.life;
  };
  L.age = function () { return Hero.age(); };
  L.here = function () { return FP.Market.heroCountry(); };
  L.abroad = function () { var h = FP.S.hero; return h.tk !== 'free' && L.here() !== h.nat; };
  L.log = function (t) { var l = L.ensure(); l.ev.unshift({ w: FP.S.week, t: t }); if (l.ev.length > 60) l.ev.length = 50; };
  L.level = function (key) { var l = L.ensure(); if (l.lang[key] != null) return l.lang[key]; var best = 0, k; for (k in l.lang) best = Math.max(best, (AFF[k] && AFF[k][key] || 0) * l.lang[k] / 100); return Math.round(best); };
  L.localLevel = function () { return L.level(L.langKey(L.here())); };
  // penalización de rendimiento por adaptación e idioma (puntos de nivel, máx. ≈ 2.5)
  L.pen = function () {
    var h = FP.S.hero, l = h && h.life; if (!l || !L.abroad()) return 0;
    var lv = L.localLevel();
    return (100 - l.adapt) * 0.015 + Math.max(0, 60 - lv) / 60 * 1.0 + (l.fam.homesick > 60 ? (l.fam.homesick - 60) * 0.02 : 0);
  };
  L.trainMult = function () {
    var h = FP.S.hero, l = h && h.life; if (!l) return 1;
    var e = l.edu, age = L.age();
    if (age < 18 && !e.grad) return e.inten === 1 ? 1.03 : e.inten === 3 ? 0.95 : 1;
    if (e.mode === 'uni' && !e.degree) return e.inten === 1 ? 1 : e.inten === 3 ? 0.93 : 0.97;
    return 1;
  };

  // ---------- mudanza ----------
  L.moveCost = function () {
    var h = FP.S.hero, c = h.contract ? h.contract.wage || 0 : 0;
    return Math.round(25 + c * 0.04);
  };
  L.onMove = function (from, to) {
    var S = FP.S, h = S.hero, l = L.ensure(), age = L.age(), foreign = to.c !== h.nat, newCtry = to.c !== from.c;
    if (!newCtry) { l.adapt = Math.max(l.adapt, 85); h.mor = U.clamp(h.mor - 1, 0, 100); if (age < 18 && l.fam.mode === 'residencia') l.fam.homesick += 4; return; }
    var lang = L.langKey(to.c), lv = L.level(lang);
    l.adapt = foreign ? Math.round(40 + lv * 0.3) : 90;
    if (!foreign) { l.fam.mode = 'casa'; l.fam.homesick = Math.max(0, l.fam.homesick - 20); L.log('Vuelves a tu país: te reencuentras con tu gente.'); return; }
    var cost = L.moveCost(), can = h.money >= cost, minor = age < 18;
    var opts = [];
    opts.push({ k: 'familia', label: 'Mudanza con la familia (' + FP.fmt.money(cost) + ')', hint: 'Tu familia se instala contigo: menos nostalgia y mejor adaptación; lo pagas tú.' });
    opts.push(minor ? { k: 'residencia', label: 'Residencia del club', hint: 'Vives con otros juveniles: gratis, pero extrañas más y te adaptas más lento.' } : { k: 'solo', label: 'Mudarte solo', hint: 'Sin costo extra, pero con más nostalgia al principio.' });
    Dec.add({ kind: 'vida', uniq: 'mud' + S.week, title: 'Te mudas a ' + C.cname(to.c), text: 'Fichar en ' + C.cname(to.c) + ' significa dejar tu entorno' + (minor ? ' siendo menor de edad' : '') + '. ' + (lang !== L.langKey(h.nat) ? 'Se habla ' + L.langName(lang).toLowerCase() + ' (tu nivel: ' + lv + '%).' : '') + (can ? '' : ' Ahora mismo no tienes fondos para la mudanza familiar.'), opts: opts, def: minor ? 'residencia' : 'solo', exp: 3, data: { cost: cost } });
    l.fam.mode = minor ? 'residencia' : 'solo';
  };
  Dec.handlers.vida = function (k, d) {
    var S = FP.S, h = S.hero, l = L.ensure(), e = l.edu;
    var u = d.uniq || '';
    if (/^mud/.test(u)) {
      if (k === 'familia') {
        if (h.money < d.data.cost) { return { ok: false, msg: 'No tienes fondos para la mudanza familiar: te quedas ' + (L.age() < 18 ? 'en la residencia.' : 'solo.') }; }
        FP.Contracts.pay(-d.data.cost, 'inversion', 'Mudanza familiar'); l.fam.mode = 'familia'; l.fam.support = Math.min(100, l.fam.support + 8); l.fam.cost = d.data.cost; L.log('Tu familia se muda contigo.');
        return { ok: true, msg: 'Tu familia se muda contigo.' };
      }
      return { ok: true, msg: k === 'residencia' ? 'Te instalas en la residencia del club.' : 'Te mudas solo.' };
    }
    if (/^nost/.test(u)) {
      if (k === 'visitar') { var c = Math.round(8 + L.moveCost() * 0.2); if (h.money >= c) FP.Contracts.pay(-c, 'inversion', 'Viaje a casa'); l.fam.homesick = Math.max(0, l.fam.homesick - 35); h.mor = U.clamp(h.mor + 6, 0, 100); return { ok: true, msg: 'Viajas a casa unos días: vuelves renovado.' }; }
      if (k === 'llamar') { l.fam.homesick = Math.max(0, l.fam.homesick - 12); return { ok: true, msg: 'Hablas largo con tu familia: te sientes algo mejor.' }; }
      h.mor = U.clamp(h.mor - 6, 0, 100); return { ok: true, msg: 'Aguantas la nostalgia: tu ánimo se resiente.' };
    }
    if (/^notas/.test(u)) {
      if (k === 'estudiar') { e.inten = 3; e.boost = S.week + 8; e.grade = Math.min(100, e.grade + 6); l.fam.support = Math.min(100, l.fam.support + 4); return { ok: true, msg: 'Le dedicas más tiempo al estudio: sube tu promedio, pero entrenas con menos energía unas semanas.' }; }
      l.fam.support = Math.max(0, l.fam.support - 8); if (h.ct != null && (h.tk === 'academy')) h.ct = Math.max(5, h.ct - 3); return { ok: true, msg: 'Ignoras las notas: tu familia y el club lo notan.' };
    }
    if (/^grad/.test(u)) {
      if (k === 'uni') { e.mode = 'uni'; e.inten = 2; e.uprog = 0; L.log('Empiezas una carrera universitaria a distancia.'); return { ok: true, msg: 'Empiezas una carrera universitaria a distancia.' }; }
      if (k === 'sec') { e.mode = 'sec'; e.inten = 2; return { ok: true, msg: 'Retomas la secundaria en horario nocturno.' }; }
      e.mode = 'none'; return { ok: true, msg: 'Te dedicas por completo al fútbol.' };
    }
    if (/^prs/.test(u)) return L.pressReply(k, d);
    return { ok: true, msg: '' };
  };

  // ---------- prensa ----------
  L.PRESS = {
    criticas: { nm: 'Críticas de la prensa', stances: [['honesto', 'Reconocer el mal momento', 'Gana respeto; baja algo la presión.'], ['respuesta', 'Responder en el campo', 'Te focaliza; si rindes, sube tu imagen.'], ['polemico', 'Contestar con dureza', 'Riesgoso: puede encender al público o al vestuario.'], ['silencio', 'No hablar con la prensa', 'La presión sigue un tiempo.']] },
    entrevista: { nm: 'Entrevista tras tu gran partido', stances: [['humilde', 'Ser humilde y destacar al equipo', 'Mejor imagen y vestuario.'], ['seguro', 'Mostrar confianza', 'Sube tu fama; algo de presión.'], ['polemico', 'Lanzar un mensaje fuerte', 'Mucha atención, con riesgo.'], ['silencio', 'Declinar la entrevista', 'Pasas desapercibido.']] },
    rumores: { nm: 'Rumores de traspaso', stances: [['leal', 'Declarar tu lealtad al club', 'Gusta en el club y la afición.'], ['abierto', 'Dejar la puerta abierta', 'Sube tu valor; el club se incomoda.'], ['polemico', 'Insinuar que quieres irte', 'Presiona al club; riesgo con el entrenador.'], ['silencio', 'Sin comentarios', 'Neutral.']] },
    expulsion: { nm: 'Polémica por tu expulsión', stances: [['honesto', 'Pedir disculpas públicas', 'Calma el ambiente.'], ['respuesta', 'Defender tu versión', 'Puede dividir opiniones.'], ['polemico', 'Culpar al árbitro', 'Riesgo de sanción de imagen.'], ['silencio', 'No hablar', 'La polémica sigue unos días.']] }
  };
  var EFF = {
    honesto: { img: [2, 4], mor: 2, coach: 2, heat: -12 }, respuesta: { img: [-1, 4], mor: 2, coach: 0, heat: -4 }, silencio: { img: [-2, 0], mor: 0, coach: 0, heat: 4 },
    humilde: { img: [3, 5], mor: 2, coach: 2, heat: -6, mood: 3 }, seguro: { img: [1, 5], mor: 3, coach: 0, heat: 8, fame: 3 },
    leal: { img: [3, 5], mor: 2, coach: 4, heat: -10 }, abierto: { img: [-2, 3], mor: 1, coach: -3, heat: 6, fame: 2 },
    polemico: { img: [-9, 8], mor: 0, coach: -4, heat: 14, fame: 5, mood: -3 }
  };
  L.pressReply = function (k, d) {
    var S = FP.S, h = S.hero, l = L.ensure(), e = EFF[k] || EFF.silencio, p = l.press, lk = h.lk;
    var di = e.img[0] + R() * (e.img[1] - e.img[0]);
    p.img = U.clamp(p.img + di, 0, 100); p.heat = U.clamp(p.heat + e.heat, 0, 100); h.mor = U.clamp(h.mor + e.mor, 0, 100);
    if (lk) { lk.coach = U.clamp(lk.coach + e.coach, -100, 100); if (e.mood) lk.mood = U.clamp(lk.mood + e.mood, 0, 100); }
    if (h.soc && e.fame) h.soc.fame = (h.soc.fame || 0) + e.fame;
    var good = di > 1.5;
    return { ok: true, msg: (good ? 'Tus palabras caen bien: ' : di < -1 ? 'Tus palabras generan polémica: ' : 'Sin mayores consecuencias: ') + 'tu imagen pública ' + (di >= 0 ? 'sube a ' : 'baja a ') + Math.round(p.img) + '.' };
  };
  L.pressEvent = function (w) {
    var S = FP.S, h = S.hero, l = L.ensure(), p = l.press, age = L.age(); if (age < 15 || p.cd > w) return;
    var recent = h.log.filter(function (m) { return w - m.w <= 3 && m.rt; });
    var fame = (h.soc && h.soc.fame || 0) + (h.rep ? h.rep.nat : 0) * 2 + (h.tk === 'pro' ? 6 : 0);
    if (fame < 8) return;
    var kind = null;
    var red = h.log.filter(function (m) { return w - m.w <= 1 && m.rc; })[0];
    if (red && R() < 0.5) kind = 'expulsion';
    else if (recent.length >= 3 && recent.reduce(function (s, m) { return s + m.rt; }, 0) / recent.length < 5.9 && R() < 0.35) kind = 'criticas';
    else if (recent.some(function (m) { return (m.rt >= 8.5 || m.g >= 3) && w - m.w <= 1; }) && R() < 0.25) kind = 'entrevista';
    else if (h.tk === 'pro' && h.offers.some(function (o) { return o.type === 'transfer'; }) && R() < 0.3) kind = 'rumores';
    if (!kind) return;
    p.cd = w + 12; p.n++;
    var def = L.PRESS[kind];
    Dec.add({ kind: 'vida', uniq: 'prs' + kind + w, title: def.nm, text: 'Los medios te piden declaraciones' + (kind === 'criticas' ? ' tras tus últimos partidos.' : kind === 'entrevista' ? '.' : kind === 'rumores' ? ' sobre tu futuro.' : '.') + ' Tu imagen pública es de ' + Math.round(p.img) + '.', opts: def.stances.map(function (s) { return { k: s[0], label: s[1], hint: s[2] }; }), def: 'silencio', exp: 2, data: { kind: kind } });
  };

  // ---------- semana ----------
  L.weekly = function (w) {
    var S = FP.S, h = S.hero, l = L.ensure(); if (!h || h.retired) return;
    var age = L.age(), e = l.edu, f = l.fam, p = l.press;
    // mudanza / cambio de club
    var here = L.here(), cur = { club: h.club, c: here };
    if (l.club !== undefined && l.ctry && h.tk !== 'free' && h.club != null && (l.club !== h.club)) L.onMove({ club: l.club, c: l.ctry }, cur);
    if (h.tk !== 'free') { l.club = h.club; l.ctry = here; }
    // idioma
    if (L.abroad()) {
      var key = L.langKey(here), lv = L.level(key);
      var g = 0.35 + (l.cls ? 0.9 : 0) + (f.mode === 'familia' ? 0.1 : 0.25);          // sin la familia hay que integrarse más rápido
      l.lang[key] = Math.min(100, (l.lang[key] != null ? l.lang[key] : lv) + g);
      if (l.cls && h.money > 0 && w % 4 === 0) FP.Contracts.pay(-3, 'inversion', 'Clases de ' + L.langName(key).toLowerCase());
      l.adapt = Math.min(100, l.adapt + 0.6 + lv / 100 * 0.8 + (f.mode === 'familia' ? 0.5 : 0));
      f.homesick = U.clamp(f.homesick + (f.mode === 'residencia' ? 0.9 : f.mode === 'solo' ? 0.5 : -1.2), 0, 100);
    } else { l.adapt = Math.min(100, l.adapt + 3); f.homesick = Math.max(0, f.homesick - 2); if (f.mode !== 'casa' && !L.abroad()) f.mode = 'casa'; }
    h.mor = U.clamp(h.mor - f.homesick * 0.006 + (f.support - 50) * 0.003 + (p.img - 50) * 0.002 - p.heat * 0.004, 0, 100);
    if (f.homesick > 70 && R() < 0.15) Dec.add({ kind: 'vida', uniq: 'nost' + Math.floor(w / 12), title: 'Nostalgia', text: 'Extrañas tu casa y tu gente: te cuesta concentrarte.', opts: [{ k: 'visitar', label: 'Viajar a casa unos días', hint: 'Cuesta dinero; baja mucho la nostalgia.' }, { k: 'llamar', label: 'Hablar con tu familia', hint: 'Alivia algo, sin costo.' }, { k: 'aguantar', label: 'Aguantar', hint: 'Sin costo, pero tu ánimo se resiente.' }], def: 'llamar', exp: 3 });
    // estudios
    if (e.boost && w > e.boost) { e.boost = 0; e.inten = 2; }
    if (age < 18 && !e.grad && e.mode !== 'none') {
      var target = 38 + e.inten * 15 + (h.tk === 'academy' ? 0 : 3) - (h.fat > 75 ? 6 : 0);
      e.grade = U.clamp(e.grade + (target - e.grade) * 0.04 + (R() - 0.5) * 0.8, 10, 100);
      h.fat = U.clamp(h.fat + (e.inten - 2) * 0.8, 0, 100);
      if (e.grade < 45 && h.ct != null && h.tk === 'academy') h.ct = Math.max(5, h.ct - 0.15);
      if (w % 13 === 0 && e.grade < 45) Dec.add({ kind: 'vida', uniq: 'notas' + Math.floor(w / 13), title: 'Notas bajas en el colegio', text: 'Tu promedio es ' + Math.round(e.grade) + '. ' + (h.tk === 'academy' ? 'La cantera y tu familia esperan que cumplas con los estudios.' : 'Tu familia está preocupada.'), opts: [{ k: 'estudiar', label: 'Dedicarle más tiempo', hint: 'Sube tu promedio; entrenas con algo menos de energía unas semanas.' }, { k: 'ignorar', label: 'Priorizar el fútbol', hint: 'Más tiempo para entrenar, pero baja la confianza de tu familia y del club.' }], def: 'ignorar', exp: 4 });
    }
    var a = Math.floor(Hero.ageF()), prev = Math.floor(C.ageF(S.pl[0], w - 1));
    if (a === 18 && prev < 18 && !e.grad && e.mode === 'sec') {
      e.grad = e.grade >= 50; e.hist.push({ w: w, t: e.grad ? 'Egresas del colegio con promedio ' + Math.round(e.grade) : 'No completas la secundaria' });
      L.log(e.grad ? 'Terminas el colegio con promedio ' + Math.round(e.grade) + '.' : 'No logras completar la secundaria.');
      Hero.msg(e.grad ? '¡Terminas el colegio! Promedio ' + Math.round(e.grade) + '.' : 'No pudiste completar la secundaria.', e.grad ? 'ok' : 'warn');
      Dec.add({ kind: 'vida', uniq: 'grad' + w, title: e.grad ? 'Terminaste el colegio: ¿y ahora?' : 'Secundaria incompleta: ¿qué haces?', text: e.grad ? 'Puedes compaginar una carrera universitaria a distancia con el fútbol.' : 'Puedes retomarla de noche o dedicarte solo al fútbol.', opts: e.grad ? [{ k: 'uni', label: 'Estudiar una carrera a distancia', hint: 'Cuesta energía, pero te da un título para después del fútbol.' }, { k: 'none', label: 'Solo fútbol', hint: 'Todo el tiempo para entrenar.' }] : [{ k: 'sec', label: 'Retomar de noche', hint: 'Tiempo y energía a cambio de completar los estudios.' }, { k: 'none', label: 'Solo fútbol', hint: 'Sin estudios formales.' }], def: 'none', exp: 6 });
    }
    if (e.mode === 'uni' && !e.degree) {
      e.uprog += 0.2 + 0.14 * e.inten; h.fat = U.clamp(h.fat + (e.inten - 1) * 0.5, 0, 100);
      if (e.uprog >= 100) { e.degree = true; e.mode = 'none'; e.hist.push({ w: w, t: 'Título universitario' }); L.log('Obtienes tu título universitario.'); Hero.msg('¡Te recibes! Obtienes tu título universitario.', 'ok'); }
    } else if (e.mode === 'sec' && e.grad === false && age >= 18) {
      e.uprog += 0.5 + 0.1 * e.inten;
      if (e.uprog >= 60) { e.grad = true; e.mode = 'none'; e.uprog = 0; L.log('Completas la secundaria.'); Hero.msg('Completas la secundaria.', 'ok'); }
    }
    p.heat = Math.max(0, p.heat * 0.93 - 0.2); p.img = U.clamp(p.img + (50 - p.img) * 0.004, 0, 100);
    L.pressEvent(w);
  };
  L.migrate = function () { L.ensure(); };

  // ---------- enlaces ----------
  var weekEnd0 = Hero.weekEnd;
  Hero.weekEnd = function () { var r = weekEnd0.apply(this, arguments); try { L.weekly(FP.S.week); } catch (e) { if (window.console) console.warn('life', e); } return r; };
  var view0 = Hero.view;
  Hero.view = function (instr, pen) { return view0.call(Hero, instr, (pen || 0) + L.pen()); };
})();
