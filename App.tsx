import { StatusBar } from "expo-status-bar";
import * as DocumentPicker from "expo-document-picker";
import * as MailComposer from "expo-mail-composer";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { StatusBanner } from "./src/components/StatusBanner";
import {
  DEFAULT_SETTINGS,
  defaultEmailBody,
  defaultEmailSubject,
  ensureCsvForDump,
  deleteImport,
  ensureStorage,
  listCachedCatalogues,
  listImports,
  loadDump,
  loadImport,
  loadManifestCache,
  loadSettings,
  rebuildAllCsvExports,
  saveDump,
  saveImport,
  saveSettings,
} from "./src/services/catalogueStore";
import {
  catalogueIdForTarget,
  discoverCatalogueTargets,
  scanCatalogue,
  syncAllMissingCatalogues,
} from "./src/services/pnp";
import { CataloguesScreen } from "./src/screens/CataloguesScreen";
import { DumpsScreen } from "./src/screens/DumpsScreen";
import { ImportViewScreen } from "./src/screens/ImportViewScreen";
import { ImportsScreen } from "./src/screens/ImportsScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { BRAND } from "./src/theme";
import type {
  AppSettings,
  CatalogueDump,
  CatalogueTarget,
  ExportFieldKey,
  ImportedCatalogue,
  ImportedCatalogueSummary,
  ManifestEntry,
  SyncSummary,
} from "./src/types";
import { parseImportFile } from "./src/utils/importParser";
import {
  arraysEqual,
  buildDirectoryItems,
  normalizeExportFields,
  normalizeStoreCode,
  paginate,
  rowMatchesSearch,
} from "./src/utils/catalogueUi";
import type { DirectoryItem } from "./src/utils/catalogueUi";
import { importItemMatchesSearch } from "./src/utils/importsUi";

const pnpLogo = require("./assets/images/app-splash-icon.png");

type TabKey = "catalogues" | "imports" | "settings";

const TAB_ORDER: Array<{ key: TabKey; label: string }> = [
  { key: "catalogues", label: "Catalogues" },
  { key: "imports", label: "Imports" },
  { key: "settings", label: "Settings" },
];

const CATALOGUE_PAGE_SIZE = 8;
const DUMP_ROWS_PAGE_SIZE = 24;
const IMPORTS_PAGE_SIZE = 8;
const IMPORT_ITEMS_PAGE_SIZE = 24;

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error ?? "Unknown error");
}

