/* FUTPRO — decisiones pendientes del jugador (lesiones, vestuario, vida personal, prensa…).
   Cada decisión tiene opciones con un manejador por tipo; si el jugador no responde a tiempo se aplica la opción por defecto. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U;
  var Dec = FP.Dec = { handlers: {} };
  Dec.ensure = function () { var h = FP.S && FP.S.hero; if (h && !h.dec) h.dec = { list: [], nid: 1, done: [] }; return h && h.dec; };
  // d: {kind, title, text, opts:[{k,label,hint}], def (opción por defecto), exp (semanas), data}
  Dec.add = function (d) {
    var S = FP.S, st = Dec.ensure(); if (!st) return null;
    if (d.uniq && st.list.some(function (x) { return x.kind === d.kind && x.uniq === d.uniq; })) return null;
    var item = { id: st.nid++, kind: d.kind, uniq: d.uniq || null, title: d.title, text: d.text || '', opts: d.opts, def: d.def != null ? d.def : d.opts[0].k, w: S.week, exp: S.week + (d.exp || 2), data: d.data || {} };
    st.list.push(item);
    FP.Hero.msg('Decisión pendiente: ' + d.title, 'warn');
    return item;
  };
  Dec.get = function (id) { var st = Dec.ensure(); return st ? st.list.filter(function (x) { return x.id === id; })[0] : null; };
  Dec.open = function (kind) { var st = Dec.ensure(); return st ? st.list.filter(function (x) { return !kind || x.kind === kind; }) : []; };
  Dec.resolve = function (id, k, auto) {
    var st = Dec.ensure(), d = Dec.get(id); if (!d) return { ok: false, msg: 'Esa decisión ya no está disponible.' };
    var fn = Dec.handlers[d.kind]; st.list = st.list.filter(function (x) { return x !== d; });
    var r = fn ? fn(k, d, auto) : { ok: true, msg: '' };
    st.done.push({ w: FP.S.week, kind: d.kind, title: d.title, k: k, auto: !!auto }); if (st.done.length > 80) st.done.shift();
    return r || { ok: true, msg: '' };
  };
  Dec.weekly = function (w) {
    var st = Dec.ensure(); if (!st) return;
    st.list.slice().forEach(function (d) { if (w >= d.exp) { var r = Dec.resolve(d.id, d.def, true); if (r && r.msg) FP.Hero.msg('Sin respuesta a tiempo: ' + r.msg, 'i'); } });
  };
})();
