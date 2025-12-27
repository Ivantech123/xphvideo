import { createClient } from '@supabase/supabase-js';

// Instructions for the user:
// 1. Create a project at https://supabase.com
// 2. Get your URL and ANON KEY from the project settings
// 3. Create a .env file in the root of your project with:
//    VITE_SUPABASE_URL=your_project_url
//    VITE_SUPABASE_ANON_KEY=your_anon_key

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Fallback to null if not configured to prevent crash, but Auth will fail
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;
