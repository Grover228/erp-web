-- Stock and supplier-receipt safety. Existing historical movements are preserved.
-- Only new/updated stock movements are checked (NOT VALID), permitting later audited cleanup.
ALTER TABLE public.stock_movements
ADD CONSTRAINT stock_movements_target_present_20261027
CHECK (
  (item_type = 'material' AND material_id IS NOT NULL)
  OR (item_type = 'consumable' AND consumable_id IS NOT NULL)
  OR (item_type = 'product' AND product_id IS NOT NULL)
  OR (item_type = 'resale_product' AND item_id IS NOT NULL)
) NOT VALID;

CREATE OR REPLACE FUNCTION public.guard_supplier_receipt_header_20261027()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (
      SELECT 1 FROM public.stock_movements sm
      WHERE sm.source_document_type = 'supplier_receipt'
        AND sm.source_document_id = OLD.id
    ) THEN
      RAISE EXCEPTION 'Нельзя удалить приёмку со складскими движениями. Сначала выполните безопасный откат.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'posted'
    AND ROW(NEW.status, NEW.receipt_date, NEW.supplier_id, NEW.supplier_name,
            NEW.total_amount, NEW.delivery_cost, NEW.delivery_distribution,
            NEW.landed_total_amount, NEW.supplier_order_id)
        IS DISTINCT FROM
        ROW(OLD.status, OLD.receipt_date, OLD.supplier_id, OLD.supplier_name,
            OLD.total_amount, OLD.delivery_cost, OLD.delivery_distribution,
            OLD.landed_total_amount, OLD.supplier_order_id)
  THEN
    RAISE EXCEPTION 'Проведённую приёмку нельзя редактировать без безопасного сторнирования.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_supplier_receipt_header_20261027
BEFORE DELETE OR UPDATE ON public.supplier_receipts
FOR EACH ROW EXECUTE FUNCTION public.guard_supplier_receipt_header_20261027();

CREATE OR REPLACE FUNCTION public.guard_supplier_receipt_lines_20261027()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_receipt_id uuid;
  v_status text;
BEGIN
  v_receipt_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.supplier_receipt_id ELSE NEW.supplier_receipt_id END;
  SELECT status INTO v_status FROM public.supplier_receipts
  WHERE id = v_receipt_id FOR UPDATE;

  IF v_status = 'posted' THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'Нельзя добавлять позиции в проведённую приёмку.';
    ELSIF TG_OP = 'DELETE' THEN
      IF EXISTS (
        SELECT 1 FROM public.stock_movements sm
        WHERE sm.source_document_type = 'supplier_receipt'
          AND sm.source_document_id = v_receipt_id
      ) THEN
        RAISE EXCEPTION 'Нельзя удалить позицию проведённой приёмки, пока есть складские движения.';
      END IF;
    ELSIF ROW(NEW.supplier_receipt_id, NEW.item_type, NEW.item_id, NEW.product_id,
              NEW.material_id, NEW.consumable_id, NEW.quantity, NEW.price)
          IS DISTINCT FROM
          ROW(OLD.supplier_receipt_id, OLD.item_type, OLD.item_id, OLD.product_id,
              OLD.material_id, OLD.consumable_id, OLD.quantity, OLD.price)
    THEN
      RAISE EXCEPTION 'Нельзя менять товар, количество или цену проведённой приёмки.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_supplier_receipt_lines_20261027
BEFORE INSERT OR UPDATE OR DELETE ON public.supplier_receipt_items
FOR EACH ROW EXECUTE FUNCTION public.guard_supplier_receipt_lines_20261027();

CREATE OR REPLACE FUNCTION public.guard_supplier_receipt_stock_insert_20261027()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_status text;
BEGIN
  IF NEW.source_document_type = 'supplier_receipt' THEN
    IF NEW.source_document_id IS NULL THEN
      RAISE EXCEPTION 'Для движения приёмки обязателен идентификатор документа.';
    END IF;
    SELECT status INTO v_status FROM public.supplier_receipts
    WHERE id = NEW.source_document_id FOR UPDATE;
    IF v_status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'Нельзя провести складское движение: приёмка отсутствует или уже проведена.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_supplier_receipt_stock_insert_20261027
BEFORE INSERT ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.guard_supplier_receipt_stock_insert_20261027();

