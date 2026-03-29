import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import Barcode from "@kichiyaki/react-native-barcode-generator";

import { PaginationControls } from "../components/PaginationControls";
import { StatusBadge } from "../components/StatusBadge";
import { sharedStyles } from "../theme";
import type { CatalogueDump, ManifestEntry, ProductRow } from "../types";
import { formatTimestamp, formatDateStampRange, getCatalogueTimingStatus } from "../utils/catalogueUi";

type DumpsScreenProps = {
  selectedDump: CatalogueDump | null;
  pagedDumpLibrary: ManifestEntry[];
  visibleCachedCatalogues: ManifestEntry[];
  dumpLibraryPage: number;
  dumpSearch: string;
  filteredDumpRows: ProductRow[];
  pagedDumpRows: ProductRow[];
  dumpRowsPage: number;
  onOpenDump: (catalogueId: string) => void;
  onBackToLibrary: () => void;
  onEmailDump: (catalogueId: string) => void;
  onDumpLibraryPageChange: (nextPage: number) => void;
  onDumpSearchChange: (value: string) => void;
  onDumpRowsPageChange: (nextPage: number) => void;
};

export function DumpsScreen({
  selectedDump,
  pagedDumpLibrary,
  visibleCachedCatalogues,
  dumpLibraryPage,
  dumpSearch,
  filteredDumpRows,
  pagedDumpRows,
  dumpRowsPage,
  onOpenDump,
  onBackToLibrary,
  onEmailDump,
  onDumpLibraryPageChange,
  onDumpSearchChange,
  onDumpRowsPageChange,
}: DumpsScreenProps): React.ReactElement {
  if (selectedDump) {
    const selectedDumpTiming = getCatalogueTimingStatus(
      selectedDump.catalogueStartDate,
      selectedDump.catalogueEndDate,
    );

    return (
      <ScrollView contentContainerStyle={sharedStyles.content}>
        <View style={sharedStyles.buttonRow}>
          <Pressable onPress={onBackToLibrary} style={sharedStyles.secondaryButton}>
            <Text style={sharedStyles.secondaryButtonText}>Back to dumps</Text>
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
          <Text style={sharedStyles.bodyText}>
            {selectedDump.barcodeCount}/{selectedDump.itemCount} barcodes found
          </Text>
          <Text style={sharedStyles.metaText}>
            {formatDateStampRange(selectedDump.catalogueStartDate, selectedDump.catalogueEndDate)}
          </Text>
          <Text style={sharedStyles.metaText}>
            Updated {formatTimestamp(selectedDump.exportedAt)}
          </Text>
          {selectedDump.sourceUrl ? (
            <Text numberOfLines={1} style={sharedStyles.linkText}>
              {selectedDump.sourceUrl}
            </Text>
          ) : null}
        </View>

        <View style={sharedStyles.card}>
          <Text style={sharedStyles.cardTitle}>Search this dump</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={onDumpSearchChange}
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
    );
  }

  return (
    <ScrollView contentContainerStyle={sharedStyles.content}>
      <View style={sharedStyles.card}>
        <Text style={sharedStyles.cardTitle}>Cached dump library</Text>
        <Text style={sharedStyles.bodyText}>
          Open any cached dump to inspect products, search for a barcode, and send the current CSV by email.
        </Text>
      </View>

      {pagedDumpLibrary.length > 0 ? (
        pagedDumpLibrary.map((item) => (
          <DumpLibraryCard
            item={item}
            key={item.catalogueId}
            onEmailDump={onEmailDump}
            onOpenDump={onOpenDump}
          />
        ))
      ) : (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.bodyText}>
            No cached dumps are available for this store yet.
          </Text>
        </View>
      )}

      <PaginationControls
        onPageChange={onDumpLibraryPageChange}
        page={dumpLibraryPage}
        pageSize={8}
        totalItems={visibleCachedCatalogues.length}
      />
    </ScrollView>
  );
}

