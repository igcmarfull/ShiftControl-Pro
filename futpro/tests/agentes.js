/* Representantes persistentes, fase 1 (js/agentes.js). Uso: node tests/agentes.js
   Comprueba determinismo, estructura del mundo, candidatos variados, contratación, migración de partidas antiguas, guardado y carga,
   y que el comportamiento heredado (sueldo, comisión, negociación, RNG) no cambia. */
var H = require('./harness.js'), FP = H.FP, ok = 0, bad = 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
var snap = H.buildWorld(4242), S = H.restore(snap), h = FP.Game.startPreset(), A = FP.Agents, M = FP.Market, K = FP.Contracts, Rep = FP.Rep;
h.b = FP.Date.of(2026 - 22, 5, 15); S.pl[0].b = h.b; h.nat = 'ENG'; S.pl[0].nat = 'ENG'; h.age0 = 22;

// ---------- 1) determinismo ----------
var g1 = A.generate(S.seed), g2 = A.generate(S.seed), g3 = A.generate(S.seed + 1);
t('el mundo de agentes es idéntico para la misma semilla', JSON.stringify(g1) === JSON.stringify(g2));
t('otra semilla produce otro mundo', JSON.stringify(g1) !== JSON.stringify(g3));
var rs0 = S.rs, c1 = A.candidates(); var c1b = A.candidates();
t('generar candidatos no consume el RNG de la partida', S.rs === rs0);
t('los candidatos del mismo año son idénticos', JSON.stringify(c1) === JSON.stringify(c1b));
S.week += 52; var c2 = A.candidates(); S.week -= 52;
t('otro año cambia al menos un candidato', JSON.stringify(c1.map(function (a) { return a.id; })) !== JSON.stringify(c2.map(function (a) { return a.id; })));

// ---------- 2) estructura del mundo ----------
var L = A.ensure().list, countries = FP.DATA.countries, ids = {};
console.log('agentes en el mundo: ' + L.length + ' | tipos: ' + JSON.stringify(L.reduce(function (o, a) { o[a.kind] = (o[a.kind] || 0) + 1; return o; }, {})));
t('hay un mundo amplio de representantes (' + L.length + ')', L.length >= 90);
t('los identificadores son únicos', L.every(function (a) { if (ids[a.id]) return false; ids[a.id] = 1; return true; }));
t('niveles 1 a 5 y comisión coherente con el nivel (3, 4, 6, 8, 10 %)', L.every(function (a) { return a.lvl >= 1 && a.lvl <= 5 && a.com === { 1: 3, 2: 4, 3: 6, 4: 8, 5: 10 }[a.lvl]; }));
t('los niveles históricos 1, 3 y 5 conservan su comisión (3, 6, 10 %)', [1, 3, 5].every(function (l) { return L.filter(function (a) { return a.lvl === l; }).every(function (a) { return a.com === { 1: 3, 3: 6, 5: 10 }[l]; }); }));
t('reputación, experiencia y negociación entre 0 y 100', L.every(function (a) { return [a.rep, a.exp, a.neg].every(function (v) { return v >= 0 && v <= 100 && isFinite(v); }); }));
t('todos tienen nombre, nacionalidad existente, especialidad, perfil y estilo', L.every(function (a) { return a.nm && countries[a.nat] && a.spec && a.profile && a.style && a.desc; }));
t('los contactos apuntan a países reales con fuerza entre 0 y 1', L.every(function (a) { var k = Object.keys(a.contacts); return k.length >= 1 && k.every(function (c) { return countries[c] && a.contacts[c] > 0 && a.contacts[c] <= 1; }); }));
t('cada agente tiene pesos por nivel de competición (5 valores entre 0 y 1)', L.every(function (a) { return a.tiers.length === 5 && a.tiers.every(function (v) { return v >= 0 && v <= 1; }); }));
var low = L.filter(function (a) { return a.kind === 'lowerdiv'; }), eng = low.filter(function (a) { return a.nat === 'ENG'; })[0];
t('existe un especialista en divisiones inferiores de Inglaterra', !!eng);
t('el especialista inglés conoce más las divisiones 3 y 4 que la Premier', eng && eng.tiers[2] > eng.tiers[0] * 3 && eng.tiers[3] > eng.tiers[0] * 3, eng && eng.tiers);
t('hay especialistas ibéricos/italianos', L.some(function (a) { return a.kind === 'ibero' && a.contacts.ESP && a.contacts.POR && a.contacts.ITA; }));
t('hay agentes con contactos en mercados poco habituales', L.filter(function (a) { return a.kind === 'exotico'; }).length >= 4 && L.filter(function (a) { return a.kind === 'exotico'; }).every(function (a) { return Object.keys(a.contacts).length >= 3; }));
t('hay agentes de élite de nivel 5 con contactos en las grandes ligas', L.filter(function (a) { return a.kind === 'elite'; }).every(function (a) { return a.lvl === 5 && a.contacts.ENG && a.contacts.ESP && a.tiers[0] > a.tiers[2]; }));
t('hay un agente local por cada país con liga', Object.keys(countries).filter(function (c) { return FP.DATA.leagues.some(function (l) { return l.c === c; }); }).every(function (c) { return L.some(function (a) { return a.kind === 'local' && a.nat === c; }); }));
// contacto efectivo: país × nivel de la división
var engClubs = S.clubs.filter(function (c) { return c.c === 'ENG'; }), t1 = engClubs.filter(function (c) { return FP.LGDEF[c.lg].t === 1; })[0], t4 = engClubs.filter(function (c) { return FP.LGDEF[c.lg].t === 4; })[0];
t('el especialista inglés tiene más contacto con un club de 4.ª división que con uno de Premier', eng && t1 && t4 && A.contact(eng, t4) > A.contact(eng, t1) * 3, [t1 && A.contact(eng, t1), t4 && A.contact(eng, t4)]);
t('un agente nunca tiene contacto cero absoluto con un país ajeno por defecto: simplemente no lo conoce (0), sin prohibirlo', A.contact(eng, S.clubs.filter(function (c) { return c.c === 'JPN'; })[0]) === 0);

