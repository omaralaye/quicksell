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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';

type Mode = 'signin' | 'signup';

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithEmail, signUpWithEmail } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleModeSwitch = (newMode: Mode) => {
    console.log('[Auth] Mode switched to:', newMode);
    setMode(newMode);
    setError(null);
  };

  const handleSubmit = async () => {
    console.log('[Auth] Submit pressed, mode:', mode, 'email:', email);
    setError(null);

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
      let result: { error: string | null };
      if (mode === 'signin') {
        console.log('[Auth] Signing in with email:', email);
        result = await signInWithEmail(email.trim(), password);
      } else {
        console.log('[Auth] Signing up with email:', email, 'name:', name);
        result = await signUpWithEmail(email.trim(), password, name.trim());
      }

      if (result.error) {
        console.error('[Auth] Auth error:', result.error);
        setError(result.error);
      } else {
        console.log('[Auth] Auth success, navigating to tabs');
        router.replace('/(tabs)' as never);
      }
    } finally {
      setLoading(false);
    }
  };

  const isSignUp = mode === 'signup';
  const buttonLabel = isSignUp ? 'Create Account' : 'Sign In';

  const inputStyle = (focused: boolean) => ({
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: focused ? '#FF6B35' : '#2A2A2A',
    color: '#FFFFFF' as const,
    fontSize: 16,
    fontFamily: 'Nunito_400Regular',
    height: 52,
    paddingHorizontal: 16,
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0F0F0F' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo + tagline */}
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <Text
            style={{
              fontSize: 36,
              fontFamily: 'Nunito_800ExtraBold',
              color: '#FF6B35',
              letterSpacing: -1,
            }}
          >
            NearSwap
          </Text>
          <Text
            style={{
              fontSize: 15,
              fontFamily: 'Nunito_400Regular',
              color: '#888888',
              marginTop: 8,
            }}
          >
            Buy &amp; sell with people nearby
          </Text>
        </View>

        {/* Mode toggle */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: '#1A1A1A',
            borderRadius: 12,
            padding: 4,
            marginBottom: 28,
          }}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              height: 40,
              borderRadius: 9,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: mode === 'signin' ? '#FF6B35' : 'transparent',
            }}
            onPress={() => handleModeSwitch('signin')}
            activeOpacity={0.8}
          >
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Nunito_700Bold',
                color: mode === 'signin' ? '#FFFFFF' : '#888888',
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
              backgroundColor: mode === 'signup' ? '#FF6B35' : 'transparent',
            }}
            onPress={() => handleModeSwitch('signup')}
            activeOpacity={0.8}
          >
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Nunito_700Bold',
                color: mode === 'signup' ? '#FFFFFF' : '#888888',
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
                console.log('[Auth] Name changed');
                setName(t);
              }}
              placeholder="Full Name"
              placeholderTextColor="#555555"
              autoCapitalize="words"
              style={inputStyle(nameFocused)}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
            />
          )}
          <TextInput
            value={email}
            onChangeText={(t) => {
              console.log('[Auth] Email changed');
              setEmail(t);
            }}
            placeholder="Email"
            placeholderTextColor="#555555"
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
              console.log('[Auth] Password changed');
              setPassword(t);
            }}
            placeholder="Password"
            placeholderTextColor="#555555"
            secureTextEntry
            style={inputStyle(passwordFocused)}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
          />
        </View>

        {/* Error */}
        {error !== null && (
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Nunito_400Regular',
              color: '#FF4444',
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
          disabled={loading}
          activeOpacity={0.85}
          style={{
            backgroundColor: '#FF6B35',
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
              {buttonLabel}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
