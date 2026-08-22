import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import type { Database } from '@/integrations/supabase/types';
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
});

// Tells Supabase Auth to continuously refresh the session automatically
// if the app is in the foreground. When this is added, you will continue
// to receive `onAuthStateChange` events with the `TOKEN_REFRESHED` or
// `SIGNED_OUT` event if the user's session is terminated. This should
// only be registered once.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
