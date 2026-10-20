/* FUTPRO — redes sociales simuladas del jugador (hinchas, prensa, club) y hitos de carrera.
 * Todo el contenido es ficticio y generado: ninguna cuenta ni persona real. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date;
  var Social = FP.Social = {};

  var OUTLETS = [['Gol Total', '@GolTotal'], ['Diario Cancha', '@DiarioCancha'], ['Radio Pelota', '@RadioPelota'], ['La Tribuna Deportiva', '@LaTribunaDep'], ['Fútbol Mundo', '@FutbolMundoTV']];
  var HANDLE_BITS = ['hincha', 'fut', 'gol', 'barra', 'pelota', 'cancha', 'crack', 'tribuna', 'fan', 'la12'];

  function hero() { return FP.S.hero; }
  function st() { var h = hero(); if (!h.soc) h.soc = { fol: 0, fame: 0, lastMsg: 0, logTick: 0, feed: [], posted: -99, tro: 0, awd: 0, club: null, inj: false, ofr: 0 }; return h.soc; }
  function first() { return hero().nm.split(' ')[0]; }

  // seguidores según nivel, edad, club y fama acumulada
  Social.followers = function () {
    var h = hero(), s = st();
    var lg = h.club != null ? FP.LGDEF[FP.S.clubs[h.club].lg] : null;
    var base = 90 * Math.exp(0.085 * Math.max(0, h.ovr - 40)) * (h.tk === 'amat' ? 0.45 : h.tk === 'academy' ? 0.7 : 1) * (1 + (lg ? lg.q / 90 : 0));
    return Math.round(base * (1 + s.fame / 40));
  };
  function fan() {
    var h = hero(), nat = R() < 0.85 ? h.nat : U.pick(['ARG', 'ESP', 'BRA', 'MEX', 'COL']);
    var nm = FP.Names.gen(nat), parts = nm.split(' ');
    var hd = '@' + U.pick(HANDLE_BITS) + '_' + parts[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') + U.int(1, 99);
    return { n: nm, h: hd, k: 'fan' };
  }
  function media() { var o = U.pick(OUTLETS); return { n: o[0], h: o[1], k: 'media' }; }
  function club(id) { var nm = id != null ? C.tname(id) : 'Club'; return { n: nm, h: '@' + nm.replace(/[^A-Za-z]/g, '').slice(0, 14), k: 'club' }; }

  Social.post = function (who, text, boost) {
    var s = st(), h = hero();
    var fol = Social.followers();
    var likes = Math.max(0, Math.round(fol * (0.02 + R() * 0.1) * (who.k === 'media' ? 1.6 : who.k === 'club' ? 2 : 1) * (boost || 1) / (who.k === 'fan' ? 3 : 1)));
    s.feed.unshift({ w: FP.S.week, who: who, t: text, l: likes, r: Math.round(likes * (0.05 + R() * 0.2)), c: Math.round(likes * (0.03 + R() * 0.1)), id: (s.nextId = (s.nextId || 0) + 1) });
    if (s.feed.length > 220) s.feed.length = 160;
  };
  var T = {
    hat: ['¡¡¡TRIPLETE de {n}!!! Qué barbaridad lo de este pibe 🔥', '{n} la rompió: {g} goles hoy. Que alguien lo pare.', 'Partidazo de {n}. {g} goles y el estadio de pie.'],
    brace: ['Doblete de {n} hoy, qué crack.', '{n} otra vez: dos goles y a casa con los tres puntos.', 'Cómo juega {n}. Dos goles hoy.'],
    goal: ['Gol de {n} 🙌', 'Bien {n}, la mandó a guardar.', 'Ya era hora, gol de {n}.', '{n} está en racha, así se hace.'],
    assist: ['Pase gol de {n}, qué visión.', '{n} filtró un pase de lujo.'],
    star: ['{n} fue la figura del partido, no hay duda.', 'Hoy {n} jugó a otro ritmo. Nota {r}.', 'MVP: {n}. Punto.'],
    bad: ['Hoy {n} no estuvo, pero ya se viene la revancha.', 'Mal partido de {n}. A seguir trabajando.', '{n} desaparecido hoy… a ver si mejora la próxima.'],
    win: ['Ganamos! Vamos {club} 💪', 'Tres puntos más, así se juega.'],
    lose: ['Duele esta derrota, pero hay que levantar la cabeza.', 'Mal resultado hoy. Se puede mejorar.'],
    bench: ['Por qué {n} no juega más? Pónganlo de titular.', '{n} merece más minutos, que alguien le avise al técnico.'],
    amb: ['Alguien más piensa que {n} va a llegar lejos?', 'Vi entrenar a {n} y el chico tiene algo distinto.', 'El futuro de nuestro fútbol se llama {n} ⚽', 'Seguimos de cerca a {n}: promesa del fútbol.', '{n}, bacán lo tuyo. Sigue así!', 'Quiero ver a {n} en la selección.']
  };
  function tpl(arr, o) { return U.pick(arr).replace(/\{(\w+)\}/g, function (m, k) { return o[k] != null ? o[k] : ''; }); }

  // procesa novedades de la semana y genera publicaciones
  Social.weekly = function (w) {
    var S = FP.S, h = hero(); if (!h) return;
    var s = st();
    if (h.retired && !s.retPost) { s.retPost = 1; Social.post(media(), tpl(['Se retira ' + h.nm + ' tras una carrera de ' + (h.tot.ap) + ' partidos y ' + h.tot.g + ' goles. Gracias por todo.'], {}), 3); return; }
    // partidos nuevos
    var tick = h.logTick || 0, news = tick - s.logTick;
    if (news > 0) {
      h.log.slice(0, Math.min(news, 6)).reverse().forEach(function (m) {
        var o = { n: first(), g: m.g, r: m.rt ? m.rt.toFixed(1) : '', club: h.club != null ? C.tname(h.club) : C.tname(h.team) };
        if (m.g >= 3) { for (var i = 0; i < 3; i++) Social.post(i === 0 ? media() : fan(), tpl(T.hat, o), 2.5); s.fame += 3; }
        else if (m.g === 2) { Social.post(R() < 0.5 ? media() : fan(), tpl(T.brace, o), 1.6); s.fame += 1.5; }
        else if (m.g === 1 && R() < 0.7) { Social.post(fan(), tpl(T.goal, o)); s.fame += 0.6; }
        else if (m.a > 0 && R() < 0.5) Social.post(fan(), tpl(T.assist, o));
        if (m.rt >= 8.4 && R() < 0.8) { Social.post(media(), tpl(T.star, o), 1.5); s.fame += 1; }
        else if (m.rt && m.rt < 5.5 && R() < 0.7) Social.post(fan(), tpl(T.bad, o));
        if (m.role === 'banca' && R() < 0.35 && h.tk === 'pro') Social.post(fan(), tpl(T.bench, o));
        if (m.r === 'V' && R() < 0.25) Social.post(fan(), tpl(T.win, o));
        else if (m.r === 'D' && R() < 0.2) Social.post(fan(), tpl(T.lose, o));
      });
      s.logTick = tick;
    }
    // mensajes de carrera -> reacciones
    h.inbox.slice().reverse().forEach(function (m) {
      if (m.id <= s.lastMsg) return;
      s.lastMsg = Math.max(s.lastMsg, m.id);
      var t = m.t;
      if (/Convocado a la selección/.test(t)) { Social.post(media(), 'OFICIAL: ' + h.nm + ' convocado a la selección de ' + C.cname(h.nat) + '. ' + (/absoluta/.test(t) ? 'Se viene el debut con la Roja? 🇨🇱' : ''), 2.5); Social.post(fan(), '¡Vamos ' + first() + '! Orgullo de barrio 🙌'); s.fame += 4; }
      else if (/Lesión:/.test(t)) { Social.post(fan(), 'Recupérate pronto ' + first() + ' 💪 te esperamos.'); Social.post(media(), 'Preocupación: ' + h.nm + ' se pierde las próximas semanas por lesión.'); }
      else if (/Alta médica/.test(t)) Social.post(club(h.club), 'Regresó ' + h.nm + '. ¡Bienvenido de vuelta!', 1.4);
      else if (/Expulsado/.test(t)) Social.post(fan(), 'Qué necesidad de la roja, ' + first() + '...');
      else if (/Cumpleaños/.test(t)) { Social.post(fan(), 'Feliz cumpleaños ' + first() + '! 🎂 ¡Que sigan los goles!'); Social.post(club(h.club != null ? h.club : h.team), 'Feliz cumpleaños a nuestro ' + h.nm + '.', 1.2); }
      else if (/Campeón/.test(t)) { Social.post(media(), '🏆 ' + t, 3); Social.post(fan(), '¡¡CAMPEONES!! Gracias ' + first() + '!!!', 2); s.fame += 5; }
      else if (/ofrece|quiere ficharte|propone renovar|prueba/.test(t) && m.k === 'offer') { if (R() < 0.6) Social.post(media(), 'Mercado: ' + (/prueba/.test(t) ? 'ojeadores siguen de cerca a ' + h.nm + '.' : 'hay clubes interesados en ' + h.nm + '.'), 1.4); }
      else if (/Prueba aprobada|ascendido al primer equipo|Firmaste|Bienvenido/.test(t)) { Social.post(media(), h.nm + ': ' + t, 2); Social.post(fan(), 'Bienvenido ' + first() + '!! 👏'); s.fame += 2; }
    });
    // trofeos, premios y cambios de club
    if (h.trophies.length > s.tro) { h.trophies.slice(s.tro).forEach(function (t) { if (!t.preset) Social.post(media(), (t.sub ? '🥈 ' : '🏆 ') + h.nm + ': ' + t.nm + ' (' + t.y + ').', t.sub ? 1.2 : 2.5); }); s.tro = h.trophies.length; }
    if (h.awards.length > s.awd) { h.awards.slice(s.awd).forEach(function (a) { Social.post(media(), '⭐ ' + h.nm + ' recibe: ' + a.nm + ' (' + a.y + ').', 2); s.fame += 2; }); s.awd = h.awards.length; }
    var cur = h.club != null ? h.club : h.team;
    if (s.club !== cur) { if (s.club != null && cur != null) Social.post(club(cur), 'Bienvenido a ' + C.tname(cur) + ', ' + h.nm + '. ¡Vamos juntos!', 2); s.club = cur; }
    // conversación de fondo
    if (w - s.posted >= 1 && R() < 0.35 + Math.min(0.3, s.fame / 100)) {
      var recent = s.feed.slice(0, 12).map(function (p) { return p.t; }), txt, k = 0;
      do { txt = tpl(T.amb, { n: first() }); } while (recent.indexOf(txt) >= 0 && ++k < 6);
      if (recent.indexOf(txt) < 0) { Social.post(fan(), txt); s.posted = w; }
    }
    // seguidores reales
    var f = Social.followers(); if (f > s.fol) s.fol = Math.round(s.fol + (f - s.fol) * 0.4 + 1); else s.fol = f;
    s.fame = Math.max(0, s.fame * 0.995);
  };

  // acciones del jugador en redes
  Social.actions = [
    { id: 'thanks', t: 'Agradecer a los hinchas', d: '+moral, +seguidores', fn: function (h, s) { h.mor = U.clamp(h.mor + 4, 0, 100); s.fame += 1.5; return 'Gracias a todos por el aliento. ¡Seguimos trabajando! 💚'; } },
    { id: 'train', t: 'Subir foto del entrenamiento', d: '+seguidores', fn: function (h, s) { s.fame += 1; return 'Día de trabajo duro. Cada entrenamiento cuenta 💪⚽'; } },
    { id: 'goal', t: 'Dedicar el próximo gol a tu familia', d: '+moral, +fama pequeña', fn: function (h, s) { h.mor = U.clamp(h.mor + 3, 0, 100); s.fame += 0.8; return 'El próximo gol es para mi familia, que siempre me acompaña. ❤️'; } },
    { id: 'clap', t: 'Responder a un crítico con humor', d: 'riesgo/recompensa', fn: function (h, s) { if (R() < 0.7) { s.fame += 2; return 'Dicen que no llego... pero ya voy llegando 😎'; } h.mor = U.clamp(h.mor - 4, 0, 100); return 'No me la creo, pero ya vamos a ver 🙄'; } }
  ];
  Social.act = function (id) {
    var h = hero(), s = st(), a = Social.actions.filter(function (x) { return x.id === id; })[0];
    if (!a) return { ok: false, msg: '' };
    if (FP.S.week - (s.lastAct || -9) < 1) return { ok: false, msg: 'Ya publicaste esta semana.' };
    s.lastAct = FP.S.week;
    var txt = a.fn(h, s);
    var fol = Social.followers();
    s.feed.unshift({ w: FP.S.week, who: { n: h.nm, h: '@' + h.nm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, ''), k: 'me' }, t: txt, l: Math.round(fol * (0.05 + R() * 0.12)), r: Math.round(fol * 0.01), c: Math.round(fol * 0.01), id: (s.nextId = (s.nextId || 0) + 1) });
    return { ok: true, msg: 'Publicado.' };
  };

  // ---------- hitos de carrera ----------
  var MS = [
    { id: 'goal1', n: 'Primer gol', d: 'Marca tu primer gol', v: function (h) { return h.tot.g; }, g: 1 },
    { id: 'goal10', n: '10 goles', d: 'Llega a 10 goles de carrera', v: function (h) { return h.tot.g; }, g: 10 },
    { id: 'goal50', n: 'Medio centenar', d: '50 goles de carrera', v: function (h) { return h.tot.g; }, g: 50 },
    { id: 'goal100', n: 'Centenario', d: '100 goles de carrera', v: function (h) { return h.tot.g; }, g: 100 },
    { id: 'goal300', n: 'Leyenda goleadora', d: '300 goles de carrera', v: function (h) { return h.tot.g; }, g: 300 },
    { id: 'ap100', n: '100 partidos', d: 'Disputa 100 partidos', v: function (h) { return h.tot.ap; }, g: 100 },
    { id: 'acad', n: 'A la cantera', d: 'Ingresa a las inferiores de un club profesional', v: function (h) { return (h.tk === 'academy' || h.tk === 'pro' || h.tk === 'loan' || h.flags.wasAcad) ? 1 : 0; }, g: 1 },
    { id: 'pro', n: 'Profesional', d: 'Firma tu primer contrato profesional', v: function (h) { return h.contract && h.contract.type === 'prof' || h.flags.wasPro ? 1 : 0; }, g: 1 },
    { id: 'ovr70', n: 'Media 70', d: 'Alcanza media 70', v: function (h) { return h.ovr; }, g: 70 },
    { id: 'ovr80', n: 'Media 80', d: 'Alcanza media 80', v: function (h) { return h.ovr; }, g: 80 },
    { id: 'ovr90', n: 'Élite mundial', d: 'Alcanza media 90', v: function (h) { return h.ovr; }, g: 90 },
    { id: 'nt1', n: 'Con la camiseta nacional', d: 'Juega con una selección', v: function (h) { return h.nt.caps; }, g: 1 },
    { id: 'tro1', n: 'Primer título', d: 'Gana un campeonato', v: function (h) { return h.trophies.filter(function (t) { return !t.sub; }).length; }, g: 1 },
    { id: 'tro5', n: 'Coleccionista', d: 'Gana 5 títulos', v: function (h) { return h.trophies.filter(function (t) { return !t.sub; }).length; }, g: 5 },
    { id: 'val1', n: 'Un millón', d: 'Valor de mercado de 1 M€', v: function () { return FP.Market.heroValue(); }, g: 1000 },
    { id: 'val50', n: 'Joya cara', d: 'Valor de mercado de 50 M€', v: function () { return FP.Market.heroValue(); }, g: 50000 },
    { id: 'fol', n: 'Famoso', d: '100.000 seguidores', v: function (h) { return st().fol; }, g: 100000 },
    { id: 'bo', n: 'Balón de Oro', d: 'Gana el Balón de Oro', v: function (h) { return h.awards.filter(function (a) { return a.nm === 'Balón de Oro'; }).length; }, g: 1 }
  ];
  Social.milestones = function () { var h = hero(); h.flags.ms = h.flags.ms || {}; return MS.map(function (m) { var v = m.v(h); return { id: m.id, n: m.n, d: m.d, v: Math.min(v, m.g), g: m.g, done: !!h.flags.ms[m.id], w: h.flags.ms[m.id] }; }); };
  Social.checkMilestones = function () {
    var h = hero(); h.flags.ms = h.flags.ms || {};
    if (h.tk === 'academy' || h.tk === 'pro') h.flags.wasAcad = 1;
    if (h.contract && h.contract.type === 'prof') h.flags.wasPro = 1;
    var got = [];
    MS.forEach(function (m) { if (!h.flags.ms[m.id] && m.v(h) >= m.g) { h.flags.ms[m.id] = FP.S.week; got.push(m); } });
    got.forEach(function (m) { FP.Hero.msg('🏅 Hito desbloqueado: ' + m.n + ' — ' + m.d, 'ok'); st().fame += 1; });
    return got;
  };
})();
