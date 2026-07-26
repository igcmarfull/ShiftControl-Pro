alter table public.app_state
add column company_id uuid;

do $$
declare
  company_count integer;
  initial_company_id uuid;
begin
  if exists (
    select 1
    from public.app_state
    where company_id is null
  ) then
    select count(*)
    into company_count
    from public.companies;

    if company_count <> 1 then
      raise exception
        'app_state contiene datos sin empresa y existen % empresas; asigne company_id antes de continuar',
        company_count;
    end if;

    select id
    into initial_company_id
    from public.companies
    limit 1;

    update public.app_state
    set company_id = initial_company_id
    where company_id is null;
  end if;
end;
$$;

alter table public.app_state
alter column company_id set not null;

alter table public.app_state
add constraint app_state_company_id_fkey
foreign key (company_id)
references public.companies(id)
on delete cascade;

do $$
declare
  primary_key_name text;
begin
  select constraint_name
  into primary_key_name
  from information_schema.table_constraints
  where table_schema = 'public'
    and table_name = 'app_state'
    and constraint_type = 'PRIMARY KEY';

  if primary_key_name is not null then
    execute format(
      'alter table public.app_state drop constraint %I',
      primary_key_name
    );
  end if;
end;
$$;

alter table public.app_state
add primary key (company_id, key);

alter table public.app_state enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'app_state'
  loop
    execute format(
      'drop policy %I on public.app_state',
      existing_policy.policyname
    );
  end loop;
end;
$$;

revoke all on table public.app_state from anon, authenticated;
grant select, insert, update on table public.app_state to authenticated;

create policy "app_state_select_for_active_members"
on public.app_state
for select
to authenticated
using (
  exists (
    select 1
    from public.company_memberships membership
    where membership.company_id = app_state.company_id
      and membership.user_id = (select auth.uid())
      and membership.active = true
  )
);

create policy "app_state_insert_for_active_members"
on public.app_state
for insert
to authenticated
with check (
  exists (
    select 1
    from public.company_memberships membership
    where membership.company_id = app_state.company_id
      and membership.user_id = (select auth.uid())
      and membership.active = true
  )
);

create policy "app_state_update_for_active_members"
on public.app_state
for update
to authenticated
using (
  exists (
    select 1
    from public.company_memberships membership
    where membership.company_id = app_state.company_id
      and membership.user_id = (select auth.uid())
      and membership.active = true
  )
)
with check (
  exists (
    select 1
    from public.company_memberships membership
    where membership.company_id = app_state.company_id
      and membership.user_id = (select auth.uid())
      and membership.active = true
  )
);
