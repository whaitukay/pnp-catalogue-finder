import React from "react";
import { AccessibilityInfo, ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

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
  const toastKeyRef = React.useRef<string | null>(null);
  const autoDismissTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const clearAutoDismissTimeout = React.useCallback(() => {
    if (!autoDismissTimeoutRef.current) {
      return;
    }

    clearTimeout(autoDismissTimeoutRef.current);
    autoDismissTimeoutRef.current = null;
  }, []);

  const handleDismiss = React.useCallback(() => {
    clearAutoDismissTimeout();
    onDismissRef.current();
  }, [clearAutoDismissTimeout]);

  const isError = Boolean(errorText);
  const toastText = errorText || statusMessage;

  React.useEffect(() => {
    if (busyLabel || !toastText) {
      return;
    }

    clearAutoDismissTimeout();

    const scheduledToastKey = `${isError ? "error" : "status"}:${toastText}`;
    toastKeyRef.current = scheduledToastKey;
    let cancelled = false;

    const scheduleAutoDismiss = async () => {
      const baseTimeout = isError ? ERROR_AUTO_DISMISS_MS : STATUS_AUTO_DISMISS_MS;
      let timeout = baseTimeout;

      try {
        if (typeof AccessibilityInfo.getRecommendedTimeoutMillis === "function") {
          const recommendedTimeout = await AccessibilityInfo.getRecommendedTimeoutMillis(baseTimeout);
          timeout = Math.max(timeout, recommendedTimeout);
        }
      } catch {
        // Ignore and fall back to the base timeout.
      }

      if (cancelled) {
        return;
      }

      if (toastKeyRef.current !== scheduledToastKey) {
        return;
      }

      const timeoutHandle = setTimeout(() => {
        if (toastKeyRef.current !== scheduledToastKey) {
          return;
        }

        if (autoDismissTimeoutRef.current === timeoutHandle) {
          autoDismissTimeoutRef.current = null;
        }

        handleDismiss();
      }, timeout);

      autoDismissTimeoutRef.current = timeoutHandle;
    };

    void scheduleAutoDismiss();

    return () => {
      cancelled = true;
      clearAutoDismissTimeout();
    };
  }, [busyLabel, clearAutoDismissTimeout, handleDismiss, isError, toastText]);

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
        onPress={handleDismiss}
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
