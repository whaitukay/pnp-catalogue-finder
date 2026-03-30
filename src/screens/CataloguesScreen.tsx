import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { DirectoryCatalogueCard } from "../components/DirectoryCatalogueCard";
import { PaginationControls } from "../components/PaginationControls";
import { BRAND, sharedStyles } from "../theme";
import type { SyncSummary } from "../types";
import type { DirectoryItem } from "../utils/catalogueUi";
import { formatDateRange } from "../utils/catalogueUi";
import { clampPercent } from "../utils/progressUi";

type CataloguesScreenProps = {
  downloadingCatalogueId: string | null;
  downloadProgressPercent: number | null;
  isBulkDownloading: boolean;
  bulkDownloadProgressPercent: number | null;
  hideExpiredCatalogues: boolean;
  siteCount: number;
  cachedCount: number;
  directoryItems: DirectoryItem[];
  pagedDirectoryItems: DirectoryItem[];
  cataloguePage: number;
  syncSummary: SyncSummary | null;
  onRefreshList: () => void;
  onPullAll: () => void;
  onForceRefresh: () => void;
  onPullItem: (item: DirectoryItem) => void;
  onOpenDump: (catalogueId: string) => void;
  onCataloguePageChange: (nextPage: number) => void;
};

export function CataloguesScreen({
  downloadingCatalogueId,
  downloadProgressPercent,
  isBulkDownloading,
  bulkDownloadProgressPercent,
  hideExpiredCatalogues,
  siteCount,
  cachedCount,
  directoryItems,
  pagedDirectoryItems,
  cataloguePage,
  syncSummary,
  onRefreshList,
  onPullAll,
  onForceRefresh,
  onPullItem,
  onOpenDump,
  onCataloguePageChange,
}: CataloguesScreenProps): React.ReactElement {
  const downloadsDisabled = Boolean(downloadingCatalogueId) || isBulkDownloading;
  const pullAllLabel = "Download all";
  const bulkProgressPercent = clampPercent(bulkDownloadProgressPercent);

  return (
    <ScrollView contentContainerStyle={sharedStyles.content}>
      <View style={styles.heroCard}>
        <View style={sharedStyles.buttonRow}>
          <Pressable onPress={onRefreshList} style={styles.heroSecondaryButton}>
            <Text style={styles.heroSecondaryButtonText}>Refresh list</Text>
          </Pressable>
          <Pressable
            disabled={downloadsDisabled}
            onPress={onPullAll}
            style={[styles.heroPrimaryButton, downloadsDisabled && styles.heroPrimaryButtonDisabled]}
          >
            <Text style={[styles.heroPrimaryButtonText, styles.heroPrimaryButtonGhostLabel]}>
              {pullAllLabel}
            </Text>

            {isBulkDownloading ? (
              <View
                pointerEvents="none"
                style={[
                  styles.heroPrimaryButtonFillClip,
                  { width: `${bulkProgressPercent}%` },
                ]}
              >
                <LinearGradient
                  colors={[BRAND.redDark, BRAND.red]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.heroPrimaryButtonFillGradient}
                />
              </View>
            ) : null}

            <View pointerEvents="none" style={styles.heroPrimaryButtonOverlay}>
              <Text style={styles.heroPrimaryButtonText}>
                {isBulkDownloading ? `${Math.round(bulkProgressPercent)}%` : pullAllLabel}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{directoryItems.length}</Text>
          <Text style={styles.statLabel}>Visible catalogues</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{siteCount}</Text>
          <Text style={styles.statLabel}>Live on site</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{cachedCount}</Text>
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
            onOpenDump={onOpenDump}
            onPull={onPullItem}
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
        onPageChange={onCataloguePageChange}
        page={cataloguePage}
        pageSize={8}
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
  heroPrimaryButton: {
    backgroundColor: BRAND.red,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  heroPrimaryButtonGhostLabel: {
    opacity: 0,
  },
  heroPrimaryButtonFillClip: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
  },
  heroPrimaryButtonFillGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroPrimaryButtonOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  heroPrimaryButtonDisabled: {
    opacity: 0.65,
  },
  heroPrimaryButtonText: {
    color: BRAND.white,
    fontWeight: "800",
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
