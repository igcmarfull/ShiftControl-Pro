// Pruebas de concurrencia del módulo Inventarios.
//
// SOLO PARA UNA BASE LOCAL DESECHABLE con todas las migraciones aplicadas (y la
// capa de compatibilidad de Supabase: roles anon/authenticated, auth.uid()).
// Crea sus propios datos ficticios y los deja en la base: usar una base nueva.
// No forma parte de la aplicación ni se ejecuta en CI; necesita el módulo `pg`
// instalado donde se ejecute (npm install pg, fuera del repositorio).
//
// Uso:
//   PGHOST=127.0.0.1 PGPORT=5439 PGUSER=postgres PGDATABASE=sc_conc \
//   NODE_PATH=<ruta a node_modules> node supabase/tests/inventario_concurrencia.js
//
// Cada escenario lanza varias transacciones a la vez, cada una en su propia
// conexión, y comprueba el estado final.

const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({ max: 40 });
const uuid = () => crypto.randomUUID();
let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) { passed += 1; console.log('  PASS', name); }
  else { failed += 1; console.log('  FAIL', name, detail); }
}

// Ejecuta una consulta como un usuario autenticado, en su propia transacción.
async function act(userId, sql, params = []) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await client.query('set local role authenticated');
    const res = await client.query(sql, params);
    await client.query('commit');
    return { ok: true, data: res.rows[0] ? Object.values(res.rows[0])[0] : null };
  } catch (error) {
    await client.query('rollback').catch(() => {});
    return { ok: false, msg: error.message, code: error.code };
  } finally {
    client.release();
  }
}
const admin = (sql, params) => pool.query(sql, params);

async function seed() {
  const company = uuid();
  const users = { adm: uuid(), jt: uuid(), jt2: uuid() };
  for (const [k, id] of Object.entries(users)) {
    await admin('insert into auth.users (id, email) values ($1, $2)', [id, `${k}-${id}@example.invalid`]);
    await admin('insert into public.profiles (id, display_name, active) values ($1, $2, true) on conflict (id) do update set active = true', [id, `Prueba ${k}`]);
  }
  await admin('insert into public.companies (id, name) values ($1, $2)', [company, 'Empresa concurrencia']);
  await admin("insert into public.company_memberships (company_id, user_id, role, area, active) values ($1, $2, 'ADMIN', null, true)", [company, users.adm]);
  await admin("insert into public.company_memberships (company_id, user_id, role, area, active) values ($1, $2, 'CHIEF', 'TIENDA', true)", [company, users.jt]);
  const setup = await act(users.adm, 'select public.inv_setup($1)', [company]);
  const inv = Object.fromEntries(setup.data.inventories.map((i) => [i.code, i.id]));
  return { company, users, inv };
}

async function product(ctx, code, extra = {}) {
  const r = await act(ctx.users.adm, 'select public.inv_save_product($1, $2::jsonb)', [
    ctx.inv.tienda, JSON.stringify({ code, name: `Producto ${code}`, min_stock: 0, ...extra })]);
  if (!r.ok) throw new Error(`No se pudo crear ${code}: ${r.msg}`);
  return r.data.id;
}
async function opening(ctx, productId, qty, extra = {}) {
  const r = await act(ctx.users.adm, 'select public.inv_register_opening($1, $2, $3::jsonb)', [
    uuid(), ctx.inv.tienda, JSON.stringify([{ product_id: productId, qty, ...extra }])]);
  if (!r.ok) throw new Error(`Saldo inicial: ${r.msg}`);
}
const stockOf = async (productId) =>
  Number((await admin('select coalesce(sum(qty), 0) q from public.inv_stock where product_id = $1', [productId])).rows[0].q);
const issue = (ctx, productId, qty, requestId = uuid(), user = ctx.users.jt) =>
  act(user, "select public.inv_issue($1, $2, $3, 'issue', 'Prueba', 'concurrencia')", [requestId, productId, qty]);

