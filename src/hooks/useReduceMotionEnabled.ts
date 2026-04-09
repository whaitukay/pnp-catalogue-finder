import React from "react";
import { AccessibilityInfo } from "react-native";

export function useReduceMotionEnabled(): boolean {
  const [reduceMotionEnabled, setReduceMotionEnabled] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    let subscription: { remove: () => void } | undefined;

    void AccessibilityInfo.isReduceMotionEnabled().then((value: boolean) => {
      if (mounted) {
        setReduceMotionEnabled(value);
      }
    });

    if (typeof AccessibilityInfo.addEventListener === "function") {
      subscription = AccessibilityInfo.addEventListener(
        "reduceMotionChanged",
        (value: boolean) => {
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
