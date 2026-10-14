-- Keep paid credits through the free monthly allowance reset.
ALTER TABLE public.user_credits ADD COLUMN IF NOT EXISTS purchased_balance INTEGER NOT NULL DEFAULT 0 CHECK (purchased_balance >= 0);
CREATE TABLE IF NOT EXISTS public.purchase_grants (
  transaction_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_grants ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.grant_verified_purchase(p_user_id UUID, p_transaction TEXT, p_product TEXT, p_amount INTEGER)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inserted INTEGER;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Invalid credit amount'; END IF;
  INSERT INTO purchase_grants(transaction_id, user_id, product_id, amount)
  VALUES(p_transaction, p_user_id, p_product, p_amount) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  IF inserted = 0 THEN RETURN 0; END IF;
  UPDATE user_credits SET balance = balance + p_amount, purchased_balance = purchased_balance + p_amount, updated_at = now()
  WHERE user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing credit account'; END IF;
  RETURN p_amount;
END $$;
REVOKE ALL ON FUNCTION public.grant_verified_purchase(UUID,TEXT,TEXT,INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_verified_purchase(UUID,TEXT,TEXT,INTEGER) TO service_role;
REVOKE ALL ON FUNCTION public.add_credits(UUID,INTEGER) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.reset_monthly_credits()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE user_credits SET balance = monthly_limit + purchased_balance, updated_at = now();
END $$;
REVOKE ALL ON FUNCTION public.reset_monthly_credits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_monthly_credits() TO service_role;
CREATE OR REPLACE FUNCTION public.deduct_credit(user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE user_credits SET balance = balance - 1,
    purchased_balance = CASE WHEN balance <= purchased_balance THEN greatest(0, purchased_balance - 1) ELSE purchased_balance END,
    updated_at = now()
  WHERE user_credits.user_id = deduct_credit.user_id AND balance > 0;
END $$;
-- Customer lookup must use Auth's confirmed email, never a client-editable profile email.
CREATE OR REPLACE FUNCTION public.sync_confirmed_profile_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE profiles SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_confirmed_profile_email AFTER UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_confirmed_profile_email();
CREATE OR REPLACE FUNCTION public.protect_customer_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.role() = 'authenticated' AND (
    NEW.email IS DISTINCT FROM OLD.email OR
    NEW.is_almstead_customer IS DISTINCT FROM OLD.is_almstead_customer OR
    NEW.in_target_area IS DISTINCT FROM OLD.in_target_area
  ) THEN RAISE EXCEPTION 'Customer identity and benefits must be verified by the server'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_customer_identity BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_customer_identity();
