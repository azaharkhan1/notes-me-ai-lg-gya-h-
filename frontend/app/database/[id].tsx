import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp, useTheme } from "@/src/context/AppContext";
import { useToast } from "@/src/components/Toast";
import { BottomSheet } from "@/src/components/Sheet";
import { genId } from "@/src/lib/id";
import { formatResult } from "@/src/lib/formula";
import {
  addProperty,
  addView,
  computeContext,
  createRecord,
  deleteProperty,
  deleteRecord,
  getDatabase,
  listAllDatabases,
  listProperties,
  listRecords,
  listViews,
  updateProperty,
  updateRecord,
  updateRecordValue,
} from "@/src/db/workspace-store";
import { Database, DBRecord, DBView, Property, PropertyType, ViewType } from "@/src/db/workspace-types";
import { createPage } from "@/src/db/pages-repo";

const PROP_TYPES: { type: PropertyType; label: string }[] = [
  { type: "text", label: "Text" }, { type: "number", label: "Number" }, { type: "checkbox", label: "Checkbox" },
  { type: "select", label: "Select" }, { type: "multiselect", label: "Multi-select" }, { type: "date", label: "Date" },
  { type: "datetime", label: "Date + Time" }, { type: "url", label: "URL" }, { type: "email", label: "Email" },
  { type: "phone", label: "Phone" }, { type: "formula", label: "Formula" }, { type: "relation", label: "Relation" },
  { type: "rollup", label: "Rollup" }, { type: "created", label: "Created time" }, { type: "updated", label: "Updated time" },
];
const VIEW_ICONS: Record<ViewType, string> = { table: "table", board: "view-column", list: "format-list-bulleted", calendar: "calendar", gallery: "view-grid" };

