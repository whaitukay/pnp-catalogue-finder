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
    let cleanupListener: (() => void) | undefined;

    const accessibilityInfo = AccessibilityInfo as AccessibilityInfoCompat;
    const reduceMotionChangedEvent = "reduceMotionChanged" as const;

    const handleReduceMotionChanged = (value: boolean) => {
      if (!mounted) {
        return;
      }
      setReduceMotionEnabled(value);
    };

    if (typeof accessibilityInfo.isReduceMotionEnabled === "function") {
      void accessibilityInfo
        .isReduceMotionEnabled()
        .then(handleReduceMotionChanged)
        .catch(() => {
          // Keep the default `true` behavior (animations disabled) if the setting can't be read.
        });
    }

    if (typeof accessibilityInfo.addEventListener === "function") {
      const maybeSubscription = accessibilityInfo.addEventListener(
        reduceMotionChangedEvent,
        handleReduceMotionChanged,
      );

      if (maybeSubscription && typeof maybeSubscription.remove === "function") {
        const subscription = maybeSubscription as { remove: () => void };
        cleanupListener = () => {
          subscription.remove();
        };
      } else {
        const removeEventListener = accessibilityInfo.removeEventListener;

        if (typeof removeEventListener === "function") {
          cleanupListener = () => {
            removeEventListener.call(
              accessibilityInfo,
              reduceMotionChangedEvent,
              handleReduceMotionChanged,
            );
          };
        }
      }
    }

    return () => {
      mounted = false;
      cleanupListener?.();
    };
  }, []);

  return reduceMotionEnabled;
}
