create or replace function public.tp_canonical_activity_type(p_value text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v text := lower(trim(coalesce(p_value, '')));
begin
  v := replace(v, 'ı', 'i');
  v := replace(v, 'ğ', 'g');
  v := replace(v, 'ü', 'u');
  v := replace(v, 'ş', 's');
  v := replace(v, 'ö', 'o');
  v := replace(v, 'ç', 'c');

  return case
    when v in ('surme','surum','toprak isleme','toprak islemesi') then 'Sürme'
    when v in ('gubre','gubreleme','gubre uygulamasi') then 'Gübreleme'
    when v in ('ilac','ilaclama','zirai ilaclama') then 'İlaçlama'
    when v in ('sulama','su verme') then 'Sulama'
    when v in ('ekim','dikim','ekim / dikim','ekim/dikim') then 'Ekim / Dikim'
    when v in ('hasat','hasat etme') then 'Hasat'
    when v in ('saha kontrolu','tarla kontrolu','kontrol') then 'Saha Kontrolü'
    when v = 'budama' then 'Budama'
    when v in ('capalama','capa') then 'Çapalama'
    when v in ('diger','diğer') then 'Diğer'
    else nullif(trim(coalesce(p_value, '')), '')
  end;
end;
$$;

create or replace function public.tp_normalize_activity_row()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.activity_type := public.tp_canonical_activity_type(new.activity_type);
  if new.activity_type is null then
    raise exception 'İşlem türü gerekli.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tp_normalize_activity_row on public.activities;
create trigger trg_tp_normalize_activity_row
before insert or update of activity_type on public.activities
for each row execute function public.tp_normalize_activity_row();

create or replace function public.tp_create_field_operation(
  p_field_id uuid,
  p_activity_type text,
  p_activity_date date,
  p_product_name text default null,
  p_quantity numeric default null,
  p_unit text default null,
  p_cost numeric default null,
  p_notes text default null,
  p_photo_path text default null,
  p_ai_analysis jsonb default null,
  p_ai_analyzed_at timestamptz default null,
  p_inventory_product_id uuid default null
)
returns setof public.activities
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_field_area numeric;
  v_inventory public.farm_inventory_products%rowtype;
  v_operation_unit text;
  v_inventory_unit text;
  v_total_quantity numeric;
  v_base_quantity numeric;
  v_consumed numeric;
  v_product_name text;
  v_title text;
  v_activity_id uuid;
  v_activity_type text;
begin
  if v_user_id is null then raise exception 'Oturum gerekli.'; end if;

  v_activity_type := public.tp_canonical_activity_type(p_activity_type);
  if p_field_id is null or p_activity_date is null or v_activity_type is null then
    raise exception 'Tarla, işlem türü ve tarih gerekli.';
  end if;

  select f.area_decare into v_field_area
  from public.fields f
  where f.id = p_field_id and f.user_id = v_user_id;
  if not found then raise exception 'Tarla bulunamadı veya erişim yetkin yok.'; end if;

  if p_quantity is not null and p_quantity < 0 then raise exception 'Miktar sıfırdan küçük olamaz.'; end if;
  if p_cost is not null and p_cost < 0 then raise exception 'Maliyet sıfırdan küçük olamaz.'; end if;

  v_product_name := nullif(trim(coalesce(p_product_name, '')), '');
  v_consumed := null;

  if p_inventory_product_id is not null then
    if v_activity_type not in ('Gübreleme', 'İlaçlama') then
      raise exception 'Depo ürünü yalnız gübreleme veya ilaçlama işlemine bağlanabilir.';
    end if;

    select * into v_inventory
    from public.farm_inventory_products p
    where p.id = p_inventory_product_id and p.user_id = v_user_id
    for update;
    if not found then raise exception 'Seçilen depo ürünü bulunamadı.'; end if;

    if (v_activity_type = 'Gübreleme' and v_inventory.category <> 'gubre')
       or (v_activity_type = 'İlaçlama' and v_inventory.category <> 'ilac') then
      raise exception 'Seçilen depo ürünü işlem türüyle uyumlu değil.';
    end if;

    if p_quantity is null or p_quantity <= 0 then raise exception 'Depodan düşmek için kullanılan miktarı gir.'; end if;

    v_operation_unit := lower(replace(trim(coalesce(p_unit, '')), ' ', ''));
    v_inventory_unit := lower(replace(trim(coalesce(v_inventory.unit, '')), ' ', ''));
    v_total_quantity := p_quantity;

    if right(v_operation_unit, 3) = '/da' then
      if v_field_area is null or v_field_area <= 0 then
        raise exception 'Dekara miktarı toplam stoğa çevirmek için tarla alanı gerekli.';
      end if;
      v_total_quantity := p_quantity * v_field_area;
      v_operation_unit := left(v_operation_unit, length(v_operation_unit) - 3);
    end if;

    if v_operation_unit = 'kg' then
      v_base_quantity := v_total_quantity * 1000;
      if v_inventory_unit = 'kg' then v_consumed := v_base_quantity / 1000;
      elsif v_inventory_unit in ('g','gr') then v_consumed := v_base_quantity;
      else raise exception 'İşlem birimi ile depo ürününün birimi uyumlu değil.'; end if;
    elsif v_operation_unit in ('g','gr') then
      v_base_quantity := v_total_quantity;
      if v_inventory_unit = 'kg' then v_consumed := v_base_quantity / 1000;
      elsif v_inventory_unit in ('g','gr') then v_consumed := v_base_quantity;
      else raise exception 'İşlem birimi ile depo ürününün birimi uyumlu değil.'; end if;
    elsif v_operation_unit in ('l','lt') then
      v_base_quantity := v_total_quantity * 1000;
      if v_inventory_unit in ('l','lt') then v_consumed := v_base_quantity / 1000;
      elsif v_inventory_unit = 'ml' then v_consumed := v_base_quantity;
      else raise exception 'İşlem birimi ile depo ürününün birimi uyumlu değil.'; end if;
    elsif v_operation_unit = 'ml' then
      v_base_quantity := v_total_quantity;
      if v_inventory_unit in ('l','lt') then v_consumed := v_base_quantity / 1000;
      elsif v_inventory_unit = 'ml' then v_consumed := v_base_quantity;
      else raise exception 'İşlem birimi ile depo ürününün birimi uyumlu değil.'; end if;
    else
      raise exception 'Bu işlem birimi depo stoğuna otomatik çevrilemiyor.';
    end if;

    if v_inventory.remaining_amount < v_consumed then
      raise exception 'Depoda yeterli stok yok. Kalan: % %.', v_inventory.remaining_amount, v_inventory.unit;
    end if;

    update public.farm_inventory_products
    set remaining_amount = remaining_amount - v_consumed, updated_at = now()
    where id = v_inventory.id and user_id = v_user_id;

    if v_product_name is null then v_product_name := v_inventory.product_name; end if;
  end if;

  v_title := case v_activity_type
    when 'Saha Kontrolü' then 'Saha kontrolü yapıldı'
    when 'Ekim / Dikim' then 'Ekim / dikim yapıldı'
    when 'Diğer' then 'Tarla işlemi kaydedildi'
    else v_activity_type || ' yapıldı'
  end;

  insert into public.activities (
    user_id, field_id, field_section_id, activity_type, title, activity_date,
    product_name, quantity, unit, cost, notes, photo_path,
    ai_analysis, ai_analyzed_at,
    inventory_product_id, inventory_consumed_amount, inventory_consumed_unit
  ) values (
    v_user_id, p_field_id, null, v_activity_type, v_title, p_activity_date,
    v_product_name, p_quantity, nullif(trim(coalesce(p_unit, '')), ''), p_cost,
    nullif(trim(coalesce(p_notes, '')), ''), nullif(trim(coalesce(p_photo_path, '')), ''),
    p_ai_analysis,
    case when p_ai_analysis is null then null else coalesce(p_ai_analyzed_at, now()) end,
    p_inventory_product_id, v_consumed,
    case when p_inventory_product_id is null then null else v_inventory.unit end
  ) returning id into v_activity_id;

  return query select a.* from public.activities a where a.id = v_activity_id and a.user_id = v_user_id;
end;
$$;