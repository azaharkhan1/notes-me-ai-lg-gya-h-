// Central data layer for M3-M7 entities, persisted as one JSON doc via the
// platform KV (SQLite `kv` on native, AsyncStorage on web). Works offline.
import { kvGet, kvSet } from "./kv";
import { genId, nowIso } from "../lib/id";
import { createPage, updatePage } from "./pages-repo";
import { evalFormula, formatResult } from "../lib/formula";
import {
  Comment,
  Database,
  DBRecord,
  DBView,
  PageVersion,
  Project,
  Property,
  PropertyType,
  Task,
  ViewType,
  WorkspaceDoc,
} from "./workspace-types";

const KEY = "workspace.doc.v1";
const VERSION_RETENTION = 30;

let cache: WorkspaceDoc | null = null;
let loadP: Promise<WorkspaceDoc> | null = null;

const empty = (): WorkspaceDoc => ({
  databases: [],
  properties: [],
  views: [],
  records: [],
  tasks: [],
  projects: [],
  comments: [],
  versions: [],
  templateFavorites: [],
  templateRecent: [],
});

async function load(): Promise<WorkspaceDoc> {
  if (cache) return cache;
  if (loadP) return loadP;
  loadP = (async () => {
    const raw = await kvGet<any>(KEY, null);
    cache = raw && typeof raw === "object" ? { ...empty(), ...raw } : empty();
    return cache as WorkspaceDoc;
  })();
  return loadP;
}
async function persist(): Promise<void> {
  if (cache) await kvSet(KEY, cache);
}

// ---------- Databases ----------
export async function createDatabase(
  pageId: string | null,
  title = "Untitled Database",
): Promise<Database> {
  const d = await load();
  const ts = nowIso();
  const db: Database = { id: genId("db"), pageId, title, icon: "\uD83D\uDDC3\uFE0F", createdAt: ts, updatedAt: ts };
  d.databases.push(db);
  // default title + status properties
  d.properties.push({ id: genId("prop"), databaseId: db.id, name: "Name", type: "title", config: {}, orderIndex: 0 });
  d.properties.push({
    id: genId("prop"),
    databaseId: db.id,
    name: "Status",
    type: "select",
    config: { options: [
      { id: genId("opt"), name: "Todo", color: "gray" },
      { id: genId("opt"), name: "In Progress", color: "blue" },
      { id: genId("opt"), name: "Done", color: "green" },
    ] },
    orderIndex: 1,
  });
  d.views.push({ id: genId("view"), databaseId: db.id, type: "table", name: "Table", config: {}, orderIndex: 0 });
  await persist();
  return db;
}

export async function createEmptyDatabase(
  pageId: string | null,
  title: string,
  icon = "\uD83D\uDDC3\uFE0F",
): Promise<Database> {
  const d = await load();
  const ts = nowIso();
  const db: Database = { id: genId("db"), pageId, title, icon, createdAt: ts, updatedAt: ts };
  d.databases.push(db);
  await persist();
  return db;
}

export async function getDatabase(id: string): Promise<Database | null> {
  const d = await load();
  return d.databases.find((x) => x.id === id) ?? null;
}
export async function listDatabasesForPage(pageId: string): Promise<Database[]> {
  const d = await load();
  return d.databases.filter((x) => x.pageId === pageId);
}
export async function listAllDatabases(): Promise<Database[]> {
  const d = await load();
  return d.databases.slice();
}
export async function updateDatabase(id: string, fields: Partial<Database>): Promise<void> {
  const d = await load();
  const db = d.databases.find((x) => x.id === id);
  if (!db) return;
  Object.assign(db, fields, { updatedAt: nowIso() });
  await persist();
}
export async function deleteDatabase(id: string): Promise<void> {
  const d = await load();
  d.properties = d.properties.filter((p) => p.databaseId !== id);
  d.views = d.views.filter((v) => v.databaseId !== id);
  d.records = d.records.filter((r) => r.databaseId !== id);
  d.databases = d.databases.filter((x) => x.id !== id);
  await persist();
}

