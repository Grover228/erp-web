-- New selectable material for the NEXT cut of an existing black beanie production order.
-- Existing production orders, historical receipts, batches and stock movements are preserved.
create table if not exists public.production_order_fabric_settings (
  production_order_id uuid primary key references public.production_orders(id) on delete cascade,
  material_id uuid not null references public.materials(id),
  source text not null check (source in ('sleeve','roll')),
  selected_by uuid references auth.users(id),
  cut_quantity_at_switch numeric not null default 0,
  selected_at timestamptz not null default now()
);
create index if not exists production_order_fabric_settings_material_idx on public.production_order_fabric_settings(material_id);
alter table public.production_order_fabric_settings enable row level security;
drop policy if exists "ERP users can view selected cutting fabric" on public.production_order_fabric_settings;
create policy "ERP users can view selected cutting fabric" on public.production_order_fabric_settings
 for select to authenticated using ((select auth.uid()) is not null);
revoke all on public.production_order_fabric_settings from public, anon, authenticated;
grant select on public.production_order_fabric_settings to authenticated;
grant all on public.production_order_fabric_settings to service_role;

create table if not exists public.production_order_fabric_switches (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid not null references public.production_orders(id) on delete cascade,
  previous_material_id uuid not null references public.materials(id),
  selected_material_id uuid not null references public.materials(id),
  completed_cut_quantity numeric not null,
  remaining_cut_quantity numeric not null,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);
create index if not exists production_order_fabric_switches_order_idx
  on public.production_order_fabric_switches(production_order_id,changed_at);
alter table public.production_order_fabric_switches enable row level security;
drop policy if exists "ERP users can view cutting fabric switches" on public.production_order_fabric_switches;
create policy "ERP users can view cutting fabric switches" on public.production_order_fabric_switches
  for select to authenticated using ((select auth.uid()) is not null);
revoke all on public.production_order_fabric_switches from public, anon, authenticated;
grant select on public.production_order_fabric_switches to authenticated;
grant all on public.production_order_fabric_switches to service_role;

create or replace function public.set_cut_fabric_source(p_order_id uuid,p_source text)
returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_order record;
  v_cut record;
  v_sleeve record;
  v_roll record;
  v_target uuid;
  v_previous uuid;
  v_rate numeric;
  v_cut_qty numeric;
  v_remaining_qty numeric;
  v_remaining_metres numeric;
  v_used_sleeve_metres numeric;
  v_used_roll_metres numeric;
  v_other_materials numeric;
  v_reserved_kg numeric;
  v_available_kg numeric;
  v_required_kg numeric;
  v_expected_reservation numeric;
  v_old_factor numeric;
  v_fabric record;
  v_target_metres numeric;
  v_existing_price numeric;
  v_is_existing boolean;
