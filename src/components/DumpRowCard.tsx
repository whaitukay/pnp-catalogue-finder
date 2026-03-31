import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { sharedStyles } from "../theme";
import type { ProductRow } from "../types";
import { normalizeBarcodeForRendering } from "../utils/barcodes";

import { BarcodeImage } from "./BarcodeImage";

type DumpRowCardProps = {
  row: ProductRow;
};

export function DumpRowCard({ row }: DumpRowCardProps): React.ReactElement {
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
      <View style={styles.row}>
        <View style={styles.details}>
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
          <View style={styles.barcode}>
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

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
  },
  details: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  barcode: {
    flex: 1,
    minWidth: 0,
    minHeight: 72,
    alignItems: "flex-end",
    justifyContent: "flex-end",
  },
});
