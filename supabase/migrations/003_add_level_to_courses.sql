-- Add level column to courses table
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS level INTEGER CHECK (level BETWEEN 1 AND 4);
