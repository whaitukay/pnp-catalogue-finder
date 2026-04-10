import * as MailComposer from "expo-mail-composer";
import * as Sharing from "expo-sharing";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";

import {
  defaultEmailBody,
  defaultEmailSubject,
  ensureCsvForDump,
  ensureXlsxForDump,
  listCachedCatalogues,
  loadDump,
  loadManifestCache,
  saveDump,
} from "../services/catalogueStore";
import {
  discoverCatalogueTargets,
  scanCatalogue,
  syncAllMissingCatalogues,
} from "../services/pnp";
import type {
  CatalogueDump,
  CatalogueTarget,
  ExportFormat,
  ManifestEntry,
  SyncSummary,
} from "../types";
import {
  buildDirectoryItems,
  normalizeStoreCode,
} from "../utils/catalogueUi";
import type { DirectoryItem } from "../utils/catalogueUi";

import { useFeedback } from "./useFeedbackContext";
import { useSettings } from "./useSettingsContext";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error ?? "Unknown error");
}

type RefreshCatalogueOptions = {
  nextStoreCode?: string;
  showBusy?: boolean;
  showLoadedMessage?: boolean;
};

type CataloguesContextValue = {
  siteTargets: CatalogueTarget[];
  cachedCatalogues: ManifestEntry[];
  visibleCachedCatalogues: ManifestEntry[];
  directoryItems: DirectoryItem[];
  syncSummary: SyncSummary | null;
  downloadingCatalogueId: string | null;
  downloadProgressPercent: number | null;
  isBulkDownloading: boolean;
  bulkDownloadProgressPercent: number | null;
  selectedDump: CatalogueDump | null;
  setSelectedDump: React.Dispatch<React.SetStateAction<CatalogueDump | null>>;
  generatingExportFormat: ExportFormat | null;
  refreshCatalogueData: (options?: RefreshCatalogueOptions) => Promise<void>;
  runPull: (forceRefresh: boolean) => Promise<void>;
  pullSingleCatalogue: (item: DirectoryItem) => Promise<void>;
  openDump: (catalogueId: string) => Promise<void>;
  sendEmail: (catalogueId: string, format?: ExportFormat) => Promise<void>;
};

const CataloguesContext = createContext<CataloguesContextValue | null>(null);

