import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const SUPABASE_URL = 'https://wljoevzhiaouwypjavfy.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indsam9ldnpoaWFvdXd5cGphdmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MDExMzAsImV4cCI6MjA4MTM3NzEzMH0.2qkXevvZrLbwcFrYURtYkwEV4WJD31oLZZh0KKozxRc'

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
