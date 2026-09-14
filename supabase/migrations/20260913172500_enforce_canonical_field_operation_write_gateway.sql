-- TarlaPusula canonical user-entry rule:
-- agricultural operations are written only through the shared RPCs.
-- Screens/components may read activities directly but cannot create a second
-- write path with their own insert/update/delete logic.

alter function public.tp_create_field_operation(
  uuid,text,date,text,numeric,text,numeric,text,text,jsonb,timestamptz,uuid
) security definer;

alter function public.tp_delete_field_operation(uuid) security definer;

revoke insert, update, delete, truncate
  on table public.activities
  from anon, authenticated;

grant select on table public.activities to authenticated;

revoke execute on function public.tp_create_field_operation(
  uuid,text,date,text,numeric,text,numeric,text,text,jsonb,timestamptz,uuid
) from public, anon;
revoke execute on function public.tp_delete_field_operation(uuid)
  from public, anon;

grant execute on function public.tp_create_field_operation(
  uuid,text,date,text,numeric,text,numeric,text,text,jsonb,timestamptz,uuid
) to authenticated, service_role;
grant execute on function public.tp_delete_field_operation(uuid)
  to authenticated, service_role;
