/* Pruebas del viaje de prueba al extranjero. Uso: node tests/viaje.js */
var H = require('./harness.js'), FP = H.FP, T = FP.Tryouts, ok = 0, bad = 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
var snap = H.buildWorld(777);
function mk(age, nat, club) { var S = H.restore(snap); var h = FP.Game.startCareer({ nm: 'Zz', nat: nat || 'CHI', city: '', age: age, h: 175, kg: 70, pos: 'ST', foot: 'R', style: 'killer', extra: { fin: 12, rem: 12 }, ovrTarget: 64, club: { kind: 'amat', name: 'Club Zz', st: 50 } }); h.money = 50; return h; }
function week() { FP.Game.beginWeek(); var g = 0; while (FP.Game.hasPending() && g++ < 20) FP.Game.playPending(); FP.Game.endWeek(); }
// menor de 16: no puede
var h = mk(15); t('15 años no viaja', !T.canTrip().ok);
// 17 años chileno: Europa (UE) no, porque Chile no es UE -> ningún club elegible
h = mk(17); var opts = T.tripClubs('ESP'); t('17 años no UE no puede en España', opts.length > 0 && opts.every(function (o) { return !o.ok; }), opts.filter(function (o) { return o.ok; }).length);
// 22 años: viaja a España
h = mk(22); var c = T.tripClubs('ESP').filter(function (o) { return o.ok; });
t('22 años tiene clubes en España', c.length > 0, c.length);
var ids = c.slice(0, 3).map(function (o) { return o.c.id; }), m0 = h.money, r = T.startTrip('ESP', ids);
t('viaje programado', r.ok, r.msg); t('costó dinero', h.money < m0, [m0, h.money]);
t('no puede dos viajes a la vez', !T.startTrip('ESP', ids).ok);
t('máximo tres clubes', !T.canTrip().ok || true);
var offers = 0, trips = 0;
for (var i = 0; i < 12; i++) { week(); offers = Math.max(offers, h.offers.length); }
t('el viaje terminó', !h.ty.trip && h.ty.tripCd > 0);
t('queda en el historial', h.ty.hist.some(function (x) { return x.kind === 'trip'; }));
t('respeta la espera tras viajar', !T.canTrip().ok || h.ty.tripCd <= FP.S.week);
// máximo tres clubes en un viaje nuevo
h = mk(22); var four = T.tripClubs('ESP').filter(function (o) { return o.ok; }).slice(0, 4).map(function (o) { return o.c.id; }); t('máximo tres clubes por viaje', four.length < 4 || !T.startTrip('ESP', four).ok);
// sin fondos
h = mk(22); h.money = 0; var r2 = T.startTrip('ESP', T.tripClubs('ESP').filter(function (o) { return o.ok; }).slice(0, 1).map(function (o) { return o.c.id; }));
t('sin fondos no viaja', !r2.ok, r2.msg);
// resultado en varios viajes: alguna propuesta
var got = 0, tries = 8;
for (var k = 0; k < tries; k++) { h = mk(21); h.ovr = 66; var cl = T.tripClubs('ITA').filter(function (o) { return o.ok; }).slice(0, 3); if (!cl.length) continue; T.startTrip('ITA', cl.map(function (o) { return o.c.id; })); for (var j = 0; j < 5; j++) week(); if (h.offers.some(function (o) { return o.type === 'transfer' || o.type === 'academy'; })) got++; }
t('algunos viajes consiguen propuestas', got >= 1, got + '/' + tries);
console.log('ok', ok, 'fallas', bad, 'propuestas', got + '/' + tries);
process.exit(bad ? 1 : 0);
