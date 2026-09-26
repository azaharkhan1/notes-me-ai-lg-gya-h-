import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { InteractionManager, useColorScheme } from "react-native";

import { getDb } from "../db/database";
import { purgeOldTrash } from "../db/repo";
import { SortKey } from "../db/types";
import { storage } from "@/src/utils/storage";
import {
  darkPalette,
  lightPalette,
  NoteColorKey,
  Palette,
} from "../theme/colors";

export type ThemePref = "light" | "dark" | "system";
export type LayoutPref = "grid" | "list";

export interface Settings {
  themePref: ThemePref;
  sort: SortKey;
  layout: LayoutPref;
  showPreviews: boolean;
  defaultColor: NoteColorKey;
  biometricEnabled: boolean;
  completedToBottom: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  themePref: "system",
  sort: "updated",
  layout: "grid",
  showPreviews: true,
  defaultColor: "default",
  biometricEnabled: false,
  completedToBottom: true,
};

const SETTINGS_KEY = "notes.settings.v1";

interface AppContextValue {
  ready: boolean;
  palette: Palette;
  settings: Settings;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  dataVersion: number;
  refresh: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        await getDb();
      } catch (e) {
        // DB failed to open — app stays usable; features degrade gracefully.
        console.warn("[AppContext] database init failed", e);
      }
      try {
        const stored = await storage.getItem<Settings>(
          SETTINGS_KEY,
          DEFAULT_SETTINGS,
        );
        if (stored) setSettings({ ...DEFAULT_SETTINGS, ...stored });
      } catch (e) {
        console.warn("[AppContext] settings load failed", e);
      }
      InteractionManager.runAfterInteractions(() => {
        void purgeOldTrash().catch((error) => {
          console.warn("[AppContext] trash cleanup failed", error);
        });
      });
      // Always mark ready so the UI never hangs on the splash screen.
      setReady(true);
    })();
  }, []);

  const setSetting = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        void storage.setItem(SETTINGS_KEY, next).catch((error) => {
          console.warn("[AppContext] settings save failed", error);
        });
        return next;
      });
    },
    [],
  );

  const refresh = useCallback(() => setDataVersion((v) => v + 1), []);

  const resolvedMode =
    settings.themePref === "system"
      ? systemScheme === "dark"
        ? "dark"
        : "light"
      : settings.themePref;

  const palette = resolvedMode === "dark" ? darkPalette : lightPalette;

  const value = useMemo(
    () => ({ ready, palette, settings, setSetting, dataVersion, refresh }),
    [ready, palette, settings, setSetting, dataVersion, refresh],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function useTheme(): Palette {
  return useApp().palette;
}