// ---------- Properties ----------
export async function listProperties(databaseId: string): Promise<Property[]> {
  const d = await load();
  return d.properties.filter((p) => p.databaseId === databaseId).sort((a, b) => a.orderIndex - b.orderIndex);
}
export async function addProperty(databaseId: string, name: string, type: PropertyType, config: any = {}): Promise<Property> {
  const d = await load();
  const max = d.properties.filter((p) => p.databaseId === databaseId).reduce((m, p) => Math.max(m, p.orderIndex), -1);
  const prop: Property = { id: genId("prop"), databaseId, name, type, config, orderIndex: max + 1 };
  d.properties.push(prop);
  await persist();
  return prop;
}
export async function updateProperty(id: string, fields: Partial<Property>): Promise<void> {
  const d = await load();
  const p = d.properties.find((x) => x.id === id);
  if (!p) return;
  Object.assign(p, fields);
  await persist();
}
export async function deleteProperty(id: string): Promise<void> {
  const d = await load();
  d.properties = d.properties.filter((x) => x.id !== id);
  d.records.forEach((r) => { if (r.values) delete r.values[id]; });
  await persist();
}

// ---------- Views ----------
export async function listViews(databaseId: string): Promise<DBView[]> {
  const d = await load();
  return d.views.filter((v) => v.databaseId === databaseId).sort((a, b) => a.orderIndex - b.orderIndex);
}
export async function addView(databaseId: string, type: ViewType, name: string, config: any = {}): Promise<DBView> {
  const d = await load();
  const max = d.views.filter((v) => v.databaseId === databaseId).reduce((m, v) => Math.max(m, v.orderIndex), -1);
  const view: DBView = { id: genId("view"), databaseId, type, name, config, orderIndex: max + 1 };
  d.views.push(view);
  await persist();
  return view;
}
export async function updateView(id: string, fields: Partial<DBView>): Promise<void> {
  const d = await load();
  const v = d.views.find((x) => x.id === id);
  if (!v) return;
  Object.assign(v, fields);
  await persist();
}
export async function deleteView(id: string): Promise<void> {
  const d = await load();
  d.views = d.views.filter((x) => x.id !== id);
  await persist();
}

// ---------- Records ----------
export async function listRecords(databaseId: string): Promise<DBRecord[]> {
  const d = await load();
  return d.records.filter((r) => r.databaseId === databaseId).sort((a, b) => a.orderIndex - b.orderIndex);
}
export async function getRecord(id: string): Promise<DBRecord | null> {
  const d = await load();
  return d.records.find((r) => r.id === id) ?? null;
}
export async function createRecord(
  databaseId: string,
  values: Record<string, any> = {},
  opts: { withPage?: boolean; parentPageId?: string | null } = {},
): Promise<DBRecord> {
  const d = await load();
  const ts = nowIso();
  const max = d.records.filter((r) => r.databaseId === databaseId).reduce((m, r) => Math.max(m, r.orderIndex), -1);
  let pageId: string | null = null;
  if (opts.withPage) {
    const props = d.properties.filter((p) => p.databaseId === databaseId);
    const titleProp = props.find((p) => p.type === "title");
    const title = titleProp ? String(values[titleProp.id] ?? "") : "";
    const page = await createPage(opts.parentPageId ?? null, { title: title || "Untitled", icon: "\uD83D\uDCC4" });
    pageId = page.id;
  }
  const rec: DBRecord = { id: genId("rec"), databaseId, pageId, values, orderIndex: max + 1, createdAt: ts, updatedAt: ts };
  d.records.push(rec);
  await persist();
  return rec;
}
export async function updateRecord(id: string, fields: Partial<DBRecord>): Promise<void> {
  const d = await load();
  const rec = d.records.find((r) => r.id === id);
  if (!rec) return;
  Object.assign(rec, fields, { updatedAt: nowIso() });
  await persist();
}
export async function updateRecordValue(recordId: string, propertyId: string, value: any): Promise<void> {
  const d = await load();
  const rec = d.records.find((r) => r.id === recordId);
  if (!rec) return;
  rec.values = rec.values || {};
  rec.values[propertyId] = value;
  rec.updatedAt = nowIso();
  // keep linked page title in sync when the title property changes
  const prop = d.properties.find((p) => p.id === propertyId);
  if (prop?.type === "title" && rec.pageId) {
    await updatePage(rec.pageId, { title: String(value ?? "") });
  }
  await persist();
}
export async function deleteRecord(id: string): Promise<void> {
  const d = await load();
  d.records = d.records.filter((r) => r.id !== id);
  await persist();
}
export async function duplicateRecord(id: string): Promise<DBRecord | null> {
  const d = await load();
  const rec = d.records.find((r) => r.id === id);
  if (!rec) return null;
  const copy = await createRecord(rec.databaseId, JSON.parse(JSON.stringify(rec.values || {})));
  return copy;
}

