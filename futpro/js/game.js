/* FUTPRO — controlador de partida: nueva carrera, preset de Ignacio, avance semanal */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, Comp = FP.Comp, Sim = FP.Sim;

  var Game = FP.Game = {};
  var tick = function () { return new Promise(function (r) { setTimeout(r, 0); }); };

  // Construye el mundo y lo avanza hasta la fecha de inicio (semana 0 = 18-may-2026)
  Game.buildWorld = function (seed, progress, y0) {
    progress = progress || function () { };
    FP.Date.setStart(y0 || 2026);
    return new Promise(function (resolve) {
      progress('Generando clubes, plantillas y ligas…', 0.05);
      setTimeout(function () {
        var S = C.newWorld(seed);
        progress('Programando calendarios de ' + FP.DATA.leagues.length + ' divisiones…', 0.2);
        setTimeout(function () {
          Sim.startSeasons();
          var total = -S.week, done = 0;
          (function loop() {
            var t0 = Date.now();
            while (S.week < 0 && Date.now() - t0 < 60) { Sim.step(); done++; }
            progress('Simulando el fútbol mundial hasta mayo de ' + FP.Date.y0 + '…', 0.25 + 0.7 * Math.min(1, done / Math.max(1, total)));
            if (S.week < 0) setTimeout(loop, 0);
            else resolve(S);
          })();
        }, 0);
      }, 0);
    });
  };

  // ---------- carrera ----------
  Game.finishSetup = function () {
    var S = FP.S, h = S.hero;
    S.pending = []; S.transfers = S.transfers || [];
    FP.Hero.updateOvr(); FP.Hero.ensureInRoster(); FP.Hero.ensureComps();
    S.created = Date.now(); S.v = 1;
    // hitos ya cumplidos al comenzar (no se anuncian)
    S.hero.flags.ms = S.hero.flags.ms || {};
    if (FP.Social) { FP.Social.milestones().forEach(function (m) { if (m.v >= m.g) S.hero.flags.ms[m.id] = S.week; }); S.hero.soc = null; FP.Social.weekly(S.week); S.hero.soc.logTick = S.hero.logTick || 0; S.hero.soc.lastMsg = S.hero.nextId; S.hero.soc.feed = []; S.hero.soc.fol = FP.Social.followers(); }
  };
  // opts: nm, nat, city, age, h, kg, pos, foot, style, extra, club:{kind:'amat',name} | {kind:'academy',id}
  Game.startCareer = function (opts) {
    var S = FP.S;
    var h = FP.Hero.create(opts);
    var cc = opts.nat;
    if (opts.club.kind === 'amat') {
      var res = opts.res && FP.DATA.countries[opts.res] ? opts.res : (FP.DATA.countries[cc] ? cc : 'ESP');
      var id = FP.Market.newAmateurClub(opts.club.name, res, opts.club.st || 50);
      h.tk = 'amat'; h.team = id; h.club = null;
    } else {
      var club = S.clubs[opts.club.id];
      h.tk = 'academy'; h.club = club.id; h.team = 30000 + club.id;
      h.contract = { type: 'juvenil', wage: 0, end: FP.Market.endYearOf(FP.LGDEF[club.lg].cal, 2) };
    }
    h.money = 0;
    FP.Hero.msg('Comienza la carrera de ' + h.nm + '. ¡Mucha suerte!', 'ok');
    Game.finishSetup();
    return h;
  };
  Game.startPreset = function () {
    var S = FP.S;
    var h = FP.Hero.create({
      nm: 'Ignacio', nat: 'CHI', city: '', age: 13, h: 168, kg: 56, pos: 'ST', foot: 'R', style: 'fisico', ovrTarget: 58,
      pot: null
    });
    // fecha de nacimiento: 13 años en mayo de 2026
    h.b = D.of(D.y0 - 14, 8, 14); S.pl[0].b = h.b; h.bd = [D.y0 - 14, 8, 14];
    h.pot = Math.min(96, FP.Youth.potFor(h.ovr, 13) + 2); h.cap = FP.Hero.makeCaps(h.at, h.pos, h.pot, h.style); S.pl[0].pt = h.pot;
    var id = FP.Market.newAmateurClub('Deportivo Los Aromos', 'CHI', 50);
    h.tk = 'amat'; h.team = id; h.club = null;
    // progreso incorporado por el usuario
    h.tot.ap = 14; h.tot.g = 9; h.tot.a = 3; h.tot.min = 14 * 70;
    h.season = { ap: 14, st: 14, min: 14 * 70, g: 9, a: 3, yc: 0, rc: 0, rs: 0, rn: 0 };
    h.trophies.push({ y: String(D.y0), nm: 'Subcampeón regional', club: 'Deportivo Los Aromos', w: 0, sub: 1, preset: 1 });
    h.history = [{ w: 0, t: 'Inicio de partida preconfigurada: Ignacio (13 años, DC) en Deportivo Los Aromos.', club: null }];
    h.flags.preset = 1;
    FP.Hero.msg('Partida preconfigurada: Ignacio, 13 años, delantero centro de Deportivo Los Aromos. 14 partidos, 9 goles y 3 asistencias. Subcampeón regional (mayo de ' + D.y0 + ').', 'ok');
    // oportunidad pendiente en San Fernando (prueba abierta con clubes de la zona)
    var near = [FP.Game.clubByName("O'Higgins"), FP.Game.clubByName('Deportes Santa Cruz')].filter(Boolean).map(function (c) { return c.id; });
    FP.Market.addOffer({ type: 'event', trialOpen: true, place: 'San Fernando', clubs: near, club: near[0], text: 'Oportunidad pendiente en San Fernando: prueba abierta con veedores de clubes de la zona (O\'Higgins y Deportes Santa Cruz).', exp: 14 });
    Game.finishSetup();
    return h;
  };
  Game.clubByName = function (nm) { return FP.S.clubs.filter(function (c) { return c.nm === nm; })[0]; };

  // ---------- semana ----------
  // 1) prepara la semana: entrenamiento y partidos de los demás; deja en S.pending los del jugador
  Game.beginWeek = function () {
    var S = FP.S, h = S.hero;
    if (S.weekOpen) return { pending: S.pending.length };
    S.weekOpen = true;
    if (h && !h.retired) { var r = FP.Hero.weekStart(); S.lastTrain = r.train; if (FP.Nat && FP.Nat.weekStart) FP.Nat.weekStart(S.week); }
    Sim.playWeek();
    S.results = [];
    return { pending: S.pending.length };
  };
  Game.hasPending = function () { return FP.S.pending && FP.S.pending.length > 0; };
  Game.nextPending = function () {
    var S = FP.S; if (!S.pending.length) return null;
    var item = S.pending[0];
    if (!S.comps[item.c]) { S.pending.shift(); return Game.nextPending(); }
    return FP.Hero.prepareMatch(item);
  };
  Game.playPending = function () {
    var S = FP.S, prep = Game.nextPending(); if (!prep) return null;
    var res = FP.Hero.playMatch(prep);
    S.pending.shift();
    (S.results = S.results || []).push({ c: prep.comp.nm, h: prep.f.h, a: prep.f.a, hs: res.hs, as: res.as });
    return { prep: prep, res: res };
  };
  // 3) cierra la semana
  Game.endWeek = function () {
    var S = FP.S, h = S.hero;
    if (h && !h.retired) { FP.Hero.weekEnd(); FP.Market.heroWeekly(S.week); FP.Events.weekly(S.week); }
    if (h && FP.Social) { FP.Social.weekly(S.week); if (!h.retired) FP.Social.checkMilestones(); }
    Sim.endWeek();
    S.weekOpen = false;
    FP.Sim.autoFlags && FP.Sim.autoFlags();
  };
  // avanza una semana resolviendo en automático los partidos del jugador (modo rápido)
  Game.autoWeek = function () {
    Game.beginWeek();
    var n = 0;
    while (Game.hasPending() && n++ < 20) Game.playPending();
    Game.endWeek();
  };
  // Avanza semanas hasta que cond() sea verdadero o se alcance max. Devuelve promesa. Se detiene ante ofertas/lesiones nuevas.
  Game.runWeeks = function (max, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var S = FP.S, h = S.hero, count = 0, offers0 = h.offers.length, inbox0 = h.inbox.length;
      (function loop() {
        var t0 = Date.now();
        while (count < max && Date.now() - t0 < 40) {
          if (opts.untilMatch) {
            // ¿hay partido del jugador esta semana?
            Game.beginWeek();
            if (Game.hasPending() && count > 0 || (Game.hasPending() && opts.stopAtFirst)) { resolve({ weeks: count, stop: 'match' }); return; }
            if (Game.hasPending()) { resolve({ weeks: count, stop: 'match' }); return; }
            Game.endWeek(); count++;
          } else {
            Game.autoWeek(); count++;
          }
          if (h.retired) { resolve({ weeks: count, stop: 'retired' }); return; }
          if (opts.stopOnOffer && h.offers.length > offers0) { resolve({ weeks: count, stop: 'offer' }); return; }
          if (opts.stopOnEvent && h.inbox.length > inbox0 && h.inbox[0].k === 'inj') { resolve({ weeks: count, stop: 'inj' }); return; }
        }
        if (count >= max) resolve({ weeks: count, stop: 'done' });
        else setTimeout(loop, 0);
      })();
    });
  };
})();
