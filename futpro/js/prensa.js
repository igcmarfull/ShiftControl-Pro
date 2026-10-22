/* FUTPRO — prensa deportiva y ánimo de la hinchada.
   Tras cada partido oficial de tu club, medios del país escriben titulares con el tono propio de cada uno (serio, popular, digital, radio) y la hinchada
   reacciona según el resultado, la expectativa, el derbi y la racha. Los nombres de medios son reales y los titulares son inventados por el juego:
   es contenido de ficción para uso personal, no son notas publicadas por esos medios ni citan a personas reales.
   No usa el azar de la partida (los titulares salen de un hash de la semana, el partido y el medio): no cambia partidos, estadísticas ni guardados previos.
   Guarda en h.press: feed, ánimo y racha. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, Hero = FP.Hero;
  var Pr = FP.Prensa = { off: false };

  // medios por país: [nombre, tono]. Tonos: serio (diario de referencia), popular (tabloide o deportivo masivo), digital (portal), radio
  Pr.OUTLETS = {
    CHI: [['La Tercera', 'serio'], ['Cooperativa', 'radio'], ['Redgol', 'digital'], ['La Cuarta', 'popular'], ['Radio ADN', 'radio']],
    ARG: [['Olé', 'popular'], ['TyC Sports', 'digital'], ['Clarín', 'serio'], ['La Nación', 'serio'], ['Infobae', 'digital']],
    BRA: [['Globo Esporte', 'serio'], ['Lance!', 'popular'], ['UOL Esporte', 'digital'], ['ESPN Brasil', 'digital']],
    URU: [['Referí', 'popular'], ['El País', 'serio'], ['Ovación', 'serio']],
    COL: [['El Tiempo', 'serio'], ['Win Sports', 'digital'], ['El Espectador', 'serio'], ['Gol Caracol', 'radio']],
    PER: [['Libero', 'popular'], ['El Comercio', 'serio'], ['Depor', 'popular']],
    ECU: [['El Universo', 'serio'], ['Diario Extra', 'popular'], ['Ecuavisa', 'radio']],
    PAR: [['ABC Color', 'serio'], ['Última Hora', 'popular']],
    MEX: [['Récord', 'popular'], ['Mediotiempo', 'digital'], ['TUDN', 'radio'], ['El Universal', 'serio'], ['ESPN México', 'digital']],
    USA: [['ESPN', 'digital'], ['The Athletic', 'serio'], ['CBS Sports', 'digital'], ['MLSsoccer.com', 'digital']],
    ESP: [['Marca', 'popular'], ['AS', 'popular'], ['Mundo Deportivo', 'serio'], ['Sport', 'popular'], ['Relevo', 'digital']],
    ENG: [['BBC Sport', 'serio'], ['The Guardian', 'serio'], ['The Sun', 'popular'], ['Sky Sports', 'digital'], ['Daily Mail', 'popular']],
    SCO: [['BBC Sport Scotland', 'serio'], ['Daily Record', 'popular'], ['The Scotsman', 'serio']],
    ITA: [['La Gazzetta dello Sport', 'popular'], ['Corriere dello Sport', 'popular'], ['Tuttosport', 'popular'], ['Sky Sport Italia', 'digital']],
    GER: [['Kicker', 'serio'], ['Bild', 'popular'], ['Sport1', 'digital'], ['Sportschau', 'serio']],
    FRA: [['L\'Équipe', 'serio'], ['RMC Sport', 'radio'], ['Le Parisien', 'popular'], ['Canal+', 'digital']],
    POR: [['A Bola', 'popular'], ['Record', 'popular'], ['O Jogo', 'serio']],
    NED: [['Voetbal International', 'serio'], ['De Telegraaf', 'popular'], ['ESPN Nederland', 'digital']],
    BEL: [['Het Laatste Nieuws', 'popular'], ['Het Nieuwsblad', 'serio']],
    TUR: [['Fanatik', 'popular'], ['Hürriyet', 'serio'], ['NTV Spor', 'digital']],
    GRE: [['Sport24', 'digital'], ['Gazzetta Greece', 'popular']],
    RUS: [['Sport-Express', 'popular'], ['Match TV', 'digital']],
    JPN: [['Nikkan Sports', 'popular'], ['Sponichi', 'popular'], ['Number', 'serio']],
    KOR: [['Sports Seoul', 'popular'], ['Yonhap', 'serio']],
    CHN: [['Titan Sports', 'popular'], ['Xinhua Sports', 'serio']],
    KSA: [['Arriyadiyah', 'serio'], ['Asharq Al-Awsat', 'serio'], ['SSC Sports', 'digital']],
    AUS: [['The Age', 'serio'], ['Fox Sports Australia', 'digital']],
    EGY: [['Al-Ahram', 'serio'], ['Kooora', 'digital']], MAR: [['Le Matin', 'serio'], ['Hespress', 'digital']], RSA: [['SuperSport', 'digital'], ['The Citizen', 'popular']]
  };
  var GENERIC = [['La prensa deportiva local', 'serio'], ['El portal deportivo del país', 'digital'], ['La radio deportiva local', 'radio'], ['El diario popular', 'popular']];
  Pr.outlets = function (cc) { return Pr.OUTLETS[cc] || GENERIC; };

  // titulares por situación y tono. {c} club propio · {o} rival · {s} marcador · {n} protagonista (nombre de pila) · {k} competición
  var T = {
    win: {
      serio: ['{c} se impone a {o} ({s}) y suma tres puntos importantes', 'Victoria de {c} ante {o}: {s}', '{c} supera a {o} por {s} en {k}'],
      popular: ['¡{c} se lo llevó! {s} a {o}', 'Triunfazo de {c}: {s} y a celebrar', '{o} se fue con las manos vacías ({s})'],
      digital: ['Resumen y goles: {c} {s} {o}', 'Así fue el triunfo de {c} sobre {o}', '{c} gana y mira hacia arriba'],
      radio: ['Se terminó en el estadio: ganó {c}, {s}', 'Final del partido: {c} derrotó a {o}', 'Ganó {c} y la gente se va contenta']
    },
    narrow: {
      serio: ['{c} sufre, pero vence a {o} ({s})', 'Triunfo ajustado de {c} frente a {o}', '{c} resuelve un partido cerrado: {s}'],
      popular: ['¡Agónico! {c} le ganó {s} a {o}', 'Sufrió, pero {c} se quedó con los tres puntos', '{c} se salvó y ganó por la mínima'],
      digital: ['{c} {s} {o}: victoria sufrida', 'Por detalles, ganó {c}', 'Ajustado pero válido: {c} suma de a tres'],
      radio: ['Gol y a aguantar: {c} gana {s}', 'Se sufrió hasta el final: victoria de {c}', 'Ganó {c} por poquito']
    },
    thrash: {
      serio: ['{c} golea a {o} ({s}) y deja una exhibición', 'Contundente victoria de {c}: {s} a {o}', 'Goleada de {c} en {k}'],
      popular: ['¡Paliza! {c} le metió {s} a {o}', 'Una masacre: {c} aplastó a {o}', '¡Fiesta total! {s} de {c}'],
      digital: ['Goleada histórica: {c} {s} {o}', '{c} no tuvo piedad con {o}', 'El baile de {c}: los goles de la goleada'],
      radio: ['¡Goleada! {c} no dio opción: {s}', 'Se desbordó el estadio: {s} de {c}', 'Una tarde para recordar: {c} arrasa a {o}']
    },
    draw: {
      serio: ['{c} y {o} empatan ({s}) en {k}', 'Reparto de puntos entre {c} y {o}', '{c} no pasa del empate ante {o}'],
      popular: ['{c} se quedó a medias: {s} con {o}', 'Empate sin gloria para {c}', '{o} le sacó un punto a {c}'],
      digital: ['{c} {s} {o}: igualdad en {k}', 'Empate que sabe a poco para {c}', 'Resumen: {c} y {o} se reparten los puntos'],
      radio: ['Terminó el partido: {c} igualó {s} con {o}', 'Empate al final, {c} suma un punto', 'Se repartieron los puntos {c} y {o}']
    },
    loss: {
      serio: ['{c} cae ante {o} ({s}) en {k}', 'Derrota de {c}: {o} se lleva los puntos', '{c} no encuentra respuestas y pierde {s}'],
      popular: ['¡Papelón! {c} perdió {s} con {o}', 'Dolió: {o} le ganó a {c}', '{c} se cayó y la hinchada no perdona'],
      digital: ['{c} {s} {o}: derrota que complica', 'Derrota de {c}: qué pasó en la cancha', 'Cae {c} y se encienden las alarmas'],
      radio: ['Final del partido: perdió {c}, {s}', 'Derrota de {c} y malestar en las tribunas', 'Se fue el partido: {o} le ganó a {c}']
    },
    bust: {
      serio: ['{c} sufre una dura derrota ({s}) ante {o}', 'Revés contundente para {c}: {s}', '{o} supera por completo a {c}'],
      popular: ['¡Vergüenza! {o} le metió {s} a {c}', 'Humillación de {c}: {s}', 'Pasó por encima: {o} aplastó a {c}'],
      digital: ['Goleada en contra: {c} {s} {o}', 'Noche negra de {c}: qué falló', 'Así fue la caída más dura de {c}'],
      radio: ['Goleada en contra: {c} perdió {s}', 'Dura caída de {c}: el vestuario, en silencio', '{o} goleó y {c} no reaccionó']
    },
    derbyW: {
      serio: ['{c} gana el clásico ante {o} ({s})', 'Triunfo de peso: {c} se queda con el derbi', '{c} supera a {o} en el derbi'],
      popular: ['¡DERBI! {c} le ganó a {o}', 'Fiesta en el barrio: {c} ganó el clásico', '{o} se la lleva negra: {c} ganó el derbi'],
      digital: ['{c} gana el derbi: las claves', 'Clásico para {c}: {s} a {o}', 'Cómo {c} se quedó con el derbi'],
      radio: ['¡Se ganó el clásico! {c}, {s} a {o}', 'Derbi ganado: explotó el estadio', 'Festejo total: {c} se llevó el clásico']
    },
    derbyL: {
      serio: ['{o} se impone a {c} en el derbi ({s})', 'Derbi perdido: {c} cae ante {o}', 'Dura derrota de {c} en el clásico'],
      popular: ['¡Derbi perdido! {o} le ganó a {c}', 'Duele más: {c} perdió el clásico', '{o} festeja en casa de {c}'],
      digital: ['Derbi: {o} gana {s} y {c} se hunde', 'Derrota de {c} en el clásico: qué falló', 'Lo que dejó el derbi para {c}'],
      radio: ['Se perdió el clásico: {o} {s}', 'Derbi para {o}, tristeza para {c}', 'Cayó {c} en el clásico']
    },
    streakW: {
      serio: ['{c} suma {m} victorias seguidas', 'Racha de {m} triunfos: {c} se consolida', '{c} encadena {m} partidos ganados'],
      popular: ['¡{m} seguidas! {c} no para', 'Imparable: {c} lleva {m} triunfos al hilo', 'Fiesta sin freno: {m} victorias'],
      digital: ['{c} lleva {m} victorias consecutivas: cómo lo hace', 'La racha de {m} de {c}', 'Récord en marcha: {m} triunfos de {c}'],
      radio: ['Ya van {m} triunfos seguidos para {c}', '{c} suma otra: {m} al hilo', 'Racha de {m} y la gente ilusionada']
    },
    streakL: {
      serio: ['{c} acumula {m} derrotas seguidas', 'Crisis: {c} pierde por {m}.ª vez consecutiva', 'Preocupación en {c} tras {m} caídas'],
      popular: ['¡Crisis! {m} derrotas seguidas de {c}', 'Esto no puede seguir: {m} caídas de {c}', 'La hinchada explota: {m} derrotas'],
      digital: ['{c} y su mala racha: {m} derrotas', 'Qué le pasa a {c}: {m} partidos sin ganar', 'Las claves de la crisis de {c}'],
      radio: ['Otra derrota: ya son {m} seguidas para {c}', 'Clima espeso en {c} tras {m} caídas', 'Se agranda la crisis: {m} derrotas']
    },
    star: {
      serio: ['{n} fue la figura de {c} ante {o}', 'Partido sobresaliente de {n} en {k}', '{n} marca diferencias en {c}'],
      popular: ['¡{n} la rompió! Figura ante {o}', 'Qué crack: {n} se comió la cancha', '{n} es la gran figura de {c}'],
      digital: ['{n}: así fue su partidazo ante {o}', 'La actuación de {n}, en datos', '{n} se roba el partido'],
      radio: ['Gran partido de {n}: la gente lo ovaciona', '{n}, la figura de la jornada', 'Se pidió su nombre: {n}']
    },
    scorer: {
      serio: ['{n} marca y es clave en el triunfo de {c}', 'Gol de {n} ante {o}', '{n} anota para {c}'],
      popular: ['¡Gol de {n}! La mandó a guardar', '{n} la clavó: gol y a celebrar', 'Otra vez {n}: gol ante {o}'],
      digital: ['El gol de {n} ante {o}: el video', '{n} suma otro gol con {c}', 'Gol de {n}: así lo gritó el estadio'],
      radio: ['¡Gol de {n}! Se grita en todo el estadio', 'Marcó {n} y {c} respira', 'Gol, gol, gol: {n}']
    },
    flop: {
      serio: ['{n} no logra influir en el partido de {c}', 'Partido discreto de {n} ante {o}', 'Críticas a {n} tras el partido'],
      popular: ['¿Qué le pasó a {n}? Se borró ante {o}', '{n} desaparecido en la cancha', 'Las dudas sobre {n} crecen'],
      digital: ['{n}, bajo la lupa tras su mal partido', 'La noche gris de {n}', 'Por qué {n} no rindió ante {o}'],
      radio: ['Mal partido de {n}: la gente se lo hizo saber', 'Sin brillo: {n} no tuvo su tarde', '{n} deberá levantarse']
    }
  };
  // reacciones de la hinchada según el ánimo: [situación][ánimo]
  var FANS = {
    win: ['Hoy sí, vamos {c}. Así se juega.', 'Se ganó con ganas, eso queremos ver.', 'Tres puntos más. ¡Que siga la racha!', 'La gente salió contenta del estadio.'],
    loss: ['No se puede jugar así, esto es {c}.', 'Duele, pero seguimos. Hay que levantarse.', 'Se pierde con dignidad, pero hay que corregir.', 'Silbidos en las tribunas: la paciencia se agota.'],
    derbyW: ['¡Ganamos el clásico! Esto no se olvida.', 'Hoy se festeja hasta tarde: derbi ganado.', 'Se lo dedicamos a toda la gente que alienta siempre.'],
    derbyL: ['Perder el clásico duele el triple.', 'Una derrota que no se perdona fácil.', 'Hay que dar la cara: era el partido de todos.'],
    thrash: ['¡Qué baile! Ya quería ver algo así.', 'Goleada y show: la hinchada, feliz.'],
    bust: ['Hoy no hubo reacción. Así no.', 'La gente se fue antes del final: mal, muy mal.'],
    streakW: ['Cada semana más ilusionados. ¡Vamos!', 'La racha hace creer en grande.'],
    streakL: ['Esto es crisis, que alguien lo diga.', 'Hay que cambiar algo ya.']
  };
  // etiquetas del ánimo de la hinchada
  Pr.moodLabel = function (m) { return m >= 80 ? 'Euforia' : m >= 65 ? 'Ilusión' : m >= 40 ? 'Estable' : m >= 25 ? 'Tensión' : 'Crisis'; };
  Pr.moodText = function (m) {
    return m >= 80 ? 'La hinchada vive un gran momento: estadio lleno y cánticos hasta el final.' : m >= 65 ? 'Hay ilusión en las tribunas y la gente confía en el equipo.' : m >= 40 ? 'Ambiente tranquilo, a la espera de resultados.' : m >= 25 ? 'La paciencia se acaba: se escuchan reclamos y silbidos.' : 'Clima de crisis: protestas fuera del estadio y pedidos de cambios.';
  };

  Pr.ensure = function () { var h = FP.S.hero; if (!h.press) h.press = { feed: [], mood: 50, w: -99, str: 0, n: 0 }; return h.press; };
  function hash(s) { return U.hash(s); }
  function fill(t, o) { return t.replace(/\{(\w)\}/g, function (m, k) { return o[k] != null ? o[k] : m; }); }
  function pick(arr, key, taken) { var i = hash(key) % arr.length, k = 0; while (k++ < arr.length && taken.indexOf(fill(arr[i], taken.o || {})) >= 0) i = (i + 1) % arr.length; return arr[i]; }

  Pr.situation = function (r, club, opp, derby, str) {
    var p = String(r.s).match(/(\d+)-(\d+)/); if (!p) return null;
    var a = +p[1], b = +p[2], d = a - b;
    if (derby && r.r === 'V') return 'derbyW';
    if (derby && r.r === 'D') return 'derbyL';
    if (r.r === 'V' && d >= 3) return 'thrash';
    if (r.r === 'D' && d <= -3) return 'bust';
    if (str >= 4 && r.r === 'V' && str % 2 === 0) return 'streakW';
    if (str <= -4 && r.r === 'D' && str % 2 === 0) return 'streakL';
    return r.r === 'V' ? (d === 1 ? 'narrow' : 'win') : r.r === 'D' ? 'loss' : 'draw';
  };

  // un partido nuevo del club del protagonista
  Pr.onMatch = function (r, official) {
    if (Pr.off || !r || !official || r.k === 'juv' || r.k === 'amat' || r.k === 'amis' || (typeof r.cid === 'string' && /^[YA]:/.test(r.cid))) return;       // solo fútbol profesional (no divisiones menores ni amateur)
    var S = FP.S, h = S.hero, st = Pr.ensure(), cid = h.club != null ? h.club : h.team; if (cid == null || cid < 0) return;
    var club = S.clubs[cid], opp = S.clubs[r.o]; if (!club || !opp) return;
    // racha de resultados oficiales (positiva = victorias, negativa = derrotas)
    st.str = r.r === 'V' ? Math.max(0, st.str) + 1 : r.r === 'D' ? Math.min(0, st.str) - 1 : 0;
    var derby = !!(FP.Derbis && FP.Derbis.is(cid, r.o)), sit = Pr.situation(r, club, opp, derby, st.str); if (!sit) return;
    // ánimo: resultado × expectativa (el que se esperaba pesa menos) × derbi
    var gap = (club.st || 50) - (opp.st || 50), exp = U.clamp(gap / 25, -1, 1), base = r.r === 'V' ? 4 : r.r === 'D' ? -5 : (gap < -8 ? 1 : gap > 8 ? -2 : 0);
    var mult = (r.r === 'V' ? 1 - exp * 0.4 : r.r === 'D' ? 1 + exp * 0.4 : 1) * (derby ? 1.5 : 1) * (sit === 'thrash' || sit === 'bust' ? 1.3 : 1);
    var gone = Math.max(0, S.week - st.w), m0 = st.mood; if (st.w > -90) st.mood += (50 - st.mood) * Math.min(0.5, gone * 0.03);
    st.mood = U.clamp(Math.round((st.mood + base * mult) * 10) / 10, 0, 100); st.w = S.week; st.n++;
    var tierChanged = Pr.moodLabel(m0) !== Pr.moodLabel(st.mood);
    // titulares: dos medios distintos del país (tonos distintos si es posible)
    var outs = Pr.outlets(club.c), taken = st.feed.slice(0, 30).map(function (x) { return x.t; });
    // {s}: marcador con el ganador primero
    var o = { c: C.tname(cid), o: C.tname(r.o), s: (function () { var m = String(r.s).match(/(\d+)-(\d+)/); return m ? (r.r === 'D' ? m[2] + '-' + m[1] : m[1] + '-' + m[2]) : r.s; })(), n: h.nm.split(' ')[0], k: r.c, m: Math.abs(st.str) };
    var key = S.seed + '|' + S.week + '|' + cid + '|' + r.o + '|' + sit, used = {};
    function add(sit2, idxOut, kind) {
      var out = outs[(hash(key + '|' + idxOut) + (kind || 0)) % outs.length], k = 0;
      while ((used[out[0]]) && k++ < outs.length) out = outs[(outs.indexOf(out) + 1) % outs.length];
      used[out[0]] = 1;
      var arr = T[sit2][out[1]] || T[sit2].serio, i = hash(key + '|' + out[0] + sit2) % arr.length, tt = fill(arr[i], o), j = 0;
      while (taken.indexOf(tt) >= 0 && j++ < arr.length) { i = (i + 1) % arr.length; tt = fill(arr[i], o); }
      taken.push(tt); st.feed.unshift({ w: S.week, k: 'prensa', o: out[0], tn: out[1], t: tt, c: r.c, sit: sit2 });
    }
    add(sit, 0); add(sit, 1, 3);
    // protagonista: figura, gol o mal partido
    if (r.rt >= 8.3) add('star', 2); else if (r.g >= 1 && sit !== 'thrash') add('scorer', 2); else if (r.rt && r.rt < 5.3 && r.role !== 'banca') add('flop', 2);
    // la hinchada habla en los partidos que cuentan o al cambiar su ánimo
    var fk = FANS[sit] ? sit : (r.r === 'V' ? 'win' : r.r === 'D' ? 'loss' : null);
    if (fk && (derby || tierChanged || sit === 'thrash' || sit === 'bust' || sit.indexOf('streak') === 0 || hash(key + 'f') % 3 === 0)) {
      var fa = FANS[fk], ft = fill(fa[hash(key + 'fan') % fa.length], o); if (taken.indexOf(ft) < 0) st.feed.unshift({ w: S.week, k: 'hinchada', o: 'Hinchada de ' + o.c, tn: 'hinchada', t: ft, c: r.c, sit: fk });
    }
    if (st.feed.length > 160) st.feed.length = 100;
  };

  // lo que se dice de ti: cuatro líneas con las últimas actuaciones oficiales
  Pr.dossier = function () {
    var h = FP.S.hero, ms = (h.log || []).filter(function (m) { return m.rt && m.cid && m.role !== 'fuera'; }).slice(0, 8), out = [];
    if (!ms.length) return ['Todavía no hay suficientes partidos para valorar tu rendimiento.'];
    var rt = ms.reduce(function (a, m) { return a + m.rt; }, 0) / ms.length, g = ms.reduce(function (a, m) { return a + (m.g || 0); }, 0), a = ms.reduce(function (x, m) { return x + (m.a || 0); }, 0);
    out.push(rt >= 7.4 ? 'La prensa te trata como una de las figuras del campeonato.' : rt >= 6.6 ? 'Tus actuaciones son valoradas, aunque se te exige más regularidad.' : rt >= 5.8 ? 'Pasas casi desapercibido: se espera más de ti.' : 'Las críticas son duras y se habla de tu rendimiento.');
    out.push('En tus últimos ' + ms.length + ' partidos: ' + g + (g === 1 ? ' gol' : ' goles') + ' y ' + a + (a === 1 ? ' asistencia' : ' asistencias') + ', con nota media ' + rt.toFixed(1) + '.');
    var st = Pr.ensure(); out.push(st.str >= 3 ? 'Tu equipo llega en racha de ' + st.str + ' victorias seguidas.' : st.str <= -3 ? 'Tu equipo atraviesa una mala racha de ' + (-st.str) + ' derrotas.' : 'Tu equipo alterna resultados.');
    return out;
  };

  // conexión: se llama después de cada partido del protagonista
  var am0 = Hero.afterMatch;
  Hero.afterMatch = function (prep, res) {
    var r = am0.apply(this, arguments);
    try { var h = FP.S.hero, official = !(prep.comp.kind === 'F' || (prep.f && prep.f.fr)); if (h.log && h.log[0] && (h.tk === 'pro' || h.tk === 'loan' || h.tk === 'academy')) Pr.onMatch(h.log[0], official); } catch (e) { if (window.console) console.warn('prensa', e); }
    return r;
  };
})();
