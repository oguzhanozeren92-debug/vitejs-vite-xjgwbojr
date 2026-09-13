alter table public.activities
  add column if not exists inventory_product_id uuid,
  add column if not exists inventory_consumed_amount numeric,
  add column if not exists inventory_consumed_unit text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'activities_inventory_product_id_fkey'
      and conrelid = 'public.activities'::regclass
  ) then
    alter table public.activities
      add constraint activities_inventory_product_id_fkey
      foreign key (inventory_product_id)
      references public.farm_inventory_products(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'activities_inventory_consumed_amount_check'
      and conrelid = 'public.activities'::regclass
  ) then
    alter table public.activities
      add constraint activities_inventory_consumed_amount_check
      check (inventory_consumed_amount is null or inventory_consumed_amount >= 0);
  end if;
end;
$$;

create or replace function public.tp_delete_field_operation(p_activity_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_activity public.activities%rowtype;
begin
  if v_user_id is null then
    raise exception 'Oturum gerekli.';
  end if;

  select * into v_activity
  from public.activities a
  where a.id = p_activity_id
    and a.user_id = v_user_id
  for update;

  if not found then return false; end if;

  if v_activity.inventory_product_id is not null
     and v_activity.inventory_consumed_amount is not null
     and v_activity.inventory_consumed_amount > 0 then
    update public.farm_inventory_products
    set remaining_amount = remaining_amount + v_activity.inventory_consumed_amount,
        updated_at = now()
    where id = v_activity.inventory_product_id
      and user_id = v_user_id;
  end if;

  delete from public.activities
  where id = v_activity.id
    and user_id = v_user_id;

  return true;
end;
$$;

revoke all on function public.tp_delete_field_operation(uuid) from public, anon;
grant execute on function public.tp_delete_field_operation(uuid) to authenticated, service_role;
