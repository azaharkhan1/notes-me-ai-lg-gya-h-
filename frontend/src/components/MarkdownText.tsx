import React from "react";
import { StyleSheet, Text, View, Platform } from "react-native";

import { useTheme } from "../context/AppContext";
import { Block, InlineStyle, parseMarkdown, Span } from "../lib/markdown";

interface MarkdownTextProps {
  content: string;
  baseColor?: string;
  baseFontSize?: number;
}

const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

function spanStyle(
  s: InlineStyle,
  baseColor: string,
  brand: string,
  highlightBg: string,
  codeBg: string,
) {
  const style: any = {};
  if (s.bold) style.fontWeight = "700";
  if (s.italic) style.fontStyle = "italic";
  const deco: string[] = [];
  if (s.underline) deco.push("underline");
  if (s.strike) deco.push("line-through");
  if (deco.length) style.textDecorationLine = deco.join(" ");
  if (s.highlight) {
    style.backgroundColor = highlightBg;
    style.color = "#3A2417";
  } else {
    style.color = baseColor;
  }
  if (s.code) {
    style.fontFamily = MONO;
    style.backgroundColor = codeBg;
    style.color = brand;
    style.fontSize = 13;
  }
  return style;
}

function renderSpans(
  spans: Span[],
  baseColor: string,
  brand: string,
  highlightBg: string,
  codeBg: string,
) {
  return spans.map((sp, i) => (
    <Text key={i} style={spanStyle(sp.style, baseColor, brand, highlightBg, codeBg)}>
      {sp.text}
    </Text>
  ));
}

/**
 * Renders markdown source as styled rich text. Read-only: the source string is
 * never mutated. Safe on malformed input (unmatched markers render literally).
 */
export function MarkdownText({ content, baseColor, baseFontSize = 16 }: MarkdownTextProps) {
  const c = useTheme();
  const color = baseColor ?? c.onSurface;
  const highlightBg = c.mode === "dark" ? "#5C4A12" : "#FFE9A8";
  const codeBg = c.surfaceTertiary;

  let blocks: Block[] = [];
  try {
    blocks = parseMarkdown(content);
  } catch {
    return <Text style={{ color, fontSize: baseFontSize }}>{content}</Text>;
  }

  const headingSize = (lvl?: number) =>
    lvl === 1 ? baseFontSize + 12 : lvl === 2 ? baseFontSize + 7 : baseFontSize + 3;

  return (
    <View>
      {blocks.map((b, idx) => {
        if (b.type === "blank") {
          return <View key={idx} style={{ height: baseFontSize * 0.6 }} />;
        }
        if (b.type === "heading") {
          return (
            <Text
              key={idx}
              style={[
                styles.heading,
                { fontSize: headingSize(b.level), color, lineHeight: headingSize(b.level) * 1.3 },
              ]}
            >
              {renderSpans(b.spans, color, c.brand, highlightBg, codeBg)}
            </Text>
          );
        }
        if (b.type === "quote") {
          return (
            <View key={idx} style={[styles.quote, { borderLeftColor: c.brand }]}>
              <Text style={{ fontSize: baseFontSize, color: c.onSurfaceTertiary, fontStyle: "italic", lineHeight: baseFontSize * 1.5 }}>
                {renderSpans(b.spans, c.onSurfaceTertiary, c.brand, highlightBg, codeBg)}
              </Text>
            </View>
          );
        }
        if (b.type === "bullet" || b.type === "ordered") {
          const marker = b.type === "bullet" ? "•" : `${b.ordinal ?? 1}.`;
          return (
            <View
              key={idx}
              style={[styles.listRow, { marginLeft: 4 + (b.indent ?? 0) * 18 }]}
            >
              <Text style={[styles.marker, { color: c.brand, fontSize: baseFontSize, lineHeight: baseFontSize * 1.5 }]}>
                {marker}
              </Text>
              <Text style={{ flex: 1, fontSize: baseFontSize, color, lineHeight: baseFontSize * 1.5 }}>
                {renderSpans(b.spans, color, c.brand, highlightBg, codeBg)}
              </Text>
            </View>
          );
        }
        // paragraph
        return (
          <Text key={idx} style={{ fontSize: baseFontSize, color, lineHeight: baseFontSize * 1.5 }}>
            {renderSpans(b.spans, color, c.brand, highlightBg, codeBg)}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontWeight: "800", marginTop: 8, marginBottom: 2 },
  quote: { borderLeftWidth: 3, paddingLeft: 10, marginVertical: 4 },
  listRow: { flexDirection: "row", alignItems: "flex-start", marginVertical: 1 },
  marker: { width: 22, fontWeight: "700" },
});
