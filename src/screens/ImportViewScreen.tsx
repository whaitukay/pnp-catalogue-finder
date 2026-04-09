import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { BarcodeImage } from "../components/BarcodeImage";
import { PaginationControls } from "../components/PaginationControls";
import { useImports, usePaginatedScroll } from "../hooks";
import { sharedStyles } from "../theme";
import type { ImportedItem } from "../types";
import { normalizeBarcodeForRendering } from "../utils/barcodes";
import { paginate } from "../utils/catalogueUi";
import { importItemMatchesSearch } from "../utils/importsUi";

const IMPORT_ITEMS_PAGE_SIZE = 24;

export function ImportViewScreen(): React.ReactElement | null {
  const { selectedImport, setSelectedImport } = useImports();
  const [importSearch, setImportSearch] = React.useState("");
  const [importPage, setImportPage] = React.useState(0);
  const { scrollRef, handlePageChange, resetToFirstPage } = usePaginatedScroll(setImportPage);

  React.useEffect(() => {
    setImportSearch("");
    resetToFirstPage();
  }, [selectedImport?.id, resetToFirstPage]);

  const filteredImportItems = React.useMemo(() => {
    if (!selectedImport) {
      return [];
    }

    return selectedImport.items.filter((item) =>
      importItemMatchesSearch(item, importSearch),
    );
  }, [importSearch, selectedImport]);

  const pagedImportItems = React.useMemo(() => {
    return paginate(filteredImportItems, importPage, IMPORT_ITEMS_PAGE_SIZE);
  }, [filteredImportItems, importPage]);

  React.useEffect(() => {
    resetToFirstPage();
  }, [importSearch, resetToFirstPage]);

  if (!selectedImport) {
    return null;
  }

  return (
    <ScrollView contentContainerStyle={sharedStyles.content} ref={scrollRef}>
      <View style={sharedStyles.buttonRow}>
        <Pressable
          onPress={() => {
            setSelectedImport(null);
          }}
          style={sharedStyles.secondaryButton}
        >
          <Text style={sharedStyles.secondaryButtonText}>Back to imports</Text>
        </Pressable>
      </View>

      <View style={sharedStyles.card}>
        <Text style={sharedStyles.cardTitle}>{selectedImport.name}</Text>
        <View style={styles.summaryRow}>
          <Text style={sharedStyles.metaText}>Items</Text>
          <Text style={[sharedStyles.metaText, styles.summaryValue]}>
            {selectedImport.itemCount}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={sharedStyles.metaText}>Barcodes</Text>
          <Text style={[sharedStyles.metaText, styles.summaryValue]}>
            {selectedImport.barcodeCount}/{selectedImport.itemCount}
          </Text>
        </View>
      </View>

      <View style={sharedStyles.card}>
        <Text style={sharedStyles.cardTitle}>Search this import</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setImportSearch}
          style={sharedStyles.input}
          value={importSearch}
        />
        <Text style={sharedStyles.metaText}>
          Showing {filteredImportItems.length} of {selectedImport.items.length} item(s).
        </Text>
      </View>

      {pagedImportItems.length > 0 ? (
        pagedImportItems.map((item) => (
          <ImportItemCard key={item.position} item={item} />
        ))
      ) : (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.bodyText}>No items match that search.</Text>
        </View>
      )}

      <PaginationControls
        onPageChange={handlePageChange}
        page={importPage}
        pageSize={IMPORT_ITEMS_PAGE_SIZE}
        totalItems={filteredImportItems.length}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryValue: {
    fontWeight: "800",
  },
  itemRow: {
    flexDirection: "row",
    gap: 12,
  },
  itemDetails: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  itemBarcode: {
    flex: 1,
    minWidth: 0,
    minHeight: 72,
    alignItems: "flex-end",
    justifyContent: "flex-end",
  },
});

function ImportItemCard({ item }: { item: ImportedItem }): React.ReactElement {
  const rawBarcode = typeof item.barcode === "string" ? item.barcode : "";
  const baseProductLabel = formatBaseProductForDisplay(item.baseProduct);
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
        Base product {baseProductLabel}
      </Text>
      <View style={styles.itemRow}>
        <View style={styles.itemDetails}>
          {hasBarcodeDigits && (!normalizedBarcode || barcodeError) ? (
            <Text style={sharedStyles.metaText}>Barcode not scannable</Text>
          ) : null}
          {!hasBarcodeDigits ? <Text style={sharedStyles.metaText}>Barcode missing</Text> : null}
        </View>
        {barcodeToShow ? (
          <View style={styles.itemBarcode}>
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

function formatBaseProductForDisplay(value: string): string {
  const digits = value.trim().replace(/\D/g, "");
  if (!digits) {
    return value.trim();
  }

  const stripped = digits.replace(/^0+/, "");
  return stripped || "0";
}
