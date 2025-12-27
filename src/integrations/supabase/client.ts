import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const SUPABASE_URL = 'https://tzedvuwqmbpdpcuowsfx.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6ZWR2dXdxbWJwZHBjdW93c2Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NDA1NDksImV4cCI6MjA4MjQxNjU0OX0.JHss5N_bwHjeuR0BWTOLTh-_Ak2HZhQ7E29kicc4s_E'

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