begin
  if v_actor is null then raise exception 'Необходим вход в ERP'; end if;
  if not exists (
    select 1 from public.employee_shifts sh
    where sh.user_id=v_actor and sh.status='open' and not coalesce(sh.is_paused,false)
  ) then
    raise exception 'Для смены ткани открой рабочую смену';
  end if;
  if p_source not in ('sleeve','roll') or p_source is null then
    raise exception 'Нужно выбрать рукав или рулон';
  end if;

  select * into v_order from public.production_orders
  where id=p_order_id for update;
  if not found or v_order.status not in ('draft','ordered','in_progress') then
    raise exception 'Производственный заказ недоступен для переключения ткани';
  end if;
  if not exists (
    select 1 from public.products
    where id=v_order.product_id and article ~* '^bini-black(-|$)'
  ) then
    raise exception 'Переключение доступно только для чёрных шапок бини';
  end if;

  select * into v_cut from public.production_order_operations
   where production_order_id=p_order_id and operation_name ilike '%раскро%'
   order by sort_order limit 1 for update;
  if not found then raise exception 'Операция раскроя в заказе не найдена'; end if;
  if v_cut.status='in_progress' then
    raise exception 'Раскрой уже начат. Сначала сохрани текущую пачку, затем переключи ткань';
  end if;
  v_cut_qty := coalesce(v_cut.completed_quantity,0);
  v_remaining_qty := v_order.quantity-v_cut_qty;
  if v_remaining_qty <= 0 or v_cut_qty < 0 then
    raise exception 'Весь заказ уже раскроен или количество некорректно';
  end if;

  select id,article,default_price,production_units_per_purchase_unit into v_sleeve
  from public.materials where article='кулирка-черный' and is_active=true;
  select id,article,default_price,production_units_per_purchase_unit into v_roll
  from public.materials where article='кулирка-черный-рулон-185-190' and is_active=true;
  if v_sleeve.id is null or v_roll.id is null or
     coalesce(v_sleeve.production_units_per_purchase_unit,0)<=0 or
     coalesce(v_roll.production_units_per_purchase_unit,0)<=0 then
    raise exception 'Не найдены действующие материалы рукав/рулон или коэффициенты единиц';
  end if;

  select tcm.quantity into v_rate
  from public.tech_card_materials tcm
  where tcm.tech_card_id=v_order.tech_card_id and tcm.material_id=v_sleeve.id;
  if v_rate is null or v_rate<=0 then
    raise exception 'В техкарте не найден исходный расход чёрного рукава';
  end if;
  if (select count(*) from public.tech_card_materials
      where tech_card_id=v_order.tech_card_id and material_id=v_sleeve.id) <> 1 then
    raise exception 'В техкарте несколько строк чёрной ткани';
  end if;
  if exists (
    select 1 from public.production_order_materials
    where production_order_id=p_order_id
      and material_id not in (v_sleeve.id,v_roll.id)
  ) then
    raise exception 'У заказа дополнительные материалы; требуется отдельная проверка';
  end if;

  select coalesce(sum(-sm.quantity * m.production_units_per_purchase_unit),0)
    into v_used_sleeve_metres
    from public.stock_movements sm
    join public.materials m on m.id=sm.material_id
    where sm.production_order_id=p_order_id and sm.movement_type='production_write_off'
      and sm.item_type='material' and sm.source_document_type='production_cut'
      and sm.material_id=v_sleeve.id;
  select coalesce(sum(-sm.quantity * m.production_units_per_purchase_unit),0)
    into v_used_roll_metres
    from public.stock_movements sm
    join public.materials m on m.id=sm.material_id
    where sm.production_order_id=p_order_id and sm.movement_type='production_write_off'
      and sm.item_type='material' and sm.source_document_type='production_cut'
      and sm.material_id=v_roll.id;
  select coalesce(sum(abs(sm.quantity)),0) into v_other_materials
    from public.stock_movements sm
    where sm.production_order_id=p_order_id and sm.movement_type='production_write_off'
      and sm.item_type='material'
      and (sm.source_document_type is distinct from 'production_cut'
           or sm.material_id not in (v_sleeve.id,v_roll.id));
  if v_other_materials>0.0000001 or abs(v_used_sleeve_metres+v_used_roll_metres-v_cut_qty*v_rate)>0.001 then
    raise exception 'Списания ткани не сходятся с раскроем; переключение остановлено';
  end if;

  v_target := case when p_source='roll' then v_roll.id else v_sleeve.id end;
  select material_id into v_previous from public.production_order_fabric_settings
    where production_order_id=p_order_id;
  if v_previous is null then
    select r.material_id into v_previous
      from public.stock_reservations r
      where r.production_order_id=p_order_id and r.item_type='material'
        and r.status='active' and r.material_id in (v_sleeve.id,v_roll.id)
      order by r.created_at limit 1;
  end if;
  if v_previous is null then
    select pm.material_id into v_previous
      from public.production_order_materials pm
      where pm.production_order_id=p_order_id
        and pm.material_id in (v_sleeve.id,v_roll.id)
      order by pm.total_quantity desc limit 1;
  end if;
  if v_previous is null then raise exception 'Не найден текущий источник ткани заказа'; end if;
  if v_previous=v_target then
    return jsonb_build_object('changed',false,'source',p_source,'cut_quantity',v_cut_qty,
      'remaining_quantity',v_remaining_qty,'message','Материал уже выбран');
  end if;

  v_remaining_metres := v_remaining_qty*v_rate;
  v_old_factor := case when v_previous=v_roll.id
    then v_roll.production_units_per_purchase_unit else v_sleeve.production_units_per_purchase_unit end;
  v_expected_reservation := v_remaining_metres/v_old_factor;
  select coalesce(sum(quantity),0) into v_reserved_kg from public.stock_reservations
    where production_order_id=p_order_id and item_type='material'
    and status='active' and material_id in (v_sleeve.id,v_roll.id);
  if abs(v_reserved_kg-v_expected_reservation)>0.005 then
    raise exception 'Резерв старой ткани не соответствует остатку заказа: % / % кг',
      round(v_reserved_kg,4),round(v_expected_reservation,4);
  end if;

  v_required_kg := v_remaining_metres /
    (case when v_target=v_roll.id then v_roll.production_units_per_purchase_unit else v_sleeve.production_units_per_purchase_unit end);
  select coalesce(sum(quantity_available),0) into v_available_kg
    from public.stock_available
    where item_type='material' and material_id=v_target;
  if v_available_kg + 0.0000001 < v_required_kg then
    raise exception 'Недостаточно выбранной ткани: нужно % кг, свободно % кг',
      round(v_required_kg,3),round(v_available_kg,3);
  end if;

  -- Existing material movements are never edited. Only future allocation,
  -- existing order-level cost plan and still-active reservations are changed.
  for v_fabric in
    select id,default_price from public.materials where id in (v_sleeve.id,v_roll.id)
  loop
    v_target_metres := (case when v_fabric.id=v_sleeve.id
      then v_used_sleeve_metres else v_used_roll_metres end)
      + (case when v_fabric.id=v_target then v_remaining_metres else 0 end);
    select exists(select 1 from public.production_order_materials
      where production_order_id=p_order_id and material_id=v_fabric.id) into v_is_existing;
    if v_is_existing then
      update public.production_order_materials
        set quantity_per_unit=v_rate,total_quantity=v_target_metres
        where production_order_id=p_order_id and material_id=v_fabric.id;
    elsif v_target_metres>0 then
      insert into public.production_order_materials
        (production_order_id,material_id,quantity_per_unit,total_quantity,planned_price,comment)
        values(p_order_id,v_fabric.id,v_rate,v_target_metres,
          coalesce(v_fabric.default_price,0),'Ткань для раскроя: выбранный источник');
    end if;
  end loop;

  update public.stock_reservations
     set status='released',quantity=0,updated_at=now()
   where production_order_id=p_order_id and item_type='material'
     and material_id in (v_sleeve.id,v_roll.id) and status='active';
  insert into public.stock_reservations
    (source_document_type,source_document_id,production_order_id,
     item_type,material_id,product_id,consumable_id,quantity,status,created_at)
    values('production_order',p_order_id,p_order_id,'material',
      v_target,null,null,v_required_kg,'active',now());

  insert into public.production_order_fabric_settings
    (production_order_id,material_id,source,selected_by,cut_quantity_at_switch,selected_at)
  values(p_order_id,v_target,p_source,v_actor,v_cut_qty,now())
  on conflict (production_order_id) do update
    set material_id=excluded.material_id,source=excluded.source,
        selected_by=excluded.selected_by,
        cut_quantity_at_switch=excluded.cut_quantity_at_switch,
        selected_at=excluded.selected_at;

  insert into public.production_order_fabric_switches
    (production_order_id,previous_material_id,selected_material_id,
     completed_cut_quantity,remaining_cut_quantity,changed_by)
  values(p_order_id,v_previous,v_target,v_cut_qty,v_remaining_qty,v_actor);
  return jsonb_build_object('changed',true,'source',p_source,
    'cut_quantity',v_cut_qty,'remaining_quantity',v_remaining_qty,
    'reserved_kg',round(v_required_kg,3));
