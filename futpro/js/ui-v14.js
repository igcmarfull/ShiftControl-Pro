/* FUTPRO — redes y marca (presentación): pestañas Marca, Comunidad y Panel, y el panel de publicación ampliado. js/redes.js */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, UI = FP.UI, esc = U.esc, SC = UI.screens, A = UI.acts, I = UI.icon, X = FP.Redes, Dec = FP.Dec;
  function pill(t, c) { return '<span class="pill ' + (c || '') + '">' + t + '</span>'; }
  function num(n) { return FP.fmt.num(Math.round(n)); }

  UI.postCard = function () {
    var left = X.postsLeft();
    return '<div class="card"><div class="hd"><h3>Publicar</h3>' + pill(left + '/3 esta semana', left ? 'g' : 'r') + '</div><p class="mut sm">Hasta tres publicaciones por semana; cada una cansa un poco. Las buenas pueden hacerse virales.</p>' +
      FP.Social.actions.map(function (a) {
        var why = X.canAct(a);
        return '<button class="btn" style="width:100%;margin-bottom:.4rem;text-align:left"' + (why || !left ? ' disabled' : '') + ' data-act="soc-act" data-id="' + a.id + '"><span style="display:block;text-align:left;white-space:normal"><b>' + esc(a.t) + '</b><span class="mut sm" style="display:block;font-weight:400">' + esc(why || a.d) + '</span></span></button>';
      }).join('') + '</div>';
  };

  function spark(pts) {
    if (pts.length < 2) return '<p class="mut sm">Aún no hay historial suficiente.</p>';
    var W = 520, H = 120, xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; }), x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y1 = Math.max.apply(null, ys) || 1;
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + (8 + (p[0] - x0) / Math.max(1, x1 - x0) * (W - 16)).toFixed(1) + ' ' + (H - 10 - p[1] / y1 * (H - 24)).toFixed(1); }).join('');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto"><path d="' + d + 'L' + (W - 8) + ' ' + (H - 10) + 'L8 ' + (H - 10) + 'z" fill="rgba(40,181,154,.15)"/><path d="' + d + '" fill="none" stroke="#28b59a" stroke-width="2.4" stroke-linejoin="round"/></svg>' +
      '<div class="row sp mut sm"><span>' + esc(FP.Date.fmt(x0)) + '</span><span>máx. ' + num(y1) + ' seguidores</span><span>' + esc(FP.Date.fmt(x1)) + '</span></div>';
  }

  function brandTab(h, r) {
    var sp = r.sp, f = FP.Redes && FP.Social.followers(), html = '';
    html += '<div class="grid g3"><div class="card"><h3>Reputación de marca</h3><div class="kn" style="font-size:1.8rem;font-family:var(--disp)">' + Math.round(r.brand) + '</div>' + UI.bar(r.brand, 100, r.brand >= 60 ? 'g' : r.brand >= 35 ? 'y' : 'r') + '<p class="mut sm">Sube con acciones solidarias y buena conducta; baja con polémicas. Define cuánto te ofrecen.</p></div>' +
      '<div class="card"><h3>Valor estimado</h3><div class="kn" style="font-size:1.8rem;font-family:var(--disp)">' + UI.money(X.sponsorValue()) + '</div><div class="mut sm">por mes y marca, hoy</div><p class="mut sm">' + num(f) + ' seguidores</p></div>' +
      '<div class="card"><h3>Ingresos de marca</h3><div class="kn" style="font-size:1.8rem;font-family:var(--disp)">' + UI.money(sp.earn) + '</div><div class="mut sm">' + sp.n + ' contratos firmados</div></div></div>';
    if (f < 1500 && !sp.deals.length && !sp.offers.length) html += '<div class="notice">Las marcas se fijan en ti desde unos 1.500 seguidores y los 15 años. Juega bien, publica y crece.</div>';
    html += '<div class="card"><div class="hd"><h3>Patrocinios activos</h3>' + pill(sp.deals.length + '/3', '') + '</div>' + (sp.deals.length ? sp.deals.map(function (d) {
      var left = Math.max(0, d.end - FP.S.week);
      return '<div class="card" style="margin:.5rem 0"><div class="row sp"><b>' + esc(d.brand) + '</b>' + pill(esc(X.CAT[d.cat]), '') + '</div><div class="sm">' + d.mo + ' mil € al mes · quedan ' + Math.round(left / 4.35) + ' meses · cobrado ' + UI.money(d.earn) + '</div>' +
        '<div class="mut sm">Cláusulas: ' + ([d.cl.posts ? 'publicar al menos una vez cada 6 semanas' + (d.strikes ? ' (avisos ' + d.strikes + '/3)' : '') : '', d.cl.clean ? 'conducta: una polémica puede costarte el contrato' : ''].filter(Boolean).join(' · ') || 'sin cláusulas especiales') + '</div>' +
        '<p style="margin-top:.5rem"><button class="btn sm dng" data-act="rd-cancel" data-id="' + d.id + '">Romper contrato</button></p></div>';
    }).join('') : '<p class="mut sm">Sin patrocinadores por ahora.</p>') + '</div>';
    html += '<div class="card"><div class="hd"><h3>Ofertas de marcas</h3>' + pill(sp.offers.length, sp.offers.length ? 'y' : '') + '</div>' + (sp.offers.length ? sp.offers.map(function (o) {
      return '<div class="card" style="margin:.5rem 0"><div class="row sp"><b>' + esc(o.brand) + '</b>' + pill(esc(X.CAT[o.cat]), '') + '</div><div class="sm">' + o.mo + ' mil € al mes durante ' + Math.round(o.wk / 4.35) + ' meses · prima de firma ' + o.sign + ' mil €</div>' +
        '<div class="mut sm">Cláusulas: ' + ([o.cl.posts ? 'publicar contenido' : '', o.cl.clean ? 'conducta' : ''].filter(Boolean).join(' · ') || 'ninguna') + ' · responde antes de ' + esc(FP.Date.fmt(o.exp)) + '</div>' +
        '<p style="margin-top:.5rem"><button class="btn pri sm" data-act="rd-acc" data-id="' + o.id + '">Aceptar</button> <button class="btn sm" data-act="rd-rej" data-id="' + o.id + '">Rechazar</button></p></div>';
    }).join('') : '<p class="mut sm">No hay ofertas abiertas.</p>') + '</div>';
    if (sp.hist.length) html += '<div class="card"><h3>Historial</h3>' + sp.hist.slice().reverse().slice(0, 8).map(function (x) { return '<div class="row sp sm" style="padding:.25rem 0"><span>' + esc(x.brand) + ' <span class="mut">(' + esc(x.why) + ')</span></span><b>' + UI.money(x.earn) + '</b></div>'; }).join('') + '</div>';
    return html;
  }

  function commTab(h, r) {
    var html = '', f = r.fan;
    html += '<div class="card"><div class="hd"><h3>Club de fans</h3>' + (f ? pill(esc(X.fanLevel()), 'g') : '') + '</div>' + (f ?
      '<div class="sm"><b>' + esc(f.nm) + '</b> · desde ' + esc(FP.Date.fmt(f.w0)) + '</div>' + UI.bar(f.xp, 20 + f.lvl * 25, 'g') + '<p class="mut sm">Cada nivel te da un poco más de moral semanal. Mensajes y saludos los hacen crecer.</p><p><button class="btn sm"' + (FP.S.week - (f.hi || -9) < 4 ? ' disabled' : '') + ' data-act="rd-fan">Saludar a la barra</button></p>'
      : '<p class="mut sm">Aún no existe. Nace cuando tengas unos 2.500 seguidores y algo de fama.</p>') + '</div>';
    html += '<div class="card"><h3>Cuenta parodia</h3>' + (r.parody ? '<p class="sm">«' + esc(r.parody.nm) + '» ' + (r.parody.on ? 'sigue activa' + (r.parody.fr ? ' y la tomas con humor' : '') : 'fue cerrada') + '.</p>' : '<p class="mut sm">Cuando seas muy famoso puede aparecer una cuenta de memes sobre ti.</p>') + '</div>';
    var done = (Dec.ensure().done || []).filter(function (x) { return x.kind === 'redes'; }).slice(-6).reverse();
    html += '<div class="card"><h3>Últimas situaciones</h3>' + (done.length ? done.map(function (x) { return '<div class="row sp sm" style="padding:.25rem 0"><span>' + esc(x.title) + '</span><span class="mut">' + esc(FP.Date.fmt(x.w)) + '</span></div>'; }).join('') : '<p class="mut sm">Sin polémicas, rumores ni mensajes todavía.</p>') + '</div>';
    return html;
  }

  function panelTab(h, r) {
    var p = h.life ? h.life.press : null, s = h.soc || {};
    var st = function (l, v) { return '<div class="kv-i"><span>' + l + '</span><b>' + v + '</b></div>'; };
    var html = '<div class="card"><h3>Seguidores en el tiempo</h3>' + spark(r.folH) + '</div>';
    html += '<div class="grid g2"><div class="card"><h3>Tu cuenta</h3>' + st('Seguidores', num(FP.Social.followers())) + st('Fama', Math.round(s.fame || 0)) + st('Publicaciones', r.posts) + st('Virales', r.viral) + st('Imagen pública', p ? Math.round(p.img) : '—') + st('Reputación de marca', Math.round(r.brand)) + '</div>' +
      '<div class="card"><h3>Polémicas y marca</h3>' + st('Polémicas', r.ptot) + st('Mal resueltas', r.pbad) + st('Contratos de marca', r.sp.n) + st('Ingresos de marca', UI.money(r.sp.earn)) + st('Club de fans', r.fan ? esc(X.fanLevel()) : 'no existe aún') + '</div></div>';
    html += '<div class="card"><h3>Tu mejor publicación</h3>' + (r.best ? '<p>«' + esc(r.best.t) + '»</p><p class="mut sm">' + num(r.best.l) + ' me gusta · ' + esc(FP.Date.fmt(r.best.w)) + (r.best.v ? ' · viral' : '') + '</p>' : '<p class="mut sm">Aún no has publicado.</p>') + '</div>';
    return html;
  }

  var social0 = SC.social;
  SC.social = function () {
    var h = FP.S.hero, r = X.ensure(), tab = UI.tab.rdx || 'feed';
    var seg = '<div class="tabs" style="margin-bottom:.8rem">' + [['feed', 'Feed'], ['marca', 'Marca' + (r.sp.offers.length ? ' (' + r.sp.offers.length + ')' : '')], ['comm', 'Comunidad'], ['panel', 'Panel']].map(function (t) { return '<button class="' + (tab === t[0] ? 'on' : '') + '" data-act="tabset" data-s="rdx" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
    var dec = UI.decCards(['redes']);
    if (tab === 'feed') { var html = social0.apply(this, arguments), k = html.indexOf('<div class="notice">'); return k < 0 ? dec + seg + html : html.slice(0, k) + dec + seg + html.slice(k); }
    var head = '<div class="prof"><div class="prof-bg"></div><div class="prof-in"><div><div class="pname">Redes y marca</div><div class="mut">' + esc(h.nm) + '</div></div><div class="grow"></div><div class="right"><b style="font-size:1.4rem">' + num(FP.Social.followers()) + '</b><div class="mut sm">seguidores</div></div></div></div>';
    return head + dec + seg + (tab === 'marca' ? brandTab(h, r) : tab === 'comm' ? commTab(h, r) : panelTab(h, r));
  };

  A['rd-acc'] = function (d) { var m = X.acceptSp(+d.id); UI.toast(esc(m.msg), m.ok ? 'ok' : 'warn'); UI.render(); };
  A['rd-rej'] = function (d) { var m = X.rejectSp(+d.id); UI.toast(esc(m.msg), 'ok'); UI.render(); };
  A['rd-cancel'] = function (d) { UI.confirm ? UI.confirm('¿Romper el contrato con esta marca? Tu reputación de marca baja.', function () { var m = X.cancelSp(+d.id); UI.toast(esc(m.msg), 'warn'); UI.render(); }) : (X.cancelSp(+d.id), UI.render()); };
  A['rd-fan'] = function () { var r = X.ensure(); if (!r.fan) return; r.fan.hi = FP.S.week; r.fan.xp += 8; var h = FP.S.hero; h.mor = U.clamp(h.mor + 2, 0, 100); UI.toast('Saludaste a la barra: +moral.', 'ok'); UI.render(); };

  var badges0 = UI.badges;
  UI.badges = function () {
    var b = badges0.apply(this, arguments);
    if (FP.S && FP.S.hero && FP.S.hero.rd) b.social = (Dec.open('redes').length + FP.S.hero.rd.sp.offers.length) || undefined;
    return b;
  };
})();
