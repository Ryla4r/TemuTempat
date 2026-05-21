import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Check both import.meta.env (prefixed with VITE_) and process.env (passed via vite define)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (typeof process !== 'undefined' ? process.env.SUPABASE_URL : undefined);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' ? process.env.SUPABASE_ANON_KEY : undefined);

// Helper to check if Supabase is configured
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'undefined' && supabaseAnonKey !== 'undefined');

// Use a proxy or a dummy client if keys are missing to avoid crashing on module load
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : new Proxy({} as SupabaseClient, {
      get: (_target, prop) => {
        if (prop === 'auth') {
          return new Proxy({} as any, {
            get: () => () => {
              throw new Error('Supabase URL atau Anon Key belum dikonfigurasi. Harap masukkan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY (atau SUPABASE_URL dan SUPABASE_KEY) di menu Settings.');
            }
          });
        }
        throw new Error('Supabase URL atau Anon Key belum dikonfigurasi.');
      }
    });