// ---------- Computed values (relations / rollups / formulas) ----------
export function computeContext(
  rec: DBRecord,
  props: Property[],
  allRecords: DBRecord[],
): Record<string, any> {
  const ctx: Record<string, any> = {};
  const raw = rec.values || {};
  // pass 1: primitives, created/updated, relation counts
  for (const p of props) {
    if (p.type === "formula") continue;
    if (p.type === "created") ctx[p.name] = rec.createdAt;
    else if (p.type === "updated") ctx[p.name] = rec.updatedAt;
    else if (p.type === "rollup") ctx[p.name] = computeRollup(p, rec, props, allRecords);
    else if (p.type === "relation") ctx[p.name] = Array.isArray(raw[p.id]) ? raw[p.id] : [];
    else ctx[p.name] = raw[p.id];
  }
  // pass 2: formulas (can reference pass-1 values)
  for (const p of props) {
    if (p.type !== "formula") continue;
    const r = evalFormula(p.config?.expr || "", ctx);
    ctx[p.name] = r && typeof r === "object" && "error" in r ? formatResult(r) : r;
  }
  return ctx;
}

export function computeRollup(
  prop: Property,
  rec: DBRecord,
  props: Property[],
  allRecords: DBRecord[],
): number | string {
  const cfg = prop.config || {};
  const relProp = props.find((p) => p.id === cfg.relationPropertyId);
  if (!relProp) return 0;
  const relIds: string[] = Array.isArray(rec.values?.[relProp.id]) ? rec.values[relProp.id] : [];
  const related = allRecords.filter((r) => relIds.includes(r.id));
  const targetPropId = cfg.targetPropertyId;
  const vals = related.map((r) => r.values?.[targetPropId as string]);
  const nums = vals.map((v) => Number(v)).filter((n) => !isNaN(n));
  switch (cfg.rollupFn) {
    case "count": return related.length;
    case "count_completed":
      return related.filter((r) => {
        const v = r.values?.[targetPropId as string];
        return v === true || v === "Done" || v === "done";
      }).length;
    case "sum": return nums.reduce((a, b) => a + b, 0);
    case "average": return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    case "min": return nums.length ? Math.min(...nums) : 0;
    case "max": return nums.length ? Math.max(...nums) : 0;
    case "earliest": {
      const dates = vals.map((v) => new Date(v)).filter((d) => !isNaN(d.getTime()));
      return dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString().slice(0, 10) : "";
    }
    case "latest": {
      const dates = vals.map((v) => new Date(v)).filter((d) => !isNaN(d.getTime()));
      return dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString().slice(0, 10) : "";
    }
    default: return related.length;
  }
}

// ---------- Tasks ----------
export async function listTasks(opts: { includeDeleted?: boolean } = {}): Promise<Task[]> {
  const d = await load();
  return d.tasks
    .filter((t) => (opts.includeDeleted ? true : !t.isDeleted))
    .sort((a, b) => (a.dueDate ?? "z").localeCompare(b.dueDate ?? "z"));
}
export async function createTask(partial: Partial<Task> = {}): Promise<Task> {
  const d = await load();
  const ts = nowIso();
  const task: Task = {
    id: genId("task"),
    title: partial.title ?? "",
    status: partial.status ?? "todo",
    priority: partial.priority ?? "medium",
    dueDate: partial.dueDate ?? null,
    time: partial.time ?? null,
    tags: partial.tags ?? [],
    projectId: partial.projectId ?? null,
    relatedPageId: partial.relatedPageId ?? null,
    relatedNoteId: partial.relatedNoteId ?? null,
    reminderAt: partial.reminderAt ?? null,
    notificationId: partial.notificationId ?? null,
    createdAt: ts,
    updatedAt: ts,
    isDeleted: 0,
  };
  d.tasks.push(task);
  await persist();
  return task;
}
export async function updateTask(id: string, fields: Partial<Task>): Promise<void> {
  const d = await load();
  const t = d.tasks.find((x) => x.id === id);
  if (!t) return;
  Object.assign(t, fields, { updatedAt: nowIso() });
  await persist();
}
export async function deleteTask(id: string): Promise<void> {
  const d = await load();
  const t = d.tasks.find((x) => x.id === id);
  if (t) { t.isDeleted = 1; t.updatedAt = nowIso(); }
  await persist();
}
export async function listProjects(): Promise<Project[]> {
  const d = await load();
  return d.projects.slice();
}
export async function createProject(name: string, color = "orange"): Promise<Project> {
  const d = await load();
  const proj: Project = { id: genId("proj"), name, color, createdAt: nowIso() };
  d.projects.push(proj);
  await persist();
  return proj;
}
export async function deleteProject(id: string): Promise<void> {
  const d = await load();
  d.projects = d.projects.filter((p) => p.id !== id);
  d.tasks.forEach((t) => { if (t.projectId === id) t.projectId = null; });
  await persist();
}

