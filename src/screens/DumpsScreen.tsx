import React from "react";
import {
  AccessibilityInfo,
  Image,
  LayoutAnimation,
  KeyboardAvoidingView,
  Linking,
  Platform,
  PixelRatio,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import type { LayoutAnimationConfig } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as bwipjs from "@bwip-js/react-native";

import { PaginationControls } from "../components/PaginationControls";
import { StatusBadge } from "../components/StatusBadge";
import { sharedStyles } from "../theme";
import type { CatalogueDump, ProductRow } from "../types";
import {
  ean13ToRawSbs,
  isScaleItemEan13,
  normalizeBarcodeForRendering,
} from "../utils/barcodes";
import { formatDateStamp, getCatalogueTimingStatus } from "../utils/catalogueUi";

if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

type DumpsScreenProps = {
  selectedDump: CatalogueDump;
  dumpSearch: string;
  filteredDumpRows: ProductRow[];
  pagedDumpRows: ProductRow[];
  dumpRowsPage: number;
  onBackToCatalogues: () => void;
  onEmailDump: (catalogueId: string) => void;
  onDumpSearchChange: (value: string) => void;
  onDumpRowsPageChange: (nextPage: number) => void;
};

export function DumpsScreen({
  selectedDump,
  dumpSearch,
  filteredDumpRows,
  pagedDumpRows,
  dumpRowsPage,
  onBackToCatalogues,
  onEmailDump,
  onDumpSearchChange,
  onDumpRowsPageChange,
}: DumpsScreenProps): React.ReactElement {
  const selectedDumpTiming = getCatalogueTimingStatus(
    selectedDump.catalogueStartDate,
    selectedDump.catalogueEndDate,
  );

  const insets = useSafeAreaInsets();

  const [isSearchFocused, setIsSearchFocused] = React.useState(false);
  const [reduceMotionEnabled, setReduceMotionEnabled] = React.useState(true);
  const scrollRef = React.useRef<React.ElementRef<typeof ScrollView>>(null);
  const searchInputRef = React.useRef<React.ElementRef<typeof TextInput>>(null);
  const searchQueryRef = React.useRef(dumpSearch);
  const isAndroid = Platform.OS === "android";
  const hasSearchQuery = dumpSearch.trim().length > 0;
  const isSearching = isSearchFocused || hasSearchQuery;

  React.useEffect(() => {
    searchQueryRef.current = dumpSearch;
  }, [dumpSearch]);

  const handleDumpSearchChange = React.useCallback(
    (value: string) => {
      searchQueryRef.current = value;
      onDumpSearchChange(value);
    },
    [onDumpSearchChange],
  );

  React.useEffect(() => {
    if (!isAndroid) {
      return;
    }

    let mounted = true;
    let subscription: { remove: () => void } | undefined;

    void AccessibilityInfo.isReduceMotionEnabled().then((value: boolean) => {
      if (mounted) {
        setReduceMotionEnabled(value);
      }
    });

    if (typeof AccessibilityInfo.addEventListener === "function") {
      subscription = AccessibilityInfo.addEventListener(
        "reduceMotionChanged",
        (value: boolean) => {
          setReduceMotionEnabled(value);
        },
      );
    }

    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);

  const animateLayout = React.useCallback(() => {
    if (reduceMotionEnabled || !isAndroid) {
      return;
    }

    LayoutAnimation.configureNext(SEARCH_LAYOUT_ANIMATION);
  }, [isAndroid, reduceMotionEnabled]);

  const handleSearchFocus = React.useCallback(() => {
    animateLayout();
    setIsSearchFocused(true);
    scrollRef.current?.scrollTo({ y: 0, animated: !reduceMotionEnabled });
  }, [animateLayout, reduceMotionEnabled]);

  const handleSearchBlur = React.useCallback(() => {
    const hasSearchQueryNow = searchQueryRef.current.trim().length > 0;

    if (!hasSearchQueryNow) {
      animateLayout();
    }

    setIsSearchFocused(false);
  }, [animateLayout]);

  const handleSearchDone = React.useCallback(() => {
    searchInputRef.current?.blur();
  }, []);

  const handleSearchClear = React.useCallback(() => {
    animateLayout();
    handleDumpSearchChange("");
  }, [animateLayout, handleDumpSearchChange]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={insets.top}
      style={sharedStyles.flex}
    >
      <ScrollView
        contentContainerStyle={sharedStyles.content}
        ref={scrollRef}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        keyboardShouldPersistTaps="handled"
        style={sharedStyles.flex}
      >
        {!isSearching ? (
          <>
            <View style={sharedStyles.buttonRow}>
              <Pressable onPress={onBackToCatalogues} style={sharedStyles.secondaryButton}>
                <Text style={sharedStyles.secondaryButtonText}>Back to catalogues</Text>
              </Pressable>
              <Pressable
                onPress={() => onEmailDump(selectedDump.catalogueId)}
                style={sharedStyles.primaryButton}
              >
                <Text style={sharedStyles.primaryButtonText}>Email this CSV</Text>
              </Pressable>
            </View>

            <View style={sharedStyles.card}>
              <View style={sharedStyles.cardHeaderRow}>
                <View style={sharedStyles.cardHeaderText}>
                  <Text style={sharedStyles.cardTitle}>{selectedDump.label}</Text>
                </View>
                {selectedDumpTiming === "active" ? (
                  <StatusBadge label="Active" variant="success" />
                ) : null}
                {selectedDumpTiming === "future" ? (
                  <StatusBadge label="Future" variant="warning" />
                ) : null}
                {selectedDumpTiming === "expired" ? (
                  <StatusBadge label="Expired" variant="danger" />
                ) : null}
              </View>
              <View style={styles.summaryRow}>
                <Text style={sharedStyles.metaText}>Items</Text>
                <Text style={[sharedStyles.metaText, styles.summaryValue]}>
                  {selectedDump.itemCount ?? selectedDump.rows.length}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={sharedStyles.metaText}>Start</Text>
                <Text style={[sharedStyles.metaText, styles.summaryValue]}>
                  {formatDateStamp(selectedDump.catalogueStartDate)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={sharedStyles.metaText}>End</Text>
                <Text style={[sharedStyles.metaText, styles.summaryValue]}>
                  {formatDateStamp(selectedDump.catalogueEndDate)}
                </Text>
              </View>
              {selectedDump.sourceUrl ? (
                <Pressable
                  onPress={() => {
                    void Linking.openURL(selectedDump.sourceUrl).catch((error: unknown) => {
                      console.warn("Failed to open catalogue URL", error);
                    });
                  }}
                  style={sharedStyles.secondaryButton}
                >
                  <Text style={sharedStyles.secondaryButtonText}>View on website</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}

        <View style={sharedStyles.card}>
          <View style={styles.searchTitleRow}>
            <Text style={sharedStyles.cardTitle}>Search this dump</Text>
            {isSearchFocused ? (
              <Pressable hitSlop={10} onPress={handleSearchDone}>
                <Text style={sharedStyles.linkText}>Done</Text>
              </Pressable>
            ) : hasSearchQuery ? (
              <Pressable hitSlop={10} onPress={handleSearchClear}>
                <Text style={sharedStyles.linkText}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            blurOnSubmit
            onBlur={handleSearchBlur}
            onChangeText={handleDumpSearchChange}
            onFocus={handleSearchFocus}
            onSubmitEditing={handleSearchDone}
            ref={searchInputRef}
            returnKeyType="done"
            style={sharedStyles.input}
            value={dumpSearch}
          />
          <Text style={sharedStyles.metaText}>
            Showing {filteredDumpRows.length} of {selectedDump.rows.length} item(s).
          </Text>
        </View>

        {pagedDumpRows.length > 0 ? (
          pagedDumpRows.map((row) => <DumpRowCard key={row.position} row={row} />)
        ) : (
          <View style={sharedStyles.card}>
            <Text style={sharedStyles.bodyText}>No items match that search.</Text>
          </View>
        )}

        <PaginationControls
          onPageChange={onDumpRowsPageChange}
          page={dumpRowsPage}
          pageSize={24}
          totalItems={filteredDumpRows.length}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  searchTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryValue: {
    fontWeight: "800",
  },
  dumpRowCardRow: {
    flexDirection: "row",
    gap: 12,
  },
  dumpRowCardDetails: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  dumpRowCardBarcode: {
    flex: 1,
    minWidth: 0,
    minHeight: 72,
    alignItems: "flex-end",
    justifyContent: "flex-end",
  },
});

const SEARCH_LAYOUT_ANIMATION = {
  duration: 250,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
} satisfies LayoutAnimationConfig;

function DumpRowCard({ row }: { row: ProductRow }): React.ReactElement {
  const rawBarcode = typeof row.barcode === "string" ? row.barcode : "";
  const hasBarcodeDigits = /\d/.test(rawBarcode);
  const normalizedBarcode = React.useMemo(
    () => normalizeBarcodeForRendering(rawBarcode),
    [rawBarcode],
  );
  const [barcodeError, setBarcodeError] = React.useState(false);
  const barcodeToShow = barcodeError ? null : normalizedBarcode;
  const handleBarcodeError = React.useCallback(() => {
    setBarcodeError(true);
  }, []);

  React.useEffect(() => {
    setBarcodeError(false);
  }, [rawBarcode, normalizedBarcode?.format, normalizedBarcode?.value]);

  return (
    <View style={sharedStyles.card}>
      <Text numberOfLines={2} style={sharedStyles.cardTitle}>
        {row.name || row.productCode}
      </Text>
      <View style={styles.dumpRowCardRow}>
        <View style={styles.dumpRowCardDetails}>
          {row.baseProduct ? (
            <Text style={sharedStyles.metaText}>Base product: {+row.baseProduct}</Text>
          ) : null}
          {row.price ? <Text style={sharedStyles.metaText}>Price: {row.price}</Text> : null}
          {row.promotion ? <Text style={sharedStyles.bodyText}>{row.promotion}</Text> : null}
          {hasBarcodeDigits && (!normalizedBarcode || barcodeError) ? (
            <Text style={sharedStyles.metaText}>Barcode not scannable</Text>
          ) : null}
          {!hasBarcodeDigits ? <Text style={sharedStyles.metaText}>Barcode missing</Text> : null}
          {row.error ? <Text style={sharedStyles.errorSmall}>{row.error}</Text> : null}
        </View>
        {barcodeToShow ? (
          <View style={styles.dumpRowCardBarcode}>
            <BarcodeImage
              format={barcodeToShow.format}
              onError={handleBarcodeError}
              value={barcodeToShow.value}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function BarcodeImage({
  format,
  value,
  onError,
}: {
  format: "EAN13" | "EAN8";
  value: string;
  onError: () => void;
}): React.ReactElement | null {
  const [source, setSource] = React.useState<bwipjs.DataURL | null>(null);

  React.useEffect(() => {
    const scale = Math.max(1, Math.round(PixelRatio.get()));
    const isScaleCode = format === "EAN13" && isScaleItemEan13(value);
    const rawSbs = isScaleCode ? ean13ToRawSbs(value) : null;
    const bcid = format === "EAN8" ? "ean8" : isScaleCode ? "raw" : "ean13";
    if (isScaleCode && !rawSbs) {
      setSource(null);
      onError();
      return;
    }

    const options: Parameters<typeof bwipjs.toDataURL>[0] = {
      bcid,
      text: isScaleCode ? rawSbs! : value,
      scale,
      height: 12,
      includetext: true,
      ...(isScaleCode ? { alttext: value } : {}),
    };

    const cacheKey = `${bcid}:${options.text}:${scale}`;
    const cachedSource = getBarcodeImageFromCache(cacheKey);
    if (cachedSource) {
      setSource(cachedSource);
      return;
    }

    let cancelled = false;
    setSource(null);

    bwipjs
      .toDataURL(options)
      .then((nextSource: bwipjs.DataURL) => {
        putBarcodeImageInCache(cacheKey, nextSource);

        if (!cancelled) {
          setSource(nextSource);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.warn(`Failed to generate barcode image (${format})`, {
            valueLength: value.length,
            error,
          });
          onError();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [format, value, onError]);

  if (!source) {
    return null;
  }

  return (
    <Image
      resizeMode="contain"
      source={{ uri: source.uri }}
      style={{
        width: "100%",
        height: 72,
      }}
    />
  );
}

// Keep this small: `bwipjs.toDataURL()` returns a base64 `data:` URI, which can be memory-heavy.
const BARCODE_IMAGE_CACHE_LIMIT = 100;
const barcodeImageCache = new Map<string, bwipjs.DataURL>();

function getBarcodeImageFromCache(key: string): bwipjs.DataURL | null {
  const cached = barcodeImageCache.get(key);
  if (!cached) {
    return null;
  }

  barcodeImageCache.delete(key);
  barcodeImageCache.set(key, cached);
  return cached;
}

function putBarcodeImageInCache(key: string, value: bwipjs.DataURL): void {
  barcodeImageCache.set(key, value);
  if (barcodeImageCache.size > BARCODE_IMAGE_CACHE_LIMIT) {
    const keyToEvict = barcodeImageCache.keys().next().value;
    if (typeof keyToEvict === "string") {
      barcodeImageCache.delete(keyToEvict);
    }
  }
}

