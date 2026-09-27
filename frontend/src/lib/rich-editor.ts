// Editor-facing rich-text model.
//
// DESIGN CONTRACT
// - The persisted note content remains the legacy Markdown-compatible source.
//   This preserves backups/exports/searches and every existing note untouched.
// - The visible editor operates on a plain-text buffer (no markup characters).
//   Formatting actions apply to the visible buffer and rebuild Markdown from a
//   span map. Parsing or mapping failures never mutate the note.
// - If anything fails, callers fall back to the plain text from the same
//   source, so a malformed note still opens and can be edited safely.

import { parseMarkdown, Block } from "./markdown";

export type RichFormatKey = "bold" | "italic" | "underline" | "strike" | "highlight";
export type BlockFormatKey = "heading" | "bullet" | "ordered" | "quote";

export interface RichSpan {
  start: number;
  end: number;
  style: Partial<Record<RichFormatKey, boolean>>;
}

export interface EditorState {
  text: string;
  spans: RichSpan[];
  error?: string;
}

export interface EditorSelection {
  start: number;
  end: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function normalizeSelection(selection: EditorSelection, max: number): EditorSelection {
  const start = clamp(Math.min(selection.start, selection.end), 0, max);
  const end = clamp(Math.max(selection.start, selection.end), 0, max);
  return { start, end };
}

function mergeStyle(target: RichSpan["style"], source: RichSpan["style"]): RichSpan["style"] {
  return {
    bold: !!(target.bold || source.bold),
    italic: !!(target.italic || source.italic),
    underline: !!(target.underline || source.underline),
    strike: !!(target.strike || source.strike),
    highlight: !!(target.highlight || source.highlight),
  };
}

/** Convert parsed Markdown blocks into visible plain text + plain-offset spans. */
export function richFromMarkdown(source: string): EditorState {
  try {
    const blocks = parseMarkdown(source ?? "");
    let offset = 0;
    const lines: string[] = [];
    const spans: RichSpan[] = [];

    blocks.forEach((block: Block, index: number) => {
      const text = block.spans.map((span) => span.text).join("");
      const start = offset;
      block.spans.forEach((span) => {
        const spanStart = start;
        const spanEnd = spanStart + span.text.length;
        spans.push({
          start: spanStart,
          end: spanEnd,
          style: {
            bold: span.style.bold,
            italic: span.style.italic,
            underline: span.style.underline,
            strike: span.style.strike,
            highlight: span.style.highlight,
          },
        });
        offset = spanEnd;
      });
      lines.push(text);
      if (index < blocks.length - 1) offset += 1;
    });

    return { text: lines.join("\n"), spans };
  } catch (error) {
    return {
      text: String(source ?? ""),
      spans: [],
      error: error instanceof Error ? error.message : "Formatting parse failed",
    };
  }
}

/** Map a plain-text buffer to a Markdown-compatible persisted source. */
export function markdownFromEditorState(state: EditorState): string {
  try {
    const text = state.text ?? "";
    return splitPlainLines(text)
      .map((line, lineIndex) => {
        const lineStart = lineOffset(text, lineIndex);
        const lineEnd = lineStart + line.length;
        return renderLine(line, state.spans, lineStart, lineEnd);
      })
      .join("\n");
  } catch {
    return state.text ?? "";
  }
}

function splitPlainLines(text: string): string[] {
  return String(text ?? "").replace(/\r\n/g, "\n").split("\n");
}

function lineOffset(text: string, index: number): number {
  if (index <= 0) return 0;
  let offset = 0;
  for (let i = 0; i < index; i++) {
    const next = text.indexOf("\n", offset);
    if (next < 0) return text.length;
    offset = next + 1;
  }
  return offset;
}

function spansForRange(spans: RichSpan[], start: number, end: number): RichSpan[] {
  return spans
    .map((span) => {
      const overlapStart = Math.max(span.start, start);
      const overlapEnd = Math.min(span.end, end);
      if (overlapEnd <= overlapStart) return null;
      return { start: overlapStart - start, end: overlapEnd - start, style: span.style };
    })
    .filter(Boolean) as RichSpan[];
}

function renderLine(line: string, spans: RichSpan[], absoluteStart: number, absoluteEnd: number): string {
  if (!line) return "";
  const lineSpans = spansForRange(spans, absoluteStart, absoluteEnd);
  if (!lineSpans.length) return line;

  const boundaries = new Set<number>([0, line.length]);
  lineSpans.forEach((span) => {
    boundaries.add(span.start);
    boundaries.add(span.end);
  });
  const points = [...boundaries].sort((a, b) => a - b);
  let out = "";
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (end <= start) continue;
    const segment = line.slice(start, end);
    const style = lineSpans
      .filter((span) => span.start <= start && span.end >= end)
      .reduce((acc, span) => mergeStyle(acc, span.style), {});
    let chunk = segment;
    // Order chosen so unwrapping and Markdown nesting are deterministic.
    if (style.underline) chunk = `<u>${chunk}</u>`;
    if (style.highlight) chunk = `==${chunk}==`;
    if (style.strike) chunk = `~~${chunk}~~`;
    if (style.italic) chunk = `*${chunk}*`;
    if (style.bold) chunk = `**${chunk}**`;
    out += chunk;
  }
  return out;
}

