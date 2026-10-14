-- Contacto de las jefaturas (correo y teléfono de contacto).
--
-- Se guarda en company_memberships, no en profiles: profiles la leen todos los
-- compañeros de empresa, y estos datos solo deben verlos los administradores
-- (política company_memberships_select_admin) y la propia persona
-- (company_memberships_select_own_active).
--
-- El correo de contacto es informativo; no cambia el correo de inicio de sesión.
-- No existen políticas de escritura sobre company_memberships: el único camino de
-- escritura es update_chief_contact(), que exige ser administrador activo.
--
-- Reversión:
--   drop function if exists public.update_chief_contact(text,text,text);
--   alter table public.company_memberships drop column if exists contact_email, drop column if exists contact_phone;

alter table public.company_memberships
  add column if not exists contact_email text,
  add column if not exists contact_phone text;

alter table public.company_memberships
  drop constraint if exists company_memberships_contact_email_format,
  add constraint company_memberships_contact_email_format
    check (contact_email is null or (length(contact_email) <= 254 and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  drop constraint if exists company_memberships_contact_phone_format,
  add constraint company_memberships_contact_phone_format
    check (contact_phone is null or (length(contact_phone) <= 30 and contact_phone ~ '^[0-9+()\-\s]{6,30}$'));

create or replace function public.update_chief_contact(p_area text, p_email text, p_phone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_area text := case upper(coalesce(nullif(trim(p_area), ''), 'ISLA')) when 'TIENDA' then 'TIENDA' else 'ISLA' end;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_updated int;
begin
  select company_id into v_company
  from public.company_memberships
  where user_id = auth.uid() and role = 'ADMIN' and active = true
  limit 1;

  if v_company is null then
    raise exception 'Solo un administrador puede editar el contacto de una jefatura.' using errcode = '42501';
  end if;

  update public.company_memberships
  set contact_email = v_email,
      contact_phone = v_phone,
      updated_at = now()
  where company_id = v_company
    and role = 'CHIEF'
    and active = true
    and case when v_area = 'TIENDA' then area = 'TIENDA' else coalesce(area, 'ESTACION') in ('ESTACION', 'ISLA') end;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'No hay una jefatura activa en esa área.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.update_chief_contact(text, text, text) from public, anon;
grant execute on function public.update_chief_contact(text, text, text) to authenticated;
