-- Comisiones de combustible: litros vendidos por día y parámetros del contrato (solo administrador).
--
--   1. fuel_sales: litros de un día en tres líneas separadas: retail (gasolinas y diésel), flota y kerosene.
--      Una fila por empresa y día. El pivote de volumen del contrato cuenta solo el retail.
--   2. fuel_contract: parámetros vigentes del contrato (una fila por empresa): pivote, tarifas, fijos, kerosene,
--      flota e IVA, con su período de vigencia. Se siembra con el addendum C-3602-04 (01-07-2026 al 31-12-2026).
--   3. fuel_sales_save y fuel_contract_save: únicas vías de escritura; exigen administrador y dejan registro en
--      inv_audit. Las tablas solo se leen por RLS y solo el administrador.
--
-- La comisión se calcula en la pantalla (src/modules/fuel/fuel-calc.js); aquí solo se guardan los datos.
-- Reversión: supabase/rollback/20261019140000_fuel_commissions.rollback.sql

create function public.fuel_can_access(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_memberships m
    where m.company_id = p_company_id and m.user_id = (select auth.uid()) and m.active = true and m.role = 'ADMIN'
  );
$$;
revoke all on function public.fuel_can_access(uuid) from public, anon;
grant execute on function public.fuel_can_access(uuid) to authenticated;

create table public.fuel_sales (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  sold_on date not null,
  retail_l integer not null default 0 check (retail_l between 0 and 2000000),
  flota_l integer not null default 0 check (flota_l between 0 and 2000000),
  kerosene_l integer not null default 0 check (kerosene_l between 0 and 2000000),
  entered_by uuid,
  entered_by_name text,
  updated_at timestamptz not null default now(),
  unique (company_id, sold_on)
);

create table public.fuel_contract (
  company_id uuid primary key references public.companies (id) on delete cascade,
  valid_from date not null,
  valid_to date not null,
  pivot_l integer not null check (pivot_l > 0),
  low_rate numeric(8, 2) not null check (low_rate >= 0),
  low_fixed bigint not null check (low_fixed >= 0),
  high_rate numeric(8, 2) not null check (high_rate >= 0),
  high_fixed bigint not null check (high_fixed >= 0),
  kero_rate numeric(8, 2) not null check (kero_rate >= 0),
  flota_rate numeric(8, 2) not null check (flota_rate >= 0),
  iva_pct numeric(5, 2) not null default 19 check (iva_pct between 0 and 100),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  check (valid_to >= valid_from)
);

alter table public.fuel_sales enable row level security;
alter table public.fuel_contract enable row level security;
revoke all on table public.fuel_sales from anon, authenticated;
revoke all on table public.fuel_contract from anon, authenticated;
grant select on table public.fuel_sales to authenticated;
grant select on table public.fuel_contract to authenticated;
create policy fuel_sales_select on public.fuel_sales for select to authenticated using (public.fuel_can_access(company_id));
create policy fuel_contract_select on public.fuel_contract for select to authenticated using (public.fuel_can_access(company_id));

-- Contrato vigente: addendum C-3602-04 (Esmax Distribución SpA – Prosercom SpA), julio a diciembre de 2026.
insert into public.fuel_contract (company_id, valid_from, valid_to, pivot_l, low_rate, low_fixed, high_rate, high_fixed,
                                  kero_rate, flota_rate, iva_pct)
select c.id, date '2026-07-01', date '2026-12-31', 450000, 19.9, 5000000, 35, 13956000, 30, 5, 19
from public.companies c
on conflict (company_id) do nothing;

