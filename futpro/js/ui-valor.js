/* FUTPRO — explicación del valor de mercado (tarjeta en Mercado › Reputación). Lógica en js/valor.js. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, UI = FP.UI, esc = U.esc, I = UI.icon;
  function pct(v) { var p = Math.round(v * 100); return (p > 0 ? '+' : '') + p + ' %'; }
  UI.valorCard = function () {
    if (!FP.Valor) return '';
    var c = FP.Valor.get(), rows = c.parts.map(function (p) { return '<tr><td>' + esc(p.label) + '</td><td class="n ' + (p.v > 0.004 ? 'pos' : p.v < -0.004 ? 'neg' : '') + '" style="text-align:right;font-variant-numeric:tabular-nums">' + pct(p.v) + '</td><td class="mut sm">' + esc(p.why) + '</td></tr>'; }).join('');
    return '<div class="card"><div class="hd"><h3>' + I('chart') + 'Tu valor de mercado</h3></div>' +
      '<dl class="kv"><dt>Valor base</dt><dd>' + UI.money(c.base) + '</dd><dt>Ajuste del mercado</dt><dd>×' + c.mult.toFixed(2).replace('.', ',') + '</dd><dt>Valor actual</dt><dd><b>' + UI.money(c.value) + '</b></dd></dl>' +
      '<table class="wt" style="margin-top:.5rem"><tbody>' + rows + '</tbody></table>' +
      '<p class="mut sm" style="margin-top:.5rem">El valor base sale de tu nivel, tu potencial y tu edad. El mercado lo ajusta con tu rendimiento reciente (comparado con lo esperable en tu puesto y en tu categoría), tus títulos y distinciones de los últimos tres años, tu rol en el equipo y la selección. Con pocos partidos el ajuste se encoge, y en los más jóvenes pesa menos que su potencial. Tu sueldo en ofertas y renovaciones se calcula a partir de este valor.</p></div>';
  };
})();
