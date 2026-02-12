-- 1. Profiles Table (Extends Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE,
  full_name TEXT,
  preferences JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Create policy to allow users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Create policy to allow users to insert their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. Constitution Articles Table
CREATE TABLE IF NOT EXISTS public.constitution_articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chapter INTEGER,
  chapter_title TEXT,
  article_number INTEGER UNIQUE,
  article_title TEXT,
  article_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on constitution_articles
ALTER TABLE public.constitution_articles ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read constitution articles
DROP POLICY IF EXISTS "Public can view constitution articles" ON public.constitution_articles;
CREATE POLICY "Public can view constitution articles" ON public.constitution_articles
  FOR SELECT USING (true);

-- Allow insertion of constitution articles (ideally restricted to admin)
DROP POLICY IF EXISTS "Allow admin to insert constitution articles" ON public.constitution_articles;
CREATE POLICY "Allow admin to insert constitution articles" ON public.constitution_articles
  FOR INSERT WITH CHECK (true);

-- Allow update of constitution articles
DROP POLICY IF EXISTS "Allow admin to update constitution articles" ON public.constitution_articles;
CREATE POLICY "Allow admin to update constitution articles" ON public.constitution_articles
  FOR UPDATE USING (true);

-- 3. Emergency Actions Table
CREATE TABLE IF NOT EXISTS public.emergency_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL UNIQUE,
  description TEXT,
  steps JSONB DEFAULT '[]'::jsonb, -- Array of strings or objects
  contact_info TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on emergency_actions
ALTER TABLE public.emergency_actions ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read emergency actions
DROP POLICY IF EXISTS "Public can view emergency actions" ON public.emergency_actions;
CREATE POLICY "Public can view emergency actions" ON public.emergency_actions
  FOR SELECT USING (true);

-- 4. AI Assessments Table
CREATE TABLE IF NOT EXISTS public.assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  assessment TEXT NOT NULL,
  is_ai_generated BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on assessments
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own assessments
DROP POLICY IF EXISTS "Users can view own assessments" ON public.assessments;
CREATE POLICY "Users can view own assessments" ON public.assessments
  FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert their own assessments
DROP POLICY IF EXISTS "Users can insert own assessments" ON public.assessments;
CREATE POLICY "Users can insert own assessments" ON public.assessments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Saved Resources Table
CREATE TABLE IF NOT EXISTS public.saved_resources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  resource_id UUID, -- References either constitution_articles or assessments
  resource_type TEXT CHECK (resource_type IN ('article', 'assessment')),
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on saved_resources
ALTER TABLE public.saved_resources ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own saved resources
DROP POLICY IF EXISTS "Users can view own saved resources" ON public.saved_resources;
CREATE POLICY "Users can view own saved resources" ON public.saved_resources
  FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert their own saved resources
DROP POLICY IF EXISTS "Users can insert own saved resources" ON public.saved_resources;
CREATE POLICY "Users can insert own saved resources" ON public.saved_resources
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own saved resources
DROP POLICY IF EXISTS "Users can delete own saved resources" ON public.saved_resources;
CREATE POLICY "Users can delete own saved resources" ON public.saved_resources
  FOR DELETE USING (auth.uid() = user_id);

-- 6. Full Text Search Index for Constitution
-- This enables the .textSearch('article_content', query) functionality
CREATE INDEX IF NOT EXISTS constitution_content_idx ON public.constitution_articles 
USING GIN (to_tsvector('english', article_content));

-- 7. Trigger for Profile Creation
-- Create a function to handle new user profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
