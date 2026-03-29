import React, { useState } from "react";
import {
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BRAND, sharedStyles } from "../theme";
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
  const [thumbnailLoadFailed, setThumbnailLoadFailed] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);

  const canShowThumbnail = Boolean(item.catalogueImageUrl) && !thumbnailLoadFailed;

  return (
    <View style={sharedStyles.card}>
      <View style={sharedStyles.cardHeaderRow}>
        <View style={sharedStyles.cardHeaderText}>
          <View style={styles.titleRow}>
            {canShowThumbnail ? (
              <>
                <Pressable
                  delayLongPress={2000}
                  onLongPress={() => setPreviewVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.label} thumbnail`}
                  accessibilityHint="Long press to preview full screen"
                >
                  <Image
                    source={{ uri: item.catalogueImageUrl!, cache: "force-cache" }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                    onError={() => setThumbnailLoadFailed(true)}
                  />
                </Pressable>
                <Modal
                  transparent
                  animationType="fade"
                  visible={previewVisible}
                  onRequestClose={() => setPreviewVisible(false)}
                >
                  <Pressable
                    style={styles.previewOverlay}
                    onPress={() => setPreviewVisible(false)}
                  >
                    <Image
                      source={{ uri: item.catalogueImageUrl!, cache: "force-cache" }}
                      style={styles.previewImage}
                      resizeMode="contain"
                      accessibilityRole="image"
                      accessibilityLabel={`${item.label} thumbnail preview`}
                    />
                  </Pressable>
                </Modal>
              </>
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  titleText: {
    flexShrink: 1,
  },
  thumbnail: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.blueSoft,
  },
  previewOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    padding: 16,
  },
  previewImage: {
    width: "100%",
    height: "100%",
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
