revoke all on function public.tp_create_field_operation(uuid,text,date,text,numeric,text,numeric,text,text,jsonb,timestamptz,uuid) from public, anon;
grant execute on function public.tp_create_field_operation(uuid,text,date,text,numeric,text,numeric,text,text,jsonb,timestamptz,uuid) to authenticated, service_role;

revoke all on function public.tp_delete_field_operation(uuid) from public, anon;
grant execute on function public.tp_delete_field_operation(uuid) to authenticated, service_role;
