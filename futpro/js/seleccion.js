/* FUTPRO — seleccionador jugable: diriges a la selección de tu país (Sub-17, Sub-20, Sub-23 o Absoluta).
   Tú armas la convocatoria y diriges con el motor real los partidos de tu categoría (amistosos, torneos continentales y mundiales).
   Reutiliza Coach (partidos), NT (nóminas y torneos) y Paths2 (camino «sel»). Estado en hero.post.path.job = {nat, cat, sq, conf}.
   Cupos por posición, sueldos y requisitos de licencia son supuestos de diseño. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, Dec = FP.Dec, Sim = FP.Sim, P = FP.Post, X = FP.Paths2, K = FP.Coach, NT = FP.NT, Hero = FP.Hero;
  var Sel = FP.Sel = {};
  Sel.CATS = { U17: { n: 'Sub-17', lic: 1, wage: 30 }, U20: { n: 'Sub-20', lic: 2, wage: 60 }, U23: { n: 'Sub-23', lic: 2, wage: 90 }, ABS: { n: 'Absoluta', lic: 3, wage: 350 } };
  Sel.ORDER = ['U17', 'U20', 'U23', 'ABS'];
  var QUOTA = { GK: 3, CB: 4, LB: 2, RB: 2, DM: 2, CM: 2, AM: 2, LW: 2, RW: 2, ST: 2 };
  Sel.size = function (cat) { return cat === 'ABS' ? 26 : 23; };
  Sel.quota = function (cat) { var q = {}, extra = cat === 'ABS' ? 3 : 0; Object.keys(QUOTA).forEach(function (k) { q[k] = QUOTA[k]; }); q.__extra = extra; return q; };

  P.PATHS.sel = { nm: 'Seleccionador', d: 'Diriges a la selección de tu país, de la Sub-17 a la absoluta: armas la convocatoria y diriges con el motor real los amistosos, torneos continentales y mundiales de tu categoría.' };

  function hero() { return FP.S && FP.S.hero; }
  Sel.path = function () { var h = hero(), p = h && h.retired && h.post; return p && p.path && p.path.k === 'sel' ? p.path : null; };
  Sel.job = function () {
    var pa = Sel.path(), j = pa && pa.job; if (!j || j.nat == null) return null;
    if (!j.cat) j.cat = 'U20'; if (!j.sq) j.sq = []; if (j.conf == null) j.conf = 60; if (!j.seen) j.seen = {};
    return j;
  };
  Sel.mine = function (natId, cat) { var j = Sel.job(); return !!j && j.nat === natId && j.cat === cat; };
  Sel.can = function (cat) {
    var p = P.ensure(), c = Sel.CATS[cat], lg = p.legacy ? p.legacy.score : 0; if (!c) return false;
    if (p.lic < c.lic) return false;
    if (cat === 'ABS') return p.exp >= 3 || lg >= 80;
    return true;
  };
  Sel.need = function (cat) { var p = P.ensure(), c = Sel.CATS[cat]; if (p.lic < c.lic) return P.LIC[c.lic]; if (cat === 'ABS' && !Sel.can(cat)) return '3 años de experiencia (o legado 80)'; return null; };

  // ---------- convocatoria ----------
  var ME = { nm: 'yo', pot: 1, vet: 0, form: 0.5 };
  Sel.score = function (p, cat) { return NT.score(p, cat, ME, FP.S.week); };
  Sel.pool = function () {
    var j = Sel.job(); if (!j) return [];
    return NT.candidates(j.nat, j.cat, FP.S.week).map(function (p) { return { p: p, sc: Sel.score(p, j.cat) }; }).sort(function (a, b) { return b.sc - a.sc; });
  };
  function okPlayer(p, cat) { return p && typeof p === 'object' && p.c !== -2 && (cat === 'ABS' ? p.c >= 0 : NT.eligible(p, cat)); }
  Sel.players = function () {
    var j = Sel.job(), S = FP.S; if (!j) return [];
    var all = j.sq.map(function (i) { return S.pl[i]; }).filter(function (p) { return okPlayer(p, j.cat); });
    var ok = all.filter(function (p) { return !(p.inj > 0); });
    return ok.length >= 14 ? ok : all;
  };
  // quita de la lista a quienes ya no pueden estar (retirados, fuera de edad)
  Sel.clean = function () { var j = Sel.job(), S = FP.S; if (!j) return; j.sq = j.sq.filter(function (i) { return okPlayer(S.pl[i], j.cat); }); };
  Sel.counts = function () { var c = {}; Sel.players().forEach(function (p) { c[p.p] = (c[p.p] || 0) + 1; }); return c; };
  Sel.autoFill = function () {
    var j = Sel.job(); if (!j) return 0; Sel.clean();
    var n = Sel.size(j.cat), have = {}, cnt = {}, added = 0, pool = Sel.pool();
    j.sq.forEach(function (i) { have[i] = 1; var p = FP.S.pl[i]; if (p) cnt[p.p] = (cnt[p.p] || 0) + 1; });
    Object.keys(QUOTA).forEach(function (ps) {
      while ((cnt[ps] || 0) < QUOTA[ps] && j.sq.length < n) {
        var e = pool.filter(function (x) { return x.p.p === ps && !have[x.p.i]; })[0]; if (!e) break;
        j.sq.push(e.p.i); have[e.p.i] = 1; cnt[ps] = (cnt[ps] || 0) + 1; added++;
      }
    });
    pool.forEach(function (e) { if (j.sq.length < n && !have[e.p.i]) { j.sq.push(e.p.i); have[e.p.i] = 1; added++; } });
    return added;
  };
  Sel.add = function (pid) {
    var j = Sel.job(), p = FP.S.pl[pid]; if (!j) return { ok: false, msg: '' };
    if (j.sq.indexOf(pid) >= 0) return { ok: false, msg: 'Ya está en la lista.' };
    if (!okPlayer(p, j.cat)) return { ok: false, msg: 'No puede ser convocado en esta categoría.' };
    if (j.sq.length >= Sel.size(j.cat)) return { ok: false, msg: 'La lista está completa (' + Sel.size(j.cat) + '). Quita a alguien primero.' };
    j.sq.push(pid); return { ok: true, msg: p.n + ' convocado.' };
  };
  Sel.remove = function (pid) { var j = Sel.job(); if (!j) return { ok: false, msg: '' }; j.sq = j.sq.filter(function (i) { return i !== pid; }); return { ok: true, msg: '' }; };
  Sel.reset = function () { var j = Sel.job(); if (!j) return; j.sq = []; Sel.autoFill(); };
  Sel.warnings = function () {
    var j = Sel.job(), c = Sel.counts(), w = []; if (!j) return w;
    var n = Sel.players().length; if (n < 18) w.push('Con menos de 18 convocados el motor completa la lista solo.');
    if ((c.GK || 0) < 2) w.push('Necesitas al menos 2 porteros.');
    var def = (c.CB || 0) + (c.LB || 0) + (c.RB || 0); if (def < 5) w.push('Pocos defensas (' + def + ').');
    var atk = (c.ST || 0) + (c.LW || 0) + (c.RW || 0); if (atk < 3) w.push('Pocos delanteros (' + atk + ').');
    return w;
  };

  // la nómina del seleccionador sustituye a la de la IA, y su calidad define la fuerza del equipo
  var so0 = NT.squadOf;
  NT.squadOf = function (natId, cat) {
    if (Sel.mine(natId, cat)) { var l = Sel.players(); if (l.length < 14) { Sel.autoFill(); l = Sel.players(); } return l; }
    return so0.apply(this, arguments);
  };
  var st0 = NT.strength;
  NT.strength = function (natId, cat, players) { if (Sel.mine(natId, cat) && cat !== 'ABS') players = NT.squadOf(natId, cat); return st0.call(this, natId, cat, players); };
  // en la absoluta la fuerza sale del país: la calidad de tu lista suma o resta un poco frente a la lista recomendada
  var refCache = null;
  Sel.refMean = function () {
    var j = Sel.job(), w = FP.S.week; if (!j) return 0;
    if (refCache && refCache.k === j.nat + '|' + j.cat && w - refCache.w < 52) return refCache.v;
    var list = Sel.pool().slice(0, 60), t = FP.Youth.pickTeam(list.map(function (e) { return { p: e.p, sc: e.sc }; }), '4-3-3');
    var m = t.xi.reduce(function (s, x) { return s + x.e.p.o; }, 0) / Math.max(1, t.xi.length); refCache = { k: j.nat + '|' + j.cat, w: w, v: m }; return m;
  };
  Sel.xiMean = function () {
    var pl = Sel.players(); if (pl.length < 11) return 0;
    var t = FP.Youth.pickTeam(pl.map(function (p) { return { p: p, sc: p.o }; }), '4-3-3');
    return t.xi.reduce(function (s, x) { return s + x.e.p.o; }, 0) / Math.max(1, t.xi.length);
  };
  var kb0 = K.boost;
  K.boost = function () {
    var b = kb0.apply(this, arguments), j = Sel.job();
    if (j && j.cat === 'ABS') b += U.clamp((Sel.xiMean() - Sel.refMean()) * 0.6, -3, 3);
    return b;
  };

  // ---------- vistas para el Banquillo ----------
  K.pseudo = function (j) {
    if (j.club != null) return FP.S.clubs[j.club];
    var n = FP.S.nat[j.nat - 5000]; return { id: j.nat, nm: n.nm + (j.cat === 'ABS' ? '' : ' ' + Sel.CATS[j.cat].n), fm: '4-3-3', nat: 1 };
  };
  K.str = function (prep, id) {
    var ys = prep.comp.ys && prep.comp.ys[id]; if (ys != null) return ys;
    if (id >= 5000 && id < 20000) return FP.S.nat[id - 5000].r - 6;
    return C.strOf(id);
  };
  K.xi = function (id, form, comp) {
    if (id >= 5000 && id < 20000) {
      var lu = NT.lineup(id, comp, null, form);
      if (lu) return lu.xi.map(function (e) { return { slot: e.slot, n: e.p.n, o: Math.round((e.p.ref || e.p).o) }; });      // nivel real del jugador (el motor lo ajusta a la fuerza del equipo)
      return [];
    }
    return FP.Match.lineup(id, { form: form, fav: FP.Proy && FP.Proy.favMap() }).xi.map(function (e) { return { slot: e.slot, n: e.p.n, o: Math.round(e.p.o) }; });
  };

  // ---------- ofertas y ascensos ----------
  Sel.offer = function () {
    var S = FP.S, h = hero(), pa = Sel.path(), p = P.ensure(); if (!pa || pa.job) return;
    var nat = FP.Nat.byCode(h.nat); if (!nat) return;
    var opts = Sel.ORDER.filter(function (c) { return Sel.can(c); }).map(function (c) { return { k: 'c:' + c, label: 'Selección ' + Sel.CATS[c].n + ' de ' + nat.nm, hint: 'Sueldo ' + FP.fmt.money(Sel.CATS[c].wage) + ' al año.' }; });
    if (!opts.length) { Hero.msg('Para dirigir una selección necesitas al menos la Licencia Nivel 1: sácala en Vida y legado › Carrera.', 'i'); return; }
    opts.push({ k: 'no', label: 'Seguir esperando', hint: '' });
    Dec.add({ kind: 'rt', uniq: 'sel' + S.week, title: 'La federación te ofrece una selección', text: 'La federación de ' + nat.nm + ' confía en tu trayectoria. ¿Qué categoría quieres dirigir?', opts: opts, def: 'no', exp: 52, data: { t: 'selecc', nat: nat.id } });
  };
  Sel.take = function (cat, natId) {
    var S = FP.S, h = hero(), pa = Sel.path(); if (!pa) return;
    pa.job = { club: null, nat: natId, cat: cat, role: 'sel', since: S.week, conf: 60, sq: [], seen: {} };
    Sel.autoFill(); refCache = null;
    h.history.push({ w: S.week, t: 'Asume como seleccionador ' + Sel.CATS[cat].n + ' de ' + S.nat[natId - 5000].nm + '.' });
  };
  var hr0 = Dec.handlers.rt;
  Dec.handlers.rt = function (k, d) {
    var dt = d.data || {};
    if (dt.t === 'selecc') {
      if (/^c:/.test(k) && Sel.path() && !Sel.path().job) { var cat = k.slice(2); Sel.take(cat, dt.nat); return { ok: true, msg: 'Eres el seleccionador ' + Sel.CATS[cat].n + '. Revisa tu convocatoria en Vida y legado.' }; }
      return { ok: true, msg: '' };
    }
    if (dt.t === 'selasc') {
      var pa = Sel.path(), j = Sel.job();
      if (k === 'si' && pa && j && Sel.can(dt.cat)) { var nat = FP.S.nat[j.nat - 5000]; Sel.take(dt.cat, j.nat); return { ok: true, msg: 'Pasas a dirigir la selección ' + Sel.CATS[dt.cat].n + ' de ' + nat.nm + '.' }; }
      return { ok: true, msg: '' };
    }
    return hr0.apply(this, arguments);
  };
  var xo0 = X.offers;
  X.offers = function () { var pa = Sel.path(); if (pa) { Sel.offer(); return; } return xo0.apply(this, arguments); };
  var pc0 = P.choose;
  P.choose = function (k) { var r = pc0.apply(this, arguments); if (r.ok && k === 'sel') { try { Sel.offer(); } catch (e) { } } return r; };
  // el resultado anual aleatorio del camino «sel» se reemplaza por los torneos reales
  var sy0 = X.selYear;
  X.selYear = function () { var pa = Sel.path(); if (pa && pa.job && pa.job.nat != null) return; return sy0.apply(this, arguments); };

  // ---------- resultados de torneos ----------
  Sel.resultOf = function (comp, natId) {
    var rank = comp.rank ? comp.rank.indexOf(natId) : -1;
    if (comp.champ === natId) return 'Campeón';
    if (comp.runner === natId) return 'Subcampeón';
    if (rank >= 0 && rank < 4) return 'Semifinales';
    if (rank >= 0 && rank < 8) return 'Cuartos de final';
    return 'Eliminado';
  };
  Sel.tick = function (w) {
    var S = FP.S, h = hero(), pa = Sel.path(), j = Sel.job(); if (!j) return;
    var p = P.ensure();
    if (w % 4 === 0) { Sel.clean(); if (Sel.players().length < 18) Sel.autoFill(); }
    if ((w - j.since) % 13 === 0 && w > j.since) P.pay(Sel.CATS[j.cat].wage / 4, 'Sueldo como seleccionador');
    if ((w - j.since) % 52 === 0 && w > j.since) p.exp++;
    Object.keys(S.comps).forEach(function (id) {
      var c = S.comps[id];
      if (!c.done || !c.nat || c.friendly || c.kind === 'N' || c.kind === 'Q' || c.champ == null || (c.cat || 'ABS') !== j.cat || c.teams.indexOf(j.nat) < 0 || j.seen[id]) return;
      j.seen[id] = 1;
      var res = Sel.resultOf(c, j.nat), nat = S.nat[j.nat - 5000];
      pa.seasons.push({ y: c.label || String(D.year(w)), nat: j.nat, cat: j.cat, role: 'sel', res: res, tour: c.nm });
      if (res === 'Campeón') { pa.titles++; h.history.push({ w: w, t: nat.nm + ' (' + Sel.CATS[j.cat].n + ') gana ' + c.nm + ' bajo tu dirección.' }); Sim.news(h.nm + ' dirige a ' + nat.nm + ' ' + Sel.CATS[j.cat].n + ' al título de ' + c.nm + '.', 'hero', 2); }
      j.conf = U.clamp(j.conf + ({ 'Campeón': 20, 'Subcampeón': 10, 'Semifinales': 5, 'Cuartos de final': 1, 'Eliminado': -2 }[res] || 0), 0, 100);
      var next = Sel.ORDER[Sel.ORDER.indexOf(j.cat) + 1];
      if ((res === 'Campeón' || res === 'Subcampeón') && next && Sel.can(next) && !Dec.open('rt').some(function (d) { return d.data.t === 'selasc'; })) {
        Dec.add({ kind: 'rt', uniq: 'selasc' + id, title: 'Te proponen dirigir la ' + Sel.CATS[next].n, text: 'Tras ' + res.toLowerCase() + ' en ' + c.nm + ', la federación te ofrece el siguiente escalón.', def: 'no', exp: 52, data: { t: 'selasc', cat: next },
          opts: [{ k: 'si', label: 'Dirigir la selección ' + Sel.CATS[next].n, hint: 'Sueldo ' + FP.fmt.money(Sel.CATS[next].wage) + ' al año; armas una lista nueva.' }, { k: 'no', label: 'Seguir en la ' + Sel.CATS[j.cat].n, hint: '' }] });
      }
    });
    // los acumulados de torneos borrados se descartan
    Object.keys(j.seen).forEach(function (id) { if (!S.comps[id]) delete j.seen[id]; });
  };
  var pw0 = P.weekly;
  P.weekly = function (w) { pw0.apply(this, arguments); try { Sel.tick(w); } catch (e) { if (window.console) console.warn('seleccion', e); } };
  Sel.migrate = function () { Sel.job(); };

  // próximos partidos de la selección (para la interfaz)
  Sel.upcoming = function (n) {
    var S = FP.S, j = Sel.job(), out = []; if (!j) return out;
    Object.keys(S.comps).forEach(function (id) {
      var c = S.comps[id]; if (!c.nat || c.done || (c.cat || 'ABS') !== j.cat) return;
      c.fx.forEach(function (f) { if (!f.d && (f.h === j.nat || f.a === j.nat)) out.push({ comp: c, f: f }); });
    });
    return out.sort(function (a, b) { return a.f.w - b.f.w; }).slice(0, n || 5);
  };
})();
