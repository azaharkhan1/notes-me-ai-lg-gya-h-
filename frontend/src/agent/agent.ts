// AI Action Agent orchestrator.
// 1) Try the offline deterministic parser (works with NO internet).
// 2) If unresolved, ask the online LLM planner (/api/agent/plan) for a tool plan.
// 3) Execute steps sequentially through the controlled tool registry (real ops).
// Destructive steps are gated behind an explicit confirm.
import Constants from "expo-constants";
import { parseOffline } from "./parser";
import { TOOLS, executeStep, newExecVars } from "./tools";
import { AgentContext, AgentPlan, AgentRunResult, DESTRUCTIVE_TOOLS, PlanStep, StepResult } from "./types";

function backendUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_BACKEND_URL;
  const extra = (Constants.expoConfig as any)?.extra?.EXPO_PUBLIC_BACKEND_URL;
  return (fromEnv || extra || "").replace(/\/$/, "");
}

async function llmPlan(command: string, ctx: AgentContext): Promise<{ reply: string; steps: PlanStep[] } | null> {
  const base = backendUrl();
  if (!base) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(`${base}/api/agent/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command, context: ctx }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data?.steps)) return null;
    return { reply: String(data.reply || ""), steps: data.steps as PlanStep[] };
  } catch {
    return null;
  }
}

// Build an executable plan (does NOT run it yet).
export async function planCommand(command: string, ctx: AgentContext): Promise<AgentPlan> {
  const offline = parseOffline(command, ctx);
  if (offline && offline.length) {
    const valid = offline.filter((s) => TOOLS[s.tool]);
    return {
      reply: "Here's what I'll do:",
      steps: valid,
      source: "offline",
      needsConfirm: valid.some((s) => DESTRUCTIVE_TOOLS.has(s.tool)),
    };
  }
  const llm = await llmPlan(command, ctx);
  if (llm && llm.steps.length) {
    const valid = llm.steps.filter((s) => TOOLS[s.tool]);
    return {
      reply: llm.reply || "Here's my plan:",
      steps: valid,
      source: "llm",
      needsConfirm: valid.some((s) => DESTRUCTIVE_TOOLS.has(s.tool)),
    };
  }
  return {
    reply: llm?.reply ||
      "I couldn't turn that into an action. Try: \"Create a note called …\", \"Create a Tasks database with Name, Priority, Status, Due Date\", \"Summarize this note\", or \"Show high-priority tasks\".",
    steps: [],
    source: offline ? "offline" : "llm",
    needsConfirm: false,
  };
}

// Execute a (possibly already-confirmed) plan.
export async function executePlan(steps: PlanStep[], ctx: AgentContext): Promise<AgentRunResult> {
  const vars = newExecVars();
  const results: StepResult[] = [];
  for (const step of steps) {
    const r = await executeStep(step, ctx, vars);
    results.push(r);
    // Continue on failure (compound commands are resilient), but record it.
  }
  const ok = results.length > 0 && results.every((r) => r.ok);
  const done = results.filter((r) => r.ok).length;
  return {
    reply: results.length ? `Completed ${done}/${results.length} action(s).` : "Nothing to do.",
    results,
    ok,
  };
}
