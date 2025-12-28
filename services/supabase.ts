import { createClient } from '@supabase/supabase-js';

// Supabase configuration
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://odvgciifzxaiojhqenld.supabase.co';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kdmdjaWlmenhhaW9qaHFlbmxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyODc4MTYsImV4cCI6MjA3Mzg2MzgxNn0.9iR_1RWAOg0uJw058n_DgIOuYFCr_y8zxFVzMLbnwJg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
