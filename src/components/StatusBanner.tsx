import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { BRAND } from "../theme";

type StatusBannerProps = {
  busyLabel: string;
  errorText: string;
  statusMessage: string;
  onDismiss: () => void;
};

export function StatusBanner({
  busyLabel,
  errorText,
  statusMessage,
  onDismiss,
}: StatusBannerProps): React.ReactElement | null {
  if (busyLabel) {
    return (
      <View style={[styles.banner, styles.neutral]}>
        <ActivityIndicator color={BRAND.blue} />
        <Text style={styles.text}>{busyLabel}</Text>
      </View>
    );
  }

  if (errorText) {
    return (
      <View style={[styles.banner, styles.error]}>
        <Text style={styles.text}>{errorText}</Text>
        <Pressable onPress={onDismiss} style={styles.dismissButton}>
          <Text style={styles.dismissText}>Dismiss</Text>
        </Pressable>
      </View>
    );
  }

  if (statusMessage) {
    return (
      <View style={[styles.banner, styles.success]}>
        <Text style={styles.text}>{statusMessage}</Text>
        <Pressable onPress={onDismiss} style={styles.dismissButton}>
          <Text style={styles.dismissText}>Dismiss</Text>
        </Pressable>
      </View>
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
  dismissButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  dismissText: {
    color: BRAND.blue,
    fontWeight: "700",
  },
});
