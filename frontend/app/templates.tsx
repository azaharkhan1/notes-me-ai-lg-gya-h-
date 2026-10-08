import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp, useTheme } from "@/src/context/AppContext";
import { useToast } from "@/src/components/Toast";
import { BottomSheet } from "@/src/components/Sheet";
import {
  CATEGORIES,
  installTemplate,
  searchTemplates,
  Template,
  TEMPLATES,
} from "@/src/data/templates";
import { getTemplateMeta, toggleTemplateFavorite } from "@/src/db/workspace-store";

export default function Templates() {
  const c = useTheme();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { refresh } = useApp();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("All");
  const [favOnly, setFavOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [preview, setPreview] = useState<Template | null>(null);
  const [installing, setInstalling] = useState(false);

  const loadMeta = useCallback(async () => {
    const m = await getTemplateMeta();
    setFavorites(m.favorites);
    setRecent(m.recent);
  }, []);
  useFocusEffect(useCallback(() => { loadMeta(); }, [loadMeta]));

  const list = useMemo(() => {
    let items = query.trim() ? searchTemplates(query) : TEMPLATES;
    if (cat !== "All") items = items.filter((t) => t.category === cat);
    if (favOnly) items = items.filter((t) => favorites.includes(t.id));
    return items;
  }, [query, cat, favOnly, favorites]);

  const recentTpls = recent.map((id) => TEMPLATES.find((t) => t.id === id)).filter(Boolean) as Template[];

  const onUse = async (tpl: Template) => {
    setInstalling(true);
    try {
      const pageId = await installTemplate(tpl, null);
      setPreview(null);
      refresh();
      toast.show(`\"${tpl.name}\" added`, "success");
      router.push({ pathname: "/page/[id]", params: { id: pageId } });
    } catch (e) {
      console.warn("[templates] install failed", e);
      toast.show("Install failed", "error");
    } finally {
      setInstalling(false);
    }
  };

  const toggleFav = async (id: string) => {
    await toggleTemplateFavorite(id);
    loadMeta();
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.surface, paddingTop: insets.top }}>
      <View style={styles.top}>
        <Pressable testID="tpl-back" onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={c.onSurface} />
        </Pressable>
        <Text style={[styles.heading, { color: c.onSurface }]}>Templates</Text>
        <Text style={[styles.count, { color: c.muted }]}>{TEMPLATES.length}</Text>
      </View>
      <View style={styles.searchWrap}>
        <View style={[styles.searchBar, { backgroundColor: c.surfaceTertiary, borderColor: c.border }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={c.muted} />
          <TextInput testID="tpl-search" value={query} onChangeText={setQuery} placeholder={`Search ${TEMPLATES.length} templates`} placeholderTextColor={c.muted} style={[styles.searchInput, { color: c.onSurface }]} />
        </View>
      </View>
      <View style={{ maxHeight: 44 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {["All", ...CATEGORIES].map((k) => {
            const active = cat === k && !favOnly;
            return (
              <Pressable key={k} testID={`cat-${k}`} onPress={() => { setCat(k); setFavOnly(false); }} style={[styles.chip, { backgroundColor: active ? c.brandTertiary : c.surfaceSecondary, borderColor: active ? c.brand : c.border }]}>
                <Text style={[styles.chipText, { color: active ? c.brand : c.onSurfaceTertiary }]}>{k}</Text>
              </Pressable>
            );
          })}
          <Pressable testID="cat-fav" onPress={() => setFavOnly((v) => !v)} style={[styles.chip, { backgroundColor: favOnly ? c.brandTertiary : c.surfaceSecondary, borderColor: favOnly ? c.brand : c.border }]}>
            <MaterialCommunityIcons name={favOnly ? "star" : "star-outline"} size={14} color={favOnly ? c.brand : c.onSurfaceTertiary} />
            <Text style={[styles.chipText, { color: favOnly ? c.brand : c.onSurfaceTertiary }]}>Favorites</Text>
          </Pressable>
        </ScrollView>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={list}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={16}
        windowSize={11}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          recentTpls.length > 0 && cat === "All" && !query && !favOnly ? (
            <>
              <Text style={[styles.section, { color: c.muted }]}>RECENTLY USED</Text>
              {recentTpls.map((t) => (
                <TemplateCard key={`r-${t.id}`} t={t} c={c} fav={favorites.includes(t.id)} onOpen={() => setPreview(t)} onFav={() => toggleFav(t.id)} />
              ))}
              <Text style={[styles.section, { color: c.muted, marginTop: 8 }]}>ALL TEMPLATES</Text>
            </>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="file-search-outline" size={40} color={c.muted} />
            <Text style={[styles.emptyText, { color: c.muted }]}>No templates match your search.</Text>
          </View>
        }
        renderItem={({ item: t }) => (
          <TemplateCard t={t} c={c} fav={favorites.includes(t.id)} onOpen={() => setPreview(t)} onFav={() => toggleFav(t.id)} />
        )}
      />

      <BottomSheet visible={!!preview} onClose={() => setPreview(null)} title={preview ? `${preview.icon}  ${preview.name}` : ""} testID="tpl-preview">
        {preview && (
          <View>
            <Text style={[styles.previewDesc, { color: c.onSurfaceTertiary }]}>{preview.description}</Text>
            <Text style={[styles.section, { color: c.muted }]}>STRUCTURE</Text>
            {preview.blocks.slice(0, 8).map((b, i) => (
              <View key={i} style={styles.previewRow}>
                <MaterialCommunityIcons name={b.type === "checklist" ? "checkbox-blank-outline" : b.type.startsWith("h") ? "format-header-pound" : "circle-small"} size={16} color={c.muted} />
                <Text numberOfLines={1} style={[styles.previewText, { color: c.onSurface }]}>{b.text || b.type}</Text>
              </View>
            ))}
            {(preview.databases ?? []).map((db, i) => (
              <View key={i} style={[styles.dbPreview, { borderColor: c.border, backgroundColor: c.surfaceTertiary }]}>
                <Text style={[styles.dbTitle, { color: c.onSurface }]}>{"\uD83D\uDDC3\uFE0F"} {db.title}</Text>
                <Text style={[styles.previewText, { color: c.muted }]}>{db.properties.map((p) => p.name).join(" \u00B7 ")}</Text>
                <Text style={[styles.previewText, { color: c.muted }]}>Views: {(db.views ?? ["table"]).join(", ")}</Text>
              </View>
            ))}
            <Pressable testID="tpl-use" disabled={installing} onPress={() => onUse(preview)} style={[styles.useBtn, { backgroundColor: c.brand, opacity: installing ? 0.6 : 1 }]}>
              <MaterialCommunityIcons name="plus-box" size={20} color={c.onBrand} />
              <Text style={[styles.useText, { color: c.onBrand }]}>{installing ? "Adding\u2026" : "Use Template"}</Text>
            </Pressable>
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

function TemplateCard({ t, c, fav, onOpen, onFav }: any) {
  return (
    <Pressable testID={`tpl-${t.id}`} onPress={onOpen} style={[styles.card, { borderColor: c.border, backgroundColor: c.surfaceSecondary }]}>
      <Text style={styles.cardIcon}>{t.icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardName, { color: c.onSurface }]}>{t.name}</Text>
        <Text numberOfLines={1} style={[styles.cardDesc, { color: c.muted }]}>{t.description}</Text>
      </View>
      <Pressable testID={`tpl-fav-${t.id}`} onPress={onFav} hitSlop={8} style={styles.favBtn}>
        <MaterialCommunityIcons name={fav ? "star" : "star-outline"} size={20} color={fav ? c.brand : c.muted} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", height: 56, paddingHorizontal: 8 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  heading: { flex: 1, fontSize: 22, fontWeight: "800", marginLeft: 4 },
  count: { fontSize: 14, fontWeight: "700", marginRight: 16 },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 10 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, height: 46, borderRadius: 999, paddingHorizontal: 16, borderWidth: StyleSheet.hairlineWidth },
  searchInput: { flex: 1, fontSize: 15 },
  chipRow: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, height: 32, paddingHorizontal: 12, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontSize: 12, fontWeight: "700" },
  section: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, marginBottom: 8 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, marginBottom: 10 },
  cardIcon: { fontSize: 26 },
  cardName: { fontSize: 15, fontWeight: "700" },
  cardDesc: { fontSize: 12, marginTop: 2 },
  favBtn: { padding: 4 },
  previewDesc: { fontSize: 14, lineHeight: 20, marginBottom: 14 },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 3 },
  previewText: { fontSize: 13, flex: 1 },
  dbPreview: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 10, marginTop: 10 },
  dbTitle: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  useBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 50, borderRadius: 14, marginTop: 18 },
  useText: { fontSize: 15, fontWeight: "700" },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 14, fontWeight: "500" },
});
