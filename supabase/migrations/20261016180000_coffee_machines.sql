-- Máquinas de café: cuadratura del numeral contra las ventas del POS.
--
-- Cambio aditivo:
--   1. coffee_machines / coffee_machine_codes: cada máquina, su turno de cierre (el que coincide con
--      el corte del sistema diario), su tolerancia y los códigos del POS que pasan por ella.
--   2. coffee_readings: el numeral que marca la máquina en cada turno (A, B o C).
--   3. coffee_sales: ventas del POS de los códigos de una máquina, registradas por la importación de
--      ventas (inv_apply_sales). Esos productos no descuentan stock.
--   4. coffee_machine_save, coffee_save_reading y coffee_reconcile (numeral de cierre contra vasos
--      vendidos). Lo ven y lo anotan el administrador y la jefa de tienda; solo el administrador
--      configura máquinas y corrige una lectura ya guardada.
--
-- Reversión: supabase/rollback/20261016180000_coffee_machines.rollback.sql

create function public.coffee_can_access(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_memberships m
    where m.company_id = p_company_id and m.user_id = (select auth.uid()) and m.active = true
      and (m.role = 'ADMIN' or (m.role = 'CHIEF' and m.area = 'TIENDA'))
  );
$$;
revoke all on function public.coffee_can_access(uuid) from public, anon;
grant execute on function public.coffee_can_access(uuid) to authenticated;

create table public.coffee_machines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (length(trim(name)) > 0 and length(name) <= 60),
  close_shift text check (close_shift in ('A', 'B', 'C')),
  tolerance integer not null default 5 check (tolerance between 0 and 500),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index coffee_machines_name_key on public.coffee_machines (company_id, lower(trim(name)));

create table public.coffee_machine_codes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  machine_id uuid not null references public.coffee_machines (id) on delete cascade,
  pos_code text not null check (length(trim(pos_code)) > 0 and length(pos_code) <= 40),
  cups integer not null default 1 check (cups between 1 and 20),
  unique (company_id, pos_code)
);
create index coffee_machine_codes_machine_idx on public.coffee_machine_codes (machine_id);

create table public.coffee_readings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  machine_id uuid not null references public.coffee_machines (id) on delete cascade,
  read_on date not null,
  shift text not null check (shift in ('A', 'B', 'C')),
  numeral bigint not null check (numeral >= 0),
  note text check (note is null or length(note) <= 300),
  entered_by uuid,
  entered_by_name text,
  entered_at timestamptz not null default now(),
  unique (machine_id, read_on, shift)
);

create table public.coffee_sales (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  machine_id uuid not null references public.coffee_machines (id) on delete cascade,
  sold_on date not null,
  pos_code text not null,
  qty integer not null check (qty > 0),
  request_id uuid not null,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now(),
  unique (company_id, sold_on, pos_code)
);
create index coffee_sales_machine_idx on public.coffee_sales (machine_id, sold_on);

do $$
declare t text;
begin
  foreach t in array array['coffee_machines', 'coffee_machine_codes', 'coffee_readings', 'coffee_sales'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.coffee_can_access(company_id))', t || '_select', t);
  end loop;
end;
$$;

