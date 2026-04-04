import React from "react";

import { CataloguesProvider } from "./useCataloguesContext";
import { FeedbackProvider } from "./useFeedbackContext";
import { ImportsProvider } from "./useImportsContext";
import { SettingsProvider } from "./useSettingsContext";

export function AppProviders({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <SettingsProvider>
      <FeedbackProvider>
        <CataloguesProvider>
          <ImportsProvider>{children}</ImportsProvider>
        </CataloguesProvider>
      </FeedbackProvider>
    </SettingsProvider>
  );
}
