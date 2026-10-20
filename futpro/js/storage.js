/* FUTPRO — guardado: IndexedDB (varias partidas), exportación/importación, migraciones */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U;

  var VERSION = 4;          // versión del formato de guardado
  var DB_NAME = 'futpro', STORE = 'saves';
  var Store = FP.Store = { VERSION: VERSION, mem: {} };

  // ---------- empaquetado ----------
  function packFx(f) {
    return [f.h, f.a, f.w, f.d || 0, f.hs == null ? -1 : f.hs, f.as == null ? -1 : f.as, f.st || 0, f.k || 0, f.l || 0, f.x == null ? -1 : f.x, f.y == null ? -1 : f.y, f.r || 0, f.g == null ? -1 : f.g, f.n || 0, f.et || 0, f.ps ? f.ps[0] : -1, f.ps ? f.ps[1] : -1, f.fr || 0];
  }
  function unpackFx(a) {
    var f = { h: a[0], a: a[1], w: a[2], st: a[6] };
    if (a[3]) f.d = 1;
    if (a[4] >= 0) f.hs = a[4]; if (a[5] >= 0) f.as = a[5];
    if (a[7]) f.k = 1; if (a[8]) f.l = a[8]; if (a[9] >= 0) f.x = a[9]; if (a[10] >= 0) f.y = a[10];
    if (a[11]) f.r = a[11]; if (a[12] >= 0) f.g = a[12]; if (a[13]) f.n = 1; if (a[14]) f.et = 1;
    if (a[15] >= 0) f.ps = [a[15], a[16]]; if (a[17]) f.fr = 1;
    return f;
  }
  Store.pack = function () {
    var S = FP.S, out = {}, skip = { ro: 1, pending: 1, weekOpen: 1, results: 1, natPool: 1, lastTrain: 1 };
    Object.keys(S).forEach(function (k) { if (!skip[k]) out[k] = S[k]; });
    out.comps = {};
    Object.keys(S.comps).forEach(function (id) {
      var c = S.comps[id], o = {};
      Object.keys(c).forEach(function (k) { if (k !== 'fx') o[k] = c[k]; });
      o.fx = c.fx.map(packFx);
      out.comps[id] = o;
    });
    out.ver = VERSION; out.dataVer = FP.DATA.version;
    return out;
  };
  Store.unpack = function (d) {
    d = Store.migrate(d);
    var S = FP.S = d;
    FP.Date.setStart(S.y0 || 2026);
    Object.keys(S.comps).forEach(function (id) {
      var c = S.comps[id]; c.fx = c.fx.map(unpackFx);
      c.cp = 0; while (c.cp < c.fx.length && c.fx[c.cp].d) c.cp++; // un partido pendiente del jugador al guardar a mitad de semana vuelve a jugarse
      if (c.ko) Store.fixRo(c);
    });
    FP.LGDEF = {}; FP.DATA.leagues.forEach(function (l) { FP.LGDEF[l.id] = l; });
    FP.NATBY = {}; FP.DATA.nations.forEach(function (n) { FP.NATBY[n.c] = n; });
    S.natPool = FP.DATA.nations.map(function (n) { return { c: n.c, conf: n.conf, r: n.r }; });
    S.pending = []; S.weekOpen = false;
    FP.Core.rebuildRoster(); FP.Match.cache = {};
    if (FP.Youth) FP.Youth.ensure(); if (FP.NT) { FP.NT.ensure(); FP.NT.invalidate(); } if (FP.Stats) FP.Stats.migrate(); if (FP.Contracts) FP.Contracts.migrate();
    ['Dec', 'Med', 'Staff', 'Tac', 'Life', 'Post', 'Tryouts', 'Season', 'Clubs', 'Redes', 'Callup', 'Bio'].forEach(function (k) { var m = FP[k]; if (m && (m.migrate || m.ensure) && S.hero) { try { (m.migrate || m.ensure).call(m); } catch (e) { if (window.console) console.warn('migrar ' + k, e); } } });
    Store.syncData();
    // reindexa cada ko (los índices t.f no se guardan fiables tras ordenar)
    Object.keys(S.comps).forEach(function (id) { var c = S.comps[id]; if (c.ko) FP.Comp.reindex(c); });
    S.clubs.forEach(function (c) { FP.Core.calcStr(c); });
    return S;
  };
  Store.fixRo = function (c) {
    // restituye el nombre de ronda en partidos eliminatorios
    c.fx.forEach(function (f) { if (f.k && f.x != null && c.ko.rounds[f.x]) f.ro = c.ko.rounds[f.x].nm; });
  };
  // Migraciones de formato: cada paso lleva de la versión n a n+1
  Store.migrate = function (d) {
    var v = d.ver || 0;
    if (v < 1) { d.ver = 1; d.hist = d.hist || { champs: [], awards: [] }; }
    if (v < 2) { d.ver = 2; }
    if (v < 3) { d.ver = 3; }  // v3: contratos detallados (h.cx), términos por oferta (o.t)  // v2: reserva de promesas (S.yp), plantillas juveniles (S.sq), selecciones (S.nt), ledger de estadísticas (h.led)
    if (v < 4) { d.ver = 4; }  // v4: salud (h.med), decisiones (h.dec), vestuario (h.lk, S.staff), táctica (h.tac, h.fam), vida personal (h.life), vida posterior (h.post): se crean al cargar
    // futuras migraciones: if (v < 2) { ...; d.ver = 2; }
    if (d.ver > VERSION) throw new Error('El guardado pertenece a una versión más nueva del juego (v' + d.ver + ').');
    return d;
  };
  // Incorpora ligas o clubes agregados a la base de datos después de crear la partida
  Store.syncData = function () {
    var S = FP.S, added = 0;
    FP.DATA.leagues.forEach(function (l) {
      var isNew = !S.lgs[l.id];
      var made = FP.Core.addLeague(l, !isNew);
      if (made.length) {
        made.forEach(function (c) { FP.Core.fillSquad(c); });
        FP.Core.rebuildRoster(); made.forEach(FP.Core.calcStr);
        added += made.length;
        if (isNew) {
          var y = FP.Date.year(S.week) - (l.cal === 'euro' && FP.Date.month(S.week) < 6 ? 1 : 0);
          FP.Comp.newLeague(l.id, y + (l.cal === 'euro' && FP.Date.month(S.week) >= 6 ? 0 : 0));
        }
      }
    });
    if (added) FP.Sim.news('La base de datos se actualizó: ' + added + ' clubes nuevos incorporados.', 'g', 1);
    return added;
  };

  // ---------- IndexedDB ----------
  var dbp = null;
  function openDB() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      if (!window.indexedDB) { rej(new Error('IndexedDB no disponible')); return; }
      var rq;
      try { rq = indexedDB.open(DB_NAME, 1); } catch (e) { rej(e); return; }
      rq.onupgradeneeded = function () { var db = rq.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }); };
      rq.onsuccess = function () { res(rq.result); };
      rq.onerror = function () { rej(rq.error); };
    });
    dbp.catch(function () { dbp = null; });
    return dbp;
  }
  function tx(mode, fn) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(STORE, mode), st = t.objectStore(STORE), r = fn(st);
        t.oncomplete = function () { res(r && r.result !== undefined ? r.result : undefined); };
        t.onerror = function () { rej(t.error); };
        t.onabort = function () { rej(t.error || new Error('abortado')); };
      });
    });
  }
  Store.meta = function () {
    var S = FP.S, h = S.hero;
    return { name: h ? h.nm : 'Mundo', age: h ? FP.Hero.age() : null, ovr: h ? h.ovr : null, team: h && h.team != null ? FP.Core.tname(h.team) : (h && h.club != null ? FP.Core.tname(h.club) : 'Sin club'), date: FP.Date.fmt(S.week), week: S.week, retired: h ? !!h.retired : false, saved: Date.now(), nat: h ? h.nat : null };
  };
  Store.newId = function () { return 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); };
  // guarda la partida actual (autoguardado en el mismo registro)
  Store.save = function (label) {
    var S = FP.S;
    if (FP.Tac && FP.Tac.isLive()) return Promise.reject(new Error('Termina el partido antes de guardar.'));
    if (!S.sid) S.sid = Store.newId();
    var rec = { id: S.sid, meta: Store.meta(), label: label || S.label || null, data: Store.pack() };
    if (label) S.label = label;
    Store.mem[rec.id] = null;
    return tx('readwrite', function (st) { return st.put(rec); }).then(function () { Store.lastSaved = Date.now(); return rec.id; }).catch(function (e) {
      Store.mem[rec.id] = rec; // respaldo en memoria si el navegador bloquea IndexedDB
      Store.lastError = e; Store.lastSaved = Date.now(); throw e;
    });
  };
  // copia en un nuevo registro (varias partidas)
  Store.saveAs = function (label) {
    var S = FP.S, old = S.sid;
    S.sid = Store.newId(); S.label = label || null;
    return Store.save(label).then(function (id) { return id; });
  };
  Store.list = function () {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var out = [], t = db.transaction(STORE, 'readonly'), c = t.objectStore(STORE).openCursor();
        c.onsuccess = function () { var cur = c.result; if (cur) { out.push({ id: cur.value.id, meta: cur.value.meta, label: cur.value.label }); cur.continue(); } };
        t.oncomplete = function () { out.sort(function (a, b) { return b.meta.saved - a.meta.saved; }); res(out); };
        t.onerror = function () { rej(t.error); };
      });
    }).catch(function () { return Object.keys(Store.mem).filter(function (k) { return Store.mem[k]; }).map(function (k) { return { id: k, meta: Store.mem[k].meta, label: Store.mem[k].label }; }); });
  };
  Store.load = function (id) {
    return tx('readonly', function (st) { return st.get(id); }).then(function (rec) {
      if (!rec) throw new Error('Partida no encontrada');
      var S = Store.unpack(rec.data); S.sid = rec.id; S.label = rec.label; return S;
    });
  };
  Store.remove = function (id) { return tx('readwrite', function (st) { return st.delete(id); }); };

  // ---------- exportar / importar ----------
  function download(name, blob) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  Store.export = function () {
    var S = FP.S, h = S.hero, nm = (h ? h.nm : 'mundo').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\-]+/g, '_');
    var json = JSON.stringify({ app: 'FUTPRO', format: VERSION, exported: Date.now(), data: Store.pack() });
    var ymd = FP.Date.ymd(S.week), fname = 'futpro_' + nm + '_' + ymd[0] + String(ymd[1] + 1).padStart(2, '0') + String(ymd[2]).padStart(2, '0');
    if (window.CompressionStream) {
      var cs = new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip')));
      return cs.blob().then(function (b) { download(fname + '.fpsave', b); return b.size; });
    }
    var b2 = new Blob([json], { type: 'application/json' }); download(fname + '.json', b2); return Promise.resolve(b2.size);
  };
  Store.import = function (file) {
    return file.arrayBuffer().then(function (buf) {
      var u8 = new Uint8Array(buf);
      if (u8[0] === 0x1f && u8[1] === 0x8b) {
        if (!window.DecompressionStream) throw new Error('Este navegador no puede descomprimir el archivo.');
        return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
      }
      return new TextDecoder().decode(u8);
    }).then(function (txt) {
      var o = JSON.parse(txt);
      if (!o || o.app !== 'FUTPRO' || !o.data) throw new Error('El archivo no es una partida de FUTPRO.');
      var S = Store.unpack(o.data); S.sid = Store.newId(); S.label = 'Importada';
      return S;
    });
  };

  // ---------- autoguardado ----------
  Store.auto = function (force) {
    var S = FP.S; if (!S || !S.cfg || S.cfg.autosave === false) return Promise.resolve();
    if (FP.Tac && FP.Tac.isLive()) return Promise.resolve();      // no se guarda con un partido a medias
    var every = S.cfg.autoEvery || 4;
    S.autoCount = (S.autoCount || 0) + 1;
    if (!force && S.autoCount % every !== 0) return Promise.resolve();
    return Store.save().catch(function () { });
  };
})();
