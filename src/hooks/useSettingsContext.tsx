import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";

import {
  DEFAULT_SETTINGS,
  ensureStorage,
  loadSettings,
  invalidateAllCsvExports,
  saveSettings,
} from "../services/catalogueStore";
import type { AppSettings, ExportFieldKey } from "../types";
import {
  arraysEqual,
  normalizeExportFields,
  normalizeStoreCode,
} from "../utils/catalogueUi";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error ?? "Unknown error");
}

type SaveSettingsOutcome = {
  settings: AppSettings;
  fieldsChanged: boolean;
  invalidatedCount: number;
};

type SettingsContextValue = {
  storeCode: string;
  hideExpiredCatalogues: boolean;
  exportFields: ExportFieldKey[];
  savedSettings: AppSettings;
  normalizedStoreCode: string;
  settingsDirty: boolean;
  settingsLoading: boolean;
  settingsLoadError: string | null;
  settingsSaveToken: number;
  onStoreCodeChange: (value: string) => void;
  onHideExpiredChange: (value: boolean) => void;
  onToggleExportField: (field: ExportFieldKey) => void;
  persistSettings: (overrides?: Partial<AppSettings>) => Promise<AppSettings>;
  saveAppSettings: () => Promise<SaveSettingsOutcome>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [storeCode, setStoreCode] = useState(DEFAULT_SETTINGS.storeCode);
  const [hideExpiredCatalogues, setHideExpiredCatalogues] = useState(
    DEFAULT_SETTINGS.hideExpiredCatalogues,
  );
  const [exportFields, setExportFields] = useState<ExportFieldKey[]>(
    DEFAULT_SETTINGS.exportFields,
  );
  const [savedSettings, setSavedSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsLoadError, setSettingsLoadError] = useState<string | null>(null);
  const [settingsSaveToken, setSettingsSaveToken] = useState(0);

  const normalizedStoreCode = useMemo(() => normalizeStoreCode(storeCode), [storeCode]);

  const settingsDirty = useMemo(() => {
    return (
      normalizedStoreCode !== savedSettings.storeCode ||
      hideExpiredCatalogues !== savedSettings.hideExpiredCatalogues ||
      !arraysEqual(normalizeExportFields(exportFields), savedSettings.exportFields)
    );
  }, [exportFields, hideExpiredCatalogues, normalizedStoreCode, savedSettings]);

  useEffect(() => {
    let mounted = true;

    const load = async (): Promise<void> => {
      try {
        await ensureStorage();
        const settings = await loadSettings();
        if (!mounted) {
          return;
        }
        setStoreCode(settings.storeCode);
        setHideExpiredCatalogues(settings.hideExpiredCatalogues);
        setExportFields(settings.exportFields);
        setSavedSettings(settings);
      } catch (error) {
        if (mounted) {
          setSettingsLoadError(errorMessage(error));
        }
      } finally {
        if (mounted) {
          setSettingsLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const persistSettings = useCallback(
    async (overrides?: Partial<AppSettings>): Promise<AppSettings> => {
      const nextSettings: AppSettings = {
        storeCode: normalizeStoreCode(overrides?.storeCode ?? storeCode),
        hideExpiredCatalogues:
          overrides?.hideExpiredCatalogues ?? hideExpiredCatalogues,
        exportFields: normalizeExportFields(overrides?.exportFields ?? exportFields),
      };

      await saveSettings(nextSettings);
      setStoreCode(nextSettings.storeCode);
      setHideExpiredCatalogues(nextSettings.hideExpiredCatalogues);
      setExportFields(nextSettings.exportFields);
      setSavedSettings(nextSettings);
      return nextSettings;
    },
    [exportFields, hideExpiredCatalogues, storeCode],
  );

  const saveAppSettings = useCallback(async (): Promise<SaveSettingsOutcome> => {
    const previousSettings = savedSettings;
    const nextSettings = await persistSettings();
    const fieldsChanged = !arraysEqual(
      previousSettings.exportFields,
      nextSettings.exportFields,
    );

    let invalidatedCount = 0;
    if (fieldsChanged) {
      try {
        invalidatedCount = await invalidateAllCsvExports();
      } catch (error) {
        console.warn("Failed to invalidate cached CSV exports", error);
      }
    }

    setSettingsSaveToken((current) => current + 1);

    return {
      settings: nextSettings,
      fieldsChanged,
      invalidatedCount,
    };
  }, [persistSettings, savedSettings]);

  const onToggleExportField = useCallback((field: ExportFieldKey): void => {
    setExportFields((current) => {
      if (current.includes(field)) {
        if (current.length === 1) {
          Alert.alert("At least one field required", "Keep at least one CSV field selected.");
          return current;
        }
        return current.filter((item) => item !== field);
      }

      return [...current, field];
    });
  }, []);

  const value = useMemo<SettingsContextValue>(() => {
    return {
      storeCode,
      hideExpiredCatalogues,
      exportFields,
      savedSettings,
      normalizedStoreCode,
      settingsDirty,
      settingsLoading,
      settingsLoadError,
      settingsSaveToken,
      onStoreCodeChange: setStoreCode,
      onHideExpiredChange: setHideExpiredCatalogues,
      onToggleExportField,
      persistSettings,
      saveAppSettings,
    };
  }, [
    exportFields,
    hideExpiredCatalogues,
    normalizedStoreCode,
    onToggleExportField,
    persistSettings,
    saveAppSettings,
    savedSettings,
    settingsDirty,
    settingsLoadError,
    settingsLoading,
    settingsSaveToken,
    storeCode,
  ]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return value;
}
