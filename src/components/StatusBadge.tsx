import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { BRAND } from "../theme";

type StatusBadgeProps = {
  label: string;
  variant: "primary" | "secondary" | "danger" | "success" | "warning";
};

export function StatusBadge({ label, variant }: StatusBadgeProps): React.ReactElement {
  return (
    <View
      style={[
        styles.badge,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "danger" && styles.danger,
        variant === "success" && styles.success,
        variant === "warning" && styles.warning,
      ]}
    >
      <Text
        style={[
          styles.text,
          variant === "primary" && styles.primaryText,
          variant === "danger" && styles.dangerText,
          variant === "success" && styles.successText,
          variant === "warning" && styles.warningText,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  primary: {
    backgroundColor: BRAND.blue,
  },
  secondary: {
    backgroundColor: BRAND.blueSoft,
  },
  danger: {
    backgroundColor: BRAND.danger,
  },
  success: {
    backgroundColor: BRAND.green,
  },
  warning: {
    backgroundColor: BRAND.amber,
  },
  text: {
    fontSize: 12,
    fontWeight: "800",
    color: BRAND.blue,
  },
  primaryText: {
    color: BRAND.white,
  },
  dangerText: {
    color: BRAND.redDark,
  },
  successText: {
    color: "#1d6b39",
  },
  warningText: {
    color: "#8b5d00",
  },
});
