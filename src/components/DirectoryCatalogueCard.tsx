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