async function main() {
  const ctx = await seed();
  console.log('Escenarios de concurrencia');

  // 1. Dos salidas que juntas superan el stock: solo una puede completarse.
  {
    const p = await product(ctx, 'C-1');
    await opening(ctx, p, 10);
    const res = await Promise.all([issue(ctx, p, 7), issue(ctx, p, 7)]);
    const ok = res.filter((r) => r.ok).length;
    const insufficient = res.filter((r) => !r.ok && r.msg === 'inv:insufficient_stock').length;
    check('1. Dos salidas de 7 con stock 10: una se aplica y la otra se rechaza', ok === 1 && insufficient === 1, JSON.stringify(res));
    check('1. El stock queda en 3 (no se vendió dos veces)', (await stockOf(p)) === 3);
  }

  // 2. Veinte salidas de 1 con stock 10: exactamente 10 se aplican.
  {
    const p = await product(ctx, 'C-2');
    await opening(ctx, p, 10);
    const res = await Promise.all(Array.from({ length: 20 }, () => issue(ctx, p, 1)));
    check('2. 20 salidas simultáneas con stock 10: exactamente 10 se aplican', res.filter((r) => r.ok).length === 10, `${res.filter((r) => r.ok).length}`);
    check('2. El stock queda en 0 y nunca es negativo', (await stockOf(p)) === 0);
    const neg = await admin('select count(*) n from public.inv_stock where qty < 0');
    check('2. Ninguna fila de stock es negativa', Number(neg.rows[0].n) === 0);
  }

  // 3. El mismo request_id enviado 10 veces a la vez (reintentos): una sola recepción.
  {
    const p = await product(ctx, 'C-3');
    const requestId = uuid();
    const header = { supplier: 'Proveedor', document_no: 'F-CONC-1' };
    const lines = [{ product_id: p, qty: 5 }];
    const res = await Promise.all(Array.from({ length: 10 }, () =>
      act(ctx.users.jt, 'select public.inv_receive($1, $2, $3::jsonb, $4::jsonb)', [requestId, ctx.inv.tienda, JSON.stringify(header), JSON.stringify(lines)])));
    check('3. Diez reintentos con el mismo request_id: todos responden bien', res.every((r) => r.ok), JSON.stringify(res.filter((r) => !r.ok)));
    check('3. El stock sube solo una vez', (await stockOf(p)) === 5);
    const n = await admin("select count(*) n from public.inv_receipts where document_no = 'F-CONC-1'");
    check('3. Existe una sola recepción', Number(n.rows[0].n) === 1);
    check('3. Los reintentos se marcan como repetidos', res.filter((r) => r.data && r.data.replayed).length === 9);
  }

  // 4. La misma factura con distintos request_id a la vez: solo una se registra.
  {
    const p = await product(ctx, 'C-4');
    const res = await Promise.all(Array.from({ length: 6 }, () =>
      act(ctx.users.jt, 'select public.inv_receive($1, $2, $3::jsonb, $4::jsonb)', [
        uuid(), ctx.inv.tienda, JSON.stringify({ supplier: 'Proveedor', document_no: 'F-CONC-2' }), JSON.stringify([{ product_id: p, qty: 4 }])])));
    check('4. La misma factura recibida 6 veces a la vez: solo una pasa', res.filter((r) => r.ok).length === 1
      && res.filter((r) => !r.ok && r.msg === 'inv:duplicate_receipt').length === 5, JSON.stringify(res.map((r) => r.msg || 'ok')));
    check('4. El stock sube una sola vez', (await stockOf(p)) === 4);
  }

  // 5. Creación simultánea del mismo código de producto.
  {
    const res = await Promise.all(Array.from({ length: 5 }, () =>
      act(ctx.users.adm, 'select public.inv_save_product($1, $2::jsonb)', [ctx.inv.tienda, JSON.stringify({ code: 'DUP-1', name: 'Duplicado' })])));
    check('5. El mismo código creado 5 veces a la vez: solo uno se crea', res.filter((r) => r.ok).length === 1
      && res.filter((r) => !r.ok && r.msg === 'inv:duplicate_code').length === 4, JSON.stringify(res.map((r) => r.msg || 'ok')));
  }

  // 6. Dos aprobaciones simultáneas del mismo ajuste: el stock cambia una vez.
  {
    const p = await product(ctx, 'C-6');
    await opening(ctx, p, 20);
    const count = (await act(ctx.users.jt, 'select public.inv_count_start($1)', [ctx.inv.tienda])).data;
    await act(ctx.users.jt, 'select public.inv_count_save($1, $2::jsonb)', [count.id, JSON.stringify([{ product_id: p, counted_qty: 17, note: 'Faltan 3' }])]);
    await act(ctx.users.jt, 'select public.inv_count_submit($1, $2)', [uuid(), count.id]);
    const adj = (await admin('select id from public.inv_adjustments where product_id = $1', [p])).rows[0].id;
    const res = await Promise.all(Array.from({ length: 4 }, () =>
      act(ctx.users.adm, 'select public.inv_review_adjustment($1, $2, true, $3)', [uuid(), adj, 'ok'])));
    check('6. Cuatro aprobaciones simultáneas: solo una se aplica', res.filter((r) => r.ok).length === 1
      && res.filter((r) => !r.ok && r.msg === 'inv:already_reviewed').length === 3, JSON.stringify(res.map((r) => r.msg || 'ok')));
    check('6. El stock baja una sola vez (20 → 17)', (await stockOf(p)) === 17);
  }

  // 7. Dos correcciones simultáneas del mismo movimiento.
  {
    const p = await product(ctx, 'C-7');
    await opening(ctx, p, 10);
    await issue(ctx, p, 4);
    const mov = (await admin("select id from public.inv_movements where product_id = $1 and kind = 'issue'", [p])).rows[0].id;
    const res = await Promise.all(Array.from({ length: 4 }, () =>
      act(ctx.users.adm, "select public.inv_reverse_movement($1, $2, 'Error de registro')", [uuid(), mov])));
    check('7. Cuatro correcciones simultáneas: solo una se aplica', res.filter((r) => r.ok).length === 1, JSON.stringify(res.map((r) => r.msg || 'ok')));
    check('7. El stock se corrige una sola vez (6 → 10)', (await stockOf(p)) === 10);
  }

  // 8. FEFO bajo carga: ocho mermas de 1 sobre dos lotes (3 + 5): consumo exacto, sin doble consumo.
  {
    const p = await product(ctx, 'C-8', { tracks_expiry: true });
    await act(ctx.users.jt, 'select public.inv_receive($1, $2, $3::jsonb, $4::jsonb)', [
      uuid(), ctx.inv.tienda, JSON.stringify({ supplier: 'P', document_no: 'F-CONC-8' }),
      JSON.stringify([{ product_id: p, qty: 5, lot_code: 'L-LATE', expires_on: '2027-03-01' }, { product_id: p, qty: 3, lot_code: 'L-EARLY', expires_on: '2026-12-01' }])]);
    const res = await Promise.all(Array.from({ length: 10 }, () =>
      act(ctx.users.jt, "select public.inv_issue($1, $2, 1, 'waste', 'Vencimiento', null)", [uuid(), p])));
    check('8. Diez mermas sobre 8 unidades: se aplican 8', res.filter((r) => r.ok).length === 8, `${res.filter((r) => r.ok).length}`);
    check('8. El stock queda en 0', (await stockOf(p)) === 0);
    const early = await admin("select s.qty from public.inv_stock s join public.inv_lots l on l.id = s.lot_id where l.lot_code = 'L-EARLY' and s.product_id = $1", [p]);
    check('8. El lote que vence antes se consumió primero y por completo', early.rows.length === 0 || Number(early.rows[0].qty) === 0);
  }

  // 9. Salidas, traslados y mermas mezcladas sobre el mismo producto: el stock nunca queda negativo.
  {
    const p = await product(ctx, 'C-9');
    await opening(ctx, p, 12);
    const locs = (await admin('select id from public.inv_locations where inventory_id = $1 order by name', [ctx.inv.tienda])).rows.map((r) => r.id);
    const ops = [];
    for (let i = 0; i < 8; i += 1) ops.push(issue(ctx, p, 2));
    for (let i = 0; i < 4; i += 1) {
      ops.push(act(ctx.users.jt, 'select public.inv_transfer($1, $2, $3, $4, 3, $5)', [uuid(), p, locs[0], locs[1], 'mezcla']));
    }
    const res = await Promise.all(ops);
    const fin = await stockOf(p);
    const neg = await admin('select count(*) n from public.inv_stock where qty < 0');
    const sum = await admin('select coalesce(sum(qty), 0) q from public.inv_movements where product_id = $1', [p]);
    check('9. Mezcla de operaciones simultáneas: sin stock negativo', Number(neg.rows[0].n) === 0);
    check('9. El stock coincide con la suma de movimientos', Number(sum.rows[0].q) === fin, `${sum.rows[0].q} vs ${fin}`);
    check('9. Las operaciones rechazadas lo fueron por falta de stock, no por errores internos',
      res.filter((r) => !r.ok).every((r) => r.msg === 'inv:insufficient_stock'), JSON.stringify(res.filter((r) => !r.ok).map((r) => r.msg)));
  }

  // 10. Dos jefas cuentan el mismo producto: la segunda no pisa a la primera sin saberlo.
  {
    await admin("insert into public.company_memberships (company_id, user_id, role, area, active) values ($1, $2, 'CHIEF', 'TIENDA', false)", [ctx.company, ctx.users.jt2]).catch(() => {});
    const p = await product(ctx, 'C-10');
    await opening(ctx, p, 10);
    const count = (await act(ctx.users.jt, 'select public.inv_count_start($1)', [ctx.inv.tienda])).data;
    const a = await act(ctx.users.jt, 'select public.inv_count_save($1, $2::jsonb)', [count.id, JSON.stringify([{ product_id: p, counted_qty: 9 }])]);
    check('10. La primera persona guarda su conteo', a.ok && a.data.saved === 1);
    const b = await act(ctx.users.adm, 'select public.inv_count_save($1, $2::jsonb)', [count.id, JSON.stringify([{ product_id: p, counted_qty: 4, since: '2000-01-01T00:00:00Z' }])]);
    check('10. La segunda, con datos viejos, recibe un aviso de conflicto y no pisa el valor',
      b.ok && b.data.saved === 0 && b.data.conflicts.length === 1 && b.data.conflicts[0].counted_qty === 9, JSON.stringify(b));
    const c = await act(ctx.users.adm, 'select public.inv_count_save($1, $2::jsonb)', [count.id, JSON.stringify([{ product_id: p, counted_qty: 8, note: 'Diferencia de prueba', since: new Date(Date.now() + 1000).toISOString() }])]);
    check('10. Con la lectura actualizada sí puede reemplazarlo', c.ok && c.data.saved === 1);
    await act(ctx.users.jt, 'select public.inv_count_submit($1, $2)', [uuid(), count.id]); // cierra el conteo para el siguiente escenario
  }

  // 11. Conteo y recepción al mismo tiempo: el ajuste aplica la diferencia, no pisa la recepción.
  {
    const p = await product(ctx, 'C-11');
    await opening(ctx, p, 10);
    const count = (await act(ctx.users.jt, 'select public.inv_count_start($1)', [ctx.inv.tienda])).data;
    await act(ctx.users.jt, 'select public.inv_count_save($1, $2::jsonb)', [count.id, JSON.stringify([{ product_id: p, counted_qty: 8, note: 'Faltan 2' }])]);
    await act(ctx.users.jt, 'select public.inv_count_submit($1, $2)', [uuid(), count.id]);
    await act(ctx.users.jt, 'select public.inv_receive($1, $2, $3::jsonb, $4::jsonb)', [
      uuid(), ctx.inv.tienda, JSON.stringify({ supplier: 'P', document_no: 'F-CONC-11' }), JSON.stringify([{ product_id: p, qty: 6 }])]);
    const adj = (await admin('select id from public.inv_adjustments where product_id = $1', [p])).rows[0].id;
    await act(ctx.users.adm, 'select public.inv_review_adjustment($1, $2, true, null)', [uuid(), adj]);
    check('11. Ajuste -2 sobre 10, con una recepción de +6 en medio: el stock final es 14 (no 8)', (await stockOf(p)) === 14, `${await stockOf(p)}`);
  }

  const audit = await admin('select count(*) n from public.inv_audit where company_id = $1', [ctx.company]);
  check('Toda la actividad quedó auditada', Number(audit.rows[0].n) > 10);
  console.log(`\nResultado: ${passed} pasan, ${failed} fallan`);
  await pool.end();
  process.exit(failed ? 1 : 0);
}

main().catch(async (error) => { console.error(error); await pool.end(); process.exit(2); });
