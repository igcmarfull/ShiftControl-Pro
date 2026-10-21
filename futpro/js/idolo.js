/* FUTPRO — legado e ídolo por club. Cada club donde juegas guarda tu historia (partidos, goles, títulos, finales, derbis, permanencia,
   ofertas rechazadas por quedarte, descensos evitados) y la convierte en un puntaje de legado ajustado al tamaño del club, con seis estatus
   (Desconocido · Jugador querido · Referente · Ídolo · Leyenda · Ídolo eterno). Aparte se lleva el cariño actual de la hinchada (puede caer
   si te vas a un rival). También acumula récords de goleadores por club desde que empieza la partida (la IA no guarda partidos jugados).
   Los pesos y umbrales son supuestos de diseño probados en tests/idolo.js, no datos reales. Estado en hero.ido y S.clubRec. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, Dec = FP.Dec, Sim = FP.Sim, Hero = FP.Hero, M = FP.Market, K = FP.Contracts;
  var Id = FP.Idolo = {};
  function hero() { return FP.S && FP.S.hero; }
  function hist(t, club) { var h = hero(); (h.history = h.history || []).push({ w: FP.S.week, t: t, club: club }); }
  function cname(id) { return C.tname(id); }

  Id.STATUS = [[95, 'Ídolo eterno'], [80, 'Leyenda'], [60, 'Ídolo'], [40, 'Referente'], [20, 'Jugador querido'], [0, 'Desconocido']];
  Id.label = function (pts) { for (var i = 0; i < Id.STATUS.length; i++) if (pts >= Id.STATUS[i][0]) return Id.STATUS[i][1]; return 'Desconocido'; };
  Id.rank = function (pts) { for (var i = 0; i < Id.STATUS.length; i++) if (pts >= Id.STATUS[i][0]) return Id.STATUS.length - 1 - i; return 0; };      // 0 (desconocido) … 5 (eterno)
  Id.loveLabel = function (v) { return v >= 80 ? 'Adorado' : v >= 60 ? 'Querido' : v >= 40 ? 'Aceptado' : v >= 20 ? 'Frío' : 'Enemistado'; };

  Id.ensure = function () {
    var h = hero(); if (!h) return null;
    if (!h.ido) { h.ido = { v: 1, clubs: {}, cur: null, tn: 0, hall: [], ev: [], mig: 0 }; }
    var st = h.ido; if (!st.mig) { st.mig = 1; try { Id.migrateLedger(); } catch (e) { if (window.console) console.warn('idolo', e); } }
    return st;
  };
  function blank() { return { ap: 0, g: 0, a: 0, seasons: 0, lg: 0, cup: 0, cont: 0, fin: 0, dg: 0, hat: 0, saved: 0, promo: 0, rej: 0, love: 30, since: null, last: null, left: null, trait: 0, ev: [] }; }
  Id.club = function (id, create) { var st = Id.ensure(); if (!st) return null; var c = st.clubs[id]; if (!c && create) c = st.clubs[id] = blank(); return c || null; };
  function baseName(n) { return String(n || '').replace(/\s*\((cedido|juv\.)\)\s*$/i, '').trim(); }
  function clubIdByName(n) { var c = FP.Game && FP.Game.clubByName(baseName(n)); return c ? c.id : null; }

  // ---------- tamaño del club y puntaje ----------
  // Un club grande exige más para el mismo estatus: ≈0,6 (club chico) … ≈1,6 (gigante)
  Id.size = function (id) {
    var c = FP.S.clubs[id]; if (!c) return 1; var t = FP.LGDEF[c.lg];
    return U.clamp(0.45 + (c.st - 35) / 45 + (t.t === 1 ? 0.12 : t.t === 2 ? 0.02 : -0.06) + (c.fin - 5) * 0.025, 0.55, 1.7);
  };
  Id.raw = function (c) {
    return c.ap * 0.05 + c.g * 0.14 + c.a * 0.07 + c.seasons * 2.5 + c.lg * 13 + c.cup * 8 + c.cont * 18 + c.fin * 6 + c.dg * 3.5 + c.hat * 2 + c.saved * 11 + c.promo * 8 + Math.min(4, c.rej) * 4;
  };
  Id.pts = function (id) { var c = Id.club(id); if (!c) return 0; return Math.round(100 * (1 - Math.exp(-Id.raw(c) / (36 * Id.size(id))))); };
  Id.status = function (id) { var p = Id.pts(id); return { pts: p, label: Id.label(p), rank: Id.rank(p) }; };

  // ---------- registro partido a partido ----------
  var am0 = Hero.afterMatch;
  Hero.afterMatch = function (prep, res) {
    var r = am0.apply(this, arguments);
    try { Id.onMatch(prep, res); } catch (e) { if (window.console) console.warn('idolo', e); }
    return r;
  };
  Id.onMatch = function (prep, res) {
    var h = hero(), hm = res && res.hero, id = prep.mine; if (!h || h.retired || !hm || id == null || id < 0 || id >= 5000 || prep.comp.cat || prep.comp.kind === 'F' || prep.f.fr) return;
    var c = Id.club(id, true), comp = prep.comp; if (c.since == null) c.since = FP.S.week; c.last = FP.S.week;
    var mg = prep.home ? res.hs : res.as, og = prep.home ? res.as : res.hs, win = res.ps ? (prep.home ? res.ps[0] > res.ps[1] : res.ps[1] > res.ps[0]) : mg > og, loss = res.ps ? !win : mg < og;
    // cariño de la hinchada con cada partido
    var d = win ? 0.4 : loss ? -0.3 : 0.05;
    if (hm.played) {
      c.ap++; c.g += hm.g; c.a += hm.a; d += hm.g * 1.2 + hm.a * 0.6 + (hm.rating >= 7.5 ? 0.6 : hm.rating && hm.rating <= 5.5 ? -0.8 : 0);
      if (hm.g >= 3) { c.hat++; d += 2; }
      var ro = String(prep.f.ro || ''), fin = /\bfinal\b/i.test(ro) && !/semi|cuartos|octavos|dieciseis/i.test(ro);
      if (fin && hm.g > 0 && win) { c.fin++; d += 4; Id.note(id, 'Anotó en la final de ' + FP.Stats.compName(comp)); }
      if (FP.Derbis && FP.Derbis.is(id, prep.opp) && hm.g > 0) { c.dg += hm.g; d += 3 * hm.g; if (hm.g > 0) Id.note(id, 'Marcó en el derbi ante ' + cname(prep.opp)); }
    }
    c.love = U.clamp(c.love + d, 0, 100);
    // reencuentro con un club al que perteneciste
    var o = Id.club(prep.opp);
    if (o && prep.opp !== id && Id.pts(prep.opp) >= 40 && hm.played) {
      if (o.love >= 55) { o.love = Math.min(100, o.love + 1); h.mor = U.clamp(h.mor + 3, 0, 100); Hero.msg('La afición de ' + cname(prep.opp) + ' te dedica una ovación: tu paso por el club no se olvida.', 'ok'); }
      else if (o.love < 30) { h.mor = U.clamp(h.mor - 3, 0, 100); Hero.msg('El estadio de ' + cname(prep.opp) + ' te recibe con silbidos.', 'warn'); }
    }
  };
  Id.note = function (id, t) { var c = Id.club(id); if (!c) return; c.ev = c.ev || []; c.ev.unshift({ w: FP.S.week, t: t }); if (c.ev.length > 12) c.ev.length = 12; };

  // ---------- cierre de liga: temporadas, descenso evitado, ascenso, récords de la IA ----------
  var olc0 = Sim.onLeagueClosed;
  Sim.onLeagueClosed = function (comp, entry) {
    if (olc0) olc0(comp, entry);
    try { Id.recordClub(comp, entry); Id.onLeague(comp, entry); } catch (e) { if (window.console) console.warn('idolo', e); }
  };
  Id.onLeague = function (comp, entry) {
    var h = hero(); if (!h || h.retired || (h.tk !== 'pro' && h.tk !== 'loan') || comp.teams.indexOf(h.team) < 0) return;
    var c = Id.club(h.team); if (!c) return;
    var label = String(comp.label).replace(/^(Apertura|Clausura)\s+/, ''), rows = FP.Stats.rows(function (r) { return r.t === h.team && r.k === 'liga' && r.s === label; }), tot = FP.Stats.sum(rows);       // el registro conserva la temporada aunque h.season ya se reinició
    var def = FP.LGDEF[comp.lg], tab = entry.tab, rank = tab.indexOf(h.team) + 1, n = tab.length, ap = tot.p;
    if (ap >= 10) c.seasons++;
    if (def.dn > 0 && ap >= 12 && (rank === n - def.dn || rank === n - def.dn - 1) && (tot.g >= 5 || (tot.rn && tot.rs / tot.rn >= 6.9))) { c.saved++; c.love = Math.min(100, c.love + 12); Id.note(h.team, 'Ayudó a salvar al club del descenso'); Hero.msg('Tus actuaciones fueron clave para que ' + cname(h.team) + ' se salvara del descenso.', 'ok'); }
    if (entry.up && entry.up.indexOf(h.team) >= 0 && ap >= 12) { c.promo++; c.love = Math.min(100, c.love + 10); Id.note(h.team, 'Ascenso conseguido'); }
  };
  // récords de goleadores por club (desde que empieza la partida)
  Id.recordClub = function (comp, entry) {
    var S = FP.S; if (!comp.sc) return; var cr = S.clubRec = S.clubRec || {};
    Object.keys(comp.sc).forEach(function (pid) {
      var e = comp.sc[pid], g = e[0] || 0, a = e[1] || 0, cid = e[2], nm = e[3]; if (!g && !a || cid == null || cid < 0 || cid >= 5000 || +pid === 0) return;
      var r = cr[cid] || (cr[cid] = { p: {}, bg: null, ba: null }), p = r.p[pid] || (r.p[pid] = { n: nm, g: 0, a: 0, y0: comp.label, y1: comp.label });
      p.g += g; p.a += a; p.y1 = comp.label;
      if (!r.bg || g > r.bg.g) r.bg = { n: nm, g: g, y: comp.label };
      if (!r.ba || a > r.ba.a) r.ba = { n: nm, a: a, y: comp.label };
    });
    Object.keys(S.clubRec).forEach(function (cid) {
      if (S.clubs[cid].lg !== comp.lg) return; var r = S.clubRec[cid], ks = Object.keys(r.p);
      if (ks.length > 10) ks.sort(function (a, b) { return r.p[b].g - r.p[a].g; }).slice(10).forEach(function (k) { delete r.p[k]; });
    });
  };
  // goleadores históricos del club (IA) y la posición del jugador entre ellos
  Id.top = function (clubId, n) {
    var r = FP.S.clubRec && FP.S.clubRec[clubId], c = Id.club(clubId), out = [];
    if (r) Object.keys(r.p).forEach(function (k) { out.push({ n: r.p[k].n, g: r.p[k].g, a: r.p[k].a, y: r.p[k].y0 === r.p[k].y1 ? r.p[k].y0 : r.p[k].y0 + '–' + r.p[k].y1 }); });
    if (c && c.g > 0) out.push({ n: hero().nm, g: c.g, a: c.a, y: c.since != null ? D.year(c.since) + '–' + D.year(c.last) : '', me: 1 });
    out.sort(function (a, b) { return b.g - a.g; });
    return n ? out.slice(0, n) : out;
  };

  // ---------- cambios de club, títulos y ofertas rechazadas ----------
  Id.weekly = function (w) {
    var h = hero(), st = Id.ensure(); if (!h || h.retired) return;
    // títulos nuevos del jugador asociados a un club
    if (h.trophies.length > st.tn) {
      h.trophies.slice(st.tn).forEach(function (t) {
        st.tn++; if (t.sub || t.nt || /Juvenil|regional/i.test(t.nm)) return;
        var id = clubIdByName(t.club); if (id == null) return; var c = Id.club(id, true), cont = /Libertadores|Champions|Europa|Sudamericana|Conference|Mundial de Clubes|Intercontinental/i.test(t.nm), lg = /^Campe[oó]n de /i.test(t.nm) && !cont;
        if (cont) c.cont++; else if (lg) c.lg++; else c.cup++;
        c.love = Math.min(100, c.love + (cont ? 18 : lg ? 15 : 8)); Id.note(id, t.nm + ' (' + t.y + ')');
      });
      st.tn = h.trophies.length;
    }
    // cambio de club
    if (h.tk === 'pro' || h.tk === 'academy' || h.tk === 'free' || h.tk === 'amat') {
      var now = h.tk === 'pro' && h.club != null ? h.club : null;
      if (st.cur != null && now !== st.cur && (h.tk === 'free' || (now != null && now !== st.cur))) Id.onLeave(st.cur, now);
      if (now != null && now !== st.cur) { var nc = Id.club(now, true); if (nc.since == null) nc.since = w; if (nc.left == null || nc.love === 30) { /* club nuevo */ } nc.left = null; }
      if (h.tk === 'pro' || h.tk === 'free') st.cur = now;
    }
    if (w % 4 === 0) Id.drift();
    if (w % 52 === 26) Id.yearly();
    Id.fans(w);
  };
  Id.drift = function () {
    var st = Id.ensure(), h = hero();
    Object.keys(st.clubs).forEach(function (k) { var c = st.clubs[k], cur = (+k === st.cur); c.love += ((cur ? 45 : 50) - c.love) * (cur ? 0.01 : 0.004); c.love = Math.round(U.clamp(c.love, 0, 100) * 100) / 100; });
  };
  Id.onLeave = function (oldId, newId) {
    var h = hero(), st = Id.ensure(), c = Id.club(oldId); if (!c) return;
    var pts = Id.pts(oldId), rk = Id.rank(pts), rival = newId != null && FP.Derbis && FP.Derbis.is(oldId, newId), oldC = FP.S.clubs[oldId], free = newId == null;
    c.left = FP.S.week;
    var d = rival ? -(30 + rk * 6) : free ? -(8 + rk * 2) : -(4 + rk * 2); c.love = U.clamp(c.love + d - (c.love > 70 && rival ? 10 : 0), 0, 100); if (rival) c.trait = 1;
    var nm = newId != null ? cname(newId) : null;
    if (rk >= 3) {
      var txt = rival ? 'Los hinchas de ' + oldC.nm + ' no perdonan que ' + h.nm + ', ' + Id.label(pts).toLowerCase() + ' del club, fiche por su rival ' + nm + '.' : 'Los hinchas de ' + oldC.nm + ' despiden a ' + h.nm + (nm ? ' (ahora en ' + nm + ')' : '') + ': ' + Id.label(pts).toLowerCase() + ' del club.';
      Sim.news(txt, 'hero', rival ? 3 : 2); Hero.msg(txt, rival ? 'warn' : 'i'); hist(rival ? 'Su fichaje por ' + nm + ' divide a los hinchas de ' + oldC.nm + '.' : 'Deja ' + oldC.nm + ' tras ser ' + Id.label(pts).toLowerCase() + ' del club.', oldId);
    } else if (rival) { Hero.msg('Los hinchas de ' + oldC.nm + ' reciben mal tu fichaje por su rival ' + nm + '.', 'warn'); }
    Id.note(oldId, rival ? 'Se fue al rival ' + nm : 'Salida del club');
  };
  // ofertas rechazadas por quedarse
  var resp0 = M.respond;
  M.respond = function (oid, accept) {
    var h = hero(), o = h && h.offers.filter(function (x) { return x.id === oid; })[0], r = resp0.apply(this, arguments);
    try {
      if (!accept && o && o.type === 'transfer' && h.tk === 'pro' && h.club != null && o.club !== h.club && !o.expired) {
        var c = Id.club(h.club, true), big = FP.S.clubs[o.club] && FP.S.clubs[o.club].st >= FP.S.clubs[h.club].st;
        if (big && Id.pts(h.club) >= 20) { c.rej++; c.love = Math.min(100, c.love + 5); Id.note(h.club, 'Rechazó una oferta de ' + cname(o.club) + ' para quedarse'); if (c.rej <= 2) Hero.msg('Los hinchas de ' + cname(h.club) + ' valoran que rechaces a ' + cname(o.club) + ' para quedarte.', 'ok'); }
      }
    } catch (e) { if (window.console) console.warn('idolo', e); }
    return r;
  };

  // ---------- consecuencias ----------
  // los hinchas piden tu renovación y el club mejora un poco la oferta
  Id.fans = function (w) {
    var h = hero(), ct = h.contract, st = Id.ensure(); if (!ct || h.tk !== 'pro' || h.club == null || ct.endW == null) return;
    var left = ct.endW - w; if (left > 30 || left < 4 || ct.fansAsk) return;
    var c = Id.club(h.club); if (!c) return; var s = Id.status(h.club);
    if (s.rank >= 3 && c.love >= 55) { ct.fansAsk = 1; var t = 'Los hinchas de ' + cname(h.club) + ' piden en redes y en el estadio que renueves.'; Hero.msg(t, 'ok'); Sim.news(t, 'hero', 2); Id.note(h.club, 'La afición pidió su renovación'); }
  };
  var terms0 = K.terms;
  K.terms = function (club, o) {
    var t = terms0.apply(this, arguments), h = hero();
    try { if (o.type === 'renew' && h && club && h.club === club.id && h.contract && h.contract.fansAsk) { var s = Id.status(club.id); if (s.rank >= 3) t.wage = Math.round(t.wage * (1 + 0.04 * (s.rank - 2))); } } catch (e) { }
    return t;
  };
  // un club donde eres ídolo te ofrece volver
  Id.yearly = function () {
    var h = hero(), st = Id.ensure(), S = FP.S; if (!h || h.retired || (h.tk !== 'pro' && h.tk !== 'free')) return;
    var age = Hero.age(); if (age < 24 || h.offers.some(function (o) { return o.ido; })) return;
    var cand = Object.keys(st.clubs).map(function (k) { return +k; }).filter(function (id) { var c = st.clubs[id]; return id !== h.club && c.left != null && c.love >= 50 && Id.rank(Id.pts(id)) >= 3 && FP.Rep.foreignOK(S.clubs[id], h.nat, age) && S.clubs[id].st >= h.ovr - 12 && S.clubs[id].st <= h.ovr + 8; });
    if (!cand.length || R() > 0.45) return;
    var id = cand.sort(function (a, b) { return Id.pts(b) - Id.pts(a); })[0], club = S.clubs[id], val = M.heroValue(), ending = h.contract && h.contract.endW != null && h.contract.endW - S.week < 40 || h.tk === 'free';
    var role = h.ovr >= club.st - 3 ? 'Titular' : 'Rotación', wage = M.wageFor(club, role === 'Titular' ? 1.1 : 0.95), years = age < 30 ? U.int(2, 3) : U.int(1, 2), fee = ending ? 0 : Math.round(val * (0.6 + R() * 0.3));
    M.addOffer({ type: 'transfer', club: id, fee: fee, wage: wage, years: years, role: role, ido: 1, text: club.nm + ' quiere que vuelvas: sigues siendo ' + Id.label(Id.pts(id)).toLowerCase() + ' del club. ' + role + ', ' + years + ' años, ' + FP.fmt.money(wage) + ' al año' + (fee ? ', traspaso ' + FP.fmt.money(fee) : '') + '.', exp: S.week + 8 });
  };

  // ---------- retiro: homenaje, salón del club y puesto en el club ----------
  Id.best = function () {
    var st = Id.ensure(), best = null;
    Object.keys(st.clubs).forEach(function (k) { var p = Id.pts(+k), c = st.clubs[k]; if (!best || p + c.love * 0.1 > best.score) best = { id: +k, pts: p, score: p + c.love * 0.1, love: c.love }; });
    return best;
  };
  var ret0 = FP.Events.retire;
  FP.Events.retire = function () {
    var h = hero(), was = h && h.retired, r = ret0.apply(this, arguments);
    try {
      if (h && h.retired && !was) {
        var st = Id.ensure(); Object.keys(st.clubs).forEach(function (k) { var p = Id.pts(+k); if (p >= 80 && st.hall.indexOf(+k) < 0) { st.hall.push(+k); hist('Es incluido en el salón de la fama de ' + cname(+k) + '.', +k); Sim.news(h.nm + ' entra en el salón de la fama de ' + cname(+k) + '.', 'hero', 2); } });
        var b = Id.best(), p = FP.Post.ensure();
        if (b && b.pts >= 60 && p.legacy && (!p.legacy.top || FP.Game.clubByName(p.legacy.top.nm) == null || FP.Game.clubByName(p.legacy.top.nm).id !== b.id)) {
          var d = Dec.open('retiro')[0]; if (d && !d.opts.some(function (o) { return o.k === 'idolo'; })) { d.opts.unshift({ k: 'idolo', label: 'Homenaje en ' + cname(b.id), hint: 'Eres ' + Id.label(b.pts).toLowerCase() + ' del club: la hinchada te despide como tal.' }); d.def = 'idolo'; d.data.idolClub = b.id; }
        }
      }
    } catch (e) { if (window.console) console.warn('idolo', e); }
    return r;
  };
  var hr0 = Dec.handlers.retiro;
  Dec.handlers.retiro = function (k, d, auto) {
    if (k === 'idolo') {
      var p = FP.Post.ensure(), lg = p.legacy, id = d.data.idolClub, c = Id.club(id); if (!lg || !c) return { ok: true, msg: '' };
      lg.top = { nm: cname(id), ap: c.ap, g: c.g, y: c.seasons }; var r = hr0.call(this, 'club', d, auto); if (c) c.love = Math.min(100, c.love + 10); return r;
    }
    return hr0.apply(this, arguments);
  };
  // al año del retiro, el club donde eres leyenda te ofrece un puesto
  var pw0 = FP.Post.weekly;
  FP.Post.weekly = function (w) {
    pw0.apply(this, arguments);
    var h = hero(); if (!h || !h.retired) return; var d = w - h.retiredW; if (d <= 0 || d % 52 !== 20) return;
    try { Id.postOffer(); } catch (e) { if (window.console) console.warn('idolo', e); }
  };
  Id.postOffer = function () {
    var h = hero(), st = Id.ensure(), S = FP.S, b = Id.best(); if (!b || b.pts < 80 || b.love < 40 || st.postDone) return; st.postDone = 1;
    var p = FP.Post.ensure(), pa = p.path, club = S.clubs[b.id], opts = [{ k: 'embajador', label: 'Ser embajador de ' + club.nm, hint: 'Ingresos modestos, prestigio y un lugar fijo en el club.' }];
    if (pa && pa.k === 'coach' && p.lic >= 1 && !pa.job) opts.push({ k: 'formativas', label: 'Entrenador de juveniles en ' + club.nm, hint: 'Empiezas tu carrera de técnico en el club de tu vida.' });
    opts.push({ k: 'no', label: 'Agradecer, pero no', hint: '' });
    Dec.add({ kind: 'rt', uniq: 'idpost' + S.week, title: club.nm + ' te abre las puertas', text: 'Eres ' + Id.label(b.pts).toLowerCase() + ' de ' + club.nm + ' y la directiva quiere tenerte cerca.', opts: opts, def: 'no', exp: 40, data: { t: 'idpost', club: b.id } });
  };
  var rth0 = Dec.handlers.rt;
  Dec.handlers.rt = function (k, d) {
    var dt = d.data || {};
    if (dt.t === 'idpost') {
      var h = hero(), p = FP.Post.ensure(), pa = p.path, club = FP.S.clubs[dt.club];
      if (k === 'embajador') { FP.Post.pay(60, 'Embajador de ' + club.nm); FP.Retiro.ensure().amb = dt.club; if (h.soc) h.soc.fame = (h.soc.fame || 0) + 4; hist('Es nombrado embajador de ' + club.nm + '.', dt.club); return { ok: true, msg: 'Eres embajador de ' + club.nm + '.' }; }
      if (k === 'formativas' && pa && pa.k === 'coach' && !pa.job) { pa.job = { club: dt.club, role: 'youth', since: FP.S.week }; hist('Asume como entrenador de juveniles de ' + club.nm + '.', dt.club); return { ok: true, msg: 'Eres entrenador de juveniles de ' + club.nm + '.' }; }
      return { ok: true, msg: '' };
    }
    return rth0.apply(this, arguments);
  };

  // ---------- partidas anteriores ----------
  Id.migrateLedger = function () {
    var h = hero(), st = h.ido; if (!h.led) return;
    FP.Stats.rows(function (r) { return r.t != null && r.t < 5000 && /^(liga|copa|cont)$/.test(r.k); }).forEach(function (r) { var c = Id.club(r.t, true); c.ap += r.p; c.g += r.g; c.a += r.a; if (c.since == null || r.o < c.since) c.since = r.o; if (c.last == null || r.o > c.last) c.last = r.o; });
    var seen = {}; FP.Stats.rows(function (r) { return r.t != null && r.t < 5000 && r.k === 'liga' && r.p >= 10; }).forEach(function (r) { var k = r.t + '|' + r.s; if (!seen[k]) { seen[k] = 1; Id.club(r.t, true).seasons++; } });
    Object.keys(st.clubs).forEach(function (k) { st.clubs[k].love = 40; });
    st.tn = 0; var cl = h.club != null && h.tk === 'pro' ? h.club : null; st.cur = cl; if (cl != null) Id.club(cl, true).love = 55;
  };
  Id.migrate = function () { Id.ensure(); };
  var we0 = Hero.weekEnd;
  Hero.weekEnd = function () { var r = we0.apply(this, arguments); try { if (hero() && !hero().retired) Id.weekly(FP.S.week); } catch (e) { if (window.console) console.warn('idolo', e); } return r; };
})();
