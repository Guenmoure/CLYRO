-- Fix: handle_new_user() tried to insert 'email' column which doesn't exist in profiles
-- This caused all new signups to fail with a column-not-found error

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, credits)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    3
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
