-- handle_new_auth_user es la función del trigger on_auth_user_created: crea
-- el perfil de cada usuario nuevo. No debe poder invocarse por la API
-- (/rest/v1/rpc/handle_new_auth_user), como advierte el linter de Supabase.
-- Postgres no exige EXECUTE al disparar un trigger, así que el registro de
-- usuarios sigue funcionando.

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
