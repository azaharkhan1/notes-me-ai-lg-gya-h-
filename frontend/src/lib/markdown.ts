// Lightweight, dependency-free Markdown parser for the Notes editor.
//
// Design goals:
//  - Parse content into structured block + inline span nodes (NOT string
//    replacement) so it can be rendered as real styled text.
//  - The ORIGINAL markdown source is always preserved; parsing is read-only.
//  - Handles nested / mixed inline formatting and degrades gracefully on
//    malformed input (unmatched delimiters render as literal text).
//
// Supported inline: **bold**, *italic* / _italic_, __underline__ / <u>u</u>,
//   ~~strike~~, ==highlight==, `code`.
// Supported blocks: # / ## / ### headings, - / * / + bullets, 1. ordered
//   lists (with indentation), > quotes, paragraphs, blank spacers.

export interface InlineStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  highlight?: boolean;
  code?: boolean;
}

export interface Span {
  text: string;
  style: InlineStyle;
}

export type BlockType =
  | "heading"
  | "bullet"
  | "ordered"
  | "quote"
  | "paragraph"
  | "blank";

export interface Block {
  type: BlockType;
  level?: number; // heading level 1-3
  indent?: number; // list nesting depth
  ordinal?: number; // ordered-list number
  spans: Span[];
}

interface Delim {
  open: string;
  close: string;
  key: keyof InlineStyle;
  nested: boolean;
}

// Order matters: multi-char delimiters must be tried before single-char ones.
const DELIMS: Delim[] = [
  { open: "**", close: "**", key: "bold", nested: true },
  { open: "__", close: "__", key: "underline", nested: true },
  { open: "~~", close: "~~", key: "strike", nested: true },
  { open: "==", close: "==", key: "highlight", nested: true },
  { open: "<u>", close: "</u>", key: "underline", nested: true },
  { open: "`", close: "`", key: "code", nested: false },
  { open: "*", close: "*", key: "italic", nested: true },
  { open: "_", close: "_", key: "italic", nested: true },
];

/** Parse a single line of text into styled inline spans. */
export function parseInline(text: string, base: InlineStyle = {}): Span[] {
  if (!text) return [];

  let best: { index: number; close: number; d: Delim } | null = null;
  for (const d of DELIMS) {
    const i = text.indexOf(d.open);
    if (i === -1) continue;
    const closeStart = i + d.open.length;
    let j = text.indexOf(d.close, closeStart);
    if (j === -1 || j === closeStart) continue; // no close or empty content
    // Triple-run handling for * / _ : in a sequence like `**bold *italic***`
    // the trailing `***` is [italic-close][bold-close]. A naive indexOf would
    // grab the first two stars and swallow the italic closer. Shift the outer
    // close one char right so the nested single-char emphasis keeps its marker.
    const ch = d.open[0];
    if (
      d.open.length === 2 &&
      (ch === "*" || ch === "_") &&
      text[j + 2] === ch &&
      text[j - 1] !== ch
    ) {
      j = j + 1;
    }
    if (best === null || i < best.index) best = { index: i, close: j, d };
  }

  if (!best) return [{ text, style: base }];

  const spans: Span[] = [];
  if (best.index > 0) {
    spans.push({ text: text.slice(0, best.index), style: base });
  }
  const innerStart = best.index + best.d.open.length;
  const inner = text.slice(innerStart, best.close);
  const nextStyle: InlineStyle = { ...base, [best.d.key]: true };
  if (best.d.nested) {
    spans.push(...parseInline(inner, nextStyle));
  } else {
    spans.push({ text: inner, style: nextStyle });
  }
  const rest = text.slice(best.close + best.d.close.length);
  spans.push(...parseInline(rest, base));
  return spans;
}

/** Parse full markdown source into an array of block nodes. */
export function parseMarkdown(source: string): Block[] {
  const src = (source ?? "").replace(/\r\n/g, "\n");
  const lines = src.split("\n");
  const blocks: Block[] = [];

  for (const raw of lines) {
    if (raw.trim() === "") {
      blocks.push({ type: "blank", spans: [] });
      continue;
    }

    const heading = raw.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        spans: parseInline(heading[2]),
      });
      continue;
    }

    const quote = raw.match(/^\s*>\s?(.*)$/);
    if (quote) {
      blocks.push({ type: "quote", spans: parseInline(quote[1]) });
      continue;
    }

    const ordered = raw.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (ordered) {
      blocks.push({
        type: "ordered",
        indent: Math.floor(ordered[1].replace(/\t/g, "  ").length / 2),
        ordinal: parseInt(ordered[2], 10),
        spans: parseInline(ordered[3]),
      });
      continue;
    }

    const bullet = raw.match(/^(\s*)[-*+]\s+(.*)$/);
    if (bullet) {
      blocks.push({
        type: "bullet",
        indent: Math.floor(bullet[1].replace(/\t/g, "  ").length / 2),
        spans: parseInline(bullet[2]),
      });
      continue;
    }

    blocks.push({ type: "paragraph", spans: parseInline(raw) });
  }

  return blocks;
}

/**
 * Strip markdown to plain text (for list previews, search indexing, etc.).
 * Never throws; returns a single-line-friendly string.
 */
export function stripMarkdown(source: string): string {
  if (!source) return "";
  let out = source.replace(/\r\n/g, "\n");
  // remove leading block markers
  out = out.replace(/^\s{0,3}(#{1,3})\s+/gm, "");
  out = out.replace(/^\s*>\s?/gm, "");
  out = out.replace(/^(\s*)(\d+)\.\s+/gm, "");
  out = out.replace(/^(\s*)[-*+]\s+/gm, "");
  // inline markers
  out = out.replace(/<\/?u>/g, "");
  // paired markers — iterate so NESTED spans (e.g. **bold ~~strike~~**) fully collapse
  for (let i = 0; i < 4; i++) {
    out = out.replace(/(\*\*|__|~~|==)([\s\S]*?)\1/g, "$2");
  }
  out = out.replace(/`([^`]+)`/g, "$1");
  for (let i = 0; i < 4; i++) {
    out = out.replace(/(\*|_)([\s\S]*?)\1/g, "$2");
  }
  // strip any leftover unmatched double-char markers so previews stay clean
  out = out.replace(/\*\*|__|~~|==/g, "");
  return out;
}
