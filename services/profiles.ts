import { supabase } from '@/integrations/supabase/client';

export async function fetchSellerProfile(sellerId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', sellerId)
    .single();
  if (error) throw error;
  return data;
}
