import * as DocumentPicker from "expo-document-picker";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { deleteImport, listImports, loadImport, saveImport } from "../services/catalogueStore";
import type { ImportedCatalogue, ImportedCatalogueSummary } from "../types";
import { parseImportFile } from "../utils/importParser";

import { useFeedback } from "./useFeedbackContext";
import { useSettings } from "./useSettingsContext";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error ?? "Unknown error");
}

type ImportsContextValue = {
  importsList: ImportedCatalogueSummary[];
  selectedImport: ImportedCatalogue | null;
  setSelectedImport: React.Dispatch<React.SetStateAction<ImportedCatalogue | null>>;
  refreshImportsList: (options?: { showBusy?: boolean }) => Promise<void>;
  importFile: () => Promise<void>;
  openImport: (id: string) => Promise<void>;
  removeImport: (id: string) => Promise<void>;
};

const ImportsContext = createContext<ImportsContextValue | null>(null);

export function ImportsProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const { settingsLoading } = useSettings();
  const { clearError, clearFeedback, setBusy, setError, setStatus } = useFeedback();

  const [importsList, setImportsList] = useState<ImportedCatalogueSummary[]>([]);
  const [selectedImport, setSelectedImport] = useState<ImportedCatalogue | null>(null);

  const refreshImportsList = useCallback(
    async (options?: { showBusy?: boolean }): Promise<void> => {
      if (options?.showBusy) {
        setBusy("Loading imports...");
      }

      clearError();

      try {
        const imported = await listImports();
        setImportsList(imported);
      } catch (error) {
        setError(errorMessage(error));
      } finally {
        if (options?.showBusy) {
          setBusy("");
        }
      }
    },
    [clearError, setBusy, setError],
  );

  const didBootstrapRefreshRef = useRef(false);
  useEffect(() => {
    if (settingsLoading || didBootstrapRefreshRef.current) {
      return;
    }

    didBootstrapRefreshRef.current = true;
    void refreshImportsList();
  }, [refreshImportsList, settingsLoading]);

  const importFile = useCallback(async (): Promise<void> => {
    setBusy("Opening file picker...");
    clearFeedback();

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "text/csv",
          "text/comma-separated-values",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.uri || !asset.name) {
        throw new Error("No import file selected.");
      }

      setBusy(`Importing ${asset.name}...`);

      const parsed = await parseImportFile(asset.uri, asset.name, asset.mimeType);
      await saveImport(parsed);
      await refreshImportsList();

      setStatus(`${parsed.name}: imported ${parsed.barcodeCount}/${parsed.itemCount} barcode(s).`);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }, [clearFeedback, refreshImportsList, setBusy, setError, setStatus]);

  const openImport = useCallback(
    async (id: string): Promise<void> => {
      setBusy("Opening import...");
      clearError();

      try {
        const imported = await loadImport(id);
        if (!imported) {
          throw new Error("That import is no longer available.");
        }
        setSelectedImport(imported);
      } catch (error) {
        setError(errorMessage(error));
      } finally {
        setBusy("");
      }
    },
    [clearError, setBusy, setError],
  );

  const removeImport = useCallback(
    async (id: string): Promise<void> => {
      setBusy("Deleting import...");
      clearFeedback();

      try {
        await deleteImport(id);
        if (selectedImport?.id === id) {
          setSelectedImport(null);
        }
        await refreshImportsList();
        setStatus("Import deleted.");
      } catch (error) {
        setError(errorMessage(error));
      } finally {
        setBusy("");
      }
    },
    [clearFeedback, refreshImportsList, selectedImport?.id, setBusy, setError, setStatus],
  );

  const value = useMemo<ImportsContextValue>(() => {
    return {
      importsList,
      selectedImport,
      setSelectedImport,
      refreshImportsList,
      importFile,
      openImport,
      removeImport,
    };
  }, [importFile, importsList, openImport, refreshImportsList, removeImport, selectedImport]);

  return <ImportsContext.Provider value={value}>{children}</ImportsContext.Provider>;
}

export function useImports(): ImportsContextValue {
  const value = useContext(ImportsContext);
  if (!value) {
    throw new Error("useImports must be used within ImportsProvider");
  }
  return value;
}
