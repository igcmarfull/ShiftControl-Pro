-- Bucket privado para fotos de checklists y respaldos de facturas.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shiftcontrol-evidence',
  'shiftcontrol-evidence',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
