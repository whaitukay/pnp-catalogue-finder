import React from "react";
import { ScrollView } from "react-native";

import { useReduceMotionEnabled } from "./useReduceMotionEnabled";

export function usePaginatedScroll(onPageChange: (nextPage: number) => void): {
  scrollRef: React.RefObject<React.ElementRef<typeof ScrollView>>;
  handlePageChange: (nextPage: number) => void;
  reduceMotionEnabled: boolean;
} {
  const scrollRef = React.useRef<React.ElementRef<typeof ScrollView>>(null);
  const reduceMotionEnabled = useReduceMotionEnabled();

  const handlePageChange = React.useCallback(
    (nextPage: number) => {
      onPageChange(nextPage);
      scrollRef.current?.scrollTo({ y: 0, animated: !reduceMotionEnabled });
    },
    [onPageChange, reduceMotionEnabled],
  );

  return {
    scrollRef,
    handlePageChange,
    reduceMotionEnabled,
  };
}
