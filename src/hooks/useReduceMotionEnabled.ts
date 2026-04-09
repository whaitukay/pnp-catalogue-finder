import React from "react";
import { AccessibilityInfo } from "react-native";

type AccessibilityInfoCompat = {
  isReduceMotionEnabled?: () => Promise<boolean>;
  addEventListener?: (
    event: string,
    handler: (value: boolean) => void,
  ) => { remove?: () => void } | void;
  removeEventListener?: (event: string, handler: (value: boolean) => void) => void;
};

export function useReduceMotionEnabled(): boolean {
  const [reduceMotionEnabled, setReduceMotionEnabled] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    let subscription: { remove: () => void } | undefined;
    let removeListener: (() => void) | undefined;

    const { isReduceMotionEnabled, addEventListener, removeEventListener } =
      AccessibilityInfo as AccessibilityInfoCompat;

    const handleReduceMotionChanged = (value: boolean) => {
      if (!mounted) {
        return;
      }
      setReduceMotionEnabled(value);
    };

    if (typeof isReduceMotionEnabled === "function") {
      void isReduceMotionEnabled()
        .then(handleReduceMotionChanged)
        .catch(() => {
          // Keep the default `true` behavior (animations disabled) if the setting can't be read.
        });
    }

    if (typeof addEventListener === "function") {
      const maybeSubscription = addEventListener(
        "reduceMotionChanged",
        handleReduceMotionChanged,
      );

      if (maybeSubscription && typeof maybeSubscription.remove === "function") {
        subscription = { remove: maybeSubscription.remove };
      } else if (typeof removeEventListener === "function") {
        removeListener = () => {
          removeEventListener("reduceMotionChanged", handleReduceMotionChanged);
        };
      }
    }

    return () => {
      mounted = false;
      subscription?.remove();
      removeListener?.();
    };
  }, []);

  return reduceMotionEnabled;
}
