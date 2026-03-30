import React from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  LayoutAnimation,
  KeyboardAvoidingView,
  Linking,
  Platform,
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
import { BarcodeImage } from "../components/BarcodeImage";
import { PaginationControls } from "../components/PaginationControls";
import { StatusBadge } from "../components/StatusBadge";
import { BRAND, sharedStyles } from "../theme";
import type { CatalogueDump, ProductRow } from "../types";
import {
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
  isGeneratingCsv: boolean;
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
  isGeneratingCsv,
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
                disabled={isGeneratingCsv}
                onPress={() => onEmailDump(selectedDump.catalogueId)}
                style={[
                  sharedStyles.primaryButton,
                  isGeneratingCsv ? styles.emailButtonDisabled : null,
                ]}
              >
                <View style={styles.emailButtonRow}>
                  {isGeneratingCsv ? (
                    <ActivityIndicator color={BRAND.white} size="small" />
                  ) : null}
                  <Text style={sharedStyles.primaryButtonText}>
                    {isGeneratingCsv ? "Building CSV..." : "Email this CSV"}
                  </Text>
                </View>
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
  emailButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emailButtonDisabled: {
    opacity: 0.7,
  },
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

