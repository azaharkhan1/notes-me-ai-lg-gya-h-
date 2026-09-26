import React from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardAvoidingView,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../context/AppContext";

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  testID?: string;
}

export function BottomSheet({ visible, onClose, title, children, testID }: SheetProps) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const maxSheetHeight = Math.min(620, Math.max(320, height * 0.82));
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: c.overlay }]}
        onPress={onClose}
        testID="sheet-backdrop"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        automaticOffset
        keyboardVerticalOffset={insets.bottom}
        style={styles.kav}
        pointerEvents="box-none"
      >
        <View
          testID={testID}
          style={[
            styles.sheet,
            {
              backgroundColor: c.surfaceSecondary,
              paddingBottom: Math.max(insets.bottom, 12),
              borderColor: c.border,
              maxHeight: maxSheetHeight,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: c.borderStrong }]} />
          {title ? (
            <Text style={[styles.title, { color: c.onSurface }]}>{title}</Text>
          ) : null}
          <KeyboardAwareScrollView
            mode="insets"
            bottomOffset={insets.bottom + 20}
            extraKeyboardSpace={8}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetContent}
          >
            {children}
          </KeyboardAwareScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface ConfirmProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
  onCancel,
}: ConfirmProps) {
  const c = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onCancel} testID="confirm-sheet">
      <Text style={[styles.confirmTitle, { color: c.onSurface }]}>{title}</Text>
      {message ? (
        <Text style={[styles.confirmMsg, { color: c.onSurfaceTertiary }]}>
          {message}
        </Text>
      ) : null}
      <View style={styles.confirmRow}>
        <Pressable
          testID="confirm-cancel-button"
          onPress={onCancel}
          style={[styles.confirmBtn, { backgroundColor: c.surfaceTertiary }]}
        >
          <Text style={[styles.confirmBtnText, { color: c.onSurface }]}>
            {cancelLabel}
          </Text>
        </Pressable>
        <Pressable
          testID="confirm-ok-button"
          onPress={onConfirm}
          style={[
            styles.confirmBtn,
            { backgroundColor: destructive ? c.error : c.brand },
          ]}
        >
          <Text style={[styles.confirmBtnText, { color: "#FFFFFF" }]}>
            {confirmLabel}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, zIndex: 0 },
  kav: { ...StyleSheet.absoluteFill, justifyContent: "flex-end", zIndex: 1 },
  sheet: {
    width: "100%",
    zIndex: 1,
    elevation: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sheetContent: { paddingBottom: 8, flexGrow: 1 },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  confirmTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8, marginTop: 4 },
  confirmMsg: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  confirmRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnText: { fontSize: 15, fontWeight: "700" },
});
