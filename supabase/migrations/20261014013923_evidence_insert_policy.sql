create policy "shiftcontrol_evidence_insert_for_members"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'shiftcontrol-evidence'
  and public.can_access_evidence_path(name)
);
