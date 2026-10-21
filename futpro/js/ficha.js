/* FUTPRO — ficha de carrera (estilo enciclopedia) de los jugadores que sigues tras el retiro: tu protegido, tus representados
   y las promesas de tu academia. El mundo solo registra con exactitud goles y asistencias de la IA; los partidos y minutos
   se estiman (alineación probable del club en cada partido) y se marcan como estimados. Estado en hero.fi. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, Sim = FP.Sim, P = FP.Post;
  var F = FP.Ficha = {};

  function hero() { return FP.S && FP.S.hero; }
  F.ensure = function () { var h = hero(); if (!h) return null; if (!h.fi) h.fi = { pl: {}, seen: {} }; return h.fi; };
  F.migrate = F.ensure;

  // jugadores seguidos: protegido, representados y promesas de la academia propia
  F.tracked = function () {
    var h = hero(), p = h && h.post, out = [], seen = {};
    function add(pid, kind) { if (pid > 0 && !seen[pid]) { seen[pid] = 1; out.push({ pid: pid, kind: kind }); } }
    if (p && p.prot) add(p.prot.pid, p.prot.kind === 'hijo' ? 'hijo' : 'protegido');
    if (p && p.path && p.path.k === 'agent') (p.path.clients || []).forEach(function (c) { add(c.pid, 'representado'); });
    if (p && p.acad && p.acad.kids) p.acad.kids.forEach(function (k) { if (!k.out) add(k.pid, 'academia'); });
    return out;
  };
  F.rec = function (pid, kind) {
    var fi = F.ensure(), q = FP.S.pl[pid]; if (!fi) return null;
    var r = fi.pl[pid];
    if (!r) {
      if (!q || typeof q !== 'object') return null;
      r = fi.pl[pid] = { pid: pid, n: q.n, b: q.b, nat: q.nat, pos: q.p, kind: kind || 'seguido', since: FP.S.week, rows: [], hit: [], aw: [], tro: [], prog: [], ntw: {} };
    }
    if (kind && r.kind !== kind) r.kind = kind;
    if (q && typeof q === 'object') { r.n = q.n; r.pos = q.p; r.o = q.o; r.pt = q.pt; r.c = q.c; }
    return r;
  };
  F.sync = function () {
    var fi = F.ensure(), w = FP.S.week; if (!fi) return;
    F.tracked().forEach(function (t) { F.rec(t.pid, t.kind); });
    Object.keys(fi.pl).forEach(function (k) {
      var r = fi.pl[k], q = FP.S.pl[+k], gone = !q || typeof q !== 'object' || q.c === -2;
      if (gone && !r.end) { r.end = w; r.hit.push({ w: w, t: 'Se retira del fútbol' }); }
    });
  };

  function row(r, label, club, kind, dn) {
    var k = label + '|' + club + '|' + kind, x = null;
    for (var i = 0; i < r.rows.length; i++) if (r.rows[i].k === k) { x = r.rows[i]; break; }
    if (!x) { x = { k: k, y: label, c: club, kd: kind, dn: dn, p: 0, g: 0, a: 0, mn: 0, w: FP.S.week }; r.rows.push(x); }
    return x;
  }
  function hit(r, t) { var w = FP.S.week; if (!r.hit.some(function (x) { return x.t === t; })) r.hit.push({ w: w, t: t }); }

  // cada partido de club: aparición estimada (alineación probable) y goles/asistencias reales del acumulado de la competición
  var prevHook = (FP.Hooks = FP.Hooks || {}).onFixture;
  FP.Hooks.onFixture = function (comp, f) {
    if (prevHook) prevHook(comp, f);
    try { F.onFixture(comp, f); } catch (e) { if (window.console) console.warn('ficha', e); }
  };
  F.onFixture = function (comp, f) {
    var h = hero(), fi = h && h.fi; if (!fi || !h.retired || comp.cat || !(comp.kind === 'L' || comp.kind === 'C' || comp.kind === 'X')) return;
    var S = FP.S, ks = Object.keys(fi.pl); if (!ks.length) return;
    ks.forEach(function (k) {
      var r = fi.pl[k], q = S.pl[+k]; if (r.end || !q || typeof q !== 'object' || q.c < 0 || (q.c !== f.h && q.c !== f.a)) return;
      var dn = comp.kind === 'L' ? FP.LGDEF[comp.lg].n : comp.nm, x = row(r, comp.label, q.c, comp.kind, dn);
      var lu = FP.Match.lineup(q.c, {}), start = lu.xi.some(function (e) { return e.p.i === q.i; });
      if (start) { x.p++; x.mn += 62 + Math.floor(R() * 29); } else if (lu.bench.some(function (p) { return p.i === q.i; }) && R() < 0.35) { x.p++; x.mn += 8 + Math.floor(R() * 24); }
      var e = comp.sc && comp.sc[q.i], sk = k + '|' + comp.id, sn = fi.seen[sk] || [0, 0];
      if (e) { var dg = (e[0] || 0) - sn[0], da = (e[1] || 0) - sn[1]; if (dg > 0) x.g += dg; if (da > 0) x.a += da; fi.seen[sk] = [e[0] || 0, e[1] || 0]; if (dg > 0 && !r.rows.some(function (z) { return z !== x && z.g > 0; }) && x.g === dg) hit(r, 'Primer gol en el fútbol profesional (' + C.tname(q.c) + ')'); }
      if (x.p === 1 && !r.rows.some(function (z) { return z !== x && z.p > 0; })) hit(r, 'Debut profesional con ' + C.tname(q.c) + ' a los ' + C.age(q) + ' años');
    });
  };
  // cierre de liga: nivel al final de la temporada, título y goleador
  var olc0 = Sim.onLeagueClosed;
  Sim.onLeagueClosed = function (comp, entry) {
    if (olc0) olc0(comp, entry);
    try { F.onClosed(comp, entry); } catch (e) { if (window.console) console.warn('ficha', e); }
  };
  F.onClosed = function (comp, entry) {
    var h = hero(), fi = h && h.fi; if (!fi || !h.retired) return;
    var S = FP.S, top = null; try { top = FP.Comp.topScorers(comp, 1, 0)[0]; } catch (e) { }
    Object.keys(fi.pl).forEach(function (k) {
      var r = fi.pl[k], q = S.pl[+k]; if (r.end || !q || typeof q !== 'object' || q.c < 0 || S.clubs[q.c].lg !== comp.lg) return;
      var x = row(r, comp.label, q.c, 'L', FP.LGDEF[comp.lg].n); x.o = q.o; x.age = C.age(q);
      if (entry.ch === q.c && x.p > 0) { r.tro.push({ y: comp.label, nm: 'Campeón de ' + FP.LGDEF[comp.lg].n, c: q.c }); hit(r, 'Campeón de ' + FP.LGDEF[comp.lg].n + ' con ' + C.tname(q.c) + ' (' + comp.label + ')'); }
      if (top && top.pid === q.i && top.g >= 5) r.aw.push({ y: comp.label, nm: 'Goleador de ' + FP.LGDEF[comp.lg].n + ' (' + top.g + ' goles)' });
    });
  };
  // cierre anual: nivel, premios mundiales y selección
  F.yearly = function () {
    var fi = F.ensure(), S = FP.S; if (!fi) return;
    F.sync();
    Object.keys(fi.pl).forEach(function (k) {
      var r = fi.pl[k], q = S.pl[+k]; if (r.end || !q || typeof q !== 'object') return;
      r.prog.push({ y: D.year(S.week), age: C.age(q), o: q.o, c: q.c });
      if (r.prog.length > 30) r.prog.shift();
      (S.hist.awards || []).forEach(function (a) { if (a.id === q.i && !r.aw.some(function (z) { return z.nm === 'Balón de Oro' && z.y === a.y; })) { r.aw.push({ y: a.y, nm: 'Balón de Oro' }); hit(r, 'Gana el Balón de Oro (' + a.y + ')'); } });
      if (q.ns) Object.keys(q.ns).forEach(function (cat) {
        var a = q.ns[cat]; if (!a || !a[0]) return;
        var label = FP.NT ? FP.NT.LABEL[cat] : cat; r.ntw[cat] = { p: a[0], g: a[2], a: a[3] };
        if (!r.hit.some(function (z) { return z.t === 'Convocado a la selección ' + label; }) && a[0] > 0) hit(r, 'Convocado a la selección ' + label);
      });
      if (r.pos !== q.p) r.pos = q.p;
    });
    // limpia los acumulados de competiciones que ya no existen
    Object.keys(fi.seen).forEach(function (sk) { var id = sk.split('|').slice(1).join('|'); if (!S.comps[id]) delete fi.seen[sk]; });
  };
  F.nt = function (r) { return Object.keys(r.ntw || {}).map(function (c) { return { cat: c, label: FP.NT ? FP.NT.LABEL[c] : c, p: r.ntw[c].p, g: r.ntw[c].g, a: r.ntw[c].a }; }); };

  // ---------- redacción ----------
  F.age = function (r) { return C.age({ b: r.b }, r.end || FP.S.week); };
  F.lead = function (r) {
    var S = FP.S, B = FP.Bio, dem = B && B.dem ? B.dem(r.nat) : null, pos = C.POS_NAME[r.pos] ? C.POS_NAME[r.pos].toLowerCase() : r.pos, q = S.pl[r.pid], cur = q && typeof q === 'object' && q.c >= 0 ? q.c : null;
    var born = B && B.dlong ? B.dlong(r.b) : String(D.year(r.b)), esc = U.esc, h = hero();
    var t = '<b>' + esc(r.n) + '</b> (' + born + ') ' + (r.end ? 'fue' : 'es') + ' un futbolista ' + (dem ? esc(dem) : 'de ' + esc(C.cname(r.nat))) + ' que juega como ' + esc(pos) + (cur != null && !r.end ? ' en <b>' + esc(C.tname(cur)) + '</b>' : '') + '.';
    if (r.kind === 'hijo') t += ' Es hijo del exjugador ' + esc(h.nm) + ', que lo guía desde sus inicios.';
    else if (r.kind === 'protegido') t += ' Es apadrinado por ' + esc(h.nm) + '.';
    else if (r.kind === 'representado') t += ' Está representado por ' + esc(h.nm) + '.';
    else if (r.kind === 'academia') t += ' Se formó en la academia de ' + esc(h.nm) + '.';
    var clubs = []; r.rows.forEach(function (x) { var n = C.tname(x.c); if (clubs.indexOf(n) < 0) clubs.push(n); });
    if (clubs.length) { var tg = r.rows.reduce(function (s, x) { return s + x.g; }, 0), tp = r.rows.reduce(function (s, x) { return s + x.p; }, 0); t += ' Ha jugado en ' + clubs.length + (clubs.length === 1 ? ' club' : ' clubes') + ' y suma ' + tg + (tg === 1 ? ' gol' : ' goles') + ' en ' + tp + ' partidos (estimados).'; }
    var nt = F.nt(r); if (nt.length) t += ' Ha sido internacional con ' + nt.map(function (x) { return 'la selección ' + x.label; }).join(' y ') + '.';
    return t;
  };
  // filas agrupadas por club para la tabla
  F.table = function (r) {
    var rows = r.rows.filter(function (x) { return x.kd === 'L'; }).sort(function (a, b) { return a.w - b.w; });
    var other = r.rows.filter(function (x) { return x.kd !== 'L'; });
    return { league: rows, other: other, nt: F.nt(r) };
  };

  F.tick = function (w) {
    var h = hero(); if (!h || !h.retired) return;
    var d = w - h.retiredW; if (d <= 0) return;
    if (d % 52 === 20) F.yearly(); else if (d % 13 === 0) F.sync();
  };
  var pw0 = P.weekly;
  P.weekly = function (w) { pw0.apply(this, arguments); try { F.tick(w); } catch (e) { if (window.console) console.warn('ficha', e); } };
})();