/**
 * Render a card summarizing a cached catalogue dump for the library view.
 *
 * Renders title, timing badge, item counts, promotion date range, last-updated timestamp, and action buttons.
 *
 * @param item - Manifest entry containing metadata for the catalogue dump
 * @param onOpenDump - Callback invoked with the catalogueId when the "Open dump" button is pressed
 * @param onEmailDump - Callback invoked with the catalogueId when the "Email CSV" button is pressed
 * @returns A React element representing the dump library card
 */
function DumpLibraryCard({
  item,
  onOpenDump,
  onEmailDump,
}: {
  item: ManifestEntry;
  onOpenDump: (catalogueId: string) => void;
  onEmailDump: (catalogueId: string) => void;
}): React.ReactElement {
  const timingStatus = getCatalogueTimingStatus(
    item.catalogueStartDate,
    item.catalogueEndDate,
  );

  return (
    <View key={item.catalogueId} style={sharedStyles.card}>
      <View style={sharedStyles.cardHeaderRow}>
        <View style={sharedStyles.cardHeaderText}>
          <Text style={sharedStyles.cardTitle}>{item.label}</Text>
        </View>
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
      <Text style={sharedStyles.bodyText}>
        {item.barcodeCount} items
      </Text>
      <Text style={sharedStyles.metaText}>
        {formatDateStampRange(item.promotionStartDate, item.promotionEndDate)}
      </Text>
      <Text style={sharedStyles.metaText}>
        Updated {formatTimestamp(item.exportedAt)}
      </Text>
      <View style={sharedStyles.buttonRow}>
        <Pressable onPress={() => onOpenDump(item.catalogueId)} style={sharedStyles.primaryButton}>
          <Text style={sharedStyles.primaryButtonText}>Open dump</Text>
        </Pressable>
        <Pressable
          onPress={() => onEmailDump(item.catalogueId)}
          style={sharedStyles.secondaryButton}
        >
          <Text style={sharedStyles.secondaryButtonText}>Email CSV</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DumpRowCard({ row }: { row: ProductRow }): React.ReactElement {
  const eanValue = normalizeEan13(row.barcode);
  const [barcodeWidth, setBarcodeWidth] = React.useState<number | null>(null);

  return (
    <View style={sharedStyles.card}>
      <View style={styles.dumpRowCardRow}>
        <View style={styles.dumpRowCardDetails}>
          <Text numberOfLines={2} style={sharedStyles.cardTitle}>
            {row.name || row.productCode}
          </Text>
          {row.baseProduct ? (
            <Text style={sharedStyles.metaText}>Base product: {+row.baseProduct}</Text>
          ) : null}
          {!eanValue ? <Text style={sharedStyles.metaText}>Barcode missing</Text> : null}
          {row.error ? <Text style={sharedStyles.errorSmall}>{row.error}</Text> : null}
        </View>
        {eanValue ? (
          <View
            onLayout={(event) => {
              const nextWidth = Math.floor(event.nativeEvent.layout.width);
              if (nextWidth > 0 && nextWidth !== barcodeWidth) {
                setBarcodeWidth(nextWidth);
              }
            }}
            style={styles.dumpRowCardBarcode}
          >
            <Barcode
              background="#ffffff"
              format="EAN13"
              height={58}
              lineColor="#142131"
              maxWidth={barcodeWidth ?? 160}
              text={eanValue}
              textStyle={styles.barcodeText}
              value={eanValue}
              width={1.4}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function normalizeEan13(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 13) {
    return digits;
  }

  if (digits.length === 12) {
    return `${digits}${ean13CheckDigit(digits)}`;
  }

  return null;
}

function ean13CheckDigit(twelveDigits: string): string {
  let sum = 0;
  for (let index = 0; index < 12; index += 1) {
    const digit = Number(twelveDigits[index]);
    if (!Number.isFinite(digit)) {
      return "0";
    }

    sum += digit * (index % 2 === 0 ? 1 : 3);
  }

  return String((10 - (sum % 10)) % 10);
}

const styles = StyleSheet.create({
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
    alignItems: "flex-end",
    justifyContent: "flex-end",
  },
  barcodeText: {
    fontSize: 11,
    color: "#142131",
    marginTop: 2,
  },
});
