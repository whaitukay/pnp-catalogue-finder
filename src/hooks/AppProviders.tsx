import React from "react";

import { CataloguesProvider } from "./useCataloguesContext";
import { FeedbackProvider } from "./useFeedbackContext";
import { SettingsProvider } from "./useSettingsContext";

export function AppProviders({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <SettingsProvider>
      <FeedbackProvider>
        <CataloguesProvider>{children}</CataloguesProvider>
      </FeedbackProvider>
    </SettingsProvider>
  );
}
