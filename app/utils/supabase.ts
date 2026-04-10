import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://emyoiguhpzpflxdkmiqy.supabase.co';
const supabaseKey = 'sb_publishable_p15ZwFsbTd_hpuBzWfDKJA_kEKfm_6h';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
