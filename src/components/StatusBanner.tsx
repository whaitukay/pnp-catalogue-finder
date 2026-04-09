import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { BRAND } from "../theme";

type StatusBannerProps = {
  busyLabel: string;
  errorText: string;
  statusMessage: string;
  onDismiss: () => void;
};

const STATUS_AUTO_DISMISS_MS = 4000;
const ERROR_AUTO_DISMISS_MS = 8000;

export function StatusBanner({
  busyLabel,
  errorText,
  statusMessage,
  onDismiss,
}: StatusBannerProps): React.ReactElement | null {
  const onDismissRef = React.useRef(onDismiss);

  onDismissRef.current = onDismiss;

  const isError = Boolean(errorText);
  const toastText = errorText || statusMessage;

  React.useEffect(() => {
    if (busyLabel || !toastText) {
      return;
    }

    const timeout = setTimeout(
      () => {
        onDismissRef.current();
      },
      isError ? ERROR_AUTO_DISMISS_MS : STATUS_AUTO_DISMISS_MS,
    );

    return () => {
      clearTimeout(timeout);
    };
  }, [busyLabel, isError, toastText]);

  if (busyLabel) {
    return (
      <View style={[styles.banner, styles.neutral]}>
        <ActivityIndicator color={BRAND.blue} />
        <Text style={styles.text}>{busyLabel}</Text>
      </View>
    );
  }

  if (toastText) {
    const accessibilityLabel = isError ? `Error: ${toastText}` : toastText;
    return (
      <Pressable
        onPress={onDismiss}
        style={[styles.banner, isError ? styles.error : styles.success]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Dismisses this message"
        accessibilityLiveRegion={isError ? "assertive" : "polite"}
      >
        <Text style={styles.text}>{toastText}</Text>
      </Pressable>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  neutral: {
    backgroundColor: BRAND.amber,
  },
  success: {
    backgroundColor: BRAND.green,
  },
  error: {
    backgroundColor: BRAND.danger,
  },
  text: {
    flex: 1,
    color: BRAND.ink,
    lineHeight: 20,
  },
});
