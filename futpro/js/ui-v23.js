/* FUTPRO — pantalla Finanzas personales (patrimonio, estilo de vida, inversiones, asesor, familia y fundación). js/dinero.js */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, UI = FP.UI, esc = U.esc, SC = UI.screens, A = UI.acts, I = UI.icon, D = FP.Dinero, Dec = FP.Dec, hdr = UI.hdr, seg = UI.seg;
  function m(k) { return FP.fmt.money(k); }
  function pill(t, c) { return '<span class="pill ' + (c || '') + '">' + t + '</span>'; }
  function kv(l, v, c) { return '<div class="kv-i"><span>' + l + '</span><b class="' + (c || '') + '">' + v + '</b></div>'; }

  function chart(hist) {
    if (hist.length < 2) return '<p class="mut sm">Todavía no hay historial suficiente.</p>';
    var W = 560, H = 110, xs = hist.map(function (p) { return p[0]; }), ys = hist.map(function (p) { return p[1]; }), x0 = xs[0], x1 = xs[xs.length - 1], mx = Math.max.apply(null, ys) || 1;
    var d = hist.map(function (p, i) { return (i ? 'L' : 'M') + (6 + (p[0] - x0) / Math.max(1, x1 - x0) * (W - 12)).toFixed(1) + ' ' + (H - 8 - Math.max(0, p[1]) / mx * (H - 18)).toFixed(1); }).join('');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto"><path d="' + d + 'L' + (W - 6) + ' ' + H + 'L6 ' + H + 'z" fill="rgba(47,191,113,.13)"/><path d="' + d + '" fill="none" stroke="var(--ac)" stroke-width="2.2" stroke-linejoin="round"/></svg><div class="row sp mut sm"><span>' + esc(FP.Date.fmt(x0)) + '</span><span>máx. ' + m(mx) + '</span><span>' + esc(FP.Date.fmt(x1)) + '</span></div>';
  }

  function resTab(h, f) {
    var nw = D.networth(), inv = D.invTotal(), w52 = f.hist.filter(function (p) { return p[0] <= FP.S.week - 52; }).slice(-1)[0], dn = w52 ? nw - w52[1] : null;
    var wk = D.weeklyLife(), tx = D.taxRate();
    var html = '<div class="grid g2"><div class="card"><h3>Patrimonio</h3><div class="kn" style="font-size:2rem;font-family:var(--disp)">' + m(nw) + '</div>' + (dn != null ? '<div class="' + (dn >= 0 ? 'ok' : 'bad') + ' sm">' + (dn >= 0 ? '▲ ' : '▼ ') + m(Math.abs(dn)) + ' en el último año</div>' : '') +
      kv('Dinero en caja', m(h.money)) + kv('Invertido', m(inv)) + kv('Gasto de vida estimado', m(wk * 52) + ' al año') + kv('Impuesto sobre sueldos en ' + esc(FP.DATA.countries[FP.Market.heroCountry()].n), Math.round(tx * 100) + '%') + '</div>' +
      '<div class="card"><h3>Totales de la carrera</h3>' + kv('Impuestos pagados', m(f.tax)) + kv('Gastos de vida', m(f.living)) + kv('Comisiones y costos', m(f.fees)) + kv('Ingresos de inversiones (arriendos, rentas y ventas)', m(f.gain), f.gain >= 0 ? 'ok' : 'bad') + kv('Perdido en estafas y malos negocios', m(f.lost), f.lost ? 'bad' : '') + kv('Ayuda a familia, amigos y fundación', m(f.given + f.fund.paid)) + '</div></div>';
    html += '<div class="card"><h3>Evolución del patrimonio</h3>' + chart(f.hist) + '</div>';
    html += '<div class="card"><h3>Últimos movimientos</h3>' + (f.led.length ? f.led.slice(0, 12).map(function (e) { return '<div class="row sp sm" style="padding:.25rem 0;border-top:1px solid var(--line)"><span>' + esc(e.t) + '</span><span class="' + (e.a >= 0 ? 'ok' : 'bad') + '">' + (e.a >= 0 ? '+' : '') + m(e.a) + ' <span class="mut">· ' + esc(FP.Date.fmt(e.w)) + '</span></span></div>'; }).join('') : '<p class="mut sm">Aún sin movimientos personales: inversiones, regalos, estafas y ayudas aparecen aquí.</p>') + '</div>';
    return html;
  }
  function lifeTab(h, f) {
    var minor = FP.Hero.age() < 18, html = '<div class="notice">' + (minor ? 'Siendo menor de edad vives con tu familia: los gastos de vida empiezan a los 18 años.' : 'Cada categoría cuesta una parte de tu sueldo (con un mínimo). Un mejor nivel de vida sube tu moral y, con un entorno de apoyo, acelera tu recuperación. Gastar demasiado respecto a lo que ganas genera estrés.') + '</div>';
    Object.keys(D.LIFE).forEach(function (c) {
      var d = D.LIFE[c];
      html += '<div class="card"><h3>' + esc(d.n) + '</h3><div class="btn-group" style="flex-wrap:wrap">' + d.lv.map(function (t, i) {
        return '<button class="btn ' + (f.lv[c] === i ? 'pri' : '') + '"' + (minor && i > 0 ? ' disabled' : '') + ' data-act="dn-life" data-c="' + c + '" data-v="' + i + '"><b>' + esc(t) + '</b><span class="mut sm">' + (i ? m(D.lifeCost(c, i) * 52) + ' al año' : 'sin costo') + '</span></button>';
      }).join('') + '</div></div>';
    });
    html += '<div class="card"><div class="row sp"><b>Gasto total de vida</b><span>' + m(D.weeklyLife() * 52) + ' al año</span></div>' + (D.stressOver() ? '<p class="bad sm" style="margin:.4rem 0 0">Estás gastando más de la mitad de lo que ganas: el estrés baja tu moral.</p>' : '') + '</div>';
    return html;
  }
  function invTab(h, f) {
    var adult = FP.Hero.age() >= 18, cash = Math.max(0, h.money), html = '<div class="notice">Elige cuánto de tu caja (' + m(cash) + ') invertir. Mínimo ' + D.MIN_INV + ' mil €. ' + (adult ? '' : 'Podrás invertir desde los 18 años.') + '</div>';
    html += '<div class="card"><h3>Mis inversiones (' + f.inv.length + ')</h3>' + (f.inv.length ? '<table class="t" style="width:100%"><thead><tr><th>Inversión</th><th class="n">Invertido</th><th class="n">Valor hoy</th><th class="n">Resultado</th><th></th></tr></thead><tbody>' + f.inv.map(function (x) {
      var pl = x.val - x.c, name = x.k || D.TYPES[x.t].n;
      return '<tr><td>' + esc(name) + (x.state ? ' <span class="pill ' + (x.state === 'prospera' ? 'g' : x.state === 'fracaso' ? 'r' : '') + '">' + esc(x.state) + '</span>' : '') + '<div class="mut sm">' + esc(D.TYPES[x.t].n) + '</div></td><td class="n">' + m(x.c) + '</td><td class="n">' + m(x.val) + '</td><td class="n ' + (pl >= 0 ? 'ok' : 'bad') + '">' + (pl >= 0 ? '+' : '') + m(pl) + '</td><td class="n"><button class="btn sm" data-act="dn-sell" data-id="' + x.id + '">Vender</button></td></tr>';
    }).join('') + '</tbody></table>' : '<p class="mut sm">Todavía no tienes inversiones.</p>') + '</div>';
    html += '<div class="grid g2">' + Object.keys(D.TYPES).map(function (t) {
      var T = D.TYPES[t];
      return '<div class="card"><h3>' + esc(T.n) + '</h3><p class="mut sm">' + esc(T.d) + '</p><div class="btn-group">' + [10, 25, 50].map(function (p) { var amt = Math.round(cash * p / 100); return '<button class="btn sm"' + (!adult || amt < D.MIN_INV ? ' disabled' : '') + ' data-act="dn-inv" data-t="' + t + '" data-a="' + amt + '">' + p + '% · ' + m(amt) + '</button>'; }).join('') + '</div></div>';
    }).join('') + '</div>';
    return html;
  }
  function othersTab(h, f) {
    var html = '<div class="card"><h3>Asesor financiero</h3><div class="btn-group" style="flex-wrap:wrap">' + D.ADV.map(function (a, i) { return '<button class="btn ' + (f.adv === i ? 'pri' : '') + '" data-act="dn-adv" data-v="' + i + '"><b>' + esc(a[0]) + '</b><span class="mut sm">' + esc(a[1]) + '</span></button>'; }).join('') + '</div></div>';
    html += '<div class="card"><h3>Familia</h3><p class="mut sm">Mejora el apoyo familiar y tu moral.</p>' +
      '<p><button class="btn' + (f.fam.casa ? '' : ' pri') + '"' + (f.fam.casa ? ' disabled' : '') + ' data-act="dn-parents">' + (f.fam.casa ? 'Casa para tus padres: comprada' : 'Comprar una casa para tus padres · ' + m(D.houseParentsCost())) + '</button></p>' +
      '<div class="btn-group" style="flex-wrap:wrap">' + D.FAM.apoyo.map(function (t, i) { return '<button class="btn ' + (f.fam.apoyo === i ? 'pri' : '') + '" data-act="dn-fam" data-v="' + i + '"><b>' + esc(t) + '</b><span class="mut sm">' + (i ? m((D.refWage() / 52) * [0, .02, .05][i] * 52) + ' al año' : 'sin costo') + '</span></button>'; }).join('') + '</div></div>';
    html += '<div class="card"><div class="hd"><h3>Fundación</h3>' + (f.fund.lv ? pill('Activa', 'g') : '') + '</div><p class="mut sm">Aportes anuales para niños de tu barrio: mejora tu imagen pública, tu fama y tu reputación de marca. ' + (f.fund.helped ? 'Hasta hoy ayudó a ' + f.fund.helped + ' niños.' : '') + '</p><div class="btn-group" style="flex-wrap:wrap">' + ['Sin fundación', 'Aporte pequeño', 'Aporte medio', 'Aporte grande'].map(function (t, i) { return '<button class="btn ' + (f.fund.lv === i ? 'pri' : '') + '"' + (FP.Hero.age() < 16 && i ? ' disabled' : '') + ' data-act="dn-fund" data-v="' + i + '"><b>' + t + '</b><span class="mut sm">' + (i ? m(Math.max([0, .02, .05, .10][i] * D.refWage() / 52, [0, .01, .03, .07][i]) * 52) + ' al año' : 'sin costo') + '</span></button>'; }).join('') + '</div></div>';
    return html;
  }

  SC.dinero = function () {
    var h = FP.S.hero, f = D.ensure(), tab = UI.tab.dn || 'res';
    var html = hdr('coin', 'Finanzas personales', 'Patrimonio, gastos, inversiones e impuestos', seg('dn', [['res', 'Resumen', 'chart'], ['vida', 'Estilo de vida', 'home'], ['inv', 'Inversiones', 'target'], ['otros', 'Asesor, familia y fundación', 'user']], tab));
    html += UI.decCards(['dinero']);
    return html + (tab === 'vida' ? lifeTab(h, f) : tab === 'inv' ? invTab(h, f) : tab === 'otros' ? othersTab(h, f) : resTab(h, f));
  };
  function done(r) { if (r && r.msg) UI.toast(esc(r.msg), r.ok ? 'ok' : 'warn'); UI.render(); }
  A['dn-life'] = function (d) { done(D.setLife(d.c, +d.v)); };
  A['dn-inv'] = function (d) { done(D.invest(d.t, +d.a)); };
  A['dn-sell'] = function (d) { done(D.sell(+d.id)); };
  A['dn-adv'] = function (d) { done(D.setAdvisor(+d.v)); };
  A['dn-fam'] = function (d) { done(D.setFam(+d.v)); };
  A['dn-parents'] = function () { done(D.buyParentsHouse()); };
  A['dn-fund'] = function (d) { done(D.setFund(+d.v)); };

  var g = UI.GROUPS[3][1]; g.splice(2, 0, ['dinero', 'Finanzas personales', 'coin']);
  var badges0 = UI.badges;
  UI.badges = function () { var b = badges0.apply(this, arguments); if (FP.S && FP.S.hero) b.dinero = Dec.open('dinero').length || undefined; return b; };
})();
