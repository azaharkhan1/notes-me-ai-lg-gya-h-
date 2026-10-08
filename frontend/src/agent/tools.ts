// Controlled Action Tool Registry for the AI Agent.
// The LLM/parser can ONLY request these named tools — never raw DB/code access.
// Every tool performs a REAL operation on local offline data and returns a result.
import {
  createNote, getNote, updateNote, trashNote, listNotes,
} from "@/src/db/repo";
import { createPage } from "@/src/db/pages-repo";
import {
  createEmptyDatabase, addProperty, addView, createRecord, listAllDatabases,
  listProperties, listRecords, createTask, updateTask, listTasks,
} from "@/src/db/workspace-store";
import { Intelligence } from "@/src/intelligence/engine";
import { searchTemplates, installTemplate } from "@/src/data/templates";
import { AgentContext, PlanStep, StepResult } from "./types";

// Execution-scoped variables so steps can reference earlier results.
interface ExecVars {
  lastNoteId?: string;
  lastPageId?: string;
  lastDatabaseId?: string;
  lastTaskId?: string;
}

function resolve(val: any, ctx: AgentContext, vars: ExecVars): any {
  if (typeof val !== "string") return val;
  const map: Record<string, any> = {
    "$lastNoteId": vars.lastNoteId,
    "$lastPageId": vars.lastPageId,
    "$lastDatabaseId": vars.lastDatabaseId,
    "$lastTaskId": vars.lastTaskId,
    "$context.noteId": ctx.noteId,
    "$context.pageId": ctx.pageId,
    "$context.databaseId": ctx.databaseId,
  };
  if (val in map) return map[val] ?? undefined;
  return val;
}

// Resolve a note reference: explicit id, placeholder, context, or title search.
async function resolveNoteId(args: any, ctx: AgentContext, vars: ExecVars): Promise<string | null> {
  const direct = resolve(args.noteId, ctx, vars);
  if (direct) return direct;
  if (ctx.noteId && (args.useContext !== false)) return ctx.noteId;
  const title = args.noteTitle || args.title || args.query;
  if (title) {
    const hits = await listNotes({ filter: "all", search: String(title), sort: "updated" });
    if (hits.length) return hits[0].id;
  }
  return null;
}

const PRIORITY_MAP: Record<string, "low" | "medium" | "high"> = {
  low: "low", medium: "medium", med: "medium", high: "high", urgent: "high",
};

type ToolFn = (args: any, ctx: AgentContext, vars: ExecVars) => Promise<string>;

