import { StatusBar } from "expo-status-bar";
import * as MailComposer from "expo-mail-composer";
import * as Sharing from "expo-sharing";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { StatusBanner } from "./src/components/StatusBanner";
import {
  DEFAULT_SETTINGS,
  defaultEmailBody,
  defaultEmailSubject,
  ensureStorage,
  listCachedCatalogues,
  loadDump,
  loadSettings,
  rebuildAllCsvExports,
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
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { BRAND } from "./src/theme";
import type {
  AppSettings,
  CatalogueDump,
  CatalogueTarget,
  ExportFieldKey,
  ManifestEntry,
  SyncSummary,
} from "./src/types";
import {
  arraysEqual,
  buildDirectoryItems,
  normalizeExportFields,
  normalizeStoreCode,
  paginate,
  rowMatchesSearch,
} from "./src/utils/catalogueUi";
import type { DirectoryItem } from "./src/utils/catalogueUi";

type TabKey = "catalogues" | "settings";

const TAB_ORDER: Array<{ key: TabKey; label: string }> = [
  { key: "catalogues", label: "Catalogues" },
  { key: "settings", label: "Settings" },
];

const CATALOGUE_PAGE_SIZE = 8;
const DUMP_ROWS_PAGE_SIZE = 24;

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error ?? "Unknown error");
}

/**
* Root React component that manages application state, data persistence, catalogue discovery/sync, and renders the tabbed UI (Catalogues, Settings) plus the dump detail view.
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

  const filteredDumpRows = useMemo(() => {
    if (!selectedDump) {
      return [];
    }
    return selectedDump.rows.filter((row) => rowMatchesSearch(row, dumpSearch));
  }, [dumpSearch, selectedDump]);

  const pagedDumpRows = useMemo(() => {
    return paginate(filteredDumpRows, dumpRowsPage, DUMP_ROWS_PAGE_SIZE);
  }, [dumpRowsPage, filteredDumpRows]);

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
    setDumpRowsPage(0);
  }, [dumpSearch, filteredDumpRows.length, selectedDump?.catalogueId]);

  async function persistSettings(
    overrides?: Partial<AppSettings>,
  ): Promise<AppSettings> {
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
  }

  async function refreshCatalogueData(options?: {
    nextStoreCode?: string;
    showBusy?: boolean;
    showLoadedMessage?: boolean;
  }): Promise<void> {
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

  async function pullSingleCatalogue(item: DirectoryItem): Promise<void> {
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
        (progress) => {
          setDownloadProgressPercent(Math.round(progress * 100));
        },
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
  }

  async function openDump(catalogueId: string): Promise<void> {
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
  }

  async function sendEmail(catalogueId: string): Promise<void> {
    const entry =
      cachedCatalogues.find((item) => item.catalogueId === catalogueId) ??
      (selectedDump?.catalogueId === catalogueId ? selectedDump : null);

    if (!entry) {
      Alert.alert("No catalogue selected", "That catalogue is not available for email.");
      return;
    }

    setBusyLabel("Opening email composer...");
    setErrorText("");

    try {
      if (await MailComposer.isAvailableAsync()) {
        await MailComposer.composeAsync({
          subject: defaultEmailSubject(entry),
          body: defaultEmailBody(entry),
          attachments: [entry.csvUri],
        });
        setStatusMessage(`Email composer opened for ${entry.label}.`);
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(entry.csvUri, {
          dialogTitle: `${entry.label} CSV`,
          mimeType: "text/csv",
          UTI: "public.comma-separated-values-text",
        });
        setStatusMessage(
          "Mail composer is unavailable on this device, so the CSV was shared instead.",
        );
      } else {
        throw new Error("No email or file sharing app is available on this device.");
      }
    } catch (error) {
      setErrorText(errorMessage(error));
    } finally {
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
            <Text style={styles.title}>Pick n Pay Catalogue Helper</Text>
            <Text style={styles.subtitle}>
              Live catalogue tracking, barcode dump review, and CSV email from one Expo app.
            </Text>
          </View>

          <View style={styles.tabRow}>
            {TAB_ORDER.map((tab) => {
              const active = tab.key === activeTab;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={[styles.tabButton, active && styles.tabButtonActive]}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <StatusBanner
            busyLabel={busyLabel}
            errorText={errorText}
            onDismiss={() => {
              setErrorText("");
              setStatusMessage("");
            }}
            statusMessage={statusMessage}
          />

          <View style={styles.flex}>
            {activeTab === "catalogues" ? (
              selectedDump ? (
                <DumpsScreen
                  dumpRowsPage={dumpRowsPage}
                  dumpSearch={dumpSearch}
                  filteredDumpRows={filteredDumpRows}
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
                  onOpenDump={(catalogueId) => {
                    void openDump(catalogueId);
                  }}
                  onPullAll={() => {
                    void runPull(false);
                  }}
                  onPullItem={(item) => {
                    void pullSingleCatalogue(item);
                  }}
                  onRefreshList={() => {
                    void refreshCatalogueData();
                  }}
                  pagedDirectoryItems={pagedDirectoryItems}
                  siteCount={siteTargets.length}
                  syncSummary={syncSummary}
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
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 20,
    shadowColor: "#8b1610",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 4,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: BRAND.white,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: "#fff0ee",
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
