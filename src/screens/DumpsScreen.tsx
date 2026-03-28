import React from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { PaginationControls } from "../components/PaginationControls";
import { StatusBadge } from "../components/StatusBadge";
import { sharedStyles } from "../theme";
import type { CatalogueDump, ManifestEntry, ProductRow } from "../types";
import {
  formatDateRange,
  formatTimestamp,
  formatDateStampRange,
  getCatalogueTimingStatus,
} from "../utils/catalogueUi";

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
          {/* <Text style={sharedStyles.metaText}>{item.slug}</Text> */}
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
  return (
    <View style={sharedStyles.card}>
      <Text style={sharedStyles.cardTitle}>{row.name || row.productCode}</Text>
      <Text style={sharedStyles.metaText}>Barcode: {row.barcode || "Missing"}</Text>
      {row.baseProduct ? (
        <Text style={sharedStyles.metaText}>Base product: {+row.baseProduct}</Text>
      ) : null}
      {row.price ? <Text style={sharedStyles.metaText}>Price: {row.price}</Text> : null}
      {/* {(row.promotionStartDate || row.promotionEndDate) ? (
        <Text style={sharedStyles.metaText}>
          {formatDateRange(row.promotionStartDate, row.promotionEndDate)}
        </Text>
      ) : null} */}
      {row.promotion ? <Text style={sharedStyles.bodyText}>{row.promotion}</Text> : null}
      {/* {row.promotionRanges ? (
        <Text style={sharedStyles.metaText}>{row.promotionRanges}</Text>
      ) : null} */}
      {row.error ? <Text style={sharedStyles.errorSmall}>{row.error}</Text> : null}
    </View>
  );
}
