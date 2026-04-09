import React from "react";
import { ScrollView } from "react-native";

import { useReduceMotionEnabled } from "./useReduceMotionEnabled";

export function usePaginatedScroll(onPageChange: (nextPage: number) => void) {
  const scrollRef = React.useRef<React.ElementRef<typeof ScrollView> | null>(null);
  const reduceMotionEnabled = useReduceMotionEnabled();
  const reduceMotionRef = React.useRef(reduceMotionEnabled);

  React.useEffect(() => {
    reduceMotionRef.current = reduceMotionEnabled;
  }, [reduceMotionEnabled]);

  const scrollToTop = React.useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: !reduceMotionRef.current });
  }, []);

  const handlePageChange = React.useCallback(
    (nextPage: number) => {
      onPageChange(nextPage);
      scrollToTop();
    },
    [onPageChange, scrollToTop],
  );

  const resetToFirstPage = React.useCallback(() => {
    handlePageChange(0);
  }, [handlePageChange]);

  return {
    scrollRef,
    handlePageChange,
    resetToFirstPage,
    scrollToTop,
    reduceMotionEnabled,
  };
}
