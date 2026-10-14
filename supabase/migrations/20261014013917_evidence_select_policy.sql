create policy "shiftcontrol_evidence_select_for_members"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'shiftcontrol-evidence'
  and public.can_access_evidence_path(name)
);
