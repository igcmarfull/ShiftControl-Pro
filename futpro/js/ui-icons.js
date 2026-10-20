/* FUTPRO — biblioteca visual: iconos SVG, banderas, escudos, avatar, medidores.
 * Los escudos reales no se incluyen (son marcas registradas). Si dispones de recursos con licencia, colócalos en
 * assets/crests/ y regístralos en FP.CRESTS (ver README): el juego los usa automáticamente en lugar del escudo generado. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, UI = FP.UI, esc = U.esc;

  // ---------- iconos (rejilla 24, trazo) ----------
  var P = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    ball: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5l3.8 2.8-1.5 4.4H9.7L8.2 10.3z"/><path d="M12 7.5V3.2M15.8 10.3l4-1.4M14.3 14.7l2.4 3.6M9.7 14.7l-2.4 3.6M8.2 10.3l-4-1.4"/>',
    train: '<path d="M6.5 8v8M3.5 10v4M17.5 8v8M20.5 10v4M6.5 12h11"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 01-8 0z"/><path d="M8 6H4v1.5A3.5 3.5 0 007.5 11M16 6h4v1.5A3.5 3.5 0 0116.5 11M12 13v4M8.5 20.5h7M10 17h4"/>',
    table: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M3.5 14.5h17M9 4.5v15"/>',
    chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
    transfer: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
    contract: '<path d="M6 3h8.5L19 7.5V21H6z"/><path d="M14 3v5h5M9 13h7M9 17h4"/>',
    news: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8 8.5h8M8 12h8M8 15.5h5"/>',
    chat: '<path d="M4 5.5h16v11H9.5L5 20.5v-4H4z"/>',
    flag: '<path d="M5.5 21V4M5.5 4.5h11l-2 4 2 4h-11"/>',
    medal: '<circle cx="12" cy="14.5" r="5"/><path d="M8.5 3l3.5 6.5M15.5 3L12 9.5M12 12.5v4"/>',
    history: '<path d="M3.5 12a8.5 8.5 0 108.5-8.5A8.4 8.4 0 006 6"/><path d="M3.5 3.5V8H8M12 8v4.5l3 1.8"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    play: '<path d="M7 4.5l12 7.5-12 7.5z" class="f"/>',
    fwd: '<path d="M5 5.5l7 6.5-7 6.5M13 5.5l7 6.5-7 6.5"/>',
    skip: '<path d="M5 5.5l9 6.5-9 6.5zM18 5.5v13"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 2h-15zM10 21h4"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.5l3.5 2"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', chev: '<path d="M9 5l7 7-7 7"/>', star: '<path d="M12 3.5l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.8l6-.8z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', pin: '<path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0113 0c0 5.2-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    whistle: '<circle cx="9" cy="14" r="5"/><path d="M13.5 11l7-3.5v4l-5 1.8M9 11.5v1"/>',
    sub: '<path d="M4 8h12l-3-3M20 16H8l3 3"/>', inj: '<path d="M9 3.5h6v5.5h5.5v6H15v5.5H9V15H3.5V9H9z"/>',
    glove: '<path d="M7 12V6.5a1.5 1.5 0 013 0V11M10 11V4.5a1.5 1.5 0 013 0V11M13 11V5.5a1.5 1.5 0 013 0V12M16 12V8.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-1a6 6 0 01-5-3l-2.5-4a1.5 1.5 0 012.5-1.5L7 14"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" class="f"/>',
    boot: '<path d="M4 15.5V6h5v4.5c0 1 .7 1.7 1.7 2l6.8 2c1.7.5 3 1.7 3 3.5v.5H4z"/>', zap: '<path d="M13 3L5.5 13.5H12L11 21l7.5-10.5H12z"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>', moon: '<path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    card: '<rect x="7" y="3.5" width="10" height="17" rx="2" class="f"/>', up: '<path d="M6 14l6-6 6 6"/>', down: '<path d="M6 10l6 6 6-6"/>'
  };
  UI.icon = function (n, cls) {
    var p = P[n] || P.ball;
    p = p.replace(/class="f"/g, 'class="f" fill="currentColor" stroke="none"');
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + p + '</svg>';
  };
  UI.hasIcon = function (n) { return !!P[n]; };

  // ---------- banderas (dibujadas, rejilla 30×20) ----------
  var F = {
    CHI: 'h:ffffff,d52b1e|r:0,0,12,10,0039a6|s:6,5,3.2,ffffff', ARG: 'h:74acdf,ffffff,74acdf|c:15,10,2.3,f6b40e', BRA: 'B:009b3a|p:15,2,27.5,10,15,18,2.5,10,ffdf00|c:15,10,4.4,002776',
    URU: 'h:ffffff,0038a8,ffffff,0038a8,ffffff,0038a8,ffffff,0038a8,ffffff|r:0,0,11,11,ffffff|c:5.5,5.5,2.6,f6c700', PAR: 'h:d52b1e,ffffff,0038a8|c:15,10,2.4,5a9a4a',
    COL: 'h:fcd116*2,003893,ce1126', ECU: 'h:fcd116*2,003893,ce1126', PER: 'v:d91023,ffffff,d91023', BOL: 'h:d52b1e,f9e300,007934', VEN: 'h:ffcc00,00247d,cf142b',
    ENG: 'B:ffffff|x:ce1124,3', SCO: 'B:0065bd|X:ffffff,3', WAL: 'h:ffffff,00ab39|c:15,10,3.6,d30731', ESP: 'h:aa151b,f1bf00*2,aa151b', ITA: 'v:009246,ffffff,ce2b37',
    GER: 'h:000000,dd0000,ffce00', FRA: 'v:0055a4,ffffff,ef4135', POR: 'v:046a38*2,da291c*3|c:12,10,3.6,ffe000', NED: 'h:ae1c28,ffffff,21468b', BEL: 'v:000000,fdda24,ef3340',
    TUR: 'B:e30a17|c:11,10,5,ffffff|c:12.5,10,4,e30a17|s:17.5,10,2,ffffff', GRE: 'h:0d5eaf,ffffff,0d5eaf,ffffff,0d5eaf,ffffff,0d5eaf,ffffff,0d5eaf|r:0,0,11,11,0d5eaf|r:4.5,0,2,11,ffffff|r:0,4.5,11,2,ffffff',
    SUI: 'B:d52b1e|r:12.5,4,5,12,ffffff|r:9,7.5,12,5,ffffff', AUT: 'h:ed2939,ffffff,ed2939', DEN: 'B:c8102e|N:ffffff,3,10', SWE: 'B:006aa7|N:fecc00,3,10', NOR: 'B:ba0c2f|N:ffffff,5,10|N:00205b,2.4,10',
    POL: 'h:ffffff,dc143c', CZE: 'h:ffffff,d7141a|p:0,0,13,10,0,20,11457e', HRV: 'h:ff0000,ffffff,171796', SRB: 'h:c6363c,0c4076,ffffff', UKR: 'h:0057b7,ffd700', HUN: 'h:ce2939,ffffff,477050',
    SVK: 'h:ffffff,0b4ea2,ee1c25', ROU: 'v:002b7f,fcd116,ce1126', IRL: 'v:169b62,ffffff,ff883e',
    USA: 'h:b22234,ffffff,b22234,ffffff,b22234,ffffff,b22234|r:0,0,13,10.5,3c3b6e', MEX: 'v:006847,ffffff,ce1126|c:15,10,2.3,8a6b2e', CAN: 'v:d52b1e,ffffff*2,d52b1e|c:15,10,3.2,d52b1e',
    CRC: 'h:002b7f,ffffff,ce1126*2,ffffff,002b7f', PAN: 'B:ffffff|r:15,0,15,10,d21034|r:0,10,15,10,005293|s:7.5,5,2.6,005293|s:22.5,15,2.6,d21034', JAM: 'B:009b3a|p:0,0,15,10,0,20,000000|p:30,0,15,10,30,20,000000|X:fed100,2',
    HON: 'h:0073cf,ffffff,0073cf', HAI: 'h:00209f,d21034', SLV: 'h:0f47af,ffffff,0f47af', CUW: 'B:002b7f|r:0,12,30,2.6,f9e814',
    JPN: 'B:ffffff|c:15,10,6,bc002d', KOR: 'B:ffffff|c:15,10,5,cd2e3a|c:15,12.4,2.5,0047a0', CHN: 'B:de2910|s:6,5.4,3.2,ffde00', AUS: 'B:012169|s:7,14,3,ffffff|s:21,5,1.7,ffffff|s:23.5,11,1.7,ffffff|s:21,16,1.7,ffffff',
    KSA: 'B:006c35|r:6,12,18,1.6,ffffff', IRN: 'h:239f40,ffffff,da0000', QAT: 'B:8a1538|r:0,0,8,20,ffffff', UZB: 'h:0099b5,ffffff,1eb53a', IRQ: 'h:ce1126,ffffff,000000', JOR: 'h:000000,ffffff,007a3d|p:0,0,13,10,0,20,ce1126', UAE: 'h:00732f,ffffff,000000|r:0,0,8,20,ff0000',
    MAR: 'B:c1272d|s:15,10.4,4.6,006233', SEN: 'v:00853f,fdef42,e31b23|s:15,10.2,2.6,00853f', EGY: 'h:ce1126,ffffff,000000', NGA: 'v:008751,ffffff,008751', CIV: 'v:f77f00,ffffff,009e60', ALG: 'v:006233,ffffff|c:15,10,4,d21034',
    TUN: 'B:e70013|c:15,10,5.6,ffffff|c:15,10,3.6,e70013', CMR: 'v:007a5e,ce1126,fcd116|s:15,10.2,2.6,fcd116', GHA: 'h:ce1126,fcd116,006b3f|s:15,10.2,3,000000', RSA: 'h:de3831,ffffff,002395|p:0,0,13,10,0,20,007a4d',
    MLI: 'v:14b53a,fcd116,ce1126', COD: 'B:007fff|s:5,4.4,2.6,f7d618', BFA: 'h:ef2b2d,009e49|s:15,10.2,3,fcd116', CPV: 'B:003893|r:0,11,30,1,ffffff|r:0,12,30,1.7,cf2027|r:0,13.7,30,1,ffffff',
    NZL: 'B:012169|s:21,5,1.7,cc142b|s:24,10,1.7,cc142b|s:21,15,1.7,cc142b', FIJ: 'B:68bfe5|r:0,0,13,10,012169', NCL: 'h:0035ad,ed1c24,009543'
  };
  function starPath(cx, cy, r) {
    var pts = [], i; for (i = 0; i < 10; i++) { var ang = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.4 : r; pts.push((cx + Math.cos(ang) * rr).toFixed(2) + ',' + (cy + Math.sin(ang) * rr).toFixed(2)); }
    return pts.join(' ');
  }
  var flagCache = {};
  UI.flagSvg = function (code, cls) {
    var key = code + '|' + (cls || ''); if (flagCache[key]) return flagCache[key];
    var spec = F[code], out;
    if (!spec) {
      out = '<svg class="flag ' + (cls || '') + '" viewBox="0 0 30 20"><rect width="30" height="20" fill="#3a4856"/><text x="15" y="13.5" text-anchor="middle" font-size="9" font-weight="700" fill="#e9eff4" font-family="sans-serif">' + esc(code.slice(0, 3)) + '</text></svg>';
    } else {
      var body = '', parts = spec.split('|'), id = 'fc' + code;
      parts.forEach(function (s) {
        var k = s.charAt(0), a = s.slice(2).split(','), i;
        if (k === 'B') body += '<rect width="30" height="20" fill="#' + a[0] + '"/>';
        else if (k === 'h' || k === 'v') {
          var ws = a.map(function (x) { var q = x.split('*'); return [q[0], +(q[1] || 1)]; }), tot = ws.reduce(function (t, q) { return t + q[1]; }, 0), pos = 0;
          ws.forEach(function (q) { var sz = q[1] / tot * (k === 'h' ? 20 : 30); body += k === 'h' ? '<rect x="0" y="' + pos.toFixed(2) + '" width="30" height="' + (sz + 0.05).toFixed(2) + '" fill="#' + q[0] + '"/>' : '<rect x="' + pos.toFixed(2) + '" y="0" width="' + (sz + 0.05).toFixed(2) + '" height="20" fill="#' + q[0] + '"/>'; pos += sz; });
        } else if (k === 'r') body += '<rect x="' + a[0] + '" y="' + a[1] + '" width="' + a[2] + '" height="' + a[3] + '" fill="#' + a[4] + '"/>';
        else if (k === 'c') body += '<circle cx="' + a[0] + '" cy="' + a[1] + '" r="' + a[2] + '" fill="#' + a[3] + '"/>';
        else if (k === 's') body += '<polygon points="' + starPath(+a[0], +a[1], +a[2]) + '" fill="#' + a[3] + '"/>';
        else if (k === 'p') { var col = a.pop(); body += '<polygon points="' + a.join(',') + '" fill="#' + col + '"/>'; }
        else if (k === 'x') body += '<rect x="' + (15 - a[1] / 2) + '" y="0" width="' + a[1] + '" height="20" fill="#' + a[0] + '"/><rect x="0" y="' + (10 - a[1] / 2) + '" width="30" height="' + a[1] + '" fill="#' + a[0] + '"/>';
        else if (k === 'N') body += '<rect x="' + (+a[2] - a[1] / 2) + '" y="0" width="' + a[1] + '" height="20" fill="#' + a[0] + '"/><rect x="0" y="' + (10 - a[1] / 2) + '" width="30" height="' + a[1] + '" fill="#' + a[0] + '"/>';
        else if (k === 'X') body += '<path d="M0 0L30 20M30 0L0 20" stroke="#' + a[0] + '" stroke-width="' + a[1] + '"/>';
      });
      out = '<svg class="flag ' + (cls || '') + '" viewBox="0 0 30 20" role="img" aria-label="Bandera ' + esc(code) + '"><clipPath id="' + id + '"><rect width="30" height="20" rx="2"/></clipPath><g clip-path="url(#' + id + ')">' + body + '</g></svg>';
    }
    return flagCache[key] = out;
  };
  UI.flag = function (code, big) { return UI.flagSvg(code, big ? 'lg' : ''); };

  // ---------- escudos ----------
  FP.CRESTS = FP.CRESTS || {}; // slug -> ruta de imagen con licencia (p. ej. 'assets/crests/colo-colo.svg')
  var COL = {
    'Colo-Colo': ['#f2f2f2', '#141414'], 'Universidad de Chile': ['#1c3f94', '#d9262c'], 'Universidad Católica': ['#1d4fa3', '#f2f2f2'], "O'Higgins": ['#5aaee6', '#f2f2f2'], 'Palestino': ['#0b7a3b', '#d52b1e'],
    'Unión Española': ['#d42b2b', '#f2f2f2'], 'Everton de Viña del Mar': ['#f2c500', '#1b3b8a'], 'Huachipato': ['#1f4aa8', '#222222'], 'Cobresal': ['#e6791f', '#f2f2f2'], 'Audax Italiano': ['#0a7d3a', '#f2f2f2'],
    'Ñublense': ['#d52b1e', '#141414'], 'Deportes La Serena': ['#a41e22', '#f2c500'], 'Unión La Calera': ['#d52b1e', '#141414'], 'Coquimbo Unido': ['#f2c500', '#141414'], 'Universidad de Concepción': ['#f2c500', '#1b3b8a'],
    'Santiago Wanderers': ['#0a7d3a', '#f2f2f2'], 'Cobreloa': ['#e6791f', '#f2f2f2'], 'Curicó Unido': ['#d52b1e', '#f2f2f2'], 'Deportes Antofagasta': ['#6aa9e0', '#f2f2f2'], 'Deportes Santa Cruz': ['#6a2c91', '#f2f2f2'], 'Magallanes': ['#7ab8e6', '#f2f2f2'],
    'Boca Juniors': ['#0b2c70', '#f2c500'], 'River Plate': ['#f2f2f2', '#d52b1e'], 'Racing Club': ['#8fc8ef', '#f2f2f2'], 'Independiente': ['#d52b1e', '#f2f2f2'], 'San Lorenzo': ['#0b2c70', '#c4102f'], 'Estudiantes de La Plata': ['#d52b1e', '#f2f2f2'],
    'Vélez Sarsfield': ['#f2f2f2', '#0b2c70'], "Newell's Old Boys": ['#d52b1e', '#141414'], 'Rosario Central': ['#1d4fa3', '#f2c500'], 'Talleres': ['#1d3f8f', '#f2f2f2'], 'Huracán': ['#f2f2f2', '#d52b1e'], 'Lanús': ['#7a1f2b', '#f2f2f2'],
    'Flamengo': ['#d52b1e', '#141414'], 'Palmeiras': ['#0a7d3a', '#f2f2f2'], 'Corinthians': ['#f2f2f2', '#141414'], 'São Paulo': ['#d52b1e', '#f2f2f2'], 'Santos': ['#f2f2f2', '#141414'], 'Fluminense': ['#7a1f2b', '#0a7d3a'],
    'Botafogo': ['#141414', '#f2f2f2'], 'Vasco da Gama': ['#141414', '#f2f2f2'], 'Grêmio': ['#6aa9e0', '#141414'], 'Internacional': ['#d52b1e', '#f2f2f2'], 'Cruzeiro': ['#1d4fa3', '#f2f2f2'], 'Atlético Mineiro': ['#141414', '#f2f2f2'],
    'Peñarol': ['#f2c500', '#141414'], 'Nacional': ['#f2f2f2', '#1d4fa3'], 'Olimpia': ['#f2f2f2', '#141414'], 'Cerro Porteño': ['#1d4fa3', '#c4102f'], 'Atlético Nacional': ['#1a8a3c', '#f2f2f2'], 'Millonarios': ['#1d4fa3', '#f2f2f2'],
    'Universitario': ['#f4e8c8', '#8a1a1a'], 'Alianza Lima': ['#1d4fa3', '#f2f2f2'], 'LDU Quito': ['#f2f2f2', '#1d4fa3'], 'Barcelona SC': ['#f2c500', '#141414'], 'Bolívar': ['#6aa9e0', '#f2f2f2'],
    'Real Madrid': ['#f2f2f2', '#d4b04a'], 'FC Barcelona': ['#a50044', '#004d98'], 'Atlético de Madrid': ['#cb3524', '#1d4fa3'], 'Manchester City': ['#6cabdd', '#f2f2f2'], 'Manchester United': ['#da291c', '#141414'],
    'Liverpool': ['#c8102e', '#f2f2f2'], 'Arsenal': ['#ef0107', '#f2f2f2'], 'Chelsea': ['#034694', '#f2f2f2'], 'Tottenham Hotspur': ['#f2f2f2', '#132257'], 'Bayern München': ['#dc052d', '#f2f2f2'], 'Borussia Dortmund': ['#fde100', '#141414'],
    'Bayer Leverkusen': ['#e32221', '#141414'], 'Paris Saint-Germain': ['#004170', '#da291c'], 'Marseille': ['#f2f2f2', '#2faee0'], 'Juventus': ['#141414', '#f2f2f2'], 'Milan': ['#fb090b', '#141414'], 'Inter': ['#0068a8', '#141414'],
    'Napoli': ['#12a0d7', '#f2f2f2'], 'Roma': ['#8e1f2f', '#f0bc42'], 'Lazio': ['#87d8f7', '#f2f2f2'], 'Ajax': ['#d2122e', '#f2f2f2'], 'PSV Eindhoven': ['#e1000f', '#f2f2f2'], 'Feyenoord': ['#e1000f', '#f2f2f2'],
    'Benfica': ['#e30613', '#f2f2f2'], 'FC Porto': ['#0a3a8c', '#f2f2f2'], 'Sporting CP': ['#008057', '#f2f2f2'], 'Celtic': ['#16a34a', '#f2f2f2'], 'Rangers': ['#1b458f', '#f2f2f2'],
    'LAFC': ['#141414', '#c39e6d'], 'Inter Miami': ['#f7b5cd', '#141414'], 'América': ['#ffd200', '#1b3b8a'], 'Guadalajara': ['#c8102e', '#f2f2f2'], 'Cruz Azul': ['#1d4fa3', '#f2f2f2'], 'Pumas UNAM': ['#0b2c70', '#c9a227'],
    'Tigres UANL': ['#f2c500', '#1b3b8a'], 'Monterrey': ['#1b3b8a', '#f2f2f2'], 'Al-Hilal': ['#1e50a8', '#f2f2f2'], 'Al-Nassr': ['#f2c500', '#1b3b8a'], 'Al-Ahli': ['#0a7d3a', '#f2f2f2'], 'Al-Ittihad': ['#f2c500', '#141414']
  };
  function lum(hex) { var h = hex.replace('#', ''); var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 4 - 2), 16), b = parseInt(h.substr(4, 2), 16); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
  function hsl2hex(h, s, l) { s /= 100; l /= 100; var a = s * Math.min(l, 1 - l), f = function (n) { var k = (n + h / 30) % 12, c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); return Math.round(255 * c).toString(16).padStart(2, '0'); }; return '#' + f(0) + f(8) + f(4); }
  UI.clubColors = function (name) {
    if (COL[name]) return COL[name];
    var h = U.hash(name) % 360;
    return [hsl2hex(h, 52, 36), hsl2hex((h + 28) % 360, 45, 72)];
  };
  UI.slug = function (s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
  function initials(nm) {
    var words = nm.replace(/\(.*?\)/g, '').replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9' ]/g, ' ').split(/\s+/).filter(function (w) { return w && !/^(de|del|la|el|los|y|FC|CD|SC|CF|AC|AS|Club|Deportes?)$/i.test(w); });
    return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || nm).slice(0, 2)).toUpperCase();
  }
  var crestCache = {};
  UI.crestSvg = function (name) {
    if (crestCache[name]) return crestCache[name];
    var slug = UI.slug(name), cs = UI.clubColors(name), c1 = cs[0], c2 = cs[1], hh = U.hash(name), pat = hh % 6, id = 'cr' + hh;
    var path = 'M6 4h52v34c0 17-12 26-26 31C18 64 6 55 6 38z', body;
    switch (pat) {
      case 1: body = '<rect width="32" height="72" fill="' + c1 + '"/><rect x="32" width="32" height="72" fill="' + c2 + '"/>'; break;
      case 2: body = '<rect width="64" height="72" fill="' + c1 + '"/><rect y="27" width="64" height="16" fill="' + c2 + '"/>'; break;
      case 3: body = '<rect width="64" height="72" fill="' + c1 + '"/><rect x="12" width="9" height="72" fill="' + c2 + '"/><rect x="29" width="9" height="72" fill="' + c2 + '"/><rect x="46" width="9" height="72" fill="' + c2 + '"/>'; break;
      case 4: body = '<rect width="64" height="72" fill="' + c1 + '"/><polygon points="6,34 32,52 58,34 58,48 32,66 6,48" fill="' + c2 + '"/>'; break;
      case 5: body = '<rect width="64" height="72" fill="' + c1 + '"/><polygon points="64,0 64,72 0,72" fill="' + c2 + '"/>'; break;
      default: body = '<rect width="64" height="72" fill="' + c1 + '"/>';
    }
    var ink = (pat === 1 || pat === 3 || pat === 5) ? (lum(c1) > 0.55 ? '#111' : '#fff') : (lum(c1) > 0.55 ? '#111' : '#fff'), halo = ink === '#fff' ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.6)';
    var svg = '<svg class="crest" viewBox="0 0 64 72" role="img" aria-label="Escudo de ' + esc(name) + '"><defs><clipPath id="' + id + '"><path d="' + path + '"/></clipPath><linearGradient id="g' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient></defs><g clip-path="url(#' + id + ')">' + body + '<rect width="64" height="72" fill="url(#g' + id + ')"/></g><path d="' + path + '" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2.2"/><text x="32" y="43" text-anchor="middle" font-size="' + (initials(name).length > 2 ? 17 : 20) + '" font-weight="800" fill="' + ink + '" stroke="' + halo + '" stroke-width="2.6" paint-order="stroke" font-family="Bahnschrift,Segoe UI,Inter,sans-serif" letter-spacing=".5">' + esc(initials(name)) + '</text></svg>';
    return crestCache[name] = { svg: svg, slug: slug };
  };
  // sizes: undefined=pequeño, 'lg', 'xl'
  UI.crest = function (id, size) {
    if (typeof size === 'number' || size === true) size = 'lg';
    var cls = size ? ' ' + size : '';
    if (id != null && id >= 5000 && id < 20000) { var n = C.team(id); return n ? UI.flagSvg(n.c, size ? 'lg' : '').replace('class="flag ', 'class="flag crest-flag ') : ''; }
    var nm = C.tname(id) || '?';
    var base = id >= 30000 && FP.S.clubs[id - 30000] ? FP.S.clubs[id - 30000].nm : nm;
    var c = UI.crestSvg(base), img = FP.CRESTS[c.slug];
    if (img) return '<span class="crest' + cls + '"><img src="' + esc(img) + '" alt="Escudo de ' + esc(base) + '"></span>';
    return c.svg.replace('class="crest"', 'class="crest' + cls + '"');
  };
  UI.crestName = function (nm, size) { var c = UI.crestSvg(nm), img = FP.CRESTS[c.slug], cls = size ? ' ' + size : ''; return img ? '<span class="crest' + cls + '"><img src="' + esc(img) + '" alt=""></span>' : c.svg.replace('class="crest"', 'class="crest' + cls + '"'); };
  UI.clubC = function (id) { return UI.crest(id) + UI.club(id); };

  // ---------- avatar del futbolista ----------
  var SKIN = ['#f3cdae', '#e6b48f', '#d19a73', '#b27850', '#8a5a3b', '#63402a'], HAIR = ['#14100c', '#2a1b10', '#4a2f1b', '#7a5230', '#b58a4a', '#d8c07a', '#8d8d8d'];
  UI.avatar = function (h, cls, colors) {
    var seed = U.hash(h.nm, h.nat, h.b), r = U.mulberry(seed);
    var skin = SKIN[Math.floor(r() * SKIN.length)], hair = HAIR[Math.floor(r() * HAIR.length)], style = Math.floor(r() * 5), beard = 0, av = h.av;
    if (av) {
      if (av.skin != null && SKIN[av.skin]) skin = SKIN[av.skin];
      if (av.hair != null && HAIR[av.hair]) hair = HAIR[av.hair];
      if (av.style != null && av.style >= 0 && av.style <= 15) style = av.style;
      beard = av.beard || 0;
    }
    var c = colors || UI.heroColors(), id = 'av' + (seed % 99999);
    var skinD = skin, hairS = {
      0: '<path d="M30 42C27 22 41 13 50 13c10 0 23 9 20 29-4-9-11-13-20-13s-16 4-20 13z" fill="' + hair + '"/>',
      1: '<path d="M32 40c0-14 9-21 18-21s18 7 18 21c-4-7-10-10-18-10s-14 3-18 10z" fill="' + hair + '"/>',
      2: '<g fill="' + hair + '"><circle cx="34" cy="30" r="9"/><circle cx="45" cy="22" r="10"/><circle cx="57" cy="22" r="10"/><circle cx="67" cy="31" r="9"/><circle cx="50" cy="30" r="12"/></g>',
      3: '<path d="M28 44C24 20 43 11 54 13c14 3 21 16 18 31-3-10-10-16-22-16-9 0-17 5-22 16z" fill="' + hair + '"/><path d="M30 38c8-4 17-8 26-9-6 4-14 7-26 9z" fill="' + hair + '"/>',
      4: '<path d="M28 46C23 20 41 10 51 10c12 0 26 9 21 36-1 6-3 12-5 14l-3-18c-4-6-10-9-16-9s-12 3-16 9l-3 18c-2-2-4-8-1-14z" fill="' + hair + '"/>',
      5: '<path d="M31 38c1-13 9-19 19-19s18 6 19 19c-5-6-11-9-19-9s-14 3-19 9z" fill="' + hair + '" opacity=".55"/>',
      6: '',
      7: '<g fill="' + hair + '"><circle cx="50" cy="20" r="17"/><circle cx="31" cy="30" r="9"/><circle cx="69" cy="30" r="9"/><circle cx="37" cy="17" r="12"/><circle cx="63" cy="17" r="12"/></g>',
      8: '<path d="M44 27C43 9 47 3 50 3s7 6 6 24z" fill="' + hair + '"/><path d="M31 38c1-13 9-19 19-19s18 6 19 19c-5-6-11-9-19-9s-14 3-19 9z" fill="' + hair + '" opacity=".45"/>',
      9: '<path d="M30 42C27 22 41 13 50 13c10 0 23 9 20 29-4-9-11-13-20-13s-16 4-20 13z" fill="' + hair + '"/><path d="M31 32v26M36 28v24M64 28v24M69 32v26" stroke="' + hair + '" stroke-width="4.2" stroke-linecap="round" fill="none"/>',
      10: '<path d="M32 40c0-14 9-21 18-21s18 7 18 21c-4-7-10-10-18-10s-14 3-18 10z" fill="' + hair + '"/><circle cx="50" cy="12" r="7.5" fill="' + hair + '"/>',
      11: '<path d="M30 42c-3-18 8-27 20-27s23 9 20 27c-2-7-5-12-8-15-8 3-24 3-24 3-5 3-6 8-8 12z" fill="' + hair + '"/><path d="M38 22q12-6 24 0" stroke="rgba(255,255,255,.18)" stroke-width="1.6" fill="none"/>',
      12: '<path d="M29 44C26 22 38 13 50 13s24 9 21 31c-1-8-2-13-4-15-10 5-24 5-34 0-2 2-3 7-4 15z" fill="' + hair + '"/>',
      13: '<path d="M30 42C27 22 41 13 50 13c10 0 23 9 20 29-4-9-11-13-20-13s-16 4-20 13z" fill="' + hair + '"/><path d="M68 28c11 2 15 15 8 31-1-9-3-13-8-17z" fill="' + hair + '"/>',
      14: '<path d="M32 40c0-14 9-21 18-21s18 7 18 21c-4-7-10-10-18-10s-14 3-18 10z" fill="' + hair + '"/><path d="M30 40c-5 8-5 20 0 27 2-8 3-17 3-25zM70 40c5 8 5 20 0 27-2-8-3-17-3-25z" fill="' + hair + '"/>',
      15: '<path d="M32 38c1-10 8-16 18-16s17 6 18 16c-3-5-6-8-10-9l-3 5-5-6-5 6-3-5c-4 1-7 4-10 9z" fill="' + hair + '"/>'
    }[style];
    var bd = '<path d="M31 46c0 14 8 22 19 22s19-8 19-22c-3 6-7 8-11 8h-16c-4 0-8-2-11-8z" fill="' + hair + '" opacity="BO"/>';
    var beardS = [
      '',
      bd.replace('BO', '.35'),
      '<path d="M30 44c0 18 9 27 20 27s20-9 20-27c-3 6-6 9-10 9h-20c-4 0-7-3-10-9z" fill="' + hair + '"/>',
      '<path d="M41 52q9-4 18 0q-9 3-18 0z" fill="' + hair + '"/>'
    ][beard] || '';
    return '<svg viewBox="0 0 100 100" role="img" aria-label="Avatar de ' + esc(h.nm) + '"><defs><linearGradient id="bg' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c[0] + '" stop-opacity=".95"/><stop offset="1" stop-color="#0c1418"/></linearGradient><radialGradient id="sh' + id + '" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="100" height="100" fill="url(#bg' + id + ')"/><rect width="100" height="100" fill="url(#sh' + id + ')"/>' +
      '<path d="M8 100c2-20 16-27 31-30h22c15 3 29 10 31 30z" fill="' + c[0] + '"/><path d="M8 100c2-20 16-27 31-30h22c15 3 29 10 31 30z" fill="rgba(0,0,0,.18)"/><path d="M39 70l11 14 11-14z" fill="' + c[1] + '"/>' +
      '<rect x="43" y="56" width="14" height="18" rx="6" fill="' + skinD + '"/><rect x="43" y="56" width="14" height="8" fill="rgba(0,0,0,.14)"/>' +
      '<ellipse cx="50" cy="42" rx="19" ry="22" fill="' + skin + '"/><ellipse cx="31" cy="44" rx="3.2" ry="5" fill="' + skin + '"/><ellipse cx="69" cy="44" rx="3.2" ry="5" fill="' + skin + '"/>' + hairS + beardS +
      '<ellipse cx="43" cy="44" rx="1.9" ry="2.3" fill="#1a1410"/><ellipse cx="57" cy="44" rx="1.9" ry="2.3" fill="#1a1410"/><path d="M39 39.5q4-2.4 8 0M53 39.5q4-2.4 8 0" stroke="rgba(20,14,10,.55)" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M46 56q4 2.6 8 0" stroke="rgba(60,25,15,.6)" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>';
  };
  // valores efectivos del avatar (sorteo por semilla + ajustes del jugador)
  UI.avResolve = function (h) {
    var r = U.mulberry(U.hash(h.nm, h.nat, h.b)), o = { skin: Math.floor(r() * SKIN.length), hair: Math.floor(r() * HAIR.length), style: Math.floor(r() * 5), beard: 0 }, a = h.av || {};
    ['skin', 'hair', 'style', 'beard'].forEach(function (k) { if (a[k] != null) o[k] = a[k]; });
    return o;
  };
  UI.avRandom = function () { return { skin: Math.floor(Math.random() * SKIN.length), hair: Math.floor(Math.random() * HAIR.length), style: Math.floor(Math.random() * 16), beard: Math.random() < .25 ? 1 + Math.floor(Math.random() * 3) : 0 }; };
  // editor de apariencia: act = acción que recibe data-k / data-v
  UI.avEditor = function (h, act, colors) {
    var c = UI.avResolve(h), st = ['Corto', 'Fade', 'Rizado', 'Largo lateral', 'Melena', 'Rapado', 'Calvo', 'Afro', 'Mohicano', 'Trenzas', 'Moño', 'Engominado', 'Flequillo', 'Coleta', 'Mullet', 'Entradas'], bd = ['Sin barba', 'Barba corta', 'Barba completa', 'Bigote'];
    function sw(k, arr) { return arr.map(function (col, i) { return '<button type="button" class="av-sw' + (c[k] === i ? ' on' : '') + '" style="background:' + col + '" data-act="' + act + '" data-k="' + k + '" data-v="' + i + '" aria-label="' + k + ' ' + (i + 1) + '"></button>'; }).join(''); }
    function ch(k, arr) { return arr.map(function (n, i) { return '<button type="button" class="btn sm' + (c[k] === i ? ' pri' : '') + '" data-act="' + act + '" data-k="' + k + '" data-v="' + i + '">' + n + '</button>'; }).join(''); }
    return '<div class="av-ed"><div class="av-pv">' + UI.avatar(h, '', colors) + '</div><div class="av-ctl">' +
      '<div class="av-row"><span>Tono de piel</span><div>' + sw('skin', SKIN) + '</div></div>' +
      '<div class="av-row"><span>Color de pelo</span><div>' + sw('hair', HAIR) + '</div></div>' +
      '<div class="av-row"><span>Peinado</span><div class="btn-group">' + ch('style', st) + '</div></div>' +
      '<div class="av-row"><span>Barba</span><div class="btn-group">' + ch('beard', bd) + '</div></div>' +
      '<div class="av-row"><button type="button" class="btn sm" data-act="' + act + '" data-k="rnd">Aleatorio</button></div></div></div>';
  };
  UI.heroColors = function () {
    var h = FP.S.hero, nm = h.club != null ? C.tname(h.club) : (h.team != null ? C.tname(h.team) : null);
    if (h.tk === 'academy' || h.tk === 'pro' || h.tk === 'loan') return UI.clubColors(nm);
    if (nm) return UI.clubColors(nm);
    return ['#1f6f7a', '#e9eff4'];
  };

  // ---------- medidores ----------
  var TIER = [[88, '#d9b44a', '#f3d77a'], [80, '#28b59a', '#58d8bd'], [72, '#46c273', '#7fe0a0'], [64, '#a8d35a', '#cdea8a'], [55, '#e2b93b', '#f3d472'], [46, '#e8833a', '#f4a870'], [0, '#e5545a', '#f58d91']];
  UI.tier = function (v) { for (var i = 0; i < TIER.length; i++) if (v >= TIER[i][0]) return TIER[i]; return TIER[6]; };
  UI.ovrHex = function (v, size, label) {
    v = Math.round(v); var t = UI.tier(v), id = 'oh' + v + size;
    return '<div class="ovr-hex" style="width:' + size + 'px;height:' + Math.round(size * 1.08) + 'px"><svg viewBox="0 0 100 108" width="' + size + '" height="' + Math.round(size * 1.08) + '"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + t[2] + '"/><stop offset="1" stop-color="' + t[1] + '"/></linearGradient></defs><path d="M50 3l43 15v50c0 18-20 30-43 37C27 98 7 86 7 68V18z" fill="url(#' + id + ')"/><path d="M50 8l38 13v46c0 15-17 26-38 32C29 93 12 82 12 67V21z" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.6"/><text x="50" y="62" text-anchor="middle" font-size="40" font-weight="800" fill="#0b1117" font-family="Bahnschrift,Segoe UI,Inter,sans-serif">' + v + '</text><text x="50" y="82" text-anchor="middle" font-size="11" font-weight="700" letter-spacing="2" fill="rgba(11,17,23,.7)">' + (label || 'MEDIA') + '</text></svg></div>';
  };
  UI.ring = function (pct, label, val, color) {
    pct = Math.max(0, Math.min(100, pct)); var c = 2 * Math.PI * 28;
    return '<div class="ring"><svg viewBox="0 0 70 70"><circle cx="35" cy="35" r="28" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="7"/><circle cx="35" cy="35" r="28" fill="none" stroke="' + color + '" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + (c * pct / 100).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 35 35)"/><text x="35" y="40" text-anchor="middle" font-size="17" font-weight="750" fill="#e9eff4" font-family="Bahnschrift,Segoe UI,Inter,sans-serif">' + val + '</text></svg><div class="rl">' + label + '</div></div>';
  };
  UI.rateRing = function (v) {
    var c = 2 * Math.PI * 45, pct = Math.max(0, Math.min(1, (v - 3) / 7)), col = v >= 7.5 ? '#2fbf71' : v >= 6.5 ? '#46aabd' : v >= 5.5 ? '#e2a93b' : '#e5545a';
    return '<div class="rate-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="8"/><circle cx="50" cy="50" r="45" fill="none" stroke="' + col + '" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + (c * pct).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 50 50)"/></svg><div class="rv" style="color:' + col + '">' + v.toFixed(1) + '</div></div>';
  };
  UI.valColor = function (v) { var t = UI.tier(v); return t[1]; };
})();
