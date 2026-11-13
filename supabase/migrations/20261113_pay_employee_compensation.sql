-- One atomic ERP payroll transaction for salaries and closed production shifts.
-- Backdated Thursday catch-up writes the real payment date and selected week.
-- No historical salary/finance/shift records are altered by this migration.
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
  v_week_of_shift date;
  v_now timestamptz := clock_timestamp();
  v_date date := (clock_timestamp() AT TIME ZONE 'Europe/Moscow')::date;
  v_salary_payment_id uuid;
  v_transaction_id uuid;
BEGIN
  IF v_actor IS NULL OR NOT public.erp_is_admin() THEN
    RAISE EXCEPTION 'Выплата зарплаты доступна только администратору ERP';
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
    IF p_week_start IS NOT NULL THEN
      v_week_of_shift :=
        date_trunc('week',v_shift.opened_at AT TIME ZONE 'Europe/Moscow')::date;
      IF v_week_of_shift<>p_week_start THEN
        RAISE EXCEPTION 'Смена % относится к неделе %, а не %',
          v_shift.id,v_week_of_shift,p_week_start;
      END IF;
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

  RETURN jsonb_build_object(
    'salary_payment_id',v_salary_payment_id,
    'finance_transaction_id',v_transaction_id,
    'employee_id',v_employee.id,'week_start',p_week_start,
    'salary_amount',v_salary,'piece_amount',v_piece,
    'total_amount',v_total,'shifts_paid',v_requested_shifts
  );
END
$function$

REVOKE ALL ON FUNCTION public.pay_employee_compensation(uuid,uuid,date,uuid[])
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pay_employee_compensation(uuid,uuid,date,uuid[])
  TO authenticated;
