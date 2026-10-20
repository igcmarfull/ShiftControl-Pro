/* FUTPRO — interfaz v3 (fase 2): inicio compacto, confianza del entrenador y momentos importantes.
   Solo presentación: no modifica el estado de la partida ni el motor. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, UI = FP.UI, esc = U.esc, A = UI.acts, SC = UI.screens, Comp = FP.Comp, I = UI.icon;

  // ---------- confianza del entrenador (derivada, sin guardar) ----------
  UI.trust = function () {
    var h = FP.S.hero, lab = FP.Hero.roleLabel();
    var base = { 'Estrella': 92, 'Titular indiscutido': 82, 'Titular': 70, 'Rotación': 52, 'Suplente': 36 }[lab];
    if (base == null) base = h.tk === 'academy' ? 62 : 68;
    var v = base + (h.form - 50) * 0.18 + (h.mor - 50) * 0.08 - (h.fat > 80 ? (h.fat - 80) * 0.3 : 0);
    v = Math.max(5, Math.min(99, Math.round(v)));
    return { v: v, label: v >= 85 ? 'Máxima' : v >= 70 ? 'Alta' : v >= 52 ? 'Media' : v >= 35 ? 'Baja' : 'Crítica', cls: v >= 70 ? '' : v >= 45 ? 'warn' : 'bad' };
  };
  UI.contractInfo = function () {
    var S = FP.S, h = S.hero, c = h.contract, ymd = D.ymd(S.week), yNow = ymd[0] + (ymd[1] >= 7 ? 0.5 : 0);
    if (h.tk === 'free') return { t: 'Sin contrato', sub: 'Agente libre', left: null };
    if (h.tk === 'amat' || !c) return { t: 'Club amateur', sub: 'Sin contrato', left: null };
    var left = c.endW != null ? Math.max(0, (c.endW - S.week) / 52) : Math.max(0, c.end - yNow);
    return { t: ({ prof: 'Profesional', juvenil: 'Juvenil', cesion: 'Cesión' }[c.type] || 'Contrato'), end: c.end, wage: c.wage, left: left, clause: c.clause };
  };
  function posOf(comp, id) { if (!comp || !comp.tb || comp.tb[id] == null || comp.groups) return null; var r = Comp.rows(comp).filter(function (x) { return x.id === id; })[0]; return r || null; }

  // ---------- INICIO COMPACTO ----------
  var oldHome = SC.home;
  SC.home = function () {
    var S = FP.S, h = S.hero, age = FP.Hero.age(), cols = UI.heroColors(), s = h.season, tr = UI.trust(), ci = UI.contractInfo(), cid = h.tk === 'academy' ? h.club : h.team;
    var lab = h.tk === 'free' ? '<span class="mut">Sin club</span>' : UI.crest(cid) + '<b>' + esc(C.tname(cid)) + '</b>';
    var html = '<div class="d-strip"><div class="pl-strip" style="--c1:' + cols[0] + '55"><div class="avatar">' + UI.avatar(h) + '</div><div style="min-width:0">' +
      '<h1 class="hc-name ell">' + esc(h.nm) + '</h1><div class="hc-meta"><span>' + age + ' años</span><i class="sep"></i><span>' + UI.flag(h.nat) + esc(C.cname(h.nat)) + '</span><i class="sep"></i><span style="display:inline-flex;align-items:center;gap:.3rem">' + lab + '</span></div>' +
      '<div class="hc-tags"><span class="pill g">' + C.POS_ES[h.pos] + ' · ' + esc(C.POS_NAME[h.pos]) + '</span><span class="pill">' + esc(FP.Hero.roleLabel()) + '</span>' + UI.heroStatusPills() + '</div>' +
      '<div class="mbars"><div class="mb">Forma<b>' + Math.round(h.form) + '</b>' + UI.bar(h.form, 100, '') + '</div><div class="mb">Moral<b>' + Math.round(h.mor) + '</b>' + UI.bar(h.mor, 100, '') + '</div><div class="mb">Fatiga<b>' + Math.round(h.fat) + '</b>' + UI.bar(h.fat, 100, h.fat > 70 ? 'bad' : h.fat > 45 ? 'warn' : '') + '</div></div></div>' +
      UI.ovrHex(h.ovr, 92) + '</div>' +
      '<div class="card contract-c" style="margin:0"><div class="cc-top">' + (cid != null && h.tk !== 'free' ? UI.crest(cid, 'lg') : I('contract')) + '<div><div class="mut sm">Situación contractual</div><b>' + ci.t + '</b></div></div>' +
      (ci.left == null ? '<div class="kv-i"><span>Estado</span><b>' + ci.sub + '</b></div>' :
        '<div class="kv-i"><span>Vence</span><b>' + ci.end + (ci.left < 1 ? ' <span class="pill y">último año</span>' : '') + '</b></div><div class="kv-i"><span>Restante</span><b>' + ci.left.toFixed(1) + ' años</b></div>' + (ci.wage ? '<div class="kv-i"><span>Sueldo</span><b>' + UI.money(ci.wage) + ' / año</b></div>' : '')) +
      '<div class="kv-i"><span>Valor</span><b>' + UI.money(FP.Market.heroValue()) + '</b></div>' +
      '<div class="mut sm" style="margin-top:.2rem">Confianza del míster</div><div class="trust">' + UI.bar(tr.v, 100, tr.cls) + '<b>' + tr.v + '</b><span class="pill ' + (tr.cls === 'bad' ? 'r' : tr.cls === 'warn' ? 'y' : 'g') + '">' + tr.label + '</span></div></div></div>';
    var kp = [['Partidos', s.ap, 'ball'], ['Goles', s.g, 'target'], ['Asist.', s.a, 'zap'], ['Nota', s.rn ? (s.rs / s.rn).toFixed(2) : '—', 'star'], ['Minutos', s.min, 'clock'], ['Potencial', FP.Hero.potRange().join('–'), 'up']];
    html += '<div class="kpi-row">' + kp.map(function (k) { return '<div class="kp"><span class="ki">' + I(k[2]) + '</span><div class="kt"><div class="kn">' + k[1] + '</div><div class="kl2">' + k[0] + '</div></div></div>'; }).join('') + '</div>';

    // próximo partido
    var nx = UI.nextFx(8).filter(function (x) { return !x.nat || (h.nt.dec && h.nt.dec.ok && h.nt.dec.until >= x.f.w); })[0], nm = '';
    if (nx) {
      var f = nx.f, comp = nx.c, mine = (f.h === h.team || (h.extraTeams || []).indexOf(f.h) >= 0) ? f.h : f.a, opp = mine === f.h ? f.a : f.h, rm = posOf(comp, mine), ro = posOf(comp, opp);
      var d = f.w - S.week;
      nm = '<div class="card nextm compact s5"><div class="hd"><h3>' + I('calendar') + 'Próximo partido</h3><span class="pill b">' + (d <= 0 ? 'Esta semana' : d === 1 ? 'En 1 semana' : 'En ' + d + ' semanas') + '</span></div><div class="mut sm">' + esc(comp.nm) + (f.ro ? ' · ' + esc(f.ro) : '') + ' · ' + D.fmt(f.w) + '</div>' +
        '<div class="nm-teams"><div class="nm-t">' + UI.crest(f.h, 'lg') + '<div>' + esc(C.tname(f.h)) + '</div><span class="sub">' + (f.h === mine ? (rm ? rm.pos + 'º · ' + rm.pts + ' pts' : 'Local') : (ro ? ro.pos + 'º · ' + ro.pts + ' pts' : 'Local')) + '</span></div><div class="nm-vs">VS</div>' +
        '<div class="nm-t">' + UI.crest(f.a, 'lg') + '<div>' + esc(C.tname(f.a)) + '</div><span class="sub">' + (f.a === mine ? (rm ? rm.pos + 'º · ' + rm.pts + ' pts' : 'Visitante') : (ro ? ro.pos + 'º · ' + ro.pts + ' pts' : 'Visitante')) + '</span></div></div>' +
        '<div class="nm-foot"><span class="mut sm">' + I('pin') + (mine === f.h ? ' Local' : ' Visitante') + '</span><button class="btn pri" data-act="adv" data-w="1">' + I('play', 'fill') + UI.ctaLabel()[0] + '</button></div></div>';
    } else nm = '<div class="card nextm compact s5"><div class="hd"><h3>' + I('calendar') + 'Próximo partido</h3></div><p class="mut">Sin partidos programados próximamente.</p><button class="btn" data-act="nav" data-s="training">' + I('train') + 'Entrenar</button></div>';
    // mini tabla
    var lgc = UI.myLeagueComp(), tbl = '';
    if (lgc) {
      var rows = Comp.rows(lgc), me = h.team, idx = 0; rows.forEach(function (r, i) { if (r.id === me) idx = i; });
      var from = Math.max(0, Math.min(rows.length - 6, idx - 2)), part = rows.slice(from, from + 6);
      tbl = '<div class="card s3"><div class="hd"><h3>' + I('table') + 'Tabla</h3><a class="more" data-act="nav" data-s="tables">Ver ' + I('chev') + '</a></div><table class="mini-t"><tbody>' + part.map(function (r) { return '<tr class="' + (r.id === me ? 'me' : '') + '"><td class="pos">' + r.pos + '</td><td class="ell">' + UI.crest(r.id) + esc(C.tname(r.id)) + '</td><td class="n"><b>' + r.pts + '</b></td></tr>'; }).join('') + '</tbody></table></div>';
    } else tbl = '<div class="card s3"><div class="hd"><h3>' + I('table') + 'Tabla</h3></div><p class="mut sm">Sin liga activa.</p></div>';
    // decisiones
    var dec = [];
    if (S.pending && S.pending.length) dec.push('<div class="hrow">' + I('ball') + '<div class="grow"><b>Partido pendiente</b></div><button class="btn sm pri" data-act="nav" data-s="match">Jugar</button></div>');
    h.offers.slice(0, 3).forEach(function (o) { dec.push('<div class="hrow">' + (o.club != null ? UI.crest(o.club) : I('contract')) + '<div class="grow"><b class="ell" style="display:block">' + ({ trial: 'Prueba', academy: 'Cantera', pro: 'Contrato profesional', transfer: 'Oferta de traspaso', loan: 'Cesión', renew: 'Renovación', event: 'Oportunidad', amateur: 'Club amateur' }[o.type] || 'Oferta') + '</b><span class="mut sm ell" style="display:block">' + esc(o.club != null ? C.tname(o.club) : String(o.text).replace(/<[^>]*>/g, '').slice(0, 60)) + '</span></div><button class="btn sm" data-act="nav" data-s="contracts">Ver</button></div>'); });
    var dc = '<div class="card s4"><div class="hd"><h3>' + I('contract') + 'Decisiones' + (h.offers.length ? ' <span class="pill y">' + h.offers.length + '</span>' : '') + '</h3><a class="more" data-act="nav" data-s="contracts">Todo ' + I('chev') + '</a></div>' + (dec.length ? dec.join('') : '<p class="mut sm">Nada pendiente.</p>') + '</div>';
    // resultados
    var lg = h.log.slice(0, 5);
    var rs = '<div class="card s4"><div class="hd"><h3>' + I('history') + 'Últimos partidos</h3><a class="more" data-act="nav" data-s="calendar">Más ' + I('chev') + '</a></div>' + (lg.length ? '<div class="res-strip c5">' + lg.map(function (m) { return '<div class="res-c ' + m.r + '">' + UI.crest(m.o) + '<div class="rs">' + esc(m.s.split(' ')[0]) + '</div><div class="ro">' + esc(C.tname(m.o)) + '</div></div>'; }).join('') + '</div><div class="mut sm" style="margin-top:.4rem">' + (lg[0].rt ? 'Último: nota ' + lg[0].rt.toFixed(1) : '') + '</div>' : '<p class="mut sm">Aún sin partidos.</p>') + '</div>';
    // noticias
    var mine = h.inbox.slice(0, 4), world = S.news.filter(function (n) { return n.i >= 2; }).slice(0, 2);
    function ni(m) { var ic = { ok: ['medal', 'ok'], warn: ['bell', 'warn'], inj: ['inj', 'bad'], offer: ['contract', ''], title: ['trophy', 'ok'], transfer: ['transfer', ''], hero: ['star', 'ok'] }[m.k] || ['news', '']; return '<div class="news-i"><span class="nic ' + ic[1] + '">' + I(ic[0]) + '</span><div><div class="nt">' + esc(m.t) + '</div><div class="nd">' + D.fmt(m.w) + '</div></div></div>'; }
    var nw = '<div class="card s4"><div class="hd"><h3>' + I('news') + 'Novedades</h3><a class="more" data-act="nav" data-s="news">Más ' + I('chev') + '</a></div>' + mine.concat(world).slice(0, 5).map(ni).join('') + '</div>';
    // entrenamiento + hitos
    var tr2 = '<div class="card s4"><div class="hd"><h3>' + I('train') + 'Entrenamiento</h3><a class="more" data-act="nav" data-s="training">Cambiar ' + I('chev') + '</a></div><div class="row sp"><b>' + esc(FP.Hero.FOCUS[h.train.focus].n) + '</b><span class="pill">' + ['', 'Suave', 'Normal', 'Intensa'][h.train.int] + '</span></div><div class="mut sm" style="margin:.3rem 0 .5rem">Potencial estimado: <b style="color:var(--tx)">' + FP.Hero.potRange().join('–') + '</b></div><div class="hd" style="margin-bottom:.2rem"><h3>' + I('medal') + 'Hitos</h3><a class="more" data-act="nav" data-s="social">Todos ' + I('chev') + '</a></div>' + UI.milestoneList(FP.Social.milestones(), 2) + '</div>';
    var guide = '';
    if (!h.flags.guideOff && S.week - h.startW < 16) guide = '<div class="card glass s12"><div class="hd"><h3>' + I('star') + 'Primeros pasos</h3><button class="btn sm" data-act="guideoff">Ocultar</button></div><span class="mut">1) Elige tu <a class="lk" data-act="nav" data-s="training">entrenamiento</a> · 2) Pulsa <b>' + UI.ctaLabel()[0] + '</b> arriba · 3) Pide pruebas en el <a class="lk" data-act="nav" data-s="market">mercado</a> · 4) Decide ofertas en <a class="lk" data-act="nav" data-s="contracts">Contratos</a>.</span></div>';
    return html + '<div class="dash3">' + guide + nm + tbl + dc + rs + nw + tr2 + '</div>';
  };

  // ---------- MOMENTOS IMPORTANTES ----------
  var queue = [], showing = false;
  function key(S) { return 'futpro.mom.' + (S.sid || (S.seed + '|' + S.hero.nm)); }
  function load(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function clubCountry(id) { var c = FP.S.clubs[id]; return c && FP.LGDEF[c.lg] ? FP.LGDEF[c.lg].c : null; }
  function nts(h) { var n = 0; if (h.nts) Object.keys(h.nts.c).forEach(function (k) { n += h.nts.c[k].n || 0; }); return n; }
  function snap(S) {
    var h = S.hero, nat = FP.Nat.heroNation();
    return { ap: h.tot.ap, tro: h.trophies.filter(function (t) { return !t.sub; }).length, aw: h.awards.length, ntU: nts(h), tk: h.tk, team: h.team, cty: h.team != null ? clubCountry(h.team) : null, serious: !!(h.inj && h.inj.n >= 10), nat: nat ? nat.id : null };
  }
  UI.checkMoments = function () {
    var S = FP.S; if (!S || !S.hero || S.hero.retired === undefined) return;
    var h = S.hero, k = key(S), prev = load(k), cur = snap(S);
    if (!prev) { save(k, cur); return; }   // primera vez que se ve esta partida: no se repite el pasado
    var out = [];
    if (prev.ap === 0 && cur.ap > 0 && (h.tk === 'pro' || h.tk === 'loan')) out.push({ id: 'debut', mk: 'Debut profesional', ic: 'ball', c: '#2fbf71', h: '¡Debutaste!', p: 'Disputaste tus primeros minutos como profesional con ' + UI.club(h.team) + '. El comienzo de una carrera.', club: h.team });
    if (cur.ntU > (prev.ntU || 0)) { var nat = FP.Nat.heroNation(), lab = h.nt.cat || ''; out.push({ id: 'nt' + cur.ntU, mk: 'Selección nacional', ic: 'flag', c: '#46aabd', h: 'Convocado a ' + (nat ? C.tname(nat.id) : 'la selección'), p: 'Categoría ' + lab + '. Representar a tu país es un orgullo.', flag: h.nat }); }
    if (cur.team != null && prev.team != null && cur.team !== prev.team && (cur.tk === 'pro' || cur.tk === 'loan')) {
      var intl = cur.cty && prev.cty && cur.cty !== prev.cty;
      out.push({ id: 'tr' + cur.team, mk: intl ? 'Fichaje internacional' : (cur.tk === 'loan' ? 'Cesión' : 'Nuevo club'), ic: 'transfer', c: '#e2a93b', h: UI.club(cur.team), p: intl ? 'Cruzas fronteras: nueva liga, nuevo desafío.' : 'Empieza una nueva etapa en tu carrera.', club: cur.team });
    }
    if (cur.serious && !prev.serious && h.inj) out.push({ id: 'inj', mk: 'Lesión grave', ic: 'inj', c: '#e5545a', h: esc(h.inj.nm), p: 'Estarás fuera aproximadamente ' + h.inj.n + ' semanas. Paciencia y recuperación.' });
    if (cur.tro > prev.tro) { var t = h.trophies.filter(function (x) { return !x.sub; }).slice(-1)[0]; out.push({ id: 'tro' + cur.tro, mk: 'Campeón', ic: 'trophy', c: '#d9b44a', h: t ? t.nm : '¡Título!', p: t ? (t.club + ' · ' + t.y) : '', club: null }); }
    if (cur.aw > prev.aw) { var a = h.awards.slice(-1)[0]; out.push({ id: 'aw' + cur.aw, mk: 'Premio individual', ic: 'medal', c: '#a98fe8', h: a ? a.nm : 'Premio', p: a ? String(a.y) : '' }); }
    save(k, cur);
    if (out.length) { queue = queue.concat(out).slice(0, 3); UI.showMoment(); }
  };
  UI.showMoment = function () {
    if (showing || !queue.length) return;
    var m = queue.shift(); showing = true;
    var icon = m.club != null ? UI.crest(m.club, 'lg') : m.flag ? UI.flag(m.flag, true) : I(m.ic);
    var el = document.createElement('div'); el.className = 'moment-ov'; el.id = 'moment';
    el.innerHTML = '<div class="moment" style="--mc:' + m.c + '" role="dialog" aria-modal="true"><div class="mk">' + esc(m.mk) + '</div><div class="mi2">' + icon + '</div><h2>' + m.h + '</h2><p>' + esc(m.p || '') + '</p><button class="btn pri" data-act="momentok">' + (queue.length ? 'Siguiente' : 'Continuar') + '</button>' + (queue.length ? '<div class="more-n">+' + queue.length + ' más</div>' : '') + '</div>';
    document.body.appendChild(el);
    var b = el.querySelector('button'); if (b) b.focus();
  };
  A.momentok = function () { var el = document.getElementById('moment'); if (el) el.remove(); showing = false; UI.showMoment(); };
  var render0 = UI.render;
  UI.render = function () { var r = render0.apply(this, arguments); try { UI.checkMoments(); } catch (e) { if (window.console) console.warn('momentos', e); } return r; };
})();
