-- Enable RLS on extratos_movimentos
ALTER TABLE public.extratos_movimentos ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read extratos" 
ON public.extratos_movimentos 
FOR SELECT 
USING (true);