import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";

import { useTheme } from "../context/AppContext";
import { NoteListItem } from "../db/types";
import { noteColorHex } from "../theme/colors";
import { fileExists } from "../lib/files";
import { stripMarkdown } from "../lib/markdown";

interface NoteCardProps {
  note: NoteListItem;
  showPreview: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  selected?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function NoteCard({
  note,
  showPreview,
  onPress,
  onLongPress,
  selected,
}: NoteCardProps) {
  const c = useTheme();
  const scale = useSharedValue(1);
  const [imgOk, setImgOk] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    if (note.imagePath) {
      fileExists(note.imagePath).then((ok) => {
        if (mounted) setImgOk(ok);
      });
    } else {
      setImgOk(false);
    }
    return () => {
      mounted = false;
    };
  }, [note.imagePath]);

  const bg = noteColorHex(note.color, c);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const labels = (note.labelNames || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  const preview = stripMarkdown(note.content).replace(/\n+/g, " ").trim();

  return (
    <AnimatedPressable
      testID={`note-card-${note.id}`}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => (scale.value = withTiming(0.97, { duration: 120 }))}
      onPressOut={() => (scale.value = withTiming(1, { duration: 120 }))}
      style={[
        styles.card,
        animStyle,
        {
          backgroundColor: bg,
          borderColor: selected ? c.brand : c.border,
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      {imgOk && note.imagePath ? (
        <Image
          source={{ uri: note.imagePath }}
          style={styles.image}
          contentFit="cover"
          transition={150}
        />
      ) : null}

      <View style={styles.body}>
        {note.title.trim() ? (
          <Text
            style={[styles.title, { color: c.onSurface }]}
            numberOfLines={2}
          >
            {note.title.trim()}
          </Text>
        ) : null}

        {showPreview && note.type !== "checklist" && preview ? (
          <Text
            style={[styles.preview, { color: c.onSurfaceTertiary }]}
            numberOfLines={6}
          >
            {preview}
          </Text>
        ) : null}

        {note.type === "checklist" && note.checklistTotal > 0 ? (
          <View style={styles.progressRow}>
            <MaterialCommunityIcons
              name="check-circle-outline"
              size={14}
              color={c.brand}
            />
            <Text style={[styles.progressText, { color: c.onSurfaceTertiary }]}>
              {note.checklistDone} / {note.checklistTotal} completed
            </Text>
          </View>
        ) : null}

        {labels.length > 0 ? (
          <View style={styles.labelRow}>
            {labels.map((l) => (
              <View
                key={l}
                style={[styles.labelChip, { backgroundColor: c.surfaceTertiary }]}
              >
                <Text style={[styles.labelText, { color: c.onSurfaceTertiary }]}>
                  #{l}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text style={[styles.date, { color: c.muted }]}>
            {dayjs(note.updatedAt).format("MMM D")}
          </Text>
          <View style={styles.icons}>
            {note.attachmentCount > 0 ? (
              <MaterialCommunityIcons
                name={
                  note.type === "voice" || note.imagePath == null
                    ? "paperclip"
                    : "paperclip"
                }
                size={13}
                color={c.muted}
              />
            ) : null}
            {note.type === "voice" ? (
              <MaterialCommunityIcons name="microphone" size={13} color={c.muted} />
            ) : null}
            {note.type === "drawing" ? (
              <MaterialCommunityIcons name="draw" size={13} color={c.muted} />
            ) : null}
            {note.isFavorite ? (
              <MaterialCommunityIcons name="heart" size={13} color={c.error} />
            ) : null}
            {note.isPinned ? (
              <MaterialCommunityIcons name="pin" size={13} color={c.brand} />
            ) : null}
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 12,
  },
  image: { width: "100%", height: 130 },
  body: { padding: 12 },
  title: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  preview: { fontSize: 13, lineHeight: 18, marginBottom: 6 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2, marginBottom: 6 },
  progressText: { fontSize: 12, fontWeight: "600" },
  labelRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 6 },
  labelChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  labelText: { fontSize: 10, fontWeight: "600" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  date: { fontSize: 11, fontWeight: "500" },
  icons: { flexDirection: "row", alignItems: "center", gap: 6 },
});
