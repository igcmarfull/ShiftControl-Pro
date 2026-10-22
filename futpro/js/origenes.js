/* FUTPRO — de dónde vienen los extranjeros de cada liga.
   Antes los extranjeros se elegían por nivel de selección en todo el mundo: aparecían estadounidenses o burkineses en un club chileno.
   Ahora cada nacionalidad pesa según su cercanía con el país del club: misma región futbolística, idioma o vínculo histórico (España–Latinoamérica,
   Portugal–Brasil y Cabo Verde, Francia–Magreb y África francófona, Inglaterra–Commonwealth), mismo continente y, solo en las ligas
   ricas, el resto del mundo. Los pesos son supuestos de diseño; no cambia cuántos extranjeros hay (Core.foreignP) ni el uso del azar. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, R = U.R;
  var O = FP.Origenes = {};

  O.GROUPS = [
    ['ARG', 'URU', 'PAR', 'CHI', 'BOL', 'BRA'], ['COL', 'VEN', 'ECU', 'PER'], ['MEX', 'USA', 'CAN', 'CRC', 'PAN', 'HON', 'GUA', 'SLV', 'JAM', 'HAI', 'CUW'],
    ['ESP', 'POR', 'FRA', 'ITA'], ['ENG', 'SCO', 'WAL', 'IRL'], ['GER', 'AUT', 'SUI', 'NED', 'BEL', 'DEN', 'NOR', 'SWE', 'FIN', 'ISL'],
    ['HRV', 'SRB', 'BUL', 'ROU', 'HUN', 'SVK', 'CZE', 'POL', 'UKR', 'RUS', 'GRE', 'TUR', 'CYP', 'ISR'],
    ['MAR', 'ALG', 'TUN', 'EGY'], ['SEN', 'NGA', 'CIV', 'CMR', 'GHA', 'MLI', 'COD', 'BFA', 'CPV'], ['JPN', 'KOR', 'CHN', 'THA', 'IND', 'AUS', 'NZL'], ['KSA', 'QAT', 'UAE', 'IRN', 'IRQ', 'JOR', 'UZB']
  ];
  // vínculos de idioma o historia (en ambos sentidos)
  O.LINKS = [
    [['ESP'], ['ARG', 'URU', 'COL', 'CHI', 'PAR', 'ECU', 'PER', 'VEN', 'BOL', 'MEX', 'CRC', 'PAN', 'HON', 'GUA', 'SLV']],
    [['POR'], ['BRA', 'CPV']], [['FRA'], ['MAR', 'ALG', 'TUN', 'SEN', 'CIV', 'CMR', 'MLI', 'COD', 'BFA', 'HAI']],
    [['ENG'], ['JAM', 'NGA', 'GHA', 'AUS', 'IRL', 'USA']], [['ITA'], ['ARG', 'URU', 'BRA']], [['NED'], ['CUW']],
    [['ARG', 'URU', 'COL', 'CHI', 'PAR', 'ECU', 'PER', 'VEN', 'BOL', 'MEX', 'ESP'], ['ARG', 'URU', 'COL', 'CHI', 'PAR', 'ECU', 'PER', 'VEN', 'BOL', 'MEX', 'ESP']]
  ];
  var grp = {}; O.GROUPS.forEach(function (g, i) { g.forEach(function (c) { grp[c] = i; }); });
  function linked(a, b) { return O.LINKS.some(function (l) { return (l[0].indexOf(a) >= 0 && l[1].indexOf(b) >= 0) || (l[0].indexOf(b) >= 0 && l[1].indexOf(a) >= 0); }); }
  // cuánto pesa un país de origen para un club de ese país: multiplicador sobre su nivel futbolístico
  O.affinity = function (dest, from, rich) {
    if (grp[dest] != null && grp[dest] === grp[from]) return rich ? 4 : 10;       // las ligas ricas fichan en todo el mundo: la cercanía pesa menos
    if (linked(dest, from)) return rich ? 4 : 6;
    var cd = FP.DATA.countries[dest], cf = FP.NATBY && FP.NATBY[from];
    if (cd && cf && cd.conf === cf.conf) return 1.5;
    return rich ? 1 : 0.002;     // una liga modesta casi no recibe jugadores de otros continentes
  };

  // mismo uso del azar que la versión original (una tirada para «misma confederación» y una para elegir), solo cambian los pesos
  C.foreignNat = function (club) {
    var conf = FP.DATA.countries[club.c].conf, pool = FP.S.natPool, rich = C.foreignP(club.c) >= 0.3, same = R() < 0.65;
    var arr = pool.filter(function (n) { return n.c !== club.c && (same ? n.conf === conf : true); });
    return U.wpick(arr, function (n) { return Math.exp(n.r / 14) * O.affinity(club.c, n.c, rich); }).c;
  };

  // los agentes libres: un club de una liga modesta prefiere a quien viene de un país cercano (la elección sigue siendo por nivel; se descartan los de países lejanos)
  var Sim = FP.Sim;
  if (Sim && Sim.pickFreeAgent) Sim.pickFreeAgent = function (club, pos) {
    var lg = FP.LGDEF[club.lg], mu = lg.q + club.ra, best = null, bv = -1, tries = 0, rich = C.foreignP(club.c) >= 0.3, pool = Sim.faPool();
    for (var i = 0; i < pool.length && tries < 400; i++, tries++) {
      var p = pool[i]; if (p.c !== -1 || p.p !== pos) continue;
      if (p.o < mu - 8 || p.o > mu + 4) continue;
      if (p.nat && p.nat !== club.c && O.affinity(club.c, p.nat, rich) < 1) continue;       // un club modesto no ficha a un agente libre de un país lejano
      var v = p.o + R() * 3;
      if (v > bv) { bv = v; best = p; }
    }
    return best;
  };

  // fichajes entre clubes de la IA: un club de una liga modesta casi no ficha a quien viene de un país lejano
  var Rep = FP.Rep;
  if (Rep && Rep.aiForeignOK) {
    var ok0 = Rep.aiForeignOK;
    Rep.aiForeignOK = function (club, p) {
      if (p && p.nat && p.nat !== club.c && C.foreignP(club.c) < 0.3 && O.affinity(club.c, p.nat, false) < 1 && R() < 0.97) return false;
      return ok0.apply(this, arguments);
    };
  }
})();