create function public.fuel_sales_save(p_company_id uuid, p_sold_on date, p_retail integer, p_flota integer, p_kerosene integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  v_today date := (now() at time zone 'America/Santiago')::date;
  v_row public.fuel_sales;
begin
  select * into a from public.inv_actor(p_company_id);
  if a.role <> 'ADMIN' then
    perform public.inv_fail('forbidden', 'Solo el administrador carga los litros.', null, '42501');
  end if;
  if p_sold_on is null or p_sold_on > v_today or p_sold_on < date '2020-01-01' then
    perform public.inv_fail('invalid_date', 'La fecha no puede ser futura.');
  end if;
  if p_retail is null or p_flota is null or p_kerosene is null
     or p_retail < 0 or p_flota < 0 or p_kerosene < 0
     or p_retail > 2000000 or p_flota > 2000000 or p_kerosene > 2000000 then
    perform public.inv_fail('invalid_liters', 'Los litros deben ser números enteros entre 0 y 2.000.000.');
  end if;
  insert into public.fuel_sales (company_id, sold_on, retail_l, flota_l, kerosene_l, entered_by, entered_by_name)
  values (p_company_id, p_sold_on, p_retail, p_flota, p_kerosene, a.user_id, a.user_name)
  on conflict (company_id, sold_on) do update
    set retail_l = excluded.retail_l, flota_l = excluded.flota_l, kerosene_l = excluded.kerosene_l,
        entered_by = excluded.entered_by, entered_by_name = excluded.entered_by_name, updated_at = now()
  returning * into v_row;
  perform public.inv_log(p_company_id, 'fuel.sales', 'company', p_company_id,
    jsonb_build_object('date', p_sold_on, 'retail', p_retail, 'flota', p_flota, 'kerosene', p_kerosene));
  return to_jsonb(v_row);
end;
$$;
revoke all on function public.fuel_sales_save(uuid, date, integer, integer, integer) from public, anon;
grant execute on function public.fuel_sales_save(uuid, date, integer, integer, integer) to authenticated;

create function public.fuel_contract_save(p_company_id uuid, p_contract jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  v_row public.fuel_contract;
begin
  select * into a from public.inv_actor(p_company_id);
  if a.role <> 'ADMIN' then
    perform public.inv_fail('forbidden', 'Solo el administrador cambia el contrato.', null, '42501');
  end if;
  begin
    insert into public.fuel_contract (company_id, valid_from, valid_to, pivot_l, low_rate, low_fixed, high_rate, high_fixed,
                                      kero_rate, flota_rate, iva_pct, updated_by)
    values (p_company_id, (p_contract->>'valid_from')::date, (p_contract->>'valid_to')::date, (p_contract->>'pivot_l')::integer,
            (p_contract->>'low_rate')::numeric, (p_contract->>'low_fixed')::bigint, (p_contract->>'high_rate')::numeric,
            (p_contract->>'high_fixed')::bigint, (p_contract->>'kero_rate')::numeric, (p_contract->>'flota_rate')::numeric,
            coalesce((p_contract->>'iva_pct')::numeric, 19), a.user_id)
    on conflict (company_id) do update
      set valid_from = excluded.valid_from, valid_to = excluded.valid_to, pivot_l = excluded.pivot_l,
          low_rate = excluded.low_rate, low_fixed = excluded.low_fixed, high_rate = excluded.high_rate,
          high_fixed = excluded.high_fixed, kero_rate = excluded.kero_rate, flota_rate = excluded.flota_rate,
          iva_pct = excluded.iva_pct, updated_by = excluded.updated_by, updated_at = now()
    returning * into v_row;
  exception when others then
    if sqlstate in ('22P02', '22007', '23514', '22003', '22008') then
      perform public.inv_fail('invalid_contract', 'Revisa los valores del contrato: fechas, tarifas y montos deben ser válidos.');
    end if;
    raise;
  end;
  perform public.inv_log(p_company_id, 'fuel.contract', 'company', p_company_id, to_jsonb(v_row) - 'updated_by');
  return to_jsonb(v_row);
end;
$$;
revoke all on function public.fuel_contract_save(uuid, jsonb) from public, anon;
grant execute on function public.fuel_contract_save(uuid, jsonb) to authenticated;
