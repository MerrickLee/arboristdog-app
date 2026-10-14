CREATE TABLE public.analysis_credit_reservations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  paid_credit BOOLEAN NOT NULL DEFAULT false,
  charged BOOLEAN NOT NULL DEFAULT false,
  refunded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.analysis_credit_reservations ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.reserve_analysis_credit(p_user_id UUID, p_request_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE credits public.user_credits; customer BOOLEAN; paid BOOLEAN;
BEGIN
  SELECT * INTO credits FROM user_credits WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing credit account'; END IF;
  IF EXISTS (SELECT 1 FROM analysis_credit_reservations WHERE id = p_request_id) THEN
    RAISE EXCEPTION 'Analysis request already processed';
  END IF;
  IF date_trunc('month', coalesce(credits.last_topup, '1970-01-01'::timestamptz)) < date_trunc('month', now()) THEN
    UPDATE user_credits SET balance = monthly_limit + purchased_balance, last_topup = now(), updated_at = now()
    WHERE user_id = p_user_id RETURNING * INTO credits;
  END IF;
  SELECT is_almstead_customer INTO customer FROM profiles WHERE id = p_user_id;
  IF customer THEN
    INSERT INTO analysis_credit_reservations(id, user_id) VALUES(p_request_id, p_user_id);
    RETURN credits.balance;
  END IF;
  IF credits.balance <= 0 THEN RAISE EXCEPTION 'No scans remaining. Please get more scans from the Credits screen.'; END IF;
  paid := credits.balance <= credits.purchased_balance;
  INSERT INTO analysis_credit_reservations(id, user_id, paid_credit, charged)
  VALUES(p_request_id, p_user_id, paid, true);
  UPDATE user_credits SET balance = balance - 1, purchased_balance = purchased_balance - CASE WHEN paid THEN 1 ELSE 0 END, updated_at = now()
  WHERE user_id = p_user_id RETURNING balance INTO credits.balance;
  RETURN credits.balance;
END $$;
CREATE OR REPLACE FUNCTION public.refund_analysis_credit(p_request_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE reservation public.analysis_credit_reservations;
BEGIN
  SELECT * INTO reservation FROM analysis_credit_reservations WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR reservation.refunded OR NOT reservation.charged THEN RETURN; END IF;
  UPDATE user_credits SET balance = balance + 1,
    purchased_balance = purchased_balance + CASE WHEN reservation.paid_credit THEN 1 ELSE 0 END, updated_at = now()
  WHERE user_id = reservation.user_id;
  UPDATE analysis_credit_reservations SET refunded = true WHERE id = p_request_id;
END $$;
REVOKE ALL ON FUNCTION public.reserve_analysis_credit(UUID,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.refund_analysis_credit(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_analysis_credit(UUID,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_analysis_credit(UUID) TO service_role;
