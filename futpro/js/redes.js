/* FUTPRO — redes y marca personal: polémicas, patrocinadores, rumores de fichaje, comunidad (barra, parodia, mensajes) y panel de la cuenta.
 * Todo el contenido es ficticio. Se apoya en FP.Social (feed y seguidores), FP.Dec (decisiones) y FP.Contracts.pay (dinero). */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, Dec = FP.Dec, Hero = FP.Hero, Social = FP.Social;
  var X = FP.Redes = {};

  var OUT = [['Gol Total', '@GolTotal'], ['Diario Cancha', '@DiarioCancha'], ['Radio Pelota', '@RadioPelota'], ['La Tribuna Deportiva', '@LaTribunaDep'], ['Fútbol Mundo', '@FutbolMundoTV']];
  function media() { var o = U.pick(OUT); return { n: o[0], h: o[1], k: 'media' }; }
  function rnd(a, b) { return a + R() * (b - a); }
  function hero() { return FP.S && FP.S.hero; }
  function first(h) { return h.nm.split(' ')[0]; }
  function last(h) { var p = h.nm.split(' '); return p[p.length - 1]; }
  function slug(t) { return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, ''); }
  function soc() { var h = hero(); return h && h.soc; }
  function fame() { var s = soc(); return s ? s.fame : 0; }
  function fol() { return Social.followers(); }
  function post(who, t, boost) { if (soc()) Social.post(who, t, boost); }
  function press() { var l = FP.Life && FP.Life.ensure(); return l ? l.press : null; }
  function img(d) { var p = press(); if (p) p.img = U.clamp(p.img + d, 0, 100); }
  function heat(d) { var p = press(); if (p) p.heat = Math.max(0, p.heat + d); }
  function mor(d) { var h = hero(); h.mor = U.clamp(h.mor + d, 0, 100); }
  function addFame(d) { var s = soc(); if (s) s.fame = Math.max(0, s.fame + d); }
  function pay(amt, kind, why) { try { return FP.Contracts.pay(amt, kind, why); } catch (e) { hero().money += amt; return amt; } }

  X.ensure = function () {
    var h = hero(); if (!h) return null;
    if (!h.rd) h.rd = {};
    var r = h.rd;
    if (!r.sp) r.sp = { deals: [], offers: [], hist: [], earn: 0, cd: 0, n: 0, nid: 1 };
    r.folH = r.folH || []; r.cd = r.cd || { pol: 0, rum: 0, dm: 0, par: 0 };
    ['posts', 'viral', 'ptot', 'pbad'].forEach(function (k) { if (r[k] == null) r[k] = 0; });
    if (r.brand == null) r.brand = 50;
    if (r.lastPost == null) r.lastPost = -99;
    if (!r.week) r.week = { w: -1, n: 0 };
    if (r.best === undefined) r.best = null;
    if (r.fan === undefined) r.fan = null;
    if (r.parody === undefined) r.parody = null;
    return r;
  };
  X.migrate = X.ensure;

  // ---------- publicar (varias acciones por semana, con cansancio y posibles virales) ----------
  var recentWin = function (h) { return h.log.some(function (m) { return FP.S.week - m.w <= 1 && m.r === 'V'; }); };
  var NEW = [
    { id: 'cele', t: 'Celebrar la victoria con los hinchas', d: '+moral, +fama', ok: recentWin, why: 'Necesitas una victoria reciente.', fn: function (h) { mor(2); addFame(1.8); return 'Qué noche. Esto es de todos los que nos acompañan 🙌💚'; } },
    { id: 'fam', t: 'Foto con la familia', d: '+moral, +imagen', fn: function (h) { mor(3); img(1.5); addFame(0.8); return 'Todo lo que soy se lo debo a ellos ❤️'; } },
    { id: 'vida', t: 'Contar tu historia (hilo largo)', d: '+fama, +imagen · más opción de viral', min: 16, v: 0.08, fn: function (h) { img(3); addFame(2.2); return 'Hilo 🧵 Así empezó todo: de la cancha de tierra del barrio a donde estoy hoy. Gracias por leerme.'; } },
    { id: 'hinchas', t: 'Mensaje a la barra y los hinchas', d: '+moral · sube tu club de fans', fn: function (h, s, r) { mor(1.5); if (r.fan) r.fan.xp += 4; addFame(0.8); return 'Los de la tribuna son el jugador número 12. ¡Gracias por cantar todo el partido!'; } },
    { id: 'caridad', t: 'Acción solidaria (cuesta dinero)', d: '+imagen y marca · -5 mil €', cost: 5, fn: function (h, s, r) { pay(-5, 'inversion', 'Acción solidaria'); img(5); r.brand = U.clamp(r.brand + 3, 0, 100); addFame(1.5); return 'Hoy visitamos a los niños del hospital. Me llevo más yo de lo que les dejo 💙'; } },
    { id: 'qa', t: 'Preguntas y respuestas en vivo', d: '+fama · riesgo de respuesta polémica', min: 2000, v: 0.06, fn: function (h) { addFame(2); if (R() < 0.2) { img(-3); heat(2); return 'Respondí muy rápido a una pregunta y ya me están dando vuelta el comentario 😅'; } return 'Gracias por todas las preguntas, estuvo buenísimo. ¡Repetimos pronto!'; } },
    { id: 'clip', t: 'Video de tus mejores jugadas', d: '+fama', ok: function (h) { return h.tot.g + h.tot.a >= 3; }, why: 'Aún no tienes jugadas para mostrar.', v: 0.04, fn: function (h) { addFame(2); return 'Resumen de lo mejor del mes. Pulsa play ▶️⚽'; } },
    { id: 'spons', t: 'Contenido de un patrocinador', d: 'Cobras un extra del contrato', ok: function (h, r) { return r.sp.deals.length > 0; }, why: 'No tienes patrocinadores.', fn: function (h, s, r) { var d = U.pick(r.sp.deals); var x = Math.round(d.mo * 0.25); pay(x, 'patrocinio', 'Contenido para ' + d.brand); return 'Mi día empieza con ' + d.brand + '. #publicidad'; } }
  ];
  NEW.forEach(function (a) { if (!Social.actions.some(function (x) { return x.id === a.id; })) Social.actions.push(a); });
  var ids = {}; Social.actions.forEach(function (a) { ids[a.id] = a; });

  X.canAct = function (a) {
    var h = hero(), r = X.ensure(), why = '';
    if (a.min && (a.min > 100 ? fol() < a.min : Hero.age() < a.min)) why = a.min > 100 ? 'Necesitas ' + a.min + ' seguidores.' : 'Desde los ' + a.min + ' años.';
    else if (a.ok && !a.ok(h, r)) why = a.why || 'No disponible ahora.';
    else if (a.cost && h.money < a.cost) why = 'No tienes dinero para esto.';
    return why;
  };
  X.postsLeft = function () { var r = X.ensure(); return r.week.w === FP.S.week ? Math.max(0, 3 - r.week.n) : 3; };

  Social.act = function (id) {
    var h = hero(), s = soc(), r = X.ensure(), a = ids[id];
    if (!a || !s) return { ok: false, msg: '' };
    var why = X.canAct(a); if (why) return { ok: false, msg: why };
    if (r.week.w !== FP.S.week) r.week = { w: FP.S.week, n: 0 };
    if (r.week.n >= 3) return { ok: false, msg: 'Ya publicaste tres veces esta semana.' };
    r.week.n++; r.lastPost = FP.S.week; r.posts++; s.lastAct = FP.S.week;
    h.fat = U.clamp(h.fat + 1.2, 0, 100);
    var txt = a.fn(h, s, r);
    var f = fol(), likes = Math.round(f * (0.05 + R() * 0.12)), viral = R() < 0.02 + Math.min(0.2, s.fame / 400) + (a.v || 0);
    if (viral) { likes = Math.round(likes * rnd(6, 22)); s.fame += 4; r.viral++; Hero.msg('¡Tu publicación se hizo viral! (' + FP.fmt.num(likes) + ' me gusta)', 'ok'); }
    var item = { w: FP.S.week, who: { n: h.nm, h: '@' + slug(h.nm), k: 'me' }, t: txt, l: likes, r: Math.round(likes * (viral ? 0.25 : 0.1)), c: Math.round(likes * (viral ? 0.12 : 0.06)), id: (s.nextId = (s.nextId || 0) + 1), v: viral ? 1 : 0 };
    s.feed.unshift(item);
    if (!r.best || likes > r.best.l) r.best = { t: txt, l: likes, w: FP.S.week, v: viral ? 1 : 0 };
    return { ok: true, msg: viral ? '¡Viral!' : 'Publicado (' + r.week.n + '/3 esta semana).' };
  };

  // ---------- polémicas ----------
  var POL = [
    { id: 'tuit', min: 10, age: 16, title: 'Reaparece un tuit tuyo de hace años', text: 'Un comentario de cuando eras más joven circula en redes y todos lo comparten.',
      opts: [['disc', 'Pedir disculpas públicas', 'Cierra el tema, pierdes algo de imagen'], ['ign', 'Ignorarlo', 'Puede apagarse… o crecer'], ['humor', 'Responder con humor', 'Alto riesgo, buena recompensa']] },
    { id: 'rival', min: 8, age: 14, title: 'Un rival te provoca en redes', text: 'Un jugador rival dejó una indirecta sobre ti y la gente espera tu reacción.',
      opts: [['ign', 'No responder', 'Imagen de madurez'], ['resp', 'Responder en redes', 'Riesgo de que escale'], ['cancha', 'Responder en la cancha', 'Moral + y sin ruido']] },
    { id: 'dt', min: 8, age: 15, title: 'Foto discutiendo con el entrenador', text: 'Circula una imagen tuya discutiendo con el técnico. La prensa especula con un conflicto.',
      opts: [['acl', 'Aclarar que fue un malentendido', 'Calma el tema'], ['disc', 'Pedir disculpas en público', 'Gesto de equipo'], ['ign', 'Guardar silencio', 'Puede prolongarse']] },
    { id: 'hin', min: 6, age: 13, title: 'Hinchas te critican con dureza', text: 'Tras los últimos partidos, parte de la afición te reclama en redes.',
      opts: [['hum', 'Responder con humildad', 'Mejora la relación'], ['sil', 'Silenciar a los más agresivos', 'Sin efecto en imagen'], ['atq', 'Contraatacar', 'Alto riesgo']] },
    { id: 'fake', min: 10, age: 14, title: 'Circula una noticia falsa sobre ti', text: 'Una cuenta anónima inventó una historia sobre tu vida privada y se está difundiendo.',
      opts: [['des', 'Desmentir con un comunicado', 'Imagen +'], ['ign', 'Ignorarla', 'Se puede desinflar o crecer'], ['den', 'Denunciar a la cuenta', 'Cuesta 6 mil €, protege la marca']] }
  ];
  var BYID = {}; POL.forEach(function (p) { BYID[p.id] = p; });

  function polEvent(w) {
    var h = hero(), r = X.ensure(), age = Hero.age();
    if (w < r.cd.pol || age < 14 || fame() < 6) return;
    if (R() > Math.min(0.1, 0.012 + fame() / 600)) return;
    var cand = POL.filter(function (p) { return fame() >= p.min && age >= p.age && (p.id !== 'dt' || h.tk === 'pro') && (p.id !== 'hin' || h.log.slice(0, 3).some(function (m) { return m.rt && m.rt < 6; })); });
    if (!cand.length) return;
    var p = U.pick(cand); r.cd.pol = w + 9;
    var opts = p.opts.map(function (o) { return { k: o[0], label: o[1], hint: o[2] }; });
    if (h.agent) opts.push({ k: 'agente', label: 'Que lo resuelva tu agente', hint: 'Seguro, pero queda en nada' });
    Dec.add({ kind: 'redes', uniq: 'pol' + p.id + w, title: p.title, text: p.text, opts: opts, def: p.opts[0][0], exp: 2, data: { t: 'pol', p: p.id } });
    post(media(), 'Polémica: ' + p.title.charAt(0).toLowerCase() + p.title.slice(1) + '. ' + h.nm + ' todavía no se pronuncia.', 1.4);
    r.ptot++;
  }
  function bad(r, h, txt) {
    r.pbad++; r.brand = U.clamp(r.brand - 7, 0, 100); heat(3);
    r.sp.deals.slice().forEach(function (d) {
      if (d.cl && d.cl.clean) {
        if (R() < 0.5) { endDeal(r, d, 'rescinde el contrato por la polémica'); }
        else { Hero.msg(d.brand + ' te advierte por la polémica: la cláusula de conducta sigue vigente.', 'warn'); r.brand = U.clamp(r.brand - 2, 0, 100); }
      }
    });
  }
  function resolvePol(k, d, auto) {
    var h = hero(), r = X.ensure(), p = d.data.p, m = '';
    var win = function (pr) { return R() < pr; };
    if (k === 'agente') { img(-1); r.brand = U.clamp(r.brand - 1, 0, 100); if (h.money >= 4) pay(-4, 'inversion', 'Gestión de crisis (agente)'); return { ok: true, msg: 'Tu agente gestionó el tema discretamente.' }; }
    var pr = press();
    if (p === 'tuit') {
      if (k === 'disc') { img(-2); heat(-2); mor(-1); m = 'Pediste disculpas y el tema se enfrió.'; post({ n: 'Fútbol Mundo', h: '@FutbolMundoTV', k: 'media' }, h.nm + ' pide disculpas por un antiguo mensaje.', 1.2); }
      else if (k === 'ign') { if (win(0.5)) { m = 'El tema se apagó solo.'; } else { img(-6); bad(r, h); m = 'El tema creció y daña tu imagen.'; } }
      else { if (win(0.4)) { img(4); addFame(3); m = 'Tu respuesta con humor cayó muy bien.'; post({ n: 'hincha_' + slug(first(h)), h: '@humor_' + U.int(10, 99), k: 'fan' }, 'Respuesta de ' + first(h) + ' a la polémica: GENIAL 😂', 2); } else { img(-8); bad(r, h); m = 'La broma salió mal y la polémica crece.'; } }
    } else if (p === 'rival') {
      if (k === 'ign') { img(1); r.brand = U.clamp(r.brand + 1, 0, 100); m = 'Ignoraste la provocación: imagen de madurez.'; }
      else if (k === 'resp') { if (win(0.45)) { addFame(3); img(2); m = 'Tu respuesta fue ingeniosa y ganaste el cruce.'; } else { img(-4); bad(r, h); m = 'El cruce se salió de control.'; } }
      else { mor(3); addFame(1); m = 'Dejas la respuesta para la cancha: +moral.'; }
    } else if (p === 'dt') {
      if (k === 'acl') { img(2); mor(1); m = 'Aclaraste que fue un malentendido.'; }
      else if (k === 'disc') { img(1); mor(-1); r.brand = U.clamp(r.brand + 2, 0, 100); m = 'Pediste disculpas: gesto de equipo.'; }
      else { if (win(0.5)) { m = 'El tema se diluyó.'; } else { heat(3); img(-4); mor(-2); m = 'El silencio alimentó los rumores.'; } }
    } else if (p === 'hin') {
      if (k === 'hum') { img(3); mor(-1); m = 'Respondiste con humildad: la afición baja la guardia.'; }
      else if (k === 'sil') { m = 'Silenciaste a los más agresivos.'; }
      else { if (win(0.35)) { addFame(2); m = 'Tu respuesta sorprendió y algunos hinchas te aplauden.'; } else { img(-6); bad(r, h); mor(-2); m = 'Contraatacar empeoró las cosas.'; } }
    } else if (p === 'fake') {
      if (k === 'des') { img(2); m = 'Tu comunicado frenó la noticia falsa.'; }
      else if (k === 'ign') { if (win(0.6)) m = 'La noticia se desinfló.'; else { img(-6); heat(2); m = 'La noticia falsa se hizo grande.'; } }
      else { if (h.money >= 6) pay(-6, 'inversion', 'Denuncia legal'); img(3); r.brand = U.clamp(r.brand + 1, 0, 100); m = 'La cuenta fue denunciada y la noticia cayó.'; }
    }
    return { ok: true, msg: m };
  }

  // ---------- patrocinadores ----------
  var BR = { calzado: ['Botines Pampero', 'Zapatillas Alba'], ropa: ['Urbano Kuntur', 'Textil Andino'], bebida: ['Isotónica Vigor', 'Agua Cristalina Nevada'], tecnologia: ['Orbital Tech', 'Nexo Gaming'], finanzas: ['Banco Cóndor', 'Seguros Horizonte'], alimentos: ['Cereales Nutrivida', 'Lácteos del Sur'] };
  var CAT = { calzado: 'Calzado deportivo', ropa: 'Ropa', bebida: 'Bebidas', tecnologia: 'Tecnología', finanzas: 'Banca y seguros', alimentos: 'Alimentación' };
  X.BR = BR; X.CAT = CAT;
  X.sponsorValue = function () { // miles de euros al mes (neto de cláusulas), según audiencia, nivel y marca
    var h = hero(), r = X.ensure(), f = fol();
    return 0.008 * Math.pow(Math.max(1, f), 0.8) * (0.7 + r.brand / 100 * 0.6) * (0.85 + Math.max(0, h.ovr - 50) / 100);
  };
  function genOffer(w) {
    var h = hero(), r = X.ensure(), sp = r.sp, taken = sp.deals.map(function (d) { return d.cat; }).concat(sp.offers.map(function (o) { return o.cat; }));
    var cats = Object.keys(BR).filter(function (c) { return taken.indexOf(c) < 0; }); if (!cats.length) return;
    var cat = U.pick(cats), brand = U.pick(BR[cat]);
    var cl = { posts: R() < 0.6 ? 1 : 0, clean: R() < 0.5 ? 1 : 0 };
    var mo = Math.max(0.3, X.sponsorValue() * rnd(0.8, 1.25) * (1 + 0.08 * (cl.posts + cl.clean)));
    mo = mo < 5 ? Math.round(mo * 10) / 10 : Math.round(mo);
    var wk = U.pick([26, 52, 52, 104]);
    var o = { id: sp.nid++, brand: brand, cat: cat, mo: mo, wk: wk, cl: cl, sign: Math.round(mo * 1.5), exp: w + 4 };
    sp.offers.push(o);
    Hero.msg(brand + ' (' + CAT[cat].toLowerCase() + ') te propone un patrocinio: ' + mo + ' mil € al mes durante ' + Math.round(wk / 4.35) + ' meses.', 'offer');
    post(media(), 'Marcas: ' + brand + ' quiere a ' + h.nm + ' como imagen.', 1.3);
  }
  function endDeal(r, d, why) {
    r.sp.deals = r.sp.deals.filter(function (x) { return x !== d; });
    r.sp.hist.push({ brand: d.brand, cat: d.cat, w0: d.w0, w1: FP.S.week, earn: Math.round(d.earn), why: why }); if (r.sp.hist.length > 40) r.sp.hist.shift();
    Hero.msg(d.brand + ' ' + why + '.', 'warn');
  }
  X.acceptSp = function (id) {
    var h = hero(), r = X.ensure(), sp = r.sp, o = sp.offers.filter(function (x) { return x.id === id; })[0];
    if (!o) return { ok: false, msg: 'La oferta ya no está disponible.' };
    if (sp.deals.length >= 3) return { ok: false, msg: 'Ya tienes tres patrocinadores.' };
    if (sp.deals.some(function (d) { return d.cat === o.cat; })) return { ok: false, msg: 'Ya tienes un patrocinador de esa categoría.' };
    sp.offers = sp.offers.filter(function (x) { return x !== o; });
    sp.deals.push({ id: o.id, brand: o.brand, cat: o.cat, mo: o.mo, w0: FP.S.week, end: FP.S.week + o.wk, cl: o.cl, strikes: 0, earn: o.sign });
    pay(o.sign, 'patrocinio', 'Firma con ' + o.brand); sp.earn += o.sign; sp.n++;
    post({ n: o.brand, h: '@' + slug(o.brand), k: 'club' }, 'Bienvenido a la familia, ' + first(h) + '. 🤝', 1.6);
    addFame(1);
    return { ok: true, msg: 'Firmaste con ' + o.brand + ' (prima de ' + o.sign + ' mil €).' };
  };
  X.rejectSp = function (id) { var sp = X.ensure().sp; sp.offers = sp.offers.filter(function (x) { return x.id !== id; }); return { ok: true, msg: 'Oferta rechazada.' }; };
  X.cancelSp = function (id) {
    var r = X.ensure(), d = r.sp.deals.filter(function (x) { return x.id === id; })[0]; if (!d) return { ok: false, msg: '' };
    r.brand = U.clamp(r.brand - 4, 0, 100); endDeal(r, d, 'queda desvinculado por decisión tuya'); return { ok: true, msg: 'Rompiste el contrato: tu reputación de marca baja.' };
  };
  function sponsorWeekly(w) {
    var h = hero(), r = X.ensure(), sp = r.sp;
    sp.offers = sp.offers.filter(function (o) { if (o.exp < w) { Hero.msg('Caducó la oferta de ' + o.brand + '.', 'i'); return false; } return true; });
    sp.deals.slice().forEach(function (d) {
      var amt = d.mo * 12 / 52; pay(amt, 'patrocinio', d.brand); d.earn += amt; sp.earn += amt;
      if (d.cl.posts && w % 4 === 0 && w - r.lastPost > 6) {
        d.strikes++; r.brand = U.clamp(r.brand - 1, 0, 100);
        if (d.strikes >= 3) { endDeal(r, d, 'rescinde el contrato porque no publicas contenido'); return; }
        Hero.msg(d.brand + ' te recuerda que debes publicar (aviso ' + d.strikes + '/3).', 'warn');
      }
      if (w >= d.end) {
        endDeal(r, d, 'termina su contrato contigo');
        if (R() < 0.45 && r.brand >= 40) { var o2 = { id: sp.nid++, brand: d.brand, cat: d.cat, mo: Math.round(d.mo * 1.1 * 10) / 10, wk: 52, cl: d.cl, sign: Math.round(d.mo * 1.5), exp: w + 4 }; sp.offers.push(o2); Hero.msg(d.brand + ' quiere renovar contigo por ' + o2.mo + ' mil € al mes.', 'offer'); }
      }
    });
    if (h.tk !== 'amat' || fol() > 4000) {
      var f = fol();
      if (Hero.age() >= 15 && f >= 1500 && sp.offers.length < 3 && sp.deals.length < 3 && w >= sp.cd && R() < 0.05 + Math.min(0.15, f / 250000) + (r.brand - 50) / 1000) { genOffer(w); sp.cd = w + 10; }
    }
    r.brand = U.clamp(r.brand + (50 - r.brand) * 0.004, 0, 100);
  }

  // ---------- rumores de fichaje ----------
  function rumorEvent(w) {
    var S = FP.S, h = hero(), r = X.ensure();
    if (w < r.cd.rum || (h.tk !== 'pro' && h.tk !== 'academy') || fame() < 4 || Hero.age() < 15) return;
    if (R() > 0.04 + Math.min(0.1, fame() / 600)) return;
    var cur = h.club != null ? h.club : h.team, lg = cur != null && S.clubs[cur] ? FP.LGDEF[S.clubs[cur].lg] : null, q = lg ? lg.q : 40;
    var cand = S.clubs.filter(function (c) { var l = FP.LGDEF[c.lg]; return c.id !== cur && l && l.q >= q + 2 && l.q <= q + 26; });
    if (!cand.length) return;
    var c = U.pick(cand); r.cd.rum = w + 10;
    var opts = [{ k: 'des', label: 'Desmentirlo', hint: 'Tu club lo agradece (+moral)' }, { k: 'dejar', label: 'Dejar que corra', hint: '+fama; a veces se vuelve oferta real' }, { k: 'amor', label: 'Declarar tu amor por el club', hint: '+imagen, +moral' }];
    if (h.agent) opts.push({ k: 'agente', label: 'Que tu agente mueva el rumor', hint: 'Más opciones de oferta real' });
    Dec.add({ kind: 'redes', uniq: 'rum' + w, title: 'Rumor: ' + c.nm + ' te sigue', text: 'Los medios aseguran que ' + c.nm + ' sigue de cerca tu rendimiento. Te piden una reacción.', opts: opts, def: 'des', exp: 2, data: { t: 'rum', club: c.id } });
    post(media(), 'Mercado: ' + c.nm + ' sigue de cerca a ' + h.nm + ' y podría hacer una oferta.', 1.6);
    Social.post({ n: 'hincha_' + slug(last(h)), h: '@' + slug(last(h)) + '_' + U.int(10, 99), k: 'fan' }, 'Dicen que ' + c.nm + ' quiere a ' + first(h) + '. Ojalá se quede 🙏', 1);
  }
  function resolveRum(k, d) {
    var h = hero(), r = X.ensure(), c = FP.S.clubs[d.data.club], nm = c ? c.nm : 'ese club', m = '';
    function offerTry(p) {
      if ((h.tk === 'pro' || h.tk === 'academy') && R() < p) { try { FP.Market.transferOffers(); return true; } catch (e) { } }
      return false;
    }
    if (k === 'des') { mor(1); img(1); m = 'Desmentiste el rumor: tu club lo valora.'; post(media(), h.nm + ' desmiente cualquier contacto con ' + nm + '.', 1.1); }
    else if (k === 'dejar') { addFame(2); mor(-1); var ok = offerTry(0.3 + Math.min(0.3, fame() / 150)); m = ok ? 'El rumor se convirtió en interés real: revisa tus ofertas.' : 'El rumor se quedó en el aire.'; }
    else if (k === 'amor') { img(3); mor(1); r.brand = U.clamp(r.brand + 1, 0, 100); addFame(0.5); m = 'Declaraste tu amor por el club: los hinchas te aplauden.'; post({ n: 'hincha_' + slug(first(h)), h: '@barra_' + U.int(10, 99), k: 'fan' }, first(h) + ' se queda con nosotros 💚 Eso es compromiso.', 1.8); }
    else if (k === 'agente') { addFame(1); var ok2 = offerTry(0.55); m = ok2 ? 'Tu agente movió el rumor y llegó una oferta real.' : 'Tu agente movió el rumor, sin ofertas por ahora.'; }
    return { ok: true, msg: m };
  }

  // ---------- comunidad: barra de fans, parodia, mensajes directos ----------
  var FANLV = ['Un puñado de hinchas', 'Peña pequeña', 'Barra del barrio', 'Club de fans oficial', 'Barra brava (ruidosa)', 'Legión de seguidores'];
  X.fanLevel = function () { var r = X.ensure(); return r.fan ? FANLV[Math.min(FANLV.length - 1, r.fan.lvl - 1)] : null; };
  function fanWeekly(w) {
    var h = hero(), r = X.ensure(), f = fol();
    if (!r.fan && f >= 2500 && fame() >= 6) {
      r.fan = { nm: 'Los ' + last(h) + 'istas', lvl: 1, xp: 0, w0: w, hi: 0 };
      Hero.msg('Nace un club de fans: «' + r.fan.nm + '».', 'ok'); post({ n: r.fan.nm, h: '@' + slug(last(h)) + 'istas', k: 'fan' }, 'Nace la barra «' + r.fan.nm + '». ¡Aguante ' + first(h) + '!', 1.8);
    }
    if (!r.fan) return;
    r.fan.xp += 0.4 + fame() / 60; var need = 20 + r.fan.lvl * 25;
    if (r.fan.xp >= need && r.fan.lvl < FANLV.length) { r.fan.xp = 0; r.fan.lvl++; Hero.msg('Tu club de fans crece: ' + FANLV[r.fan.lvl - 1] + '.', 'ok'); post({ n: r.fan.nm, h: '@' + slug(last(h)) + 'istas', k: 'fan' }, 'Ya somos más. ¡Vamos ' + first(h) + '!', 1.6); }
    mor(r.fan.lvl * 0.03);
    if (R() < 0.04 + r.fan.lvl * 0.01) post({ n: r.fan.nm, h: '@' + slug(last(h)) + 'istas', k: 'fan' }, U.pick(['Banderazo para ' + first(h) + ' antes del partido 🚩', 'Viajamos 300 km para ver jugar a ' + first(h) + '. Valió la pena.', 'Se agotaron las camisetas con el nombre de ' + first(h) + '.', 'Cantemos todos: ' + first(h) + ', ' + first(h) + '… 🎶']), 1.2);
  }
  var MEMES = ['Cuando {n} entra a la cancha: «yo solo vine a jugar»', 'Entrenador: «Hoy tácticas». {n}: «Hoy goles».', '{n} después de fallar un gol: «La pelota estaba mal inflada»', 'POV: eres el defensa que marca a {n}', 'Nivel de confianza de {n}: pedir penal en el minuto 5'];
  function parodyWeekly(w) {
    var h = hero(), r = X.ensure(), p = r.parody;
    if (!p && fame() >= 30 && R() < 0.012 && w >= r.cd.par) {
      r.cd.par = w + 30;
      Dec.add({ kind: 'redes', uniq: 'par' + w, title: 'Aparece una cuenta parodia tuya', text: 'Alguien creó «' + last(h) + ' (parodia)» y publica memes sobre ti. Ya tiene miles de seguidores.', opts: [{ k: 'seguir', label: 'Seguirle el juego', hint: '+fama, +imagen' }, { k: 'rep', label: 'Reportar la cuenta', hint: 'Puede salir el tiro por la culata' }, { k: 'ign', label: 'Ignorarla', hint: 'Sin efecto' }], def: 'ign', exp: 3, data: { t: 'par' } });
      r.parody = { nm: last(h) + '_parodia', on: 1, fr: 0 };
    }
    if (p && p.on && R() < 0.3) { var t = U.pick(MEMES).replace('{n}', first(h)); post({ n: last(h) + ' (parodia)', h: '@' + p.nm, k: 'fan' }, t + ' 😂', 1.3); addFame(0.15 + (p.fr ? 0.2 : 0)); if (p.fr) img(0.05); }
  }
  function resolvePar(k) {
    var r = X.ensure(), p = r.parody; if (!p) return { ok: true, msg: '' };
    if (k === 'seguir') { p.fr = 1; addFame(3); img(2); r.brand = U.clamp(r.brand + 1, 0, 100); return { ok: true, msg: 'Le seguiste el juego a la parodia: ganaste simpatía.' }; }
    if (k === 'rep') { if (R() < 0.5) { p.on = 0; return { ok: true, msg: 'La cuenta fue cerrada.' }; } p.on = 1; addFame(2); img(-3); return { ok: true, msg: 'Reportarla fue contraproducente: la cuenta ganó seguidores.' }; }
    return { ok: true, msg: 'La ignoraste.' };
  }
  function dmEvent(w) {
    var h = hero(), r = X.ensure();
    if (w < r.cd.dm || fame() < 8 || Hero.age() < 14) return;
    if (R() > 0.03 + Math.min(0.06, fame() / 900)) return;
    r.cd.dm = w + 14;
    var k = U.pick(['idolo', 'nino', 'ex']), nm = FP.Names.gen(h.nat);
    if (k === 'idolo') Dec.add({ kind: 'redes', uniq: 'dm' + w, title: 'Mensaje directo de una leyenda', text: nm + ', una leyenda del fútbol de ' + C.cname(h.nat) + ', te escribió para felicitarte por tu carrera.', opts: [{ k: 'ag', label: 'Agradecer con humildad', hint: '+moral' }, { k: 'cons', label: 'Pedirle un consejo', hint: '++moral, +fama' }, { k: 'ign', label: 'No contestar', hint: '-moral' }], def: 'ag', exp: 3, data: { t: 'dm', k: k, nm: nm } });
    else if (k === 'nino') Dec.add({ kind: 'redes', uniq: 'dm' + w, title: 'Un niño hincha te pide un saludo', text: 'La madre de un niño enfermo, fanático tuyo, te pide un video de ánimo.', opts: [{ k: 'video', label: 'Grabarle un video', hint: '+imagen' }, { k: 'visit', label: 'Visitarlo en persona', hint: '++imagen, algo de cansancio' }, { k: 'ign', label: 'No responder', hint: '-imagen' }], def: 'video', exp: 3, data: { t: 'dm', k: k, nm: nm } });
    else Dec.add({ kind: 'redes', uniq: 'dm' + w, title: 'Un excompañero te escribe', text: nm + ', excompañero de tus inicios, te manda un mensaje: «¿Te acuerdas de cuando jugábamos en el potrero?»', opts: [{ k: 'resp', label: 'Responder con cariño', hint: '+moral' }, { k: 'inv', label: 'Invitarlo a un partido', hint: '++moral, +fama' }, { k: 'ign', label: 'Dejarlo en visto', hint: '-moral' }], def: 'resp', exp: 3, data: { t: 'dm', k: k, nm: nm } });
  }
  function resolveDm(k, d) {
    var h = hero(), r = X.ensure(), t = d.data.k, m = '';
    if (t === 'idolo') { if (k === 'ag') { mor(3); m = 'Agradeciste con humildad: te llenó de motivación.'; } else if (k === 'cons') { mor(5); addFame(1.5); m = 'Te dio un consejo que no olvidarás.'; post(media(), h.nm + ' recibió consejos de ' + d.data.nm + ': «Es un chico con la cabeza bien puesta».', 1.4); } else { mor(-1); m = 'No contestaste.'; } }
    else if (t === 'nino') { if (k === 'video') { img(3); addFame(1.5); mor(2); r.brand = U.clamp(r.brand + 1, 0, 100); m = 'Grabaste el video: la familia quedó feliz.'; } else if (k === 'visit') { img(5); addFame(3); mor(4); hero().fat = U.clamp(hero().fat + 4, 0, 100); r.brand = U.clamp(r.brand + 2, 0, 100); m = 'Visitaste al niño: una historia que emociona a todos.'; post(media(), 'Gesto de ' + h.nm + ': visitó a un pequeño hincha hospitalizado.', 2.2); } else { img(-1); m = 'No respondiste el mensaje.'; } }
    else { if (k === 'resp') { mor(3); m = 'Recordaron viejos tiempos.'; } else if (k === 'inv') { mor(5); addFame(1); m = 'Lo invitaste a un partido: gesto muy comentado.'; } else { mor(-2); m = 'Lo dejaste en visto.'; } }
    return { ok: true, msg: m };
  }

  Dec.handlers.redes = function (k, d, auto) {
    try {
      var t = d.data.t;
      if (t === 'pol') return resolvePol(k, d, auto);
      if (t === 'rum') return resolveRum(k, d);
      if (t === 'par') return resolvePar(k);
      if (t === 'dm') return resolveDm(k, d);
    } catch (e) { if (window.console) console.warn('redes', e); }
    return { ok: true, msg: '' };
  };

  // ---------- semana ----------
  X.weekly = function (w) {
    var h = hero(); if (!h || h.retired || !h.soc) return;
    var r = X.ensure();
    if (w % 4 === 0) { r.folH.push([w, fol()]); if (r.folH.length > 300) r.folH.splice(0, 40); }
    sponsorWeekly(w); fanWeekly(w); parodyWeekly(w); polEvent(w); rumorEvent(w); dmEvent(w);
  };
  var we0 = Hero.weekEnd;
  Hero.weekEnd = function () { var r = we0.apply(this, arguments); try { X.weekly(FP.S.week); } catch (e) { if (window.console) console.warn('redes', e); } return r; };
})();