-- Crea o edita una máquina (administrador). p_machine: {id?, name, close_shift, tolerance, active, codes: [{code, cups}]}
create function public.coffee_machine_save(p_company_id uuid, p_machine jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  v_id uuid := nullif(p_machine->>'id', '')::uuid;
  v_old public.coffee_machines;
  v_new public.coffee_machines;
  v_name text;
  v_shift text;
  v_tol integer;
  v_active boolean;
  v_code jsonb;
  v_pos text;
  v_cups integer;
begin
  select * into a from public.inv_actor(p_company_id);
  if a.role <> 'ADMIN' then
    perform public.inv_fail('forbidden', 'Solo el administrador configura las máquinas.', null, '42501');
  end if;
  if v_id is not null then
    select * into v_old from public.coffee_machines where id = v_id and company_id = p_company_id for update;
    if not found then perform public.inv_fail('not_found', 'La máquina no existe.', null, '42501'); end if;
  end if;
  v_name := trim(case when p_machine ? 'name' then coalesce(p_machine->>'name', '') else coalesce(v_old.name, '') end);
  v_shift := case when p_machine ? 'close_shift' then nullif(p_machine->>'close_shift', '') else v_old.close_shift end;
  v_tol := case when p_machine ? 'tolerance' then coalesce((p_machine->>'tolerance')::integer, 5) else coalesce(v_old.tolerance, 5) end;
  v_active := case when p_machine ? 'active' then coalesce((p_machine->>'active')::boolean, true) else coalesce(v_old.active, true) end;
  if v_name = '' then perform public.inv_fail('name_required', 'La máquina necesita un nombre.'); end if;
  if v_shift is not null and v_shift not in ('A', 'B', 'C') then perform public.inv_fail('invalid_shift', 'El turno de cierre debe ser A, B o C.'); end if;
  if v_tol < 0 or v_tol > 500 then perform public.inv_fail('invalid_tolerance', 'La tolerancia debe estar entre 0 y 500 vasos.'); end if;
  begin
    if v_id is null then
      insert into public.coffee_machines (company_id, name, close_shift, tolerance, active)
      values (p_company_id, v_name, v_shift, v_tol, v_active) returning * into v_new;
    else
      update public.coffee_machines set name = v_name, close_shift = v_shift, tolerance = v_tol, active = v_active, updated_at = now()
      where id = v_id returning * into v_new;
    end if;
  exception when unique_violation then
    perform public.inv_fail('duplicate_name', 'Ya existe una máquina con ese nombre.');
  end;
  if p_machine ? 'codes' then
    if jsonb_typeof(p_machine->'codes') <> 'array' then perform public.inv_fail('invalid_codes', 'La lista de códigos no es válida.'); end if;
    delete from public.coffee_machine_codes where machine_id = v_new.id;
    for v_code in select * from jsonb_array_elements(p_machine->'codes') loop
      v_pos := left(trim(coalesce(v_code->>'code', '')), 40);
      v_cups := coalesce((v_code->>'cups')::integer, 1);
      if v_pos = '' or v_cups < 1 or v_cups > 20 then perform public.inv_fail('invalid_codes', 'Hay un código o una cantidad de vasos no válidos.'); end if;
      begin
        insert into public.coffee_machine_codes (company_id, machine_id, pos_code, cups) values (p_company_id, v_new.id, v_pos, v_cups);
      exception when unique_violation then
        perform public.inv_fail('duplicate_code', 'El código ' || v_pos || ' ya pertenece a otra máquina o está repetido.');
      end;
    end loop;
  end if;
  perform public.inv_log(p_company_id, 'coffee.machine_save', 'coffee_machine', v_new.id, jsonb_build_object('name', v_new.name));
  return to_jsonb(v_new);
end;
$$;

-- Anota el numeral de un turno. Corregir una lectura ya guardada es solo del administrador.
create function public.coffee_save_reading(p_company_id uuid, p_machine_id uuid, p_read_on date, p_shift text, p_numeral bigint, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  v_today date := (now() at time zone 'America/Santiago')::date;
  v_row public.coffee_readings;
begin
  select * into a from public.inv_actor(p_company_id);
  if a.role <> 'ADMIN' and a.area is distinct from 'TIENDA' then
    perform public.inv_fail('forbidden', 'Tu perfil no anota el numeral de las máquinas de café.', null, '42501');
  end if;
  if not exists (select 1 from public.coffee_machines where id = p_machine_id and company_id = p_company_id and active) then
    perform public.inv_fail('not_found', 'La máquina no existe o está desactivada.', null, '42501');
  end if;
  if p_shift is null or p_shift not in ('A', 'B', 'C') then perform public.inv_fail('invalid_shift', 'El turno debe ser A, B o C.'); end if;
  if p_read_on is null or p_read_on > v_today then perform public.inv_fail('invalid_date', 'La fecha de la lectura no puede ser futura.'); end if;
  if p_numeral is null or p_numeral < 0 then perform public.inv_fail('invalid_numeral', 'El numeral no es válido.'); end if;
  select * into v_row from public.coffee_readings where machine_id = p_machine_id and read_on = p_read_on and shift = p_shift;
  if found then
    if a.role <> 'ADMIN' then
      perform public.inv_fail('already_read', 'Ya hay una lectura de ese turno. Solo el administrador la corrige.');
    end if;
    update public.coffee_readings set numeral = p_numeral, note = nullif(trim(coalesce(p_note, '')), ''),
      entered_by = a.user_id, entered_by_name = a.user_name, entered_at = now()
    where id = v_row.id returning * into v_row;
  else
    insert into public.coffee_readings (company_id, machine_id, read_on, shift, numeral, note, entered_by, entered_by_name)
    values (p_company_id, p_machine_id, p_read_on, p_shift, p_numeral, nullif(trim(coalesce(p_note, '')), ''), a.user_id, a.user_name)
    returning * into v_row;
  end if;
  perform public.inv_log(p_company_id, 'coffee.reading', 'coffee_machine', p_machine_id,
    jsonb_build_object('date', p_read_on, 'shift', p_shift, 'numeral', p_numeral));
  return to_jsonb(v_row);
end;
$$;

-- Cuadratura: entre dos lecturas consecutivas del turno de cierre, cuánto avanzó el numeral contra los
-- vasos vendidos en los días contables que cubre ese tramo (desde el día siguiente a la lectura anterior
-- hasta el día de la actual). Estados: ok, over (diferencia mayor que la tolerancia), reset (el numeral
-- bajó), pending (faltan ventas cargadas de algún día del tramo).
create function public.coffee_reconcile(p_company_id uuid, p_machine_id uuid, p_from date default null, p_to date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_m public.coffee_machines;
  r record;
  v_out jsonb := '[]'::jsonb;
  v_sold integer;
  v_days integer;
  v_loaded integer;
  v_adv bigint;
  v_diff bigint;
  v_status text;
begin
  if not public.coffee_can_access(p_company_id) then
    perform public.inv_fail('forbidden', 'No tienes acceso a las máquinas de café.', null, '42501');
  end if;
  select * into v_m from public.coffee_machines where id = p_machine_id and company_id = p_company_id;
  if not found then perform public.inv_fail('not_found', 'La máquina no existe.', null, '42501'); end if;
  if v_m.close_shift is null then
    return jsonb_build_object('machine', to_jsonb(v_m), 'rows', '[]'::jsonb, 'needs_close_shift', true);
  end if;
  for r in
    select * from (
      select cr.read_on, cr.numeral, cr.entered_by_name,
             lag(cr.read_on) over (order by cr.read_on) as prev_on,
             lag(cr.numeral) over (order by cr.read_on) as prev_numeral
      from public.coffee_readings cr
      where cr.machine_id = p_machine_id and cr.shift = v_m.close_shift
    ) t
    where t.prev_on is not null
      and (p_from is null or t.read_on >= p_from) and (p_to is null or t.read_on <= p_to)
    order by t.read_on desc
  loop
    select coalesce(sum(s.qty * c.cups), 0)::integer into v_sold
    from public.coffee_sales s
    join public.coffee_machine_codes c on c.machine_id = s.machine_id and c.pos_code = s.pos_code
    where s.machine_id = p_machine_id and s.sold_on > r.prev_on and s.sold_on <= r.read_on;
    v_days := (r.read_on - r.prev_on);
    select count(*)::integer into v_loaded
    from generate_series(r.prev_on + 1, r.read_on, interval '1 day') d
    where exists (select 1 from public.coffee_sales s where s.company_id = p_company_id and s.sold_on = d::date)
       or exists (select 1 from public.inv_sales_lines s where s.company_id = p_company_id and s.sold_on = d::date);
    v_adv := r.numeral - r.prev_numeral;
    v_diff := v_adv - v_sold;
    v_status := case when v_adv < 0 then 'reset' when v_loaded < v_days then 'pending'
                     when abs(v_diff) > v_m.tolerance then 'over' else 'ok' end;
    v_out := v_out || jsonb_build_object(
      'read_on', r.read_on, 'prev_on', r.prev_on, 'numeral', r.numeral, 'prev_numeral', r.prev_numeral,
      'advanced', v_adv, 'sold', v_sold, 'diff', v_diff, 'days', v_days, 'days_loaded', v_loaded,
      'status', v_status, 'entered_by', r.entered_by_name);
  end loop;
  return jsonb_build_object('machine', to_jsonb(v_m), 'rows', v_out, 'needs_close_shift', false);
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'coffee_machine_save(uuid, jsonb)', 'coffee_save_reading(uuid, uuid, date, text, bigint, text)',
    'coffee_reconcile(uuid, uuid, date, date)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;

-- La importación de ventas registra aparte los códigos de máquinas de café (no descuentan stock).
create or replace function public.inv_apply_sales(p_request_id uuid, p_company_id uuid, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  v_replay jsonb;
  l record;
  v_p public.inv_products;
  v_area text;
  v_opening date;
  v_available integer;
  v_take integer;
  v_existing public.inv_sales_lines;
  v_today date := (now() at time zone 'America/Santiago')::date;
  v_applied integer := 0;
  v_units integer := 0;
  v_already integer := 0;
  v_changed jsonb := '[]'::jsonb;
  v_no_product integer := 0;
  v_no_access integer := 0;
  v_before_opening integer := 0;
  v_short jsonb := '[]'::jsonb;
  v_machine uuid;
  v_cups integer;
  v_cs public.coffee_sales;
  v_machine_lines integer := 0;
  v_machine_units integer := 0;
  v_result jsonb;
begin
  select * into a from public.inv_actor(p_company_id);
  v_replay := public.inv_idem_begin(p_company_id, p_request_id, 'sales');
  if v_replay is not null then return v_replay; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    perform public.inv_fail('lines_required', 'El archivo no tiene ventas para aplicar.');
  end if;
  if jsonb_array_length(p_lines) > 3000 then
    perform public.inv_fail('too_many_lines', 'El archivo tiene demasiadas líneas. Sube un período más corto.');
  end if;

  for l in
    select (e->>'date')::date as sold_on, trim(e->>'code') as code, sum((e->>'qty')::integer) as qty
    from jsonb_array_elements(p_lines) e
    group by 1, 2
    order by 1, 2
  loop
    if l.sold_on is null or l.code is null or l.code = '' or l.qty is null or l.qty <= 0 then
      perform public.inv_fail('invalid_line', 'Hay una línea de ventas con fecha, código o cantidad no válidos.');
    end if;
    if l.sold_on > v_today then
      perform public.inv_fail('invalid_date', 'El archivo trae ventas con fecha futura.');
    end if;

    -- Los productos de una máquina de café no tienen stock: se registra la venta para cuadrarla con el numeral.
    select c.machine_id into v_machine
    from public.coffee_machine_codes c join public.coffee_machines cm on cm.id = c.machine_id and cm.active
    where c.company_id = p_company_id and c.pos_code = l.code;
    if found then
      if a.role <> 'ADMIN' and a.area is distinct from 'TIENDA' then v_no_access := v_no_access + 1; continue; end if;
      select * into v_cs from public.coffee_sales where company_id = p_company_id and sold_on = l.sold_on and pos_code = l.code;
      if found then
        if v_cs.qty = l.qty then v_already := v_already + 1;
        else
          v_changed := v_changed || jsonb_build_object('code', l.code, 'name', 'Máquina de café', 'date', l.sold_on,
            'before', v_cs.qty, 'now', l.qty);
        end if;
        continue;
      end if;
      insert into public.coffee_sales (company_id, machine_id, sold_on, pos_code, qty, request_id, created_by, created_by_name)
      values (p_company_id, v_machine, l.sold_on, l.code, l.qty, p_request_id, a.user_id, a.user_name);
      v_machine_lines := v_machine_lines + 1;
      v_machine_units := v_machine_units + l.qty;
      continue;
    end if;

    select * into v_p from public.inv_products where company_id = p_company_id and code = l.code and active;
    if not found then v_no_product := v_no_product + 1; continue; end if;
    select i.area into v_area from public.inv_inventories i where i.id = v_p.inventory_id and i.active;
    if v_area is null or (a.role <> 'ADMIN' and v_area is distinct from a.area) then
      v_no_access := v_no_access + 1; continue;
    end if;

    -- El conteo del día del saldo inicial ya incluye las ventas de ese día.
    select min((m.created_at at time zone 'America/Santiago')::date) into v_opening
    from public.inv_movements m where m.product_id = v_p.id and m.kind = 'opening';
    if v_opening is not null and l.sold_on <= v_opening then
      v_before_opening := v_before_opening + 1; continue;
    end if;

    select * into v_existing from public.inv_sales_lines
    where company_id = p_company_id and sold_on = l.sold_on and pos_code = l.code;
    if found then
      if v_existing.qty_reported = l.qty then v_already := v_already + 1;
      else
        v_changed := v_changed || jsonb_build_object('code', l.code, 'name', v_p.name, 'date', l.sold_on,
          'before', v_existing.qty_reported, 'now', l.qty);
      end if;
      continue;
    end if;

    select coalesce(sum(s.qty), 0)::integer into v_available from public.inv_stock s where s.product_id = v_p.id;
    v_take := least(l.qty, v_available);
    if v_take > 0 then
      perform public.inv_consume(p_company_id, v_p.inventory_id, v_p.id, null, null, v_take, 'sale', 'Venta POS',
        null, to_char(l.sold_on, 'YYYY-MM-DD'), gen_random_uuid(), null, null, p_request_id);
    end if;
    insert into public.inv_sales_lines (company_id, inventory_id, product_id, sold_on, pos_code, qty_reported, qty_applied,
                                        request_id, created_by, created_by_name)
    values (p_company_id, v_p.inventory_id, v_p.id, l.sold_on, l.code, l.qty, v_take, p_request_id, a.user_id, a.user_name);
    v_applied := v_applied + 1;
    v_units := v_units + v_take;
    if v_take < l.qty then
      v_short := v_short || jsonb_build_object('code', l.code, 'name', v_p.name, 'date', l.sold_on,
        'sold', l.qty, 'applied', v_take);
    end if;
  end loop;

  perform public.inv_log(p_company_id, 'sales.import', 'company', p_company_id,
    jsonb_build_object('lines', v_applied, 'units', v_units, 'short', jsonb_array_length(v_short)));
  v_result := jsonb_build_object(
    'applied_lines', v_applied, 'units_applied', v_units, 'already', v_already, 'changed', v_changed,
    'no_product', v_no_product, 'no_access', v_no_access, 'before_opening', v_before_opening, 'shortfalls', v_short,
    'machine_lines', v_machine_lines, 'machine_units', v_machine_units);
  return public.inv_idem_end(p_company_id, p_request_id, v_result);
end;
$$;
revoke all on function public.inv_apply_sales(uuid, uuid, jsonb) from public, anon;
grant execute on function public.inv_apply_sales(uuid, uuid, jsonb) to authenticated;