-- A single Supabase RPC transaction makes receipt posting all-or-nothing,
-- locks the parent receipt against concurrent posts and preserves cost allocation.
CREATE OR REPLACE FUNCTION public.post_supplier_receipt_safe(p_receipt_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_receipt public.supplier_receipts%ROWTYPE;
  v_item public.supplier_receipt_items%ROWTYPE;
  v_lines integer;
  v_line_number integer := 0;
  v_denominator numeric;
  v_delivery numeric;
  v_allocated_so_far numeric := 0;
  v_allocated numeric;
  v_base_amount numeric;
  v_landed_amount numeric;
  v_unit_cost numeric;
BEGIN
  SELECT * INTO v_receipt
  FROM public.supplier_receipts
  WHERE id = p_receipt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Приёмка не найдена.';
  END IF;
  IF v_receipt.status <> 'draft' THEN
    RAISE EXCEPTION 'Приёмка уже проведена или имеет другой статус.';
  END IF;
  IF COALESCE(v_receipt.delivery_cost, 0) < 0 THEN
    RAISE EXCEPTION 'Стоимость доставки не может быть отрицательной.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.stock_movements sm
    WHERE sm.source_document_type = 'supplier_receipt'
      AND sm.source_document_id = p_receipt_id
  ) THEN
    RAISE EXCEPTION 'В приёмке уже есть движения: необходима проверка истории, повторное проведение запрещено.';
  END IF;

  SELECT COUNT(*),
         SUM(CASE WHEN v_receipt.delivery_distribution = 'quantity'
                  THEN quantity ELSE quantity * price END)
  INTO v_lines, v_denominator
  FROM public.supplier_receipt_items
  WHERE supplier_receipt_id = p_receipt_id;

  IF v_lines = 0 THEN
    RAISE EXCEPTION 'В приёмке нет позиций.';
  END IF;

  -- Validate the entire document before updating costs, stock or status.
  FOR v_item IN
    SELECT * FROM public.supplier_receipt_items
    WHERE supplier_receipt_id = p_receipt_id
    ORDER BY created_at, id
  LOOP
    IF v_item.quantity <= 0 OR v_item.quantity::text = 'NaN'
       OR v_item.price < 0 OR v_item.price::text = 'NaN' THEN
      RAISE EXCEPTION 'Недопустимое количество или цена в строке приёмки %.', v_item.id;
    END IF;

    IF v_item.item_type = 'product' AND v_item.product_id IS NOT NULL THEN
      PERFORM 1 FROM public.products WHERE id = v_item.product_id;
    ELSIF v_item.item_type = 'resale_product' AND v_item.item_id IS NOT NULL THEN
      PERFORM 1 FROM public.items WHERE id = v_item.item_id AND item_type = 'resale_product';
    ELSIF v_item.item_type = 'material' AND v_item.material_id IS NOT NULL THEN
      PERFORM 1 FROM public.materials WHERE id = v_item.material_id;
    ELSIF v_item.item_type = 'consumable' AND v_item.consumable_id IS NOT NULL THEN
      PERFORM 1 FROM public.consumables WHERE id = v_item.consumable_id;
    ELSE
      RAISE EXCEPTION 'Строка приёмки % не содержит корректного идентификатора товара.', v_item.id;
    END IF;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'В строке приёмки % указан несуществующий товар или неправильный тип.', v_item.id;
    END IF;
  END LOOP;

  v_delivery := COALESCE(v_receipt.delivery_cost, 0);
  FOR v_item IN
    SELECT * FROM public.supplier_receipt_items
    WHERE supplier_receipt_id = p_receipt_id
    ORDER BY created_at, id
  LOOP
    v_line_number := v_line_number + 1;
    v_base_amount := v_item.quantity * v_item.price;
    IF v_line_number = v_lines THEN
      v_allocated := GREATEST(0, ROUND(v_delivery - v_allocated_so_far, 2));
    ELSIF COALESCE(v_denominator, 0) > 0 THEN
      v_allocated := GREATEST(0, ROUND(v_delivery *
        (CASE WHEN v_receipt.delivery_distribution = 'quantity'
              THEN v_item.quantity ELSE v_base_amount END) / v_denominator, 2));
    ELSE
      v_allocated := 0;
    END IF;
    v_allocated_so_far := v_allocated_so_far + v_allocated;
    v_landed_amount := v_base_amount + v_allocated;
    v_unit_cost := ROUND(v_landed_amount / v_item.quantity, 4);

    UPDATE public.supplier_receipt_items
    SET allocated_delivery_cost = v_allocated,
        landed_unit_cost = v_unit_cost,
        landed_amount = ROUND(v_landed_amount, 2)
    WHERE id = v_item.id;

    IF v_item.item_type = 'material' THEN
      UPDATE public.materials SET default_price = v_unit_cost WHERE id = v_item.material_id;
    ELSIF v_item.item_type = 'consumable' THEN
      UPDATE public.consumables SET default_price = v_unit_cost WHERE id = v_item.consumable_id;
    ELSIF v_item.item_type = 'product' THEN
      UPDATE public.products SET default_price = v_unit_cost WHERE id = v_item.product_id;
    ELSIF v_item.item_type = 'resale_product' THEN
      UPDATE public.items SET default_price = v_unit_cost WHERE id = v_item.item_id;
    END IF;

    INSERT INTO public.stock_movements (
      movement_type, source_document_type, source_document_id,
      production_order_id, item_type, item_id, product_id,
      material_id, consumable_id, quantity, created_at
    ) VALUES (
      'supplier_receipt', 'supplier_receipt', p_receipt_id,
      NULL, v_item.item_type,
      CASE WHEN v_item.item_type = 'resale_product' THEN v_item.item_id ELSE NULL END,
      CASE WHEN v_item.item_type = 'product' THEN v_item.product_id ELSE NULL END,
      CASE WHEN v_item.item_type = 'material' THEN v_item.material_id ELSE NULL END,
      CASE WHEN v_item.item_type = 'consumable' THEN v_item.consumable_id ELSE NULL END,
      v_item.quantity, NOW()
    );
  END LOOP;

  UPDATE public.supplier_receipts
  SET status = 'posted',
      landed_total_amount = v_receipt.total_amount + v_delivery,
      updated_at = NOW()
  WHERE id = p_receipt_id;
  RETURN p_receipt_id;
END;
$$;

REVOKE ALL ON FUNCTION public.post_supplier_receipt_safe(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_supplier_receipt_safe(uuid) TO authenticated, service_role;