end
$function$;
revoke all on function public.set_cut_fabric_source(uuid,text) from public,anon,authenticated;
grant execute on function public.set_cut_fabric_source(uuid,text) to authenticated;

-- Keep the previous trigger logic unchanged for orders WITHOUT a source switch.
-- The split-order branch posts only the physically selected fabric per new cut.
create or replace function public.writeoff_cut_fabric()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp
as $function$
declare
  v_order record;
  r record;
  v_qty numeric;
  v_season uuid;
  v_selected uuid;
  v_rate numeric;
  v_factor numeric;
  v_reservation record;
begin
  if new.operation_name not ilike '%раскро%' or
     new.completed_quantity<=coalesce(old.completed_quantity,0) then
    return new;
  end if;
  select * into v_order from public.production_orders where id=new.production_order_id;
  select id into v_season from public.production_seasons
    where v_order.created_at >= (start_date::timestamp at time zone 'Europe/Moscow')
      and (end_date is null or v_order.created_at < ((end_date+1)::timestamp at time zone 'Europe/Moscow'))
    order by start_date desc limit 1;

  select material_id into v_selected from public.production_order_fabric_settings
    where production_order_id=v_order.id;
  if v_selected is not null then
    select pom.quantity_per_unit,m.production_units_per_purchase_unit into v_rate,v_factor
      from public.production_order_materials pom
      join public.materials m on m.id=pom.material_id
      where pom.production_order_id=v_order.id and pom.material_id=v_selected;
    if v_rate is null or v_rate<=0 or coalesce(v_factor,0)<=0 then
      raise exception 'Не задан расход или коэффициент выбранной ткани';
    end if;
    v_qty := (new.completed_quantity-coalesce(old.completed_quantity,0))*v_rate/v_factor;
    select id,quantity into v_reservation
      from public.stock_reservations
      where production_order_id=v_order.id and item_type='material'
        and material_id=v_selected and status='active'
      order by created_at desc limit 1 for update;
    if v_reservation.id is null or v_reservation.quantity+0.0000001<v_qty then
      raise exception 'Недостаточный резерв выбранной ткани: нужно % кг',round(v_qty,4);
    end if;
    insert into public.stock_movements
      (movement_type,source_document_type,source_document_id,
       production_order_id,item_type,material_id,quantity,season_id)
    values('production_write_off','production_cut',new.id,v_order.id,
      'material',v_selected,-abs(v_qty),v_season);
    update public.stock_reservations
      set quantity=greatest(0,quantity-v_qty),
          status=case when quantity<=v_qty+0.00000001 then 'released' else 'active' end,
          updated_at=now()
      where id=v_reservation.id;
    return new;
  end if;

  -- Original implementation for all unchanged and historical orders.
  for r in
    select pom.material_id,
      sum(pom.total_quantity*(new.completed_quantity-coalesce(old.completed_quantity,0))
        /nullif(v_order.quantity,0)
        /coalesce(nullif(m.production_units_per_purchase_unit,0),1)) as qty
    from public.production_order_materials pom
    left join public.materials m on m.id=pom.material_id
    where pom.production_order_id=v_order.id group by pom.material_id
  loop
    insert into public.stock_movements
      (movement_type,source_document_type,source_document_id,
       production_order_id,item_type,material_id,quantity,season_id)
    values('production_write_off','production_cut',new.id,v_order.id,
      'material',r.material_id,-abs(r.qty),v_season);
    update public.stock_reservations
      set quantity=greatest(0,quantity-abs(r.qty)),
          status=case when quantity<=abs(r.qty)+0.00000001 then 'released' else 'active' end,
          updated_at=now()
      where id=(
        select id from public.stock_reservations
        where production_order_id=v_order.id and material_id=r.material_id
          and item_type='material' and status='active'
        order by created_at limit 1 for update
      );
  end loop;
  return new;
end
$function$;
