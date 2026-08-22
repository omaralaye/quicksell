import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

WebBrowser.maybeCompleteAuthSession();

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithApple: () => Promise<{ error: string | null }>;
  resetPasswordForEmail: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[AuthContext] Initializing — fetching session');
    let isMounted = true;

    // Safety timeout: Guarantee loading state resolves even if network/storage hangs
    const authTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn('[AuthContext] Session fetch timed out — unblocking UI');
        setLoading(false);
      }
    }, 3000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      clearTimeout(authTimeout);
      console.log('[AuthContext] Initial session:', session ? `user=${session.user.id}` : 'none');
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((err) => {
      console.error('[AuthContext] getSession error:', err);
      if (isMounted) {
        clearTimeout(authTimeout);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      console.log('[AuthContext] Auth state changed:', _event, session ? `user=${session.user.id}` : 'none');
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      clearTimeout(authTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    console.log('[AuthContext] signInWithEmail:', email);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) console.error('[AuthContext] signInWithEmail error:', error.message);
    return { error: error?.message ?? null };
  };

  const signUpWithEmail = async (email: string, password: string, name: string) => {
    console.log('[AuthContext] signUpWithEmail:', email, 'name:', name);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) console.error('[AuthContext] signUpWithEmail error:', error.message);
    return { error: error?.message ?? null };
  };

  const signInWithGoogle = async () => {
    console.log('[AuthContext] signInWithGoogle');
    try {
      const redirectUrl = Linking.createURL('/auth');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });
      if (error) {
        console.error('[AuthContext] signInWithGoogle error:', error.message);
        return { error: error.message };
      }
      if (data?.url) {
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (res.type === 'success' && res.url) {
          const { queryParams } = Linking.parse(res.url);
          if (queryParams?.access_token && queryParams?.refresh_token) {
            await supabase.auth.setSession({
              access_token: queryParams.access_token as string,
              refresh_token: queryParams.refresh_token as string,
            });
          }
        }
      }
      return { error: null };
    } catch (err: any) {
      console.error('[AuthContext] signInWithGoogle exception:', err);
      return { error: err?.message || 'Google sign-in failed. Please try again.' };
    }
  };

  const signInWithApple = async () => {
    console.log('[AuthContext] signInWithApple');
    try {
      if (Platform.OS === 'ios') {
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        if (isAvailable) {
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });
          if (credential.identityToken) {
            const { error } = await supabase.auth.signInWithIdToken({
              provider: 'apple',
              token: credential.identityToken,
            });
            if (error) {
              console.error('[AuthContext] signInWithIdToken error:', error.message);
              return { error: error.message };
            }
            return { error: null };
          }
        }
      }

      // Fallback to OAuth flow
      const redirectUrl = Linking.createURL('/auth');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });
      if (error) return { error: error.message };
      if (data?.url) {
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (res.type === 'success' && res.url) {
          const { queryParams } = Linking.parse(res.url);
          if (queryParams?.access_token && queryParams?.refresh_token) {
            await supabase.auth.setSession({
              access_token: queryParams.access_token as string,
              refresh_token: queryParams.refresh_token as string,
            });
          }
        }
      }
      return { error: null };
    } catch (err: any) {
      if (err.code === 'ERR_REQUEST_CANCELED') {
        return { error: null };
      }
      console.error('[AuthContext] signInWithApple exception:', err);
      return { error: err?.message || 'Apple sign-in failed. Please try again.' };
    }
  };

  const resetPasswordForEmail = async (email: string) => {
    console.log('[AuthContext] resetPasswordForEmail:', email);
    try {
      const redirectUrl = Linking.createURL('/auth');
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      if (error) console.error('[AuthContext] resetPasswordForEmail error:', error.message);
      return { error: error?.message ?? null };
    } catch (err: any) {
      console.error('[AuthContext] resetPasswordForEmail exception:', err);
      return { error: err?.message || 'Failed to send password reset email.' };
    }
  };

  const updatePassword = async (newPassword: string) => {
    console.log('[AuthContext] updatePassword');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) console.error('[AuthContext] updatePassword error:', error.message);
      return { error: error?.message ?? null };
    } catch (err: any) {
      console.error('[AuthContext] updatePassword exception:', err);
      return { error: err?.message || 'Failed to update password.' };
    }
  };

  const signOut = async () => {
    console.log('[AuthContext] signOut');
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signInWithApple,
        resetPasswordForEmail,
        updatePassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

