-- Add zip code fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS zip_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS in_target_area BOOLEAN DEFAULT FALSE;

-- Add monthly limit to credits
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS monthly_limit INTEGER DEFAULT 1;

-- Change default starting balance for new users to 1
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email);

  -- Insert into user_credits starting balance
  INSERT INTO public.user_credits (user_id, balance, monthly_limit)
  VALUES (new.id, 1, 1);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Monthly reset function
CREATE OR REPLACE FUNCTION reset_monthly_credits()
RETURNS void AS $$
BEGIN
  UPDATE user_credits
  SET balance = monthly_limit,
      updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
