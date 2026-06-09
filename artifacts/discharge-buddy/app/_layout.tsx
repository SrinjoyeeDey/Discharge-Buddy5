import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/context/AppContext";
import { SidebarProvider } from "@/context/SidebarContext";
import { AssistantProvider } from "@/components/assistant/AssistantProvider";
import { AssistantOverlay } from "@/components/assistant/AssistantOverlay";
import { OfflineBanner } from "@/components/OfflineBanner";
import { Audio } from 'expo-av';

SplashScreen.preventAutoHideAsync();

// Pre-configure global audio for the entire app
Audio.setAudioModeAsync({
  playsInSilentModeIOS: true,
  staysActiveInBackground: false,
  shouldDuckAndroid: true,
}).catch(console.warn);

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="intro" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="verify-email" />
      <Stack.Screen name="role-select" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="scan" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="scan-qr" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="help" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="chat" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="caregiver/create-plan" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="caregiver/dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="caregiver/patient-detail" options={{ presentation: "card", headerShown: false }} />
      <Stack.Screen name="family" options={{ headerShown: false }} />
      <Stack.Screen name="emergency" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="blood-network" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="drug-checker" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="notifications" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="profile" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="settings" options={{ presentation: "modal", headerShown: false }} />
    </Stack>
  );
}

import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as Font from "expo-font";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...Feather.font,
    ...Ionicons.font,
    ...MaterialIcons.font,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
      // Pre-load the success sound as soon as the app is ready
      import("@/utils/SoundHelper").then(({ soundHelper }) => {
        soundHelper.load().catch(console.warn);
      });
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AppProvider>
                <SidebarProvider>
                  <AssistantProvider>
                    <AssistantOverlay />
                    <RootLayoutNav />
                    <OfflineBanner />
                  </AssistantProvider>
                </SidebarProvider>
              </AppProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
