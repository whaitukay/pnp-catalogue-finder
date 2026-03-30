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
import { sharedStyles } from "../theme";
import type { ImportedCatalogue, ImportedItem } from "../types";
import { normalizeBarcodeForRendering } from "../utils/barcodes";

type ImportViewScreenProps = {
  selectedImport: ImportedCatalogue;
  importSearch: string;
  filteredImportItems: ImportedItem[];
  pagedImportItems: ImportedItem[];
  importPage: number;
  onBack: () => void;
  onImportSearchChange: (value: string) => void;
  onImportPageChange: (nextPage: number) => void;
};

export function ImportViewScreen({
  selectedImport,
  importSearch,
  filteredImportItems,
  pagedImportItems,
  importPage,
  onBack,
  onImportSearchChange,
  onImportPageChange,
}: ImportViewScreenProps): React.ReactElement {
  return (
    <ScrollView contentContainerStyle={sharedStyles.content}>
      <View style={sharedStyles.buttonRow}>
        <Pressable onPress={onBack} style={sharedStyles.secondaryButton}>
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
          onChangeText={onImportSearchChange}
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
        onPageChange={onImportPageChange}
        page={importPage}
        pageSize={24}
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