export function CataloguesProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const {
    normalizedStoreCode,
    hideExpiredCatalogues,
    persistSettings,
    settingsLoading,
    settingsSaveToken,
  } = useSettings();
  const { clearError, clearFeedback, setBusy, setError, setStatus } = useFeedback();

  const [siteTargets, setSiteTargets] = useState<CatalogueTarget[]>([]);
  const [cachedCatalogues, setCachedCatalogues] = useState<ManifestEntry[]>([]);
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);
  const [selectedDump, setSelectedDump] = useState<CatalogueDump | null>(null);
  const [generatingExportFormat, setGeneratingExportFormat] = useState<ExportFormat | null>(null);
  const [downloadingCatalogueId, setDownloadingCatalogueId] = useState<string | null>(null);
  const [downloadProgressPercent, setDownloadProgressPercent] = useState<number | null>(null);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [bulkDownloadProgressPercent, setBulkDownloadProgressPercent] = useState<number | null>(null);

  const lastDownloadProgressRef = useRef<{ updatedAt: number; percent: number | null }>({
    updatedAt: 0,
    percent: null,
  });

  const reportDownloadProgress = useCallback(
    (progress: number) => {
      const now = Date.now();
      const { percent: lastPercent, updatedAt } = lastDownloadProgressRef.current;

      if (!Number.isFinite(progress)) {
        return;
      }

      const normalizedProgress = Math.min(1, Math.max(0, progress));
      const nextPercent = Math.round(normalizedProgress * 100);
      const progressDelta = lastPercent == null ? Infinity : Math.abs(nextPercent - lastPercent);

      const shouldUpdate =
        nextPercent >= 100 ||
        lastPercent == null ||
        now - updatedAt >= 100 ||
        progressDelta >= 5;

      if (!shouldUpdate) {
        return;
      }

      lastDownloadProgressRef.current = { updatedAt: now, percent: nextPercent };
      setDownloadProgressPercent(nextPercent);
    },
    [setDownloadProgressPercent],
  );

  const refreshCatalogueData = useCallback(
    async (options?: RefreshCatalogueOptions): Promise<void> => {
      const targetStoreCode = normalizeStoreCode(
        options?.nextStoreCode ?? normalizedStoreCode,
      );

      if (options?.showBusy !== false) {
        setBusy("Refreshing catalogue list...");
      }

      clearError();

      try {
        const cached = await listCachedCatalogues(targetStoreCode);
        let discovered: CatalogueTarget[] = [];
        let discoveryError = "";

        try {
          discovered = await discoverCatalogueTargets();
        } catch (error) {
          discoveryError = errorMessage(error);
        }

        setCachedCatalogues(cached);
        setSiteTargets(discovered);

        if (discoveryError) {
          setError(
            `Site catalogue discovery failed. Showing cached data only. ${discoveryError}`,
          );
        } else if (options?.showLoadedMessage !== false) {
          setStatus(
            `Loaded ${discovered.length} live catalogue(s) and ${cached.length} cached dump(s).`,
          );
        }
      } catch (error) {
        setError(errorMessage(error));
      } finally {
        if (options?.showBusy !== false) {
          setBusy("");
        }
      }
    },
    [clearError, normalizedStoreCode, setBusy, setError, setStatus],
  );

  const didBootstrapRefreshRef = useRef(false);
  useEffect(() => {
    if (settingsLoading || didBootstrapRefreshRef.current) {
      return;
    }

    didBootstrapRefreshRef.current = true;
    void refreshCatalogueData({ showLoadedMessage: false });
  }, [refreshCatalogueData, settingsLoading]);

  const hasAppliedSaveTokenRef = useRef(false);
  useEffect(() => {
    if (!hasAppliedSaveTokenRef.current) {
      hasAppliedSaveTokenRef.current = true;
      return;
    }

    void refreshCatalogueData({
      showBusy: false,
      showLoadedMessage: false,
    });
  }, [refreshCatalogueData, settingsSaveToken]);

  const runPull = useCallback(
    async (forceRefresh: boolean): Promise<void> => {
      setBusy(
        forceRefresh
          ? "Refreshing all visible site catalogues..."
          : "Pulling missing site catalogues...",
      );
      setDownloadingCatalogueId(null);
      setDownloadProgressPercent(null);
      setIsBulkDownloading(true);
      setBulkDownloadProgressPercent(0);
      clearFeedback();

      try {
        const nextSettings = await persistSettings();
        const summary = await syncAllMissingCatalogues(
          nextSettings.storeCode,
          forceRefresh,
          (current, total) => {
            setBusy(`Downloading ${current}/${total} catalogues...`);
            setBulkDownloadProgressPercent(
              total > 0 ? Math.round((current / total) * 100) : 0,
            );
          },
        );
        setSyncSummary(summary);
        await refreshCatalogueData({
          nextStoreCode: nextSettings.storeCode,
          showBusy: false,
          showLoadedMessage: false,
        });
        setStatus(
          `Processed ${summary.results.length} catalogue(s): ${summary.exportedCount} exported, ${summary.skippedCount} skipped, ${summary.failedCount} failed.`,
        );
      } catch (error) {
        setError(errorMessage(error));
      } finally {
        setIsBulkDownloading(false);
        setBulkDownloadProgressPercent(null);
        setBusy("");
      }
    },
    [clearFeedback, persistSettings, refreshCatalogueData, setBusy, setError, setStatus],
  );

  const pullSingleCatalogue = useCallback(
    async (item: DirectoryItem): Promise<void> => {
      lastDownloadProgressRef.current = { updatedAt: 0, percent: null };
      setDownloadingCatalogueId(item.catalogueId);
      setDownloadProgressPercent(0);
      setBusy(`Pulling ${item.label}...`);
      clearFeedback();

      try {
        const nextSettings = await persistSettings();
        const outcome = await scanCatalogue(
          item.pullSource,
          nextSettings.storeCode,
          false,
          item.label,
          reportDownloadProgress,
        );
        await refreshCatalogueData({
          nextStoreCode: nextSettings.storeCode,
          showBusy: false,
          showLoadedMessage: false,
        });
        setStatus(
          `${outcome.dump.label}: ${outcome.result.barcodesFound}/${outcome.result.itemCount} barcodes found.`,
        );
      } catch (error) {
        setError(errorMessage(error));
      } finally {
        setDownloadingCatalogueId(null);
        setDownloadProgressPercent(null);
        setBusy("");
      }
    },
    [
      clearFeedback,
      persistSettings,
      refreshCatalogueData,
      reportDownloadProgress,
      setBusy,
      setError,
      setStatus,
    ],
  );

  const openDump = useCallback(
    async (catalogueId: string): Promise<void> => {
      setBusy("Opening cached dump...");
      clearError();

      try {
        const dump = await loadDump(catalogueId);
        if (!dump) {
          throw new Error("That catalogue dump is no longer available.");
        }
        setSelectedDump(dump);
      } catch (error) {
        setError(errorMessage(error));
      } finally {
        setBusy("");
      }
    },
    [clearError, setBusy, setError],
  );

  const sendEmail = useCallback(
    async (catalogueId: string, format: ExportFormat = "csv"): Promise<void> => {
      setGeneratingExportFormat(format);
      setBusy("Preparing export...");
      clearError();

      try {
        const canEmail = await MailComposer.isAvailableAsync();
        const canShare = canEmail ? false : await Sharing.isAvailableAsync();
        if (!canEmail && !canShare) {
          throw new Error("No email or file sharing app is available on this device.");
        }

        let entry =
          cachedCatalogues.find((item) => item.catalogueId === catalogueId) ?? null;
        const selectedDumpMatch =
          selectedDump?.catalogueId === catalogueId ? selectedDump : null;

        if (!entry && selectedDumpMatch) {
          try {
            const manifest = await loadManifestCache();
            entry = manifest.catalogues[catalogueId] ?? null;
          } catch (error) {
            console.warn("Failed to load manifest cache while preparing export", error);
          }
        }

        const exportLabel = format === "xlsx" ? "XLSX" : "CSV";

        let dumpUri: string | null = null;
        let exportUriHint: string | undefined;
        let label: string | null = null;
        let metadata: ManifestEntry | CatalogueDump | null = null;

        if (entry?.dumpUri) {
          dumpUri = entry.dumpUri;
          exportUriHint = format === "xlsx" ? entry.xlsxUri : entry.csvUri;
          label = entry.label;
          metadata = entry;
        } else if (selectedDumpMatch) {
          const persisted = await saveDump(selectedDumpMatch);
          dumpUri = persisted.dumpUri;
          exportUriHint = format === "xlsx" ? persisted.xlsxUri : persisted.csvUri;
          label = persisted.dump.label;
          metadata = persisted.dump;
        }

        if (!dumpUri || !label || !metadata) {
          Alert.alert("No catalogue selected", "That catalogue is not available for email.");
          return;
        }

        setBusy(`Building ${exportLabel} export...`);
        const exportUri =
          format === "xlsx"
            ? await ensureXlsxForDump(dumpUri, exportUriHint)
            : await ensureCsvForDump(dumpUri, exportUriHint);

        if (canEmail) {
          setBusy("Opening email composer...");
          await MailComposer.composeAsync({
            subject: defaultEmailSubject(metadata),
            body: defaultEmailBody(metadata),
            attachments: [exportUri],
          });
          setStatus(`Email composer opened for ${label}.`);
        } else {
          setBusy("Opening share sheet...");
          await Sharing.shareAsync(
            exportUri,
            format === "xlsx"
              ? {
                  dialogTitle: `${label} XLSX`,
                  mimeType:
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  UTI: "com.microsoft.excel.xlsx",
                }
              : {
                  dialogTitle: `${label} CSV`,
                  mimeType: "text/csv",
                  UTI: "public.comma-separated-values-text",
                },
          );
          setStatus(
            `Mail composer is unavailable on this device, so the ${exportLabel} was shared instead.`,
          );
        }
      } catch (error) {
        setError(errorMessage(error));
      } finally {
        setGeneratingExportFormat(null);
        setBusy("");
      }
    },
    [cachedCatalogues, clearError, selectedDump, setBusy, setError, setStatus],
  );

  const visibleCachedCatalogues = useMemo(() => {
    return hideExpiredCatalogues
      ? cachedCatalogues.filter((entry) => !entry.expired)
      : cachedCatalogues;
  }, [cachedCatalogues, hideExpiredCatalogues]);

  const directoryItems = useMemo(() => {
    return buildDirectoryItems(
      siteTargets,
      cachedCatalogues,
      normalizedStoreCode,
      hideExpiredCatalogues,
    );
  }, [cachedCatalogues, hideExpiredCatalogues, normalizedStoreCode, siteTargets]);

  const value = useMemo<CataloguesContextValue>(() => {
    return {
      siteTargets,
      cachedCatalogues,
      visibleCachedCatalogues,
      directoryItems,
      syncSummary,
      downloadingCatalogueId,
      downloadProgressPercent,
      isBulkDownloading,
      bulkDownloadProgressPercent,
      selectedDump,
      setSelectedDump,
      generatingExportFormat,
      refreshCatalogueData,
      runPull,
      pullSingleCatalogue,
      openDump,
      sendEmail,
    };
  }, [
    bulkDownloadProgressPercent,
    cachedCatalogues,
    directoryItems,
    downloadProgressPercent,
    downloadingCatalogueId,
    isBulkDownloading,
    generatingExportFormat,
    openDump,
    refreshCatalogueData,
    runPull,
    pullSingleCatalogue,
    selectedDump,
    sendEmail,
    siteTargets,
    syncSummary,
    visibleCachedCatalogues,
  ]);

  return <CataloguesContext.Provider value={value}>{children}</CataloguesContext.Provider>;
}

export function useCatalogues(): CataloguesContextValue {
  const value = useContext(CataloguesContext);
  if (!value) {
    throw new Error("useCatalogues must be used within CataloguesProvider");
  }
  return value;
}
