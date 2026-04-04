import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { sharedStyles } from "../theme";
import {
  formatDateStampRange,
  getCatalogueTimingStatus,
} from "../utils/catalogueUi";
import type { DirectoryItem } from "../utils/catalogueUi";
import { CatalogueThumbnail } from "./CatalogueThumbnail";
import { ProgressButton } from "./ProgressButton";
import { StatusBadge } from "./StatusBadge";

type DirectoryCatalogueCardProps = {
  item: DirectoryItem;
  isDownloading: boolean;
  downloadProgressPercent: number | null;
  pullDisabled: boolean;
  onPull: (item: DirectoryItem) => void;
  onOpenDump: (catalogueId: string) => void;
};

/**
 * Render a card view for a directory catalogue item with status badges, metadata, and action buttons.
 *
 * Displays the catalogue's title, timing and source/cache status as badges, the catalogue date range, and action controls:
* the primary action triggers a pull for the item, an optional "View" button invokes a dump-open callback when the item is cached, and an optional link opens the catalogue's source URL.
 *
 * @param item - The catalogue item to display, including label, date ranges, sourceUrl, cache/site flags, and catalogueId.
* @param isDownloading - When true, shows a progress label and fill in the download button.
* @param downloadProgressPercent - Download progress percent for the item currently being pulled.
* @param pullDisabled - When true, disables the download button.
 * @param onPull - Callback invoked with the `item` when the primary action (download/refresh) is pressed.
* @param onOpenDump - Callback invoked with the item's `catalogueId` when "View" is pressed (rendered only when the item is cached).
 * @returns A React element representing the catalogue card.
 */
function DirectoryCatalogueCardBase({
  item,
  isDownloading,
  downloadProgressPercent,
  pullDisabled,
  onPull,
  onOpenDump,
}: DirectoryCatalogueCardProps): React.ReactElement {
  const timingStatus = getCatalogueTimingStatus(
    item.catalogueStartDate,
    item.catalogueEndDate,
  );

  const hasThumbnailUrl = Boolean(item.catalogueImageUrl);
  const pullButtonLabel = item.fromCache ? "Refresh" : "Download";

  return (
    <View style={sharedStyles.card}>
      <View style={sharedStyles.cardHeaderRow}>
        <View style={sharedStyles.cardHeaderText}>
          <View style={styles.titleRow}>
            {hasThumbnailUrl ? (
              <CatalogueThumbnail
                uri={item.catalogueImageUrl}
                size={36}
                accessibilityLabel={`${item.label} thumbnail`}
              />
            ) : null}
            <Text style={[sharedStyles.cardTitle, styles.titleText]}>{item.label}</Text>
          </View>
        </View>
        <View style={styles.badges}>
          {item.fromSite ? <StatusBadge label="Live" variant="primary" /> : null}
          {item.fromCache ? <StatusBadge label="Cached" variant="secondary" /> : null}
          {timingStatus === "active" ? (
            <StatusBadge label="Active" variant="success" />
          ) : null}
          {timingStatus === "future" ? (
            <StatusBadge label="Future" variant="warning" />
          ) : null}
          {timingStatus === "expired" ? (
            <StatusBadge label="Expired" variant="danger" />
          ) : null}
        </View>
      </View>

      <Text style={sharedStyles.metaText}>
        {formatDateStampRange(item.catalogueStartDate, item.catalogueEndDate)}
      </Text>
      <View style={sharedStyles.buttonRow}>
        <ProgressButton
          disabled={pullDisabled}
          label={pullButtonLabel}
          onPress={() => onPull(item)}
          progress={isDownloading ? downloadProgressPercent : null}
          variant="primary"
        />
        {item.fromCache ? (
          <Pressable
            onPress={() => onOpenDump(item.catalogueId)}
            style={sharedStyles.secondaryButton}
          >
            <Text style={sharedStyles.secondaryButtonText}>View</Text>
          </Pressable>
        ) : null}
        {item.sourceUrl ? (
          <Pressable
            onPress={() => {
              void Linking.openURL(item.sourceUrl).catch((error: unknown) => {
                console.warn("Failed to open catalogue URL", error);
              });
            }}
            style={styles.linkButton}
          >
            <Text style={styles.linkButtonText}>(link)</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function directoryCatalogueCardPropsEqual(
  prev: DirectoryCatalogueCardProps,
  next: DirectoryCatalogueCardProps,
): boolean {
  return (
    prev.item === next.item &&
    prev.isDownloading === next.isDownloading &&
    prev.downloadProgressPercent === next.downloadProgressPercent &&
    prev.pullDisabled === next.pullDisabled &&
    prev.onPull === next.onPull &&
    prev.onOpenDump === next.onOpenDump
  );
}

export const DirectoryCatalogueCard = React.memo(
  DirectoryCatalogueCardBase,
  directoryCatalogueCardPropsEqual,
);

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  titleText: {
    flexShrink: 1,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "flex-end",
  },
  linkButton: {
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  linkButtonText: {
    color: "#004a98",
    fontWeight: "700",
  },
});
