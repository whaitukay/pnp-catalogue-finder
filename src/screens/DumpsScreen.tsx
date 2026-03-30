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
  const isAndroid = Platform.OS === "android";

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
    animateLayout();
    setIsSearchFocused(false);
  }, [animateLayout]);

  const handleSearchDone = React.useCallback(() => {
    searchInputRef.current?.blur();
  }, []);

  const handleSearchClear = React.useCallback(() => {
    animateLayout();
    onDumpSearchChange("");
    searchInputRef.current?.blur();
  }, [animateLayout, onDumpSearchChange]);

  const hasQuery = dumpSearch.trim().length > 0;
  const isSearching = isSearchFocused || hasQuery;

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
            ) : hasQuery ? (
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
            onChangeText={onDumpSearchChange}
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
  duration: 180,
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
  const barcodeDigits = rawBarcode.replace(/\D/g, "");
  const hasBarcodeDigits = barcodeDigits.length > 0;
  const normalizedBarcode = React.useMemo(() => normalizeEan(barcodeDigits), [barcodeDigits]);
  const [barcodeError, setBarcodeError] = React.useState(false);
  const barcodeToShow = barcodeError ? null : normalizedBarcode;
  const handleBarcodeError = React.useCallback(() => {
    setBarcodeError(true);
  }, []);

  React.useEffect(() => {
    setBarcodeError(false);
  }, [normalizedBarcode?.format, normalizedBarcode?.value]);

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
            <EanBarcode
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

function EanBarcode({
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
    const cacheKey = `${format}:${value}:${scale}`;
    const cachedSource = getBarcodeImageFromCache(cacheKey);
    if (cachedSource) {
      setSource(cachedSource);
      return;
    }

    let cancelled = false;
    setSource(null);

    bwipjs
      .toDataURL({
        bcid: format === "EAN13" ? "ean13" : "ean8",
        text: value,
        scale,
        height: 12,
        includetext: true,
      })
      .then((nextSource: bwipjs.DataURL) => {
        putBarcodeImageInCache(cacheKey, nextSource);

        if (!cancelled) {
          setSource(nextSource);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.warn("Failed to generate barcode image", {
            format,
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

function normalizeEan(
  value: string,
): { format: "EAN13" | "EAN8"; value: string } | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 13) {
    const body = digits.slice(0, 12);
    const checkDigit = digits[12];
    if (checkDigit !== ean13CheckDigit(body)) {
      return null;
    }

    return { format: "EAN13", value: digits };
  }

  if (digits.length === 12) {
    // Prefer interpreting 12 digits as a full UPC-A (including check digit) and normalizing to EAN-13.
    // Otherwise, treat the 12 digits as an EAN-13 body missing its check digit.
    const upcBody = digits.slice(0, 11);
    const upcCheckDigit = digits[11];
    if (upcCheckDigit === upcACheckDigit(upcBody)) {
      return { format: "EAN13", value: `0${digits}` };
    }

    return { format: "EAN13", value: `${digits}${ean13CheckDigit(digits)}` };
  }

  if (digits.length === 8) {
    const body = digits.slice(0, 7);
    const checkDigit = digits[7];
    if (checkDigit !== ean8CheckDigit(body)) {
      return null;
    }

    return { format: "EAN8", value: digits };
  }

  if (digits.length === 7) {
    return { format: "EAN8", value: `${digits}${ean8CheckDigit(digits)}` };
  }

  return null;
}

function ean13CheckDigit(twelveDigits: string): string {
  let sum = 0;
  for (let index = 0; index < 12; index += 1) {
    const digit = Number(twelveDigits[index]);
    sum += digit * (index % 2 === 0 ? 1 : 3);
  }

  return String((10 - (sum % 10)) % 10);
}

function upcACheckDigit(elevenDigits: string): string {
  let sum = 0;
  for (let index = 0; index < 11; index += 1) {
    const digit = Number(elevenDigits[index]);
    sum += digit * (index % 2 === 0 ? 3 : 1);
  }

  return String((10 - (sum % 10)) % 10);
}

function ean8CheckDigit(sevenDigits: string): string {
  let sum = 0;
  for (let index = 0; index < 7; index += 1) {
    const digit = Number(sevenDigits[index]);
    sum += digit * (index % 2 === 0 ? 3 : 1);
  }

  return String((10 - (sum % 10)) % 10);
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

