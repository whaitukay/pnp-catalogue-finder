import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { PaginationControls } from "../components/PaginationControls";
import { StatusBadge } from "../components/StatusBadge";
import { usePaginatedScroll } from "../hooks";
import { BRAND, sharedStyles } from "../theme";
import type { ManifestEntry } from "../types";
import {
  formatDateRange,
  formatTimestamp,
  getCatalogueTimingStatus,
} from "../utils/catalogueUi";

// This screen is not currently wired into the app's navigation.

type EmailScreenProps = {
  pagedEmailCatalogues: ManifestEntry[];
  visibleCachedCatalogues: ManifestEntry[];
  emailPage: number;
  selectedEmailId: string | null;
  selectedEmailEntry: ManifestEntry | null;
  emailTo: string;
  emailSubject: string;
  emailBody: string;
  onSelectCatalogue: (catalogueId: string) => void;
  onEmailPageChange: (nextPage: number) => void;
  onEmailToChange: (value: string) => void;
  onEmailSubjectChange: (value: string) => void;
  onEmailBodyChange: (value: string) => void;
  onSendEmail: () => void;
};

export function EmailScreen({
  pagedEmailCatalogues,
  visibleCachedCatalogues,
  emailPage,
  selectedEmailId,
  selectedEmailEntry,
  emailTo,
  emailSubject,
  emailBody,
  onSelectCatalogue,
  onEmailPageChange,
  onEmailToChange,
  onEmailSubjectChange,
  onEmailBodyChange,
  onSendEmail,
}: EmailScreenProps): React.ReactElement {
  const { scrollRef, handlePageChange } = usePaginatedScroll(onEmailPageChange);

  return (
    <ScrollView contentContainerStyle={sharedStyles.content} ref={scrollRef}>
      <ViewIntro />

      {pagedEmailCatalogues.length > 0 ? (
        pagedEmailCatalogues.map((item) => {
          const selected = item.catalogueId === selectedEmailId;
          const timingStatus = getCatalogueTimingStatus(
            item.catalogueStartDate,
            item.catalogueEndDate,
          );
          return (
            <Pressable
              key={item.catalogueId}
              onPress={() => onSelectCatalogue(item.catalogueId)}
              style={[styles.selectCard, selected && styles.selectCardActive]}
            >
              <View style={styles.selectCardHeader}>
                <Text style={[styles.selectCardTitle, selected && styles.selectCardTitleActive]}>
                  {item.label}
                </Text>
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
              <Text style={[sharedStyles.metaText, selected && styles.selectCardMetaActive]}>
                {item.barcodeCount}/{item.itemCount} barcodes | {formatDateRange(item.catalogueStartDate, item.catalogueEndDate)}
              </Text>
            </Pressable>
          );
        })
      ) : (
        <EmptyState />
      )}

      <PaginationControls
        onPageChange={handlePageChange}
        page={emailPage}
        pageSize={8}
        totalItems={visibleCachedCatalogues.length}
      />

      {selectedEmailEntry ? (
        <ViewSummary entry={selectedEmailEntry} />
      ) : null}

      <Text style={sharedStyles.label}>To</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onEmailToChange}
        placeholder="buyer@example.com; ops@example.com"
        style={sharedStyles.input}
        value={emailTo}
      />

      <Text style={sharedStyles.label}>Subject</Text>
      <TextInput
        onChangeText={onEmailSubjectChange}
        placeholder="Catalogue export"
        style={sharedStyles.input}
        value={emailSubject}
      />

      <Text style={sharedStyles.label}>Message</Text>
      <TextInput
        multiline
        onChangeText={onEmailBodyChange}
        placeholder="Attached is the catalogue CSV."
        style={[sharedStyles.input, sharedStyles.inputLarge]}
        value={emailBody}
      />

      <Pressable onPress={onSendEmail} style={sharedStyles.primaryButton}>
        <Text style={sharedStyles.primaryButtonText}>Open email composer</Text>
      </Pressable>
    </ScrollView>
  );
}

function ViewIntro(): React.ReactElement {
  return (
    <ViewSummaryShell>
      <Text style={sharedStyles.cardTitle}>Email a CSV attachment</Text>
    </ViewSummaryShell>
  );
}

function ViewSummary({ entry }: { entry: ManifestEntry }): React.ReactElement {
  const timingStatus = getCatalogueTimingStatus(
    entry.catalogueStartDate,
    entry.catalogueEndDate,
  );

  return (
    <ViewSummaryShell>
      <View style={styles.selectCardHeader}>
        <Text style={sharedStyles.cardTitle}>{entry.label}</Text>
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
      <Text style={sharedStyles.metaText}>
        {entry.barcodeCount}/{entry.itemCount} barcodes | updated {formatTimestamp(entry.exportedAt)}
      </Text>
      <Text style={sharedStyles.metaText}>
        {formatDateRange(entry.catalogueStartDate, entry.catalogueEndDate)}
      </Text>
    </ViewSummaryShell>
  );
}

function ViewSummaryShell({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <View style={sharedStyles.card}>{children}</View>;
}

function EmptyState(): React.ReactElement {
  return (
    <ViewSummaryShell>
      <Text style={sharedStyles.bodyText}>
        No cached dumps are available to email yet.
      </Text>
    </ViewSummaryShell>
  );
}

const styles = StyleSheet.create({
  selectCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  selectCard: {
    backgroundColor: BRAND.white,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 18,
    padding: 14,
    gap: 4,
  },
  selectCardActive: {
    backgroundColor: BRAND.blue,
    borderColor: BRAND.blue,
  },
  selectCardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: BRAND.ink,
  },
  selectCardTitleActive: {
    color: BRAND.white,
  },
  selectCardMetaActive: {
    color: "#dfeeff",
  },
});
