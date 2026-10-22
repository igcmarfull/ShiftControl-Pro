/* FUTPRO — interfaz: pantalla «Prensa» (titulares de medios del país, ánimo de la hinchada y lo que se dice de ti) */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, D = FP.Date, UI = FP.UI, esc = U.esc, SC = UI.screens;
  var TONES = { serio: 'Diario', popular: 'Popular', digital: 'Digital', radio: 'Radio', hinchada: 'Hinchada' };

  SC.press = function () {
    var S = FP.S, h = S.hero, P = FP.Prensa, st = P.ensure(), tab = UI.tab.press || 'all';
    var cid = h.club != null ? h.club : h.team, club = h.club != null ? S.clubs[h.club] : null, cc = club ? club.c : FP.Market.heroCountry(), mood = st.mood, label = P.moodLabel(mood);
    var tone = mood >= 65 ? 'g' : mood >= 40 ? 'y' : 'r';
    var html = UI.hdr('news', 'Prensa y hinchada', cid != null && cid >= 0 ? FP.Core.tname(cid) : 'Sin club');
    html += '<div class="notice">Los nombres de los medios son reales, pero los titulares los inventa el juego según tus partidos: no son notas publicadas por ellos.</div>';
    html += '<div class="grid g21"><div>';
    var feed = (st.feed || []).filter(function (x) { return tab === 'all' || (tab === 'hinchada' ? x.k === 'hinchada' : x.k === 'prensa'); }).slice(0, 40);
    html += '<div class="tabs">' + [['all', 'Todo'], ['prensa', 'Prensa'], ['hinchada', 'Hinchada']].map(function (t) { return '<button class="' + (tab === t[0] ? 'on' : '') + '" data-act="tabset" data-s="press" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
    html += feed.length ? feed.map(function (x) {
      return '<div class="card" style="margin:.5rem 0"><div class="row sp"><b>' + esc(x.o) + '</b><span class="mut sm">' + esc(TONES[x.tn] || '') + ' · ' + esc(D.fmt(x.w)) + '</span></div><p style="margin:.3rem 0 0">' + esc(x.t) + '</p><div class="dim sm">' + esc(x.c || '') + '</div></div>';
    }).join('') : '<div class="card"><p class="mut">Aún no hay titulares. Aparecerán después de tus partidos oficiales.</p></div>';
    html += '</div><div>';
    html += '<div class="card"><h3>Ánimo de la hinchada</h3><div class="row sp"><b>' + esc(label) + '</b><span class="mut sm">' + Math.round(mood) + ' / 100</span></div>' + UI.bar(mood, 100, tone) + '<p class="mut sm" style="margin:.5rem 0 0">' + esc(P.moodText(mood)) + '</p></div>';
    html += '<div class="card"><h3>Lo que se dice de ti</h3>' + P.dossier().map(function (l) { return '<p style="margin:.35rem 0">' + esc(l) + '</p>'; }).join('') + '</div>';
    html += '<div class="card"><h3>Medios de ' + esc(FP.Core.cname(cc)) + '</h3><p class="mut sm">' + P.outlets(cc).map(function (o) { return esc(o[0]) + ' (' + esc(TONES[o[1]]) + ')'; }).join(' · ') + '</p></div>';
    return html + '</div></div>';
  };
})();
