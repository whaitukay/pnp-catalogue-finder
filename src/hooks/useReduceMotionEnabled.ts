import React from "react";
import { AccessibilityInfo } from "react-native";

export function useReduceMotionEnabled(): boolean {
  const [reduceMotionEnabled, setReduceMotionEnabled] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    let subscription: { remove: () => void } | undefined;
    let removeListener: (() => void) | undefined;

    const handleReduceMotionChanged = (value: boolean) => {
      if (!mounted) {
        return;
      }
      setReduceMotionEnabled(value);
    };

    const isReduceMotionEnabled = (AccessibilityInfo as { isReduceMotionEnabled?: unknown })
      .isReduceMotionEnabled;

    if (typeof isReduceMotionEnabled === "function") {
      void (isReduceMotionEnabled as () => Promise<boolean>)()
        .then(handleReduceMotionChanged)
        .catch(() => {
          // Keep the default `true` behavior (animations disabled) if the setting can't be read.
        });
    }

    const addEventListener = (AccessibilityInfo as { addEventListener?: unknown }).addEventListener;
    const removeEventListener = (AccessibilityInfo as { removeEventListener?: unknown })
      .removeEventListener;

    if (typeof addEventListener === "function") {
      const maybeSubscription = (addEventListener as (event: string, handler: (value: boolean) => void) => unknown)(
        "reduceMotionChanged",
        handleReduceMotionChanged,
      );

      if (
        maybeSubscription &&
        typeof (maybeSubscription as { remove?: unknown }).remove === "function"
      ) {
        subscription = maybeSubscription as { remove: () => void };
      } else if (typeof removeEventListener === "function") {
        removeListener = () => {
          (removeEventListener as (event: string, handler: (value: boolean) => void) => void)(
            "reduceMotionChanged",
            handleReduceMotionChanged,
          );
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
