import React from "react";
import { AccessibilityInfo } from "react-native";

export function useReduceMotionEnabled(): boolean {
  const [reduceMotionEnabled, setReduceMotionEnabled] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    let subscription: { remove: () => void } | undefined;

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value: boolean) => {
        if (mounted) {
          setReduceMotionEnabled(value);
        }
      })
      .catch(() => {
        // Keep the default `true` behavior (animations disabled) if the setting can't be read.
      });

    if (typeof AccessibilityInfo.addEventListener === "function") {
      subscription = AccessibilityInfo.addEventListener(
        "reduceMotionChanged",
        (value: boolean) => {
          if (!mounted) {
            return;
          }
          setReduceMotionEnabled(value);
        },
      );
    }

    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);

  return reduceMotionEnabled;
}
