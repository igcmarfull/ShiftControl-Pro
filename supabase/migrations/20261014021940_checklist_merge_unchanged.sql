-- Corrección de la fase 1: al guardar una jefa, un checklist sin cambios se
-- conserva tal cual. Antes se le agregaba el campo area aunque nada hubiera
-- cambiado (sin pérdida de datos).

create or replace function public.sc_merge_checklists(p_remote jsonb, p_submitted jsonb, p_area text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_remote jsonb := case when jsonb_typeof(p_remote) = 'object' then p_remote else '{}'::jsonb end;
  v_submitted jsonb := case when jsonb_typeof(p_submitted) = 'object' then p_submitted else '{}'::jsonb end;
  v_result jsonb := '{}'::jsonb;
  v_key text;
  v_entry jsonb;
  v_previous jsonb;
  v_details jsonb;
  v_detail_key text;
  v_detail jsonb;
  v_previous_follow jsonb;
begin
  for v_key, v_entry in select key, value from jsonb_each(v_remote) loop
    if public.sc_checklist_area(v_key, v_entry) <> p_area
      or coalesce((v_entry->>'completed')::boolean, false)
      or not (v_submitted ? v_key)
      or v_submitted -> v_key = v_entry
    then
      v_result := v_result || jsonb_build_object(v_key, v_entry);
    end if;
  end loop;

  for v_key, v_entry in select key, value from jsonb_each(v_submitted) loop
    continue when v_result ? v_key or jsonb_typeof(v_entry) <> 'object';
    continue when public.sc_checklist_area(v_key, '{}'::jsonb) <> p_area;
    v_previous := v_remote -> v_key;
    v_entry := (v_entry - 'reviewedAt' - 'reviewedBy')
      || jsonb_build_object('area', p_area)
      || jsonb_strip_nulls(jsonb_build_object(
        'reviewedAt', v_previous->'reviewedAt',
        'reviewedBy', v_previous->'reviewedBy'
      ));
    if coalesce(v_entry->>'reviewStatus', 'pending_review') <> 'pending_review' then
      v_entry := (v_entry - 'reviewStatus')
        || jsonb_strip_nulls(jsonb_build_object('reviewStatus', v_previous->'reviewStatus'));
    end if;
    if jsonb_typeof(v_entry->'details') = 'object' then
      v_details := '{}'::jsonb;
      for v_detail_key, v_detail in select key, value from jsonb_each(v_entry->'details') loop
        v_previous_follow := v_previous #> array['details', v_detail_key, 'followUp'];
        if jsonb_typeof(v_detail) = 'object' then
          if v_previous_follow is not null then
            v_detail := v_detail || jsonb_build_object('followUp', v_previous_follow);
          elsif v_detail ? 'followUp' then
            v_detail := v_detail || jsonb_build_object('followUp', jsonb_build_object(
              'status', 'open',
              'openedAt', coalesce(v_detail #> '{followUp,openedAt}', to_jsonb(now()))
            ));
          end if;
        end if;
        v_details := v_details || jsonb_build_object(v_detail_key, v_detail);
      end loop;
      v_entry := v_entry || jsonb_build_object('details', v_details);
    end if;
    v_result := v_result || jsonb_build_object(v_key, v_entry);
  end loop;

  return v_result;
end;
$$;

revoke all on function public.sc_merge_checklists(jsonb, jsonb, text) from public, anon, authenticated;
