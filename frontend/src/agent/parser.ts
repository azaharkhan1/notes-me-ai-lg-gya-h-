// Offline, deterministic command parser. Handles common commands with NO internet
// so the agent works fully offline. Returns null when it can't confidently parse —
// the orchestrator then falls back to the online LLM planner.
import { AgentContext, PlanStep } from "./types";

function steps(...s: PlanStep[]): PlanStep[] { return s; }

export function parseOffline(command: string, ctx: AgentContext): PlanStep[] | null {
  const raw = command.trim();
  const c = raw.toLowerCase();
  if (!c) return null;

  // --- Create note: "create a note called X" / "new note titled X" ---
  let m = raw.match(/\b(?:create|make|add|new)\s+(?:a\s+)?note\s+(?:called|titled|named|about)?\s*["']?(.+?)["']?$/i);
  if (m && m[1]) {
    return steps({ tool: "createNote", args: { title: m[1].trim() }, description: `Create note "${m[1].trim()}"` });
  }

  // --- Rename current / named note ---
  m = raw.match(/\brename\s+(?:this\s+note|the\s+note|note)?\s*(?:called\s+["']?(.+?)["']?)?\s*to\s+["']?(.+?)["']?$/i);
  if (m && m[2]) {
    const args: any = { title: m[2].trim() };
    if (m[1]) args.noteTitle = m[1].trim();
    return steps({ tool: "renameNote", args, description: `Rename note to "${m[2].trim()}"` });
  }

  // --- Summarize this note (and add to bottom) ---
  if (/\bsummar(y|ize|ise)\b/.test(c) && (/\bthis\s+note\b/.test(c) || ctx.noteId)) {
    return steps({ tool: "summarizeNote", args: {}, description: "Summarize this note" });
  }

  // --- Extract tasks / turn into tasks ---
  if ((/\bextract\b.*\btasks?\b/.test(c) || /\b(turn|convert)\b.*\btasks?\b/.test(c) || /\bcreate tasks? from\b/.test(c)) ) {
    return steps({ tool: "extractTasksFromNote", args: {}, description: "Extract tasks from this note" });
  }

  // --- Find / search notes ---
  m = raw.match(/\b(?:find|search|show)\s+(?:all\s+)?(?:my\s+)?notes?\s+(?:about|related to|on|with|for)?\s*["']?(.+?)["']?$/i);
  if (m && m[1]) {
    return steps({ tool: "searchNotes", args: { query: m[1].trim() }, description: `Search notes for "${m[1].trim()}"` });
  }

  // --- Create workspace ---
  m = raw.match(/\b(?:create|make|new)\s+(?:a\s+)?workspace\s+(?:called|named|titled)?\s*["']?(.+?)["']?$/i);
  if (m && m[1]) {
    return steps({ tool: "createWorkspace", args: { name: m[1].trim() }, description: `Create workspace "${m[1].trim()}"` });
  }

  // --- Create database (optionally with fields "with A, B, C") ---
  m = raw.match(/\b(?:create|make|new)\s+(?:a\s+)?database\s+(?:called|named|titled)?\s*["']?(.+?)["']?(?:\s+with\s+(.+))?$/i);
  if (m && m[1]) {
    const name = m[1].trim();
    const args: any = { name };
    if (m[2]) {
      const fields = m[2].split(/,|\band\b/).map((f) => f.trim()).filter(Boolean);
      args.properties = [{ name: "Name", type: "title" }, ...fields.map((f) => guessProperty(f))];
    }
    return steps({ tool: "createDatabase", args, description: `Create database "${name}"` });
  }

  // --- Create a task ---
  m = raw.match(/\b(?:create|add|new)\s+(?:a\s+)?task\s+(?:called|named|titled|to)?\s*["']?(.+?)["']?$/i);
  if (m && m[1]) {
    const pr = /\burgent|high\b/.test(c) ? "high" : /\blow\b/.test(c) ? "low" : "medium";
    return steps({ tool: "createTask", args: { title: m[1].trim(), priority: pr }, description: `Create task "${m[1].trim()}"` });
  }

  // --- Show high-priority tasks ---
  if (/\b(show|list|find)\b.*\b(high[- ]?priority|urgent)\b.*\btasks?\b/.test(c) || /\bhigh[- ]?priority tasks?\b/.test(c)) {
    return steps({ tool: "listTasks", args: { priority: "high" }, description: "List high-priority tasks" });
  }
  if (/\b(show|list)\b.*\btasks?\b/.test(c)) {
    return steps({ tool: "listTasks", args: {}, description: "List tasks" });
  }

  // --- Mark completed tasks as archived ---
  if (/\bmark\b.*\b(completed|done)\b.*\barchived?\b/.test(c) || /\barchive\b.*\b(completed|done)\b.*tasks?\b/.test(c)) {
    return steps({ tool: "updateTaskStatus", args: { query: "", status: "archived" }, description: "Archive completed tasks" });
  }

  // --- Use a template ---
  m = raw.match(/\b(?:use|add|insert|apply)\s+(?:the\s+)?(.+?)\s+template$/i) || raw.match(/\btemplate\s+for\s+(.+)$/i);
  if (m && m[1]) {
    return steps({ tool: "useTemplate", args: { query: m[1].trim() }, description: `Use "${m[1].trim()}" template` });
  }

  // --- Merge duplicate / matching notes (destructive) ---
  m = raw.match(/\bmerge\b\s+(?:duplicate\s+)?notes?\s*(?:about|on|for)?\s*["']?(.*?)["']?$/i);
  if (m) {
    return steps({ tool: "mergeNotes", args: { query: (m[1] || "").trim() }, description: "Merge matching notes" });
  }

  // --- Delete / trash this note (destructive) ---
  if (/\b(delete|trash|remove)\b.*\b(this\s+note|note)\b/.test(c) && ctx.noteId) {
    return steps({ tool: "trashNote", args: {}, description: "Move this note to trash" });
  }

  return null; // let the LLM handle it
}

function guessProperty(field: string): { name: string; type: string; options?: string[] } {
  const f = field.toLowerCase();
  const name = field.replace(/\b\w/, (x) => x.toUpperCase());
  if (/priority/.test(f)) return { name, type: "select", options: ["Low", "Medium", "High"] };
  if (/status|stage/.test(f)) return { name, type: "select", options: ["Todo", "In Progress", "Done"] };
  if (/date|due|deadline/.test(f)) return { name, type: "date" };
  if (/done|complete|checkbox/.test(f)) return { name, type: "checkbox" };
  if (/amount|price|number|count|qty|quantity|score/.test(f)) return { name, type: "number" };
  return { name, type: "text" };
}
