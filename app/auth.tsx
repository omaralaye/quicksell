import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { COLORS } from '@/constants/Colors';

type Mode = 'signin' | 'signup' | 'forgot_password' | 'reset_password_sent';

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signInWithApple,
    resetPasswordForEmail,
    user,
  } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  const handleModeSwitch = (newMode: Mode) => {
    console.log('[Auth] Mode switched to:', newMode);
    setMode(newMode);
    setError(null);
  };

  const handleSubmit = async () => {
    console.log('[Auth] Submit pressed, mode:', mode, 'email:', email);
    setError(null);

    if (mode === 'forgot_password') {
      if (!email.trim()) {
        setError('Please enter your email address.');
        return;
      }
      setLoading(true);
      try {
        const result = await resetPasswordForEmail(email.trim());
        if (result.error) {
          setError(result.error);
        } else {
          setMode('reset_password_sent');
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Please enter your name.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        console.log('[Auth] Signing in with email:', email);
        const result = await signInWithEmail(email.trim(), password);
        if (result.error) {
          console.error('[Auth] Sign in error:', result.error);
          setError(result.error);
        } else {
          console.log('[Auth] Sign in success, navigating to tabs');
          router.replace('/(tabs)' as never);
        }
      } else if (mode === 'signup') {
        console.log('[Auth] Signing up with email:', email, 'name:', name);
        const result = await signUpWithEmail(email.trim(), password, name.trim());
        if (result.error) {
          console.error('[Auth] Sign up error:', result.error);
          setError(result.error);
        } else {
          console.log('[Auth] Sign up success');
          setError(null);
          setMode('signin');
          setPassword('');
          Alert.alert(
            'Account Created!',
            'You can now sign in with your email and password.',
            [{ text: 'OK' }]
          );
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    console.log('[Auth] Google sign in pressed');
    setError(null);
    setSocialLoading('google');
    try {
      const result = await signInWithGoogle();
      if (result.error) {
        setError(result.error);
      } else {
        router.replace('/(tabs)' as never);
      }
    } finally {
      setSocialLoading(null);
    }
  };

  const handleAppleSignIn = async () => {
    console.log('[Auth] Apple sign in pressed');
    setError(null);
    setSocialLoading('apple');
    try {
      const result = await signInWithApple();
      if (result.error) {
        setError(result.error);
      } else {
        router.replace('/(tabs)' as never);
      }
    } finally {
      setSocialLoading(null);
    }
  };

  const isSignUp = mode === 'signup';
  const isForgotPassword = mode === 'forgot_password';
  const isResetSent = mode === 'reset_password_sent';
  const isSignIn = mode === 'signin';

  const inputStyle = (focused: boolean) => ({
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: focused ? COLORS.primary : COLORS.border,
    color: COLORS.text,
    fontSize: 16,
    fontFamily: 'Nunito_400Regular',
    height: 52,
    paddingHorizontal: 16,
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + (isForgotPassword || isResetSent ? 20 : 40),
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back header for forgot password modes */}
        {(isForgotPassword || isResetSent) && (
          <TouchableOpacity
            onPress={() => handleModeSwitch('signin')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              alignSelf: 'flex-start',
              marginBottom: 24,
              paddingVertical: 8,
              paddingRight: 12,
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={COLORS.text} style={{ marginRight: 6 }} />
            <Text
              style={{
                fontSize: 15,
                fontFamily: 'Nunito_600SemiBold',
                color: COLORS.text,
              }}
            >
              Back to Sign In
            </Text>
          </TouchableOpacity>
        )}

        {/* Logo + tagline */}
        <View style={{ alignItems: 'center', marginBottom: isForgotPassword || isResetSent ? 32 : 40 }}>
          <Text
            style={{
              fontSize: 36,
              fontFamily: 'Nunito_800ExtraBold',
              color: COLORS.primary,
              letterSpacing: -1,
            }}
          >
            NearSwap
          </Text>
          <Text
            style={{
              fontSize: 15,
              fontFamily: 'Nunito_400Regular',
              color: COLORS.textSecondary,
              marginTop: 6,
            }}
          >
            Buy &amp; sell with people nearby
          </Text>
        </View>

        {/* MODE 1: FORGOT PASSWORD - RESET SENT CONFIRMATION */}
        {isResetSent && (
          <View style={{ alignItems: 'center', marginVertical: 12 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: COLORS.primaryMuted,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <Ionicons name="mail" size={36} color={COLORS.primary} />
            </View>
            <Text
              style={{
                fontSize: 22,
                fontFamily: 'Nunito_800ExtraBold',
                color: COLORS.text,
                marginBottom: 8,
                textAlign: 'center',
              }}
            >
              Check Your Email
            </Text>
            <Text
              style={{
                fontSize: 15,
                fontFamily: 'Nunito_400Regular',
                color: COLORS.textSecondary,
                textAlign: 'center',
                lineHeight: 22,
                paddingHorizontal: 12,
                marginBottom: 32,
              }}
            >
              We've sent a password reset link to{' '}
              <Text style={{ fontFamily: 'Nunito_700Bold', color: COLORS.text }}>
                {email}
              </Text>
              . Please follow the instructions in the email to reset your password.
            </Text>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
              style={{
                backgroundColor: COLORS.primary,
                borderRadius: 14,
                height: 52,
                width: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
              }}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text
                  style={{
                    fontSize: 16,
                    fontFamily: 'Nunito_700Bold',
                    color: '#FFFFFF',
                  }}
                >
                  Resend Reset Link
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleModeSwitch('signin')}
              activeOpacity={0.8}
              style={{
                backgroundColor: COLORS.surfaceSecondary,
                borderRadius: 14,
                height: 52,
                width: '100%',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: 'Nunito_700Bold',
                  color: COLORS.text,
                }}
              >
                Return to Sign In
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* MODE 2: FORGOT PASSWORD INPUT FORM */}
        {isForgotPassword && (
          <View>
            <View style={{ marginBottom: 24 }}>
              <Text
                style={{
                  fontSize: 22,
                  fontFamily: 'Nunito_800ExtraBold',
                  color: COLORS.text,
                  marginBottom: 6,
                }}
              >
                Reset Password
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Nunito_400Regular',
                  color: COLORS.textSecondary,
                  lineHeight: 20,
                }}
              >
                Enter the email address associated with your account and we'll send you instructions to reset your password.
              </Text>
            </View>

            <View style={{ gap: 14 }}>
              <TextInput
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (error) setError(null);
                }}
                placeholder="Email address"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={inputStyle(emailFocused)}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>

            {error !== null && (
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Nunito_400Regular',
                  color: COLORS.danger,
                  marginTop: 12,
                  textAlign: 'center',
                }}
              >
                {error}
              </Text>
            )}

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
              style={{
                backgroundColor: COLORS.primary,
                borderRadius: 14,
                height: 52,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 24,
                opacity: loading ? 0.8 : 1,
              }}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text
                  style={{
                    fontSize: 16,
                    fontFamily: 'Nunito_700Bold',
                    color: '#FFFFFF',
                  }}
                >
                  Send Reset Link
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleModeSwitch('signin')}
              style={{ marginTop: 20, alignItems: 'center' }}
              activeOpacity={0.7}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Nunito_600SemiBold',
                  color: COLORS.textSecondary,
                }}
              >
                Remember your password?{' '}
                <Text style={{ color: COLORS.primary, fontFamily: 'Nunito_700Bold' }}>
                  Sign In
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* MODE 3 & 4: SIGN IN / SIGN UP FORM */}
        {(isSignIn || isSignUp) && (
          <>
            {/* Mode toggle */}
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: COLORS.surfaceSecondary,
                borderRadius: 12,
                padding: 4,
                marginBottom: 24,
              }}
            >
              <TouchableOpacity
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 9,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isSignIn ? COLORS.primary : 'transparent',
                }}
                onPress={() => handleModeSwitch('signin')}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Nunito_700Bold',
                    color: isSignIn ? COLORS.surface : COLORS.textSecondary,
                  }}
                >
                  Sign In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 9,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isSignUp ? COLORS.primary : 'transparent',
                }}
                onPress={() => handleModeSwitch('signup')}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Nunito_700Bold',
                    color: isSignUp ? COLORS.surface : COLORS.textSecondary,
                  }}
                >
                  Sign Up
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form fields */}
            <View style={{ gap: 14 }}>
              {isSignUp && (
                <TextInput
                  value={name}
                  onChangeText={(t) => {
                    setName(t);
                    if (error) setError(null);
                  }}
                  placeholder="Full Name"
                  placeholderTextColor={COLORS.textTertiary}
                  autoCapitalize="words"
                  style={inputStyle(nameFocused)}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                />
              )}
              <TextInput
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (error) setError(null);
                }}
                placeholder="Email"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={inputStyle(emailFocused)}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
              <TextInput
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  if (error) setError(null);
                }}
                placeholder="Password"
                placeholderTextColor={COLORS.textTertiary}
                secureTextEntry
                style={inputStyle(passwordFocused)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
            </View>

            {/* Forgot Password link (in Sign In mode) */}
            {isSignIn && (
              <TouchableOpacity
                onPress={() => handleModeSwitch('forgot_password')}
                style={{ alignSelf: 'flex-end', marginTop: 10, paddingVertical: 4 }}
                activeOpacity={0.7}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: 'Nunito_600SemiBold',
                    color: COLORS.primary,
                  }}
                >
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            )}

            {/* Error message */}
            {error !== null && (
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Nunito_400Regular',
                  color: COLORS.danger,
                  marginTop: 12,
                  textAlign: 'center',
                }}
              >
                {error}
              </Text>
            )}

            {/* Submit button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading || socialLoading !== null}
              activeOpacity={0.85}
              style={{
                backgroundColor: COLORS.primary,
                borderRadius: 14,
                height: 52,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: isSignIn ? 18 : 24,
                opacity: loading ? 0.8 : 1,
              }}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text
                  style={{
                    fontSize: 16,
                    fontFamily: 'Nunito_700Bold',
                    color: '#FFFFFF',
                  }}
                >
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginVertical: 24,
              }}
            >
              <View style={{ flex: 1, height: 1, backgroundColor: COLORS.border }} />
              <Text
                style={{
                  marginHorizontal: 16,
                  fontSize: 13,
                  fontFamily: 'Nunito_600SemiBold',
                  color: COLORS.textTertiary,
                }}
              >
                or continue with
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: COLORS.border }} />
            </View>

            {/* Social Logins */}
            <View style={{ gap: 12 }}>
              {/* Google Button */}
              <TouchableOpacity
                onPress={handleGoogleSignIn}
                disabled={loading || socialLoading !== null}
                activeOpacity={0.8}
                style={{
                  backgroundColor: COLORS.surface,
                  borderRadius: 14,
                  height: 52,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 16,
                  opacity: socialLoading === 'google' ? 0.7 : 1,
                }}
              >
                {socialLoading === 'google' ? (
                  <ActivityIndicator color={COLORS.text} size="small" />
                ) : (
                  <>
                    <FontAwesome name="google" size={20} color="#EA4335" style={{ marginRight: 10 }} />
                    <Text
                      style={{
                        fontSize: 15,
                        fontFamily: 'Nunito_700Bold',
                        color: COLORS.text,
                      }}
                    >
                      Continue with Google
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Apple Button */}
              <TouchableOpacity
                onPress={handleAppleSignIn}
                disabled={loading || socialLoading !== null}
                activeOpacity={0.85}
                style={{
                  backgroundColor: '#000000',
                  borderRadius: 14,
                  height: 52,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 16,
                  opacity: socialLoading === 'apple' ? 0.7 : 1,
                }}
              >
                {socialLoading === 'apple' ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="logo-apple" size={22} color="#FFFFFF" style={{ marginRight: 10 }} />
                    <Text
                      style={{
                        fontSize: 15,
                        fontFamily: 'Nunito_700Bold',
                        color: '#FFFFFF',
                      }}
                    >
                      Continue with Apple
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
