import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from './types';
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://pkjgwnzbvlehtyvikmzp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBramd3bnpidmxlaHR5dmlrbXpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwMjYxNTAsImV4cCI6MjEwMjYwMjE1MH0.kbqcJTCtGda0wVyQxzb-_TJ4gmuz8-xW4vPbpCrJmfw";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
