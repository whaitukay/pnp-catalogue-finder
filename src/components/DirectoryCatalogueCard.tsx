import React, { useEffect, useState } from "react";
import {
  Animated,
  Image,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const safeAreaInsets = useSafeAreaInsets();
  const timingStatus = getCatalogueTimingStatus(
    item.promotionStartDate,
    item.promotionEndDate,
  );
  const [thumbnailLoadFailed, setThumbnailLoadFailed] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);

  const hasThumbnailUrl = Boolean(item.catalogueImageUrl);
  const showThumbnail = hasThumbnailUrl && !thumbnailLoadFailed;

  useEffect(() => {
    setThumbnailLoadFailed(false);
    setPreviewVisible(false);
  }, [item.catalogueImageUrl]);

  const previewCloseButtonStyle = [
    styles.previewCloseButton,
    {
      top: safeAreaInsets.top + 16,
      right: safeAreaInsets.right + 16,
    },
  ];

  return (
    <View style={sharedStyles.card}>
      <View style={sharedStyles.cardHeaderRow}>
        <View style={sharedStyles.cardHeaderText}>
          <View style={styles.titleRow}>
            {hasThumbnailUrl ? (
              showThumbnail ? (
                <>
                  <Pressable
                    onPress={() => setPreviewVisible(true)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.label} thumbnail`}
                    accessibilityHint="Tap to open full screen preview"
                  >
                    <Image
                      source={{ uri: item.catalogueImageUrl!, cache: "force-cache" }}
                      style={styles.thumbnail}
                      resizeMode="cover"
                      onError={() => {
                        setThumbnailLoadFailed(true);
                        setPreviewVisible(false);
                      }}
                    />
                  </Pressable>
                  {previewVisible ? (
                    <Modal
                      transparent
                      animationType="fade"
                      visible
                      onRequestClose={() => setPreviewVisible(false)}
                    >
                      <View style={styles.previewOverlay}>
                        <Pressable
                          style={styles.previewBackdrop}
                          onPress={() => setPreviewVisible(false)}
                          accessibilityRole="button"
                          accessibilityLabel="Close image preview"
                        />
                        <ZoomableImage
                          uri={item.catalogueImageUrl!}
                          width={viewportWidth}
                          height={viewportHeight}
                          accessibilityLabel={`${item.label} thumbnail preview`}
                        />
                        <Pressable
                          onPress={() => setPreviewVisible(false)}
                          style={previewCloseButtonStyle}
                          hitSlop={12}
                          accessibilityRole="button"
                          accessibilityLabel="Close image preview"
                        >
                          <Text style={styles.previewCloseButtonText}>X</Text>
                        </Pressable>
                      </View>
                    </Modal>
                  ) : null}
                </>
              ) : (
                <View style={styles.thumbnail} />
              )
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance(
  a: { pageX: number; pageY: number },
  b: { pageX: number; pageY: number },
): number {
  const dx = a.pageX - b.pageX;
  const dy = a.pageY - b.pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

type ZoomableImageProps = {
  uri: string;
  width: number;
  height: number;
  accessibilityLabel: string;
};

function ZoomableImage({
  uri,
  width,
  height,
  accessibilityLabel,
}: ZoomableImageProps): React.ReactElement {
  const minScale = 1;
  const maxScale = 4;

  const scale = React.useRef(new Animated.Value(1)).current;
  const translateX = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(0)).current;

  const currentScale = React.useRef(1);
  const currentTranslate = React.useRef({ x: 0, y: 0 });

  const pinchStartDistance = React.useRef<number | null>(null);
  const pinchStartScale = React.useRef(1);
  const gestureWasPinch = React.useRef(false);
  const didPanAfterPinch = React.useRef(false);

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          pinchStartDistance.current = null;
          pinchStartScale.current = currentScale.current;
          gestureWasPinch.current = false;
          didPanAfterPinch.current = false;
        },
        onPanResponderMove: (evt, gestureState) => {
          const touches = evt.nativeEvent.touches;

          if (touches.length >= 2) {
            gestureWasPinch.current = true;
            const nextDistance = distance(touches[0], touches[1]);
            if (pinchStartDistance.current == null) {
              pinchStartDistance.current = nextDistance;
              pinchStartScale.current = currentScale.current;
              return;
            }

            const nextScale = clamp(
              pinchStartScale.current *
                (nextDistance / pinchStartDistance.current),
              minScale,
              maxScale,
            );

            scale.setValue(nextScale);
            currentScale.current = nextScale;
            return;
          }

          pinchStartDistance.current = null;
          if (currentScale.current <= 1.01) {
            translateX.setValue(0);
            translateY.setValue(0);
            currentTranslate.current = { x: 0, y: 0 };
            return;
          }

          if (gestureWasPinch.current) {
            didPanAfterPinch.current = true;
          }

          const maxOffsetX = (width * (currentScale.current - 1)) / 2;
          const maxOffsetY = (height * (currentScale.current - 1)) / 2;

          const nextX = clamp(
            currentTranslate.current.x + gestureState.dx,
            -maxOffsetX,
            maxOffsetX,
          );
          const nextY = clamp(
            currentTranslate.current.y + gestureState.dy,
            -maxOffsetY,
            maxOffsetY,
          );

          translateX.setValue(nextX);
          translateY.setValue(nextY);
        },
        onPanResponderRelease: (_evt, gestureState) => {
          if (gestureWasPinch.current && !didPanAfterPinch.current) {
            gestureWasPinch.current = false;
            pinchStartDistance.current = null;
            didPanAfterPinch.current = false;
            return;
          }

          gestureWasPinch.current = false;
          didPanAfterPinch.current = false;
          pinchStartDistance.current = null;

          if (currentScale.current <= 1.01) {
            currentScale.current = 1;
            currentTranslate.current = { x: 0, y: 0 };
            scale.setValue(1);
            translateX.setValue(0);
            translateY.setValue(0);
            return;
          }

          const maxOffsetX = (width * (currentScale.current - 1)) / 2;
          const maxOffsetY = (height * (currentScale.current - 1)) / 2;

          currentTranslate.current = {
            x: clamp(
              currentTranslate.current.x + gestureState.dx,
              -maxOffsetX,
              maxOffsetX,
            ),
            y: clamp(
              currentTranslate.current.y + gestureState.dy,
              -maxOffsetY,
              maxOffsetY,
            ),
          };

          translateX.setValue(currentTranslate.current.x);
          translateY.setValue(currentTranslate.current.y);
        },
      }),
    [height, width],
  );

  return (
    <View style={styles.previewImageContainer}>
      <Animated.View
        {...panResponder.panHandlers}
        style={{
          width,
          height,
          transform: [
            { translateX },
            { translateY },
            { scale },
          ],
        }}
      >
        <Image
          source={{ uri, cache: "force-cache" }}
          style={{ width, height }}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel={accessibilityLabel}
        />
      </Animated.View>
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
    backgroundColor: "rgba(0, 0, 0, 0.92)",
  },
  previewBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  previewImageContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  previewCloseButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
  },
  previewCloseButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 20,
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
