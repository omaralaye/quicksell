import "react-native-reanimated";
import React, { useEffect } from "react";
import { Stack, Redirect } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme, Alert, View, ActivityIndicator } from "react-native";
import { useNetworkState } from "expo-network";
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { WidgetProvider } from "@/contexts/WidgetContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import {
  useFonts,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from "@expo-google-fonts/nunito";

// Note: Error logging is auto-initialized via index.ts import

// Only wrap with ErrorBoundary in dev — production apps should not include it
const DevErrorBoundary = __DEV__
  ? ErrorBoundary
  : ({ children }: { children: React.ReactNode }) => <>{children}</>;

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "auth",
};

// Module-level constants — never recreated on render, preventing ThemeProvider subtree re-renders
const CustomDefaultTheme: Theme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    primary: "#E85D26",
    background: "#F7F5F2",
    card: "#FFFFFF",
    text: "#1A1714",
    border: "rgba(26, 23, 20, 0.08)",
    notification: "#DC2626",
  },
};

const CustomDarkTheme: Theme = {
  ...DarkTheme,
  colors: {
    primary: "#E85D26",
    background: "#1A1714",
    card: "#242220",
    text: "#F7F5F2",
    border: "rgba(247, 245, 242, 0.08)",
    notification: "#DC2626",
  },
};

import { useRealtimeSync } from "@/hooks/useRealtimeSync";

import { useRouter, useSegments } from "expo-router";

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  
  // Initialize global real-time listeners for the authenticated user
  useRealtimeSync();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "auth";

    if (!user && !inAuthGroup) {
      // Redirect to the sign-in page.
      router.replace("/auth");
    } else if (user && inAuthGroup) {
      // Redirect away from the sign-in page.
      router.replace("/(tabs)" as never);
    }
  }, [user, loading, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F0F0F', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#FF6B35" size="large" />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="listing/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="seller/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="my-listings" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="seller-hub" options={{ headerShown: false }} />
      <Stack.Screen name="orders/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="buyer-requests" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const networkState = useNetworkState();
  const [loaded, error] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  const [isReady, setIsReady] = React.useState(false);

  useEffect(() => {
    // Safety timeout: Ensure splash screen is hidden and app is ready within 2.5 seconds max
    const timer = setTimeout(() => {
      setIsReady(true);
      SplashScreen.hideAsync().catch(() => {});
    }, 2500);

    if (loaded || error) {
      clearTimeout(timer);
      setIsReady(true);
      SplashScreen.hideAsync().catch(() => {});
    }

    return () => clearTimeout(timer);
  }, [loaded, error]);

  React.useEffect(() => {
    if (
      !networkState.isConnected &&
      networkState.isInternetReachable === false
    ) {
      Alert.alert(
        "You are offline",
        "You can keep using the app! Your changes will be saved locally and synced when you are back online."
      );
    }
  }, [networkState.isConnected, networkState.isInternetReachable]);

  // Providers are ALWAYS mounted — never torn down during font loading
  return (
    <DevErrorBoundary>
      <StatusBar style="auto" animated />
      <ThemeProvider
        value={colorScheme === "dark" ? CustomDarkTheme : CustomDefaultTheme}
      >
        <SafeAreaProvider>
          <AuthProvider>
            <WidgetProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                {isReady ? (
                  <RootLayoutNav />
                ) : (
                  <View style={{ flex: 1, backgroundColor: "#F7F5F2" }} />
                )}
              </GestureHandlerRootView>
            </WidgetProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </DevErrorBoundary>
  );
}
