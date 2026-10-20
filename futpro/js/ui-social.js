/* FUTPRO — interfaz: Redes, hitos, radar de atributos, escudos de iniciales y temas visuales */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, UI = FP.UI, esc = U.esc, A = UI.acts, SC = UI.screens;

  // ---------- escudo de iniciales (no usa marcas reales) ----------
  UI.crest = function (id, big) {
    var nm = C.tname(id) || '?', words = nm.replace(/\(.*?\)/g, '').replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9' ]/g, ' ').split(/\s+/).filter(function (w) { return w && !/^(de|del|la|el|los|y|FC|CD|SC|CF|AC|AS)$/i.test(w); });
    var ini = (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || nm).slice(0, 2)).toUpperCase();
    var hue = U.hash(nm) % 360;
    return '<span class="crest' + (big ? ' lg' : '') + '" style="--h:' + hue + '">' + esc(ini) + '</span>';
  };
  UI.clubC = function (id) { return UI.crest(id) + UI.club(id); };

  // ---------- radar tipo carta ----------
  UI.radarStats = function (h) {
    var a = h.at;
    return [['RIT', (a.vel + a.ace) / 2], ['TIR', (a.fin + a.rem) / 2], ['PAS', (a.pas + a.vis) / 2], ['REG', (a.reg + a.con) / 2], ['DEF', (a.dfn + a.ant) / 2], ['FIS', (a.fue + a.res) / 2]];
  };
  UI.radar = function (h, size) {
    var s = UI.radarStats(h), S = size || 220, c = S / 2, r = S * 0.34, n = s.length;
    function pt(i, v) { var ang = -Math.PI / 2 + i * 2 * Math.PI / n, rr = r * Math.max(0.05, v / 99); return [c + Math.cos(ang) * rr, c + Math.sin(ang) * rr]; }
    var grid = '', i, k;
    [0.33, 0.66, 1].forEach(function (f) { var p = []; for (i = 0; i < n; i++) { var q = pt(i, 99 * f); p.push(q[0].toFixed(1) + ',' + q[1].toFixed(1)); } grid += '<polygon points="' + p.join(' ') + '" fill="none" stroke="var(--line2)" stroke-width="1"/>'; });
    var spokes = '', labels = '';
    for (i = 0; i < n; i++) { var o = pt(i, 99), l = pt(i, 128); spokes += '<line x1="' + c + '" y1="' + c + '" x2="' + o[0].toFixed(1) + '" y2="' + o[1].toFixed(1) + '" stroke="var(--line)"/>'; labels += '<text x="' + l[0].toFixed(1) + '" y="' + (l[1] + 4).toFixed(1) + '" text-anchor="middle" font-size="11" font-weight="700" fill="var(--mut)">' + s[i][0] + ' <tspan fill="var(--tx)">' + Math.round(s[i][1]) + '</tspan></text>'; }
    var poly = s.map(function (x, j) { var q = pt(j, x[1]); return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ');
    return '<svg viewBox="0 0 ' + S + ' ' + S + '" class="radar" role="img" aria-label="Perfil de atributos">' + grid + spokes + '<polygon points="' + poly + '" fill="var(--ac)" fill-opacity=".28" stroke="var(--ac)" stroke-width="2"/>' + labels + '</svg>';
  };

  // ---------- Redes ----------
  function avatar(who) {
    var hue = U.hash(who.n) % 360, ini = who.n.split(' ').map(function (x) { return x[0]; }).slice(0, 2).join('').toUpperCase();
    return '<span class="av ' + who.k + '" style="--h:' + hue + '">' + esc(ini) + '</span>';
  }
  UI.tweet = function (p) {
    var badge = p.who.k === 'media' ? ' <span class="pill b">prensa</span>' : p.who.k === 'club' ? ' <span class="pill g">club</span>' : p.who.k === 'me' ? ' <span class="pill v">tú</span>' : '';
    return '<div class="tw-i"><div>' + avatar(p.who) + '</div><div class="tw-b"><div class="tw-h"><b>' + esc(p.who.n) + '</b>' + badge + ' <span class="dim">' + esc(p.who.h) + ' · ' + D.fmt(p.w) + '</span></div><div class="tw-t">' + esc(p.t) + '</div><div class="tw-f"><span>💬 ' + FP.fmt.num(p.c) + '</span><span>↻ ' + FP.fmt.num(p.r) + '</span><span>♥ ' + FP.fmt.num(p.l) + '</span></div></div></div>';
  };
  SC.social = function () {
    var S = FP.S, h = S.hero, s = FP.Social ? (h.soc || (FP.Social.weekly && { fol: 0, feed: [] })) : { fol: 0, feed: [] };
    var tab = UI.tab.social || 'all';
    var handle = '@' + h.nm.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
    var feed = (s.feed || []).filter(function (p) { return tab === 'all' || (tab === 'media' && p.who.k === 'media') || (tab === 'fan' && p.who.k === 'fan') || (tab === 'club' && (p.who.k === 'club' || p.who.k === 'me')); });
    var html = '<div class="prof"><div class="prof-bg"></div><div class="prof-in"><span class="av xl" style="--h:' + (U.hash(h.nm) % 360) + '">' + esc(h.nm[0]) + '</span><div><div class="pname">' + esc(h.nm) + '</div><div class="mut">' + handle + ' · ' + UI.pos(h.pos) + ' · ' + esc(UI.heroTeamLabel()) + '</div></div><div class="grow"></div><div class="right"><b style="font-size:1.4rem">' + FP.fmt.num(s.fol || FP.Social.followers()) + '</b><div class="mut sm">seguidores</div></div></div></div>';
    html += '<div class="notice">Contenido simulado: cuentas y comentarios son ficticios y los genera el juego según tu rendimiento.</div>';
    html += '<div class="grid g21"><div><div class="tabs">' + [['all', 'Todo'], ['media', 'Prensa'], ['fan', 'Hinchas'], ['club', 'Club y tú']].map(function (t) { return '<button class="' + (tab === t[0] ? 'on' : '') + '" data-act="tabset" data-s="social" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div><div class="card tw">' + (feed.length ? feed.slice(0, 60).map(UI.tweet).join('') : '<p class="mut">Todavía no hay publicaciones. Juega, marca goles y la gente empezará a hablar de ti.</p>') + '</div></div>';
    html += '<div><div class="card"><h3>Publicar</h3><p class="mut sm">Una publicación por semana.</p>' + FP.Social.actions.map(function (a) { return '<button class="btn" style="width:100%;margin-bottom:.4rem;text-align:left" data-act="soc-act" data-id="' + a.id + '">' + esc(a.t) + '<br><span class="mut sm">' + esc(a.d) + '</span></button>'; }).join('') + '</div>' +
      '<div class="card"><h3>Hitos</h3>' + UI.milestoneList(FP.Social.milestones(), 8) + '</div></div></div>';
    return html;
  };
  A['soc-act'] = function (d) { var r = FP.Social.act(d.id); UI.toast(esc(r.msg), r.ok ? 'ok' : 'warn'); UI.render(); };

  UI.milestoneList = function (list, max) {
    var next = list.filter(function (m) { return !m.done; }).slice(0, max || 6), done = list.filter(function (m) { return m.done; }).length;
    return '<p class="mut sm">' + done + ' de ' + list.length + ' desbloqueados</p>' + next.map(function (m) {
      return '<div style="margin:.45rem 0"><div class="row sp"><span>🏅 ' + esc(m.n) + '</span><span class="mut sm">' + FP.fmt.num(Math.round(m.v)) + ' / ' + FP.fmt.num(m.g) + '</span></div>' + UI.bar(m.v, m.g, 'y') + '<div class="dim sm">' + esc(m.d) + '</div></div>';
    }).join('') + (!next.length ? '<p class="ok">¡Todos los hitos completados!</p>' : '');
  };

  // ---------- temas ----------
  UI.skins = { estadio: 'Estadio (oscuro)', claro: 'Informe táctico (claro)' };
  UI.setSkin = function (name) {
    var l = document.getElementById('skinclaro'); if (l) l.disabled = name !== 'claro';
    try { localStorage.setItem('futpro.skin', name); } catch (e) { }
    UI.skin = name;
  };
  UI.initSkin = function () { var v = 'estadio'; try { v = localStorage.getItem('futpro.skin') || 'estadio'; } catch (e) { } UI.setSkin(v); };
  A.skin = function (d, t) { UI.setSkin(t.value); UI.render(); };
})();