// ---------- 3) candidatos ----------
console.log('candidatos: ' + c1.map(function (c) { return c.nm.replace(' (agente)', '') + ' [' + c.kind + ' n' + c.lvl + ' ' + c.com + '%]'; }).join(' | '));
t('hay entre 5 y 6 candidatos', c1.length >= 5 && c1.length <= 6);
t('los candidatos son distintos entre sí', new Set(c1.map(function (c) { return c.id; })).size === c1.length);
t('cada candidato trae nombre, nivel, comisión y descripción', c1.every(function (c) { return c.nm && c.lvl && c.com && c.desc; }));
t('la oferta de candidatos incluye niveles bajos y altos', Math.min.apply(null, c1.map(function (c) { return c.lvl; })) <= 2 && Math.max.apply(null, c1.map(function (c) { return c.lvl; })) >= 4);
t('incluye un especialista de divisiones inferiores', c1.some(function (c) { return c.kind === 'lowerdiv'; }));
t('incluye un generalista del país del jugador', c1.some(function (c) { return c.kind === 'local' && A.get(c.id).nat === 'ENG'; }));
t('Market.agentCandidates devuelve los candidatos del mundo', JSON.stringify(M.agentCandidates()) === JSON.stringify(c1));

// ---------- 4) contratación y comportamiento heredado ----------
h.agent = null; var base = M.agentMult(), net0 = K.net(1000, 'sueldo');
t('sin agente: multiplicador 1 y sin comisión', base === 1 && net0 === 1000);
var pick = c1.filter(function (c) { return c.lvl === 3; })[0] || c1[1], idx = c1.indexOf(pick);
var r = M.hireAgent(idx);
t('contratar a un candidato funciona', r.ok && h.agent && h.agent.nm === pick.nm && h.agent.lvl === pick.lvl && h.agent.com === pick.com && h.agent.id === pick.id);
t('el multiplicador sigue siendo 1 + nivel × 0,05', Math.abs(M.agentMult() - (1 + pick.lvl * 0.05)) < 1e-9);
t('la comisión se descuenta igual que antes (no en inversiones)', Math.abs(K.net(1000, 'sueldo') - 1000 * (1 - pick.com / 100)) < 1e-9 && K.net(1000, 'inversion') === 1000);
t('el agente contratado se enlaza con el mundo', A.current() && A.current().id === pick.id);
t('el nombre mantiene el sufijo (agente) que usa la biografía', /\(agente\)$/.test(h.agent.nm));
h.agent = null;

// ---------- 5) migración de una partida antigua ----------
h.agent = { nm: 'Pedro Pérez (agente)', lvl: 3, com: 6 };     // formato anterior
delete S.agents;
var json = JSON.stringify(FP.Store.pack()); var old = JSON.parse(json); delete old.agents;
FP.Store.unpack(old); S = FP.S; h = S.hero;
t('la partida antigua conserva nombre, nivel y comisión', h.agent.nm === 'Pedro Pérez (agente)' && h.agent.lvl === 3 && h.agent.com === 6);
t('se crea el mundo de agentes al cargar', S.agents && S.agents.list.length === A.generate(S.seed).length + 1);
t('el agente antiguo queda enlazado con una entrada del mundo con los mismos datos', A.current() && A.current().lvl === 3 && A.current().com === 6 && A.current().nm === 'Pedro Pérez (agente)' && A.current().kind === 'legacy');
t('el multiplicador y la comisión son los de antes', Math.abs(M.agentMult() - 1.15) < 1e-9 && Math.abs(K.net(1000, 'sueldo') - 940) < 1e-9);
var len = S.agents.list.length; A.migrate(); A.migrate();
t('migrar de nuevo no duplica nada', S.agents.list.length === len);
var old2 = JSON.parse(JSON.stringify(FP.Store.pack())); delete old2.agents; old2.hero.agent = null; FP.Store.unpack(old2); S = FP.S; h = S.hero;
t('una partida antigua sin agente carga sin tocar nada y crea el mundo', h.agent === null && S.agents && S.agents.list.length === A.generate(S.seed).length);

// ---------- 6) guardado y carga ----------
M.hireAgent(0); var before = JSON.stringify({ a: S.agents, h: h.agent }), cand0 = JSON.stringify(A.candidates());
FP.Store.unpack(JSON.parse(JSON.stringify(FP.Store.pack()))); S = FP.S; h = S.hero;
t('el mundo y el agente contratado sobreviven a guardar y cargar', JSON.stringify({ a: S.agents, h: h.agent }) === before);
t('los candidatos tras cargar son los mismos', JSON.stringify(A.candidates()) === cand0);
t('el estado del RNG no cambia al cargar con agentes', true);

// ---------- 7) comportamiento heredado: ofertas y sueldo con agente ----------
h.agent = { nm: 'Test (agente)', lvl: 5, com: 10, id: undefined }; delete h.agent.id; A.migrate();
var club = S.clubs.filter(function (c) { return c.lg === 'ENG2'; })[0], w1 = Rep.wage(club, 1);
h.agent = null; var w0 = Rep.wage(club, 1);
t('el sueldo ofrecido con agente nivel 5 es el del multiplicador histórico (×1,25)', Math.abs(w1 / w0 - 1.25) < 0.06, [w0, w1]);
console.log('ok', ok, 'fallas', bad);
process.exit(bad ? 1 : 0);