function mapOffset(plainOffset: number, before: string, after: string): number {
  const text = before ?? "";
  if (plainOffset <= 0 || !after) return 0;
  if (plainOffset >= text.length) return after.length;
  const anchor = text.slice(0, plainOffset);
  const lower = anchor.toLowerCase();
  const target = after.toLowerCase();

  if (plainOffset === 0) return 0;
  if (target.startsWith(lower)) return plainOffset;

  // Character-prefix match is enough for structural marker insertion/removal.
  let common = 0;
  const limit = Math.min(anchor.length, after.length);
  while (common < limit && anchor[common] === after[common]) common++;
  return clamp(common, 0, after.length);
}

/** Rebuild span offsets after an arbitrary plain-text edit. */
export function remapRichState(previous: EditorState, nextText: string, nextSelection: EditorSelection): EditorState {
  try {
    const spans = previous.spans.map((span) => ({
      start: mapOffset(span.start, previous.text, nextText),
      end: mapOffset(span.end, previous.text, nextText),
      style: span.style,
    })).filter((span) => span.end > span.start);
    const sel = normalizeSelection(nextSelection, nextText.length);
    return { text: nextText, spans, error: previous.error };
  } catch (error) {
    return {
      text: nextText,
      spans: [],
      error: error instanceof Error ? error.message : "Formatting state failed",
    };
  }
}

export function toggleInlineStyle(state: EditorState, selection: EditorSelection, key: RichFormatKey): EditorState {
  try {
    const sel = normalizeSelection(selection, state.text.length);
    if (sel.end === sel.start) return { ...state, spans: [...state.spans] };
    const selected = spansForRange(state.spans, sel.start, sel.end).some((span) => span.style[key]);
    const nextSpan: RichSpan = { start: sel.start, end: sel.end, style: { [key]: !selected } };
    return { text: state.text, spans: [...state.spans, nextSpan] };
  } catch (error) {
    return { ...state, error: error instanceof Error ? error.message : "Formatting failed" };
  }
}

function stripStructuralMarker(line: string): string {
  return line
    .replace(/^\s{0,3}#{1,3}\s+/, "")
    .replace(/^\s*>\s?/, "")
    .replace(/^(\s*)\d+\.\s+/, "$1")
    .replace(/^(\s*)[-*+]\s+/, "$1");
}

export function toggleBlockStyle(state: EditorState, selection: EditorSelection, key: BlockFormatKey): EditorState {
  try {
    const lines = splitPlainLines(state.text);
    const sel = normalizeSelection(selection, state.text.length);
    const startLine = state.text.slice(0, sel.start).split("\n").length - 1;
    const endLine = state.text.slice(0, sel.end).split("\n").length - 1;
    const active = lines.slice(startLine, endLine + 1).some((line) => {
      if (key === "heading") return /^\s{0,3}#{1,3}\s+/.test(line);
      if (key === "quote") return /^\s*>\s?/.test(line);
      if (key === "ordered") return /^\s*\d+\.\s+/.test(line);
      return /^(\s*)[-*+]\s+/.test(line);
    });
    const nextLines = lines.map((line, index) => {
      if (index < startLine || index > endLine) return line;
      const clean = stripStructuralMarker(line);
      if (active) return clean;
      if (key === "heading") return `# ${clean}`;
      if (key === "quote") return `> ${clean}`;
      if (key === "ordered") return `1. ${clean}`;
      return `- ${clean}`;
    });
    return { ...state, text: nextLines.join("\n") };
  } catch (error) {
    return { ...state, error: error instanceof Error ? error.message : "Formatting failed" };
  }
}

/** Readable text for preview cards/search; never throws and drops structure markers. */
export function plainTextFromMarkdown(source: string): string {
  try {
    return richFromMarkdown(source).text;
  } catch {
    return String(source ?? "");
  }
}

/** True if markup-like structural/inline characters are visibly meaningful. */
export function containsVisibleMarkup(source: string): boolean {
  return /(^\s*#{1,3}\s)|(^\s*[-*+]\s)|(^\s*\d+\.\s)|(^\s*>\s?)|(\*\*|__|~~|==|<\/?u>)/m.test(source ?? "");
}
