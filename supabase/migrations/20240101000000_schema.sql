-- 1. Create Profiles Table (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  is_almstead_customer BOOLEAN DEFAULT FALSE,
  has_onboarded BOOLEAN DEFAULT FALSE,
  onboarding_answers JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Diagnoses Table
CREATE TABLE IF NOT EXISTS diagnoses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  image_url TEXT,
  symptoms TEXT[],
  description TEXT,
  condition_name TEXT,
  confidence FLOAT,
  severity TEXT,
  diagnosis_json JSONB,
  location_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Leads Table (Zapier Submissions)
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnosis_id UUID REFERENCES diagnoses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  notes TEXT,
  preferred_time TEXT,
  zapier_status TEXT DEFAULT 'pending', -- pending, sent, failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create Credits Table
CREATE TABLE IF NOT EXISTS user_credits (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  balance INTEGER DEFAULT 3, -- 3 free scans for new users
  last_topup TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Set up Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies
-- Profiles: Users can only see and edit their own profiles
DROP POLICY IF EXISTS "Users can view their own profiles" ON profiles;
CREATE POLICY "Users can view their own profiles" ON profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update their own profiles" ON profiles;
CREATE POLICY "Users can update their own profiles" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Diagnoses: Users can see and insert their own diagnoses
DROP POLICY IF EXISTS "Users can view their own diagnoses" ON diagnoses;
CREATE POLICY "Users can view their own diagnoses" ON diagnoses FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own diagnoses" ON diagnoses;
CREATE POLICY "Users can insert their own diagnoses" ON diagnoses FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User Credits: Users can see their own balance
DROP POLICY IF EXISTS "Users can view their own credits" ON user_credits;
CREATE POLICY "Users can view their own credits" ON user_credits FOR SELECT USING (auth.uid() = user_id);

-- 7. Trigger to automatically create a profile and grant credits on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email);

  -- Insert into user_credits starting balance
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (new.id, 3);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 8. Function to safely deduct credits
CREATE OR REPLACE FUNCTION deduct_credit(user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE user_credits
  SET balance = balance - 1,
      updated_at = NOW()
  WHERE user_credits.user_id = deduct_credit.user_id
  AND balance > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Function to safely add credits after purchase
CREATE OR REPLACE FUNCTION add_credits(user_id UUID, amount INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE user_credits
  SET balance = balance + amount,
      updated_at = NOW()
  WHERE user_credits.user_id = add_credits.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
