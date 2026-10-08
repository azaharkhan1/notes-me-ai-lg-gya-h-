// Shared types for the unified AI Action Agent.
export interface AgentContext {
  noteId?: string | null;
  noteTitle?: string | null;
  noteContent?: string | null;
  pageId?: string | null;
  pageTitle?: string | null;
  databaseId?: string | null;
  databaseTitle?: string | null;
  screen?: string;
}

export interface PlanStep {
  tool: string;
  args: Record<string, any>;
  description?: string;
}

export interface StepResult {
  tool: string;
  description: string;
  ok: boolean;
  message: string;
}

export interface AgentPlan {
  reply: string;
  steps: PlanStep[];
  source: "offline" | "llm";
  needsConfirm: boolean;
}

export interface AgentRunResult {
  reply: string;
  results: StepResult[];
  ok: boolean;
}

// Tools that mutate/delete user data irreversibly -> require confirmation.
export const DESTRUCTIVE_TOOLS = new Set(["mergeNotes", "trashNote", "deleteNote"]);
