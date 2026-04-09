import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { DirectoryCatalogueCard, PaginationControls, ProgressButton } from "../components";
import { useCatalogues, usePaginatedScroll, useSettings } from "../hooks";
import { BRAND, sharedStyles } from "../theme";
import type { DirectoryItem } from "../utils/catalogueUi";
import { formatDateRange, paginate } from "../utils/catalogueUi";

const CATALOGUE_PAGE_SIZE = 8;

export function CataloguesScreen(): React.ReactElement {
  const {
    directoryItems,
    siteTargets,
    visibleCachedCatalogues,
    downloadingCatalogueId,
    downloadProgressPercent,
    isBulkDownloading,
    bulkDownloadProgressPercent,
    syncSummary,
    refreshCatalogueData,
    runPull,
    pullSingleCatalogue,
    openDump,
  } = useCatalogues();
  const { hideExpiredCatalogues } = useSettings();

  const [cataloguePage, setCataloguePage] = React.useState(0);
  const { scrollRef, handlePageChange } = usePaginatedScroll(setCataloguePage);

  const pagedDirectoryItems = React.useMemo(() => {
    return paginate(directoryItems, cataloguePage, CATALOGUE_PAGE_SIZE);
  }, [cataloguePage, directoryItems]);

  React.useEffect(() => {
    setCataloguePage(0);
  }, [directoryItems.length, hideExpiredCatalogues]);

  const downloadsDisabled = Boolean(downloadingCatalogueId) || isBulkDownloading;
  const pullAllLabel = "Download all";
  const bulkProgress = isBulkDownloading ? bulkDownloadProgressPercent : null;

  return (
    <ScrollView contentContainerStyle={sharedStyles.content} ref={scrollRef}>
      <View style={styles.heroCard}>
        <View style={sharedStyles.buttonRow}>
          <Pressable
            onPress={() => {
              void refreshCatalogueData();
            }}
            style={styles.heroSecondaryButton}
          >
            <Text style={styles.heroSecondaryButtonText}>Refresh list</Text>
          </Pressable>
          <ProgressButton
            disabled={downloadsDisabled}
            label={pullAllLabel}
            onPress={() => {
              void runPull(false);
            }}
            progress={bulkProgress}
            variant="primary"
          />
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{directoryItems.length}</Text>
          <Text style={styles.statLabel}>Visible catalogues</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{siteTargets.length}</Text>
          <Text style={styles.statLabel}>Live on site</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{visibleCachedCatalogues.length}</Text>
          <Text style={styles.statLabel}>Cached dumps</Text>
        </View>
      </View>

      {pagedDirectoryItems.length > 0 ? (
        pagedDirectoryItems.map((item) => (
          <DirectoryCatalogueCard
            key={item.catalogueId}
            pullDisabled={downloadsDisabled}
            downloadProgressPercent={
              item.catalogueId === downloadingCatalogueId ? downloadProgressPercent : null
            }
            isDownloading={item.catalogueId === downloadingCatalogueId}
            item={item}
            onOpenDump={(catalogueId: string) => {
              void openDump(catalogueId);
            }}
            onPull={(target: DirectoryItem) => {
              void pullSingleCatalogue(target);
            }}
          />
        ))
      ) : (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.bodyText}>
            No catalogue entries are visible. Refresh the site list or disable the expired filter in Settings.
          </Text>
        </View>
      )}

      <PaginationControls
        onPageChange={handlePageChange}
        page={cataloguePage}
        pageSize={CATALOGUE_PAGE_SIZE}
        totalItems={directoryItems.length}
      />

      {syncSummary ? (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.cardTitle}>Last download summary</Text>
          <Text style={sharedStyles.bodyText}>
            Exported {syncSummary.exportedCount}, skipped {syncSummary.skippedCount}, failed{" "}
            {syncSummary.failedCount}.
          </Text>
          {syncSummary.results.slice(0, 10).map((item) => (
            <View key={item.catalogueId} style={styles.summaryRow}>
              <Text style={styles.summaryTitle}>{item.catalogueSlug}</Text>
              <Text style={sharedStyles.metaText}>
                {item.status} | {item.barcodesFound}/{item.itemCount} barcodes
              </Text>
              {(item.catalogueStartDate || item.catalogueEndDate) ? (
                <Text style={sharedStyles.metaText}>
                  {formatDateRange(item.catalogueStartDate, item.catalogueEndDate)}
                </Text>
              ) : null}
              {item.message ? <Text style={sharedStyles.errorSmall}>{item.message}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: BRAND.blue,
    borderRadius: 20,
    padding: 14,
  },
  heroSecondaryButton: {
    backgroundColor: BRAND.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  heroSecondaryButtonText: {
    color: BRAND.blue,
    fontWeight: "800",
  },
  heroGhostButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#86aade",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  heroGhostButtonText: {
    color: "#dfeeff",
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  statCard: {
    flexGrow: 1,
    minWidth: 100,
    backgroundColor: BRAND.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
    color: BRAND.blue,
  },
  statLabel: {
    marginTop: 6,
    fontSize: 13,
    color: BRAND.slate,
  },
  summaryRow: {
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
    paddingTop: 12,
    marginTop: 8,
    gap: 2,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: BRAND.ink,
  },
});
