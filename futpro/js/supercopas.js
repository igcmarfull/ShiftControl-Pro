/* FUTPRO — supercopas nacionales: al empezar cada temporada, el campeón de liga y el campeón de copa del año anterior juegan un partido
   (si son el mismo club, enfrenta al subcampeón de liga). Se crea como una copa de un solo partido; la lista de países es de memoria. */
(function () {
  'use strict';
  var FP = window.FP, Comp = FP.Comp, Sim = FP.Sim, D = FP.Date;
  var Su = FP.Supercopas = {};
  Su.NAMES = { ENG: 'Community Shield', ESP: 'Supercopa de España', ITA: 'Supercoppa Italiana', GER: 'Supercopa de Alemania', FRA: 'Trophée des Champions', POR: 'Supertaça Cândido de Oliveira', NED: 'Johan Cruyff Shield', BEL: 'Supercopa de Bélgica',
    TUR: 'Süper Kupa', RUS: 'Supercopa de Rusia', UKR: 'Supercopa de Ucrania', POL: 'Superpuchar Polski', ROU: 'Supercupa României', GRE: 'Supercopa de Grecia', ARG: 'Supercopa Argentina', CHI: 'Supercopa de Chile', BRA: 'Supercopa do Brasil', URU: 'Supercopa Uruguaya', COL: 'Superliga Colombiana', MEX: 'Campeón de Campeones', JPN: 'Supercopa de Japón' };
  Su.NEUTRAL = { ENG: 1, ESP: 1, ITA: 1, FRA: 1, POR: 1, ARG: 1, JPN: 1 };
  Su.create = function (cc) {
    var S = FP.S, nm = Su.NAMES[cc], cdef = FP.DATA.countries[cc]; if (!nm || !cdef) return null;
    var top = FP.DATA.leagues.filter(function (l) { return l.c === cc && l.t === 1; })[0]; if (!top || !S.lgs[top.id]) return null;
    var champs = S.hist.champs || [], lgE = null, cupE = null, i;
    for (i = champs.length - 1; i >= 0 && !(lgE && cupE); i--) { var e = champs[i]; if (!lgE && e.k === 'lg' && e.lg === top.id) lgE = e; if (!cupE && e.k === 'cup' && e.cc === cc && e.nm === cdef.cup) cupE = e; }
    if (!lgE || !cupE || lgE.ch == null || cupE.ch == null) return null;
    var a = lgE.ch, b = cupE.ch === a ? lgE.ru : cupE.ch; if (b == null || a === b || a >= 5000 || b >= 5000) return null;
    var y = S.lgs[top.id].y, wn = Comp.window(top.cal, y), w = wn.s - 1; while (Comp.isIntl(w)) w--;
    var id = 'C:' + cc + ':sup:' + y; if (S.comps[id]) return null;
    var comp = Comp.create({ id: id, kind: 'C', nm: nm, y: y, teams: [a, b], c: cc });
    comp.stages = [{ k: 'ko' }]; comp.w0 = w; comp.w1 = w; comp.label = top.cal === 'euro' ? (y + '/' + String(y + 1).slice(2)) : String(y); comp.cal = top.cal; comp.sup = 1;
    Comp.koInit(comp, [a, b], { legs: 1, weeks: [w], neutralFinal: !!Su.NEUTRAL[cc], names: ['Final'] });
    return comp;
  };
  var or0 = Sim.onRollover;
  Sim.onRollover = function (cc) { if (or0) or0(cc); try { Su.create(cc); } catch (e) { if (window.console) console.warn('supercopas', e); } };
})();