export default function DatabaseScreen() {
  const c = useTheme();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { refresh } = useApp();
  const params = useLocalSearchParams<{ id: string }>();
  const dbId = String(params.id);

  const [db, setDb] = useState<Database | null>(null);
  const [props, setProps] = useState<Property[]>([]);
  const [views, setViews] = useState<DBView[]>([]);
  const [records, setRecords] = useState<DBRecord[]>([]);
  const [allDbs, setAllDbs] = useState<Database[]>([]);
  const [allRecordsByDb, setAllRecordsByDb] = useState<Record<string, DBRecord[]>>({});
  const [activeView, setActiveView] = useState(0);
  const [editRec, setEditRec] = useState<DBRecord | null>(null);
  const [addPropOpen, setAddPropOpen] = useState(false);
  const [newPropName, setNewPropName] = useState("");
  const [newPropType, setNewPropType] = useState<PropertyType>("text");
  const [newPropExpr, setNewPropExpr] = useState("");
  const [relTarget, setRelTarget] = useState("");
  const [rollupRel, setRollupRel] = useState("");
  const [rollupTarget, setRollupTarget] = useState("");
  const [rollupFn, setRollupFn] = useState("count");
  const [viewPickerOpen, setViewPickerOpen] = useState(false);

  const load = useCallback(async () => {
    const d = await getDatabase(dbId);
    setDb(d);
    const [pr, vw, rc, dbs] = await Promise.all([listProperties(dbId), listViews(dbId), listRecords(dbId), listAllDatabases()]);
    setProps(pr); setViews(vw); setRecords(rc); setAllDbs(dbs);
    const map: Record<string, DBRecord[]> = {};
    for (const database of dbs) map[database.id] = await listRecords(database.id);
    setAllRecordsByDb(map);
  }, [dbId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const titleProp = props.find((p) => p.type === "title");
  const view = views[activeView] ?? views[0];
  const allRecordsFlat = useMemo(() => Object.values(allRecordsByDb).flat(), [allRecordsByDb]);

  const ctxFor = useCallback((rec: DBRecord) => computeContext(rec, props, allRecordsFlat), [props, allRecordsFlat]);
  const recTitle = (rec: DBRecord) => (titleProp ? String(rec.values?.[titleProp.id] ?? "") : "") || "Untitled";

  const displayValue = (rec: DBRecord, prop: Property): string => {
    const ctx = ctxFor(rec);
    const v = ctx[prop.name];
    if (prop.type === "checkbox") return v ? "\u2713" : "\u2717";
    if (prop.type === "relation") return `${Array.isArray(v) ? v.length : 0} linked`;
    if (prop.type === "formula" || prop.type === "rollup") return formatResult(v as any);
    if (v == null || v === "") return "";
    return String(v);
  };

  const addRecord = async () => {
    await createRecord(dbId, {});
    load();
  };

  const openAsPage = async (rec: DBRecord) => {
    let pid = rec.pageId;
    if (!pid) {
      const page = await createPage(null, { title: recTitle(rec) });
      pid = page.id;
      await updateRecord(rec.id, { pageId: pid });
    }
    refresh();
    router.push({ pathname: "/page/[id]", params: { id: pid } });
  };

  const doAddProperty = async () => {
    const name = newPropName.trim() || newPropType;
    const config: any = {};
    if (newPropType === "formula") config.expr = newPropExpr;
    if (newPropType === "relation") config.targetDatabaseId = relTarget;
    if (newPropType === "rollup") { config.relationPropertyId = rollupRel; config.targetPropertyId = rollupTarget; config.rollupFn = rollupFn; }
    await addProperty(dbId, name, newPropType, config);
    setAddPropOpen(false); setNewPropName(""); setNewPropType("text"); setNewPropExpr(""); setRelTarget(""); setRollupRel(""); setRollupTarget("");
    load();
  };

  const setValue = async (rec: DBRecord, prop: Property, value: any) => {
    await updateRecordValue(rec.id, prop.id, value);
    setEditRec((prev) => prev && prev.id === rec.id ? { ...prev, values: { ...prev.values, [prop.id]: value } } : prev);
    load();
  };

  // grouping for board
  const groupProp = props.find((p) => p.id === view?.config?.groupByPropertyId) || props.find((p) => p.type === "select");
  const dateProp = props.find((p) => p.id === view?.config?.datePropertyId) || props.find((p) => p.type === "date" || p.type === "datetime");

  return (
    <View style={{ flex: 1, backgroundColor: c.surface, paddingTop: insets.top }}>
      <View style={styles.top}>
        <Pressable testID="db-back" onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}><MaterialCommunityIcons name="chevron-left" size={28} color={c.onSurface} /></Pressable>
        <Text style={[styles.heading, { color: c.onSurface }]} numberOfLines={1}>{db?.icon} {db?.title ?? "Database"}</Text>
        <Pressable testID="db-ai-agent" onPress={() => router.push({ pathname: "/agent", params: { databaseId: params.id, databaseTitle: db?.title ?? "", screen: "database" } })} style={styles.iconBtn} hitSlop={8}><MaterialCommunityIcons name="robot-happy-outline" size={22} color={c.brand} /></Pressable>
        <Pressable testID="db-add-prop" onPress={() => setAddPropOpen(true)} style={styles.iconBtn} hitSlop={8}><MaterialCommunityIcons name="table-column-plus-after" size={22} color={c.onSurface} /></Pressable>
      </View>

      <View style={styles.viewTabs}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, alignItems: "center" }}>
          {views.map((v, i) => (
            <Pressable key={v.id} testID={`view-${v.type}`} onPress={() => setActiveView(i)} style={[styles.viewTab, { backgroundColor: i === activeView ? c.brandTertiary : c.surfaceSecondary, borderColor: i === activeView ? c.brand : c.border }]}>
              <MaterialCommunityIcons name={VIEW_ICONS[v.type] as any} size={14} color={i === activeView ? c.brand : c.onSurfaceTertiary} />
              <Text style={[styles.viewTabText, { color: i === activeView ? c.brand : c.onSurfaceTertiary }]}>{v.name}</Text>
            </Pressable>
          ))}
          <Pressable testID="db-add-view" onPress={() => setViewPickerOpen(true)} style={[styles.viewTab, { backgroundColor: c.surfaceSecondary, borderColor: c.border }]}><MaterialCommunityIcons name="plus" size={14} color={c.muted} /></Pressable>
        </ScrollView>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 80 }}>
        {!view || view.type === "table" ? (
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View style={[styles.trow, { borderColor: c.border, backgroundColor: c.surfaceTertiary }]}>
                {props.map((p) => <Text key={p.id} style={[styles.th, { color: c.onSurfaceTertiary }]} numberOfLines={1}>{p.name}</Text>)}
              </View>
              {records.map((rec) => (
                <Pressable key={rec.id} testID={`rec-${rec.id}`} onPress={() => setEditRec(rec)} style={[styles.trow, { borderColor: c.border }]}>
                  {props.map((p) => (
                    <Text key={p.id} numberOfLines={1} style={[styles.td, { color: p.type === "title" ? c.onSurface : c.onSurfaceTertiary, fontWeight: p.type === "title" ? "600" : "400" }]}>
                      {p.type === "title" ? recTitle(rec) : displayValue(rec, p)}
                    </Text>
                  ))}
                </Pressable>
              ))}
            </View>
          </ScrollView>
        ) : view.type === "board" ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(groupProp?.config?.options ?? [{ id: "none", name: "No status", color: "gray" }]).map((opt) => {
              const items = records.filter((r) => (groupProp ? r.values?.[groupProp.id] === opt.name : true));
              return (
                <View key={opt.id} style={[styles.boardCol, { backgroundColor: c.surfaceTertiary }]}>
                  <Text style={[styles.boardTitle, { color: c.onSurface }]}>{opt.name} ({items.length})</Text>
                  {items.map((rec) => (
                    <Pressable key={rec.id} testID={`rec-${rec.id}`} onPress={() => setEditRec(rec)} style={[styles.boardCard, { backgroundColor: c.surfaceSecondary, borderColor: c.border }]}>
                      <Text style={[styles.cardTitle, { color: c.onSurface }]}>{recTitle(rec)}</Text>
                    </Pressable>
                  ))}
                </View>
              );
            })}
          </ScrollView>
        ) : view.type === "gallery" ? (
          <View style={styles.gallery}>
            {records.map((rec) => (
              <Pressable key={rec.id} testID={`rec-${rec.id}`} onPress={() => setEditRec(rec)} style={[styles.galleryCard, { backgroundColor: c.surfaceSecondary, borderColor: c.border }]}>
                <Text style={[styles.cardTitle, { color: c.onSurface }]} numberOfLines={2}>{recTitle(rec)}</Text>
                {props.filter((p) => p.type !== "title").slice(0, 2).map((p) => <Text key={p.id} numberOfLines={1} style={[styles.galleryMeta, { color: c.muted }]}>{p.name}: {displayValue(rec, p)}</Text>)}
              </Pressable>
            ))}
          </View>
        ) : view.type === "calendar" ? (
          <View>
            {records.filter((r) => dateProp && r.values?.[dateProp.id]).sort((a, b) => String(a.values?.[dateProp!.id]).localeCompare(String(b.values?.[dateProp!.id]))).map((rec) => (
              <Pressable key={rec.id} testID={`rec-${rec.id}`} onPress={() => setEditRec(rec)} style={[styles.listRow, { borderColor: c.border, backgroundColor: c.surfaceSecondary }]}>
                <Text style={[styles.dateBadge, { color: c.brand }]}>{String(rec.values?.[dateProp!.id])}</Text>
                <Text style={[styles.cardTitle, { color: c.onSurface }]}>{recTitle(rec)}</Text>
              </Pressable>
            ))}
            {!dateProp && <Text style={[styles.hint, { color: c.muted }]}>Add a Date property to use Calendar view.</Text>}
          </View>
        ) : (
          <View>
            {records.map((rec) => (
              <Pressable key={rec.id} testID={`rec-${rec.id}`} onPress={() => setEditRec(rec)} style={[styles.listRow, { borderColor: c.border, backgroundColor: c.surfaceSecondary }]}>
                <MaterialCommunityIcons name="circle-small" size={22} color={c.muted} />
                <Text style={[styles.cardTitle, { color: c.onSurface }]}>{recTitle(rec)}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {records.length === 0 && <Text style={[styles.hint, { color: c.muted }]}>No records yet.</Text>}
      </ScrollView>

      <Pressable testID="db-add-record" onPress={addRecord} style={[styles.fab, { backgroundColor: c.brand, bottom: insets.bottom + 20 }]}><MaterialCommunityIcons name="plus" size={26} color={c.onBrand} /></Pressable>

      {/* Record editor */}
      <BottomSheet visible={!!editRec} onClose={() => setEditRec(null)} title="Edit record" testID="record-editor">
        {editRec && (
          <View>
            {props.map((prop) => (
              <RecordField key={prop.id} c={c} prop={prop} rec={editRec} value={editRec.values?.[prop.id]} display={displayValue(editRec, prop)} onSet={(v: unknown) => setValue(editRec, prop, v)} onEnsureOption={async (name: string) => {
                const opts = prop.config?.options ?? [];
                if (!opts.find((o) => o.name === name)) { await updateProperty(prop.id, { config: { ...prop.config, options: [...opts, { id: genId("opt"), name, color: "gray" }] } }); load(); }
              }} allDbs={allDbs} allRecordsByDb={allRecordsByDb} recTitleOf={(r: DBRecord) => { const tp = props.find((x) => x.type === "title") || null; return tp ? String(r.values?.[tp.id] ?? "Untitled") : "Untitled"; }} />
            ))}
            <View style={styles.recActions}>
              <Pressable testID="rec-open-page" onPress={() => openAsPage(editRec)} style={[styles.recAction, { backgroundColor: c.surfaceTertiary }]}><MaterialCommunityIcons name="open-in-new" size={18} color={c.onSurface} /><Text style={[styles.recActionText, { color: c.onSurface }]}>Open as page</Text></Pressable>
              <Pressable testID="rec-delete" onPress={async () => { await deleteRecord(editRec.id); setEditRec(null); load(); }} style={[styles.recAction, { backgroundColor: c.surfaceTertiary }]}><MaterialCommunityIcons name="trash-can-outline" size={18} color={c.error} /><Text style={[styles.recActionText, { color: c.error }]}>Delete</Text></Pressable>
            </View>
          </View>
        )}
      </BottomSheet>

      {/* Add property */}
      <BottomSheet visible={addPropOpen} onClose={() => setAddPropOpen(false)} title="New property" testID="add-prop-sheet">
        <TextInput testID="prop-name" value={newPropName} onChangeText={setNewPropName} placeholder="Property name" placeholderTextColor={c.muted} style={[styles.input, { color: c.onSurface, borderColor: c.border }]} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
          {PROP_TYPES.map((pt) => (
            <Pressable key={pt.type} testID={`ptype-${pt.type}`} onPress={() => setNewPropType(pt.type)} style={[styles.opt, { borderColor: newPropType === pt.type ? c.brand : c.border, backgroundColor: newPropType === pt.type ? c.brandTertiary : "transparent" }]}>
              <Text style={[styles.optText, { color: newPropType === pt.type ? c.onSurface : c.muted }]}>{pt.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {newPropType === "formula" && <TextInput testID="prop-expr" value={newPropExpr} onChangeText={setNewPropExpr} placeholder='e.g. IF(prop("Progress") >= 100, "Done", "Open")' placeholderTextColor={c.muted} style={[styles.input, { color: c.onSurface, borderColor: c.border }]} />}
        {newPropType === "relation" && (
          <View>
            <Text style={[styles.fieldLabel, { color: c.muted }]}>RELATED DATABASE</Text>
            {allDbs.map((d) => <Pressable key={d.id} onPress={() => setRelTarget(d.id)} style={[styles.pickRow, { borderColor: relTarget === d.id ? c.brand : c.border }]}><Text style={{ color: c.onSurface }}>{d.title}</Text></Pressable>)}
          </View>
        )}
        {newPropType === "rollup" && (
          <View>
            <Text style={[styles.fieldLabel, { color: c.muted }]}>VIA RELATION PROPERTY</Text>
            {props.filter((p) => p.type === "relation").map((p) => <Pressable key={p.id} onPress={() => setRollupRel(p.id)} style={[styles.pickRow, { borderColor: rollupRel === p.id ? c.brand : c.border }]}><Text style={{ color: c.onSurface }}>{p.name}</Text></Pressable>)}
            <Text style={[styles.fieldLabel, { color: c.muted }]}>FUNCTION</Text>
            <View style={styles.optionRow}>{["count", "count_completed", "sum", "average", "min", "max", "earliest", "latest"].map((f) => <Pressable key={f} onPress={() => setRollupFn(f)} style={[styles.opt, { borderColor: rollupFn === f ? c.brand : c.border }]}><Text style={[styles.optText, { color: c.onSurface }]}>{f}</Text></Pressable>)}</View>
          </View>
        )}
        <Pressable testID="prop-save" onPress={doAddProperty} style={[styles.saveBtn, { backgroundColor: c.brand }]}><Text style={[styles.saveText, { color: c.onBrand }]}>Add property</Text></Pressable>
      </BottomSheet>

      {/* Add view */}
      <BottomSheet visible={viewPickerOpen} onClose={() => setViewPickerOpen(false)} title="Add view" testID="add-view-sheet">
        {(["table", "board", "list", "calendar", "gallery"] as ViewType[]).map((vt) => (
          <Pressable key={vt} testID={`addview-${vt}`} onPress={async () => { await addView(dbId, vt, vt[0].toUpperCase() + vt.slice(1), {}); setViewPickerOpen(false); load(); }} style={styles.menuItem}>
            <MaterialCommunityIcons name={VIEW_ICONS[vt] as any} size={20} color={c.brand} />
            <Text style={[styles.menuLabel, { color: c.onSurface }]}>{vt[0].toUpperCase() + vt.slice(1)}</Text>
          </Pressable>
        ))}
      </BottomSheet>
    </View>
  );
}

function RecordField({ c, prop, rec, value, display, onSet, onEnsureOption, allDbs, allRecordsByDb, recTitleOf }: any) {
  const [newOpt, setNewOpt] = useState("");
  const readOnly = ["formula", "rollup", "created", "updated"].includes(prop.type);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.fieldLabel, { color: c.muted }]}>{prop.name.toUpperCase()} {`\u00B7 ${prop.type}`}</Text>
      {readOnly ? (
        <Text testID={`field-${prop.id}`} style={[styles.readonly, { color: c.onSurfaceTertiary, borderColor: c.border }]}>{display || "\u2014"}</Text>
      ) : prop.type === "checkbox" ? (
        <Pressable testID={`field-${prop.id}`} onPress={() => onSet(!value)}><MaterialCommunityIcons name={value ? "checkbox-marked" : "checkbox-blank-outline"} size={26} color={value ? c.brand : c.muted} /></Pressable>
      ) : prop.type === "select" || prop.type === "multiselect" ? (
        <View>
          <View style={styles.optionRow}>
            {(prop.config?.options ?? []).map((o: any) => {
              const active = prop.type === "multiselect" ? (Array.isArray(value) && value.includes(o.name)) : value === o.name;
              return <Pressable key={o.id} testID={`opt-${prop.id}-${o.name}`} onPress={() => { if (prop.type === "multiselect") { const arr = Array.isArray(value) ? value : []; onSet(active ? arr.filter((x: string) => x !== o.name) : [...arr, o.name]); } else onSet(active ? "" : o.name); }} style={[styles.opt, { borderColor: active ? c.brand : c.border, backgroundColor: active ? c.brandTertiary : "transparent" }]}><Text style={[styles.optText, { color: active ? c.onSurface : c.muted }]}>{o.name}</Text></Pressable>;
            })}
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
            <TextInput value={newOpt} onChangeText={setNewOpt} placeholder="+ add option" placeholderTextColor={c.muted} style={[styles.input, { color: c.onSurface, borderColor: c.border, flex: 1, marginBottom: 0 }]} onSubmitEditing={() => { if (newOpt.trim()) { onEnsureOption(newOpt.trim()); setNewOpt(""); } }} />
          </View>
        </View>
      ) : prop.type === "relation" ? (
        <View style={styles.optionRow}>
          {(allRecordsByDb[prop.config?.targetDatabaseId] ?? []).map((r: any) => {
            const arr: string[] = Array.isArray(value) ? value : [];
            const active = arr.includes(r.id);
            return <Pressable key={r.id} testID={`rel-${r.id}`} onPress={() => onSet(active ? arr.filter((x) => x !== r.id) : [...arr, r.id])} style={[styles.opt, { borderColor: active ? c.brand : c.border, backgroundColor: active ? c.brandTertiary : "transparent" }]}><Text style={[styles.optText, { color: active ? c.onSurface : c.muted }]}>{recTitleOf(r)}</Text></Pressable>;
          })}
          {(!prop.config?.targetDatabaseId || (allRecordsByDb[prop.config?.targetDatabaseId] ?? []).length === 0) && <Text style={{ color: c.muted, fontSize: 13 }}>No related records available.</Text>}
        </View>
      ) : (
        <TextInput testID={`field-${prop.id}`} value={value == null ? "" : String(value)} onChangeText={(v) => onSet(prop.type === "number" ? (v === "" ? "" : Number(v)) : v)} keyboardType={prop.type === "number" ? "numeric" : "default"} placeholder={prop.type === "date" || prop.type === "datetime" ? "yyyy-mm-dd" : prop.name} placeholderTextColor={c.muted} style={[styles.input, { color: c.onSurface, borderColor: c.border }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", height: 56, paddingHorizontal: 8 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  heading: { flex: 1, fontSize: 18, fontWeight: "800", marginLeft: 4 },
  viewTabs: { paddingBottom: 8 },
  viewTab: { flexDirection: "row", alignItems: "center", gap: 5, height: 32, paddingHorizontal: 12, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  viewTabText: { fontSize: 12, fontWeight: "700" },
  trow: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  th: { width: 130, fontSize: 12, fontWeight: "700", paddingHorizontal: 8 },
  td: { width: 130, fontSize: 14, paddingHorizontal: 8 },
  boardCol: { width: 220, marginRight: 12, borderRadius: 12, padding: 10 },
  boardTitle: { fontSize: 13, fontWeight: "800", marginBottom: 8 },
  boardCard: { borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 12, marginBottom: 8 },
  cardTitle: { fontSize: 14, fontWeight: "600" },
  gallery: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  galleryCard: { width: "47%", borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 14, minHeight: 90 },
  galleryMeta: { fontSize: 12, marginTop: 4 },
  listRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, marginBottom: 8 },
  dateBadge: { fontSize: 13, fontWeight: "700", marginRight: 6 },
  hint: { fontSize: 14, paddingVertical: 16, textAlign: "center" },
  fab: { position: "absolute", right: 20, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", elevation: 6 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 6 },
  readonly: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  fieldLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 6 },
  optionRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  opt: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  optText: { fontSize: 13, fontWeight: "600" },
  pickRow: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, marginBottom: 6 },
  saveBtn: { height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 14 },
  saveText: { fontSize: 15, fontWeight: "700" },
  recActions: { flexDirection: "row", gap: 10, marginTop: 10 },
  recAction: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 46, borderRadius: 12 },
  recActionText: { fontSize: 14, fontWeight: "600" },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
  menuLabel: { fontSize: 15, fontWeight: "600" },
});
