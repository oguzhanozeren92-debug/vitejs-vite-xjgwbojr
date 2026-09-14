-- Kullanıcı ürün/yıl bilgisini yalnız bir kez tarlaya girer.
-- fields = güncel özet, field_seasons = sezon geçmişi/season-engine kaynağı.
-- İkinci bir form istemek yerine sezon satırı otomatik türetilir.

create unique index if not exists field_seasons_field_year_uidx
  on public.field_seasons(field_id, year);

create or replace function public.tp_sync_field_summary_to_season()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if new.user_id is null
     or new.id is null
     or new.season is null
     or nullif(trim(coalesce(new.crop, '')), '') is null then
    return new;
  end if;

  insert into public.field_seasons(
    field_id,
    user_id,
    year,
    crop
  ) values (
    new.id,
    new.user_id,
    new.season,
    trim(new.crop)
  )
  on conflict (field_id, year)
  do update set
    crop = excluded.crop,
    user_id = excluded.user_id;

  return new;
end;
$$;

revoke execute on function public.tp_sync_field_summary_to_season()
  from public, anon, authenticated;
grant execute on function public.tp_sync_field_summary_to_season()
  to service_role;

drop trigger if exists trg_tp_sync_field_summary_to_season on public.fields;
create trigger trg_tp_sync_field_summary_to_season
after insert or update of crop, season on public.fields
for each row
execute function public.tp_sync_field_summary_to_season();

insert into public.field_seasons(field_id,user_id,year,crop)
select f.id,f.user_id,f.season,trim(f.crop)
from public.fields f
where f.season is not null
  and nullif(trim(coalesce(f.crop,'')), '') is not null
on conflict (field_id, year)
do update set
  crop = excluded.crop,
  user_id = excluded.user_id;
