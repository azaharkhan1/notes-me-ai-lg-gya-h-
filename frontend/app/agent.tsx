import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp, useTheme } from "@/src/context/AppContext";
import { planCommand, executePlan } from "@/src/agent/agent";
import { AgentContext, AgentPlan, StepResult } from "@/src/agent/types";

interface Turn {
  q: string;
  plan?: AgentPlan;
  results?: StepResult[];
  summary?: string;
  awaitingConfirm?: boolean;
  busy?: boolean;
}

export default function AgentScreen() {
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refresh } = useApp();
  const params = useLocalSearchParams<{ noteId?: string; noteTitle?: string; pageId?: string; pageTitle?: string; databaseId?: string; databaseTitle?: string; screen?: string }>();
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const ctx: AgentContext = useMemo(() => ({
    noteId: params.noteId || null,
    noteTitle: params.noteTitle || null,
    pageId: params.pageId || null,
    pageTitle: params.pageTitle || null,
    databaseId: params.databaseId || null,
    databaseTitle: params.databaseTitle || null,
    screen: params.screen || "workspace",
  }), [params.noteId, params.pageId, params.databaseId]);

  const contextLabel = ctx.noteId ? `Note: ${ctx.noteTitle || "current"}`
    : ctx.databaseId ? `Database: ${ctx.databaseTitle || "current"}`
    : ctx.pageId ? `Page: ${ctx.pageTitle || "current"}`
    : null;

  const suggestions = ctx.noteId
    ? ["Summarize this note", "Extract tasks from this note", "Rename this note to Project Ideas"]
    : ctx.databaseId
    ? ["Add a record", "Show high-priority tasks", "Analyze this database"]
    : [
        "Create a note called AI Project",
        "Create a Tasks database with Name, Priority, Status, Due Date",
        "Create a workspace called College",
        "Show high-priority tasks",
        "Use a startup planner template",
      ];

  const scrollDown = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

  const updateLast = (patch: Partial<Turn>) =>
    setTurns((ts) => ts.map((t, i) => (i === ts.length - 1 ? { ...t, ...patch } : t)));

  const run = async (command: string) => {
    const cmd = command.trim();
    if (!cmd || busy) return;
    setQ("");
    setBusy(true);
    setTurns((ts) => [...ts, { q: cmd, busy: true }]);
    scrollDown();
    const plan = await planCommand(cmd, ctx);
    if (!plan.steps.length) {
      updateLast({ busy: false, plan, summary: plan.reply });
      setBusy(false);
      scrollDown();
      return;
    }
    if (plan.needsConfirm) {
      updateLast({ busy: false, plan, awaitingConfirm: true });
      setBusy(false);
      scrollDown();
      return;
    }
    const res = await executePlan(plan.steps, ctx);
    updateLast({ busy: false, plan, results: res.results, summary: res.reply });
    refresh();
    setBusy(false);
    scrollDown();
  };

  const confirmRun = async (idx: number) => {
    const turn = turns[idx];
    if (!turn?.plan) return;
    setBusy(true);
    setTurns((ts) => ts.map((t, i) => (i === idx ? { ...t, awaitingConfirm: false, busy: true } : t)));
    const res = await executePlan(turn.plan.steps, ctx);
    setTurns((ts) => ts.map((t, i) => (i === idx ? { ...t, busy: false, results: res.results, summary: res.reply } : t)));
    refresh();
    setBusy(false);
    scrollDown();
  };

  const cancelRun = (idx: number) =>
    setTurns((ts) => ts.map((t, i) => (i === idx ? { ...t, awaitingConfirm: false, summary: "Cancelled. No changes were made." } : t)));

  return (
    <View style={{ flex: 1, backgroundColor: c.surface, paddingTop: insets.top }}>
      <View style={styles.top}>
        <Pressable testID="agent-back" onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={c.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: c.onSurface }]}>AI Agent</Text>
          {contextLabel && <Text numberOfLines={1} style={[styles.ctx, { color: c.brand }]}>{contextLabel}</Text>}
        </View>
        <MaterialCommunityIcons name="robot-happy-outline" size={24} color={c.brand} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          {turns.length === 0 && (
            <View>
              <View style={[styles.banner, { backgroundColor: c.surfaceSecondary, borderColor: c.border }]}>
                <MaterialCommunityIcons name="lightning-bolt" size={18} color={c.brand} />
                <Text style={[styles.bannerText, { color: c.muted }]}>
                  I take real actions on your notes, workspaces, databases and tasks. Common commands work 100% offline.
                </Text>
              </View>
              <Text style={[styles.suggestLabel, { color: c.muted }]}>TRY</Text>
              {suggestions.map((s) => (
                <Pressable key={s} testID={`agent-suggest-${s.slice(0, 8)}`} onPress={() => run(s)} style={[styles.suggest, { backgroundColor: c.surfaceSecondary, borderColor: c.border }]}>
                  <MaterialCommunityIcons name="arrow-right-circle-outline" size={16} color={c.brand} />
                  <Text style={[styles.suggestText, { color: c.onSurface }]}>{s}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {turns.map((t, i) => (
            <View key={i} style={{ marginBottom: 18 }}>
              <View style={[styles.bubbleQ, { backgroundColor: c.brand }]}>
                <Text style={[styles.bubbleQText, { color: c.onBrand }]}>{t.q}</Text>
              </View>

              {t.busy && (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={c.brand} />
                  <Text style={[styles.loadingText, { color: c.muted }]}>Thinking…</Text>
                </View>
              )}

              {t.plan && !t.busy && (
                <View style={[styles.answer, { backgroundColor: c.surfaceSecondary, borderColor: c.border }]}>
                  {!!t.plan.reply && <Text style={[styles.answerText, { color: c.onSurface }]}>{t.plan.reply}</Text>}
                  {t.plan.steps.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      {t.plan.steps.map((s, j) => (
                        <View key={j} style={styles.stepRow}>
                          <MaterialCommunityIcons name="circle-small" size={18} color={c.brand} />
                          <Text style={[styles.stepText, { color: c.onSurface }]}>{s.description || s.tool}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <View style={styles.sourceRow}>
                    <MaterialCommunityIcons name={t.plan.source === "offline" ? "wifi-off" : "cloud-outline"} size={13} color={c.muted} />
                    <Text style={[styles.sourceText, { color: c.muted }]}>{t.plan.source === "offline" ? "Planned offline" : "Planned with AI"}</Text>
                  </View>

                  {t.awaitingConfirm && (
                    <View>
                      <View style={[styles.warn, { backgroundColor: c.brandTertiary }]}>
                        <MaterialCommunityIcons name="alert-outline" size={16} color={c.brand} />
                        <Text style={[styles.warnText, { color: c.brand }]}>This includes a destructive action. Confirm to proceed.</Text>
                      </View>
                      <View style={styles.confirmRow}>
                        <Pressable testID="agent-cancel" onPress={() => cancelRun(i)} style={[styles.confirmBtn, { backgroundColor: c.surfaceTertiary, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth }]}>
                          <Text style={[styles.confirmText, { color: c.onSurface }]}>Cancel</Text>
                        </Pressable>
                        <Pressable testID="agent-confirm" onPress={() => confirmRun(i)} style={[styles.confirmBtn, { backgroundColor: c.brand }]}>
                          <Text style={[styles.confirmText, { color: c.onBrand }]}>Run</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}

                  {t.results && (
                    <View style={{ marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, paddingTop: 10 }}>
                      {t.results.map((r, j) => (
                        <View key={j} style={styles.resultRow}>
                          <MaterialCommunityIcons name={r.ok ? "check-circle" : "close-circle"} size={16} color={r.ok ? "#16a34a" : "#dc2626"} />
                          <Text style={[styles.resultText, { color: c.onSurface }]}>{r.message}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {!!t.summary && !t.results && !t.awaitingConfirm && (
                    <Text style={[styles.summaryText, { color: c.muted }]}>{t.summary}</Text>
                  )}
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        <View style={[styles.inputBar, { backgroundColor: c.surface, borderColor: c.border, paddingBottom: insets.bottom + 10 }]}>
          <TextInput
            testID="agent-input"
            value={q}
            onChangeText={setQ}
            placeholder="Tell the agent what to do…"
            placeholderTextColor={c.muted}
            style={[styles.input, { backgroundColor: c.surfaceTertiary, color: c.onSurface, borderColor: c.border }]}
            onSubmitEditing={() => run(q)}
            returnKeyType="send"
            editable={!busy}
          />
          <Pressable testID="agent-send" onPress={() => run(q)} style={[styles.send, { backgroundColor: c.brand, opacity: busy ? 0.6 : 1 }]} disabled={busy}>
            <MaterialCommunityIcons name="send" size={20} color={c.onBrand} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", height: 56, paddingHorizontal: 8 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
  ctx: { fontSize: 12, fontWeight: "600", marginTop: 1 },
  banner: { flexDirection: "row", gap: 10, alignItems: "center", padding: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginBottom: 20 },
  bannerText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  suggestLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, marginBottom: 10 },
  suggest: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, marginBottom: 10 },
  suggestText: { flex: 1, fontSize: 14, fontWeight: "500" },
  bubbleQ: { alignSelf: "flex-end", maxWidth: "85%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderBottomRightRadius: 4, marginBottom: 10 },
  bubbleQText: { fontSize: 15, fontWeight: "600" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  loadingText: { fontSize: 14 },
  answer: { padding: 14, borderRadius: 16, borderBottomLeftRadius: 4, borderWidth: StyleSheet.hairlineWidth },
  answerText: { fontSize: 15, lineHeight: 22, fontWeight: "600" },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 2 },
  stepText: { flex: 1, fontSize: 14 },
  sourceRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 },
  sourceText: { fontSize: 11.5 },
  warn: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, marginTop: 12 },
  warnText: { flex: 1, fontSize: 12.5, fontWeight: "600" },
  confirmRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  confirmBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  confirmText: { fontSize: 14, fontWeight: "700" },
  resultRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 3 },
  resultText: { flex: 1, fontSize: 13.5, lineHeight: 19 },
  summaryText: { fontSize: 13.5, marginTop: 8, lineHeight: 19 },
  inputBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, height: 46, borderRadius: 23, paddingHorizontal: 16, fontSize: 15, borderWidth: StyleSheet.hairlineWidth },
  send: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
});
