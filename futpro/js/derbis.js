/* FUTPRO — clásicos y derbis (pares curados de memoria, solo entre clubes del mismo país): suben la intensidad del partido
   (más tarjetas, algo más de importancia y de ventaja local). No es una lista exhaustiva ni oficial. */
(function () {
  'use strict';
  var FP = window.FP;
  var Dr = FP.Derbis = {};
  Dr.PAIRS = [['Manchester United', 'Manchester City'], ['Liverpool', 'Everton'], ['Arsenal', 'Tottenham Hotspur'], ['Newcastle United', 'Sunderland'], ['Aston Villa', 'Birmingham City'], ['West Ham United', 'Millwall'], ['Manchester United', 'Liverpool'],
    ['Real Madrid', 'FC Barcelona'], ['Real Madrid', 'Atlético de Madrid'], ['Sevilla', 'Real Betis'], ['Athletic Club', 'Real Sociedad'], ['Espanyol', 'FC Barcelona'],
    ['Inter', 'Milan'], ['Roma', 'Lazio'], ['Juventus', 'Torino'], ['Genoa', 'Sampdoria'], ['Inter', 'Juventus'],
    ['Borussia Dortmund', 'Schalke 04'], ['Hamburger SV', 'Werder Bremen'], ['Bayern München', 'Borussia Dortmund'], ['Bayern München', '1860 München'],
    ['Paris Saint-Germain', 'Marseille'], ['Lyon', 'Saint-Étienne'], ['Lille', 'Lens'],
    ['Benfica', 'Sporting CP'], ['Benfica', 'FC Porto'], ['FC Porto', 'Sporting CP'], ['Ajax', 'Feyenoord'], ['Ajax', 'PSV Eindhoven'], ['Celtic', 'Rangers'],
    ['Galatasaray', 'Fenerbahçe'], ['Fenerbahçe', 'Beşiktaş'], ['Galatasaray', 'Beşiktaş'], ['Olympiacos', 'Panathinaikos'],
    ['Boca Juniors', 'River Plate'], ['Independiente', 'Racing Club'], ["Newell's Old Boys", 'Rosario Central'],
    ['Flamengo', 'Fluminense'], ['Corinthians', 'Palmeiras'], ['São Paulo', 'Corinthians'], ['Grêmio', 'Internacional'], ['Atlético Mineiro', 'Cruzeiro'],
    ['Colo-Colo', 'Universidad de Chile'], ['Universidad Católica', 'Universidad de Chile'], ['Colo-Colo', 'Universidad Católica'], ['Deportes Concepción', 'Universidad de Concepción'],
    ['Peñarol', 'Nacional'], ['Millonarios', 'Independiente Santa Fe'], ['Atlético Nacional', 'Independiente Medellín'], ['Barcelona SC', 'Emelec'], ['Universitario', 'Alianza Lima'],
    ['América', 'Guadalajara'], ['América', 'Cruz Azul'], ['Pumas UNAM', 'América']];
  var cache = null, cacheS = null;
  function build() {
    var S = FP.S, by = {}, set = {}; S.clubs.forEach(function (c) { (by[c.nm] = by[c.nm] || []).push(c); });
    Dr.PAIRS.forEach(function (p) {
      (by[p[0]] || []).forEach(function (a) { (by[p[1]] || []).forEach(function (b) { if (a.c === b.c && a.id !== b.id) { set[a.id + '|' + b.id] = 1; set[b.id + '|' + a.id] = 1; } }); });
    });
    cache = set; cacheS = S;
  }
  Dr.is = function (a, b) { if (!FP.S) return false; if (!cache || cacheS !== FP.S || FP.S.clubs.length !== cacheN) { build(); cacheN = FP.S.clubs.length; } return !!cache[a + '|' + b]; };
  var cacheN = -1;
  Dr.migrate = function () { cache = null; };
})();