/**
* Root React component that manages application state, data persistence, catalogue discovery/sync, and renders the tabbed UI (Catalogues, Imports, Settings) plus the dump detail view.
*
* The component maintains UI navigation and data state (settings, discovered targets, cached catalogue dumps, selected dump, sync summary, pagination and search), exposes actions for refreshing/discovering catalogues, pulling/syncing catalogue data, opening cached dumps, emailing/sharing CSV exports, and saving settings, and passes derived and control props down to the screen components.
*
* @returns The app's root React element.
*/
export default function App(): React.ReactElement {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";
  const safeAreaInsetBackground =
    isDarkMode ? BRAND.backgroundDark : BRAND.background;
  const safeAreaInsetStyle =
    isDarkMode ? styles.safeAreaDark : styles.safeAreaLight;

  const [activeTab, setActiveTab] = useState<TabKey>("catalogues");
  const [storeCode, setStoreCode] = useState(DEFAULT_SETTINGS.storeCode);
  const [hideExpiredCatalogues, setHideExpiredCatalogues] = useState(
    DEFAULT_SETTINGS.hideExpiredCatalogues,
  );
  const [exportFields, setExportFields] = useState<ExportFieldKey[]>(
    DEFAULT_SETTINGS.exportFields,
  );
  const [savedSettings, setSavedSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [siteTargets, setSiteTargets] = useState<CatalogueTarget[]>([]);
  const [cachedCatalogues, setCachedCatalogues] = useState<ManifestEntry[]>([]);
  const [selectedDump, setSelectedDump] = useState<CatalogueDump | null>(null);
  const [isGeneratingCsv, setIsGeneratingCsv] = useState(false);
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorText, setErrorText] = useState("");
  const [busyLabel, setBusyLabel] = useState("");
  const [downloadingCatalogueId, setDownloadingCatalogueId] = useState<string | null>(null);
  const [downloadProgressPercent, setDownloadProgressPercent] = useState<number | null>(null);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [bulkDownloadProgressPercent, setBulkDownloadProgressPercent] = useState<number | null>(null);
  const [cataloguePage, setCataloguePage] = useState(0);
  const [dumpRowsPage, setDumpRowsPage] = useState(0);
  const [dumpSearch, setDumpSearch] = useState("");
  const [importsList, setImportsList] = useState<ImportedCatalogueSummary[]>([]);
  const [importsPage, setImportsPage] = useState(0);
  const [selectedImport, setSelectedImport] = useState<ImportedCatalogue | null>(null);
  const [importSearch, setImportSearch] = useState("");
  const [importPage, setImportPage] = useState(0);
  const [importBusy, setImportBusy] = useState("");
  const [importError, setImportError] = useState("");
  const [importStatus, setImportStatus] = useState("");

  const normalizedStoreCode = useMemo(() => normalizeStoreCode(storeCode), [storeCode]);

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

  const pagedDirectoryItems = useMemo(() => {
    return paginate(directoryItems, cataloguePage, CATALOGUE_PAGE_SIZE);
  }, [cataloguePage, directoryItems]);

  const pagedImportsList = useMemo(() => {
    return paginate(importsList, importsPage, IMPORTS_PAGE_SIZE);
  }, [importsList, importsPage]);

  const filteredDumpRows = useMemo(() => {
    if (!selectedDump) {
      return [];
    }
    return selectedDump.rows.filter((row) => rowMatchesSearch(row, dumpSearch));
  }, [dumpSearch, selectedDump]);

  const pagedDumpRows = useMemo(() => {
    return paginate(filteredDumpRows, dumpRowsPage, DUMP_ROWS_PAGE_SIZE);
  }, [dumpRowsPage, filteredDumpRows]);

  const filteredImportItems = useMemo(() => {
    if (!selectedImport) {
      return [];
    }
    return selectedImport.items.filter((item) => importItemMatchesSearch(item, importSearch));
  }, [importSearch, selectedImport]);

  const pagedImportItems = useMemo(() => {
    return paginate(filteredImportItems, importPage, IMPORT_ITEMS_PAGE_SIZE);
  }, [filteredImportItems, importPage]);

  const settingsDirty = useMemo(() => {
    return (
      normalizedStoreCode !== savedSettings.storeCode ||
      hideExpiredCatalogues !== savedSettings.hideExpiredCatalogues ||
      !arraysEqual(normalizeExportFields(exportFields), savedSettings.exportFields)
    );
  }, [exportFields, hideExpiredCatalogues, normalizedStoreCode, savedSettings]);

  useEffect(() => {
    setCataloguePage(0);
  }, [directoryItems.length, hideExpiredCatalogues]);

  useEffect(() => {
    setImportsPage(0);
  }, [importsList.length]);

  useEffect(() => {
    setDumpRowsPage(0);
  }, [dumpSearch, filteredDumpRows.length, selectedDump?.catalogueId]);

  useEffect(() => {
    setImportPage(0);
  }, [importSearch, filteredImportItems.length, selectedImport?.id]);

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

  const refreshCatalogueData = useCallback(async (options?: {
    nextStoreCode?: string;
    showBusy?: boolean;
    showLoadedMessage?: boolean;
  }): Promise<void> => {
    const targetStoreCode = normalizeStoreCode(options?.nextStoreCode ?? storeCode);

    if (options?.showBusy !== false) {
      setBusyLabel("Refreshing catalogue list...");
    }

    setErrorText("");

    try {
      const cached = await listCachedCatalogues(targetStoreCode);
      let discovered: CatalogueTarget[] = [];
      let discoveryError = "";

      try {
        discovered = await discoverCatalogueTargets();
      } catch (error) {
        discoveryError = errorMessage(error);
      }

      const cachedById = new Map(cached.map((entry) => [entry.catalogueId, entry] as const));
      for (const target of discovered) {
        const catalogueId = catalogueIdForTarget(targetStoreCode, target);
        const cachedEntry = cachedById.get(catalogueId);
        if (cachedEntry?.catalogueStartDate || cachedEntry?.catalogueEndDate) {
          continue;
        }
      }

      setCachedCatalogues(cached);
      setSiteTargets(discovered);

      if (discoveryError) {
        setErrorText(
          `Site catalogue discovery failed. Showing cached data only. ${discoveryError}`,
        );
      } else if (options?.showLoadedMessage !== false) {
        setStatusMessage(
          `Loaded ${discovered.length} live catalogue(s) and ${cached.length} cached dump(s).`,
        );
      }
    } catch (error) {
      setErrorText(errorMessage(error));
    } finally {
      if (options?.showBusy !== false) {
        setBusyLabel("");
      }
    }
  }, [storeCode]);

  async function refreshImportsList(options?: { showBusy?: boolean }): Promise<void> {
    if (options?.showBusy) {
      setImportBusy("Loading imports...");
    }

    setImportError("");

    try {
      const imported = await listImports();
      setImportsList(imported);
    } catch (error) {
      setImportError(errorMessage(error));
    } finally {
      if (options?.showBusy) {
        setImportBusy("");
      }
    }
  }

  async function handleImportFile(): Promise<void> {
    setImportBusy("Opening file picker...");
    setImportError("");
    setImportStatus("");

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

      setImportBusy(`Importing ${asset.name}...`);

      const parsed = await parseImportFile(asset.uri, asset.name, asset.mimeType);
      await saveImport(parsed);
      await refreshImportsList();

      setImportStatus(
        `${parsed.name}: imported ${parsed.barcodeCount}/${parsed.itemCount} barcode(s).`,
      );
    } catch (error) {
      setImportError(errorMessage(error));
    } finally {
      setImportBusy("");
    }
  }

  async function handleOpenImport(id: string): Promise<void> {
    setImportBusy("Opening import...");
    setImportError("");

    try {
      const imported = await loadImport(id);
      if (!imported) {
        throw new Error("That import is no longer available.");
      }
      setSelectedImport(imported);
      setImportSearch("");
      setImportPage(0);
    } catch (error) {
      setImportError(errorMessage(error));
    } finally {
      setImportBusy("");
    }
  }

  async function handleDeleteImport(id: string): Promise<void> {
    setImportBusy("Deleting import...");
    setImportError("");
    setImportStatus("");

    try {
      await deleteImport(id);
      if (selectedImport?.id === id) {
        setSelectedImport(null);
      }
      await refreshImportsList();
      setImportStatus("Import deleted.");
    } catch (error) {
      setImportError(errorMessage(error));
    } finally {
      setImportBusy("");
    }
  }

  useEffect(() => {
    const bootstrap = async (): Promise<void> => {
      try {
        await ensureStorage();
        const settings = await loadSettings();
        setStoreCode(settings.storeCode);
        setHideExpiredCatalogues(settings.hideExpiredCatalogues);
        setExportFields(settings.exportFields);
        setSavedSettings(settings);
        await refreshCatalogueData({
          nextStoreCode: settings.storeCode,
          showLoadedMessage: false,
        });
        await refreshImportsList();
      } catch (error) {
        setErrorText(errorMessage(error));
      }
    };

    void bootstrap();
  }, []);

  async function runPull(forceRefresh: boolean): Promise<void> {
    setBusyLabel(
      forceRefresh ? "Refreshing all visible site catalogues..." : "Pulling missing site catalogues...",
    );
    setDownloadingCatalogueId(null);
    setDownloadProgressPercent(null);
    setIsBulkDownloading(true);
    setBulkDownloadProgressPercent(0);
    setErrorText("");
    setStatusMessage("");

    try {
      const nextSettings = await persistSettings();
      const summary = await syncAllMissingCatalogues(
        nextSettings.storeCode,
        forceRefresh,
        (current, total) => {
          setBusyLabel(`Downloading ${current}/${total} catalogues...`);
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
      setStatusMessage(
        `Processed ${summary.results.length} catalogue(s): ${summary.exportedCount} exported, ${summary.skippedCount} skipped, ${summary.failedCount} failed.`,
      );
    } catch (error) {
      setErrorText(errorMessage(error));
    } finally {
      setIsBulkDownloading(false);
      setBulkDownloadProgressPercent(null);
      setBusyLabel("");
    }
  }

  const pullSingleCatalogue = useCallback(
    async (item: DirectoryItem): Promise<void> => {
      lastDownloadProgressRef.current = { updatedAt: 0, percent: null };
      setDownloadingCatalogueId(item.catalogueId);
      setDownloadProgressPercent(0);
      setBusyLabel(`Pulling ${item.label}...`);
      setErrorText("");
      setStatusMessage("");

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
        setStatusMessage(
          `${outcome.dump.label}: ${outcome.result.barcodesFound}/${outcome.result.itemCount} barcodes found.`,
        );
      } catch (error) {
        setErrorText(errorMessage(error));
      } finally {
        setDownloadingCatalogueId(null);
        setDownloadProgressPercent(null);
        setBusyLabel("");
      }
    },
    [persistSettings, refreshCatalogueData, reportDownloadProgress],
  );

  const handlePullItem = useCallback(
    (item: DirectoryItem) => {
      void pullSingleCatalogue(item);
    },
    [pullSingleCatalogue],
  );

  const openDump = useCallback(async (catalogueId: string): Promise<void> => {
    setBusyLabel("Opening cached dump...");
    setErrorText("");

    try {
      const dump = await loadDump(catalogueId);
      if (!dump) {
        throw new Error("That catalogue dump is no longer available.");
      }
      setSelectedDump(dump);
      setDumpSearch("");
      setDumpRowsPage(0);
      setActiveTab("catalogues");
    } catch (error) {
      setErrorText(errorMessage(error));
    } finally {
      setBusyLabel("");
    }
  }, []);

  const handleOpenDump = useCallback(
    (catalogueId: string) => {
      void openDump(catalogueId);
    },
    [openDump],
  );

  async function sendEmail(catalogueId: string): Promise<void> {
    setIsGeneratingCsv(true);
    setBusyLabel("Preparing export...");
    setErrorText("");

    try {
      const canEmail = await MailComposer.isAvailableAsync();
      const canShare = canEmail ? false : await Sharing.isAvailableAsync();
      if (!canEmail && !canShare) {
        throw new Error("No email or file sharing app is available on this device.");
      }

      let entry = cachedCatalogues.find((item) => item.catalogueId === catalogueId) ?? null;
      const selectedDumpMatch = selectedDump?.catalogueId === catalogueId ? selectedDump : null;

      if (!entry && selectedDumpMatch) {
        try {
          const manifest = await loadManifestCache();
          entry = manifest.catalogues[catalogueId] ?? null;
        } catch (error) {
          console.warn("Failed to load manifest cache while preparing export", error);
        }
      }

      let dumpUri: string | null = null;
      let csvUriHint: string | undefined;
      let label: string | null = null;
      let metadata: ManifestEntry | CatalogueDump | null = null;

      if (entry?.dumpUri) {
        dumpUri = entry.dumpUri;
        csvUriHint = entry.csvUri;
        label = entry.label;
        metadata = entry;
      } else if (selectedDumpMatch) {
        const persisted = await saveDump(selectedDumpMatch);
        dumpUri = persisted.dumpUri;
        csvUriHint = persisted.csvUri;
        label = persisted.dump.label;
        metadata = persisted.dump;
      }

      if (!dumpUri || !label || !metadata) {
        Alert.alert("No catalogue selected", "That catalogue is not available for email.");
        return;
      }

      setBusyLabel("Building CSV export...");
      const csvUri = await ensureCsvForDump(dumpUri, csvUriHint);

      if (canEmail) {
        setBusyLabel("Opening email composer...");
        await MailComposer.composeAsync({
          subject: defaultEmailSubject(metadata),
          body: defaultEmailBody(metadata),
          attachments: [csvUri],
        });
        setStatusMessage(`Email composer opened for ${label}.`);
      } else {
        setBusyLabel("Opening share sheet...");
        await Sharing.shareAsync(csvUri, {
          dialogTitle: `${label} CSV`,
          mimeType: "text/csv",
          UTI: "public.comma-separated-values-text",
        });
        setStatusMessage(
          "Mail composer is unavailable on this device, so the CSV was shared instead.",
        );
      }
    } catch (error) {
      setErrorText(errorMessage(error));
    } finally {
      setIsGeneratingCsv(false);
      setBusyLabel("");
    }
  }

  async function saveAppSettings(): Promise<void> {
    const previousSettings = savedSettings;
    setBusyLabel("Saving settings...");
    setErrorText("");
    setStatusMessage("");

    try {
      const nextSettings = await persistSettings();
      const fieldsChanged = !arraysEqual(
        previousSettings.exportFields,
        nextSettings.exportFields,
      );

      let rebuiltCount = 0;
      if (fieldsChanged) {
        rebuiltCount = await rebuildAllCsvExports();
      }

      await refreshCatalogueData({
        nextStoreCode: nextSettings.storeCode,
        showBusy: false,
        showLoadedMessage: false,
      });

      setStatusMessage(
        fieldsChanged
          ? `Settings saved. Rebuilt ${rebuiltCount} cached CSV export(s).`
          : "Settings saved.",
      );
    } catch (error) {
      setErrorText(errorMessage(error));
    } finally {
      setBusyLabel("");
    }
  }

  function toggleExportField(field: ExportFieldKey): void {
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
  }

  function handleEmailDump(catalogueId: string): void {
    void sendEmail(catalogueId);
  }

  const showingImports = activeTab === "imports";
  const statusBannerBusyLabel = showingImports ? importBusy : busyLabel;
  const statusBannerErrorText = showingImports ? importError : errorText;
  const statusBannerMessage = showingImports ? importStatus : statusMessage;

  return (
    <SafeAreaProvider>
      <SafeAreaView
        edges={["top", "bottom", "left", "right"]}
        style={[styles.safeArea, safeAreaInsetStyle]}
      >
        <StatusBar
          backgroundColor={safeAreaInsetBackground}
          style={isDarkMode ? "light" : "dark"}
        />
        <View style={styles.appShell}>
          <View style={styles.headerBlock}>
            <Image accessible={false} source={pnpLogo} style={styles.headerLogo} />
            <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
              PnP Catalogue Helper
            </Text>
          </View>

          <View style={styles.tabRow}>
            {TAB_ORDER.map((tab) => {
              const active = tab.key === activeTab;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => {
                    setActiveTab(tab.key);
                    if (tab.key !== "imports") {
                      setSelectedImport(null);
                    }
                  }}
                  style={[styles.tabButton, active && styles.tabButtonActive]}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <StatusBanner
            busyLabel={statusBannerBusyLabel}
            errorText={statusBannerErrorText}
            onDismiss={() => {
              if (showingImports) {
                setImportError("");
                setImportStatus("");
                return;
              }
              setErrorText("");
              setStatusMessage("");
            }}
            statusMessage={statusBannerMessage}
          />

          <View style={styles.flex}>
            {activeTab === "catalogues" ? (
              selectedDump ? (
                <DumpsScreen
                  dumpRowsPage={dumpRowsPage}
                  dumpSearch={dumpSearch}
                  filteredDumpRows={filteredDumpRows}
                  isGeneratingCsv={isGeneratingCsv}
                  onBackToCatalogues={() => {
                    setSelectedDump(null);
                    setActiveTab("catalogues");
                  }}
                  onDumpRowsPageChange={setDumpRowsPage}
                  onDumpSearchChange={setDumpSearch}
                  onEmailDump={handleEmailDump}
                  pagedDumpRows={pagedDumpRows}
                  selectedDump={selectedDump}
                />
              ) : (
                <CataloguesScreen
                  cachedCount={visibleCachedCatalogues.length}
                  cataloguePage={cataloguePage}
                  directoryItems={directoryItems}
                  downloadingCatalogueId={downloadingCatalogueId}
                  downloadProgressPercent={downloadProgressPercent}
                  hideExpiredCatalogues={hideExpiredCatalogues}
                  isBulkDownloading={isBulkDownloading}
                  bulkDownloadProgressPercent={bulkDownloadProgressPercent}
                  onCataloguePageChange={setCataloguePage}
                  onForceRefresh={() => {
                    void runPull(true);
                  }}
                  onOpenDump={handleOpenDump}
                  onPullAll={() => {
                    void runPull(false);
                  }}
                  onPullItem={handlePullItem}
                  onRefreshList={() => {
                    void refreshCatalogueData();
                  }}
                  pagedDirectoryItems={pagedDirectoryItems}
                  siteCount={siteTargets.length}
                  syncSummary={syncSummary}
                />
              )
            ) : null}

            {activeTab === "imports" ? (
              selectedImport ? (
                <ImportViewScreen
                  filteredImportItems={filteredImportItems}
                  importPage={importPage}
                  importSearch={importSearch}
                  pageSize={IMPORT_ITEMS_PAGE_SIZE}
                  onBack={() => {
                    setSelectedImport(null);
                  }}
                  onImportPageChange={setImportPage}
                  onImportSearchChange={setImportSearch}
                  pagedImportItems={pagedImportItems}
                  selectedImport={selectedImport}
                />
              ) : (
                <ImportsScreen
                  importsList={importsList}
                  importsPage={importsPage}
                  onDelete={(id) => {
                    void handleDeleteImport(id);
                  }}
                  onImport={() => {
                    void handleImportFile();
                  }}
                  onOpen={(id) => {
                    void handleOpenImport(id);
                  }}
                  onImportsPageChange={setImportsPage}
                  pagedImportsList={pagedImportsList}
                />
              )
            ) : null}

            {activeTab === "settings" ? (
              <SettingsScreen
                exportFields={exportFields}
                hideExpiredCatalogues={hideExpiredCatalogues}
                onHideExpiredChange={setHideExpiredCatalogues}
                onSaveSettings={() => {
                  void saveAppSettings();
                }}
                onStoreCodeChange={setStoreCode}
                onToggleExportField={toggleExportField}
                settingsDirty={settingsDirty}
                storeCode={storeCode}
              />
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  safeAreaLight: {
    backgroundColor: BRAND.background,
  },
  safeAreaDark: {
    backgroundColor: BRAND.backgroundDark,
  },
  appShell: {
    flex: 1,
    backgroundColor: BRAND.background,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  flex: {
    flex: 1,
  },
  headerBlock: {
    backgroundColor: BRAND.red,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#8b1610",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 4,
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginEnd: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: BRAND.white,
    flexShrink: 1,
  },
  tabRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
    marginBottom: 12,
  },
  tabButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tabButtonActive: {
    backgroundColor: BRAND.blue,
    borderColor: BRAND.blue,
  },
  tabText: {
    color: BRAND.blue,
    fontWeight: "700",
  },
  tabTextActive: {
    color: BRAND.white,
  },
});
