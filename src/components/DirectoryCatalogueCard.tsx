import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { sharedStyles } from "../theme";
import {
  formatDateStampRange,
  getCatalogueTimingStatus,
} from "../utils/catalogueUi";
import type { DirectoryItem } from "../utils/catalogueUi";
import { StatusBadge } from "./StatusBadge";

type DirectoryCatalogueCardProps = {
  item: DirectoryItem;
  onPull: (item: DirectoryItem) => void;
  onOpenDump: (catalogueId: string) => void;
};

/**
 * Render a card view for a directory catalogue item with status badges, metadata, and action buttons.
 *
 * Displays the catalogue's title, timing and source/cache status as badges, the catalogue date range, and action controls:
 * the primary action triggers a pull for the item, an optional "Open dump" button invokes a dump-open callback when the item is cached, and an optional link opens the catalogue's source URL.
 *
 * @param item - The catalogue item to display, including label, date ranges, sourceUrl, cache/site flags, and catalogueId.
 * @param onPull - Callback invoked with the `item` when the primary action (download/refresh) is pressed.
 * @param onOpenDump - Callback invoked with the item's `catalogueId` when "Open dump" is pressed (rendered only when the item is cached).
 * @returns A React element representing the catalogue card.
 */
export function DirectoryCatalogueCard({
  item,
  onPull,
  onOpenDump,
}: DirectoryCatalogueCardProps): React.ReactElement {
  const timingStatus = getCatalogueTimingStatus(
    item.promotionStartDate,
    item.promotionEndDate,
  );

  return (
    <View style={sharedStyles.card}>
      <View style={sharedStyles.cardHeaderRow}>
        <View style={sharedStyles.cardHeaderText}>
          <Text style={sharedStyles.cardTitle}>{item.label}</Text>
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
        {item.catalogueStartDate} to {item.catalogueEndDate}
      </Text>
      <View style={sharedStyles.buttonRow}>
        <Pressable onPress={() => onPull(item)} style={sharedStyles.primaryButton}>
          <Text style={sharedStyles.primaryButtonText}>
            {item.fromCache ? "Refresh" : "Download"}
          </Text>
        </Pressable>
        {item.fromCache ? (
          <Pressable
            onPress={() => onOpenDump(item.catalogueId)}
            style={sharedStyles.secondaryButton}
          >
            <Text style={sharedStyles.secondaryButtonText}>Open dump</Text>
          </Pressable>
        ) : null}
        {item.sourceUrl ? (
          <Pressable
            onPress={() => {
              void Linking.openURL(item.sourceUrl);
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

const styles = StyleSheet.create({
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