export const TOOLS: Record<string, ToolFn> = {
  async createNote(args, ctx, vars) {
    const title = String(args.title || args.name || "Untitled Note");
    const content = String(args.content || "");
    const note = await createNote({ title, content, type: "text" });
    vars.lastNoteId = note.id;
    return `Created note "${title}".`;
  },

  async appendToNote(args, ctx, vars) {
    const id = await resolveNoteId(args, ctx, vars);
    if (!id) throw new Error("No note to append to.");
    const note = await getNote(id);
    if (!note) throw new Error("Note not found.");
    const add = String(args.content || args.text || "");
    const sep = note.content && !note.content.endsWith("\n") ? "\n" : "";
    await updateNote(id, { content: note.content + sep + add });
    vars.lastNoteId = id;
    return `Added content to "${note.title || "note"}".`;
  },

  async updateNote(args, ctx, vars) {
    const id = await resolveNoteId(args, ctx, vars);
    if (!id) throw new Error("No note to update.");
    await updateNote(id, { content: String(args.content ?? "") });
    vars.lastNoteId = id;
    return `Updated note content.`;
  },

  async renameNote(args, ctx, vars) {
    const id = await resolveNoteId(args, ctx, vars);
    if (!id) throw new Error("No note to rename.");
    const title = String(args.title || args.name || "");
    if (!title) throw new Error("No new title provided.");
    await updateNote(id, { title });
    vars.lastNoteId = id;
    return `Renamed note to "${title}".`;
  },

  async searchNotes(args, ctx, vars) {
    const q = String(args.query || args.title || "");
    const hits = await listNotes({ filter: "all", search: q, sort: "updated" });
    if (!hits.length) return `No notes found for "${q}".`;
    if (hits[0]) vars.lastNoteId = hits[0].id;
    const names = hits.slice(0, 8).map((n) => `• ${n.title || "Untitled"}`).join("\n");
    return `Found ${hits.length} note(s) for "${q}":\n${names}`;
  },

  async summarizeNote(args, ctx, vars) {
    const id = await resolveNoteId(args, ctx, vars);
    if (!id) throw new Error("No note to summarize.");
    const note = await getNote(id);
    if (!note) throw new Error("Note not found.");
    const text = `${note.title}\n${note.content}`;
    const { summary } = Intelligence.summarize(text, 3);
    if (!summary) return "Nothing to summarize in this note.";
    const block = `\n\n## Summary\n${summary}`;
    await updateNote(id, { content: note.content + block });
    vars.lastNoteId = id;
    return `Summarized and appended to "${note.title || "note"}".`;
  },

  async extractTasksFromNote(args, ctx, vars) {
    const id = await resolveNoteId(args, ctx, vars);
    if (!id) throw new Error("No note to extract tasks from.");
    const note = await getNote(id);
    if (!note) throw new Error("Note not found.");
    const tasks = Intelligence.detectTasksIn(`${note.title}\n${note.content}`, note.title || "note");
    if (!tasks.length) return "No tasks detected in this note.";
    const dbId = resolve(args.databaseId, ctx, vars);
    let created = 0;
    for (const t of tasks) {
      const title = (t as any).title || String(t);
      await createTask({ title, relatedNoteId: id });
      created++;
      if (dbId) {
        const props = await listProperties(dbId);
        const titleProp = props.find((p) => p.type === "title");
        if (titleProp) await createRecord(dbId, { [titleProp.id]: title });
      }
    }
    return `Created ${created} task(s) from "${note.title || "note"}".`;
  },

  async createWorkspace(args, ctx, vars) {
    const name = String(args.name || args.title || "New Workspace");
    const page = await createPage(null, { title: name, icon: "\uD83D\uDDC2\uFE0F" });
    vars.lastPageId = page.id;
    return `Created workspace "${name}".`;
  },

  async createPage(args, ctx, vars) {
    const title = String(args.title || args.name || "Untitled");
    const parent = resolve(args.parentPageId, ctx, vars) || ctx.pageId || null;
    const page = await createPage(parent, { title, icon: "\uD83D\uDCC4" });
    vars.lastPageId = page.id;
    return `Created page "${title}".`;
  },

  async createDatabase(args, ctx, vars) {
    const name = String(args.name || args.title || "Database");
    const parent = resolve(args.parentPageId, ctx, vars) || ctx.pageId || vars.lastPageId || null;
    const db = await createEmptyDatabase(parent, name, "\uD83D\uDDC3\uFE0F");
    const props: { name: string; type: string; options?: string[] }[] =
      Array.isArray(args.properties) && args.properties.length
        ? args.properties
        : [{ name: "Name", type: "title" }, { name: "Status", type: "select", options: ["Todo", "In Progress", "Done"] }];
    let hasTitle = false;
    for (const ps of props) {
      const type = String(ps.type || "text");
      if (type === "title") hasTitle = true;
      const config: any = {};
      if ((type === "select" || type === "multiselect") && Array.isArray(ps.options)) {
        config.options = ps.options.map((o: string) => ({ id: `opt_${Math.random().toString(36).slice(2, 8)}`, name: o, color: "gray" }));
      }
      await addProperty(db.id, String(ps.name || "Field"), type as any, config);
    }
    if (!hasTitle) await addProperty(db.id, "Name", "title" as any, {});
    await addView(db.id, "table", "Table", {});
    vars.lastDatabaseId = db.id;
    return `Created database "${name}" with ${props.length} field(s).`;
  },

  async addRecord(args, ctx, vars) {
    const dbId = resolve(args.databaseId, ctx, vars) || ctx.databaseId || vars.lastDatabaseId;
    if (!dbId) throw new Error("No database to add a record to.");
    const props = await listProperties(dbId);
    const byName: Record<string, string> = {};
    for (const p of props) byName[p.name.toLowerCase()] = p.id;
    const values: Record<string, any> = {};
    const input = args.values && typeof args.values === "object" ? args.values : args;
    for (const k of Object.keys(input)) {
      if (k === "databaseId" || k === "values") continue;
      const pid = byName[String(k).toLowerCase()];
      if (pid) values[pid] = input[k];
    }
    if (!Object.keys(values).length && props[0]) values[props[0].id] = String(args.title || args.name || "New record");
    await createRecord(dbId, values);
    return `Added a record to the database.`;
  },

  async createTask(args, ctx, vars) {
    const title = String(args.title || args.name || "New task");
    const priority = PRIORITY_MAP[String(args.priority || "medium").toLowerCase()] || "medium";
    const task = await createTask({ title, priority, dueDate: args.dueDate || null });
    vars.lastTaskId = task.id;
    return `Created task "${title}" (${priority}).`;
  },

  async updateTaskStatus(args, ctx, vars) {
    const q = String(args.query || args.title || "").toLowerCase();
    const status = String(args.status || "done");
    const tasks = await listTasks();
    const matched = q ? tasks.filter((t) => t.title.toLowerCase().includes(q)) : tasks;
    if (!matched.length) return `No tasks matched "${q}".`;
    for (const t of matched) await updateTask(t.id, { status: status as any });
    return `Updated ${matched.length} task(s) to "${status}".`;
  },

  async listTasks(args, ctx, vars) {
    let tasks = await listTasks();
    if (args.priority) tasks = tasks.filter((t) => t.priority === PRIORITY_MAP[String(args.priority).toLowerCase()]);
    if (args.status) tasks = tasks.filter((t) => String(t.status).toLowerCase() === String(args.status).toLowerCase());
    if (!tasks.length) return "No matching tasks.";
    return `${tasks.length} task(s):\n` + tasks.slice(0, 12).map((t) => `• ${t.title} [${t.priority}/${t.status}]`).join("\n");
  },

  async useTemplate(args, ctx, vars) {
    const q = String(args.query || args.name || args.title || "");
    const matches = searchTemplates(q);
    if (!matches.length) throw new Error(`No template found for "${q}".`);
    const tpl = matches[0];
    const pageId = await installTemplate(tpl, ctx.pageId || vars.lastPageId || null);
    vars.lastPageId = pageId;
    return `Added the "${tpl.name}" template.`;
  },

  async mergeNotes(args, ctx, vars) {
    const q = String(args.query || "");
    const hits = await listNotes({ filter: "all", search: q, sort: "updated" });
    if (hits.length < 2) return `Need at least 2 matching notes to merge (found ${hits.length}).`;
    const merged = hits.map((n) => `## ${n.title || "Untitled"}\n${(n as any).content || ""}`).join("\n\n");
    const note = await createNote({ title: `Merged: ${q || "notes"}`, content: merged, type: "text" });
    for (const n of hits) await trashNote(n.id);
    vars.lastNoteId = note.id;
    return `Merged ${hits.length} notes into one (originals moved to trash).`;
  },

  async trashNote(args, ctx, vars) {
    const id = await resolveNoteId(args, ctx, vars);
    if (!id) throw new Error("No note to delete.");
    const note = await getNote(id);
    await trashNote(id);
    return `Moved "${note?.title || "note"}" to trash.`;
  },
};

export async function executeStep(step: PlanStep, ctx: AgentContext, vars: ExecVars): Promise<StepResult> {
  const fn = TOOLS[step.tool];
  const description = step.description || step.tool;
  if (!fn) return { tool: step.tool, description, ok: false, message: `Unknown action: ${step.tool}` };
  try {
    const message = await fn(step.args || {}, ctx, vars);
    return { tool: step.tool, description, ok: true, message };
  } catch (e: any) {
    return { tool: step.tool, description, ok: false, message: e?.message || "Action failed." };
  }
}

export function newExecVars(): ExecVars {
  return {};
}
