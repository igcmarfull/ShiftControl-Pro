/* FUTPRO — Palmarés → Mis trofeos: tres vistas (Vitrina, Cronología, Por competición). Solo presentación sobre h.trophies y h.awards. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, UI = FP.UI, esc = U.esc, SC = UI.screens, I = UI.icon, hdr = UI.hdr, seg = UI.seg;
  var VIEWS = [['vit', 'Vitrina'], ['time', 'Cronología'], ['comp', 'Por competición']];

  function baseClub(n) { return String(n || '').replace(/\s*\((juv\.|cedido)\)\s*$/i, ''); }
  function trName(t) { var n = String(t.nm).replace(/^(Subcampeón|Campeón)\s+(de\s+|del\s+)?/i, ''); return n.charAt(0).toUpperCase() + n.slice(1); }
  function crestFor(nm) { return nm ? UI.crestName(baseClub(nm), 'sm') : ''; }
  function data() {
    var h = FP.S.hero, tr = (h.trophies || []).slice().sort(function (a, b) { return (a.w || 0) - (b.w || 0); }), aw = (h.awards || []).slice().sort(function (a, b) { return (a.w || 0) - (b.w || 0); });
    var champ = tr.filter(function (t) { return !t.sub; }), sub = tr.filter(function (t) { return t.sub; });
    var top = aw.filter(function (a) { return /Balón de Oro/i.test(a.nm); });
    return { tr: tr, aw: aw, champ: champ, sub: sub, top: top };
  }
  function kpis(d) {
    function k(ic, v, l, c) { return '<div class="ph-k ' + (c || '') + '"><span class="ph-ki">' + I(ic) + '</span><b>' + v + '</b><i>' + l + '</i></div>'; }
    return '<div class="ph-kpis">' + k('trophy', d.champ.length, 'Títulos', 'gold') + k('medal', d.sub.length, 'Subcampeonatos', 'silver') + k('star', d.aw.length, 'Premios individuales', 'vio') + k('target', d.top.length, 'Balones de Oro', 'gold') + '</div>';
  }
  function empty() { return '<div class="card"><p class="mut">Todavía no tienes trofeos ni premios. Cada título y distinción que consigas aparecerá aquí.</p></div>'; }

  // ---- A · Vitrina ----
  function cup(t) { return '<div class="ph-cup ' + (t.sub ? 'sub' : '') + '"><div class="ph-cupi">' + I('trophy') + '</div><b>' + esc(t.sub ? t.nm : trName(t)) + '</b><span>' + esc(t.y) + '</span><i>' + esc(baseClub(t.club || '')) + '</i></div>'; }
  function medal(a) { return '<div class="ph-cup aw"><div class="ph-cupi">' + I('medal') + '</div><b>' + esc(a.nm) + '</b><span>' + esc(a.y) + '</span></div>'; }
  function shelves(items, mk, per) { var out = ''; for (var i = 0; i < items.length; i += per) out += '<div class="ph-shelf">' + items.slice(i, i + per).map(mk).join('') + '</div>'; return out; }
  function vitrina(d) {
    var items = d.champ.slice().reverse().concat(d.sub.slice().reverse());
    return '<div class="ph-case"><div class="ph-ct">' + I('trophy') + 'Vitrina de trofeos</div>' + (items.length ? shelves(items, cup, 5) : '<p class="mut" style="padding:1rem">Sin trofeos todavía.</p>') + '</div>' +
      '<div class="ph-case aw"><div class="ph-ct">' + I('star') + 'Distinciones individuales</div>' + (d.aw.length ? shelves(d.aw.slice().reverse(), medal, 5) : '<p class="mut" style="padding:1rem">Sin premios todavía.</p>') + '</div>';
  }

  // ---- B · Cronología ----
  function timeline(d) {
    var by = {}, order = [];
    d.tr.concat(d.aw).forEach(function (x) { var y = String(x.y).slice(0, 4); if (!by[y]) { by[y] = { y: String(x.y), t: [], a: [], w: x.w || 0 }; order.push(y); } by[y].w = Math.min(by[y].w, x.w || 0); if (x.club) by[y].t.push(x); else by[y].a.push(x); });
    order.sort();
    return '<div class="ph-tl">' + order.map(function (k) {
      var g = by[k], club = g.t[0] && g.t[0].club;
      return '<div class="ph-ty"><div class="ph-tdot">' + (club ? crestFor(club) : I('star')) + '</div><div class="card ph-tc"><div class="row sp"><div class="ph-yr">' + esc(g.y) + '</div><div class="mut sm">' + esc(club ? baseClub(club) : '') + '</div></div>' +
        '<div class="ph-chips">' + g.t.map(function (t) { return '<span class="ph-chip ' + (t.sub ? 'sub' : 'gold') + '">' + I('trophy') + esc(t.nm) + '</span>'; }).join('') + g.a.map(function (a) { return '<span class="ph-chip aw">' + I('medal') + esc(a.nm) + '</span>'; }).join('') + '</div></div></div>';
    }).join('') + '</div>';
  }

  // ---- C · Por competición ----
  function group(list, key) { var m = {}, o = []; list.forEach(function (x) { var k = key(x); if (!m[k]) { m[k] = []; o.push(k); } m[k].push(x); }); return o.map(function (k) { return { k: k, list: m[k] }; }); }
  function byComp(d) {
    var gt = group(d.tr, trName).sort(function (a, b) { return b.list.filter(function (t) { return !t.sub; }).length - a.list.filter(function (t) { return !t.sub; }).length || b.list.length - a.list.length; });
    var ga = group(d.aw, function (a) { return String(a.nm).split(' · ')[0]; }).sort(function (a, b) { return b.list.length - a.list.length; });
    function yrs(l) { return l.map(function (t) { return '<span class="ph-yc ' + (t.sub ? 'sub' : '') + '">' + esc(t.y) + '</span>'; }).join(''); }
    return '<div class="card"><div class="hd"><h3>' + I('trophy') + 'Títulos y subcampeonatos por competición</h3></div>' + (gt.length ? '<table class="ph-tb"><thead><tr><th>Competición</th><th class="n">Títulos</th><th class="n">Sub.</th><th>Temporadas</th></tr></thead><tbody>' + gt.map(function (g) {
      var c = g.list.filter(function (t) { return !t.sub; }).length, s = g.list.length - c;
      return '<tr><td><b>' + esc(g.k) + '</b></td><td class="n">' + (c ? '<span class="ph-n gold">' + c + '</span>' : '–') + '</td><td class="n">' + (s ? '<span class="ph-n silver">' + s + '</span>' : '–') + '</td><td>' + yrs(g.list) + '</td></tr>';
    }).join('') + '</tbody></table>' : '<p class="mut">Sin trofeos todavía.</p>') + '</div>' +
      '<div class="card"><div class="hd"><h3>' + I('star') + 'Distinciones individuales por tipo</h3></div>' + (ga.length ? '<table class="ph-tb"><thead><tr><th>Distinción</th><th class="n">Veces</th><th>Detalle</th></tr></thead><tbody>' + ga.map(function (g) {
        return '<tr><td><b>' + esc(g.k) + '</b></td><td class="n"><span class="ph-n vio">' + g.list.length + '</span></td><td>' + g.list.map(function (a) { var p = String(a.nm).split(' · ')[1]; return '<span class="ph-yc aw" title="' + esc(a.nm) + '">' + esc(a.y) + (p ? ' · ' + esc(p) : '') + '</span>'; }).join('') + '</td></tr>';
      }).join('') + '</tbody></table>' : '<p class="mut">Sin premios todavía.</p>') + '</div>';
  }

  var honors0 = SC.honors;
  SC.honors = function () {
    var tab = UI.tab.honors || 'me';
    if (tab !== 'me') return honors0.apply(this, arguments);
    var d = data(), view = UI.tab.phv || 'comp';
    var html = hdr('trophy', 'Palmarés', 'Trofeos y premios', seg('honors', [['me', 'Mis trofeos', 'medal'], ['clubs', 'Campeones del mundo', 'globe']], tab));
    if (!d.tr.length && !d.aw.length) return html + empty();
    html += kpis(d) + '<div class="fbar" style="margin:.4rem 0 .8rem"><span class="mut sm" style="margin-right:.4rem">Vista</span><div class="seg">' + VIEWS.map(function (v) { return '<button class="' + (view === v[0] ? 'on' : '') + '" data-act="tabset" data-s="phv" data-t="' + v[0] + '">' + v[1] + '</button>'; }).join('') + '</div></div>';
    return html + (view === 'time' ? timeline(d) : view === 'comp' ? byComp(d) : vitrina(d));
  };
})();
