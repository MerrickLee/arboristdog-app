CREATE TABLE IF NOT EXISTS service_areas (
  zip_code TEXT PRIMARY KEY,
  branch TEXT,
  city TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE service_areas ENABLE ROW LEVEL SECURITY;

-- Allow read access to anyone (so edge functions and clients can check zipcodes)
CREATE POLICY "Allow public read access to service_areas" 
  ON service_areas FOR SELECT 
  USING (true);

-- Allow service role to insert/update (from Zapier or edge functions)
-- Note: Service role automatically bypasses RLS, but it's good practice to be explicit if using standard auth.
