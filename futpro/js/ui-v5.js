/* FUTPRO — pantalla de Contratos con términos detallados, negociación, rol prometido, renovaciones,
   historial contractual y libro económico. Solo presentación: la lógica está en js/contracts.js. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, UI = FP.UI, esc = U.esc, A = UI.acts, SC = UI.screens, I = UI.icon, K = FP.Contracts, M = FP.Market;
  var hdr = UI.hdr, seg = UI.seg;
  function money(v) { return UI.money(v); }
  function pill(t, c) { return '<span class="pill ' + (c || '') + '">' + t + '</span>'; }
  function cname(id) { return C.tname(id); }
  var STATE = { abierta: ['Propuesta abierta', 'b'], tramite: ['En trámite', 'y'], pensando: ['El club evalúa tu contrapropuesta', 'y'] };
  var TYPE = { semi: 'Contrato semiprofesional', trial_pro: 'Prueba con el primer equipo', trial: 'Invitación a prueba', academy: 'Ingreso a la cantera', pro: 'Contrato profesional', transfer: 'Oferta de traspaso', loan: 'Cesión', renew: 'Renovación', precontract: 'Precontrato', event: 'Oportunidad', amateur: 'Club amateur' };
  var BK = { goals: 'Goles', assists: 'Asistencias', apps: 'Partidos', titles: 'Títulos', intl: 'Clasif. internacional' };

  function termsGrid(t, o, noBonus) {
    var cells = [
      ['Sueldo mensual', t.wage ? money(K.monthly(t.wage)) : 'Sin sueldo'],
      ['Sueldo anual', t.wage ? money(t.wage) : '—'],
      ['Duración', K.durLabel(t.startW, t.endW)],
      ['Inicio', K.fmtDate(t.startW)],
      ['Término', t.endW != null ? K.fmtDate(t.endW) : String(t.endY)],
      ['Rol prometido', esc(t.role)]
    ];
    if (t.signBonus) cells.push(['Prima por fichaje', money(t.signBonus)]);
    if (t.renewBonus) cells.push(['Prima por renovación', money(t.renewBonus)]);
    if (o && o.fee) cells.push(['Traspaso', money(o.fee)]);
    if (t.release) cells.push(['Cláusula de rescisión', money(t.release)]);
    cells.push(['Cesión', t.loanable === false ? 'No permitida' : 'Permitida']);
    if (t.loan) { cells.push(['Cesión hasta', K.fmtDate(t.loan.endW)]); cells.push(['Opción de compra', t.loan.buy ? money(t.loan.buy) : 'Sin opción']); }
    var html = '<div class="terms" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">' + cells.map(function (c) { return '<div><span>' + c[0] + '</span><b>' + c[1] + '</b></div>'; }).join('') + '</div>';
    var bk = Object.keys(t.bonuses || {});
    if (bk.length && !noBonus) html += '<div class="mut sm" style="margin-top:.4rem">' + bk.map(function (k) { return esc(K.bonusLabel(k, t.bonuses[k])); }).join(' · ') + '</div>';
    return html;
  }

  // ---------- contrato actual ----------
  function currentCard() {
    var S = FP.S, h = S.hero, ct = h.contract, cx = K.ensure(), html = '';
    html += '<div class="card"><div class="hd"><h3>' + I('contract') + 'Contrato actual</h3>' + (cx.pre ? pill('Precontrato firmado', 'y') : '') + '</div>';
    if (!ct) return html + '<p class="mut">' + (h.tk === 'amat' ? 'Juegas en un club amateur: no hay contrato ni sueldo.' : h.tk === 'free' ? 'Estás sin contrato (agente libre). Revisa las propuestas.' : 'Sin contrato vigente.') + '</p></div>';
    var club = h.club != null ? S.clubs[h.club] : null, left = ct.endW != null ? Math.max(0, ct.endW - S.week) : null;
    var status = h.tk === 'loan' ? 'Cedido' : ct.status === 'cedido' ? 'Cedido' : left != null && left <= 26 ? 'Por vencer' : 'Activo';
    html += '<div class="cc-top" style="margin-bottom:.5rem">' + (h.team < 5000 ? UI.crest(h.team, 'lg') : '') + '<div><b style="font-size:1.05rem">' + esc(cname(h.team)) + '</b><div class="mut sm">' + esc(K.KIND[ct.kind] || ({ juvenil: 'Contrato juvenil', prof: 'Contrato profesional', semi: 'Contrato semiprofesional', cesion: 'Cesión' }[ct.type] || 'Contrato')) + ' · ' + pill(status, status === 'Activo' ? 'g' : status === 'Por vencer' ? 'y' : 'b') + '</div></div></div>';
    var t = { wage: ct.wage, startW: ct.startW, endW: ct.endW, endY: ct.end, role: ct.role || '—', signBonus: ct.signBonus, bonuses: ct.bonuses || {}, release: ct.release, loanable: ct.loanable };
    html += termsGrid(t, null, true);
    // progreso de bonos de la temporada
    var ss = h.season, sk = M.seasonLabel(), b = ct.bonuses || {};
    var rows = Object.keys(b).map(function (k) {
      var cur = k === 'goals' ? ss.g : k === 'assists' ? ss.a : k === 'apps' ? ss.ap : null, paid = cx.paid[ct.cid + '|' + sk + '|' + k];
      if (cur == null) return '<div class="hrow"><span class="grow">' + esc(K.bonusLabel(k, b[k])) + '</span>' + pill('al ocurrir', '') + '</div>';
      return '<div class="hrow"><span class="grow">' + esc(K.bonusLabel(k, b[k])) + '</span><div style="width:110px">' + UI.bar(Math.min(100, cur / b[k].n * 100), 100, paid ? '' : 'warn') + '</div><b>' + Math.min(cur, b[k].n) + '/' + b[k].n + '</b> ' + (paid ? pill('cobrado', 'g') : '') + '</div>';
    });
    if (rows.length) html += '<div class="hd" style="margin:.7rem 0 .2rem"><h3>' + I('target') + 'Bonos de la temporada ' + esc(sk) + '</h3></div>' + rows.join('');
    if (h.tk === 'loan' && h.loan) {
      var own = S.clubs[h.loan.from];
      html += '<div class="info" style="margin-top:.7rem">' + I('transfer') + ' Cedido por <b>' + esc(own.nm) + '</b> hasta el ' + K.fmtDate(h.loan.end) + '. Tu contrato con ' + esc(own.nm) + ' sigue vigente' + (h.loan.ct && h.loan.ct.endW ? ' hasta el ' + K.fmtDate(h.loan.ct.endW) : '') + '.' + (h.loan.buy ? ' Opción de compra: ' + money(h.loan.buy) + '.' : '') + '</div>';
    }
    if (cx.pre) {
      var pc = S.clubs[cx.pre.club];
      html += '<div class="info" style="margin-top:.7rem">' + I('contract') + ' Precontrato con <b>' + esc(pc.nm) + '</b>: te incorporas el ' + K.fmtDate(cx.pre.startW) + ' (' + money(K.monthly(cx.pre.terms.wage)) + ' al mes, ' + esc(cx.pre.terms.role.toLowerCase()) + '). Hasta entonces sigues en tu club.</div>';
    }
    html += '<div class="kv-i" style="margin-top:.6rem"><span>Dinero acumulado</span><b>' + money(h.money) + '</b></div>';
    return html + '</div>';
  }

  // ---------- rol prometido ----------
  function roleCard() {
    var S = FP.S, h = S.hero, st = K.roleStatus(), cx = K.ensure();
    if (!st) return '';
    var pct = st.actual == null ? null : Math.round(st.actual * 100), ex = Math.round(st.expected * 100), lvl = cx.role ? cx.role.lvl : 0;
    var html = '<div class="card"><div class="hd"><h3>' + I('user') + 'Rol prometido y minutos reales</h3>' + (lvl >= 3 ? pill('Conflicto contractual', 'r') : lvl >= 1 ? pill('Promesa incumplida', 'y') : pill('Sin conflicto', 'g')) + '</div>';
    html += '<p class="mut sm" style="margin:.1rem 0 .5rem">Te prometieron <b style="color:var(--tx)">' + esc(st.role.toLowerCase()) + '</b> (≈ ' + ex + '% de los minutos). ' + (pct == null ? 'Aún no hay partidos suficientes para evaluar.' : 'En tus últimos ' + st.n + ' partidos de club jugaste el ' + pct + '%.') + '</p>';
    if (pct != null) html += '<div class="mbars" style="grid-template-columns:1fr 1fr"><div class="mb">Esperado<b>' + ex + '%</b>' + UI.bar(ex, 100, '') + '</div><div class="mb">Real<b>' + pct + '%</b>' + UI.bar(pct, 100, pct + 15 < ex ? 'bad' : pct < ex ? 'warn' : '') + '</div></div>';
    if (lvl >= 1) html += '<div class="chips" style="margin-top:.6rem"><button class="chip" data-act="roleact" data-k="coach">Hablar con el entrenador</button><button class="chip" data-act="roleact" data-k="board">Reclamar a la directiva</button><button class="chip" data-act="roleact" data-k="role">Renegociar mi rol</button>' + (h.tk === 'pro' && FP.Hero.age() <= 25 ? '<button class="chip" data-act="reqloan">Pedir cesión</button>' : '') + '<button class="chip" data-act="reqtrans">Pedir traspaso</button></div>';
    else html += '<div class="mut sm" style="margin-top:.4rem">Si tu rol no se cumple de forma sostenida, podrás hablar con el entrenador, reclamar a la directiva, pedir cesión o traspaso, o renegociar el rol.</div>';
    return html + '</div>';
  }

  // ---------- renovación ----------
  function renewCard() {
    var S = FP.S, h = S.hero, ct = h.contract, cx = K.ensure();
    if (!ct || h.tk !== 'pro') return '';
    var left = ct.endW != null ? ct.endW - S.week : null, imp = K.importance();
    var html = '<div class="card"><div class="hd"><h3>' + I('history') + 'Renovación y mejoras</h3>' + (cx.noRenew ? pill('No renovarás', 'r') : '') + '</div>';
    html += '<p class="mut sm" style="margin:.1rem 0 .5rem">Quedan ' + (left != null ? K.durLabel(S.week, ct.endW) : '—') + ' de contrato. Importancia para el club: <b style="color:var(--tx)">' + (imp >= 0.8 ? 'clave' : imp >= 0.55 ? 'alta' : imp >= 0.35 ? 'media' : 'baja') + '</b>. Lo que no modifiques se conserva (cláusulas, bonos, rol).</p>';
    html += '<div class="chips"><button class="chip" data-act="creq" data-k="raise">Pedir aumento salarial</button><button class="chip" data-act="creq" data-k="early">Renovación anticipada</button><button class="chip" data-act="creq" data-k="role">Mejora de rol</button><button class="chip" data-act="creq" data-k="bonus">Negociar bonos</button><button class="chip" data-act="creq" data-k="clause">Pedir cláusula de salida</button>' + (cx.noRenew ? '<button class="chip" data-act="creq" data-k="open">Volver a negociar</button>' : '<button class="chip" data-act="creq" data-k="refuse">Negarme a renovar</button>') + '</div>';
    return html + '</div>';
  }

  // ---------- propuestas ----------
  function offerCard(o) {
    var S = FP.S, h = S.hero, cx = K.ensure(), left = o.exp != null ? Math.max(0, o.exp - S.week) : null, st = STATE[o.state || 'abierta'] || STATE.abierta;
    var club = o.club != null ? S.clubs[o.club] : null, t = o.t, blocked = cx.pend && cx.pend.oid !== o.id && (K.TYPES[o.type] && o.type !== 'renew');
    var ctr = o.state === 'pensando' ? '' : '';
    var head = (TYPE[o.type] || o.type) + (club ? ' · ' + esc(club.nm) : o.name ? ' · ' + esc(o.name) : '');
    var meta = [];
    if (left != null && o.state !== 'tramite') meta.push(pill(left + ' sem. restantes', 'y'));
    meta.push(pill(st[0] + (o.state === 'tramite' && o.doneW != null ? ' · se completa el ' + K.fmtDate(o.doneW) : ''), st[1]));
    if (club) meta.push('<span class="mut sm">' + esc(C.cname(club.c)) + ' · ' + esc(FP.LGDEF[club.lg].n) + '</span>');
    var body = '';
    if (t && K.TYPES[o.type]) body = termsGrid(t, o);
    var acts;
    if (o.state === 'tramite') acts = '<span class="mut sm">Operación en trámite</span>';
    else if (o.state === 'pensando') acts = '<span class="mut sm">Esperando respuesta del club</span><button class="btn" data-act="offer" data-id="' + o.id + '" data-ok="0">' + I('x') + 'Retirar</button>';
    else acts = '<button class="btn pri" data-act="offer" data-id="' + o.id + '" data-ok="1"' + (blocked ? ' disabled title="Hay una operación pendiente"' : '') + '>' + I('check') + (o.type === 'trial' || o.type === 'trial_pro' || o.type === 'event' ? 'Aceptar' : 'Aceptar condiciones') + '</button>' +
      (t && K.TYPES[o.type] && (o.neg || 0) < 3 ? '<button class="btn" data-act="negoform" data-id="' + o.id + '">' + I('chat') + 'Negociar</button>' : '') +
      '<button class="btn" data-act="offer" data-id="' + o.id + '" data-ok="0">' + I('x') + 'Rechazar</button>';
    var txt = o.t && K.TYPES[o.type] ? '' : '<p class="mut sm" style="margin:.35rem 0 0">' + esc(String(o.text || '').replace(/<[^>]*>/g, '')) + '</p>';
    var quick = '';
    if (t && K.TYPES[o.type] && o.state !== 'tramite' && o.state !== 'pensando' && (o.neg || 0) < 3) quick = '<div class="chips" style="margin-top:.45rem"><span class="mut sm" style="align-self:center">Rápido:</span><button class="chip" data-act="negot" data-id="' + o.id + '" data-w="0.1">+10% sueldo</button><button class="chip" data-act="negot" data-id="' + o.id + '" data-w="0.2">+20% sueldo</button><button class="chip" data-act="negot" data-id="' + o.id + '" data-y="1">+1 año</button><button class="chip" data-act="negot" data-id="' + o.id + '" data-y="-1">−1 año</button></div>';
    if ((o.neg || 0) >= 3) quick = '<div class="mut sm" style="margin-top:.4rem">Última propuesta del club: acepta o rechaza.</div>';
    return '<div class="prop" style="grid-template-columns:auto minmax(0,1fr)"><div>' + (club ? UI.crest(club.id, 'lg') : '<span class="nic">' + I('contract') + '</span>') + '</div><div style="min-width:0"><h3>' + head + '</h3><div class="pm">' + meta.join(' ') + '</div>' + txt + body + (UI.offerIntel ? UI.offerIntel(o) : '') + quick + '<div class="btn-group" style="margin-top:.6rem;flex-wrap:wrap">' + acts + '</div></div></div>';
  }
  function proposalsCard() {
    var h = FP.S.hero, cx = K.ensure();
    var html = '<div class="card"><div class="hd"><h3>' + I('bell') + 'Ofertas y propuestas' + (h.offers.length ? ' <span class="pill y">' + h.offers.length + '</span>' : '') + '</h3></div>';
    if (cx.pend) html += '<div class="info">' + I('clock') + ' Operación pendiente con <b>' + esc(cx.pend.name) + '</b> (se completa el ' + K.fmtDate(cx.pend.doneW) + '). No puedes aceptar otra propuesta incompatible hasta que se resuelva; si fracasa, las demás siguen disponibles.</div>';
    if (!h.offers.length) html += '<p class="mut">No hay ofertas pendientes. Los clubes te siguen según tu reputación y rendimiento; las ventanas de mercado traen más movimiento.</p>';
    html += h.offers.map(offerCard).join('');
    return html + '</div>';
  }
  function agentCard() {
    var h = FP.S.hero, html = '<div class="card"><div class="hd"><h3>' + I('user') + 'Representante</h3></div>';
    if (h.agent) html += '<div class="terms" style="grid-template-columns:repeat(3,1fr)"><div><span>Nombre</span><b>' + esc(h.agent.nm) + '</b></div><div><span>Nivel</span><b class="rep">' + UI.stars(h.agent.lvl * 20) + '</b></div><div><span>Comisión</span><b>' + h.agent.com + '% de sueldo y bonos</b></div></div><p class="mut sm" style="margin:.6rem 0">Más nivel: más ofertas y mejores condiciones.</p><button class="btn sm" data-act="dropagent">Despedir</button>';
    else if (FP.Hero.age() < 15) html += '<p class="mut">Podrás contratar un representante desde los 15 años.</p>';
    else html += '<p class="mut sm">Un representante consigue más y mejores ofertas, a cambio de una comisión.</p>' + M.agentCandidates().map(function (a, i) { return '<div class="hrow"><div class="grow"><b>' + esc(a.nm) + '</b> <span class="tag-gen">generado</span><br><span class="rep">' + UI.stars(a.lvl * 20) + '</span> <span class="mut sm">comisión ' + a.com + '%</span></div><button class="btn sm pri" data-act="hire" data-i="' + i + '">Contratar</button></div>'; }).join('');
    return html + '</div>';
  }

  // ---------- historial ----------
  var HK = { ofrecida: ['Oferta recibida', ''], aceptada: ['Oferta aceptada', 'g'], rechazada: ['Oferta rechazada', 'r'], retirada: ['Oferta retirada', 'y'], caducada: ['Oferta caducada', ''], cerrada: ['Oferta cerrada', ''], acordada: ['Condiciones acordadas', 'b'], fracasada: ['Operación fracasada', 'r'], negociacion: ['Negociación', 'b'], precontrato: ['Precontrato', 'y'], alta: ['Incorporación', 'g'], baja: ['Salida', 'r'], renovacion: ['Renovación', 'g'], cesion_ini: ['Cesión', 'b'], cesion_fin: ['Fin de cesión', ''], traspaso: ['Traspaso', 'b'], bono: ['Bono cobrado', 'g'], conflicto: ['Conflicto / rol', 'y'] };
  var GROUPS = { all: null, contratos: ['alta', 'baja', 'renovacion', 'cesion_ini', 'cesion_fin', 'traspaso', 'precontrato'], ofertas: ['ofrecida', 'aceptada', 'rechazada', 'retirada', 'caducada', 'cerrada', 'acordada', 'fracasada', 'negociacion'], bonos: ['bono'], conflictos: ['conflicto'] };
  function histLine(e) {
    var who = e.club != null && e.club >= 0 ? cname(e.club) : e.name || '';
    var d = [];
    if (e.type) d.push(esc(TYPE[e.type] || e.type));
    if (who) d.push(esc(who));
    if (e.kind && e.k === 'alta') d.push(esc(K.KIND[e.kind] || e.kind));
    if (e.wage != null && e.k !== 'baja') d.push(money(K.monthly(e.wage)) + '/mes');
    if (e.k === 'baja' && e.wage) d.push('sueldo ' + money(K.monthly(e.wage)) + '/mes');
    if (e.years) d.push(e.years + (e.years === 1 ? ' año' : ' años'));
    if (e.role) d.push(esc(e.role));
    if (e.fee) d.push('traspaso ' + money(e.fee));
    if (e.amt) d.push(money(e.amt));
    if (e.until) d.push('hasta ' + K.fmtDate(e.until));
    if (e.how) d.push(esc(e.how));
    return d.join(' · ') + (e.why ? ' — <span class="mut">' + esc(e.why) + '</span>' : '');
  }
  function histTab() {
    var S = FP.S, h = S.hero, cx = K.ensure(), f = UI.filt.chist || 'all', grp = GROUPS[f];
    var html = '<div class="chips" style="margin-bottom:.6rem">' + [['all', 'Todo'], ['contratos', 'Contratos'], ['ofertas', 'Ofertas'], ['bonos', 'Bonos'], ['conflictos', 'Conflictos']].map(function (x) { return '<button class="chip ' + (f === x[0] ? 'on' : '') + '" data-act="chfilt" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
    var reg = cx.reg.slice().reverse();
    html += '<div class="card"><div class="hd"><h3>' + I('contract') + 'Contratos y clubes</h3><span class="mut sm">' + reg.length + ' registros</span></div>' + (reg.length ? UI.table('creg', [
      { k: 'club', t: 'Club', f: function (r) { return r.club != null && r.club < 5000 ? UI.clubC(r.club) : esc(cname(r.club)); }, v: function (r) { return cname(r.club); } },
      { k: 'kind', t: 'Tipo', f: function (r) { return esc(K.KIND[r.kind] || r.kind); } },
      { k: 'startW', t: 'Inicio', f: function (r) { return K.fmtDate(r.startW); } },
      { k: 'endW', t: 'Término', f: function (r) { return r.exitW ? K.fmtDate(r.exitW) : (r.endW ? K.fmtDate(r.endW) : '—'); } },
      { k: 'wage', t: 'Sueldo/mes', n: 1, f: function (r) { return money(K.monthly(r.wage)); } },
      { k: 'role', t: 'Rol', f: function (r) { return esc(r.role || '—'); } },
      { k: 'paid', t: 'Primas y bonos', n: 1, f: function (r) { return r.paid ? money(r.paid) : '—'; } },
      { k: 'status', t: 'Estado', f: function (r) { return pill(esc(r.status), r.status === 'activo' ? 'g' : ''); } },
      { k: 'exitWhy', t: 'Motivo de salida', f: function (r) { return esc(r.exitWhy || '—'); } }
    ], reg.map(function (r) { return r; }), { sort: ['startW', 'd'], max: 60 }) : '<p class="mut">Todavía no tienes contratos registrados.</p>') + '</div>';
    var list = cx.hist.slice().reverse().filter(function (e) { return !grp || grp.indexOf(e.k) >= 0; }).slice(0, 120);
    html += '<div class="card"><div class="hd"><h3>' + I('history') + 'Línea de tiempo</h3></div>' + (list.length ? list.map(function (e) { var k = HK[e.k] || [e.k, '']; return '<div class="hrow"><span class="mut" style="min-width:5.8rem">' + D.fmt(e.w) + '</span>' + pill(k[0], k[1]) + '<span class="grow">' + histLine(e) + '</span></div>'; }).join('') : '<p class="mut">Sin movimientos.</p>') + '</div>';
    return html;
  }

  // ---------- finanzas ----------
  function finTab() {
    var h = FP.S.hero, cx = K.ensure(), ct = h.contract, tot = cx.tot;
    var LBL = { sueldo: 'Sueldos', prima: 'Primas', bono: 'Bonos', post: 'Después del fútbol', patrocinio: 'Patrocinios' };
    var all = Object.keys(tot).reduce(function (s, k) { return s + tot[k]; }, 0);
    var html = '<div class="grid g3"><div class="card"><div class="hd"><h3>' + I('chart') + 'Dinero acumulado</h3></div><div class="kn" style="font-size:1.8rem;font-family:var(--disp)">' + money(h.money) + '</div><div class="mut sm">Ingresos registrados: ' + money(all) + '</div></div>';
    html += '<div class="card"><div class="hd"><h3>' + I('target') + 'Por concepto</h3></div>' + (Object.keys(tot).length ? Object.keys(tot).map(function (k) { return '<div class="kv-i"><span>' + (LBL[k] || k) + '</span><b>' + money(tot[k]) + '</b></div>'; }).join('') : '<p class="mut">Sin ingresos todavía.</p>') + '</div>';
    html += '<div class="card"><div class="hd"><h3>' + I('calendar') + 'Ingreso mensual</h3></div><div class="kn" style="font-size:1.8rem;font-family:var(--disp)">' + (ct && ct.wage ? money(K.net(K.monthly(ct.wage), 'sueldo')) : '—') + '</div><div class="mut sm">' + (h.agent ? 'Neto de ' + h.agent.com + '% de comisión del representante' : 'Sin representante') + '</div></div></div>';
    var rows = cx.fin.slice().reverse().slice(0, 60);
    html += '<div class="card"><div class="hd"><h3>' + I('history') + 'Movimientos</h3></div>' + (rows.length ? rows.map(function (r) { return '<div class="hrow"><span class="mut" style="min-width:5.8rem">' + (r.k === 'sueldo' ? esc(r.lab) : D.fmt(r.w)) + '</span>' + pill(LBL[r.k] || r.k, r.k === 'sueldo' ? '' : 'g') + '<span class="grow ell">' + esc(r.why) + (r.club != null && r.club >= 0 ? ' · ' + esc(cname(r.club)) : '') + '</span><b>' + money(r.amt) + '</b></div>'; }).join('') : '<p class="mut">Sin movimientos.</p>') + '</div>';
    return html;
  }

  SC.contracts = function () {
    var h = FP.S.hero, tab = UI.tab.contracts || 'now'; K.ensure();
    var html = hdr('contract', 'Contratos', 'Contrato, propuestas, negociación e historial', seg('contracts', [['now', 'Contrato y propuestas', 'contract'], ['hist', 'Historial', 'history'], ['fin', 'Finanzas', 'chart']], tab));
    if (tab === 'hist') return html + histTab();
    if (tab === 'fin') return html + finTab();
    return html + '<div class="grid g2">' + currentCard() + '<div>' + roleCard() + renewCard() + '</div></div>' + proposalsCard() + agentCard();
  };

  // ---------- acciones ----------
  A.chfilt = function (d) { UI.filt.chist = d.v; UI.render(); };
  A.roleact = function (d) { var r = K.roleAction(d.k); UI.toast(esc(r.msg), r.ok ? 'ok' : 'warn'); UI.render(); };
  A.creq = function (d) {
    if (d.k === 'open') { K.ensure().noRenew = false; UI.toast('Volverás a negociar tu renovación.', 'ok'); UI.render(); return; }
    var r = K.request(d.k); UI.toast(esc(r.msg), r.ok ? 'ok' : 'warn'); UI.render();
  };
  A.negot = function (d) { var r = M.negotiate(+d.id, { wage: +(d.w || 0), years: +(d.y || 0) }); UI.toast(esc(r.msg), r.ok ? 'ok' : 'warn'); UI.render(); };
  A.offer = (function (old) {
    return function (d) { var r = M.respond(+d.id, d.ok === '1'); UI.toast(esc(r.msg || ''), r.ok ? 'ok' : 'warn'); try { FP.Store.auto(true); } catch (e) { } UI.render(); };
  })(A.offer);

  // formulario de contrapropuesta (amplía el sistema de negociación existente)
  A.negoform = function (d) {
    var o = K.find(+d.id); if (!o || !o.t) return;
    var t = o.t, L = o.t.lim, age = FP.Hero.age(), maxY = age < 18 ? 3 : 5;
    var row = function (lab, inner) { return '<label class="f"><span>' + lab + '</span>' + inner + '</label>'; };
    var bon = ['goals', 'assists', 'apps', 'titles', 'intl'].map(function (k) {
      var b = t.bonuses[k], def = b || { n: k === 'goals' ? 10 : k === 'assists' ? 6 : k === 'apps' ? 25 : 1, amt: Math.max(1, Math.round(t.wage * 0.06)) };
      return '<div class="hrow"><label style="display:flex;gap:.4rem;align-items:center;min-width:12rem"><input type="checkbox" id="ng_b_' + k + '" ' + (b ? 'checked' : '') + '> ' + BK[k] + '</label>' + (k === 'titles' || k === 'intl' ? '' : '<input type="number" id="ng_n_' + k + '" value="' + def.n + '" min="1" style="width:5rem"> <span class="mut sm">objetivo</span>') + '<input type="number" id="ng_a_' + k + '" value="' + def.amt + '" min="1" style="width:6rem"> <span class="mut sm">mil € de bono</span></div>';
    }).join('');
    var roles = K.ROLES.map(function (r, i) { return '<option value="' + esc(r) + '" ' + (r === t.role ? 'selected' : '') + '>' + esc(r) + '</option>'; }).join('');
    var years = [1, 2, 3, 4, 5].filter(function (y) { return y <= maxY; }).map(function (y) { return '<option value="' + y + '" ' + (y === t.years ? 'selected' : '') + '>' + y + (y === 1 ? ' año' : ' años') + '</option>'; }).join('');
    var html = '<h3>Contrapropuesta a ' + esc(o.club != null ? cname(o.club) : o.name || 'el club') + '</h3><p class="mut sm">Pide lo que quieras cambiar. El club puede aceptar, responder con una contrapropuesta, pedir tiempo o retirarse si exiges demasiado (' + (3 - (o.neg || 0)) + ' ronda(s) disponibles).</p>' +
      '<div class="grid g2">' + row('Sueldo mensual (mil €)', '<input type="number" id="ng_wage" value="' + K.monthly(t.wage) + '" min="0" step="0.1">') + row('Duración', '<select id="ng_years">' + years + '</select>') +
      row('Prima por fichaje (mil €)', '<input type="number" id="ng_sign" value="' + (t.signBonus || 0) + '" min="0">') + row('Rol deportivo', '<select id="ng_role">' + roles + '</select>') +
      row('Cláusula de rescisión (mil €, 0 = sin cláusula)', '<input type="number" id="ng_rel" value="' + (t.release || 0) + '" min="0">') + row('Permitir cesiones', '<select id="ng_loan"><option value="1" ' + (t.loanable !== false ? 'selected' : '') + '>Sí</option><option value="0" ' + (t.loanable === false ? 'selected' : '') + '>No</option></select>') + '</div>' +
      '<h4 style="margin:.8rem 0 .3rem">Bonificaciones</h4>' + bon +
      '<div class="row" style="margin-top:.8rem"><button class="btn pri" data-act="negosend" data-id="' + o.id + '">Enviar contrapropuesta</button><button class="btn" data-act="mclose">Cancelar</button></div>';
    UI.modal(html);
  };
  A.negosend = function (d) {
    var o = K.find(+d.id); if (!o || !o.t) { UI.closeModal(); return; }
    var t = o.t, g = function (id) { var e = document.getElementById(id); return e ? e.value : null; }, c = {};
    var wage = Math.round(parseFloat(g('ng_wage')) * 12 * 10) / 10, yrs = +g('ng_years'), sign = +g('ng_sign'), role = g('ng_role'), rel = +g('ng_rel'), loan = g('ng_loan') === '1';
    if (Math.abs(wage - t.wage) >= 0.5) c.wage = wage;
    if (yrs !== t.years) c.years = yrs;
    if (sign !== (t.signBonus || 0)) c.signBonus = sign;
    if (role !== t.role) c.role = role;
    if (rel !== (t.release || 0)) c.release = rel;
    if (loan !== (t.loanable !== false)) c.loanable = loan;
    var bon = {};
    ['goals', 'assists', 'apps', 'titles', 'intl'].forEach(function (k) {
      var on = document.getElementById('ng_b_' + k).checked, cur = t.bonuses[k], nEl = document.getElementById('ng_n_' + k), n = nEl ? +nEl.value : 1, amt = +g('ng_a_' + k);
      if (!on && cur) bon[k] = null; else if (on && (!cur || cur.amt !== amt || cur.n !== n)) bon[k] = { n: n, amt: amt };
    });
    if (Object.keys(bon).length) c.bonuses = bon;
    var r = FP.Contracts.negotiate(o.id, c);
    UI.closeModal(); UI.toast(esc(r.msg), r.ok ? (r.result === 'accept' ? 'ok' : 'warn') : 'warn'); UI.render();
  };
})();
