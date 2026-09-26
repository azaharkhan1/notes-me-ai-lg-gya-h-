import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  AppStateStatus,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";

import { useApp, useTheme } from "../context/AppContext";

export function LockGate({ children }: { children: React.ReactNode }) {
  const { settings, ready } = useApp();
  const c = useTheme();
  const [locked, setLocked] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const appState = useRef(AppState.currentState);
  const initialized = useRef(false);

  const authenticate = useCallback(async () => {
    setAuthenticating(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) {
        // No biometrics available -> fail open so user is never locked out.
        setLocked(false);
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Notes",
        fallbackLabel: "",
        disableDeviceFallback: true,
      });
      if (result.success) setLocked(false);
    } catch {
      // On any error, don't hard-lock the user out.
      setLocked(false);
    } finally {
      setAuthenticating(false);
    }
  }, []);

  // Lock on first ready if enabled.
  useEffect(() => {
    if (!ready || initialized.current) return;
    initialized.current = true;
    if (settings.biometricEnabled) {
      setLocked(true);
      authenticate();
    }
  }, [ready, settings.biometricEnabled, authenticate]);

  // Re-lock when returning from background.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      const prev = appState.current;
      appState.current = next;
      if (
        settings.biometricEnabled &&
        prev.match(/inactive|background/) &&
        next === "active" &&
        !locked
      ) {
        setLocked(true);
        authenticate();
      }
    });
    return () => sub.remove();
  }, [settings.biometricEnabled, locked, authenticate]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {locked && (
        <View style={[styles.overlay, { backgroundColor: c.surface }]} testID="lock-overlay">
          <View style={[styles.iconWrap, { backgroundColor: c.brandTertiary }]}>
            <MaterialCommunityIcons name="lock" size={44} color={c.brand} />
          </View>
          <Text style={[styles.title, { color: c.onSurface }]}>Notes Locked</Text>
          <Text style={[styles.subtitle, { color: c.onSurfaceTertiary }]}>
            Verify your identity to continue
          </Text>
          <Pressable
            testID="unlock-button"
            onPress={authenticate}
            disabled={authenticating}
            style={[styles.button, { backgroundColor: c.brand }]}
          >
            <MaterialCommunityIcons name="fingerprint" size={20} color={c.onBrand} />
            <Text style={[styles.buttonText, { color: c.onBrand }]}>
              {authenticating ? "Verifying..." : "Unlock"}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    zIndex: 1000,
  },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 6 },
  subtitle: { fontSize: 14, marginBottom: 32, textAlign: "center" },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    height: 52,
    borderRadius: 16,
  },
  buttonText: { fontSize: 16, fontWeight: "700" },
});
