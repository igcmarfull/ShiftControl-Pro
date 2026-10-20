/* FUTPRO — Historial de carrera: registro detallado por clase de competición (igual que Estadísticas → Por clase),
   ordenado desde la temporada más antigua hasta la más reciente. Solo presentación sobre FP.Stats. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, UI = FP.UI, esc = U.esc, SC = UI.screens, I = UI.icon, ST = FP.Stats;

  function table(rows, id) {
    return UI.table(id, [
      { k: 's', t: 'Temp.' }, { k: 'tn', t: 'Equipo', f: function (r) { return r.t != null && r.t < 5000 ? UI.clubC(r.t) : esc(r.tn); }, v: function (r) { return r.tn; } }, { k: 'c', t: 'Competición' },
      { k: 'p', t: 'PJ', n: 1 }, { k: 'st', t: 'Tit.', n: 1 }, { k: 'sub', t: 'Sup.', n: 1 }, { k: 'min', t: 'Min', n: 1 }, { k: 'g', t: 'G', n: 1 }, { k: 'a', t: 'A', n: 1 },
      { k: 'yc', t: 'Am.', n: 1 }, { k: 'rc', t: 'Ro.', n: 1 }, { k: 'rt', t: 'Nota', n: 1, f: function (r) { return r.rn ? (r.rs / r.rn).toFixed(2) : '—'; }, v: function (r) { return r.rn ? r.rs / r.rn : 0; } }
    ], rows.map(function (r) { r.sub = r.p - r.st; return r; }), { sort: ['s', 'a'], max: 120 });
  }

  var career0 = SC.career;
  SC.career = function () {
    var html = career0.apply(this, arguments), by = ST.byClass(), keys = Object.keys(by);
    if (!keys.length) return html;
    var out = '<div class="hd" style="margin:1.2rem 0 .2rem"><h3>' + I('list') + 'Registro por clase de competición</h3></div><p class="mut sm" style="margin:0 0 .6rem">De la temporada más antigua a la más reciente. Puedes ordenar por cualquier columna.</p>';
    out += '<div class="grid g3">' + keys.map(function (k) {
      var t = by[k].tot;
      return '<div class="card"><div class="hd"><h3>' + esc(ST.CLASSES[k]) + '</h3><span class="pill">' + t.p + ' PJ</span></div><div class="terms" style="grid-template-columns:repeat(4,1fr)"><div><span>Goles</span><b>' + t.g + '</b></div><div><span>Asist.</span><b>' + t.a + '</b></div><div><span>Minutos</span><b>' + t.min + '</b></div><div><span>Nota</span><b>' + (t.rn ? t.rt.toFixed(2) : '—') + '</b></div></div><div class="mut sm" style="margin-top:.4rem">' + t.st + ' titular · ' + t.sub + ' suplente · ' + t.yc + ' am. · ' + t.rc + ' ro. · ' + t.w + 'V ' + t.d + 'E ' + t.l + 'D</div></div>';
    }).join('') + '</div>';
    keys.forEach(function (k) { out += '<div class="card"><div class="hd"><h3>' + esc(ST.CLASSES[k]) + ' — detalle</h3></div>' + table(by[k].rows, 'hc_' + k) + '</div>'; });
    return html + out;
  };
})();
