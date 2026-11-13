-- Apply once, after 20261113_pay_employee_compensation.sql.
-- Does not alter any historical wage, shift or finance records.
CREATE TABLE IF NOT EXISTS public.payroll_one_time_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','used','expired')),
  finance_transaction_id uuid REFERENCES public.finance_transactions(id),
  CONSTRAINT payroll_unlock_expiration_check CHECK (expires_at > created_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_one_time_unlocks_active_by_admin
  ON public.payroll_one_time_unlocks(admin_id) WHERE status='active';
ALTER TABLE public.payroll_one_time_unlocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payroll_one_time_unlocks FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.payroll_one_time_unlocks TO service_role;

CREATE OR REPLACE FUNCTION public.pay_employee_compensation(p_employee_id uuid, p_account_id uuid, p_week_start date DEFAULT NULL::date, p_shift_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_employee public.employees%ROWTYPE;
  v_account public.finance_accounts%ROWTYPE;
  v_shift public.employee_shifts%ROWTYPE;
  v_salary numeric := 0;
  v_piece numeric := 0;
  v_total numeric;
  v_shift_count integer := 0;
  v_requested_shifts integer;
  v_now timestamptz := clock_timestamp();
  v_date date := (clock_timestamp() AT TIME ZONE 'Europe/Moscow')::date;
  v_salary_payment_id uuid;
  v_transaction_id uuid;
  v_unlock_id uuid;
  v_cutoff_date date;
  v_is_thursday boolean;
BEGIN
  IF v_actor IS NULL OR NOT public.erp_is_admin() THEN
    RAISE EXCEPTION 'Выплата зарплаты доступна только администратору ERP';
  END IF;
  v_is_thursday := extract(isodow from v_date)::integer = 4;
  IF p_week_start IS NULL THEN
    v_cutoff_date := v_date - ((extract(isodow from v_date)::integer - 4 + 7) % 7);
  ELSE
    v_cutoff_date := p_week_start + 3;
  END IF;
  IF v_cutoff_date > v_date THEN
    RAISE EXCEPTION 'Нельзя провести зарплату до расчётного четверга';
  END IF;
  IF NOT v_is_thursday THEN
    SELECT id INTO v_unlock_id FROM public.payroll_one_time_unlocks
    WHERE admin_id=v_actor AND status='active' AND expires_at>clock_timestamp()
    ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
    IF v_unlock_id IS NULL THEN
      RAISE EXCEPTION 'Выплата доступна только по четвергам. Требуется разовая разблокировка администратором';
    END IF;
  END IF;
  IF p_employee_id IS NULL OR p_account_id IS NULL THEN
    RAISE EXCEPTION 'Не указан сотрудник или финансовый счёт';
  END IF;
  IF p_shift_ids IS NULL THEN p_shift_ids := '{}'::uuid[]; END IF;
  v_requested_shifts := cardinality(p_shift_ids);
  IF v_requested_shifts <> (SELECT count(DISTINCT x) FROM unnest(p_shift_ids) x) THEN
    RAISE EXCEPTION 'В запросе повторяются смены';
  END IF;
  IF p_week_start IS NULL AND v_requested_shifts=0 THEN
    RAISE EXCEPTION 'Нет начислений к выплате';
  END IF;

  SELECT * INTO v_account FROM public.finance_accounts
    WHERE id=p_account_id FOR UPDATE;
  IF NOT FOUND OR v_account.is_active IS NOT TRUE OR v_account.currency<>'RUB' THEN
    RAISE EXCEPTION 'Недоступный финансовый счёт или валюта не RUB';
  END IF;

  SELECT * INTO v_employee FROM public.employees
    WHERE id=p_employee_id FOR UPDATE;
  IF NOT FOUND OR v_employee.is_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Сотрудник не найден или неактивен';
  END IF;

  IF p_week_start IS NOT NULL THEN
    IF extract(isodow from p_week_start)::int<>1 THEN
      RAISE EXCEPTION 'Расчётная неделя должна начинаться с понедельника';
    END IF;
    IF p_week_start+3 > v_date THEN
      RAISE EXCEPTION 'Оклад за неделю % можно провести не раньше четверга', p_week_start;
    END IF;
    IF coalesce(v_employee.weekly_salary_amount,0)<=0
      OR v_employee.payment_type IS NULL
      OR v_employee.payment_type NOT ILIKE '%salary%' THEN
      RAISE EXCEPTION 'У сотрудника не установлен недельный оклад';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.employee_salary_payments
      WHERE employee_id=v_employee.id AND week_start=p_week_start
    ) THEN
      RAISE EXCEPTION 'Оклад за неделю % уже проведён',p_week_start;
    END IF;
    v_salary := round(v_employee.weekly_salary_amount,2);
  END IF;

  FOR v_shift IN
    SELECT * FROM public.employee_shifts
    WHERE id=ANY(p_shift_ids)
    ORDER BY id FOR UPDATE
  LOOP
    IF v_employee.auth_user_id IS NULL
       OR v_shift.user_id<>v_employee.auth_user_id
       OR v_shift.status<>'closed'
       OR v_shift.is_paid IS TRUE THEN
      RAISE EXCEPTION 'Смена % не принадлежит сотруднику, открыта или уже оплачена',
        v_shift.id;
    END IF;
    IF v_shift.closed_at IS NULL OR
       (v_shift.closed_at AT TIME ZONE 'Europe/Moscow')::date > v_cutoff_date THEN
      RAISE EXCEPTION 'Смена % закрыта позднее расчётного четверга %',v_shift.id,v_cutoff_date;
    END IF;
    v_shift_count := v_shift_count+1;
    v_piece := v_piece+coalesce(v_shift.total_earned,0);
  END LOOP;
  IF v_shift_count<>v_requested_shifts THEN
    RAISE EXCEPTION 'Некоторые смены не найдены: ожидалось %, найдено %',
      v_requested_shifts,v_shift_count;
  END IF;
  v_piece := round(v_piece,2);
  v_total := round(v_salary+v_piece,2);
  IF v_total<=0 THEN RAISE EXCEPTION 'Сумма выплаты должна быть положительной'; END IF;
  IF v_account.current_balance<v_total THEN
    RAISE EXCEPTION 'На счёте недостаточно средств: нужно %, доступно %',
      v_total, v_account.current_balance;
  END IF;

  IF p_week_start IS NOT NULL THEN
    INSERT INTO public.employee_salary_payments
      (employee_id,week_start,amount,paid_at,paid_by,finance_account_id)
    VALUES (v_employee.id,p_week_start,v_salary,v_now,v_actor,p_account_id)
    RETURNING id INTO v_salary_payment_id;
  END IF;

  INSERT INTO public.finance_transactions
    (account_id,type,amount,operation_date,description,source_document_type,
     source_document_id,category,counterparty_id,comment,created_by)
  VALUES (
    p_account_id,'expense',v_total,v_date,
    CASE
      WHEN p_week_start IS NOT NULL AND v_shift_count>0 THEN
        'Выплата сотруднику '||coalesce(v_employee.full_name,'Без имени')||': оклад + сдельно'
      WHEN p_week_start IS NOT NULL THEN
        'Оклад сотруднику '||coalesce(v_employee.full_name,'Без имени')
      ELSE 'Выплата сотруднику '||coalesce(v_employee.full_name,'Без имени')
    END,
    CASE
      WHEN p_week_start IS NOT NULL AND v_shift_count>0 THEN 'employee_combined_payout'
      WHEN p_week_start IS NOT NULL THEN 'employee_salary_payment'
      ELSE 'employee_payout'
    END,
    coalesce(v_salary_payment_id,p_shift_ids[1]),'employee_salary',
    v_employee.id,
    CASE WHEN p_week_start IS NOT NULL THEN
      'Неделя с '||p_week_start::text||'; оклад '||v_salary::text||
      '; сдельно '||v_piece::text||'; смены: '||array_to_string(p_shift_ids,', ')
    ELSE 'Сдельно '||v_piece::text||'; смены: '||array_to_string(p_shift_ids,', ') END,
    v_actor
  ) RETURNING id INTO v_transaction_id;

  UPDATE public.finance_accounts SET current_balance=current_balance-v_total,
    updated_at=v_now WHERE id=p_account_id AND current_balance>=v_total;
  IF NOT FOUND THEN RAISE EXCEPTION 'Не удалось списать выплату со счёта'; END IF;

  IF v_requested_shifts>0 THEN
    UPDATE public.employee_shifts SET is_paid=true,paid_at=v_now,paid_by=v_actor
    WHERE id=ANY(p_shift_ids) AND status='closed' AND is_paid IS DISTINCT FROM TRUE;
    GET DIAGNOSTICS v_shift_count=ROW_COUNT;
    IF v_shift_count<>v_requested_shifts THEN
      RAISE EXCEPTION 'Количество оплаченных смен изменилось, выплата отменена';
    END IF;
  END IF;

  IF v_unlock_id IS NOT NULL THEN
    UPDATE public.payroll_one_time_unlocks
    SET status='used',consumed_at=v_now,finance_transaction_id=v_transaction_id
    WHERE id=v_unlock_id AND status='active' AND expires_at>clock_timestamp();
    IF NOT FOUND THEN RAISE EXCEPTION 'Разовая разблокировка истекла; выплата отменена'; END IF;
  END IF;
  RETURN jsonb_build_object(
    'salary_payment_id',v_salary_payment_id,
    'finance_transaction_id',v_transaction_id,
    'employee_id',v_employee.id,'week_start',p_week_start,
    'salary_amount',v_salary,'piece_amount',v_piece,
    'total_amount',v_total,'shifts_paid',v_requested_shifts
  );
END
$function$;
REVOKE ALL ON FUNCTION public.pay_employee_compensation(uuid,uuid,date,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pay_employee_compensation(uuid,uuid,date,uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.payroll_unlock_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
 v_actor uuid := auth.uid();
 v_date date := (clock_timestamp() AT TIME ZONE 'Europe/Moscow')::date;
 v_admin boolean;
 v_expires timestamptz;
BEGIN
 v_admin := v_actor IS NOT NULL AND public.erp_is_admin();
 IF v_admin THEN
   SELECT expires_at INTO v_expires FROM public.payroll_one_time_unlocks
   WHERE admin_id=v_actor AND status='active' AND expires_at>clock_timestamp()
   ORDER BY created_at DESC LIMIT 1;
 END IF;
 RETURN jsonb_build_object('is_admin',v_admin,
   'is_thursday',extract(isodow from v_date)::integer=4,
   'unlocked',v_admin AND v_expires IS NOT NULL,'expires_at',v_expires);
END $function$;
REVOKE ALL ON FUNCTION public.payroll_unlock_state() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_unlock_state() TO authenticated;

CREATE OR REPLACE FUNCTION public.unlock_payroll_once()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
 v_actor uuid := auth.uid();
 v_date date := (clock_timestamp() AT TIME ZONE 'Europe/Moscow')::date;
 v_id uuid;
 v_expires timestamptz;
BEGIN
 IF v_actor IS NULL OR NOT public.erp_is_admin() THEN
   RAISE EXCEPTION 'Разблокировка зарплаты доступна только администратору ERP';
 END IF;
 IF extract(isodow from v_date)::integer=4 THEN
   RAISE EXCEPTION 'В четверг выплаты доступны без разблокировки';
 END IF;
 PERFORM 1 FROM public.user_profiles WHERE id=v_actor FOR UPDATE;
 UPDATE public.payroll_one_time_unlocks
 SET status='expired',consumed_at=clock_timestamp()
 WHERE admin_id=v_actor AND status='active' AND expires_at<=clock_timestamp();
 SELECT id,expires_at INTO v_id,v_expires FROM public.payroll_one_time_unlocks
 WHERE admin_id=v_actor AND status='active' AND expires_at>clock_timestamp()
 ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF v_id IS NULL THEN
   INSERT INTO public.payroll_one_time_unlocks(admin_id,expires_at)
   VALUES(v_actor,clock_timestamp()+interval '20 minutes')
   RETURNING id,expires_at INTO v_id,v_expires;
 END IF;
 RETURN jsonb_build_object('unlocked',true,'expires_at',v_expires,'one_time',true);
END $function$;
REVOKE ALL ON FUNCTION public.unlock_payroll_once() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_payroll_once() TO authenticated;
