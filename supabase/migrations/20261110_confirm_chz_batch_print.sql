-- Confirm CHZ label printing only after a person checks the physical labels.
-- No historical backfill and no allocation changes.
CREATE TABLE IF NOT EXISTS public.chz_batch_print_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.production_batches(id) ON DELETE RESTRICT,
  confirmed_by uuid NOT NULL REFERENCES auth.users(id),
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  codes_count integer NOT NULL CHECK (codes_count > 0),
  confirmation_source text NOT NULL CHECK (confirmation_source IN ('preview','historical'))
);
CREATE INDEX IF NOT EXISTS chz_batch_print_confirmations_batch_idx
  ON public.chz_batch_print_confirmations(batch_id,confirmed_at DESC);
ALTER TABLE public.chz_batch_print_confirmations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chz_batch_print_confirmations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.chz_batch_print_confirmations TO authenticated;
GRANT ALL ON public.chz_batch_print_confirmations TO service_role;
DROP POLICY IF EXISTS "Admins can read CHZ print confirmations" ON public.chz_batch_print_confirmations;
CREATE POLICY "Admins can read CHZ print confirmations"
  ON public.chz_batch_print_confirmations FOR SELECT TO authenticated
  USING ((SELECT public.erp_is_admin()));

CREATE OR REPLACE FUNCTION public.confirm_chz_batch_print(p_batch_id uuid, p_source text DEFAULT 'preview'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_batch public.production_batches%ROWTYPE;
  v_code_count integer;
  v_code_printed_count integer;
  v_invalid_count integer;
  v_required integer;
  v_printed_at timestamptz;
BEGIN
  IF v_actor IS NULL OR NOT public.erp_is_admin() THEN
    RAISE EXCEPTION 'Подтверждение печати ЧЗ доступно только администратору ERP';
  END IF;
  IF p_batch_id IS NULL OR p_source IS NULL OR p_source NOT IN ('preview','historical') THEN
    RAISE EXCEPTION 'Некорректные параметры подтверждения печати ЧЗ';
  END IF;

  SELECT * INTO v_batch FROM public.production_batches
    WHERE id=p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Производственная пачка не найдена'; END IF;
  IF v_batch.status IN ('cancelled','archived') THEN
    RAISE EXCEPTION 'Нельзя подтверждать печать отменённой пачки';
  END IF;
  IF v_batch.quantity <> trunc(v_batch.quantity) OR v_batch.quantity <= 0 THEN
    RAISE EXCEPTION 'Некорректное количество изделий в пачке';
  END IF;
  v_required := v_batch.quantity::integer;
  IF coalesce(v_batch.chz_codes_allocated,0) <> v_required
     OR coalesce(v_batch.chz_gtin,'')='' THEN
    RAISE EXCEPTION 'Не все коды ЧЗ закреплены за пачкой: % из %',
      coalesce(v_batch.chz_codes_allocated,0),v_required;
  END IF;

  SELECT count(*)::integer,
         count(*) FILTER (WHERE mc.printed_at IS NOT NULL)::integer,
         count(*) FILTER (WHERE coalesce(coi.gtin,'') <> v_batch.chz_gtin
                           OR mc.status NOT IN ('allocated','printed','applied')
                           OR mc.code IS NULL OR mc.code='')::integer
    INTO v_code_count,v_code_printed_count,v_invalid_count
  FROM public.chz_marking_codes mc
  LEFT JOIN public.chz_code_order_items coi ON coi.id=mc.order_item_id
  WHERE mc.production_batch_id=p_batch_id;
  IF v_code_count<>v_required OR v_invalid_count<>0 THEN
    RAISE EXCEPTION 'Коды ЧЗ не совпадают с пачкой: % кодов из % или некорректный GTIN',
      v_code_count,v_required;
  END IF;

  IF v_batch.chz_labels_printed_at IS NOT NULL AND v_code_printed_count=v_required THEN
    RETURN jsonb_build_object('changed',false,'batch_id',p_batch_id,
      'count',v_required,'confirmed_at',v_batch.chz_labels_printed_at);
  END IF;

  v_printed_at := now();
  UPDATE public.chz_marking_codes
     SET printed_at=coalesce(printed_at,v_printed_at),
         status=CASE WHEN status='allocated' THEN 'printed' ELSE status END,
         updated_at=v_printed_at
   WHERE production_batch_id=p_batch_id AND printed_at IS NULL;

  UPDATE public.production_batches
     SET chz_labels_printed_at=coalesce(chz_labels_printed_at,v_printed_at)
   WHERE id=p_batch_id;
  INSERT INTO public.chz_batch_print_confirmations
     (batch_id,confirmed_by,codes_count,confirmation_source,confirmed_at)
  VALUES (p_batch_id,v_actor,v_required,p_source,v_printed_at);

  IF (SELECT count(*) FROM public.chz_marking_codes WHERE production_batch_id=p_batch_id
      AND printed_at IS NOT NULL)<>v_required THEN
    RAISE EXCEPTION 'Не удалось подтвердить печать всех кодов пачки';
  END IF;
  RETURN jsonb_build_object('changed',true,'batch_id',p_batch_id,
    'count',v_required,'confirmed_at',
    (SELECT chz_labels_printed_at FROM public.production_batches WHERE id=p_batch_id));
END
$function$

REVOKE ALL ON FUNCTION public.confirm_chz_batch_print(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_chz_batch_print(uuid,text) TO authenticated;
