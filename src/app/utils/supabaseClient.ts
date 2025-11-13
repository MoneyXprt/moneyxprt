'use client';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function insertEmailToWaitlist(email: string) {
  const { data, error } = await supabase
    .from('waitlist')
    .insert([{ email }]);

  console.log('Supabase insert result:', { data, error });

  if (error) {
    throw new Error(`Insert failed: ${error.message}`);
  }

  return data;
}