import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BRAND } from "../theme";
import { clampPercent } from "../utils/progressUi";

type ProgressButtonProps = {
  label: string;
  progress: number | null;
  disabled: boolean;
  onPress: () => void;
  variant: "primary" | "secondary";
};

export function ProgressButton({
  label,
  progress,
  disabled,
  onPress,
  variant,
}: ProgressButtonProps): React.ReactElement {
  const progressPercent = clampPercent(progress);
  const isProgressVisible = progress != null;
  const backgroundStyle = variant === "primary" ? styles.primary : styles.secondary;
  const labelStyle = variant === "primary" ? styles.primaryText : styles.secondaryText;
  const gradientColors: [string, string] =
    variant === "primary" ? [BRAND.redDark, BRAND.red] : [BRAND.blueDark, BRAND.blue];

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.base, backgroundStyle, disabled && styles.disabled]}
    >
      <Text style={[styles.ghostLabel, labelStyle]}>{label}</Text>

      {isProgressVisible ? (
        <View
          pointerEvents="none"
          style={[styles.fillClip, { width: `${progressPercent}%` }]}
        >
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.fillGradient}
          />
        </View>
      ) : null}

      <View pointerEvents="none" style={styles.overlay}>
        <Text style={labelStyle}>
          {isProgressVisible ? `${Math.round(progressPercent)}%` : label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  primary: {
    backgroundColor: BRAND.red,
  },
  secondary: {
    backgroundColor: BRAND.blue,
  },
  disabled: {
    opacity: 0.65,
  },
  primaryText: {
    color: BRAND.white,
    fontWeight: "800",
  },
  secondaryText: {
    color: BRAND.white,
    fontWeight: "800",
  },
  ghostLabel: {
    opacity: 0,
  },
  fillClip: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
  },
  fillGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
});
