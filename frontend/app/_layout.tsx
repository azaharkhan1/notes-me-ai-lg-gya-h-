import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { AppState, LogBox, View } from "react-native";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AppProvider, useApp } from "@/src/context/AppContext";
import { ToastProvider } from "@/src/components/Toast";
import { LockGate } from "@/src/components/LockGate";
import { ErrorBoundary } from "@/src/components/ErrorBoundary";
import {
  addReminderListeners,
  reconcileTaskReminders,
} from "@/src/lib/reminders";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);

// Keep the native splash visible from cold start until icon fonts register.
SplashScreen.preventAutoHideAsync();

function LocalNotificationBridge() {
  const router = useRouter();
  const { refresh } = useApp();

  useEffect(() => {
    let active = true;
    const reconcile = async () => {
      try {
        if (active) {
          const changed = await reconcileTaskReminders();
          if (changed > 0) refresh();
        }
      } catch (error) {
        console.warn("[notifications] startup reconciliation failed", error);
      }
    };
    void reconcile();

    const cleanup = addReminderListeners(
      () => {
        // The OS presents the notification; refresh local task state if the app is open.
        refresh();
      },
      (event) => {
        const taskId = (event as { notification?: { request?: { content?: { data?: { taskId?: unknown } } } } })
          ?.notification?.request?.content?.data?.taskId;
        if (typeof taskId === "string") {
          router.push({ pathname: "/calendar", params: { taskId } });
        }
      },
    );
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void reconcile();
    });
    return () => {
      active = false;
      cleanup();
      appState.remove();
    };
  }, [refresh, router]);

  return null;
}

function ThemedApp() {
  const { palette, ready } = useApp();
  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }}>
      <StatusBar style={palette.mode === "dark" ? "light" : "dark"} />
      <ToastProvider>
        <LocalNotificationBridge />
        <LockGate>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: palette.surface },
              animation: "slide_from_right",
            }}
          />
        </LockGate>
      </ToastProvider>
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <ErrorBoundary>
            <AppProvider>
              <ThemedApp />
            </AppProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