// ---------- Comments ----------
export async function listComments(targetType: Comment["targetType"], targetId: string): Promise<Comment[]> {
  const d = await load();
  return d.comments.filter((c) => c.targetType === targetType && c.targetId === targetId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export async function listPageComments(pageId: string): Promise<Comment[]> {
  const d = await load();
  return d.comments.filter((c) => c.pageId === pageId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export async function addComment(targetType: Comment["targetType"], targetId: string, pageId: string | null, text: string): Promise<Comment> {
  const d = await load();
  const ts = nowIso();
  const c: Comment = { id: genId("cmt"), targetType, targetId, pageId, text, resolved: 0, createdAt: ts, updatedAt: ts };
  d.comments.push(c);
  await persist();
  return c;
}
export async function updateComment(id: string, fields: Partial<Comment>): Promise<void> {
  const d = await load();
  const c = d.comments.find((x) => x.id === id);
  if (!c) return;
  Object.assign(c, fields, { updatedAt: nowIso() });
  await persist();
}
export async function deleteComment(id: string): Promise<void> {
  const d = await load();
  d.comments = d.comments.filter((c) => c.id !== id);
  await persist();
}

// ---------- Version history ----------
export async function saveVersion(v: Omit<PageVersion, "id" | "createdAt">): Promise<PageVersion> {
  const d = await load();
  const version: PageVersion = { ...v, id: genId("ver"), createdAt: nowIso() };
  d.versions.push(version);
  // retention: keep last N per page
  const forPage = d.versions.filter((x) => x.pageId === v.pageId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (forPage.length > VERSION_RETENTION) {
    const remove = new Set(forPage.slice(VERSION_RETENTION).map((x) => x.id));
    d.versions = d.versions.filter((x) => !remove.has(x.id));
  }
  await persist();
  return version;
}
export async function listVersions(pageId: string): Promise<PageVersion[]> {
  const d = await load();
  return d.versions.filter((v) => v.pageId === pageId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function getVersion(id: string): Promise<PageVersion | null> {
  const d = await load();
  return d.versions.find((v) => v.id === id) ?? null;
}
export async function deleteVersion(id: string): Promise<void> {
  const d = await load();
  d.versions = d.versions.filter((v) => v.id !== id);
  await persist();
}

// ---------- Template metadata ----------
export async function getTemplateMeta(): Promise<{ favorites: string[]; recent: string[] }> {
  const d = await load();
  return { favorites: d.templateFavorites, recent: d.templateRecent };
}
export async function toggleTemplateFavorite(id: string): Promise<void> {
  const d = await load();
  d.templateFavorites = d.templateFavorites.includes(id)
    ? d.templateFavorites.filter((x) => x !== id)
    : [...d.templateFavorites, id];
  await persist();
}
export async function addRecentTemplate(id: string): Promise<void> {
  const d = await load();
  d.templateRecent = [id, ...d.templateRecent.filter((x) => x !== id)].slice(0, 12);
  await persist();
}

// ---------- Backup / restore ----------
export async function exportWorkspaceDoc(): Promise<WorkspaceDoc> {
  const d = await load();
  return JSON.parse(JSON.stringify(d));
}
export async function importWorkspaceDoc(doc: Partial<WorkspaceDoc>, mode: "replace" | "merge"): Promise<void> {
  const d = await load();
  if (mode === "replace") {
    cache = { ...empty(), ...doc } as WorkspaceDoc;
  } else {
    cache = {
      databases: [...d.databases, ...(doc.databases ?? [])],
      properties: [...d.properties, ...(doc.properties ?? [])],
      views: [...d.views, ...(doc.views ?? [])],
      records: [...d.records, ...(doc.records ?? [])],
      tasks: [...d.tasks, ...(doc.tasks ?? [])],
      projects: [...d.projects, ...(doc.projects ?? [])],
      comments: [...d.comments, ...(doc.comments ?? [])],
      versions: [...d.versions, ...(doc.versions ?? [])],
      templateFavorites: d.templateFavorites,
      templateRecent: d.templateRecent,
    };
  }
  await persist();
}

export async function workspaceStats(): Promise<{ databases: number; records: number; tasks: number; comments: number; versions: number }> {
  const d = await load();
  return {
    databases: d.databases.length,
    records: d.records.length,
    tasks: d.tasks.filter((t) => !t.isDeleted).length,
    comments: d.comments.length,
    versions: d.versions.length,
  };
}
