import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type FeedbackContextValue = {
  statusMessage: string;
  errorText: string;
  busyLabel: string;
  setStatus: (message: string) => void;
  setError: (message: string) => void;
  setBusy: (label: string) => void;
  clearError: () => void;
  clearFeedback: () => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [statusMessage, setStatusMessage] = useState("");
  const [errorText, setErrorText] = useState("");
  const [busyLabel, setBusyLabel] = useState("");

  const setStatus = useCallback((message: string) => {
    setErrorText("");
    setStatusMessage(message);
  }, []);

  const setError = useCallback((message: string) => {
    setStatusMessage("");
    setErrorText(message);
  }, []);

  const setBusy = useCallback((label: string) => {
    setBusyLabel(label);
  }, []);

  const clearError = useCallback(() => {
    setErrorText("");
  }, []);

  const clearFeedback = useCallback(() => {
    setErrorText("");
    setStatusMessage("");
  }, []);

  const value = useMemo<FeedbackContextValue>(() => {
    return {
      statusMessage,
      errorText,
      busyLabel,
      setStatus,
      setError,
      setBusy,
      clearError,
      clearFeedback,
    };
  }, [
    busyLabel,
    clearError,
    clearFeedback,
    errorText,
    setBusy,
    setError,
    setStatus,
    statusMessage,
  ]);

  return <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>;
}

export function useFeedback(): FeedbackContextValue {
  const value = useContext(FeedbackContext);
  if (!value) {
    throw new Error("useFeedback must be used within FeedbackProvider");
  }
  return value;
}
