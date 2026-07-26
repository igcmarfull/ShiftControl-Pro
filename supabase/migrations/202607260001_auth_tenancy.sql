create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_memberships (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('ADMIN', 'CHIEF')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, user_id),
  unique (user_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger companies_set_updated_at
before update on public.companies
for each row execute procedure public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

create trigger company_memberships_set_updated_at
before update on public.company_memberships
for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuario'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

insert into public.profiles (id, display_name)
select
  auth_user.id,
  coalesce(
    nullif(trim(auth_user.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(auth_user.email, ''), '@', 1), ''),
    'Usuario'
  )
from auth.users auth_user
on conflict (id) do nothing;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.company_memberships enable row level security;

revoke all on table public.companies from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.company_memberships from anon, authenticated;

grant select on table public.companies to authenticated;
grant select on table public.profiles to authenticated;
grant select on table public.company_memberships to authenticated;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "company_memberships_select_own_active"
on public.company_memberships
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and active = true
);

create policy "companies_select_for_active_members"
on public.companies
for select
to authenticated
using (
  active = true
  and exists (
    select 1
    from public.company_memberships membership
    where membership.company_id = companies.id
      and membership.user_id = (select auth.uid())
      and membership.active = true
  )
);
